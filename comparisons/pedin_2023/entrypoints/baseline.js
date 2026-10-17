const hre = require("hardhat");
const { runFull } = require("../runners/pedinRunner");
const { validateFull, printValidation } = require("../validation/pedinValidation");

async function main() {
  await runFull(hre);
  const validation = validateFull();
  printValidation(validation);
  if (!validation.valid) throw new Error("Pedin full validation failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
