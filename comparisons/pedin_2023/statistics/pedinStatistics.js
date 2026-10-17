const fs = require("fs");
const path = require("path");
const { paths, PAPER_GRID, COMMON_COMPARISON_GRID } = require("../config/pedinConfig");
const { readCsvObjects, writeCsv } = require("../metrics/pedinIo");
const { validateFull } = require("../validation/pedinValidation");
const { createPedinFigures } = require("./pedinPublication");

const T_95_DF29 = 2.045229642132703;

function quantile(sorted, p) {
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function describe(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { count: 0, mean_setup_gas: null, sample_sd: null, variance: null, median: null,
    q1: null, q3: null, iqr: null, minimum: null, maximum: null, standard_error: null,
    ci95_lower: null, ci95_upper: null };
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.length > 1
    ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sorted.length - 1) : 0;
  const sd = Math.sqrt(variance);
  const standardError = sd / Math.sqrt(sorted.length);
  const margin = sorted.length === 30 ? T_95_DF29 * standardError : 1.96 * standardError;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return { count: sorted.length, mean_setup_gas: mean, sample_sd: sd, variance, median: quantile(sorted, 0.5),
    q1, q3, iqr: q3 - q1, minimum: sorted[0], maximum: sorted[sorted.length - 1],
    standard_error: standardError, ci95_lower: mean - margin, ci95_upper: mean + margin };
}

function gridStatistics(rows, gridType, nValues) {
  return nValues.map((n) => {
    const condition = rows.filter((row) => row.grid_type === gridType && Number(row.n) === n);
    const success = condition.filter((row) => row.setup_success === "true" && row.readback_success === "true" && row.all_proofs_valid === "true");
    return {
      grid_type: gridType, n, k: Number(condition[0]?.k), executions: condition.length,
      success_count: success.length, failure_count: condition.length - success.length,
      ...describe(success.map((row) => row.setup_gas_used)),
    };
  });
}

function regressionSlope(rows) {
  const xMean = rows.reduce((sum, row) => sum + row.n, 0) / rows.length;
  const yMean = rows.reduce((sum, row) => sum + row.mean_setup_gas, 0) / rows.length;
  const numerator = rows.reduce((sum, row) => sum + (row.n - xMean) * (row.mean_setup_gas - yMean), 0);
  const denominator = rows.reduce((sum, row) => sum + (row.n - xMean) ** 2, 0);
  return numerator / denominator;
}

function scalability(paper) {
  const means = paper.map((row) => row.mean_setup_gas);
  const minimum = Math.min(...means);
  const maximum = Math.max(...means);
  return [{
    grid_type: "PAPER_GRID",
    minimum_mean_gas: minimum,
    maximum_mean_gas: maximum,
    absolute_range_gas: maximum - minimum,
    relative_range_percent: ((maximum - minimum) / minimum) * 100,
    linear_regression_slope_gas_per_guardian: regressionSlope(paper),
    interpretation_basis: "DESCRIPTIVE_SCALING_PATTERN_NOT_P_VALUE",
  }];
}

function commonComparison(common) {
  const gas = readCsvObjects(paths.finalGasComparison);
  const tx = readCsvObjects(paths.finalTransactionCount);
  const output = [];
  for (const n of COMMON_COMPARISON_GRID) {
    const pedin = common.find((row) => row.n === n);
    const ours = gas.find((row) => Number(row.n) === n);
    const transactions = tx.find((row) => Number(row.n) === n);
    output.push(
      { n, mechanism: "PEDIN_PAPER_GUIDED_SETUP", scope: "PBK + Merkle Root Setup", mean_gas: pedin.mean_setup_gas,
        sd: pedin.sample_sd, ci95_lower: pedin.ci95_lower, ci95_upper: pedin.ci95_upper, transaction_count: 1 },
      { n, mechanism: "OUR_MERKLE_ROOT_ANCHORING", scope: "Merkle Root Anchoring only", mean_gas: Number(ours.merkle_root_mean_gas),
        sd: Number(ours.merkle_root_sd), ci95_lower: Number(ours.merkle_root_ci_lower), ci95_upper: Number(ours.merkle_root_ci_upper),
        transaction_count: Number(transactions.merkle_root_transaction_count) },
      { n, mechanism: "OUR_PER_SHARE_ANCHORING", scope: "n Share-Hash Anchor Transactions", mean_gas: Number(ours.per_share_mean_gas),
        sd: Number(ours.per_share_sd), ci95_lower: Number(ours.per_share_ci_lower), ci95_upper: Number(ours.per_share_ci_upper),
        transaction_count: Number(transactions.per_share_transaction_count) },
    );
  }
  const bases = new Map(output.filter((row) => row.n === 10).map((row) => [row.mechanism, row.mean_gas]));
  return output.map((row) => ({ ...row, normalized_gas_n10_equals_1: row.mean_gas / bases.get(row.mechanism) }));
}

