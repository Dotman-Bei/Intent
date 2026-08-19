// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Testnet token (wBOT / test USDC) with an open faucet so demo wallets can self-fund.
contract MockERC20 is ERC20 {
    uint8 private immutable _customDecimals;
    uint256 public constant FAUCET_AMOUNT = 1_000 ether;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) {
        _customDecimals = decimals_;
        if (initialSupply > 0) _mint(msg.sender, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Testnet faucet — 1,000 tokens per call, no gating on purpose.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
