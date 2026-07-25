// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Public monitoring journal for AgentRouter application events.
/// @notice This contract stores event references, not payment truth or private data.
contract HederaAppEventJournal {
    address public immutable publisher;
    mapping(bytes32 eventId => bool recorded) public recorded;

    event AppEventRecorded(
        bytes32 indexed eventId,
        bytes32 indexed subject,
        string kind,
        bytes32 payloadDigest,
        uint16 version
    );

    error UnauthorizedPublisher();
    error InvalidAppEvent();
    error AppEventAlreadyRecorded();

    constructor(address initialPublisher) {
        if (initialPublisher == address(0)) revert InvalidAppEvent();
        publisher = initialPublisher;
    }

    function recordAppEvent(
        bytes32 eventId,
        bytes32 subject,
        string calldata kind,
        bytes32 payloadDigest,
        uint16 version
    ) external {
        if (msg.sender != publisher) revert UnauthorizedPublisher();
        if (
            eventId == bytes32(0) ||
            subject == bytes32(0) ||
            payloadDigest == bytes32(0) ||
            version == 0 ||
            bytes(kind).length == 0 ||
            bytes(kind).length > 64
        ) revert InvalidAppEvent();
        if (recorded[eventId]) revert AppEventAlreadyRecorded();

        recorded[eventId] = true;
        emit AppEventRecorded(
            eventId,
            subject,
            kind,
            payloadDigest,
            version
        );
    }
}
