const { experimentConfig } = require("../config/experimentConfig");

function scheduleFor(repetition) {
  if (!Number.isInteger(repetition) || repetition < 1) {
    throw new RangeError("repetition must be a positive integer");
  }
  const perShareFirst = repetition % 2 === 1;
  return {
    sequence: perShareFirst ? "PER_SHARE_FIRST" : "MERKLE_ROOT_FIRST",
    mechanisms: perShareFirst
      ? ["PER_SHARE", "MERKLE_ROOT"]
      : ["MERKLE_ROOT", "PER_SHARE"],
  };
}

function buildSchedule({
  nValues = experimentConfig.mainNValues,
  repetitions = experimentConfig.repetitions,
} = {}) {
  const schedule = [];
  for (const n of nValues) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const current = scheduleFor(repetition);
      current.mechanisms.forEach((mechanism, index) => {
        schedule.push({
          n,
          repetition,
          mechanism,
          sequence: current.sequence,
          position: index === 0 ? "FIRST" : "SECOND",
        });
      });
    }
  }
  return schedule;
}

module.exports = { scheduleFor, buildSchedule };
