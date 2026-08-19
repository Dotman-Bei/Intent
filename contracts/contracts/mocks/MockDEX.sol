// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockDEX
/// @notice Testnet stand-in for a liquidity pool. Accrues yield linearly from the advertised APY so
///         the simulator's projection can be checked against something that actually moves.
contract MockDEX {
    using SafeERC20 for IERC20;

    struct Deposit {
        uint256 amount;
        uint256 since;
    }

    /// @notice Advertised APY in basis points (850 = 8.50%).
    uint256 public apyBps;
    string public poolName;

    mapping(address => mapping(address => Deposit)) public deposits; // depositor => token => deposit

    event Deposited(address indexed from, address indexed token, uint256 amount);
    event Withdrawn(address indexed to, address indexed token, uint256 principal, uint256 yieldPaid);

    constructor(string memory _poolName, uint256 _apyBps) {
        poolName = _poolName;
        apyBps = _apyBps;
    }

    function deposit(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        Deposit storage d = deposits[msg.sender][_token];
        // Settle whatever accrued so far into the principal before re-basing the clock.
        d.amount = d.amount + accrued(msg.sender, _token) + _amount;
        d.since = block.timestamp;
        emit Deposited(msg.sender, _token, _amount);
    }

    function withdraw(address _token, uint256 _amount) external returns (uint256 paid) {
        Deposit storage d = deposits[msg.sender][_token];
        uint256 earned = accrued(msg.sender, _token);
        require(d.amount >= _amount, "MockDEX: amount exceeds principal");

        paid = _amount + earned;
        uint256 liquidity = IERC20(_token).balanceOf(address(this));
        if (paid > liquidity) paid = liquidity; // testnet pool may be unfunded for the yield leg

        d.amount -= _amount;
        d.since = block.timestamp;

        IERC20(_token).safeTransfer(msg.sender, paid);
        emit Withdrawn(msg.sender, _token, _amount, paid - _amount);
    }

    /// @notice Yield accrued since the last deposit/withdraw, straight-line from the APY.
    function accrued(address _depositor, address _token) public view returns (uint256) {
        Deposit memory d = deposits[_depositor][_token];
        if (d.amount == 0 || d.since == 0) return 0;
        uint256 elapsed = block.timestamp - d.since;
        return (d.amount * apyBps * elapsed) / (10_000 * 365 days);
    }

    function balanceOfDepositor(address _depositor, address _token) external view returns (uint256) {
        return deposits[_depositor][_token].amount + accrued(_depositor, _token);
    }

    function getAPY() external view returns (uint256) {
        return apyBps;
    }

    function setAPY(uint256 _apyBps) external {
        apyBps = _apyBps;
    }
}
