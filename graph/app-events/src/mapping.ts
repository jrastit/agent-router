import {
  AppEventRecorded,
  EconomicEventRecorded,
} from "../generated/HederaAppEventJournal/HederaAppEventJournal";
import { AppEvent, EconomicEvent } from "../generated/schema";

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

export function handleEconomicEventRecorded(
  event: EconomicEventRecorded,
): void {
  const entity = new EconomicEvent(event.params.eventId);
  entity.subject = event.params.subject;
  entity.eventType = event.params.eventType;
  entity.amountTinybars = event.params.amountTinybars;
  entity.referenceId = event.params.referenceId;
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
