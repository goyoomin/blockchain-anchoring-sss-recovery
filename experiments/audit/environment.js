const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");

function packageVersion(packageName) {
  let current = path.dirname(require.resolve(packageName));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) {
      const manifest = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (manifest.name === packageName) return manifest.version;
    }
    current = path.dirname(current);
  }
  return "UNKNOWN";
}

function commandVersion(command, args = ["--version"]) {
  try {
    return childProcess.execFileSync(command, args, {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  } catch (_error) {
    return "UNKNOWN";
  }
}

function npmVersion() {
  const npmCli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  return fs.existsSync(npmCli)
    ? commandVersion(process.execPath, [npmCli, "--version"])
    : commandVersion(process.platform === "win32" ? "npm.cmd" : "npm");
}

async function collectEnvironment(hre) {
  const block = await hre.ethers.provider.getBlock("latest");
  const network = await hre.ethers.provider.getNetwork();
  const cpus = os.cpus();
  return {
    schema_version: 1,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: cpus[0]?.model ?? "UNKNOWN",
    cpu_cores: cpus.length,
    ram_bytes: os.totalmem(),
    node_version: process.version,
    npm_version: npmVersion(),
    hardhat_version: packageVersion("hardhat"),
    ethers_version: packageVersion("ethers"),
    solidity_version: experimentConfig.solidityVersion,
    solidity_compiler_version: packageVersion("solc"),
    optimizer_enabled: experimentConfig.optimizerEnabled,
    optimizer_runs: experimentConfig.optimizerRuns,
    sss_library: "secrets.js-grempe",
    sss_library_version: packageVersion("secrets.js-grempe"),
    merkle_library: "merkletreejs",
    merkle_library_version: packageVersion("merkletreejs"),
    hash_algorithm: experimentConfig.hashAlgorithm,
    block_gas_limit: block.gasLimit.toString(),
    chain_id: network.chainId.toString(),
    experiment_date: new Date().toISOString(),
  };
}

const CRITICAL_ENVIRONMENT_FIELDS = Object.freeze([
  "node_version",
  "hardhat_version",
  "ethers_version",
  "solidity_compiler_version",
  "optimizer_enabled",
  "optimizer_runs",
  "sss_library_version",
  "merkle_library_version",
  "hash_algorithm",
  "block_gas_limit",
  "chain_id",
]);

async function freezeEnvironment(hre) {
  const current = await collectEnvironment(hre);
  const target = experimentConfig.paths.environment;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const frozen = JSON.parse(fs.readFileSync(target, "utf8"));
    const differences = CRITICAL_ENVIRONMENT_FIELDS.filter(
      (field) => String(frozen[field]) !== String(current[field]),
    );
    if (differences.length > 0 && process.env.ALLOW_ENVIRONMENT_MISMATCH !== "1") {
      throw new Error(
        `environment differs from frozen file: ${differences.join(", ")}. ` +
        "Set ALLOW_ENVIRONMENT_MISMATCH=1 only after documenting the change.",
      );
    }
    return frozen;
  }
  fs.writeFileSync(target, `${JSON.stringify(current, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return current;
}

module.exports = {
  CRITICAL_ENVIRONMENT_FIELDS,
  packageVersion,
  collectEnvironment,
  freezeEnvironment,
};
