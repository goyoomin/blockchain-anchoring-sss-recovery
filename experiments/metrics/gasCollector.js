function requireReceiptGas(receipt) {
  if (!receipt || receipt.gasUsed === undefined || receipt.gasUsed === null) {
    throw new Error("transaction receipt does not contain gasUsed");
  }
  return BigInt(receipt.gasUsed);
}

async function collectTransaction(transactionPromise) {
  const transaction = await transactionPromise;
  const receipt = await transaction.wait();
  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: requireReceiptGas(receipt),
    status: receipt.status,
  };
}

function sumGas(receipts) {
  return receipts.reduce((total, receipt) => total + BigInt(receipt.gasUsed), 0n);
}

module.exports = { requireReceiptGas, collectTransaction, sumGas };
