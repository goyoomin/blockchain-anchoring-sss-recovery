const fs = require("fs");
const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");

const PROTECTED_RAW_PATHS = Object.freeze([
  path.resolve(experimentConfig.paths.mainRaw),
  path.resolve(experimentConfig.paths.recoveryValidationRaw),
]);

function freezeManifestPath() {
  return path.join(
    experimentConfig.paths.root,
    "results",
    "final_freeze",
    "manifest",
    "freeze_manifest.json",
  );
}

function isFrozen() {
  const target = freezeManifestPath();
  if (!fs.existsSync(target)) return false;
  try {
    return JSON.parse(fs.readFileSync(target, "utf8")).status === "FROZEN";
  } catch (_error) {
    return false;
  }
}

function assertNotFrozenRawDestination(filePath) {
  const resolved = path.resolve(filePath);
  if (PROTECTED_RAW_PATHS.includes(resolved) && isFrozen()) {
    throw new Error(
      `MDPI final freeze prevents writes to protected Raw Data: ${resolved}`,
    );
  }
}

module.exports = {
  PROTECTED_RAW_PATHS,
  freezeManifestPath,
  isFrozen,
  assertNotFrozenRawDestination,
};
