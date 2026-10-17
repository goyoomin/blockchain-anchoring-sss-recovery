# INTCOM/MDPI Experiment Audit

## 감사 결론

- 감사 대상에는 기존 INTCOM 소스가 없었고 기존 파일은 이 감사 문서뿐이었다.
- 사용자 지시에 따라 프로젝트를 `GREENFIELD_V1` 기준선으로 새로 구축했다.
- 따라서 아래 값은 이제 코드로 확정되지만, **기존 INTCOM 구현과의 호환성은 주장하지 않는다**.
- 과거 INTCOM 수치와 직접 비교하려면 당시 소스와 환경을 별도로 확보해 차이를 재감사해야 한다.

## 구현 감사표

| 항목 | 현재 구현 | 파일 위치 | 코드 위치 | MDPI 실험에서 유지 여부 |
|---|---|---|---|---|
| 1. SSS 라이브러리 및 버전 | `secrets.js-grempe` 2.0.0 | `package.json` | dependencies | 고정 |
| 2. threshold k | strict majority: `floor(n/2)+1` | `experiments/config/experimentConfig.js` | `thresholdFor` | 고정 |
| 3. Secret 생성 | Node CSPRNG의 32 random bytes | `experiments/datasets/datasetGenerator.js` | `generateDataset` | 고정 |
| 4. Share 생성 | `secrets.share(secret,n,k)` | 같은 파일 | `generateDataset` | 고정 |
| 5. Share encoding | 라이브러리의 field/header 포함 hexadecimal string | 같은 파일 | `generateDataset` | 고정 |
| 6. Hash | UTF-8 share string의 `keccak256` | `experiments/metrics/hash.js` | `hashShare` | 고정 |
| 7. Solidity 구조 | share mapping, root mapping, read/verify functions | `contracts/WalletRecoveryAnchors.sol` | 전체 contract | 고정 |
| 8. Per-share 저장 | `datasetKey → index → bytes32` mapping | 같은 파일 | `shareAnchors` | 고정 |
| 9. Share당 transaction | 1개 | `experiments/runners/perShareRunner.js` | anchoring loop | 고정 |
| 10. Batch 저장 | 사용하지 않음 | 같은 파일 | anchoring loop | 고정 |
| 11. Merkle 라이브러리 | `merkletreejs` 0.6.0 | `package.json` | dependencies | 고정 |
| 12. Leaf | `keccak256(UTF8(encodedShare))` | `experiments/metrics/merkle.js` | `buildMerkleTree` | 고정 |
| 13. Leaf ordering | 원래 share index 순서, leaf sorting 없음 | 같은 파일 | `sortLeaves:false` | 고정 |
| 14. Pair sorting | 사용 | 같은 파일 | `sortPairs:true` | 고정 |
| 15. Odd node | 복제하지 않고 다음 level로 승격 | 같은 파일 | `duplicateOdd:false` | 고정 |
| 16. Proof 생성 | `MerkleTree.getProof(leaf,index)` | 같은 파일 | `proofFor` | 고정 |
| 17. Proof 검증 | Solidity view call, sorted-pair keccak | contract 및 `merkleRootRunner.js` | `verifyMerkleProof` | 고정 |
| 18. Gas 측정 | transaction receipt의 실제 `gasUsed` | `experiments/metrics/gasCollector.js` | `requireReceiptGas` | 고정 |
| 19. Deployment gas | 별도 저장, primary에는 미포함 | `experimentRunner.js` | `deployFreshContract`, row mapping | 고정 |
| 20. Primary gas | anchoring transaction gas만 사용 | 같은 파일 | `primary_gas_used` | 고정 |
| 21. 복수 transaction 합계 | 모든 성공 receipt를 `BigInt`로 합산 | `gasCollector.js` | `sumGas` | 고정 |
| 22. Recovery timer 시작 | 복구용 dataset load 직전 | 각 mechanism runner | `recoveryStart` | 고정 |
| 23. Recovery timer 종료 | secret 일치 확인 후 | 각 mechanism runner | `elapsedMs(recoveryStart)` | 고정 |
| 24. Blockchain query | 포함 | 각 mechanism runner | `query` 측정 | 고정 |
| 25. Share verification | 포함 | `perShareRunner.js` | `verification` | 고정 |
| 26. Merkle verification | proof 생성 및 contract view 검증 포함 | `merkleRootRunner.js` | proof/verification 측정 | 고정 |
| 27. SSS reconstruction | 포함 | 각 mechanism runner | `reconstruction` | 고정 |
| 28. Hardhat | 2.29.0 | `package.json` | devDependencies | 고정 |
| 29. ethers.js | 6.17.0 | `package.json` | dependencies | 고정 |
| 30. Solidity | 0.8.24 | contract/config | pragma/compiler | 고정 |
| 31. Compiler | pinned local `solc-js` 0.8.24 | `hardhat.config.js` | compiler subtask | 고정 |
| 32. Optimizer | disabled; runs 값 200은 비활성 상태 | 같은 파일 | optimizer settings | 고정 |
| 33. Block gas limit | 30,000,000 | 같은 파일 | hardhat network | 고정 |
| 34. Node.js | `>=20`; 실제 버전은 실행 시 freeze | `package.json`, `results/environment.json` | engines/environment | freeze 후 고정 |

## Dataset 및 재현성

- 동일 `dataset_id` 파일을 두 mechanism이 다시 읽는다.
- dataset에는 synthetic secret, 정확한 shares, `n`, `k`, SSS field bits와 SHA-256 digest가 저장된다.
- seed 문자열은 provenance용이다. `secrets.js-grempe`의 암호학적 RNG를 deterministic RNG로 교체하지 않는다.
- 재현은 seed가 아니라 보존된 dataset 파일로 보장한다.
- dataset secret은 연구용 합성 키이며 실제 wallet key를 사용해서는 안 된다.

## Greenfield 기준선의 한계

기존 INTCOM threshold, transaction 구조, timer 범위, optimizer 및 Merkle 규칙을 복원한 것이 아니다. 새 결과는 본 저장소의 동결된 기준선 안에서는 재현 가능하지만, INTCOM 결과와 직접 비교 가능한지 여부는 `UNKNOWN`이다.
