function nowNs() {
  return process.hrtime.bigint();
}

function elapsedMs(startNs, endNs = nowNs()) {
  return Number(endNs - startNs) / 1_000_000;
}

async function measureAsync(operation) {
  const start = nowNs();
  const value = await operation();
  return { value, elapsedMs: elapsedMs(start) };
}

function measureSync(operation) {
  const start = nowNs();
  const value = operation();
  return { value, elapsedMs: elapsedMs(start) };
}

module.exports = { nowNs, elapsedMs, measureAsync, measureSync };
