// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev USDC issuer controls centralized blocklist logic and may freeze this contract address,
/// which would lock all in-flight tab balances held here.
contract AgentTab is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Service {
        address provider;
        string name;
        uint256 pricePerCall; // in USDC (6-decimal unit)
    }

    struct Tab {
        address client;
        uint256 serviceId;
        uint256 balance; // remaining USDC in the tab
        bool closed;
    }

    IERC20 public immutable usdc;
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
        uint256 numberOfCalls,
        uint256 claimAmount,
        uint256 remainingBalance
    );
    event TabClosed(uint256 indexed tabId, address indexed client, uint256 refund);

    error ServiceNotFound();
    error TabNotFound();
    error TabAlreadyClosed();
    error NotTabClient();
    error NotServiceProvider();
    error ZeroAmount();
    error EmptyName();
    error InsufficientTabBalance();
    error ZeroAddress();
    error WrongTokenDecimals();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        require(usdcAddress.code.length > 0, "not a contract");
        if (IERC20Metadata(usdcAddress).decimals() != 6) revert WrongTokenDecimals();
        usdc = IERC20(usdcAddress);
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

        tabId = tabCount;
        tabs[tabId] = Tab({client: msg.sender, serviceId: serviceId, balance: 0, closed: false});
        tabCount = tabId + 1;

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount = usdc.balanceOf(address(this)) - balanceBefore;

        tabs[tabId].balance = receivedAmount;

        emit TabOpened(tabId, msg.sender, serviceId, receivedAmount);
    }

    function topUp(uint256 tabId, uint256 amount) external {
        if (tabId >= tabCount) revert TabNotFound();
        if (amount == 0) revert ZeroAmount();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();
        if (msg.sender != tab.client) revert NotTabClient();

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 receivedAmount = usdc.balanceOf(address(this)) - balanceBefore;

        tab.balance += receivedAmount;

        emit TabToppedUp(tabId, msg.sender, receivedAmount, tab.balance);
    }

    function claim(uint256 tabId, uint256 numberOfCalls) external nonReentrant {
        if (tabId >= tabCount) revert TabNotFound();
        if (numberOfCalls == 0) revert ZeroAmount();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();

        Service storage service = services[tab.serviceId];
        if (msg.sender != service.provider) revert NotServiceProvider();

        uint256 claimAmount = numberOfCalls * service.pricePerCall;
        if (claimAmount > tab.balance) revert InsufficientTabBalance();

        tab.balance -= claimAmount;

        if (claimAmount != 0) {
            usdc.safeTransfer(msg.sender, claimAmount);
        }

        emit Claimed(tabId, msg.sender, numberOfCalls, claimAmount, tab.balance);
    }

    function closeTab(uint256 tabId) external nonReentrant {
        if (tabId >= tabCount) revert TabNotFound();

        Tab storage tab = tabs[tabId];
        if (tab.closed) revert TabAlreadyClosed();
        if (msg.sender != tab.client) revert NotTabClient();

        uint256 refund = tab.balance;
        tab.closed = true;
        tab.balance = 0;

        if (refund != 0) {
            usdc.safeTransfer(msg.sender, refund);
        }

        emit TabClosed(tabId, msg.sender, refund);
    }
}
