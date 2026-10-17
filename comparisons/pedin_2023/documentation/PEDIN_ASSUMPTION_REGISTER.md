# Pedin Paper-Guided Baseline Assumption Register

This register prevents undisclosed details from being attributed to Pedin et al. Every item below is a controlled choice in this project, not a claim about the authors' original implementation.

| Paper does not specify | Controlled choice | Reason and consequence |
|---|---|---|
| Complete Solidity source | `PedinPaperGuidedSetup` stores only PBK and one `bytes32` Merkle root | Reproduces only the disclosed setup state transition; absolute gas need not match Figure 9. |
| Solidity/compiler version | Solidity and pinned local solc `0.8.24` | Uses the frozen controlled environment. |
| Optimizer setting | Disabled (`runs=200` is inert while disabled) | Matches the frozen configuration. |
| Ethereum client/framework/version | Hardhat `2.29.0`, chain ID `31337`, block gas limit `30,000,000` | Enables controlled within-environment comparison; it is not claimed as the paper's environment. |
| ethers integration | ethers.js `6.17.0` | Matches the frozen project. |
| Node/npm/host | The same Node, npm, OS, CPU, and RAM snapshot used by the frozen experiment | Isolates structural scaling from host differences. |
| Repetition count | 30 independent synthetic datasets per `n` | Aligns descriptive statistics with the frozen experiment; the paper reports no repetition count or CI. |
| SSS software library | `secrets.js-grempe 2.0.0` | The paper specifies Shamir SSS but no package; this is the frozen experiment's SSS library. |
| Share serialization | Canonical encoded share string returned by that library, encoded as UTF-8 | Makes leaf bytes deterministic and explicit. |
| Proof index base | Zero-based | The paper distributes an index but does not unambiguously specify a language-level base. |
| Exact contract storage layout | Two state slots: `address recoveryAddress` and `bytes32 merkleRoot` | Minimal disclosed state; avoids invented guardians, arrays, events, loops, biometric data, asset state, or access control. |
| Whether deployment gas is included in setup results | Deployment receipt gas is recorded separately and excluded from `setup_gas_used` | Keeps the primary metric equal to the one setup transaction's receipt gas. |
| Meaning of setup measurement at receipt level | Mined transaction receipt `gasUsed` | Never substitutes `estimateGas` or a gas limit for measured use. |
| Exact raw gas observations | No numerical values are transcribed or estimated from Figure 9 | Paper-reported fidelity is qualitative: constant/near-constant direction only. |
| Synthetic secret representation | Fresh synthetic Ethereum private key; its address is PBK | Matches the described distinct recovery key/address relation without using real assets or user keys. |
| Common comparison conditions | `n=10,20,50,100` | Additional controlled grid for matching the frozen experiment; not attributed to the paper. |
| Biometric workflow implementation | Excluded | The paper's setup sequence places biometric share encryption/distribution off-chain after the PBK/root transaction; the complete recovery workflow is not reproduced. |
| Individual-hash storage/transaction structure | Variant excluded | The paper does not disclose whether hashes are stored by array, mapping, or one/many transactions; inventing this would materially determine gas. |
| Recovery implementation | Excluded | Pedin recovery gas and the frozen elapsed recovery time have different metric definitions and are not directly compared. |

## Fixed algorithmic conventions

- Variant: `PEDIN_MERKLE_SHA256_PAPER_GUIDED` only.
- Leaf: `SHA256(UTF8(encoded_share))`.
- Order: original share index order; no leaf sorting or pair sorting.
- Padding: repeat the last actual leaf to the next power of two.
- Parent: `SHA256(left_raw_32_bytes || right_raw_32_bytes)`.
- Proof: actual shares only, with sibling hashes and orientation; zero-based index.
- Setup: one transaction stores synthetic PBK and Merkle root.
- Primary gas: setup receipt `gasUsed`; deployment gas is separate.

## Wording constraint

Use “paper-guided reimplementation of Pedin et al.'s Merkle-SHA256 setup.” Do not use “exact reproduction,” “exact replication,” “original Pedin implementation,” or “identical implementation.”
