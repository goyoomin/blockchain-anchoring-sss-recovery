# Metric Definitions

## Gas Used

논문의 primary metric인 `primary_gas_used`는 mechanism별 **anchoring transaction receipt의 `gasUsed` 합계**다.

- PER_SHARE: `anchorShare` receipt `n`개의 합계
- MERKLE_ROOT: `anchorMerkleRoot` receipt 1개의 값
- `deployment_gas`: contract deployment receipt를 별도 기록하며 primary에는 포함하지 않음
- `verification_gas`: 검증이 view/`eth_call`이므로 빈 값
- `recovery_gas`: SSS recovery가 off-chain이므로 빈 값
- `total_transaction_gas`: deployment와 anchoring gas의 합
- `transaction_count`: deployment를 제외한 anchoring transaction 수

Merkle tree와 proof를 만드는 JavaScript 계산은 Ethereum gas가 아니다. 모든 gas 값은 추정값이 아닌 mined transaction receipt에서 직접 읽는다.

## Recovery Time

`process.hrtime.bigint()` monotonic timer를 사용한다. `total_recovery_time_ms`의 경계는 다음과 같다.

1. 복구용 dataset 파일 load 직전에 시작
2. blockchain anchor query
3. share integrity 또는 Merkle proof verification
4. valid share 선택 및 첫 `k`개 선택
5. `secrets.combine` SSS reconstruction
6. 복원 secret 일치 검사가 끝난 직후 종료

포함되는 세부 값:

- `share_load_time_ms`: dataset read, parse, digest/invariant validation
- `blockchain_query_time_ms`: PER_SHARE는 `n`개 anchor query, MERKLE_ROOT는 root query
- `verification_time_ms`: hash 비교 또는 Solidity Merkle proof view calls
- `merkle_proof_time_ms`: MERKLE_ROOT proof 생성; PER_SHARE는 빈 값
- `sss_reconstruction_time_ms`: `k`개 share의 `secrets.combine`

`total_recovery_time_ms`에는 함수 호출과 loop overhead도 있으므로 세부 시간의 단순 합과 정확히 같지 않을 수 있다. CSV 저장, transaction JSONL 저장 및 progress console 출력은 timer가 끝난 후 수행한다.

## Summary Statistics

성공 관측치만 metric 분포에 사용하되 실패 수와 유형은 별도로 보존한다. 분산과 표준편차는 sample 정의(`n-1`)를 사용한다. Q1/Q3는 선형 보간 quantile이며 95% CI는 표본 30 이하에서 Student t critical value, 그보다 큰 경우 1.96을 사용한다. 자동 outlier 제거는 없다.
