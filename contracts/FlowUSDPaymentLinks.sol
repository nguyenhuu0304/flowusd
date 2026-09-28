// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface for the parts of ERC-20 this contract needs.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title FlowUSD Payment Links Registry
/// @notice Records payment requests on-chain and settles them by moving
///         USDC directly from payer to creator via transferFrom. The
///         contract never custodies funds itself — it only acts as a
///         public, tamper-proof ledger of "who asked whom to pay how much,
///         and was it paid".
contract FlowUSDPaymentLinks {
    address public immutable usdc;

    struct PaymentLink {
        address creator;
        uint256 amount; // 0 = payer decides the amount when paying
        bool paid;
        address payer;
        uint256 paidAt;
    }

    mapping(bytes32 => PaymentLink) public links;

    event LinkCreated(bytes32 indexed linkId, address indexed creator, uint256 amount);
    event LinkPaid(bytes32 indexed linkId, address indexed payer, uint256 amount);

    constructor(address _usdc) {
        usdc = _usdc;
    }

    /// @notice Register a new payment request.
    /// @param linkId Unique id for the link (e.g. keccak256 of the app's link id).
    /// @param amount Fixed amount required in USDC's smallest unit, or 0 to let the payer choose.
    function createLink(bytes32 linkId, uint256 amount) external {
        require(links[linkId].creator == address(0), "Link already exists");

        links[linkId] = PaymentLink({
            creator: msg.sender,
            amount: amount,
            paid: false,
            payer: address(0),
            paidAt: 0
        });

        emit LinkCreated(linkId, msg.sender, amount);
    }

    /// @notice Pay an existing, unpaid link. Requires the payer to have
    ///         already called `approve` on the USDC contract for at least
    ///         the amount being sent.
    function pay(bytes32 linkId, uint256 amount) external {
        PaymentLink storage link = links[linkId];

        require(link.creator != address(0), "Link not found");
        require(!link.paid, "Already paid");

        uint256 payAmount = link.amount > 0 ? link.amount : amount;
        require(payAmount > 0, "Amount must be > 0");

        bool ok = IERC20(usdc).transferFrom(msg.sender, link.creator, payAmount);
        require(ok, "USDC transfer failed");

        link.paid = true;
        link.payer = msg.sender;
        link.paidAt = block.timestamp;

        emit LinkPaid(linkId, msg.sender, payAmount);
    }

    /// @notice Read back a link's on-chain state.
    function getLink(bytes32 linkId)
        external
        view
        returns (address creator, uint256 amount, bool paid, address payer, uint256 paidAt)
    {
        PaymentLink storage link = links[linkId];
        return (link.creator, link.amount, link.paid, link.payer, link.paidAt);
    }
}
