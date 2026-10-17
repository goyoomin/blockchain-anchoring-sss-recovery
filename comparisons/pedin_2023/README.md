# Pedin et al. (2023) Paper-Guided Baseline

This isolated baseline evaluates the setup/anchoring scalability of a paper-guided Merkle-SHA256 implementation. It does not claim exact reproduction of the original contract or environment.

## Locked workflow

```powershell
.\experiment.cmd freeze-validate
.\experiment.cmd pedin-test
.\experiment.cmd pedin-sanity
.\experiment.cmd freeze-validate
```

Only after those commands produce a valid readiness marker, and only after explicit user review:

```powershell
.\experiment.cmd pedin-baseline
.\experiment.cmd pedin-validate
.\experiment.cmd pedin-summary
.\experiment.cmd pedin-freeze
```

`pedin-baseline` is resume-safe by the unique dataset/variant experiment ID. It never writes to the frozen Main, Recovery, Final Statistics, or Publication Assets trees. `pedin-summary` refuses to operate unless the complete 510-row design validates. `pedin-freeze` refuses unless both the full validation and required statistics exist.

## Designs

- Paper Grid: 13 `n` conditions × 30 = 390 setup executions.
- Common Comparison Grid: 4 `n` conditions × 30 = 120 setup executions.
- Total independent Pedin paper-guided setup executions: 510.
- Sanity runs are separate and excluded from 510.

The full execution command is intentionally not invoked during the implementation/sanity stage.
