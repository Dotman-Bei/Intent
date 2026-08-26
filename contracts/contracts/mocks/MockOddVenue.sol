// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockOddVenue
/// @notice A venue that does *not* speak `withdraw(address,uint256)`. Real protocols rarely do —
///         they name the function differently and order the arguments the other way round — and a
///         vault that can only emit one hardcoded exit call strands funds in every one of them.
///         Exists to prove IntentVault can exit a venue whose signature it was never built around.
contract MockOddVenue {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public principal; // depositor => token => amount

    event Supplied(address indexed from, address indexed token, uint256 amount);
    event Redeemed(address indexed to, address indexed token, uint256 amount);

    /// @dev Entry is `supply`, not `deposit` — reached through the vault's arbitrary strategy
    ///      calldata, which already handles this.
    function supply(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        principal[msg.sender][_token] += _amount;
        emit Supplied(msg.sender, _token, _amount);
    }

    /// @dev Exit is `redeem`, and takes (amount, token) — the reverse of the mocks. This is the
    ///      signature the old fixed `IStrategyProtocol` interface could never have called.
    function redeem(uint256 _amount, address _token) external returns (uint256) {
        require(principal[msg.sender][_token] >= _amount, "MockOddVenue: exceeds principal");
        principal[msg.sender][_token] -= _amount;
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit Redeemed(msg.sender, _token, _amount);
        return _amount;
    }

    function balanceOfDepositor(address _depositor, address _token) external view returns (uint256) {
        return principal[_depositor][_token];
    }
}
