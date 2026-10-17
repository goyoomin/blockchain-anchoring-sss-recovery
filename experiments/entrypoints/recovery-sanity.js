const path = require("path");
const hre = require("hardhat");
const { experimentConfig } = require("../config/experimentConfig");
const { execute } = require("./_run");
const { snapshotRecoveryEnvironment } = require("../recoveryValidation/environment");
const { fileIdentity, writeIntegrityReport } = require("../recoveryValidation/integrity");
const { runRecoverySchedule } = require("../recoveryValidation/runner");
const { validateRecoveryRows } = require("../recoveryValidation/validate");

async function run() {
  const target = path.join(experimentConfig.paths.recoveryValidation, "main_data_integrity.json");
  const before = fileIdentity(experimentConfig.paths.mainRaw);
  writeIntegrityReport(target, before);
  let operationError = null;
  try {
    const environment = await snapshotRecoveryEnvironment(hre);
    await runRecoverySchedule(hre, {
      environment,
      rawPath: experimentConfig.paths.recoveryValidationSanityRaw,
      nValues: [5],
      repetitions: 2,
      useWarmUp: false,
    });
    const result = validateRecoveryRows(experimentConfig.paths.recoveryValidationSanityRaw,
      { nValues: [5], repetitions: 2, requireSuccess: true });
    process.stdout.write(`[Recovery Validation] sanity passed (${result.actual_rows} rows)\n`);
  } catch (error) {
    operationError = error;
  } finally {
    const report = writeIntegrityReport(target, before, fileIdentity(experimentConfig.paths.mainRaw));
    if (!report.unchanged) throw new Error("Main raw data changed during sanity check");
  }
  if (operationError) throw operationError;
}

execute(run);
