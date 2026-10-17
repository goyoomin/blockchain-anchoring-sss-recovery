# Pedin Publication Interpretation Boundary

## Original Paper Reported Trend

Pedin et al. report a fixed-size Merkle-root setup-gas trend as guardian count increases. The original Figure 9 coordinates are not digitized, estimated, or used as publication data.

## Our Paper-Guided Measurement

The frozen paper-guided Merkle-SHA256 setup showed essentially constant setup gas over n = 2–192. This is agreement with a structural trend, not a claim that the unpublished original contract or its absolute gas values were reproduced.

## Common-Grid Interpretation

Both Merkle-based approaches showed near-constant normalized on-chain gas growth over n = 10, 20, 50, and 100, whereas cumulative Per-Share anchoring increased approximately in proportion to the number of shares. Within the evaluated setup/anchoring operation, storing a fixed-size Merkle root decoupled on-chain gas growth from the number of off-chain shares. This statement does not characterize the complexity of either complete recovery protocol.

## Scope Boundary

The paper-guided Pedin setup stores a recovery address plus a Merkle root in one transaction. Our Merkle-Root method anchors only a Merkle root in one transaction. Our Per-Share method anchors n individual share hashes in n transactions. Because these responsibilities differ, the publication assets do not assert absolute gas superiority, protocol equivalence, recovery-performance superiority, or security superiority.

The implementation follows the paper-disclosed Shamir/Merkle-SHA256 setup structure, ordered parent hashing, last-leaf padding, proof construction, and PBK-plus-root setup transition, while undisclosed software and execution details remain controlled assumptions.
