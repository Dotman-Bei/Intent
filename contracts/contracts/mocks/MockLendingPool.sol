// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockLendingPool
/// @notice Second testnet venue so the strategy engine has something to rank against. Same
///         deposit/withdraw shape as MockDEX, different risk and APY profile.
contract MockLendingPool {
    using SafeERC20 for IERC20;

    uint256 public supplyApyBps;
    uint256 public utilizationBps; // affects nothing on testnet beyond being readable

    mapping(address => mapping(address => uint256)) public supplied;
    mapping(address => mapping(address => uint256)) public suppliedAt;

    event Supplied(address indexed from, address indexed token, uint256 amount);
    event Redeemed(address indexed to, address indexed token, uint256 principal, uint256 interest);

    constructor(uint256 _supplyApyBps, uint256 _utilizationBps) {
        supplyApyBps = _supplyApyBps;
        utilizationBps = _utilizationBps;
    }

    function deposit(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        supplied[msg.sender][_token] += _amount + interestAccrued(msg.sender, _token);
        suppliedAt[msg.sender][_token] = block.timestamp;
        emit Supplied(msg.sender, _token, _amount);
    }

    function withdraw(address _token, uint256 _amount) external returns (uint256 paid) {
        uint256 principal = supplied[msg.sender][_token];
        require(principal >= _amount, "MockLendingPool: amount exceeds supply");

        uint256 interest = interestAccrued(msg.sender, _token);
        paid = _amount + interest;
        uint256 liquidity = IERC20(_token).balanceOf(address(this));
        if (paid > liquidity) paid = liquidity;

        supplied[msg.sender][_token] = principal - _amount;
        suppliedAt[msg.sender][_token] = block.timestamp;

        IERC20(_token).safeTransfer(msg.sender, paid);
        emit Redeemed(msg.sender, _token, _amount, paid - _amount);
    }

    function interestAccrued(address _supplier, address _token) public view returns (uint256) {
        uint256 principal = supplied[_supplier][_token];
        uint256 since = suppliedAt[_supplier][_token];
        if (principal == 0 || since == 0) return 0;
        return (principal * supplyApyBps * (block.timestamp - since)) / (10_000 * 365 days);
    }

    function getAPY() external view returns (uint256) {
        return supplyApyBps;
    }

    function setAPY(uint256 _supplyApyBps) external {
        supplyApyBps = _supplyApyBps;
    }
}
