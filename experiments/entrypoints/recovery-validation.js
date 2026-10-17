const path = require("path");
const hre = require("hardhat");
const { experimentConfig } = require("../config/experimentConfig");
const { execute } = require("./_run");
const { snapshotRecoveryEnvironment } = require("../recoveryValidation/environment");
const { fileIdentity, writeIntegrityReport } = require("../recoveryValidation/integrity");
const { runRecoverySchedule } = require("../recoveryValidation/runner");
const { validateRecoveryRows } = require("../recoveryValidation/validate");

const integrityPath = path.join(
  experimentConfig.paths.recoveryValidation,
  "main_data_integrity.json",
);

async function run() {
  const before = fileIdentity(experimentConfig.paths.mainRaw);
  writeIntegrityReport(integrityPath, before);
  let operationError = null;
  try {
    const environment = await snapshotRecoveryEnvironment(hre);

    // The full experiment is gated by a two-dataset, counterbalanced sanity run.
    await runRecoverySchedule(hre, {
      environment,
      rawPath: experimentConfig.paths.recoveryValidationSanityRaw,
      nValues: [5],
      repetitions: 2,
      useWarmUp: false,
    });
    const sanity = validateRecoveryRows(
      experimentConfig.paths.recoveryValidationSanityRaw,
      { nValues: [5], repetitions: 2, requireSuccess: true },
    );
    process.stdout.write(
      `[Recovery Validation] sanity passed: ${sanity.actual_rows} rows, ` +
      `${sanity.actual_unique_datasets} paired datasets\n`,
    );

    await runRecoverySchedule(hre, { environment });
  } catch (error) {
    operationError = error;
  } finally {
    const after = fileIdentity(experimentConfig.paths.mainRaw);
    const integrity = writeIntegrityReport(integrityPath, before, after);
    if (!integrity.unchanged) {
      throw new Error("Main raw data changed during Recovery Validation");
    }
  }
  if (operationError) throw operationError;
}

execute(run);
