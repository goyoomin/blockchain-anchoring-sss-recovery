
# Blockchain Anchoring for SSS-Based Private Key Recovery

## 1. Overview

This repository contains experimental code, configurations, and reproducibility materials supporting the manuscript:

**A Comparative Performance and Scalability Analysis of Blockchain Anchoring Designs for Shamir's Secret Sharing-Based Private Key Recovery**

The study evaluates the performance and scalability of two blockchain-based integrity-anchoring implementations for Shamir's Secret Sharing (SSS):

- **Per-Share Anchoring:** Stores a separate hash for each secret share.
- **Merkle Root Anchoring (MRA):** Aggregates share hashes into a Merkle tree and stores a single Merkle root.

The evaluation focuses on cumulative anchoring gas consumption, transaction counts, end-to-end recovery latency, and recovery-component overhead.

This repository provides a greenfield experimental implementation. It does not claim binary compatibility with the original INTCOM 2026 implementation.

## 2. Research Objectives

The experiments investigate:

1. How cumulative anchoring gas changes as the number of shares increases.
2. How the number of state-changing transactions differs between Per-Share and MRA.
3. How anchoring choices affect end-to-end recovery performance.
4. Which operations dominate recovery latency at large share counts.
5. How the evaluated implementations compare with a paper-guided Pedin baseline in terms of scaling behavior.

The study does not introduce a new cryptographic primitive or Merkle-based anchoring mechanism.

Its contribution is a controlled empirical evaluation of the performance trade-offs between the specified implementations.

## 3. Experimental Environment

The experiments were conducted in a local Ethereum environment using Hardhat.

| Component | Configuration |
|---|---|
| Operating system | Windows_NT 10.0.26200 x64 |
| CPU | Intel Core i7-10700F @ 2.90 GHz |
| CPU cores | 16 logical cores |
| RAM | Approximately 15.9 GiB |
| Node.js | v22.23.1 |
| npm | 10.9.8 |
| Hardhat | 2.29.0 |
| ethers.js | 6.17.0 |
| Solidity | 0.8.24 |
| Solidity optimizer | Disabled |
| SSS library | secrets.js-grempe 2.0.0 |
| Merkle library | merkletreejs 0.6.0 |
| Primary hash | KECCAK256 |
| Network | Hardhat local Ethereum |
| Chain ID | 31337 |
| Block gas limit | 30,000,000 |

The experiments use synthetic secrets and a controlled local execution environment.

Public Ethereum transaction latency, network congestion, RPC variability, and monetary transaction costs are outside the scope of the evaluation.

## 4. Dataset Configuration

Seven share-count settings were evaluated:

n = 5, 10, 20, 50, 100, 500, 1000

The reconstruction threshold was:

k = floor(n / 2) + 1

| Number of shares (n) | Threshold (k) |
|---|---|
| 5 | 3 |
| 10 | 6 |
| 20 | 11 |
| 50 | 26 |
| 100 | 51 |
| 500 | 251 |
| 1000 | 501 |

For each share-count setting, 30 independent datasets were generated.

Each dataset contains a synthetic 32-byte secret and its encoded SSS shares.

The same dataset is reused across both anchoring implementations to control differences attributable to input data.

No real wallet credentials or private keys associated with actual assets were used.

## 5. Anchoring Implementations

### 5.1 Per-Share Anchoring

Per-Share computes the KECCAK256 hash of each encoded share and stores each hash through a separate state-changing transaction.

For n shares:

- n share hashes are stored.
- n anchoring transactions are executed.
- Each share hash can be retrieved individually.

During recovery, the implementation retrieves and verifies all n shares before selecting the first k valid shares for reconstruction.

The verification loop does not terminate when k valid shares have been collected.

### 5.2 Merkle Root Anchoring (MRA)

MRA computes share hashes and constructs a Merkle tree off-chain.

The implementation uses:

- sortLeaves = false
- sortPairs = true
- duplicateOdd = false

The resulting Merkle root is stored through one state-changing transaction.

During recovery:

1. The anchored Merkle root is retrieved.
2. Merkle proofs are generated for the first k indexed shares.
3. The k proofs are verified using sequential Solidity view-function calls.
4. SSS reconstruction proceeds if all selected shares pass verification.

The implementation does not examine the remaining n - k shares.

If any of the first k indexed shares fails verification, the recovery run is reported as unsuccessful rather than searching for alternative shares.

