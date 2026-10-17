const hre = require("hardhat");
const { runAudit } = require("../audit/audit");
const { execute } = require("./_run");

execute(() => runAudit(hre));
