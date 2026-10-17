# Pedin et al. (2023) Source Audit

## Audit identity and interpretation rule

- Reference: Allan B. Pedin IV, Nazli Siasi, and Mohammad Sameni, “Smart Contract-Based Social Recovery Wallet Management Scheme for Digital Assets,” *ACM Southeast Conference 2023*, pp. 177–181, DOI: 10.1145/3564746.3587016.
- Audited source: the five-page author-uploaded paper corresponding to the ACM publication.
- Baseline name: **paper-guided reimplementation of Pedin et al.’s Merkle-SHA256 setup**.
- This work is not an exact reproduction, exact replication, original implementation, or identical implementation. The published paper does not provide the complete Solidity source, compiler/tool configuration, raw observations, or every serialization and data-structure choice needed for exact reproduction.

Classification meanings:

- `PAPER_EXPLICIT`: stated in prose, pseudocode, a figure, or a reported result in the paper.
- `PAPER_INFERRED`: a conservative implementation interpretation needed to operationalize a disclosed algorithm, without claiming the paper selected the same low-level representation.
- `CONTROLLED_ASSUMPTION`: not specified by the paper; fixed transparently for this experiment.

## Source-fidelity table

| Item | Paper explicitly specifies? | Paper-supported value | Our implementation choice | Classification |
|---|---|---|---|---|
| Secret sharing | Yes | A `(k,n)` Shamir threshold scheme splits the separate secret recovery key into shares. | Shamir Secret Sharing. | PAPER_EXPLICIT |
| Secret being shared | Yes | A secret recovery key distinct from the ordinary signing key. | A newly generated synthetic Ethereum private key; its derived address is PBK. No real wallet key is used. | PAPER_EXPLICIT |
| `n` meaning | Yes | `n` is both the number of guardians and the number of shares. | One share per guardian; actual leaf count equals `n`. | PAPER_EXPLICIT |
| Recommended `k` | Yes | The paper suggests `k = n/2 + 1` to require a guardian majority. | For the even-valued grids, integer `k = n/2 + 1`. | PAPER_EXPLICIT |
| Paper evaluation grid | Yes, in Figure 9 | Guardian counts `2, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192`. | `PAPER_GRID`, 30 independent repetitions per value. | PAPER_EXPLICIT |
| Common comparison grid | No | Not a grid claimed from Pedin et al. | `COMMON_COMPARISON_GRID`: `10, 20, 50, 100`, used only for same-scale comparison with the frozen experiment. | CONTROLLED_ASSUMPTION |
| Leaf definition | Yes at the algorithmic level | Merkle leaves are hashes of shares/data values; the evaluated variant includes Merkle SHA256. | `SHA256(UTF8(canonical_encoded_share_string))`, yielding a raw 32-byte leaf digest. | PAPER_EXPLICIT |
| Hash algorithm | Yes | Merkle SHA256 is an evaluated setup variant. | SHA-256 for both leaf and internal-node hashing; variant ID `PEDIN_MERKLE_SHA256_PAPER_GUIDED`. | PAPER_EXPLICIT |
| Share serialization | No | No byte/string serialization is given. | Use the canonical encoded share string returned by `secrets.js-grempe`, encoded as UTF-8 bytes before SHA-256. | CONTROLLED_ASSUMPTION |
| Leaf ordering | Partly | Shares are denoted/indexed in their generated order and proofs retain an index; no sorting step is disclosed. | Preserve share index order `s1, s2, …, sn`; no leaf, lexical, or hash sorting. | PAPER_INFERRED |
| Parent hashing | Yes at the algorithmic level | An internal node hashes its left-child hash followed by its right-child hash. | `SHA256(left_raw_32_bytes || right_raw_32_bytes)` using binary concatenation and preserving orientation. | PAPER_EXPLICIT |
| Pair sorting | No sorting step is disclosed | The paper’s left/right proof example is order-sensitive. | Disabled; child order is never sorted. | PAPER_INFERRED |
| Merkle padding | Yes, in Figure 3 pseudocode | Extend to the next power of two using the last actual leaf/data entry when the count is not already a power of two. | Repeat the last actual 32-byte leaf digest until `nextPowerOfTwo(n)`; no zero padding, odd promotion, or per-level odd duplication. | PAPER_EXPLICIT |
| Proof construction | Yes at the algorithmic level | Each actual share receives the sibling hashes on its path and its tree index. | Generate a proof only for each actual share; every element stores sibling digest and `LEFT`/`RIGHT` orientation. Padding leaves are not guardians. | PAPER_EXPLICIT |
| Proof verification | Yes at the algorithmic level | Re-hash the share and combine each sibling in orientation-preserving order until the stored root is obtained. | Independent reference verifier, raw-byte concatenation, documented zero-based index convention. | PAPER_EXPLICIT |
| Proof index base | No | An index is distributed, but the paper does not unambiguously fix a programming-language index base. | Zero-based leaf index; even index is a left child, odd index is a right child, then `floor(index/2)`. | CONTROLLED_ASSUMPTION |
| Smart-contract stored state | Yes | Setup stores the public address associated with the secret recovery key (PBK) and the Merkle root. | Minimal contract state: `address recoveryAddress` and `bytes32 merkleRoot`. | PAPER_EXPLICIT |
| Number of setup transactions | Yes at the described transition level | The setup sequence describes a transaction that stores PBK and the Merkle root. | Exactly one successful `setup(PBK, root)` transaction per dataset. | PAPER_EXPLICIT |
| Setup gas metric | Yes at a high level | Ethereum gas required for setup is the paper’s performance metric. | Mined setup transaction receipt `gasUsed`, named `setup_gas_used`. Estimation and gas limit are not measurements. | PAPER_INFERRED |
| Deployment gas treatment | No | The paper does not unambiguously state whether deployment gas is included in Figure 9. | Record deployment receipt gas separately; exclude it from primary setup gas. | CONTROLLED_ASSUMPTION |
| Contract source structure | No | The paper presents an abstract smart-contract design, not complete Solidity source. | Minimal disclosed state transition only; no guardian mapping, asset logic, biometric data, loops, events, or access-control overhead. | CONTROLLED_ASSUMPTION |
| Solidity language | Yes | The smart contract is designed in Solidity. | Solidity `0.8.24` under the frozen controlled environment. | PAPER_EXPLICIT |
| Solidity/compiler version | No | Not reported. | Pinned local `solc 0.8.24`. | CONTROLLED_ASSUMPTION |
| Optimizer | No | Not reported. | Disabled, matching the frozen experiment. | CONTROLLED_ASSUMPTION |
| Execution network/framework | Only Ethereum is identified | Exact client, local/public network, chain ID, block limit, and framework versions are not reported. | Hardhat `2.29.0`, chain ID `31337`, block gas limit `30,000,000`, same frozen host environment. | CONTROLLED_ASSUMPTION |
| ethers.js | No | Not reported. | `ethers 6.17.0`, matching the frozen environment. | CONTROLLED_ASSUMPTION |
| Repetition count | No | Repetitions and dispersion are not reported. | 30 independent datasets per `n`; success observations retained without outlier removal. | CONTROLLED_ASSUMPTION |
| SSS software library | No | Shamir’s method is described, but no implementation package is named. | `secrets.js-grempe 2.0.0`, the same SSS library used in the controlled frozen environment. | CONTROLLED_ASSUMPTION |
| Dataset randomness | No reproducible seed/raw datasets | The paper describes generation of a secret recovery key and shares. | Independently generated synthetic Ethereum recovery key per dataset; immutable dataset JSON with digest and provenance. | CONTROLLED_ASSUMPTION |
| Biometric encryption in setup-gas baseline | The complete scheme includes it, but it is off-chain in the setup sequence | Shares are biometrically encrypted and distributed after the setup transaction. | Excluded from the Ethereum setup transaction and gas metric; the complete biometric recovery workflow is not reproduced. | PAPER_INFERRED |
| Individual-hash variants | Yes, evaluated variants are reported | Figure 9 includes individual SHA256/SHA3-512 variants, but their exact transaction/storage layout is not disclosed. | Excluded from the primary baseline rather than inventing an on-chain layout. | CONTROLLED_ASSUMPTION |
| Recovery transaction | Yes, a recovery result is reported | The paper reports a recovery-gas result, but that is not comparable to the frozen elapsed-time recovery metric. | No Pedin recovery transaction is implemented or directly compared. | CONTROLLED_ASSUMPTION |

## Scope conclusion

The auditable common unit is the setup/anchoring path from a synthetic secret recovery key through Shamir shares, SHA-256 leaves, a Merkle root, and one on-chain setup transition. Absolute gas values are implementation- and environment-dependent because the original contract and execution configuration are unavailable. The scientifically defensible comparison is therefore the observed scaling pattern under the same frozen Hardhat environment, with payload scope reported beside every cross-study value.