**Important:** Per-Share and MRA do not verify the same number of shares during recovery. Therefore, recovery-time differences reflect both the anchoring designs and their implementation-specific verification workloads.

## 6. Experimental Design

The reported evaluation consists of three separate experimental groups.

| Experimental group | Recorded observations |
|---|---:|
| Main anchoring experiment | 420 |
| Counterbalanced recovery validation | 420 |
| Paper-guided Pedin baseline | 510 |
| **Total** | **1,350** |

### 6.1 Main Anchoring Experiment

The main experiment evaluates both anchoring mechanisms using 210 paired datasets.

Seven share-count settings, 30 datasets per setting, and two mechanisms yield 420 recorded runs.

The main experiment provides:

- Cumulative anchoring gas
- Number of anchoring transactions
- Execution completion results

### 6.2 Counterbalanced Recovery Validation

A separate experiment evaluates recovery performance using the same frozen datasets.

The execution order alternates between:

- PER_SHARE_FIRST
- MERKLE_ROOT_FIRST

Each order is used 15 times per share-count setting.

The validation contains 420 recorded recovery runs.

The experiment measures end-to-end recovery time and selected recovery components.

### 6.3 Pedin Paper-Guided Baseline

An external baseline was constructed using methodological details reported by Pedin et al.

The implementation reproduces the paper-described Shamir–Merkle-SHA256 setup and anchoring stage, not the complete social-recovery protocol.

The Paper Grid contains 390 observations across 13 share-count settings.

The Common Grid contains 120 additional observations across four share-count settings.

The baseline is intended to compare scaling patterns rather than directly rank absolute gas efficiency across different contract storage structures.

It is a paper-guided reimplementation, not an exact reproduction of the original authors' implementation.

## 7. Evaluation Metrics

The principal evaluation metrics are:

### Cumulative Anchoring Gas

Gas consumption is measured from the gasUsed field of mined anchoring transaction receipts.

Contract deployment gas and off-chain computation are excluded.

For Per-Share, cumulative gas is the sum of n anchoring transactions.

For MRA, cumulative gas corresponds to one Merkle-root anchoring transaction.

### Anchoring Transaction Count

This metric counts state-changing anchoring transactions.

- Per-Share: n transactions
- MRA: 1 transaction

Solidity view-function calls are not counted as anchoring transactions.

### End-to-End Recovery Time

Recovery time is measured using process.hrtime.bigint().

The measurement includes:

- Dataset loading and validation
- Blockchain anchor retrieval
- Integrity or Merkle-proof verification
- Selection of shares for reconstruction
- SSS reconstruction
- Recovered-secret comparison

CSV/JSONL writing and progress logging occur after the measurement interval.

### Recovery-Component Analysis

Diagnostic component measurements include blockchain queries, integrity verification, Merkle-proof generation, and SSS reconstruction.

These components are not necessarily mutually exclusive and do not have to sum exactly to the end-to-end recovery time.

See METRIC_DEFINITIONS.md for the detailed metric definitions.

## 8. Statistical Analysis

Each share-count setting uses 30 repeated observations per mechanism.

The analysis includes:

- Mean values
- Sample standard deviations using N - 1
- Paired recovery-time differences
- Descriptive 95% confidence intervals based on Student's t-distribution
- Component-level timing comparisons

The paired recovery-time difference is defined as:

Delta(n) = RecoveryTime_PerShare(n) - RecoveryTime_MRA(n)

A positive difference indicates a lower recovery time for MRA.

A confidence interval excluding zero is used as the predefined descriptive criterion for a clear difference at a given share-count setting.

No automatic outlier removal is applied.

## 9. Installation

### Requirements

Install:

- Node.js v22.23.1
- npm 10.9.8
- Git

The portable Node.js runtime and installed node_modules dependencies are not distributed with this repository.

### Clone the Repository

```bash
git clone https://github.com/<USERNAME>/blockchain-anchoring-sss-recovery.git
cd blockchain-anchoring-sss-recovery
```

Replace <USERNAME> with the GitHub repository owner's username.

### Install Dependencies

```bash
npm ci
```

This installs the dependencies using the committed package-lock.json file.

### Run Tests

```bash
npm test
```

### Run the Experiment Audit

```bash
npm run experiment:audit
```

### Run the Pilot Experiment

```bash
npm run experiment:pilot
```

The commands above follow the existing experiment workflow.

Before running the complete evaluation, review:

