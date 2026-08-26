// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./StrategyRegistry.sol";
import "./ApprovalGate.sol";

/// @title IntentVault
/// @notice Custody + execution for IntentFlow. Users deposit, the agent (or the user) executes a
///         registry-whitelisted strategy against an intent hash, and positions are tracked on-chain
///         so the portfolio view is derived from chain state rather than backend memory.
contract IntentVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 strategyId;
        address token;
        uint256 amount;
        uint256 entryTimestamp;
        uint256 exitTimestamp;
        bytes32 intentHash;
        bool active;
    }

    StrategyRegistry public immutable registry;
    ApprovalGate public immutable approvalGate;

    address public owner;
    address public agentExecutor; // AI agent backend wallet

    /// @dev user => token => balance sitting idle in the vault (not deployed to a strategy).
    mapping(address => mapping(address => uint256)) public freeBalance;
    mapping(address => Position[]) private _positions;
    mapping(address => mapping(bytes32 => bool)) public executedIntents;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event StrategyExecuted(
        address indexed user,
        bytes32 indexed intentHash,
        uint256 indexed strategyId,
        address token,
        uint256 amount,
        uint256 positionId
    );
    event PositionClosed(
        address indexed user,
        uint256 indexed positionId,
        uint256 principal,
        uint256 returned
    );
    event Withdrawal(address indexed user, address indexed token, uint256 amount);
    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotAuthorized();
    error ZeroAmount();
    error ZeroAddress();
    error IntentAlreadyExecuted(bytes32 intentHash);
    error StrategyInactive(uint256 strategyId);
    error ApprovalRequired(bytes32 intentHash);
    error InsufficientBalance(uint256 available, uint256 requested);
    error UnknownPosition(uint256 positionId);
    error PositionNotActive(uint256 positionId);
    error StrategyCallFailed();
    error StrategyExitFailed(uint256 positionId, address protocol);

    /// @dev Fallback shapes, used when the registry entry leaves a selector unset. They match the
    ///      mock venues; a real protocol almost never does, which is what setDepositCall and
    ///      setWithdrawCall exist for.
    bytes4 private constant DEFAULT_DEPOSIT = bytes4(keccak256("deposit(address,uint256)"));
    bytes4 private constant DEFAULT_WITHDRAW = bytes4(keccak256("withdraw(address,uint256)"));

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Execution is open to the agent EOA *and* to the position owner. The agent path is the
    ///      automated one; the user path is what the frontend uses so a wallet signature can settle
    ///      an intent without the backend holding a funded key.
    modifier onlyAgentOrUser(address _user) {
        if (msg.sender != agentExecutor && msg.sender != _user) revert NotAuthorized();
        _;
    }

    constructor(address _registry, address _approvalGate, address _agent) {
        if (_registry == address(0) || _approvalGate == address(0) || _agent == address(0)) {
            revert ZeroAddress();
        }
        registry = StrategyRegistry(_registry);
        approvalGate = ApprovalGate(_approvalGate);
        agentExecutor = _agent;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AgentUpdated(address(0), _agent);
    }

    // ---------------------------------------------------------------- custody

    function deposit(address _token, uint256 _amount) external nonReentrant {
        if (_amount == 0) revert ZeroAmount();
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        freeBalance[msg.sender][_token] += _amount;
        emit Deposit(msg.sender, _token, _amount);
    }

    function withdraw(address _token, uint256 _amount) external nonReentrant {
        if (_amount == 0) revert ZeroAmount();
        uint256 available = freeBalance[msg.sender][_token];
        if (available < _amount) revert InsufficientBalance(available, _amount);

        freeBalance[msg.sender][_token] = available - _amount;
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit Withdrawal(msg.sender, _token, _amount);
    }

    // -------------------------------------------------------------- execution

    /// @param _intentHash keccak256 of the canonical intent JSON produced by the agent. Doubles as
    ///        the replay guard and as the handle the user signs in ApprovalGate.
    /// @dev The protocol calldata is built here, from the venue's registry-declared entry shape.
    ///      It used to be a caller-supplied `_strategyData` parameter, which was exploitable: the
    ///      vault approves `_amount` to the protocol and then calls it with whatever bytes it was
    ///      handed, so a caller could pass the venue's *withdraw* calldata instead of its deposit
    ///      calldata and pull every other user's principal out of the pooled venue balance for the
    ///      price of a 1-token position. Those tokens landed in the vault unattributed and left
    ///      every other position permanently unclosable.
    function executeIntent(
        address _user,
        bytes32 _intentHash,
        uint256 _strategyId,
        address _token,
        uint256 _amount
    ) external onlyAgentOrUser(_user) nonReentrant returns (uint256 positionId) {
        if (_amount == 0) revert ZeroAmount();
        if (executedIntents[_user][_intentHash]) revert IntentAlreadyExecuted(_intentHash);

        StrategyRegistry.Strategy memory strategy = registry.getStrategy(_strategyId);
        if (!strategy.active) revert StrategyInactive(_strategyId);

        if (approvalGate.recordIntent(_user, _intentHash, _amount)) {
            revert ApprovalRequired(_intentHash);
        }

        uint256 available = freeBalance[_user][_token];
        if (available < _amount) revert InsufficientBalance(available, _amount);

        executedIntents[_user][_intentHash] = true;
        freeBalance[_user][_token] = available - _amount;

        // Approve exactly the amount, hand it to the protocol, then drop the allowance back to zero
        // so a whitelisted-but-buggy protocol cannot come back for more later.
        IERC20(_token).forceApprove(strategy.protocol, _amount);
        (bool success, ) = strategy.protocol.call(
            _venueCalldata(strategy.depositSelector, DEFAULT_DEPOSIT, strategy.depositArgs, _token, _amount)
        );
        if (!success) revert StrategyCallFailed();
        IERC20(_token).forceApprove(strategy.protocol, 0);

        positionId = _positions[_user].length;
        _positions[_user].push(
            Position({
                strategyId: _strategyId,
                token: _token,
                amount: _amount,
                entryTimestamp: block.timestamp,
                exitTimestamp: 0,
                intentHash: _intentHash,
                active: true
            })
        );

        emit StrategyExecuted(_user, _intentHash, _strategyId, _token, _amount, positionId);
    }

    /// @dev Build calldata for a venue from its registry-declared shape.
    ///
    ///      The selector and argument order come from the registry (owner-set); the token and
    ///      amount come from the vault's own accounting. Nothing here is caller-supplied, and
    ///      that is the property doing the security work on both legs: venues pool every user's
    ///      funds under this vault's single address, so any caller able to choose the selector or
    ///      the amount could reach other users' principal.
    function _venueCalldata(
        bytes4 _selector,
        bytes4 _default,
        StrategyRegistry.ArgLayout _args,
        address _token,
        uint256 _amount
    ) internal view returns (bytes memory) {
        bytes4 selector = _selector == bytes4(0) ? _default : _selector;

        if (_args == StrategyRegistry.ArgLayout.TokenThenAmount) {
            return abi.encodeWithSelector(selector, _token, _amount);
        }
        if (_args == StrategyRegistry.ArgLayout.AmountThenToken) {
            return abi.encodeWithSelector(selector, _amount, _token);
        }
        if (_args == StrategyRegistry.ArgLayout.AmountOnly) {
            return abi.encodeWithSelector(selector, _amount);
        }
        // ERC-4626: the address arguments are receiver and share owner. Both are this vault —
        // it is what holds the position, so it must be what holds and burns the shares.
        if (_args == StrategyRegistry.ArgLayout.AmountThenReceiver) {
            return abi.encodeWithSelector(selector, _amount, address(this));
        }
        return abi.encodeWithSelector(selector, _amount, address(this), address(this));
    }

    /// @notice Pull a position back out of its protocol. Whatever comes back (principal + yield)
    ///         lands in the free balance of the user, ready to withdraw.
    function closePosition(
        address _user,
        uint256 _positionId
    ) external onlyAgentOrUser(_user) nonReentrant returns (uint256 returned) {
        if (_positionId >= _positions[_user].length) revert UnknownPosition(_positionId);
        Position storage position = _positions[_user][_positionId];
        if (!position.active) revert PositionNotActive(_positionId);

        StrategyRegistry.Strategy memory strategy = registry.getStrategy(position.strategyId);
        IERC20 token = IERC20(position.token);

        uint256 balanceBefore = token.balanceOf(address(this));
        (bool ok, ) = strategy.protocol.call(
            _venueCalldata(
                strategy.withdrawSelector,
                DEFAULT_WITHDRAW,
                strategy.withdrawArgs,
                position.token,
                position.amount
            )
        );
        if (!ok) revert StrategyExitFailed(_positionId, strategy.protocol);
        returned = token.balanceOf(address(this)) - balanceBefore;

        position.active = false;
        position.exitTimestamp = block.timestamp;
        freeBalance[_user][position.token] += returned;

        emit PositionClosed(_user, _positionId, position.amount, returned);
    }

    // ------------------------------------------------------------------ views

    function getPositions(address _user) external view returns (Position[] memory) {
        return _positions[_user];
    }

    function positionCount(address _user) external view returns (uint256) {
        return _positions[_user].length;
    }

    function getPosition(
        address _user,
        uint256 _positionId
    ) external view returns (Position memory) {
        if (_positionId >= _positions[_user].length) revert UnknownPosition(_positionId);
        return _positions[_user][_positionId];
    }

    /// @notice Total principal a user currently has deployed in a given token.
    function deployedBalance(address _user, address _token) external view returns (uint256 total) {
        Position[] memory list = _positions[_user];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].active && list[i].token == _token) total += list[i].amount;
        }
    }

    // ------------------------------------------------------------------ admin

    function updateAgent(address _newAgent) external onlyOwner {
        if (_newAgent == address(0)) revert ZeroAddress();
        emit AgentUpdated(agentExecutor, _newAgent);
        agentExecutor = _newAgent;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
