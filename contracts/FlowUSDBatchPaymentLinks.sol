// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFlowUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Separate Arc Testnet registry. Old FlowUSD links stay on their original contract.
/// @dev Batch registration is atomic: either all links are registered, or none are.
contract FlowUSDBatchPaymentLinks {
    address public immutable usdc;
    uint256 public constant MAX_BATCH = 100;
    struct PaymentLink {
        address creator;
        uint256 amount;
        bool paid;
        address payer;
        uint256 paidAt;
    }
    mapping(bytes32 => PaymentLink) public links;
    event LinkCreated(bytes32 indexed linkId, address indexed creator, uint256 amount);
    event LinkPaid(bytes32 indexed linkId, address indexed payer, uint256 amount);

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = _usdc;
    }

    function batchCreateLinks(bytes32[] calldata ids, uint256[] calldata amounts) external {
        uint256 n = ids.length;
        require(n > 0 && n <= MAX_BATCH, "Invalid batch size");
        require(n == amounts.length, "Array length mismatch");
        for (uint256 i = 0; i < n; i++) {
            bytes32 id = ids[i];
            require(id != bytes32(0), "Empty link ID");
            require(amounts[i] > 0, "Amount must be positive");
            require(links[id].creator == address(0), "Duplicate link ID");
            links[id] = PaymentLink(msg.sender, amounts[i], false, address(0), 0);
            emit LinkCreated(id, msg.sender, amounts[i]);
        }
    }

    function pay(bytes32 linkId, uint256 amount) external {
        PaymentLink storage link = links[linkId];
        require(link.creator != address(0), "Link not found");
        require(!link.paid, "Already paid");
        uint256 payAmount = link.amount > 0 ? link.amount : amount;
        require(payAmount > 0, "Amount must be > 0");
        // State changes before token external call, rolled back if token call fails.
        link.paid = true;
        link.payer = msg.sender;
        link.paidAt = block.timestamp;
        require(IFlowUSDC(usdc).transferFrom(msg.sender, link.creator, payAmount), "USDC transfer failed");
        emit LinkPaid(linkId, msg.sender, payAmount);
    }

    function getLink(bytes32 linkId) external view returns (
        address creator, uint256 amount, bool paid, address payer, uint256 paidAt
    ) {
        PaymentLink storage link = links[linkId];
        return (link.creator, link.amount, link.paid, link.payer, link.paidAt);
    }
}
