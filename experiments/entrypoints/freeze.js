const { execute } = require("./_run");
const { createFreeze } = require("../freeze/freeze");

execute(async () => createFreeze());
