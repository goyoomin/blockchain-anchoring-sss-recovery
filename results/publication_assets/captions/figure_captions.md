# Figure Captions

**Figure 1.** Cumulative anchoring gas used by PER_SHARE and MERKLE_ROOT across seven share-count conditions in the Main Experiment. Points show means over 30 repetitions and error bars show 95% confidence intervals. The linear and logarithmic renderings use identical values; MERKLE_ROOT remains nearly constant while PER_SHARE increases with n.

**Figure 2.** Total recovery time in the Counterbalanced Recovery Validation. Points show means over 30 paired datasets and error bars show mechanism-specific 95% confidence intervals. Hollow diamonds denote conditions where the paired 95% confidence interval for PER_SHARE minus MERKLE_ROOT excludes zero (n=20, 50, 100, and 500); the paired interval includes zero at n=5, 10, and 1000.

**Figure 3.** Anchoring transaction count from the Main Experiment structure. PER_SHARE requires n anchoring transactions, whereas MERKLE_ROOT requires one; deployment transactions are excluded.

**Figure 4.** Mean cumulative anchoring-gas reduction achieved by MERKLE_ROOT relative to PER_SHARE in the Main Experiment. The reduction increases from 80.39% at n=5 to 99.90% at n=1000.

**Figure 5.** Mean recovery-component times from the Counterbalanced Recovery Validation. PER_SHARE is increasingly dominated by blockchain queries, whereas MERKLE_ROOT retains a nearly constant root-query time but incurs growing verification and proof-generation work. At n=1000, similar verification/query and reconstruction costs bring the total recovery times close together. The full and representative renderings use the same component means.

**Figure A1.** Paired recovery-time difference (PER_SHARE minus MERKLE_ROOT) in the Counterbalanced Recovery Validation. Error bars show paired 95% confidence intervals and the horizontal line marks zero. Positive values indicate a lower MERKLE_ROOT recovery time.
<!-- PEDIN_EXTERNAL_BASELINE_FIGURE_CAPTIONS -->
## Pedin External Baseline

**Figure 6.** Setup gas of the paper-guided Pedin Merkle-SHA256 baseline across the guardian counts evaluated in the paper-grid experiment. Each point represents the mean of 30 frozen executions, and error bars indicate 95% confidence intervals. Mean setup gas remained between approximately 66,827 and 66,830.6 gas across n = 2–192, corresponding to a relative range of approximately 0.0054%. The measurement evaluates agreement with the fixed-size gas-scaling trend reported by Pedin et al.; it is not claimed as an exact reproduction of their undisclosed original implementation.

**Figure 7.** Normalized on-chain gas scaling on the common grid (n = 10, 20, 50, and 100). Each mechanism is normalized by its own mean gas value at n = 10 to isolate scaling behavior from differences in fixed contract overhead. The Pedin paper-guided setup stores a recovery address together with a Merkle root, whereas our Merkle-Root mechanism anchors only the root and the Per-Share mechanism submits one anchoring transaction per share. The figure therefore compares relative scaling patterns rather than absolute gas efficiency.
