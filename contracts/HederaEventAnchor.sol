// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Relayer-mediated public anchors for Mirror-verified Hedera events.
/// @notice Monitoring evidence only. This contract does not verify Hedera
/// consensus and MUST NOT be used to create application credit.
contract HederaEventAnchor {
    uint8 public constant CONTRACT_LOG = 1;
    uint8 public constant HCS_MESSAGE = 2;

    address public immutable relayer;
    mapping(bytes32 sourceEventId => bool anchored) public anchored;

    event HederaEventAnchored(
        bytes32 indexed sourceEventId,
        uint8 indexed sourceType,
        string sourceId,
        bytes32 transactionHash,
        string consensusTimestamp,
        uint64 sourceIndex,
        string eventKind,
        bytes32 payloadDigest,
        uint16 schemaVersion,
        address indexed relayer
    );

    error UnauthorizedRelayer();
    error InvalidAnchor();
    error SourceEventAlreadyAnchored();

    constructor(address initialRelayer) {
        if (initialRelayer == address(0)) revert InvalidAnchor();
        relayer = initialRelayer;
    }

    function anchorHederaEvent(
        bytes32 sourceEventId,
        uint8 sourceType,
        string calldata sourceId,
        bytes32 transactionHash,
        string calldata consensusTimestamp,
        uint64 sourceIndex,
        string calldata eventKind,
        bytes32 payloadDigest,
        uint16 schemaVersion
    ) external {
        if (msg.sender != relayer) revert UnauthorizedRelayer();
        if (
            sourceEventId == bytes32(0) ||
            (sourceType != CONTRACT_LOG && sourceType != HCS_MESSAGE) ||
            bytes(sourceId).length == 0 ||
            bytes(sourceId).length > 64 ||
            transactionHash == bytes32(0) ||
            bytes(consensusTimestamp).length == 0 ||
            bytes(consensusTimestamp).length > 32 ||
            bytes(eventKind).length == 0 ||
            bytes(eventKind).length > 64 ||
            payloadDigest == bytes32(0) ||
            schemaVersion == 0
        ) revert InvalidAnchor();
        if (anchored[sourceEventId]) revert SourceEventAlreadyAnchored();

        anchored[sourceEventId] = true;
        emit HederaEventAnchored(
            sourceEventId,
            sourceType,
            sourceId,
            transactionHash,
            consensusTimestamp,
            sourceIndex,
            eventKind,
            payloadDigest,
            schemaVersion,
            msg.sender
        );
    }
}
