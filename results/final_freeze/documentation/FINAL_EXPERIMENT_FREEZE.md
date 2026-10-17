# Final Experiment Freeze

## Freeze Date

2026-08-09T16:25:49.263Z

## Purpose

Freeze the completed Hardhat experiment baseline for the MDPI manuscript with reproducible file-level integrity evidence.

## Experiment A — Main

420 mechanism executions across 210 datasets. Successes: 420; failures: 0.

## Experiment B — Recovery Counterbalanced Validation

420 mechanism executions across 210 paired datasets. Successes: 420; failures: 0.

## Total

840 primary Hardhat mechanism executions. Pilot and sanity executions are excluded.

## Final Data Sources

- Gas and transaction count: Main Experiment.
- Recovery Time: Recovery Counterbalanced Validation.

## Integrity

- Main SHA-256: `a81e49c2a3a2730a5157aa39352c0ff28a00fe283fde630db89ef47827dfaf5d`
- Recovery Raw SHA-256: `bc5d4499d383faf405547ad4fdda013796f2bc73fc6efe39ef386a0fc03df942`
- Main datasets verified: 210/210
- Environment match: true
- Main failures: 0
- Recovery failures: 0
- Freeze validation: VALID

## Rule

After this freeze, analysis and figure/table generation must read the Raw Data without modifying it. Outputs belong in separate analysis, figures, or tables directories. The two primary Raw CSV destinations are protected by the experiment logger while status is FROZEN.
