const { freezePedin } = require("../validation/pedinFreeze");

try {
  freezePedin();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
