# Experiment Commands

PowerShell 기준이다. 이 프로젝트의 Node.js는 portable 설치이므로 새 PowerShell을 열면 먼저 다음 중 하나를 사용한다.

PATH 설정 없이 launcher 사용:

```powershell
.\experiment.cmd test
.\experiment.cmd audit
.\experiment.cmd pilot
.\experiment.cmd validate
```

`.cmd` launcher는 PowerShell execution policy의 영향을 받지 않는다. 또는 현재 PowerShell 세션에 Node/npm을 활성화한다.

```powershell
$env:Path = "$PWD\.portable-node\node-v22.23.1-win-x64;$env:Path"
```

그 후 표준 `npm` 명령을 사용할 수 있다. 사용자 PATH가 등록된 뒤 새 PowerShell을 열면 위 활성화 명령은 필요 없다.

```powershell
npm run compile
npm test
npm run experiment:audit
```

단일 sanity run:

```powershell
$env:EXPERIMENT_N='5'; npm run experiment:single
$env:EXPERIMENT_N='50'; npm run experiment:single
$env:EXPERIMENT_N='1000'; npm run experiment:single
Remove-Item Env:EXPERIMENT_N
```

정식 실행:

```powershell
npm run experiment:pilot
npm run experiment:validate
npm run experiment:main
npm run experiment:summary
npm run experiment:pedin
```

Mechanism별 main 실행 및 안전한 재개:

```powershell
npm run experiment:per-share
npm run experiment:merkle
npm run experiment:resume
```

Main 또는 Pedin raw validation:

```powershell
$env:RESULTS_SCOPE='main'; npm run experiment:validate
$env:RESULTS_SCOPE='pedin'; npm run experiment:validate
Remove-Item Env:RESULTS_SCOPE
```

명시적 재시도는 기존 행을 대체하지 않는다.

```powershell
$env:EXPERIMENT_ATTEMPT='2'; npm run experiment:resume
Remove-Item Env:EXPERIMENT_ATTEMPT
```

실험환경을 의도적으로 변경한 경우 먼저 변경 사유를 연구 기록에 남긴 후에만 다음 override를 한 번 사용한다.

```powershell
$env:ALLOW_ENVIRONMENT_MISMATCH='1'; npm run experiment:audit
Remove-Item Env:ALLOW_ENVIRONMENT_MISMATCH
```

결과 위치:

- `results/environment.json`
- `results/pilot/pilot_raw.csv`
- `results/pilot/single_raw.csv`
- `results/main/main_raw.csv`
- `results/main/transactions/*.jsonl`
- `results/pedin/pedin_raw.csv`
- `results/summary/{gas,recovery,feasibility}_summary.csv`
# Recovery-time counterbalanced validation

## Final MDPI freeze

## Final frozen statistics

## MDPI publication figures and tables

Generate publication figures, tables, captions, and manifests from Final Statistics only:

```powershell
.\experiment.cmd publication-assets
```

Validate all source hashes, plotted-data digests, table values, formats, and 300 dpi metadata:

```powershell
.\experiment.cmd publication-assets-validate
```


Generate the MDPI statistics from the two frozen Raw CSV inputs only:

```powershell
.\experiment.cmd final-statistics
```

Validate source hashes, output hashes, row structure, and Raw immutability:

```powershell
.\experiment.cmd final-statistics-validate
```


Create the read-only hash/validation manifest without executing Hardhat experiments:

```powershell
.\experiment.cmd freeze
```

Recheck the frozen inputs and manifests without rewriting them:

```powershell
.\experiment.cmd freeze-validate
```

After review, a Git commit/tag may be created manually. The freeze command never commits or tags.


Run the required two-dataset sanity gate only:

```powershell
.\experiment.cmd recovery-sanity
```

Run/resume the 420-row counterbalanced validation (the sanity gate runs first):

```powershell
.\experiment.cmd recovery-validation
```

Validate exact row, pairing, digest, sequence, and position balance:

```powershell
.\experiment.cmd recovery-validate
```

Generate descriptive, paired, order-effect, Main-comparison, and Markdown outputs:

```powershell
.\experiment.cmd recovery-summary
```
