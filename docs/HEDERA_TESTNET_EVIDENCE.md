# Hedera testnet evidence

Phase 6 was verified against Hedera Testnet on 25 July 2026. No private key,
database credential, confidential input, or artifact is included here or in
the public HCS payloads.

Phase 5 execution was deliberately skipped. This evidence proves the Phase 6
settlement and audit path; it does not claim a live provider delivery.

## Verified settlement

- Run ID: `e959fb1c-b510-4e1b-a63d-c4411245f4d9`
- Payment transaction:
  `0.0.9651299@1784940981.712442947`
- Mirror consensus timestamp: `1784940986.652502751`
- Mirror result and type: `SUCCESS`, `CRYPTOTRANSFER`
- Public transaction evidence:
  [HashScan transaction](https://hashscan.io/testnet/transaction/0.0.9651299@1784940981.712442947)

Mirror Node verified the configured payer and recipient, an exact recipient
credit of 100,000 tinybars, the bound memo, transaction type, and success.

## HCS audit anchors

- Topic: `0.0.9676520`
- Decision anchor sequence: `2`
- Receipt anchor sequence: `3`
- Receipt-anchor transaction:
  `0.0.9651299@1784941214.275325011`
- Public topic evidence:
  [HashScan topic](https://hashscan.io/testnet/topic/0.0.9676520)

The strict anchor schema contains only version, kind, stable IDs, timestamps,
transaction ID, and SHA-256 digests. Unknown fields are rejected, so prompts,
inputs, artifacts, and narrative decision evidence cannot enter the public
payload through this contract.

## Reconciliation proof

The live command received consensus for the transfer, but its first Mirror Node
lookup used an invalid transaction-ID path and returned HTTP 400. The runner
reported `reconciliation_required` and stopped. It did not submit another
payment.

The reconciliation command normalized and verified the existing transaction,
found its existing decision anchor, and published only the missing receipt
anchor. It also checks for an existing receipt anchor before publishing, making
the recovery path safe to repeat without another payment or duplicate receipt
message.
