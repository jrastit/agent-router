// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Public monitoring journal for AgentRouter application events.
/// @notice This contract stores event references, not payment truth or private data.
contract HederaAppEventJournal {
    uint8 public constant DEPOSIT_OBSERVED = 1;
    uint8 public constant BALANCE_CREDITED = 2;
    uint8 public constant BALANCE_DEBITED = 3;
    uint8 public constant CREDIT_RESERVED = 4;
    uint8 public constant EXECUTION_CHARGED = 5;
    uint8 public constant BALANCE_REFUNDED = 6;
    uint8 public constant RECONCILIATION_OPENED = 7;

    address public immutable publisher;
    mapping(bytes32 eventId => bool recorded) public recorded;

    event AppEventRecorded(
        bytes32 indexed eventId,
        bytes32 indexed subject,
        string kind,
        bytes32 payloadDigest,
        uint16 version
    );

    event EconomicEventRecorded(
        bytes32 indexed eventId,
        bytes32 indexed subject,
        uint8 indexed eventType,
        int64 amountTinybars,
        bytes32 referenceId,
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

    function recordEconomicEvent(
        bytes32 eventId,
        bytes32 subject,
        uint8 eventType,
        int64 amountTinybars,
        bytes32 referenceId,
        bytes32 payloadDigest,
        uint16 version
    ) external {
        if (msg.sender != publisher) revert UnauthorizedPublisher();
        if (
            eventId == bytes32(0) ||
            subject == bytes32(0) ||
            eventType < DEPOSIT_OBSERVED ||
            eventType > RECONCILIATION_OPENED ||
            (eventType != RECONCILIATION_OPENED && amountTinybars == 0) ||
            referenceId == bytes32(0) ||
            payloadDigest == bytes32(0) ||
            version == 0
        ) revert InvalidAppEvent();
        if (recorded[eventId]) revert AppEventAlreadyRecorded();

        recorded[eventId] = true;
        emit EconomicEventRecorded(
            eventId,
            subject,
            eventType,
            amountTinybars,
            referenceId,
            payloadDigest,
            version
        );
    }
}
