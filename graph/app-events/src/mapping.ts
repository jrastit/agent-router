import { AppEventRecorded } from "../generated/HederaAppEventJournal/HederaAppEventJournal";
import { AppEvent } from "../generated/schema";

export function handleAppEventRecorded(event: AppEventRecorded): void {
  const entity = new AppEvent(event.params.eventId);
  entity.kind = event.params.kind;
  entity.subject = event.params.subject;
  entity.payloadDigest = event.params.payloadDigest;
  entity.version = event.params.version;
  entity.publisher = event.transaction.from;
  entity.contractAddress = event.address;
  entity.transactionHash = event.transaction.hash;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.logIndex = event.logIndex;
  entity.save();
}
