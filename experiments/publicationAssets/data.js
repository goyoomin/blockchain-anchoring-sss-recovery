const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");
const { csvValue, readCsvObjects } = require("../logger/experimentLogger");

const N_VALUES = Object.freeze([5, 10, 20, 50, 100, 500, 1000]);
const MECHANISMS = Object.freeze(["PER_SHARE", "MERKLE_ROOT"]);
const FINAL_DIRECTORY = path.join(
  experimentConfig.paths.root,
  "results",
  "analysis",
  "final_statistics",
);
const REQUIRED_INPUTS = Object.freeze([
  "final_gas_statistics.csv",
  "final_gas_comparison.csv",
  "final_recovery_statistics.csv",
  "final_recovery_paired_comparison.csv",
  "final_recovery_comparison.csv",
  "final_recovery_component_statistics.csv",
  "final_transaction_count.csv",
  "final_execution_feasibility.csv",
  "final_scalability_summary.csv",
  "final_publication_values.csv",
  "FINAL_STATISTICS_TABLES.md",
  "FINAL_STATISTICAL_ANALYSIS.md",
  "final_statistics_manifest.json",
]);

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function identity(filePath) {
  const stats = fs.statSync(filePath);
  return {
    relative_path: path.relative(experimentConfig.paths.root, filePath).replace(/\\/g, "/"),
    size_bytes: stats.size,
    sha256: sha256File(filePath),
  };
}

function numeric(row, fields) {
  const output = { ...row };
  for (const field of fields) {
    if (output[field] === "") output[field] = null;
    else if (output[field] !== undefined) output[field] = Number(output[field]);
  }
  return output;
}

function readNumeric(name, fields) {
  return readCsvObjects(path.join(FINAL_DIRECTORY, name)).map((row) => numeric(row, fields));
}

function verifyFinalInputs() {
  const errors = [];
  for (const name of REQUIRED_INPUTS) {
    if (!fs.existsSync(path.join(FINAL_DIRECTORY, name))) errors.push(`missing Final Statistics input: ${name}`);
  }
  if (errors.length) throw new Error(errors.join("; "));
  const manifest = JSON.parse(fs.readFileSync(path.join(FINAL_DIRECTORY, "final_statistics_manifest.json"), "utf8"));
  if (manifest.status !== "VALID" || manifest.validation_result !== true || manifest.raw_data_unchanged !== true) {
    throw new Error("Final Statistics manifest is not VALID");
  }
  const frozenHashes = new Map((manifest.generated_file_hashes ?? []).map((row) => [row.relative_path, row]));
  for (const name of REQUIRED_INPUTS.filter((input) => input !== "final_statistics_manifest.json")) {
    const filePath = path.join(FINAL_DIRECTORY, name);
    const relativePath = `results/analysis/final_statistics/${name}`;
    const frozen = frozenHashes.get(relativePath);
    if (!frozen || frozen.sha256 !== sha256File(filePath) || frozen.size_bytes !== fs.statSync(filePath).size) {
      throw new Error(`Final Statistics input does not match its manifest: ${name}`);
    }
  }
  if (manifest.n_values.join(",") !== N_VALUES.join(",") || manifest.observations_per_n_mechanism !== 30) {
    throw new Error("Final Statistics experimental structure mismatch");
  }
  return manifest;
}

