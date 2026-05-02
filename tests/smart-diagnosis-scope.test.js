const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DECISIONS,
  evaluateSmartDiagnosisScope
} = require("../src/services/smartDiagnosisScopeGuard");

test("يقبل سؤال صيانة متعلق بسيارة هيونداي", () => {
  const result = evaluateSmartDiagnosisScope("سيارتي Hyundai Elantra فيها اهتزاز عند التسارع، ما السبب؟");
  assert.equal(result.decision, DECISIONS.ACCEPT);
});

test("يرفض سؤال عن شركة سيارات أخرى", () => {
  const result = evaluateSmartDiagnosisScope("عندي مشكلة في Toyota Corolla ولمبة المحرك مضاءة.");
  assert.equal(result.decision, DECISIONS.REJECT);
  assert.match(result.message, /هيونداي فقط/);
});

test("يرفض سؤال خارج مجال تشخيص وصيانة السيارات", () => {
  const result = evaluateSmartDiagnosisScope("ما هي أفضل طريقة لتعلم البرمجة؟");
  assert.equal(result.decision, DECISIONS.REJECT);
});
