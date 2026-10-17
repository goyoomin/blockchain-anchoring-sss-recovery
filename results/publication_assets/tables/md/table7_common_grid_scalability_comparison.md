# Table 7. Common-Grid Gas Scalability Comparison

| n | Mechanism | Mean Gas Used | Normalized Gas | Transaction Count | On-Chain Scope |
| --- | --- | --- | --- | --- | --- |
| 10 | Pedin Paper-Guided | 66829.4 | 1.000 | 1 | Recovery address + Merkle root |
| 10 | Merkle-Root | 46540.0 | 1.000 | 1 | Merkle root |
| 10 | Per-Share | 474705.2 | 1.000 | 10 | n share hashes |
| 20 | Pedin Paper-Guided | 66828.6 | 1.000 | 1 | Recovery address + Merkle root |
| 20 | Merkle-Root | 46538.0 | 1.000 | 1 | Merkle root |
| 20 | Per-Share | 949374.0 | 2.000 | 20 | n share hashes |
| 50 | Pedin Paper-Guided | 66828.2 | 1.000 | 1 | Recovery address + Merkle root |
| 50 | Merkle-Root | 46536.4 | 1.000 | 1 | Merkle root |
| 50 | Per-Share | 2373472.8 | 5.000 | 50 | n share hashes |
| 100 | Pedin Paper-Guided | 66828.2 | 1.000 | 1 | Recovery address + Merkle root |
| 100 | Merkle-Root | 46536.0 | 1.000 | 1 | Merkle root |
| 100 | Per-Share | 4746793.2 | 9.999 | 100 | n share hashes |

*Note.* Each mechanism is normalized to its own n=10 mean. The scopes differ, so absolute gas values are not interpreted as an efficiency ranking.
