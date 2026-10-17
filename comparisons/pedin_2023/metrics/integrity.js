const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { paths, ROOT } = require("../config/pedinConfig");

const MAIN_SHA256 = "a81e49c2a3a2730a5157aa39352c0ff28a00fe283fde630db89ef47827dfaf5d";
const RECOVERY_SHA256 = "bc5d4499d383faf405547ad4fdda013796f2bc73fc6efe39ef386a0fc03df942";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function frozenRawIntegrity() {
  const main = sha256File(paths.mainRaw);
  const recovery = sha256File(paths.recoveryRaw);
  return {
    valid: main === MAIN_SHA256 && recovery === RECOVERY_SHA256,
    main: { path: path.relative(ROOT, paths.mainRaw).replace(/\\/g, "/"), sha256: main, expected: MAIN_SHA256, valid: main === MAIN_SHA256 },
    recovery: { path: path.relative(ROOT, paths.recoveryRaw).replace(/\\/g, "/"), sha256: recovery, expected: RECOVERY_SHA256, valid: recovery === RECOVERY_SHA256 },
  };
}

function sourceHashEntries() {
  const candidates = [
    paths.contract,
    paths.merkleSource,
    path.join(ROOT, "comparisons", "pedin_2023", "config", "pedinConfig.js"),
    path.join(ROOT, "comparisons", "pedin_2023", "datasets", "pedinDataset.js"),
    path.join(ROOT, "comparisons", "pedin_2023", "runners", "pedinRunner.js"),
    path.join(ROOT, "comparisons", "pedin_2023", "validation", "pedinValidation.js"),
    path.join(ROOT, "comparisons", "pedin_2023", "documentation", "PEDIN_SOURCE_AUDIT.md"),
    path.join(ROOT, "comparisons", "pedin_2023", "documentation", "PEDIN_ASSUMPTION_REGISTER.md"),
    path.join(ROOT, "comparisons", "pedin_2023", "documentation", "PEDIN_COMPARISON_SCOPE.md"),
  ];
  return candidates.map((filePath) => ({
    relative_path: path.relative(ROOT, filePath).replace(/\\/g, "/"),
    sha256: sha256File(filePath),
  }));
}

function verifySourceHashEntries(entries) {
  const errors = [];
  for (const entry of entries || []) {
    const target = path.join(ROOT, ...entry.relative_path.split("/"));
    if (!fs.existsSync(target)) errors.push(`missing ready-gated source: ${entry.relative_path}`);
    else if (sha256File(target) !== entry.sha256) errors.push(`ready-gated source changed: ${entry.relative_path}`);
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  MAIN_SHA256,
  RECOVERY_SHA256,
  sha256File,
  frozenRawIntegrity,
  sourceHashEntries,
  verifySourceHashEntries,
};