function loadFinalStatistics() {
  const manifest = verifyFinalInputs();
  const gasStatistics = readNumeric("final_gas_statistics.csv", [
    "n", "count", "success_count", "failure_count", "mean", "sample_standard_deviation",
    "ci95_lower", "ci95_upper",
  ]);
  const gasComparison = readNumeric("final_gas_comparison.csv", [
    "n", "per_share_mean_gas", "per_share_sd", "per_share_ci_lower", "per_share_ci_upper",
    "merkle_root_mean_gas", "merkle_root_sd", "merkle_root_ci_lower",
    "merkle_root_ci_upper", "absolute_gas_difference", "gas_reduction_percent", "gas_ratio",
  ]);
  const recoveryStatistics = readNumeric("final_recovery_statistics.csv", [
    "n", "count", "success_count", "failure_count", "mean", "sample_standard_deviation",
    "ci95_lower", "ci95_upper",
  ]);
  const paired = readNumeric("final_recovery_paired_comparison.csv", [
    "n", "paired_count", "mean_delta_ms", "sample_sd_delta_ms", "ci95_lower_ms", "ci95_upper_ms",
  ]).map((row) => ({ ...row, ci_excludes_zero: row.ci_excludes_zero === "true" }));
  const recoveryComparison = readNumeric("final_recovery_comparison.csv", [
    "n", "per_share_mean_recovery_ms", "per_share_sd_ms", "per_share_ci_lower_ms",
    "per_share_ci_upper_ms", "merkle_root_mean_recovery_ms", "merkle_root_sd_ms",
    "merkle_root_ci_lower_ms", "merkle_root_ci_upper_ms", "recovery_reduction_percent",
    "paired_mean_delta_ms", "paired_ci95_lower_ms", "paired_ci95_upper_ms",
  ]).map((row) => ({ ...row, ci_excludes_zero: row.ci_excludes_zero === "true" }));
  const components = readNumeric("final_recovery_component_statistics.csv", [
    "n", "count", "mean_ms", "sample_standard_deviation_ms", "ci95_lower_ms", "ci95_upper_ms",
  ]);
  const transactions = readNumeric("final_transaction_count.csv", [
    "n", "per_share_transaction_count", "merkle_root_transaction_count",
    "transaction_reduction", "transaction_reduction_percent",
  ]);
  const feasibility = readNumeric("final_execution_feasibility.csv", [
    "n", "executions", "successes", "failures", "success_rate_percent",
  ]);
  const scalability = readNumeric("final_scalability_summary.csv", [
    "n", "per_share_mean_gas", "merkle_root_mean_gas", "gas_reduction_percent",
    "per_share_transactions", "merkle_root_transactions", "per_share_recovery_mean_ms",
    "merkle_root_recovery_mean_ms", "recovery_reduction_percent",
    "paired_recovery_ci_lower", "paired_recovery_ci_upper", "per_share_success_rate",
    "merkle_root_success_rate",
  ]).map((row) => ({ ...row, recovery_ci_excludes_zero: row.recovery_ci_excludes_zero === "true" }));
  const publication = readNumeric("final_publication_values.csv", ["n"]);
  const collections = { gasStatistics, gasComparison, recoveryStatistics, paired,
    recoveryComparison, components, transactions, feasibility, scalability, publication };
  const expected = { gasStatistics: 14, gasComparison: 7, recoveryStatistics: 14,
    paired: 7, recoveryComparison: 7, components: 70, transactions: 7,
    feasibility: 28, scalability: 7, publication: 7 };
  for (const [name, count] of Object.entries(expected)) {
    if (collections[name].length !== count) throw new Error(`${name} rows=${collections[name].length}, expected ${count}`);
  }
  return { manifest, ...collections };
}

function byMechanism(rows, mechanism) {
  return N_VALUES.map((n) => rows.find((row) => row.n === n && row.mechanism === mechanism));
}

function component(data, n, mechanism, name) {
  return data.components.find((row) => row.n === n && row.mechanism === mechanism && row.component === name);
}

