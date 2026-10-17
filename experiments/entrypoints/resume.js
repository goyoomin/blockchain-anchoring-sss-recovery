// Resume is intentionally the same deterministic suite as main. The runner
// skips every already-recorded experiment_id, including failures, so failed
// observations are never silently replaced by successful retries.
require("./main");
