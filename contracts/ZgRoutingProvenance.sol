// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZgRoutingProvenance {
    mapping(bytes32 receiptHash => uint64 anchoredAt) public anchoredAt;

    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        address indexed anchorer,
        uint64 anchoredAt
    );

    function anchor(bytes32 receiptHash) external {
        require(receiptHash != bytes32(0), "zero receipt hash");
        require(anchoredAt[receiptHash] == 0, "receipt already anchored");

        uint64 timestamp = uint64(block.timestamp);
        anchoredAt[receiptHash] = timestamp;
        emit ReceiptAnchored(receiptHash, msg.sender, timestamp);
    }
}
