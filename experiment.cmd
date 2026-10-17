@echo off
setlocal
set "NODE_DIR=%~dp0.portable-node\node-v22.23.1-win-x64"
set "NODE=%NODE_DIR%\node.exe"
set "NPM=%NODE_DIR%\npm.cmd"
set "PATH=%NODE_DIR%;%PATH%"

if not exist "%NPM%" (
  echo Portable npm was not found at "%NPM%" 1>&2
  exit /b 1
)

if "%~1"=="" (
  echo Usage: .\experiment.cmd ^<audit^|single^|pilot^|main^|per-share^|merkle^|resume^|summary^|pedin^|validate^|recovery-sanity^|recovery-validation^|recovery-validate^|recovery-summary^|freeze^|freeze-validate^|final-statistics^|final-statistics-validate^|publication-assets^|publication-assets-validate^|publication-assets-pedin^|publication-assets-pedin-validate^|pedin-test^|pedin-sanity^|pedin-sanity-validate^|pedin-baseline^|pedin-validate^|pedin-summary^|pedin-freeze^|test^|compile^> 1>&2
  exit /b 2
)

if /i "%~1"=="publication-assets-pedin" goto publication_assets_pedin
if /i "%~1"=="publication-assets-pedin-validate" goto publication_assets_pedin_validate
if /i "%~1"=="publication-assets-validate" goto publication_assets_pedin_validate
if /i "%~1"=="pedin-test" goto pedin_test
if /i "%~1"=="pedin-sanity" goto pedin_sanity
if /i "%~1"=="pedin-sanity-validate" goto pedin_sanity_validate
if /i "%~1"=="pedin-baseline" goto pedin_baseline
if /i "%~1"=="pedin-validate" goto pedin_validate
if /i "%~1"=="pedin-summary" goto pedin_summary
if /i "%~1"=="pedin-freeze" goto pedin_freeze
if /i "%~1"=="test" goto direct
if /i "%~1"=="compile" goto direct
call "%NPM%" run "experiment:%~1"
exit /b %ERRORLEVEL%

:direct
call "%NPM%" run "%~1"
exit /b %ERRORLEVEL%

:pedin_test
call "%NODE%" "%~dp0node_modules\hardhat\internal\cli\bootstrap.js" run "comparisons\pedin_2023\entrypoints\source-fidelity-test.js"
exit /b %ERRORLEVEL%

:pedin_sanity
call "%NODE%" "%~dp0node_modules\hardhat\internal\cli\bootstrap.js" run "comparisons\pedin_2023\entrypoints\sanity.js"
exit /b %ERRORLEVEL%

:pedin_sanity_validate
call "%NODE%" -e "const v=require('./comparisons/pedin_2023/validation/pedinValidation').validateSanity(); require('./comparisons/pedin_2023/validation/pedinValidation').printValidation(v,'Pedin Sanity'); if(!v.valid)process.exitCode=1"
exit /b %ERRORLEVEL%

:pedin_baseline
call "%NODE%" "%~dp0node_modules\hardhat\internal\cli\bootstrap.js" run "comparisons\pedin_2023\entrypoints\baseline.js"
exit /b %ERRORLEVEL%

:pedin_validate
call "%NODE%" "comparisons\pedin_2023\entrypoints\validate.js"
exit /b %ERRORLEVEL%

:pedin_summary
call "%NODE%" "comparisons\pedin_2023\entrypoints\summary.js"
exit /b %ERRORLEVEL%

:pedin_freeze
call "%NODE%" "comparisons\pedin_2023\entrypoints\freeze.js"
exit /b %ERRORLEVEL%

:publication_assets_pedin
call "%NODE%" "comparisons\pedin_2023\entrypoints\publication-assets.js"
exit /b %ERRORLEVEL%

:publication_assets_pedin_validate
call "%NODE%" "comparisons\pedin_2023\entrypoints\publication-assets-validate.js"
exit /b %ERRORLEVEL%
