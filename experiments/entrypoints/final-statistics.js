const { execute } = require("./_run");
const { generateFinalStatistics } = require("../finalStatistics/finalStatistics");

execute(async () => generateFinalStatistics());