function figureData(data) {
  const gasPs = byMechanism(data.gasStatistics, "PER_SHARE");
  const gasMr = byMechanism(data.gasStatistics, "MERKLE_ROOT");
  const recPs = byMechanism(data.recoveryStatistics, "PER_SHARE");
  const recMr = byMechanism(data.recoveryStatistics, "MERKLE_ROOT");
  const componentNames = ["share_load_time_ms", "blockchain_query_time_ms",
    "verification_time_ms", "merkle_proof_time_ms", "sss_reconstruction_time_ms"];
  const componentSeries = (mechanism, nValues = N_VALUES) => nValues.map((n) => ({
    n,
    mechanism,
    values: Object.fromEntries(componentNames.map((name) => {
      const row = component(data, n, mechanism, name);
      return [name, row?.mean_ms ?? 0];
    })),
  }));
  return {
    figure1_gas_linear: {
      kind: "line", title: "Cumulative Anchoring Gas", yLabel: "Cumulative anchoring gas used",
      yScale: "linear", n: N_VALUES,
      series: [
        { name: "PER_SHARE", values: gasPs.map((row) => row.mean),
          lower: gasPs.map((row) => row.ci95_lower), upper: gasPs.map((row) => row.ci95_upper) },
        { name: "MERKLE_ROOT", values: gasMr.map((row) => row.mean),
          lower: gasMr.map((row) => row.ci95_lower), upper: gasMr.map((row) => row.ci95_upper) },
      ],
      annotation: `n=1000 reduction: ${data.gasComparison.at(-1).gas_reduction_percent.toFixed(2)}%`,
    },
    figure1_gas_log: {
      kind: "line", title: "Cumulative Anchoring Gas (Log Scale)", yLabel: "Cumulative anchoring gas used (log scale)",
      yScale: "log", n: N_VALUES,
      series: [
        { name: "PER_SHARE", values: gasPs.map((row) => row.mean),
          lower: gasPs.map((row) => row.ci95_lower), upper: gasPs.map((row) => row.ci95_upper) },
        { name: "MERKLE_ROOT", values: gasMr.map((row) => row.mean),
          lower: gasMr.map((row) => row.ci95_lower), upper: gasMr.map((row) => row.ci95_upper) },
      ],
      annotation: `n=1000 reduction: ${data.gasComparison.at(-1).gas_reduction_percent.toFixed(2)}%`,
    },
    figure2_recovery_time: {
      kind: "line", title: "Counterbalanced Recovery Time", yLabel: "Total recovery time (ms)",
      yScale: "linear", n: N_VALUES,
      series: [
        { name: "PER_SHARE", values: recPs.map((row) => row.mean),
          lower: recPs.map((row) => row.ci95_lower), upper: recPs.map((row) => row.ci95_upper) },
        { name: "MERKLE_ROOT", values: recMr.map((row) => row.mean),
          lower: recMr.map((row) => row.ci95_lower), upper: recMr.map((row) => row.ci95_upper) },
      ],
      significantN: data.paired.filter((row) => row.ci_excludes_zero).map((row) => row.n),
      annotation: "Hollow diamonds: paired 95% CI excludes zero",
    },
    figure3_transaction_count: {
      kind: "line", title: "Anchoring Transaction Count", yLabel: "Anchoring transaction count",
      yScale: "linear", n: N_VALUES,
      series: [
        { name: "PER_SHARE", values: data.transactions.map((row) => row.per_share_transaction_count) },
        { name: "MERKLE_ROOT", values: data.transactions.map((row) => row.merkle_root_transaction_count) },
      ],
      annotation: "n=1000: 1000 vs 1 transaction",
    },
    figure4_gas_reduction: {
      kind: "reduction", title: "Gas Reduction with Merkle-Root Anchoring",
      yLabel: "Gas reduction relative to PER_SHARE (%)", n: N_VALUES,
      values: data.gasComparison.map((row) => row.gas_reduction_percent),
    },
    figure5_recovery_components_full: {
      kind: "components_full", title: "Recovery Component Breakdown", n: N_VALUES,
      components: componentNames,
      perShare: componentSeries("PER_SHARE"),
      merkleRoot: componentSeries("MERKLE_ROOT"),
    },
    figure5_recovery_components_representative: {
      kind: "components_representative", title: "Representative Recovery Component Breakdown",
      n: [5, 50, 1000], components: componentNames,
      perShare: componentSeries("PER_SHARE", [5, 50, 1000]),
      merkleRoot: componentSeries("MERKLE_ROOT", [5, 50, 1000]),
    },
    appendix_figure_a_recovery_paired_delta: {
      kind: "delta", title: "Paired Recovery-Time Difference", yLabel: "PER_SHARE − MERKLE_ROOT (ms)",
      n: N_VALUES, values: data.paired.map((row) => row.mean_delta_ms),
      lower: data.paired.map((row) => row.ci95_lower_ms),
      upper: data.paired.map((row) => row.ci95_upper_ms),
    },
  };
}

