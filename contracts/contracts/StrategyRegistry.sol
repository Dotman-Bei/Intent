// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StrategyRegistry
/// @notice Whitelist + metadata for every protocol IntentFlow is allowed to route into.
///         The AI agent may only ever propose a strategy that lives in here and is active,
///         which is what keeps a natural-language intent from reaching an arbitrary address.
contract StrategyRegistry {
    struct Strategy {
        address protocol;
        string name;
        string protocolType; // "DEX" | "Lending" | "Staking"
        uint256 riskScore; // 1-10, 1 = lowest
        uint256 baseApyBps; // advertised APY in basis points, 850 = 8.50%
        bool active;
        // How IntentVault must call this venue to exit a position. Owner-set, never user-set:
        // the vault builds the calldata itself from these two fields plus the position's own
        // token and amount, so a caller cannot ask a pooled venue for more than they put in.
        // Appended to the struct rather than inserted, so tuple indices 0-5 stay stable for
        // every off-chain reader already decoding this shape.
        bytes4 depositSelector; // 0x00000000 => deposit(address,uint256)
        ArgLayout depositArgs;
        bytes4 withdrawSelector; // 0x00000000 => withdraw(address,uint256)
        ArgLayout withdrawArgs;
    }

    /// @notice Argument layout of a venue's entry or exit function. Real protocols disagree on
    ///         order and arity, which is the whole reason a single hardcoded interface cannot
    ///         serve them; anything outside these shapes needs a per-venue adapter contract.
    enum ArgLayout {
        TokenThenAmount, // f(address token, uint256 amount)
        AmountThenToken, // f(uint256 amount, address token)
        AmountOnly, // f(uint256 amount)
        // ERC-4626. The address arguments are the *receiver* and the share *owner*, never the
        // token — the vault fills both with its own address so shares are minted to, and burned
        // from, the contract that holds the position. Encoding an ERC-4626 venue as
        // AmountThenToken instead has the right arity and the wrong meaning: it would mint the
        // shares to the asset's own contract, where nothing can ever redeem them.
        AmountThenReceiver, // f(uint256 assets, address receiver)
        AmountReceiverOwner // f(uint256 assets, address receiver, address owner)
    }

    mapping(uint256 => Strategy) private _strategies;
    uint256 public strategyCount;
    address public owner;

    event StrategyAdded(uint256 indexed id, address protocol, string name);
    event StrategyUpdated(uint256 indexed id, bool active);
    event ApyUpdated(uint256 indexed id, uint256 baseApyBps);
    event DepositCallUpdated(uint256 indexed id, bytes4 selector, ArgLayout args);
    event WithdrawCallUpdated(uint256 indexed id, bytes4 selector, ArgLayout args);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error UnknownStrategy(uint256 id);
    error InvalidRisk(uint256 riskScore);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function addStrategy(
        address _protocol,
        string calldata _name,
        string calldata _protocolType,
        uint256 _riskScore,
        uint256 _baseApyBps
    ) external onlyOwner returns (uint256 id) {
        if (_protocol == address(0)) revert ZeroAddress();
        if (_riskScore == 0 || _riskScore > 10) revert InvalidRisk(_riskScore);

        id = strategyCount++;
        _strategies[id] = Strategy({
            protocol: _protocol,
            name: _name,
            protocolType: _protocolType,
            riskScore: _riskScore,
            baseApyBps: _baseApyBps,
            active: true,
            // Default to the shape both mock venues expose. A real protocol almost never
            // matches it, so setDepositCall/setWithdrawCall are required steps of registering
            // one, rehearsed by scripts/verify-exit.ts before any real deposit.
            depositSelector: bytes4(0),
            depositArgs: ArgLayout.TokenThenAmount,
            withdrawSelector: bytes4(0),
            withdrawArgs: ArgLayout.TokenThenAmount
        });
        emit StrategyAdded(id, _protocol, _name);
    }

    function setStrategyActive(uint256 _id, bool _active) external onlyOwner {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        _strategies[_id].active = _active;
        emit StrategyUpdated(_id, _active);
    }

    function setBaseApy(uint256 _id, uint256 _baseApyBps) external onlyOwner {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        _strategies[_id].baseApyBps = _baseApyBps;
        emit ApyUpdated(_id, _baseApyBps);
    }

    /// @notice Declare how the vault should call this venue to enter a position. Owner-only,
    ///         because it decides what calldata the vault will emit against real user funds.
    function setDepositCall(uint256 _id, bytes4 _selector, ArgLayout _args) external onlyOwner {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        _strategies[_id].depositSelector = _selector;
        _strategies[_id].depositArgs = _args;
        emit DepositCallUpdated(_id, _selector, _args);
    }

    /// @notice Declare how the vault should call this venue to withdraw. Owner-only, because it
    ///         decides what calldata the vault will emit against real user funds.
    function setWithdrawCall(
        uint256 _id,
        bytes4 _selector,
        ArgLayout _args
    ) external onlyOwner {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        _strategies[_id].withdrawSelector = _selector;
        _strategies[_id].withdrawArgs = _args;
        emit WithdrawCallUpdated(_id, _selector, _args);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /// @dev A struct-returning getter is required because the compiler-generated getter for a
    ///      public mapping flattens the struct into a tuple, which other contracts cannot
    ///      consume as `Strategy memory`.
    function getStrategy(uint256 _id) public view returns (Strategy memory) {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        return _strategies[_id];
    }

    function isActive(uint256 _id) external view returns (bool) {
        return _id < strategyCount && _strategies[_id].active;
    }

    /// @notice Active strategies plus their ids, so off-chain callers keep the id that
    ///         `IntentVault.executeIntent` expects.
    function getActiveStrategies()
        external
        view
        returns (uint256[] memory ids, Strategy[] memory list)
    {
        uint256 activeCount;
        for (uint256 i = 0; i < strategyCount; i++) {
            if (_strategies[i].active) activeCount++;
        }

        ids = new uint256[](activeCount);
        list = new Strategy[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < strategyCount; i++) {
            if (_strategies[i].active) {
                ids[idx] = i;
                list[idx] = _strategies[i];
                idx++;
            }
        }
    }
}
