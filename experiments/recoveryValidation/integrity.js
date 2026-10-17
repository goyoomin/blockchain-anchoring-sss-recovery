const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function fileIdentity(filePath) {
  const contents = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(contents).digest("hex"),
    size_bytes: contents.length,
  };
}

function writeIntegrityReport(target, before, after = null) {
  const report = {
    source: "results/main/main_raw.csv",
    before_sha256: before.sha256,
    before_size_bytes: before.size_bytes,
    after_sha256: after?.sha256 ?? null,
    after_size_bytes: after?.size_bytes ?? null,
    unchanged: after
      ? before.sha256 === after.sha256 && before.size_bytes === after.size_bytes
      : null,
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

module.exports = { fileIdentity, writeIntegrityReport };