function formatted(value, digits, thousands = false) {
  const number = Number(value);
  return thousands
    ? number.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : number.toFixed(digits);
}

function markdownTable(headers, rows, alignRight = []) {
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map((_, index) =>
    alignRight.includes(index) ? "---:" : "---").join(" | ")} |`];
  rows.forEach((row) => lines.push(`| ${row.join(" | ")} |`));
  return `${lines.join("\n")}\n`;
}

function csvText(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) =>
    row.map((value) => csvValue(value)).join(",")).join("\n")}\n`;
}

function docReady(title, caption, headers, rows, note = "") {
  return `${title}\n${caption}\n\n${headers.join("\t")}\n${rows.map((row) => row.join("\t")).join("\n")}` +
    `${note ? `\n\nNote: ${note}` : ""}\n`;
}

function tableDefinitions(data) {
  const gasPs = byMechanism(data.gasStatistics, "PER_SHARE");
  const gasMr = byMechanism(data.gasStatistics, "MERKLE_ROOT");
  const recPs = byMechanism(data.recoveryStatistics, "PER_SHARE");
  const recMr = byMechanism(data.recoveryStatistics, "MERKLE_ROOT");
  const mainSuccess = (n, mechanism) => data.feasibility.find((row) =>
    row.experiment === "MAIN" && row.n === n && row.mechanism === mechanism).success_rate_percent;
  const table1Rows = N_VALUES.map((n) => [n, Math.floor(n / 2) + 1, 30, 30, "PER_SHARE; MERKLE_ROOT"]);
  const table2Rows = N_VALUES.map((n, index) => [n,
    `${formatted(gasPs[index].mean, 0, true)} ± ${formatted(gasPs[index].sample_standard_deviation, 3, true)}`,
    `${formatted(gasMr[index].mean, 0, true)} ± ${formatted(gasMr[index].sample_standard_deviation, 3, true)}`,
    formatted(data.gasComparison[index].gas_reduction_percent, 2),
  ]);
  const table3Rows = N_VALUES.map((n, index) => [n,
    `${formatted(recPs[index].mean, 3)} ± ${formatted(recPs[index].sample_standard_deviation, 3)}`,
    `${formatted(recMr[index].mean, 3)} ± ${formatted(recMr[index].sample_standard_deviation, 3)}`,
    formatted(data.paired[index].mean_delta_ms, 3),
    `[${formatted(data.paired[index].ci95_lower_ms, 3)}, ${formatted(data.paired[index].ci95_upper_ms, 3)}]`,
    formatted(data.recoveryComparison[index].recovery_reduction_percent, 2),
  ]);
  const table4Rows = N_VALUES.map((n, index) => [n,
    data.transactions[index].per_share_transaction_count,
    data.transactions[index].merkle_root_transaction_count,
    data.transactions[index].transaction_reduction,
    `${formatted(mainSuccess(n, "PER_SHARE"), 1)}%`,
    `${formatted(mainSuccess(n, "MERKLE_ROOT"), 1)}%`,
  ]);
  const componentRows = (nValues) => nValues.flatMap((n) => MECHANISMS.map((mechanism) => {
    const query = component(data, n, mechanism, "blockchain_query_time_ms").mean_ms;
    const verification = component(data, n, mechanism, "verification_time_ms").mean_ms;
    const proof = component(data, n, mechanism, "merkle_proof_time_ms").mean_ms;
    const reconstruction = component(data, n, mechanism, "sss_reconstruction_time_ms").mean_ms;
    const total = data.recoveryStatistics.find((row) => row.n === n && row.mechanism === mechanism).mean;
    return [n, mechanism, formatted(query, 3), formatted(verification, 3),
      proof === null ? "—" : formatted(proof, 3), formatted(reconstruction, 3), formatted(total, 3)];
  }));
  const definitions = [
    { id: "table1_experimental_configuration", number: "Table 1", title: "Experimental Configuration",
      caption: "Experimental configuration for the frozen Hardhat evaluation.",
      headers: ["Share count (n)", "Threshold (k)", "Repetitions", "Main datasets", "Mechanisms"],
      rows: table1Rows, alignRight: [0, 1, 2, 3], note: "Each dataset was evaluated once with each mechanism in each experiment." },
    { id: "table2_anchoring_gas", number: "Table 2", title: "Cumulative Anchoring Gas Results",
      caption: "Main Experiment cumulative anchoring gas; values are mean ± sample SD over 30 repetitions.",
      headers: ["n", "PER_SHARE mean ± SD", "MERKLE_ROOT mean ± SD", "Gas reduction (%)"], rows: table2Rows,
      alignRight: [0, 1, 2, 3], note: "Deployment gas is excluded. Gas reduction is relative to PER_SHARE." },
    { id: "table3_recovery_time", number: "Table 3", title: "Counterbalanced Recovery Time Results",
      caption: "Counterbalanced Recovery Validation results; time values are in milliseconds.",
      headers: ["n", "PER_SHARE mean ± SD", "MERKLE_ROOT mean ± SD", "Paired delta", "Paired 95% CI", "Reduction (%)"],
      rows: table3Rows,
      alignRight: [0, 1, 2, 3, 4, 5],
      note: "Delta = PER_SHARE − MERKLE_ROOT. The paired CI includes zero at n=5, 10, and 1000." },
    { id: "table4_transactions_feasibility", number: "Table 4", title: "Transaction Count and Execution Feasibility",
      caption: "Anchoring transaction count and Main Experiment success rate.",
      headers: ["n", "PER_SHARE TX", "MERKLE_ROOT TX", "TX reduction", "PER_SHARE success", "MERKLE_ROOT success"],
      rows: table4Rows, alignRight: [0, 1, 2, 3, 4, 5], note: "Deployment transactions are excluded." },
    { id: "table5_recovery_components", number: "Table 5", title: "Representative Recovery Component Summary",
      caption: "Mean component times for representative share-count conditions in the Counterbalanced Recovery Validation.",
      headers: ["n", "Mechanism", "Query (ms)", "Verification (ms)", "Proof (ms)", "SSS (ms)", "Total (ms)"],
      rows: componentRows([5, 50, 1000]), alignRight: [0, 2, 3, 4, 5, 6],
      note: "Total includes measured overhead and is not constrained to equal the component sum." },
    { id: "table_s1_recovery_components_full", number: "Table S1", title: "Full Recovery Component Summary",
      caption: "Mean component times for all seven share-count conditions in the Counterbalanced Recovery Validation.",
      headers: ["n", "Mechanism", "Query (ms)", "Verification (ms)", "Proof (ms)", "SSS (ms)", "Total (ms)"],
      rows: componentRows(N_VALUES), alignRight: [0, 2, 3, 4, 5, 6],
      note: "Supplementary table; total includes measured overhead." },
  ];
  return definitions.map((table) => ({
    ...table,
    csv: csvText(table.headers, table.rows),
    markdown: `# ${table.number}. ${table.title}\n\n${table.caption}\n\n${markdownTable(table.headers, table.rows,
      table.alignRight)}\n` +
      `Note: ${table.note}\n`,
    docReady: docReady(`${table.number}. ${table.title}`, table.caption, table.headers, table.rows, table.note),
  }));
}

