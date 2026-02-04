# Replaced Transaction Detection

The `wait_for_transaction_confirmation` tool now detects when a transaction has been replaced by another transaction.

## How It Works

When monitoring a transaction that hasn't been mined yet, the tool will check if it has been replaced by:

1. Retrieving the original transaction details (to get the sender address and nonce)
2. Checking the latest block for any transaction from the same sender with the same nonce but different hash
3. If found, returning a "replaced" status with the new transaction hash

## Response Format

When a transaction is replaced, the response includes:

```json
{
  "status": "replaced",
  "txHash": "0x...",
  "replacedBy": "0x...",
  "replacementTx": {...},
  "reason": "Transaction was replaced by another transaction with the same nonce"
}
```

## Use Cases

- **Gas price bumping**: User submits replacement with higher gas to speed up inclusion
- **Transaction cancellation**: User submits zero-value transfer with higher gas to cancel original
- **Race conditions**: Multiple transactions submitted simultaneously, network chooses one

## Status Values

The tool can return the following status values:

- `"confirmed"`: Transaction mined successfully
- `"reverted"`: Transaction mined but execution failed (includes revertReason)
- `"replaced"`: Transaction was replaced by another with same nonce (includes replacedBy)
- `"timeout"`: Transaction not mined within timeout period