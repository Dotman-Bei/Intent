// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockERC4626
/// @notice Minimal tokenized-vault stand-in matching the entry and exit signatures BulwarkVault
///         exposes on BOT Chain mainnet: `deposit(uint256,address)` and
///         `withdraw(uint256,address,address)`. Both take addresses that are a *receiver* and a
///         share *owner* — not the token — which is the distinction the ArgLayout enum has to
///         encode correctly, and the reason this mock exists.
contract MockERC4626 {
    using SafeERC20 for IERC20;

    IERC20 public immutable assetToken;
    mapping(address => uint256) public balanceOf; // shares
    uint256 public totalSupply;

    constructor(address _asset) {
        assetToken = IERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(assetToken);
    }

    function totalAssets() public view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }

    /// @dev 1:1 while nothing has been donated to the vault; a direct transfer in raises the
    ///      share price, which is how yield reaches holders in a real 4626.
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 || totalAssets() == 0 ? assets : (assets * supply) / totalAssets();
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        shares = convertToShares(assets);
        assetToken.safeTransferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += shares;
        totalSupply += shares;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        shares = convertToShares(assets);
        require(balanceOf[owner] >= shares, "MockERC4626: insufficient shares");
        require(msg.sender == owner, "MockERC4626: not owner");
        balanceOf[owner] -= shares;
        totalSupply -= shares;
        assetToken.safeTransfer(receiver, assets);
    }
}