function markdownTable(headers, rows) {
  return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n` +
    rows.map((row) => `| ${row.join(" | ")} |`).join("\n") + "\n";
}

function createDocuments(paper, common, comparison, scale) {
  const analysis = `# Pedin Paper-Guided Baseline Analysis\n\n` +
    `This report summarizes the paper-guided Merkle-SHA256 setup. It is not an exact reproduction. All ${paper.reduce((s, r) => s + r.executions, 0) + common.reduce((s, r) => s + r.executions, 0)} rows are retained; no outlier was removed.\n\n` +
    `## Paper-grid scalability\n\nMean setup gas ranges from ${scale[0].minimum_mean_gas} to ${scale[0].maximum_mean_gas} gas, ` +
    `an absolute range of ${scale[0].absolute_range_gas} gas (${scale[0].relative_range_percent}% relative to the minimum). ` +
    `The descriptive slope is ${scale[0].linear_regression_slope_gas_per_guardian} gas per additional guardian. ` +
    `This slope is used to characterize the fixed-size setup pattern, not as a regression-significance claim.\n\n` +
    `## Common-grid interpretation\n\nNormalized growth removes each contract's different fixed overhead by setting its own n=10 mean to 1.0. ` +
    `Pedin paper-guided setup stores PBK plus a Merkle root, our Merkle-Root mechanism anchors a root only, and our Per-Share mechanism sends n share-hash transactions. Absolute-gas superiority is therefore not inferred.\n`;
  fs.writeFileSync(path.join(paths.analysis, "PEDIN_BASELINE_ANALYSIS.md"), analysis, "utf8");
  const fidelity = `# Pedin Method Fidelity\n\n` +
    `The implementation follows the paper-disclosed Shamir/Merkle-SHA256 setup structure, ordered left/right parent hashing, last-leaf padding, proof construction, and one PBK-plus-root setup transition. ` +
    `Undisclosed software, serialization, contract-layout, deployment-accounting, repetition, and environment choices remain controlled assumptions documented in the Source Audit and Assumption Register. ` +
    `No gas coordinates were guessed from Figure 9, and agreement is assessed only at the qualitative scaling-pattern level.\n`;
  fs.writeFileSync(path.join(paths.analysis, "PEDIN_METHOD_FIDELITY.md"), fidelity, "utf8");

  const table1 = `# Table P1 — Pedin Reimplementation Assumptions\n\n` + markdownTable(
    ["Item", "Classification", "Implementation"], [
      ["Shamir threshold and k=n/2+1", "PAPER_EXPLICIT", "secrets.js-grempe 2.0.0"],
      ["Merkle SHA256", "PAPER_EXPLICIT", "SHA256 over UTF-8 encoded shares"],
      ["SSS library and serialization", "CONTROLLED_ASSUMPTION", "Canonical library share string, UTF-8"],
      ["Compiler and optimizer", "CONTROLLED_ASSUMPTION", "solc 0.8.24, optimizer disabled"],
      ["Deployment gas", "CONTROLLED_ASSUMPTION", "Recorded separately from setup receipt gas"],
    ]);
  const table2 = `# Table P2 — Pedin Paper Grid Results\n\n` + markdownTable(
    ["n", "k", "Mean setup gas", "SD", "95% CI"], paper.map((r) => [r.n, r.k, r.mean_setup_gas, r.sample_sd, `[${r.ci95_lower}, ${r.ci95_upper}]`]));
  const table3 = `# Table P3 — Common-Grid Scalability Comparison\n\n` + markdownTable(
    ["n", "Mechanism", "Mean gas", "Normalized gas", "Transactions", "Scope"],
    comparison.map((r) => [r.n, r.mechanism, r.mean_gas, r.normalized_gas_n10_equals_1, r.transaction_count, r.scope]));
  fs.writeFileSync(path.join(paths.analysis, "TABLE_P1_ASSUMPTIONS.md"), table1, "utf8");
  fs.writeFileSync(path.join(paths.analysis, "TABLE_P2_PAPER_GRID.md"), table2, "utf8");
  fs.writeFileSync(path.join(paths.analysis, "TABLE_P3_COMMON_GRID.md"), table3, "utf8");
}

