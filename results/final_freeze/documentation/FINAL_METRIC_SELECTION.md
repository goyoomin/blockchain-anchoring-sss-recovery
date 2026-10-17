# Final Metric Selection

## Gas Used

The final gas results are read from `results/main/main_raw.csv`. The primary metric is **Cumulative Anchoring Gas Used**. For PER_SHARE it is the sum of receipt `gasUsed` for the n `anchorShare` transactions. For MERKLE_ROOT it is the receipt `gasUsed` of one `anchorMerkleRoot` transaction. Deployment gas is excluded from the primary metric.

## Recovery Time

The final Recovery Time results are read from `results/recovery_validation/recovery_counterbalanced_raw.csv` and its frozen summary. Main Recovery Time values are not used in the final figures or tables. The counterbalanced source is selected because the 15:15 design removes systematic execution-order sensitivity and is the more strictly controlled recovery result.

## Transaction Count

Transaction count follows the Main design: PER_SHARE = n and MERKLE_ROOT = 1. Contract deployment transactions are excluded.

## Success Rate

Success rates are calculated from actual Raw Data: Main 420/420 (100.00%) and Recovery Counterbalanced 420/420 (100.00%). No success rate is assumed or hardcoded.
