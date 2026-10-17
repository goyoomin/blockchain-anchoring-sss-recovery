# Pedin Paper-Guided Baseline Analysis

This report summarizes the paper-guided Merkle-SHA256 setup. It is not an exact reproduction. All 510 rows are retained; no outlier was removed.

## Paper-grid scalability

Mean setup gas ranges from 66827 to 66830.6 gas, an absolute range of 3.6000000000058208 gas (0.005387044158806801% relative to the minimum). The descriptive slope is -0.0027925000665530923 gas per additional guardian. This slope is used to characterize the fixed-size setup pattern, not as a regression-significance claim.

## Common-grid interpretation

Normalized growth removes each contract's different fixed overhead by setting its own n=10 mean to 1.0. Pedin paper-guided setup stores PBK plus a Merkle root, our Merkle-Root mechanism anchors a root only, and our Per-Share mechanism sends n share-hash transactions. Absolute-gas superiority is therefore not inferred.
