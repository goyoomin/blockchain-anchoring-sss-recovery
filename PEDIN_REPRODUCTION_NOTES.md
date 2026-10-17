# Pedin Reproduction Notes

## Status

Pedin 논문 원문, 저자 코드 및 기존 재현 코드가 이 작업공간에 제공되지 않았다. 따라서 이 모듈은 **Pedin 전체 social-recovery protocol의 reproduction이 아니다**. `PEDIN_*` 명칭은 공통 anchoring 영역만 분리해서 측정하는 structural placeholder다.

| 구분 | 내용 |
|---|---|
| Original Paper Behavior | 제공 자료가 없어 `UNKNOWN` |
| Reproduced Behavior | 동일 greenfield SSS dataset을 individual hash transactions 또는 single Merkle root transaction으로 anchoring |
| Difference | guardian, authorization, wallet recovery state machine 등 Pedin 고유 protocol은 구현하지 않음 |
| Reason | 확인되지 않은 protocol을 추측하거나 논문 gas 수치에 맞추지 않기 위함 |
| Expected Impact | 공통 anchoring 구조의 내부 비교만 가능하며 Pedin 논문 수치와 직접 비교 불가 |

`npm run experiment:pedin`은 n=5,10,20,50을 각각 30회 실행하고 `results/pedin/pedin_raw.csv`에 분리 저장한다. 이 결과를 “Pedin wallet recovery gas”로 표기하면 안 된다. 논문/공식 구현이 제공되면 이 모듈을 먼저 재감사한 뒤 명칭과 비교 범위를 갱신해야 한다.