- EXPERIMENT_COMMANDS.md
- EXPERIMENT_PROTOCOL.md
- METRIC_DEFINITIONS.md
- EXPERIMENT_AUDIT.md

Do not rerun the complete publication experiment before verifying the environment, pilot output, and experimental configuration.

## 10. Repository Structure

```text
blockchain-anchoring-sss-recovery/
│
├── contracts/
│   └── Solidity smart contracts
│
├── experiments/
│   └── Experimental implementations and runners
│
├── comparisons/
│   └── External baseline comparison implementation
│
├── test/
│   └── Implementation tests
│
├── results/
│   ├── main/
│   │   └── Main experiment results
│   ├── pedin/
│   │   └── Pedin-related experiment outputs
│   └── Other experimental records
│
├── hardhat.config.js
├── package.json
├── package-lock.json
├── README.md
├── EXPERIMENT_PROTOCOL.md
├── EXPERIMENT_COMMANDS.md
├── EXPERIMENT_AUDIT.md
├── METRIC_DEFINITIONS.md
└── PEDIN_REPRODUCTION_NOTES.md
```

The exact contents of results/ depend on the frozen experimental files included in the release.

## 11. Experimental Data Availability

The research materials supporting the manuscript include:

- Main anchoring experiment records
- Counterbalanced recovery measurements
- Paper-guided Pedin baseline measurements
- Experimental configurations
- Synthetic input datasets
- Analysis outputs and supporting documentation

The experimental groups are preserved separately because they address different evaluation questions.

The released datasets should correspond to the frozen measurements used in the manuscript.

**Important:** Only files actually included in the public release are available directly through this repository. Any materials not included in the release must not be described as publicly downloadable.

## 12. SHA-256 Data Integrity Verification

Table 9 of the manuscript reports SHA-256 digests for the frozen raw experimental records.

These digests support verification that the released data correspond to the data used for the reported analysis.

After downloading the corresponding files, their SHA-256 values can be checked on Windows PowerShell using:

```powershell
Get-FileHash -Algorithm SHA256 .\path\to\raw-data.csv
```

Replace the example path with the actual dataset file.

The computed hash should match the corresponding value reported in Table 9.

Any modifications to the contents of a frozen raw dataset will change its SHA-256 digest.

The reported SHA-256 digests demonstrate data integrity, but they do not independently establish complete experimental reproducibility.

## 13. Reproducibility Documentation

The following documents provide additional information:

| Document | Purpose |
|---|---|
| EXPERIMENT_PROTOCOL.md | Experimental design and execution procedure |
| EXPERIMENT_COMMANDS.md | Experiment execution commands |
| METRIC_DEFINITIONS.md | Measurement definitions |
| EXPERIMENT_AUDIT.md | Experimental environment and audit information |
| PEDIN_REPRODUCTION_NOTES.md | Assumptions used in the paper-guided Pedin baseline |

Users should review the relevant protocol and configuration documents before rerunning the experiments.

## 14. Research Scope and Limitations

The evaluation focuses on the integrity-anchoring layer.

It does not evaluate:

- Public Ethereum network latency or congestion
- Guardian or storage-node availability
- Authentication and access-control mechanisms
- Share confidentiality and encrypted communication
- Dynamic guardian membership
- Share refresh and threshold modification
- Versioned Merkle roots
- Comprehensive adversarial security scenarios
- Batched Per-Share storage
- Alternative Merkle proof-verification strategies

The reported results characterize the specified implementations and controlled local execution environment.

The performance findings should not be generalized to all possible optimized anchoring or wallet-recovery implementations.

## 15. Security Notice

All experiment secrets are synthetically generated research data.

No real wallet private keys, seed phrases, or credentials associated with actual assets should be placed in this repository.

Do not upload:

- Real wallet keys
- API credentials or authentication tokens
- Secret environment variables
- Personal account credentials
- Sensitive personal information

Any synthetic secrets included in released datasets must be verified as unrelated to real assets or deployed wallets.

## 16. Citation

If you use this repository in academic work, please cite the associated manuscript:

Go, Y.; Kim, M. "A Comparative Performance and Scalability Analysis of Blockchain Anchoring Designs for Shamir's Secret Sharing-Based Private Key Recovery." Electronics, 2026.

Publication details and DOI should be updated after final publication.

## 17. License

No reuse license has been assigned in this README.

Any future license should be selected with the approval of the repository owners and in accordance with the rights associated with the source code and research materials.
