# Recovery Validation Report

## Experiment Design

This experiment tests execution-order sensitivity using the 210 immutable Main datasets.
Recovery timing uses the unchanged `METRIC_DEFINITIONS.md` boundary and `process.hrtime.bigint()`.
Odd repetitions use PER_SHARE_FIRST; even repetitions use MERKLE_ROOT_FIRST. Each mechanism runs after a Hardhat reset and fresh deployment.
One unrecorded dry warm-up per mechanism and n is performed before primary measurements.

## Data Integrity

- Expected/actual rows: 420/420
- Expected/actual paired datasets: 210/210
- Successful/failed rows: 420/0
- Main raw SHA-256 unchanged: true
- Environment match: true
- Environment differences: none

## Recovery Summary

| n | PER_SHARE mean ± SD (ms) | MERKLE_ROOT mean ± SD (ms) | paired delta mean [95% CI] (ms) |
|---:|---:|---:|---:|
| 5 | 2.6214 ± 0.8198 | 2.3719 ± 0.2155 | 0.2495 [-0.0628, 0.5617] |
| 10 | 4.5166 ± 0.4285 | 4.4255 ± 0.5603 | 0.0911 [-0.2078, 0.3900] |
| 20 | 8.7092 ± 0.6638 | 7.8517 ± 1.0084 | 0.8574 [0.4726, 1.2422] |
| 50 | 19.6482 ± 0.9140 | 17.6993 ± 1.6838 | 1.9489 [1.2272, 2.6705] |
| 100 | 38.3424 ± 2.7471 | 35.4343 ± 4.3859 | 2.9081 [0.9767, 4.8394] |
| 500 | 218.1507 ± 9.3188 | 204.4542 ± 11.9848 | 13.6965 [8.1154, 19.2777] |
| 1000 | 459.2887 ± 16.2006 | 453.7367 ± 28.0815 | 5.5520 [-4.2526, 15.3567] |

Positive paired delta means MERKLE_ROOT was faster; negative means PER_SHARE was faster.

## Order Effect

| n | mechanism/comparison | group A mean | group B mean | A-B [95% CI] (ms) |
|---:|---|---:|---:|---:|
| 5 | PER_SHARE: FIRST vs SECOND | 2.6541 | 2.5887 | 0.0654 [-0.5592, 0.6900] |
| 5 | MERKLE_ROOT: FIRST vs SECOND | 2.4462 | 2.2976 | 0.1486 [-0.0074, 0.3046] |
| 5 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | 0.3565 | 0.1425 | 0.2140 [-0.4183, 0.8463] |
| 10 | PER_SHARE: FIRST vs SECOND | 4.4194 | 4.6137 | -0.1943 [-0.5123, 0.1237] |
| 10 | MERKLE_ROOT: FIRST vs SECOND | 4.3847 | 4.4662 | -0.0815 [-0.5076, 0.3445] |
| 10 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | -0.0468 | 0.2290 | -0.2759 [-0.8769, 0.3252] |
| 20 | PER_SHARE: FIRST vs SECOND | 8.6262 | 8.7921 | -0.1660 [-0.6681, 0.3361] |
| 20 | MERKLE_ROOT: FIRST vs SECOND | 7.9602 | 7.7433 | 0.2169 [-0.5537, 0.9876] |
| 20 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | 0.8829 | 0.8319 | 0.0509 [-0.7348, 0.8366] |
| 50 | PER_SHARE: FIRST vs SECOND | 19.7166 | 19.5799 | 0.1367 [-0.5640, 0.8374] |
| 50 | MERKLE_ROOT: FIRST vs SECOND | 17.5389 | 17.8598 | -0.3209 [-1.6013, 0.9596] |
| 50 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | 1.8568 | 2.0410 | -0.1842 [-1.6592, 1.2908] |
| 100 | PER_SHARE: FIRST vs SECOND | 38.8664 | 37.8184 | 1.0479 [-1.1003, 3.1961] |
| 100 | MERKLE_ROOT: FIRST vs SECOND | 35.7692 | 35.0995 | 0.6697 [-2.7751, 4.1146] |
| 100 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | 3.7669 | 2.0492 | 1.7176 [-2.1853, 5.6206] |
| 500 | PER_SHARE: FIRST vs SECOND | 220.0306 | 216.2709 | 3.7597 [-3.2358, 10.7552] |
| 500 | MERKLE_ROOT: FIRST vs SECOND | 203.5611 | 205.3473 | -1.7861 [-11.0498, 7.4775] |
| 500 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | 14.6833 | 12.7097 | 1.9736 [-9.5879, 13.5350] |
| 1000 | PER_SHARE: FIRST vs SECOND | 461.1421 | 457.4353 | 3.7068 [-8.6946, 16.1081] |
| 1000 | MERKLE_ROOT: FIRST vs SECOND | 453.6805 | 453.7929 | -0.1125 [-21.8181, 21.5931] |
| 1000 | PAIRED_DELTA: PER_SHARE_FIRST vs MERKLE_ROOT_FIRST | 7.3492 | 3.7549 | 3.5943 [-16.5960, 23.7846] |

## Main vs Counterbalanced

| n | mechanism | Main mean | Counterbalanced mean | absolute difference | relative difference |
|---:|---|---:|---:|---:|---:|
| 5 | PER_SHARE | 2.6826 | 2.6214 | 0.0612 | 2.28% |
| 5 | MERKLE_ROOT | 2.5161 | 2.3719 | 0.1442 | 5.73% |
| 10 | PER_SHARE | 4.6099 | 4.5166 | 0.0933 | 2.02% |
| 10 | MERKLE_ROOT | 4.4693 | 4.4255 | 0.0438 | 0.98% |
| 20 | PER_SHARE | 8.4499 | 8.7092 | 0.2592 | 3.07% |
| 20 | MERKLE_ROOT | 7.8618 | 7.8517 | 0.0100 | 0.13% |
| 50 | PER_SHARE | 21.0277 | 19.6482 | 1.3795 | 6.56% |
| 50 | MERKLE_ROOT | 18.0838 | 17.6994 | 0.3845 | 2.13% |
| 100 | PER_SHARE | 38.8161 | 38.3424 | 0.4737 | 1.22% |
| 100 | MERKLE_ROOT | 33.7091 | 35.4343 | 1.7252 | 5.12% |
| 500 | PER_SHARE | 228.0019 | 218.1507 | 9.8512 | 4.32% |
| 500 | MERKLE_ROOT | 206.6582 | 204.4542 | 2.2040 | 1.07% |
| 1000 | PER_SHARE | 453.1244 | 459.2887 | 6.1643 | 1.36% |
| 1000 | MERKLE_ROOT | 438.4196 | 453.7367 | 15.3171 | 3.49% |

## Interpretation

**Case C** was selected by a prespecified CI-based descriptive rule: an effect is flagged when its 95% CI excludes zero.
Order-effect signal detected: false. Main/counterbalanced mean-difference signal detected: true. Mechanism-direction agreement across n: true.

Order sensitivity or divergence from Main is material under the CI rule; use the counterbalanced estimates as the final Recovery Time results rather than the original Main recovery estimates.

P-values are sensitivity diagnostics only; paired differences and confidence intervals are primary. No automatic outlier removal was applied.