function captions() {
  const figure = `# Figure Captions\n\n` +
    `**Figure 1.** Cumulative anchoring gas used by PER_SHARE and MERKLE_ROOT across seven share-count conditions in the Main Experiment. Points show means over 30 repetitions and error bars show 95% confidence intervals. The linear and logarithmic renderings use identical values; MERKLE_ROOT remains nearly constant while PER_SHARE increases with n.\n\n` +
    `**Figure 2.** Total recovery time in the Counterbalanced Recovery Validation. Points show means over 30 paired datasets and error bars show mechanism-specific 95% confidence intervals. Hollow diamonds denote conditions where the paired 95% confidence interval for PER_SHARE minus MERKLE_ROOT excludes zero (n=20, 50, 100, and 500); the paired interval includes zero at n=5, 10, and 1000.\n\n` +
    `**Figure 3.** Anchoring transaction count from the Main Experiment structure. PER_SHARE requires n anchoring transactions, whereas MERKLE_ROOT requires one; deployment transactions are excluded.\n\n` +
    `**Figure 4.** Mean cumulative anchoring-gas reduction achieved by MERKLE_ROOT relative to PER_SHARE in the Main Experiment. The reduction increases from 80.39% at n=5 to 99.90% at n=1000.\n\n` +
    `**Figure 5.** Mean recovery-component times from the Counterbalanced Recovery Validation. PER_SHARE is increasingly dominated by blockchain queries, whereas MERKLE_ROOT retains a nearly constant root-query time but incurs growing verification and proof-generation work. At n=1000, similar verification/query and reconstruction costs bring the total recovery times close together. The full and representative renderings use the same component means.\n\n` +
    `**Figure A1.** Paired recovery-time difference (PER_SHARE minus MERKLE_ROOT) in the Counterbalanced Recovery Validation. Error bars show paired 95% confidence intervals and the horizontal line marks zero. Positive values indicate a lower MERKLE_ROOT recovery time.\n`;
  const table = `# Table Captions\n\n` +
    `**Table 1.** Experimental configuration for the frozen Main and Counterbalanced Recovery evaluations.\n\n` +
    `**Table 2.** Cumulative anchoring gas from the Main Experiment. Values are mean ± sample standard deviation over 30 repetitions; deployment gas is excluded.\n\n` +
    `**Table 3.** Total recovery time from the Counterbalanced Recovery Validation. Paired differences are PER_SHARE minus MERKLE_ROOT; positive values favor MERKLE_ROOT. A confidence interval containing zero is not interpreted as evidence of a nonzero paired mean difference.\n\n` +
    `**Table 4.** Anchoring transaction count and execution feasibility. Transaction counts exclude deployment and success rates are calculated from observed Main Experiment outcomes.\n\n` +
    `**Table 5.** Representative recovery-component means for n=5, 50, and 1000 from the Counterbalanced Recovery Validation.\n\n` +
    `**Table S1.** Full recovery-component means for all seven share-count conditions from the Counterbalanced Recovery Validation.\n`;
  return { figure_captions: figure, table_captions: table };
}

