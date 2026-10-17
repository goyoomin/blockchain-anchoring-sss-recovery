const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_ROOT = path.join(ROOT, "results", "publication_assets");
const FIGURE_ROOT = path.join(OUTPUT_ROOT, "figures");
const TABLE_ROOT = path.join(OUTPUT_ROOT, "tables");
const CAPTION_ROOT = path.join(OUTPUT_ROOT, "captions");
const MANIFEST_ROOT = path.join(OUTPUT_ROOT, "manifest");
const DOCUMENTATION_ROOT = path.join(OUTPUT_ROOT, "documentation");

const paths = Object.freeze({
  root: ROOT,
  outputRoot: OUTPUT_ROOT,
  figureRoot: FIGURE_ROOT,
  tableRoot: TABLE_ROOT,
  captionRoot: CAPTION_ROOT,
  manifestRoot: MANIFEST_ROOT,
  documentationRoot: DOCUMENTATION_ROOT,
  manifest: path.join(MANIFEST_ROOT, "publication_assets_manifest.json"),
  existingSnapshot: path.join(MANIFEST_ROOT, "existing_assets_pre_pedin.json"),
  validation: path.join(MANIFEST_ROOT, "pedin_publication_assets_validation.json"),
  overview: path.join(OUTPUT_ROOT, "PUBLICATION_ASSETS_OVERVIEW.md"),
  figureCaptions: path.join(CAPTION_ROOT, "figure_captions.md"),
  tableCaptions: path.join(CAPTION_ROOT, "table_captions.md"),
  interpretation: path.join(DOCUMENTATION_ROOT, "PEDIN_PUBLICATION_INTERPRETATION.md"),
  pedinRoot: path.join(ROOT, "results", "pedin_baseline"),
  pedinRaw: path.join(ROOT, "results", "pedin_baseline", "pedin_raw.csv"),
  pedinFreeze: path.join(ROOT, "results", "pedin_baseline", "final_freeze", "pedin_freeze_manifest.json"),
  pedinFreezeHashes: path.join(ROOT, "results", "pedin_baseline", "final_freeze", "file_hashes.csv"),
  paperStats: path.join(ROOT, "results", "pedin_baseline", "analysis", "pedin_paper_grid_statistics.csv"),
  commonStats: path.join(ROOT, "results", "pedin_baseline", "analysis", "pedin_common_grid_statistics.csv"),
  scalability: path.join(ROOT, "results", "pedin_baseline", "analysis", "pedin_scalability_analysis.csv"),
  commonComparison: path.join(ROOT, "results", "pedin_baseline", "analysis", "pedin_common_grid_comparison.csv"),
  normalized: path.join(ROOT, "results", "pedin_baseline", "analysis", "pedin_normalized_scalability.csv"),
  feasibility: path.join(ROOT, "results", "pedin_baseline", "analysis", "pedin_execution_feasibility.csv"),
  baselineAnalysis: path.join(ROOT, "results", "pedin_baseline", "analysis", "PEDIN_BASELINE_ANALYSIS.md"),
  methodFidelity: path.join(ROOT, "results", "pedin_baseline", "analysis", "PEDIN_METHOD_FIDELITY.md"),
  sourceAudit: path.join(ROOT, "comparisons", "pedin_2023", "documentation", "PEDIN_SOURCE_AUDIT.md"),
  assumptionRegister: path.join(ROOT, "comparisons", "pedin_2023", "documentation", "PEDIN_ASSUMPTION_REGISTER.md"),
  finalGasComparison: path.join(ROOT, "results", "analysis", "final_statistics", "final_gas_comparison.csv"),
  finalTransactionCount: path.join(ROOT, "results", "analysis", "final_statistics", "final_transaction_count.csv"),
  mainRaw: path.join(ROOT, "results", "main", "main_raw.csv"),
  recoveryRaw: path.join(ROOT, "results", "recovery_validation", "recovery_counterbalanced_raw.csv"),
  script: path.join(ROOT, "comparisons", "pedin_2023", "publication", "pedinPublicationAssets.js"),
});

const EXPECTED_HASHES = Object.freeze({
  pedin: "c012463d35fc5a0121806aa6b6bb0b355f5e46d40ed3c7eaa4fbd2322bd0999e",
  main: "a81e49c2a3a2730a5157aa39352c0ff28a00fe283fde630db89ef47827dfaf5d",
  recovery: "bc5d4499d383faf405547ad4fdda013796f2bc73fc6efe39ef386a0fc03df942",
});

const PAPER_N = Object.freeze([2, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192]);
const COMMON_N = Object.freeze([10, 20, 50, 100]);
const VARIANTS = Object.freeze(["single", "double"]);
const FORMATS = Object.freeze(["png", "svg", "pdf"]);
const DIMENSIONS = Object.freeze({
  single: Object.freeze({ width: 1016, height: 780 }),
  double: Object.freeze({ width: 2100, height: 1200 }),
});

const EXISTING_FIGURE_IDS = Object.freeze([
  "figure1_gas_linear", "figure1_gas_log", "figure2_recovery_time",
  "figure3_transaction_count", "figure4_gas_reduction",
  "figure5_recovery_components_full", "figure5_recovery_components_representative",
  "appendix_figure_a_recovery_paired_delta",
]);
const EXISTING_TABLE_IDS = Object.freeze([
  "table1_experimental_configuration", "table2_anchoring_gas", "table3_recovery_time",
  "table4_transactions_feasibility", "table5_recovery_components", "table_s1_recovery_components_full",
]);

module.exports = {
  ROOT, paths, EXPECTED_HASHES, PAPER_N, COMMON_N, VARIANTS, FORMATS, DIMENSIONS,
  EXISTING_FIGURE_IDS, EXISTING_TABLE_IDS,
};
