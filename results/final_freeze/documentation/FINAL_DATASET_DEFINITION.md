# Final Dataset Definition

The Hardhat Main Evaluation uses n = 5, 10, 20, 50, 100, 500, and 1000. Each share size has 30 independent datasets. Each dataset is used unchanged by both PER_SHARE and MERKLE_ROOT.

This yields 210 datasets and 420 Main mechanism executions. The Recovery Counterbalanced Validation reuses the same 210 datasets for 420 additional mechanism executions. The frozen primary Hardhat total is therefore **840 mechanism executions**. Pilot, single, and sanity executions are auxiliary and excluded from 840.

The threshold is k = floor(n/2) + 1: 3, 6, 11, 26, 51, 251, and 501 respectively. The dataset manifest discloses only IDs, n, k, paths, sizes, and SHA-256 hashes; it does not reproduce secrets or shares.
