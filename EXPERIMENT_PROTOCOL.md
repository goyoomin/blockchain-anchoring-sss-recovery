# MDPI Experiment Protocol

## 연구 설계

- Main `n`: 5, 10, 20, 50, 100, 500, 1000
- 반복: 각 조건 30회
- Mechanisms: PER_SHARE, MERKLE_ROOT
- 총 main observations: 420
- Pilot `n`: 5, 50, 1000, 각 3회, 두 mechanisms(총 18)
- Threshold: `floor(n/2)+1`

각 `(scope,n,repetition)`에서 dataset을 한 번만 생성하고 두 mechanism이 같은 파일을 읽는다. mechanism별로 chain reset과 contract deployment를 수행한다. 순서는 PER_SHARE 후 MERKLE_ROOT이며 이 고정 순서가 시간 측정에 줄 수 있는 영향은 연구 한계로 보고한다.

## Run 순서

1. dataset 생성 또는 기존 digest-검증 dataset 재사용
2. `hardhat_reset`
3. contract deployment 및 deployment receipt 수집
4. dataset load와 anchoring
5. anchoring receipt gas 수집
6. recovery timer 시작
7. dataset reload, anchor query, integrity/proof verification, `k`개 선택, SSS 복구
8. recovery timer 종료
9. transaction detail과 raw CSV 기록
10. progress 출력

## 데이터 보호와 실패 처리

- Raw CSV는 append-only이며 summary가 수정하지 않는다.
- deterministic `experiment_id`가 이미 있으면 성공/실패와 무관하게 건너뛴다.
- 실패를 다시 관측하려면 `EXPERIMENT_ATTEMPT=2`처럼 명시적으로 attempt를 올린다.
- 실패 stage, type, message와 실패 전 수집한 transaction count/gas를 가능한 범위에서 저장한다.
- n=500/1000을 자동 축소하거나 gas limit을 자동 변경하지 않는다.
- environment freeze와 다르면 실행을 중단한다. 변경을 문서화한 경우에만 `ALLOW_ENVIRONMENT_MISMATCH=1`을 사용한다.

## 검증 순서

1. `npm test`
2. n=5 single run과 raw 확인
3. n=50 single run과 raw 확인
4. n=1000 single run과 failure/성능 확인
5. pilot 18 observations 실행
6. `results/pilot/pilot_raw.csv` 수동 검토
7. `results/environment.json` 보관
8. main 420 observations 실행
9. Pedin structural baseline 실행
10. summary 생성

Pilot와 single-check CSV는 main summary 입력에 포함되지 않는다.

## Raw Data Schema

필수 식별자·상태, gas, recovery 세부 시간, 환경 버전 외에 `attempt`, `share_load_time_ms`, `merkle_proof_time_ms`를 추가한다. 사용하지 않는 gas/time은 빈 CSV 값이다. Per-share transaction 상세 receipt는 `results/main/transactions/*.jsonl`에 기록한다.
