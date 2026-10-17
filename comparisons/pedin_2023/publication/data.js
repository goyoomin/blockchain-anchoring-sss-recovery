const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readCsvObjects } = require("../../../experiments/logger/experimentLogger");
const { ROOT, paths, EXPECTED_HASHES, PAPER_N, COMMON_N } = require("./config");

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function identity(filePath) {
  const stats = fs.statSync(filePath);
  return { relative_path: relative(filePath), size_bytes: stats.size, sha256: sha256File(filePath) };
}

function plottedDigest(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(value), "utf8"));
}

function number(row, field) {
  const value = Number(row[field]);
  if (!Number.isFinite(value)) throw new Error(`non-numeric ${field}`);
  return value;
}

function almostEqual(a, b, tolerance = 1e-10) {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

function parseAuditRows() {
  const text = fs.readFileSync(paths.sourceAudit, "utf8");
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("| Item | Paper explicitly specifies?"));
  if (start < 0) throw new Error("Pedin Source Audit table was not found");
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    const cells = [];
    let cell = "";
    let inCode = false;
    for (let index = 1; index < line.length - 1; index += 1) {
      const character = line[index];
      if (character === "`") inCode = !inCode;
      if (character === "|" && !inCode) {
        cells.push(cell.trim());
        cell = "";
      } else cell += character;
    }
    cells.push(cell.trim());
    if (cells.length !== 5) throw new Error(`invalid Source Audit row: ${line}`);
    rows.push({ item: cells[0].replace(/`/g, ""), explicit: cells[1], paper: cells[2], implementation: cells[3], classification: cells[4] });
  }
  return rows;
}

const FIDELITY_ITEMS = Object.freeze([
  ["Secret sharing", "Shamir Secret Sharing"],
  ["Secret being shared", "Secret Recovery Key"],
  ["n meaning", "n = guardians = shares"],
  ["Recommended k", "k = n/2 + 1"],
  ["Hash algorithm", "Merkle SHA-256 variant"],
  ["Leaf definition", "Share-hash leaves"],
  ["Leaf ordering", "Leaf ordering and sorting"],
  ["Parent hashing", "Left/right parent ordering"],
  ["Merkle padding", "Last-leaf padding"],
  ["Smart-contract stored state", "PBK + Merkle Root storage"],
  ["Number of setup transactions", "Setup transaction count"],
  ["SSS software library", "SSS library"],
  ["Share serialization", "Share serialization"],
  ["Proof index base", "Proof indexing"],
  ["Solidity/compiler version", "Solidity version"],
  ["Optimizer", "Compiler optimizer"],
  ["Execution network/framework", "Hardhat environment"],
  ["Repetition count", "Repetition count"],
  ["Deployment gas treatment", "Deployment gas treatment"],
  ["Common comparison grid", "Common Grid"],
  ["Contract source structure", "Contract layout"],
]);

function fidelityRows() {
  const audit = parseAuditRows();
  const byItem = new Map(audit.map((row) => [row.item, row]));
  return FIDELITY_ITEMS.map(([key, label]) => {
    const row = byItem.get(key);
    if (!row) throw new Error(`required Source Audit item missing: ${key}`);
    const rationale = row.classification === "PAPER_EXPLICIT"
      ? "Follows the paper-disclosed setup description."
      : row.classification === "PAPER_INFERRED"
        ? "Operational interpretation of the disclosed algorithm; not attributed as an original low-level choice."
        : "Not specified in the original paper; controlled implementation choice documented in the Assumption Register.";
    return {
      implementation_element: label,
      classification: row.classification,
      paper_supported_description: row.paper,
      our_implementation: row.implementation,
      rationale_limitation: rationale,
    };
  });
}

function verifyFrozenSources() {
  const errors = [];
  const pedinFreeze = JSON.parse(fs.readFileSync(paths.pedinFreeze, "utf8"));
  if (pedinFreeze.status !== "FROZEN" || pedinFreeze.validation !== true) errors.push("Pedin freeze is not FROZEN/VALID");
  if (pedinFreeze.raw_sha256 !== EXPECTED_HASHES.pedin) errors.push("Pedin freeze manifest raw SHA mismatch");
  const frozenStats = new Map((pedinFreeze.statistics || []).map((item) => [item.relative_path, item.sha256]));
  for (const filePath of [paths.paperStats, paths.commonStats, paths.scalability, paths.commonComparison,
    paths.normalized, paths.feasibility, paths.baselineAnalysis, paths.methodFidelity]) {
    const rel = relative(filePath);
    if (frozenStats.get(rel) !== sha256File(filePath)) errors.push(`Pedin frozen statistic mismatch: ${rel}`);
  }
  const fileHashes = new Map(readCsvObjects(paths.pedinFreezeHashes).map((row) => [row.relative_path, row.sha256]));
  for (const filePath of [paths.sourceAudit, paths.assumptionRegister]) {
    const rel = relative(filePath);
    if (fileHashes.get(rel) !== sha256File(filePath)) errors.push(`Pedin frozen documentation mismatch: ${rel}`);
  }
  const raw = {
    pedin: sha256File(paths.pedinRaw),
    main: sha256File(paths.mainRaw),
    recovery: sha256File(paths.recoveryRaw),
  };
  for (const [name, expected] of Object.entries(EXPECTED_HASHES)) {
    if (raw[name] !== expected) errors.push(`${name} Raw SHA-256 mismatch`);
  }
  return { valid: errors.length === 0, errors, raw, pedinFreeze };
}

function loadPublicationData() {
  const frozen = verifyFrozenSources();
  if (!frozen.valid) throw new Error(frozen.errors.join("; "));
  const paperRaw = readCsvObjects(paths.paperStats);
  const scaleRows = readCsvObjects(paths.scalability);
  const commonRaw = readCsvObjects(paths.commonComparison);
  const normalizedRaw = readCsvObjects(paths.normalized);
  const finalGas = readCsvObjects(paths.finalGasComparison);
  const finalTx = readCsvObjects(paths.finalTransactionCount);
  const errors = [];
  const paper = paperRaw.map((row) => ({
    n: number(row, "n"), k: number(row, "k"), repetitions: number(row, "executions"),
    successes: number(row, "success_count"), failures: number(row, "failure_count"),
    mean: number(row, "mean_setup_gas"), sd: number(row, "sample_sd"),
    ciLower: number(row, "ci95_lower"), ciUpper: number(row, "ci95_upper"),
    successRate: number(row, "executions") ? number(row, "success_count") / number(row, "executions") * 100 : null,
  }));
  if (paper.map((row) => row.n).join(",") !== PAPER_N.join(",")) errors.push("Paper Grid n mismatch");
  if (paper.some((row) => row.repetitions !== 30 || row.successes !== 30 || row.failures !== 0)) errors.push("Paper Grid repetitions/success mismatch");
  const scale = scaleRows[0] ? {
    minimumMean: number(scaleRows[0], "minimum_mean_gas"),
    maximumMean: number(scaleRows[0], "maximum_mean_gas"),
    absoluteRange: number(scaleRows[0], "absolute_range_gas"),
    relativeRangePercent: number(scaleRows[0], "relative_range_percent"),
    slope: number(scaleRows[0], "linear_regression_slope_gas_per_guardian"),
  } : null;
  if (!scale) errors.push("Pedin scalability row missing");
  else {
    const means = paper.map((row) => row.mean);
    if (!almostEqual(Math.min(...means), scale.minimumMean) || !almostEqual(Math.max(...means), scale.maximumMean)) errors.push("Paper mean extrema do not match scalability analysis");
    if (!almostEqual(scale.minimumMean, 66827) || !almostEqual(scale.maximumMean, 66830.6) ||
        !almostEqual(scale.absoluteRange, 3.6000000000058208) || !almostEqual(scale.relativeRangePercent, 0.005387044158806801) ||
        !almostEqual(scale.slope, -0.0027925000665530923)) errors.push("Pedin representative scalability statistics differ from locked expectations");
  }
  const common = commonRaw.map((row) => ({
    n: number(row, "n"), mechanism: row.mechanism, sourceScope: row.scope,
    mean: number(row, "mean_gas"), sd: number(row, "sd"), ciLower: number(row, "ci95_lower"),
    ciUpper: number(row, "ci95_upper"), transactions: number(row, "transaction_count"),
    normalized: number(row, "normalized_gas_n10_equals_1"),
  }));
  const mechanisms = ["PEDIN_PAPER_GUIDED_SETUP", "OUR_MERKLE_ROOT_ANCHORING", "OUR_PER_SHARE_ANCHORING"];
  if ([...new Set(common.map((row) => row.n))].join(",") !== COMMON_N.join(",")) errors.push("Common Grid n mismatch");
  if ([...new Set(common.map((row) => row.mechanism))].sort().join(",") !== [...mechanisms].sort().join(",") || common.length !== 12) errors.push("Common Grid mechanism/row mismatch");
  for (const mechanism of mechanisms) {
    const rows = common.filter((row) => row.mechanism === mechanism).sort((a, b) => a.n - b.n);
    const base = rows.find((row) => row.n === 10)?.mean;
    if (!base) errors.push(`${mechanism} n=10 baseline missing`);
    for (const row of rows) if (!almostEqual(row.normalized, row.mean / base)) errors.push(`${mechanism} method-specific normalization mismatch at n=${row.n}`);
    if (!almostEqual(rows[0]?.normalized, 1)) errors.push(`${mechanism} n=10 normalization is not 1`);
  }
  for (const row of normalizedRaw) {
    const match = common.find((item) => item.n === Number(row.n) && item.mechanism === row.mechanism);
    if (!match || !almostEqual(match.normalized, Number(row.normalized_gas_n10_equals_1))) errors.push(`normalized source mismatch: ${row.n}/${row.mechanism}`);
  }
  for (const n of COMMON_N) {
    const final = finalGas.find((row) => Number(row.n) === n);
    const tx = finalTx.find((row) => Number(row.n) === n);
    const merkle = common.find((row) => row.n === n && row.mechanism === "OUR_MERKLE_ROOT_ANCHORING");
    const perShare = common.find((row) => row.n === n && row.mechanism === "OUR_PER_SHARE_ANCHORING");
    if (!final || !tx || !almostEqual(merkle.mean, Number(final.merkle_root_mean_gas)) ||
        !almostEqual(perShare.mean, Number(final.per_share_mean_gas))) errors.push(`Final Statistics gas mismatch at n=${n}`);
    if (merkle.transactions !== Number(tx?.merkle_root_transaction_count) ||
        perShare.transactions !== Number(tx?.per_share_transaction_count)) errors.push(`Final Statistics transaction mismatch at n=${n}`);
  }
  const fidelity = fidelityRows();
  if (fidelity.length < 20) errors.push("Fidelity table must contain all required rows");
  if (errors.length) throw new Error(errors.join("; "));
  const figure6 = {
    figure: 6, title: "Pedin Paper-Guided Merkle-SHA256 Setup Gas", numeric_x: true,
    n: paper.map((row) => row.n), counts: paper.map((row) => row.repetitions),
    means: paper.map((row) => row.mean), lower: paper.map((row) => row.ciLower), upper: paper.map((row) => row.ciUpper),
    y_domain: [66778, 66879], mean_range: scale.absoluteRange, relative_range_percent: scale.relativeRangePercent,
  };
  const figure7 = {
    figure: 7, title: "Normalized Gas Scaling on the Common Grid", numeric_x: true,
    n: COMMON_N,
    series: mechanisms.map((mechanism) => ({ mechanism, values: COMMON_N.map((n) =>
      common.find((row) => row.n === n && row.mechanism === mechanism).normalized) })),
    normalization: "METHOD_SPECIFIC_N10_MEAN_EQUALS_1",
  };
  return { frozen, paper, scale, common, fidelity, figure6, figure7 };
}

function sourceFiles() {
  return [paths.paperStats, paths.commonStats, paths.scalability, paths.commonComparison,
    paths.normalized, paths.feasibility, paths.baselineAnalysis, paths.methodFidelity,
    paths.sourceAudit, paths.assumptionRegister, paths.pedinFreeze,
    paths.finalGasComparison, paths.finalTransactionCount].map(identity);
}

module.exports = {
  sha256Buffer, sha256File, relative, identity, plottedDigest, almostEqual,
  parseAuditRows, fidelityRows, verifyFrozenSources, loadPublicationData, sourceFiles,
};
