const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const PAPER_GRID = Object.freeze([2, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192]);
const COMMON_COMPARISON_GRID = Object.freeze([10, 20, 50, 100]);
const REPETITIONS = 30;
const VARIANT = "PEDIN_MERKLE_SHA256_PAPER_GUIDED";

const paths = Object.freeze({
  root: ROOT,
  resultRoot: path.join(ROOT, "results", "pedin_baseline"),
  datasets: path.join(ROOT, "results", "pedin_baseline", "datasets"),
  raw: path.join(ROOT, "results", "pedin_baseline", "pedin_raw.csv"),
  sanityRoot: path.join(ROOT, "results", "pedin_baseline", "sanity"),
  sanityDatasets: path.join(ROOT, "results", "pedin_baseline", "sanity", "datasets"),
  sanityRaw: path.join(ROOT, "results", "pedin_baseline", "sanity", "pedin_sanity_raw.csv"),
  sanityValidation: path.join(ROOT, "results", "pedin_baseline", "sanity", "pedin_sanity_validation.json"),
  readyMarker: path.join(ROOT, "results", "pedin_baseline", "sanity", "PEDIN_BASELINE_READY.json"),
  environment: path.join(ROOT, "results", "pedin_baseline", "environment.json"),
  analysis: path.join(ROOT, "results", "pedin_baseline", "analysis"),
  freeze: path.join(ROOT, "results", "pedin_baseline", "final_freeze"),
  mainRaw: path.join(ROOT, "results", "main", "main_raw.csv"),
  recoveryRaw: path.join(ROOT, "results", "recovery_validation", "recovery_counterbalanced_raw.csv"),
  frozenEnvironment: path.join(ROOT, "results", "environment.json"),
  finalGasComparison: path.join(ROOT, "results", "analysis", "final_statistics", "final_gas_comparison.csv"),
  finalTransactionCount: path.join(ROOT, "results", "analysis", "final_statistics", "final_transaction_count.csv"),
  contract: path.join(ROOT, "contracts", "baselines", "PedinPaperGuidedSetup.sol"),
  merkleSource: path.join(ROOT, "comparisons", "pedin_2023", "merkle", "pedinMerkleSha256.js"),
});

function thresholdFor(n) {
  if (!Number.isInteger(n) || n < 2 || n > 1000) throw new RangeError("n must be an integer from 2 through 1000");
  return Math.floor(n / 2) + 1;
}

function nextPowerOfTwo(n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("n must be a positive integer");
  let value = 1;
  while (value < n) value *= 2;
  return value;
}

function gridRows() {
  return [
    ...PAPER_GRID.map((n) => ({ grid_type: "PAPER_GRID", n })),
    ...COMMON_COMPARISON_GRID.map((n) => ({ grid_type: "COMMON_COMPARISON_GRID", n })),
  ];
}

module.exports = {
  ROOT,
  PAPER_GRID,
  COMMON_COMPARISON_GRID,
  REPETITIONS,
  VARIANT,
  paths,
  thresholdFor,
  nextPowerOfTwo,
  gridRows,
};
