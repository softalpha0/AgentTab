// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @dev USDC issuer may blocklist this contract address, freezing all tab balances.
/// Use setRefundRecipient before closing a tab if the client address may be blocklisted.
contract AgentTabV2 is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RECEIPT_TYPEHASH = keccak256("Receipt(uint256 tabId,uint256 totalCalls)");

    struct Service {
        address provider;
        string name;
        uint256 pricePerCall;
    }

    struct Tab {
        address client;
        address refundRecipient;
        uint256 serviceId;
        uint256 balance;
        uint256 callsClaimed;
        bool closed;
        uint256 closeRequestedAt;
    }

    IERC20 public immutable usdc;
    uint256 public immutable CLOSE_DELAY;
    uint256 public serviceCount;
    uint256 public tabCount;
    mapping(uint256 => Service) public services;
    mapping(uint256 => Tab) public tabs;

    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, string name, uint256 pricePerCall);
    event TabOpened(uint256 indexed tabId, address indexed client, uint256 indexed serviceId, uint256 amount);
    event TabToppedUp(uint256 indexed tabId, address indexed client, uint256 amount, uint256 newBalance);
    event Claimed(
        uint256 indexed tabId,
        address indexed provider,
        uint256 totalCalls,
        uint256 claimAmount,
        uint256 remainingBalance
    );
    event CloseRequested(uint256 indexed tabId, address indexed client, uint256 closeAfter);
    event TabClosed(uint256 indexed tabId, address indexed client, uint256 refund);
    event RefundRecipientChanged(uint256 indexed tabId, address indexed newRecipient);

    error ServiceNotFound();
    error TabNotFound();
    error TabAlreadyClosed();
    error NotTabClient(uint256 tabId, address caller);
    error NotServiceProvider(uint256 tabId, address caller);
    error ZeroAmount();
    error EmptyName();
    error InsufficientTabBalance(uint256 tabId, uint256 required, uint256 available);
    error ZeroAddress();
    error WrongTokenDecimals();
    error NotAContract();
    error InvalidSignature(uint256 tabId, uint256 totalCalls);
    error TotalCallsNotIncreased(uint256 tabId, uint256 totalCalls, uint256 callsClaimed);
    error CloseNotRequested(uint256 tabId);
    error CloseDelayNotExpired(uint256 tabId, uint256 closeAfter, uint256 now_);
    error CloseAlreadyPending(uint256 tabId);
    error TopUpDuringClosePeriod(uint256 tabId);
    error CloseDelayTooShort(uint256 provided, uint256 minimum);

    constructor(address usdcAddress, uint256 closeDelay) EIP712("AgentTabV2", "1") {
        if (usdcAddress == address(0)) revert ZeroAddress();
        if (usdcAddress.code.length == 0) revert NotAContract();
        if (IERC20Metadata(usdcAddress).decimals() != 6) revert WrongTokenDecimals();
        if (closeDelay < 300) revert CloseDelayTooShort(closeDelay, 300);

        usdc = IERC20(usdcAddress);
        CLOSE_DELAY = closeDelay;
    }

    function _receiptHash(uint256 tabId, uint256 totalCalls) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(RECEIPT_TYPEHASH, tabId, totalCalls)));
    }

    function registerService(string calldata name, uint256 pricePerCall) external returns (uint256 serviceId) {
        if (bytes(name).length == 0) revert EmptyName();

        serviceId = serviceCount;
        services[serviceId] = Service({provider: msg.sender, name: name, pricePerCall: pricePerCall});
        serviceCount = serviceId + 1;

        emit ServiceRegistered(serviceId, msg.sender, name, pricePerCall);
    }

    function openTab(uint256 serviceId, uint256 amount) external returns (uint256 tabId) {
        if (serviceId >= serviceCount) revert ServiceNotFound();
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount = usdc.balanceOf(address(this)) - balanceBefore;

        tabId = tabCount;
        tabs[tabId] = Tab({
            client: msg.sender,
            refundRecipient: msg.sender,
            serviceId: serviceId,
            balance: receivedAmount,
            callsClaimed: 0,
            closed: false,
            closeRequestedAt: 0
        });
        tabCount = tabId + 1;

        emit TabOpened(tabId, msg.sender, serviceId, receivedAmount);
    }

    function topUp(uint256 tabId, uint256 amount) external {
        if (tabId >= tabCount) revert TabNotFound();
        if (amount == 0) revert ZeroAmount();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();
        if (msg.sender != tab.client) revert NotTabClient(tabId, msg.sender);
        if (tab.closeRequestedAt != 0) revert TopUpDuringClosePeriod(tabId);

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount = usdc.balanceOf(address(this)) - balanceBefore;

        tab.balance += receivedAmount;

        emit TabToppedUp(tabId, msg.sender, receivedAmount, tab.balance);
    }

    function claim(uint256 tabId, uint256 totalCalls, bytes calldata signature) external nonReentrant {
        if (tabId >= tabCount) revert TabNotFound();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();

        Service storage service = services[tab.serviceId];
        if (msg.sender != service.provider) revert NotServiceProvider(tabId, msg.sender);

        if (totalCalls == 0) revert ZeroAmount();
        if (totalCalls <= tab.callsClaimed) {
            revert TotalCallsNotIncreased(tabId, totalCalls, tab.callsClaimed);
        }

        bytes32 digest = _receiptHash(tabId, totalCalls);
        if (!SignatureChecker.isValidSignatureNow(tab.client, digest, signature)) {
            revert InvalidSignature(tabId, totalCalls);
        }

        uint256 claimAmount = (totalCalls - tab.callsClaimed) * service.pricePerCall;
        if (claimAmount > tab.balance) {
            revert InsufficientTabBalance(tabId, claimAmount, tab.balance);
        }

        tab.balance -= claimAmount;
        tab.callsClaimed = totalCalls;

        if (claimAmount > 0) {
            usdc.safeTransfer(msg.sender, claimAmount);
        }

        emit Claimed(tabId, msg.sender, totalCalls, claimAmount, tab.balance);
    }

    function requestClose(uint256 tabId) external {
        if (tabId >= tabCount) revert TabNotFound();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();
        if (msg.sender != tab.client) revert NotTabClient(tabId, msg.sender);
        if (tab.closeRequestedAt != 0) revert CloseAlreadyPending(tabId);

        tab.closeRequestedAt = block.timestamp;

        emit CloseRequested(tabId, msg.sender, block.timestamp + CLOSE_DELAY);
    }

    function setRefundRecipient(uint256 tabId, address recipient) external {
        if (tabId >= tabCount) revert TabNotFound();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();
        if (msg.sender != tab.client) revert NotTabClient(tabId, msg.sender);
        if (recipient == address(0)) revert ZeroAddress();

        tab.refundRecipient = recipient;

        emit RefundRecipientChanged(tabId, recipient);
    }

    function finalizeClose(uint256 tabId) external nonReentrant {
        if (tabId >= tabCount) revert TabNotFound();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();
        if (msg.sender != tab.client) revert NotTabClient(tabId, msg.sender);
        if (tab.closeRequestedAt == 0) revert CloseNotRequested(tabId);
        if (block.timestamp < tab.closeRequestedAt + CLOSE_DELAY) {
            revert CloseDelayNotExpired(tabId, tab.closeRequestedAt + CLOSE_DELAY, block.timestamp);
        }

        uint256 refund = tab.balance;
        tab.closed = true;
        tab.balance = 0;

        if (refund > 0) {
            usdc.safeTransfer(tab.refundRecipient, refund);
        }

        emit TabClosed(tabId, tab.client, refund);
    }

    function closeByProvider(uint256 tabId) external nonReentrant {
        if (tabId >= tabCount) revert TabNotFound();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();

        Service storage service = services[tab.serviceId];
        if (msg.sender != service.provider) revert NotServiceProvider(tabId, msg.sender);

        uint256 refund = tab.balance;
        tab.closed = true;
        tab.balance = 0;

        if (refund > 0) {
            usdc.safeTransfer(tab.refundRecipient, refund);
        }

        emit TabClosed(tabId, tab.client, refund);
    }
}
