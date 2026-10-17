# Pedin Baseline Comparison Scope

## A. Paper Reported

Pedin et al. describe a social-recovery design with a distinct secret recovery key, `(k,n)` Shamir sharing, Merkle proofs over guardian shares, and one setup transition that stores the recovery public address (PBK) and Merkle root. They report that the Merkle SHA256 and SHA3-512 setup variants have approximately constant gas as guardian count grows because only the fixed-size root is stored on-chain. The paper also reports other security features, biometric operations, individual-hash variants, and recovery gas; those are not numerical inputs to this baseline.

No guessed points digitized from Figure 9 are used as raw data.

## B. Paper-Guided Reimplementation

This project implements only the disclosed setup/anchoring path:

```text
Synthetic Secret Recovery Key
  -> Shamir shares
  -> SHA-256 share leaves
  -> ordered, last-leaf-padded Merkle tree
  -> Merkle root
  -> one transaction storing PBK + root
```

Its primary metric is the mined setup transaction's receipt `gasUsed`. It runs in the frozen Hardhat environment, not a claimed reconstruction of the paper's undisclosed environment. Its absolute gas includes responsibility for PBK plus root and therefore must not be used for an automatic absolute-efficiency claim against a root-only contract.

## C. Our Frozen Experiment

- `OUR_MERKLE_ROOT_ANCHORING`: one Merkle-root anchoring transaction; scope is root anchoring only.
- `OUR_PER_SHARE_ANCHORING`: `n` share-hash anchoring transactions.
- Main gas source: frozen `results/main/main_raw.csv`, represented through the validated final-statistics files.
- Recovery is outside the Pedin common comparison because the metrics and on-/off-chain responsibilities differ.

## Permitted comparison

The common grid `n=10,20,50,100` compares:

1. gas scaling direction;
2. normalized gas growth relative to each mechanism's own `n=10` mean;
3. setup/anchoring transaction count; and
4. explicitly labelled payload scope.

Pedin paper-guided setup stores PBK plus root; our Merkle-Root method anchors only the root; our Per-Share method anchors `n` share hashes. These distinctions must remain visible in every table and plot.

## Excluded claims and comparisons

- No claim of superiority, greater speed, or greater security over Pedin et al.
- No claim that original gas values were reproduced.
- No direct comparison of Pedin recovery gas with our elapsed recovery time.
- No biometric-encryption, guardian-communication, authentication, conspiracy-protection, or asset-transfer benchmark.
- No implication that 192 social guardians and 1000 cryptographic shares are identical deployment models.
