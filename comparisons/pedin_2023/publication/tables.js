const { csvValue } = require("../../../experiments/logger/experimentLogger");

function csv(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")).join("\n")}\n`;
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function markdown(title, headers, rows, note = "") {
  return `# ${title}\n\n` +
    `| ${headers.map(escapeMarkdown).join(" | ")} |\n` +
    `| ${headers.map(() => "---").join(" | ")} |\n` +
    rows.map((row) => `| ${row.map(escapeMarkdown).join(" | ")} |`).join("\n") +
    (note ? `\n\n*Note.* ${note}\n` : "\n");
}

function docReady(title, headers, rows, note = "") {
  return `${title}\n${headers.join("\t")}\n${rows.map((row) => row.join("\t")).join("\n")}\n` +
    (note ? `Note: ${note}\n` : "");
}

function table6(data) {
  const csvHeaders = ["n", "k", "repetitions", "mean_setup_gas", "sample_sd", "ci95_lower", "ci95_upper", "success_rate_percent"];
  const csvRows = data.paper.map((row) => ({ n: row.n, k: row.k, repetitions: row.repetitions,
    mean_setup_gas: row.mean, sample_sd: row.sd, ci95_lower: row.ciLower, ci95_upper: row.ciUpper,
    success_rate_percent: row.successRate }));
  const headers = ["n", "k", "Repetitions", "Mean Setup Gas", "SD", "95% CI", "Success Rate"];
  const rows = data.paper.map((row) => [row.n, row.k, row.repetitions, row.mean.toFixed(1), row.sd.toFixed(2),
    `[${row.ciLower.toFixed(2)}, ${row.ciUpper.toFixed(2)}]`, `${row.successRate.toFixed(0)}%`]);
  const title = "Table 6. Pedin Paper-Guided Merkle-SHA256 Setup Results";
  const note = "Values summarize 30 frozen executions per paper-grid condition. Setup gas is receipt gasUsed; deployment gas is excluded.";
  return { id: "table6_pedin_paper_grid_results", number: "Table 6", title,
    sourceRows: csvRows, csv: csv(csvHeaders, csvRows), markdown: markdown(title, headers, rows, note),
    docReady: docReady(title, headers, rows, note), rowCount: rows.length };
}

const DISPLAY = Object.freeze({
  PEDIN_PAPER_GUIDED_SETUP: Object.freeze({ name: "Pedin Paper-Guided", scope: "Recovery address + Merkle root" }),
  OUR_MERKLE_ROOT_ANCHORING: Object.freeze({ name: "Merkle-Root", scope: "Merkle root" }),
  OUR_PER_SHARE_ANCHORING: Object.freeze({ name: "Per-Share", scope: "n share hashes" }),
});

function table7(data) {
  const csvHeaders = ["n", "mechanism", "mean_gas_used", "normalized_gas", "transaction_count", "on_chain_scope"];
  const csvRows = data.common.map((row) => ({ n: row.n, mechanism: DISPLAY[row.mechanism].name,
    mean_gas_used: row.mean, normalized_gas: row.normalized, transaction_count: row.transactions,
    on_chain_scope: DISPLAY[row.mechanism].scope }));
  const headers = ["n", "Mechanism", "Mean Gas Used", "Normalized Gas", "Transaction Count", "On-Chain Scope"];
  const rows = csvRows.map((row) => [row.n, row.mechanism, row.mean_gas_used.toFixed(1), row.normalized_gas.toFixed(3),
    row.transaction_count, row.on_chain_scope]);
  const title = "Table 7. Common-Grid Gas Scalability Comparison";
  const note = "Each mechanism is normalized to its own n=10 mean. The scopes differ, so absolute gas values are not interpreted as an efficiency ranking.";
  return { id: "table7_common_grid_scalability_comparison", number: "Table 7", title,
    sourceRows: csvRows, csv: csv(csvHeaders, csvRows), markdown: markdown(title, headers, rows, note),
    docReady: docReady(title, headers, rows, note), rowCount: rows.length };
}

function tableS2(data) {
  const csvHeaders = ["implementation_element", "classification", "paper_supported_description", "our_implementation", "rationale_limitation"];
  const csvRows = data.fidelity;
  const headers = ["Implementation Element", "Classification", "Paper-Supported Description", "Our Implementation", "Rationale / Limitation"];
  const rows = csvRows.map((row) => csvHeaders.map((header) => row[header]));
  const title = "Table S2. Fidelity and Controlled Assumptions of the Pedin Paper-Guided Baseline";
  const note = "PAPER_EXPLICIT denotes a disclosed paper element; PAPER_INFERRED denotes a conservative operational interpretation; CONTROLLED_ASSUMPTION denotes an implementation choice not specified in the original paper.";
  return { id: "tableS2_pedin_method_fidelity", number: "Table S2", title,
    sourceRows: csvRows, csv: csv(csvHeaders, csvRows), markdown: markdown(title, headers, rows, note),
    docReady: docReady(title, headers, rows, note), rowCount: rows.length };
}

function tableDefinitions(data) {
  return [table6(data), table7(data), tableS2(data)];
}

module.exports = { csv, markdown, docReady, DISPLAY, table6, table7, tableS2, tableDefinitions };
