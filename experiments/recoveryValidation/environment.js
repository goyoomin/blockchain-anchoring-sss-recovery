const fs = require("fs");
const path = require("path");
const {
  collectEnvironment,
  CRITICAL_ENVIRONMENT_FIELDS,
} = require("../audit/environment");
const { experimentConfig } = require("../config/experimentConfig");

async function snapshotRecoveryEnvironment(hre) {
  const current = await collectEnvironment(hre);
  const main = JSON.parse(fs.readFileSync(experimentConfig.paths.environment, "utf8"));
  const differences = CRITICAL_ENVIRONMENT_FIELDS
    .filter((field) => String(main[field]) !== String(current[field]))
    .map((field) => ({ field, main: main[field], recovery_validation: current[field] }));
  const snapshot = {
    ...current,
    environment_match: differences.length === 0,
    compared_with: "results/environment.json",
    differences,
  };
  const target = path.join(experimentConfig.paths.recoveryValidation, "environment.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  if (differences.length) {
    process.stderr.write(
      `[Recovery Validation] WARNING environment mismatch: ${differences.map((x) => x.field).join(", ")}\n`,
    );
  }
  return snapshot;
}

module.exports = { snapshotRecoveryEnvironment };
