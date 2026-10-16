// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AgentTab} from "../AgentTab.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal ERC-20 mock with 6 decimals (mimics USDC for the constructor check)
// ─────────────────────────────────────────────────────────────────────────────
contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Malicious contract that attempts reentrancy from a token callback.
// It masquerades as an ERC-20 that calls back into AgentTab.claim() or
// AgentTab.closeTab() inside its own transferFrom() – simulating a fee-on-
// transfer / callback token attack path.
// ─────────────────────────────────────────────────────────────────────────────
contract ReentrancyAttacker is ERC20 {
    AgentTab public target;
    uint256 public tabId;
    uint256 public serviceId;

    // Which re-entry to test: 0 = claim, 1 = closeTab
    uint8 public mode;

    constructor() ERC20("Evil", "EVIL") {}

    function decimals() public pure override returns (uint8) { return 6; }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev Called by the test to wire up the target after deployment.
    function setTarget(AgentTab _target, uint256 _tabId, uint256 _serviceId, uint8 _mode) external {
        target = _target;
        tabId  = _tabId;
        serviceId = _serviceId;
        mode   = _mode;
    }

    /// @dev Override transferFrom so that when AgentTab pulls tokens (openTab /
    ///      topUp), this contract calls back into claim or closeTab.
    function transferFrom(address from, address to, uint256 value)
        public
        override
        returns (bool)
    {
        // Perform the real transfer first so balances stay consistent.
        bool ok = super.transferFrom(from, to, value);

        // Now attempt the reentrant call.
        if (address(target) != address(0)) {
            if (mode == 0) {
                // Try to reenter claim() – should hit nonReentrant guard.
                target.claim(tabId, 1);
            } else {
                // Try to reenter closeTab() – should hit nonReentrant guard.
                target.closeTab(tabId);
            }
        }
        return ok;
    }

    /// @dev Override transfer so that when AgentTab sends tokens out (claim /
    ///      closeTab), this contract calls back.
    function transfer(address to, uint256 value)
        public
        override
        returns (bool)
    {
        bool ok = super.transfer(to, value);

        if (address(target) != address(0)) {
            if (mode == 0) {
                target.claim(tabId, 1);
            } else {
                target.closeTab(tabId);
            }
        }
        return ok;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main test contract
// ─────────────────────────────────────────────────────────────────────────────
contract AgentTabTest is Test {
    AgentTab internal tab;
    MockERC20 internal usdc;

    address internal provider = makeAddr("provider");
    address internal client   = makeAddr("client");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant DECIMALS      = 6;
    uint256 internal constant PRICE_PER_CALL = 1e6;   // 1 USDC
    uint256 internal constant TAB_AMOUNT     = 10e6;  // 10 USDC

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// Deploy USDC mock + AgentTab, seed client with tokens.
    function setUp() public {
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        tab  = new AgentTab(address(usdc));

        // Give client 100 USDC and pre-approve the contract.
        usdc.mint(client, 100e6);
        vm.prank(client);
        usdc.approve(address(tab), type(uint256).max);
    }

    /// Register a service as `provider` and return its serviceId.
    function _registerService(uint256 pricePerCall) internal returns (uint256 serviceId) {
        vm.prank(provider);
        serviceId = tab.registerService("TestService", pricePerCall);
    }

    /// Open a tab as `client` and return the tabId.
    function _openTab(uint256 serviceId, uint256 amount) internal returns (uint256 tabId_) {
        vm.prank(client);
        tabId_ = tab.openTab(serviceId, amount);
    }

    // =========================================================================
    // 1. Normal claim
    // =========================================================================
    function test_NormalClaim() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        uint256 numberOfCalls  = 3;
        uint256 claimAmount    = numberOfCalls * PRICE_PER_CALL; // 3 USDC
        uint256 remainingBal   = TAB_AMOUNT - claimAmount;       // 7 USDC

        uint256 providerBefore = usdc.balanceOf(provider);

        // Expect the Claimed event with correct args.
        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTab.Claimed(tabId, provider, numberOfCalls, claimAmount, remainingBal);

        vm.prank(provider);
        tab.claim(tabId, numberOfCalls);

        // Provider received the USDC.
        assertEq(usdc.balanceOf(provider), providerBefore + claimAmount, "provider balance");

        // Tab balance decreased.
        (, , uint256 bal, ) = tab.tabs(tabId);
        assertEq(bal, remainingBal, "tab remaining balance");
    }

    // =========================================================================
    // 2. Overclaiming → InsufficientTabBalance
    // =========================================================================
    function test_OverclaimRevertsInsufficientTabBalance() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT); // 10 USDC, 10 calls max

        vm.prank(provider);
        vm.expectRevert(AgentTab.InsufficientTabBalance.selector);
        tab.claim(tabId, 11); // 11 × 1 USDC > 10 USDC balance
    }

    // =========================================================================
    // 3. Wrong caller claims → NotServiceProvider
    // =========================================================================
    function test_WrongCallerClaimRevertsNotServiceProvider() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotServiceProvider.selector);
        tab.claim(tabId, 1);
    }

    // =========================================================================
    // 4. Claiming from a closed tab → TabAlreadyClosed
    // =========================================================================
    function test_ClaimAfterCloseRevertsTabAlreadyClosed() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        // Client closes the tab.
        vm.prank(client);
        tab.closeTab(tabId);

        // Provider tries to claim.
        vm.prank(provider);
        vm.expectRevert(AgentTab.TabAlreadyClosed.selector);
        tab.claim(tabId, 1);
    }

    // =========================================================================
    // 5. Top-up: balance increases, TabToppedUp event emitted
    // =========================================================================
    function test_TopUp() public {
        uint256 serviceId  = _registerService(PRICE_PER_CALL);
        uint256 tabId      = _openTab(serviceId, TAB_AMOUNT);
        uint256 topUpAmt   = 5e6; // 5 USDC
        uint256 expectedBal = TAB_AMOUNT + topUpAmt;

        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTab.TabToppedUp(tabId, client, topUpAmt, expectedBal);

        vm.prank(client);
        tab.topUp(tabId, topUpAmt);

        (, , uint256 bal, ) = tab.tabs(tabId);
        assertEq(bal, expectedBal, "balance after top-up");
    }

    // =========================================================================
    // 6. Close after partial claim: refund = remaining balance, TabClosed event
    // =========================================================================
    function test_CloseAfterPartialClaim() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        // Provider claims 4 calls → 4 USDC out, 6 USDC remaining.
        vm.prank(provider);
        tab.claim(tabId, 4);

        uint256 expectedRefund = 6e6;
        uint256 clientBefore   = usdc.balanceOf(client);

        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTab.TabClosed(tabId, client, expectedRefund);

        vm.prank(client);
        tab.closeTab(tabId);

        // Client refunded exactly the remaining balance.
        assertEq(usdc.balanceOf(client), clientBefore + expectedRefund, "client refund");

        // Tab is marked closed with zero balance.
        (, , uint256 bal, bool closed) = tab.tabs(tabId);
        assertEq(bal, 0, "tab balance after close");
        assertTrue(closed, "tab should be closed");
    }

    // =========================================================================
    // 7a. Reentrancy on claim – attacker tries to reenter claim() via transfer
    // =========================================================================
    function test_ReentrancyOnClaim() public {
        // Deploy evil token (decimals = 6 satisfies the constructor check).
        ReentrancyAttacker evil = new ReentrancyAttacker();
        AgentTab evilTab = new AgentTab(address(evil));

        // Mint evil tokens to the client and approve.
        evil.mint(client, 100e6);
        vm.prank(client);
        evil.approve(address(evilTab), type(uint256).max);

        // Register a service and open a tab through the evil-token contract.
        vm.prank(provider);
        uint256 serviceId = evilTab.registerService("EvilService", PRICE_PER_CALL);

        // Temporarily disable the reentrant callback while opening the tab.
        evil.setTarget(AgentTab(address(0)), 0, serviceId, 0);
        vm.prank(client);
        uint256 tabId = evilTab.openTab(serviceId, TAB_AMOUNT);

        // Now arm the attacker: on the next transfer() (from claim), try to
        // reenter claim().
        evil.setTarget(evilTab, tabId, serviceId, 0);

        // Provider claims 1 call. The evil transfer() will attempt a reentrant
        // claim(). The nonReentrant guard must block it.
        vm.prank(provider);
        vm.expectRevert(); // ReentrancyGuardReentrantCall (or wrapped revert)
        evilTab.claim(tabId, 1);
    }

    // =========================================================================
    // 7b. Reentrancy on closeTab – attacker tries to reenter closeTab() via transfer
    // =========================================================================
    function test_ReentrancyOnCloseTab() public {
        ReentrancyAttacker evil = new ReentrancyAttacker();
        AgentTab evilTab = new AgentTab(address(evil));

        evil.mint(client, 100e6);
        vm.prank(client);
        evil.approve(address(evilTab), type(uint256).max);

        vm.prank(provider);
        uint256 serviceId = evilTab.registerService("EvilService2", PRICE_PER_CALL);

        // Open tab without reentrancy armed.
        evil.setTarget(AgentTab(address(0)), 0, serviceId, 1);
        vm.prank(client);
        uint256 tabId = evilTab.openTab(serviceId, TAB_AMOUNT);

        // Arm: on transfer from closeTab, reenter closeTab.
        evil.setTarget(evilTab, tabId, serviceId, 1);

        vm.prank(client);
        vm.expectRevert(); // ReentrancyGuardReentrantCall
        evilTab.closeTab(tabId);
    }

    // =========================================================================
    // 8. Zero-price service: claim amount == 0, no USDC transferred
    // =========================================================================
    function test_ZeroPriceService() public {
        uint256 serviceId = _registerService(0); // pricePerCall = 0
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        uint256 contractBalBefore = usdc.balanceOf(address(tab));
        uint256 providerBalBefore = usdc.balanceOf(provider);

        // Expect Claimed event with claimAmount == 0 and unchanged remainingBalance.
        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTab.Claimed(tabId, provider, 5, 0, TAB_AMOUNT);

        vm.prank(provider);
        tab.claim(tabId, 5);

        // No USDC left the contract.
        assertEq(usdc.balanceOf(address(tab)), contractBalBefore, "contract balance unchanged");
        // Provider received nothing.
        assertEq(usdc.balanceOf(provider), providerBalBefore, "provider balance unchanged");
        // Tab balance unchanged.
        (, , uint256 bal, ) = tab.tabs(tabId);
        assertEq(bal, TAB_AMOUNT, "tab balance unchanged");
    }

    // =========================================================================
    // Bonus: constructor reverts on wrong decimals
    // =========================================================================
    function test_ConstructorRevertsWrongDecimals() public {
        MockERC20 badToken = new MockERC20("Bad", "BAD", 18); // 18 decimals
        vm.expectRevert(AgentTab.WrongTokenDecimals.selector);
        new AgentTab(address(badToken));
    }

    // =========================================================================
    // Bonus: constructor reverts on zero address
    // =========================================================================
    function test_ConstructorRevertsZeroAddress() public {
        vm.expectRevert(AgentTab.ZeroAddress.selector);
        new AgentTab(address(0));
    }

    // =========================================================================
    // Bonus: registerService reverts on empty name
    // =========================================================================
    function test_RegisterServiceRevertsEmptyName() public {
        vm.prank(provider);
        vm.expectRevert(AgentTab.EmptyName.selector);
        tab.registerService("", 1e6);
    }

    // =========================================================================
    // Bonus: openTab reverts on unknown serviceId
    // =========================================================================
    function test_OpenTabRevertsServiceNotFound() public {
        vm.prank(client);
        vm.expectRevert(AgentTab.ServiceNotFound.selector);
        tab.openTab(999, TAB_AMOUNT);
    }

    // =========================================================================
    // Bonus: openTab reverts on zero amount
    // =========================================================================
    function test_OpenTabRevertsZeroAmount() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        vm.prank(client);
        vm.expectRevert(AgentTab.ZeroAmount.selector);
        tab.openTab(serviceId, 0);
    }

    // =========================================================================
    // Bonus: non-client cannot close a tab
    // =========================================================================
    function test_NonClientCloseRevertsNotTabClient() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotTabClient.selector);
        tab.closeTab(tabId);
    }

    // =========================================================================
    // Bonus: non-client cannot topUp a tab
    // =========================================================================
    function test_NonClientTopUpRevertsNotTabClient() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT);

        usdc.mint(stranger, 10e6);
        vm.prank(stranger);
        usdc.approve(address(tab), type(uint256).max);

        vm.prank(stranger);
        vm.expectRevert(AgentTab.NotTabClient.selector);
        tab.topUp(tabId, 1e6);
    }

    // =========================================================================
    // Bonus: fuzz on claim – claimable calls should never exceed balance
    // =========================================================================
    function testFuzz_ClaimWithinBalance(uint256 calls) public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);
        uint256 tabId     = _openTab(serviceId, TAB_AMOUNT); // 10 USDC → 10 calls max

        // Constrain: 1 to 10 calls (inclusive) to stay within balance.
        calls = bound(calls, 1, 10);

        uint256 expectedClaim   = calls * PRICE_PER_CALL;
        uint256 expectedRemain  = TAB_AMOUNT - expectedClaim;

        vm.prank(provider);
        tab.claim(tabId, calls);

        (, , uint256 bal, ) = tab.tabs(tabId);
        assertEq(bal, expectedRemain, "remaining balance after fuzz claim");
    }

    // =========================================================================
    // Bonus: ServiceRegistered event emitted on registerService
    // =========================================================================
    function test_ServiceRegisteredEvent() public {
        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTab.ServiceRegistered(0, provider, "MySvc", PRICE_PER_CALL);

        vm.prank(provider);
        tab.registerService("MySvc", PRICE_PER_CALL);
    }

    // =========================================================================
    // Bonus: TabOpened event emitted on openTab
    // =========================================================================
    function test_TabOpenedEvent() public {
        uint256 serviceId = _registerService(PRICE_PER_CALL);

        vm.expectEmit(true, true, true, true, address(tab));
        emit AgentTab.TabOpened(0, client, serviceId, TAB_AMOUNT);

        vm.prank(client);
        tab.openTab(serviceId, TAB_AMOUNT);
    }
}
