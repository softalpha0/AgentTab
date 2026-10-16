// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AgentTabV2} from "../AgentTabV2.sol";

/// @dev Malicious ERC-20 that attempts reentrancy from transfer().
/// mode == 0 → reenter claim()
/// mode == 1 → reenter finalizeClose()
contract ReentrantERC20V2 is ERC20 {
    AgentTabV2 public target;
    uint256 public tabId;
    uint256 public totalCalls;
    bytes   public sig;
    uint8   public mode;

    // armed only after setTarget is called
    bool private _armed;

    constructor() ERC20("ReentrantV2", "REEV2") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev Wire up the reentrancy target after the tab is open.
    function setTarget(
        AgentTabV2 _target,
        uint256 _tabId,
        uint256 _totalCalls,
        bytes calldata _sig,
        uint8 _mode
    ) external {
        target     = _target;
        tabId      = _tabId;
        totalCalls = _totalCalls;
        sig        = _sig;
        mode       = _mode;
        _armed     = true;
    }

    /// @dev On outbound transfer (provider payout / refund), attempt reentry.
    ///      One-shot: disarm immediately to prevent infinite recursion.
    function transfer(address to, uint256 value) public override returns (bool) {
        bool ok = super.transfer(to, value);
        if (_armed) {
            _armed = false; // disarm before reentry to avoid infinite loops
            if (mode == 0) {
                target.claim(tabId, totalCalls, sig);
            } else {
                target.finalizeClose(tabId);
            }
        }
        return ok;
    }
}
