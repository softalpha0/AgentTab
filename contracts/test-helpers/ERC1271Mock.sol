// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal ERC-1271 smart-contract wallet that approves ALL signatures.
contract ERC1271Mock {
    bytes4 internal constant MAGIC_VALUE = 0x1626ba7e;

    /// @dev ERC-1271: isValidSignature — returns magic value for any digest/sig.
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) {
        return MAGIC_VALUE;
    }

    /// @dev Allow the mock wallet to approve the AgentTabV2 contract to pull USDC.
    function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }
}
