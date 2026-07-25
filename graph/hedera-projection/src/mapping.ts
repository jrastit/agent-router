import { HederaEventAnchored } from "../generated/HederaEventAnchor/HederaEventAnchor";
import { HederaEventAnchor } from "../generated/schema";

export function handleHederaEventAnchored(event: HederaEventAnchored): void {
  const entity = new HederaEventAnchor(event.params.sourceEventId);
  entity.sourceType = event.params.sourceType;
  entity.sourceId = event.params.sourceId;
  entity.hederaTransactionHash = event.params.transactionHash;
  entity.consensusTimestamp = event.params.consensusTimestamp;
  entity.sourceIndex = event.params.sourceIndex;
  entity.eventKind = event.params.eventKind;
  entity.payloadDigest = event.params.payloadDigest;
  entity.schemaVersion = event.params.schemaVersion;
  entity.relayer = event.params.relayer;
  entity.destinationContract = event.address;
  entity.destinationTransactionHash = event.transaction.hash;
  entity.destinationBlockNumber = event.block.number;
  entity.destinationBlockTimestamp = event.block.timestamp;
  entity.destinationLogIndex = event.logIndex;
  entity.save();
}
