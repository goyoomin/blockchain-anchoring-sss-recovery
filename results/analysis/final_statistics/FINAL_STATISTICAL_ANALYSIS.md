# Final Statistical Analysis

## A. Gas

PER_SHARE mean anchoring gas increased from 237340.4 at n=5 to 47479746.8 at n=1000 (200.05×). MERKLE_ROOT mean gas remained between 46536.0 and 46540.0. The largest observed mean gas reduction was 99.90% at n=1000. At n=1000, the means were 47479746.8 and 46538.8, respectively.

## B. Recovery

The mechanism with the lower observed mean was: n=5: MERKLE_ROOT; n=10: MERKLE_ROOT; n=20: MERKLE_ROOT; n=50: MERKLE_ROOT; n=100: MERKLE_ROOT; n=500: MERKLE_ROOT; n=1000: MERKLE_ROOT. The paired 95% CI excluded zero at n=20, 50, 100, 500; it included zero at n=5, 10, 1000. A CI excluding zero is reported as evidence about the paired mean difference, while a CI including zero is not treated as evidence of a nonzero mean difference. Recovery reduction percentages are descriptive and are not used alone for significance claims.

## C. Recovery Components

PER_SHARE blockchain-query mean increased from 2.202 ms at n=5 to 357.497 ms at n=1000 (162.36×), making it the dominant measured PER_SHARE component at n=1000. MERKLE_ROOT blockchain-query means stayed in the range 0.408–0.499 ms, while proof generation increased from 0.023 to 4.325 ms and verification reached 358.336 ms. At n=1000, SSS reconstruction means were similar (89.679 ms PER_SHARE; 89.940 ms MERKLE_ROOT). The total means are close (459.289 vs 453.737 ms) because PER_SHARE query time (357.497 ms) and MERKLE_ROOT verification time (358.336 ms) are similarly dominant, and both include approximately 90 ms of SSS reconstruction.

## D. Transaction Count

PER_SHARE transaction count increases exactly with n, from 5 to 1000; MERKLE_ROOT remains exactly one anchoring transaction. Deployment transactions are excluded.

## E. Execution Feasibility

At n=500 and n=1000, Main success was 120/120 and Recovery Counterbalanced success was 120/120. No failed observation or outlier was removed.
