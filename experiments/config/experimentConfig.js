const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

const experimentConfig = Object.freeze({
  mainNValues: Object.freeze([5, 10, 20, 50, 100, 500, 1000]),
  repetitions: 30,
  pilotNValues: Object.freeze([5, 50, 1000]),
  pilotRepetitions: 3,
  pedinNValues: Object.freeze([5, 10, 20, 50]),
  pedinRepetitions: 30,
  mechanisms: Object.freeze(["PER_SHARE", "MERKLE_ROOT"]),
  pedinMechanisms: Object.freeze([
    "PEDIN_INDIVIDUAL_HASH",
    "PEDIN_MERKLE_TREE",
  ]),
  thresholdPolicy: "STRICT_MAJORITY",
  hashAlgorithm: "KECCAK256",
  solidityVersion: "0.8.24",
  optimizerEnabled: false,
  optimizerRuns: 200,
  blockGasLimit: 30_000_000,
  chainId: 31337,
  paths: Object.freeze({
    root: ROOT,
    datasets: path.join(ROOT, "results", "datasets"),
    pilotRaw: path.join(ROOT, "results", "pilot", "pilot_raw.csv"),
    mainRaw: path.join(ROOT, "results", "main", "main_raw.csv"),
    mainTransactions: path.join(ROOT, "results", "main", "transactions"),
    pedinRaw: path.join(ROOT, "results", "pedin", "pedin_raw.csv"),
    environment: path.join(ROOT, "results", "environment.json"),
    summary: path.join(ROOT, "results", "summary"),
    recoveryValidation: path.join(ROOT, "results", "recovery_validation"),
    recoveryValidationRaw: path.join(
      ROOT, "results", "recovery_validation", "recovery_counterbalanced_raw.csv",
    ),
    recoveryValidationSanityRaw: path.join(
      ROOT, "results", "recovery_validation", "recovery_sanity_raw.csv",
    ),
  }),
});

function thresholdFor(n) {
  if (!Number.isInteger(n) || n < 2 || n > 1000) {
    throw new RangeError("n must be an integer from 2 through 1000");
  }
  return Math.floor(n / 2) + 1;
}

module.exports = { experimentConfig, thresholdFor };