function overview() {
  return `# Publication Assets Overview\n\n` +
    `## Recommended Main-Text Figures\n\n` +
    `1. Figure 1 log-scale gas plot — Results 4.2 (anchoring gas scalability). Use the linear version when absolute magnitude is the focus.\n` +
    `2. Figure 2 recovery-time plot — Results 4.3 (counterbalanced recovery performance).\n` +
    `3. Figure 3 transaction-count plot — Results 4.2 or 4.4 (structural scalability).\n` +
    `4. Figure 5 representative component plot — Results 4.3 and Discussion (recovery bottlenecks).\n` +
    `5. Figure 4 gas-reduction plot — Results 4.2, after the primary gas plot.\n\n` +
    `## Recommended Supplementary Figures\n\n` +
    `- Figure 5 full component plot for all n conditions.\n` +
    `- Figure A1 paired recovery delta and 95% CI.\n` +
    `- Figure 1 alternate linear/log rendering not selected for the main text.\n\n` +
    `## Recommended Tables\n\n` +
    `- Table 1 in Methods or Experimental Setup.\n` +
    `- Tables 2 and 3 in Results 4.2 and 4.3.\n` +
    `- Table 4 in Results 4.4 or the scalability subsection.\n` +
    `- Table 5 in Discussion or Results 4.3; use Table S1 as supplementary material.\n\n` +
    `All publication assets are derived only from validated files in \`results/analysis/final_statistics/\`. ` +
    `PNG files target 300 dpi, while SVG and PDF versions retain vector geometry.\n`;
}

module.exports = {
  N_VALUES,
  MECHANISMS,
  FINAL_DIRECTORY,
  REQUIRED_INPUTS,
  sha256Buffer,
  sha256File,
  identity,
  verifyFinalInputs,
  loadFinalStatistics,
  figureData,
  tableDefinitions,
  captions,
  overview,
};
