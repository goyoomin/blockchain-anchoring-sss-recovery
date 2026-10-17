const ERROR_TYPES = Object.freeze([
  "OUT_OF_GAS",
  "BLOCK_GAS_LIMIT",
  "TIMEOUT",
  "MEMORY_ERROR",
  "CONTRACT_REVERT",
  "MERKLE_VERIFICATION_FAILED",
  "SSS_RECOVERY_FAILED",
  "RPC_ERROR",
  "UNKNOWN",
]);

function classifyFailure(error) {
  if (error && ERROR_TYPES.includes(error.experimentErrorType)) {
    return error.experimentErrorType;
  }
  const text = `${error?.code ?? ""} ${error?.message ?? error ?? ""}`.toLowerCase();
  if (/out of gas|intrinsic gas too low/.test(text)) return "OUT_OF_GAS";
  if (/block gas limit|exceeds block gas/.test(text)) return "BLOCK_GAS_LIMIT";
  if (/timed? ?out|etimeout/.test(text)) return "TIMEOUT";
  if (/heap out of memory|allocation failed/.test(text)) return "MEMORY_ERROR";
  if (/revert|call_exception/.test(text)) return "CONTRACT_REVERT";
  if (/econn|rpc|provider|socket|network_error/.test(text)) return "RPC_ERROR";
  return "UNKNOWN";
}

function experimentError(type, message) {
  const error = new Error(message);
  error.experimentErrorType = type;
  return error;
}

module.exports = { ERROR_TYPES, classifyFailure, experimentError };