function summarize() {
  const validation = validateFull();
  if (!validation.valid) throw new Error(`Summary refused: ${validation.errors.join("; ")}`);
  fs.mkdirSync(paths.analysis, { recursive: true });
  const rows = readCsvObjects(paths.raw);
  const paper = gridStatistics(rows, "PAPER_GRID", PAPER_GRID);
  const common = gridStatistics(rows, "COMMON_COMPARISON_GRID", COMMON_COMPARISON_GRID);
  const scale = scalability(paper);
  const comparison = commonComparison(common);
  const normalized = comparison.map(({ n, mechanism, scope, normalized_gas_n10_equals_1 }) =>
    ({ n, mechanism, scope, normalized_gas_n10_equals_1 }));
  const feasibility = [...paper, ...common].map((row) => ({ grid_type: row.grid_type, n: row.n,
    executions: row.executions, successes: row.success_count, failures: row.failure_count,
    success_rate_percent: row.executions ? row.success_count / row.executions * 100 : null }));
  writeCsv(path.join(paths.analysis, "pedin_paper_grid_statistics.csv"), paper);
  writeCsv(path.join(paths.analysis, "pedin_common_grid_statistics.csv"), common);
  writeCsv(path.join(paths.analysis, "pedin_scalability_analysis.csv"), scale);
  writeCsv(path.join(paths.analysis, "pedin_common_grid_comparison.csv"), comparison);
  writeCsv(path.join(paths.analysis, "pedin_normalized_scalability.csv"), normalized);
  writeCsv(path.join(paths.analysis, "pedin_execution_feasibility.csv"), feasibility);
  writeCsv(path.join(paths.analysis, "table_p1_assumptions.csv"), [
    { item: "SSS library", classification: "CONTROLLED_ASSUMPTION", choice: "secrets.js-grempe 2.0.0" },
    { item: "Share serialization", classification: "CONTROLLED_ASSUMPTION", choice: "Canonical encoded string UTF-8" },
    { item: "Compiler/optimizer", classification: "CONTROLLED_ASSUMPTION", choice: "solc 0.8.24 / disabled" },
    { item: "Deployment gas", classification: "CONTROLLED_ASSUMPTION", choice: "Recorded separately" },
  ]);
  writeCsv(path.join(paths.analysis, "table_p2_paper_grid.csv"), paper);
  writeCsv(path.join(paths.analysis, "table_p3_common_grid.csv"), comparison);
  createDocuments(paper, common, comparison, scale);
  const figures = createPedinFigures({ paper, comparison });
  process.stdout.write(`[Pedin Summary] VALID\nPaper Grid rows=390\nCommon Grid rows=120\nTotal rows=510\n`);
  return { paper, common, scale, comparison, normalized, feasibility, figures };
}

module.exports = { quantile, describe, gridStatistics, scalability, commonComparison, summarize };
