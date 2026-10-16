// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentTabV2} from "../AgentTabV2.sol";
import {MockERC20V2} from "../test-helpers/MockERC20V2.sol";
import {ERC1271Mock} from "../test-helpers/ERC1271Mock.sol";
import {ReentrantERC20V2} from "../test-helpers/ReentrantERC20V2.sol";

// ─────────────────────────────────────────────────────────────────────────────
// AgentTabV2Test
// ─────────────────────────────────────────────────────────────────────────────
contract AgentTabV2Test is Test {

    // ── accounts ─────────────────────────────────────────────────────────────
    address internal provider = makeAddr("provider");

    // client is an EOA with a known private key so we can sign receipts
    uint256 internal clientKey = 0xC1;
    address internal client;

    uint256 internal strangerKey = 0x57;
    address internal stranger;

    // ── contract under test ───────────────────────────────────────────────────
    AgentTabV2 internal tab;
    MockERC20V2 internal usdc;

    // ── constants ─────────────────────────────────────────────────────────────
    uint256 internal constant CLOSE_DELAY   = 1 days;
    uint256 internal constant PRICE_PER_CALL = 1e6;   // 1 USDC per call
    uint256 internal constant INITIAL_DEPOSIT = 10e6; // 10 USDC

    // ── per-test state ────────────────────────────────────────────────────────
    uint256 internal serviceId;
    uint256 internal tabId;

    // ─────────────────────────────────────────────────────────────────────────
    function setUp() public {
        client   = vm.addr(clientKey);
        stranger = vm.addr(strangerKey);

        // Deploy USDC mock (6 decimals)
        usdc = new MockERC20V2("Mock USDC", "mUSDC", 6);

        // Deploy contract under test
        tab = new AgentTabV2(address(usdc), CLOSE_DELAY);

        // Register a service (provider)
        vm.prank(provider);
        serviceId = tab.registerService("TestService", PRICE_PER_CALL);

        // Mint USDC to client and open a tab
        usdc.mint(client, INITIAL_DEPOSIT);
        vm.prank(client);
        usdc.approve(address(tab), INITIAL_DEPOSIT);
        vm.prank(client);
        tabId = tab.openTab(serviceId, INITIAL_DEPOSIT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Reconstruct the EIP-712 domain separator from eip712Domain() fields.
    function _domainSeparator(AgentTabV2 tabContract) internal view returns (bytes32) {
        (
            ,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            ,

        ) = tabContract.eip712Domain();

        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }

    /// @dev Build an EIP-712 receipt digest and sign it with `key`.
    function _signReceipt(uint256 key, uint256 tid, uint256 calls)
        internal
        view
        returns (bytes memory sig)
    {
        bytes32 domainSep  = _domainSeparator(tab);
        bytes32 structHash = keccak256(abi.encode(tab.RECEIPT_TYPEHASH(), tid, calls));
        bytes32 digest     = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        sig = abi.encodePacked(r, s, v);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Valid receipt pays correct amount
    // ─────────────────────────────────────────────────────────────────────────
    function test_ValidReceiptPaysCorrectAmount() public {
        bytes memory sig = _signReceipt(clientKey, tabId, 5);

        uint256 providerBalBefore = usdc.balanceOf(provider);

        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTabV2.Claimed(tabId, provider, 5, 5 * PRICE_PER_CALL, INITIAL_DEPOSIT - 5 * PRICE_PER_CALL);

        vm.prank(provider);
        tab.claim(tabId, 5, sig);

        // USDC transferred to provider
        assertEq(usdc.balanceOf(provider), providerBalBefore + 5 * PRICE_PER_CALL, "provider balance");

        // callsClaimed updated
        (, , , , uint256 callsClaimed, ,) = tab.tabs(tabId);
        assertEq(callsClaimed, 5, "callsClaimed");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Receipt signed by wrong person is rejected
    // ─────────────────────────────────────────────────────────────────────────
    function test_WrongSignerRevertsInvalidSignature() public {
        // stranger signs instead of client
        bytes memory sig = _signReceipt(strangerKey, tabId, 5);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.InvalidSignature.selector, tabId, 5)
        );
        tab.claim(tabId, 5, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Replaying the same receipt reverts TotalCallsNotIncreased
    // ─────────────────────────────────────────────────────────────────────────
    function test_ReplayReceiptReverts() public {
        bytes memory sig = _signReceipt(clientKey, tabId, 5);

        // First claim succeeds
        vm.prank(provider);
        tab.claim(tabId, 5, sig);

        // Replay the same receipt — should revert
        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.TotalCallsNotIncreased.selector, tabId, 5, 5)
        );
        tab.claim(tabId, 5, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Older receipt after newer one reverts TotalCallsNotIncreased
    // ─────────────────────────────────────────────────────────────────────────
    function test_OlderReceiptAfterNewerReverts() public {
        bytes memory sig10 = _signReceipt(clientKey, tabId, 10);
        bytes memory sig5  = _signReceipt(clientKey, tabId, 5);

        // Claim with totalCalls=10 first
        vm.prank(provider);
        tab.claim(tabId, 10, sig10);

        // Try to claim with totalCalls=5 (lower) — should revert
        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.TotalCallsNotIncreased.selector, tabId, 5, 10)
        );
        tab.claim(tabId, 5, sig5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Receipt for tab A cannot be used on tab B
    // ─────────────────────────────────────────────────────────────────────────
    function test_CrossTabReceiptReverts() public {
        // Open a second tab (tabB)
        address client2 = makeAddr("client2");
        usdc.mint(client2, INITIAL_DEPOSIT);
        vm.prank(client2);
        usdc.approve(address(tab), INITIAL_DEPOSIT);
        vm.prank(client2);
        uint256 tabIdB = tab.openTab(serviceId, INITIAL_DEPOSIT);

        // Sign for tabId (A), not tabIdB
        bytes memory sig = _signReceipt(clientKey, tabId, 5);

        // Try to use the tab-A receipt on tab B — wrong digest, wrong signer
        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.InvalidSignature.selector, tabIdB, 5)
        );
        tab.claim(tabIdB, 5, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Claiming more than balance reverts InsufficientTabBalance
    //    (tab=5 USDC, pricePerCall=2, totalCalls=3  → claimAmount=6 > 5)
    // ─────────────────────────────────────────────────────────────────────────
    function test_ClaimExceedsBalanceReverts() public {
        uint256 price = 2e6; // 2 USDC per call

        // Register a service at price=2
        vm.prank(provider);
        uint256 svcId2 = tab.registerService("PriceyService", price);

        // Open a tab with 5 USDC using a known private key
        uint256 deposit  = 5e6;
        uint256 richPriv = 0xBEEF;
        address richEOA  = vm.addr(richPriv);
        usdc.mint(richEOA, deposit);
        vm.prank(richEOA);
        usdc.approve(address(tab), deposit);
        vm.prank(richEOA);
        uint256 tid3 = tab.openTab(svcId2, deposit);

        bytes memory sig = _signReceipt(richPriv, tid3, 3);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.InsufficientTabBalance.selector, tid3, 6e6, 5e6)
        );
        tab.claim(tid3, 3, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Provider can claim during close period
    // ─────────────────────────────────────────────────────────────────────────
    function test_ProviderClaimsDuringClosePeriod() public {
        // Client requests close
        vm.prank(client);
        tab.requestClose(tabId);

        // Provider claims (before delay expires) — should succeed
        bytes memory sig = _signReceipt(clientKey, tabId, 3);
        vm.prank(provider);
        tab.claim(tabId, 3, sig);

        (, , , , uint256 callsClaimed, ,) = tab.tabs(tabId);
        assertEq(callsClaimed, 3, "callsClaimed after claim during close");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Client cannot finalize before the delay
    // ─────────────────────────────────────────────────────────────────────────
    function test_FinalizeBeforeDelayReverts() public {
        vm.prank(client);
        tab.requestClose(tabId);

        uint256 closeAfter = block.timestamp + CLOSE_DELAY;

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTabV2.CloseDelayNotExpired.selector,
                tabId,
                closeAfter,
                block.timestamp
            )
        );
        tab.finalizeClose(tabId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Finalize after delay refunds correct amount
    // ─────────────────────────────────────────────────────────────────────────
    function test_FinalizeAfterDelayRefundsCorrectAmount() public {
        // Provider claims 3 calls → 3 USDC leaves the tab
        bytes memory sig = _signReceipt(clientKey, tabId, 3);
        vm.prank(provider);
        tab.claim(tabId, 3, sig);

        uint256 remaining = INITIAL_DEPOSIT - 3 * PRICE_PER_CALL; // 7 USDC

        // Client requests close
        vm.prank(client);
        tab.requestClose(tabId);

        // Warp past the close delay
        vm.warp(block.timestamp + CLOSE_DELAY + 1);

        uint256 clientBalBefore = usdc.balanceOf(client);

        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTabV2.TabClosed(tabId, client, remaining);

        vm.prank(client);
        tab.finalizeClose(tabId);

        // Client receives the remaining balance
        assertEq(usdc.balanceOf(client), clientBalBefore + remaining, "refund amount");

        // Tab marked closed
        (, , , uint256 balance, , bool closed,) = tab.tabs(tabId);
        assertTrue(closed,          "tab.closed");
        assertEq(balance, 0,        "tab.balance after close");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Top-up during close period reverts
    // ─────────────────────────────────────────────────────────────────────────
    function test_TopUpDuringClosePeriodReverts() public {
        vm.prank(client);
        tab.requestClose(tabId);

        usdc.mint(client, 1e6);
        vm.prank(client);
        usdc.approve(address(tab), 1e6);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.TopUpDuringClosePeriod.selector, tabId)
        );
        tab.topUp(tabId, 1e6);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. closeByProvider refunds client
    // ─────────────────────────────────────────────────────────────────────────
    function test_CloseByProviderRefundsClient() public {
        uint256 clientBalBefore = usdc.balanceOf(client);

        vm.expectEmit(true, true, false, true, address(tab));
        emit AgentTabV2.TabClosed(tabId, client, INITIAL_DEPOSIT);

        vm.prank(provider);
        tab.closeByProvider(tabId);

        // Client (refundRecipient) receives the full balance back
        assertEq(usdc.balanceOf(client), clientBalBefore + INITIAL_DEPOSIT, "client refund");

        // Tab marked closed
        (, , , uint256 balance, , bool closed,) = tab.tabs(tabId);
        assertTrue(closed,    "tab.closed");
        assertEq(balance, 0,  "tab.balance");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. ERC-1271 smart-contract wallet signature
    // ─────────────────────────────────────────────────────────────────────────
    function test_ERC1271SmartWalletClaim() public {
        // Deploy the ERC-1271 mock wallet
        ERC1271Mock wallet = new ERC1271Mock();

        // Fund wallet with USDC and open a tab via the wallet
        usdc.mint(address(wallet), INITIAL_DEPOSIT);
        wallet.approveToken(address(usdc), address(tab), INITIAL_DEPOSIT);

        // wallet calls openTab (msg.sender == wallet)
        vm.prank(address(wallet));
        uint256 walletTabId = tab.openTab(serviceId, INITIAL_DEPOSIT);

        // Use an all-zero signature — the mock approves ANY signature
        bytes memory anySig = new bytes(65);

        uint256 providerBalBefore = usdc.balanceOf(provider);

        vm.prank(provider);
        tab.claim(walletTabId, 5, anySig);

        assertEq(
            usdc.balanceOf(provider),
            providerBalBefore + 5 * PRICE_PER_CALL,
            "provider received from ERC-1271 tab"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Reentrancy on claim
    // ─────────────────────────────────────────────────────────────────────────
    function test_ReentrancyOnClaim() public {
        // Set up a new instance of the contract backed by a reentrant token
        ReentrantERC20V2 evil = new ReentrantERC20V2();
        AgentTabV2 evilTab = new AgentTabV2(address(evil), CLOSE_DELAY);

        // Register service and open tab
        vm.prank(provider);
        uint256 eSvcId = evilTab.registerService("EvilSvc", PRICE_PER_CALL);

        uint256 eClientKey = 0xECABED;
        address eClient    = vm.addr(eClientKey);

        evil.mint(eClient, INITIAL_DEPOSIT);
        vm.prank(eClient);
        evil.approve(address(evilTab), INITIAL_DEPOSIT);
        vm.prank(eClient);
        uint256 eTabId = evilTab.openTab(eSvcId, INITIAL_DEPOSIT);

        // Build a valid receipt signature
        bytes32 domainSep  = _domainSeparator(evilTab);
        bytes32 structHash = keccak256(abi.encode(evilTab.RECEIPT_TYPEHASH(), eTabId, uint256(1)));
        bytes32 digest     = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(eClientKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        // Wire reentrancy: on the outbound transfer (provider payout), call claim again
        evil.setTarget(evilTab, eTabId, 1, sig, 0);

        // The reentrant second entry must be blocked by nonReentrant
        vm.prank(provider);
        vm.expectRevert();
        evilTab.claim(eTabId, 1, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Reentrancy on finalizeClose
    // ─────────────────────────────────────────────────────────────────────────
    function test_ReentrancyOnFinalizeClose() public {
        // Set up a new instance backed by a reentrant token
        ReentrantERC20V2 evil = new ReentrantERC20V2();
        AgentTabV2 evilTab = new AgentTabV2(address(evil), CLOSE_DELAY);

        vm.prank(provider);
        uint256 eSvcId = evilTab.registerService("EvilSvc2", PRICE_PER_CALL);

        uint256 eClientKey = 0xDEAD;
        address eClient    = vm.addr(eClientKey);

        evil.mint(eClient, INITIAL_DEPOSIT);
        vm.prank(eClient);
        evil.approve(address(evilTab), INITIAL_DEPOSIT);
        vm.prank(eClient);
        uint256 eTabId = evilTab.openTab(eSvcId, INITIAL_DEPOSIT);

        // Request close and warp past delay
        vm.prank(eClient);
        evilTab.requestClose(eTabId);
        vm.warp(block.timestamp + CLOSE_DELAY + 1);

        // Wire reentrancy: on the outbound transfer (refund), call finalizeClose again
        evil.setTarget(evilTab, eTabId, 0, new bytes(0), 1);

        // The reentrant second entry must be blocked by nonReentrant
        vm.prank(eClient);
        vm.expectRevert();
        evilTab.finalizeClose(eTabId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz: provider always receives exactly (newTotal - prevClaimed) * price
    // ─────────────────────────────────────────────────────────────────────────
    function testFuzz_ClaimAmountMatchesDelta(uint8 firstCalls, uint8 secondCalls) public {
        firstCalls  = uint8(bound(firstCalls,  1, 5));
        secondCalls = uint8(bound(secondCalls, firstCalls + 1, 10));

        bytes memory sig1 = _signReceipt(clientKey, tabId, firstCalls);
        bytes memory sig2 = _signReceipt(clientKey, tabId, secondCalls);

        uint256 bal0 = usdc.balanceOf(provider);
        vm.prank(provider);
        tab.claim(tabId, firstCalls, sig1);
        uint256 bal1 = usdc.balanceOf(provider);
        assertEq(bal1 - bal0, uint256(firstCalls) * PRICE_PER_CALL, "first claim delta");

        vm.prank(provider);
        tab.claim(tabId, secondCalls, sig2);
        uint256 bal2 = usdc.balanceOf(provider);
        assertEq(
            bal2 - bal1,
            uint256(secondCalls - firstCalls) * PRICE_PER_CALL,
            "second claim delta"
        );
    }

    // ── constructor: closeDelay < 300 reverts ─────────────────────────────────

    function test_CloseDelayTooShort_reverts() public {
        // Any value below 300 must revert with CloseDelayTooShort
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.CloseDelayTooShort.selector, 299, 300)
        );
        new AgentTabV2(address(usdc), 299);
    }

    function test_CloseDelayTooShort_zeroReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(AgentTabV2.CloseDelayTooShort.selector, 0, 300)
        );
        new AgentTabV2(address(usdc), 0);
    }

    function test_CloseDelayExactMinimum_succeeds() public {
        // Exactly 300 must not revert
        AgentTabV2 newTab = new AgentTabV2(address(usdc), 300);
        assertEq(newTab.CLOSE_DELAY(), 300);
    }
}
