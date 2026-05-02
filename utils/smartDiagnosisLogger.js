function buildLogRecord(event, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    scope: "smart_diagnosis",
    event,
    requestId: meta.requestId || "",
    customerId: meta.customerId || "",
    decision: meta.decision || "",
    reasonCode: meta.reasonCode || "",
    questionLength: Number(meta.questionLength || 0),
    statusCode: Number(meta.statusCode || 0),
    latencyMs: Number(meta.latencyMs || 0),
    errorCode: meta.errorCode || "",
    providerStatusCode: Number(meta.providerStatusCode || 0),
    providerMessage: String(meta.providerMessage || "").slice(0, 250)
  };
}

function logSmartDiagnosisEvent(event, meta = {}) {
  const record = buildLogRecord(event, meta);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
}

module.exports = {
  logSmartDiagnosisEvent
};
