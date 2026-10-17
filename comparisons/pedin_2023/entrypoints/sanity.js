const hre = require("hardhat");
const { runSanity } = require("../runners/pedinRunner");
const { validateSanity, printValidation } = require("../validation/pedinValidation");

async function main() {
  await runSanity(hre);
  const validation = validateSanity();
  printValidation(validation, "Pedin Sanity");
  if (!validation.valid) throw new Error("Pedin sanity validation failed");
  process.stdout.write("PEDIN BASELINE READY FOR FULL EXECUTION\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
