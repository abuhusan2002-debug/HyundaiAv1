const DECISIONS = {
  ACCEPT: "accept",
  REJECT: "reject",
  CLARIFY: "clarify"
};

const HYUNDAI_ONLY_REJECTION_MESSAGE =
  "هذا المشخص الذكي مخصص لسيارات هيونداي فقط، ولا يمكنني المساعدة في سيارات من شركات أخرى.";
const OUT_OF_SCOPE_REJECTION_MESSAGE =
  "هذا المشخص الذكي مخصص لتشخيص وصيانة سيارات هيونداي فقط.";
const CLARIFICATION_MESSAGE =
  "يرجى توضيح المشكلة لسيارة هيونداي مع ذكر الموديل والسنة والأعراض بشكل مختصر.";

const HYUNDAI_KEYWORDS = [
  "hyundai",
  "هيونداي",
  "هيونداى",
  "هونداي"
];

const HYUNDAI_MODELS = [
  "accent",
  "elantra",
  "sonata",
  "azera",
  "kona",
  "tucson",
  "santa fe",
  "santafe",
  "palisade",
  "creta",
  "bayon",
  "veloster",
  "staria",
  "ioniq",
  "genesis",
  "اكسنت",
  "إكسنت",
  "النترا",
  "إلنترا",
  "سوناتا",
  "ازيرا",
  "أزيرا",
  "كونا",
  "توسان",
  "سانتافي",
  "سنتافي",
  "باليسيد",
  "كريتا",
  "بايون",
  "فيلوستر",
  "ستاريا",
  "ايونيك",
  "أيونيك",
  "جينيسيس"
];

const OTHER_BRAND_KEYWORDS = [
  "toyota",
  "kia",
  "honda",
  "ford",
  "bmw",
  "mercedes",
  "nissan",
  "chevrolet",
  "mazda",
  "lexus",
  "jeep",
  "renault",
  "peugeot",
  "volkswagen",
  "audi",
  "skoda",
  "mitsubishi",
  "suzuki",
  "tesla",
  "فيات",
  "تويوتا",
  "كيا",
  "هوندا",
  "فورد",
  "مرسيدس",
  "نيسان",
  "شيفروليه",
  "مازدا",
  "لكزس",
  "جيب",
  "رينو",
  "بيجو",
  "فولكس",
  "اودي",
  "أودي",
  "سكودا",
  "ميتسوبيشي",
  "سوزوكي",
  "تسلا"
];

const AUTOMOTIVE_SCOPE_KEYWORDS = [
  "عطل",
  "اعطال",
  "أعطال",
  "صيانة",
  "تشخيص",
  "تشخيصي",
  "رمز",
  "كود",
  "code",
  "dtc",
  "engine",
  "check engine",
  "engine light",
  "misfire",
  "oil",
  "filter",
  "brake",
  "battery",
  "coolant",
  "spark",
  "transmission",
  "gear",
  "gearbox",
  "ac",
  "airbag",
  "abs",
  "tpms",
  "vin",
  "محرك",
  "فتيس",
  "ناقل",
  "قير",
  "كهرباء",
  "بطارية",
  "زيت",
  "فلتر",
  "فرامل",
  "ريدياتير",
  "مكيف",
  "تبريد",
  "بنزين",
  "ديزل",
  "هجين",
  "كهربائية",
  "قطعة",
  "قطع غيار",
  "صوت",
  "اهتزاز",
  "لمبة"
];

const INJECTION_PATTERNS = [
  "ignore previous instructions",
  "ignore all instructions",
  "disregard previous",
  "system prompt",
  "developer message",
  "jailbreak",
  "act as",
  "roleplay",
  "do anything now",
  "تجاهل التعليمات",
  "تجاهل جميع التعليمات",
  "اكسر القيود",
  "كسر القيود",
  "غير الموضوع",
  "غيّر الموضوع",
  "افصح عن",
  "أفصح عن",
  "api key",
  "مفتاح api"
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s.:-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function hasObdCodePattern(text) {
  return /\b[pcbu]\d{4}\b/i.test(text);
}

function evaluateSmartDiagnosisScope(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  const normalized = normalizeText(question);

  if (!question || normalized.length < 6) {
    return {
      decision: DECISIONS.CLARIFY,
      reasonCode: "unclear_question",
      message: CLARIFICATION_MESSAGE
    };
  }

  if (includesAny(normalized, INJECTION_PATTERNS)) {
    return {
      decision: DECISIONS.REJECT,
      reasonCode: "prompt_injection_attempt",
      message: OUT_OF_SCOPE_REJECTION_MESSAGE
    };
  }

  const mentionsHyundai = includesAny(normalized, HYUNDAI_KEYWORDS);
  const mentionsHyundaiModel = includesAny(normalized, HYUNDAI_MODELS);
  const mentionsOtherBrand = includesAny(normalized, OTHER_BRAND_KEYWORDS);
  const inAutomotiveScope =
    includesAny(normalized, AUTOMOTIVE_SCOPE_KEYWORDS) || hasObdCodePattern(question);

  if (mentionsOtherBrand) {
    return {
      decision: DECISIONS.REJECT,
      reasonCode: "non_hyundai_brand",
      message: HYUNDAI_ONLY_REJECTION_MESSAGE
    };
  }

  if (!mentionsHyundai && !mentionsHyundaiModel && inAutomotiveScope) {
    return {
      decision: DECISIONS.CLARIFY,
      reasonCode: "hyundai_not_confirmed",
      message: CLARIFICATION_MESSAGE
    };
  }

  if (!inAutomotiveScope) {
    return {
      decision: DECISIONS.REJECT,
      reasonCode: "outside_automotive_scope",
      message: OUT_OF_SCOPE_REJECTION_MESSAGE
    };
  }

  if (!mentionsHyundai && !mentionsHyundaiModel) {
    return {
      decision: DECISIONS.REJECT,
      reasonCode: "outside_hyundai_scope",
      message: OUT_OF_SCOPE_REJECTION_MESSAGE
    };
  }

  return {
    decision: DECISIONS.ACCEPT,
    reasonCode: "valid_hyundai_diagnostic_question",
    message: ""
  };
}

module.exports = {
  DECISIONS,
  HYUNDAI_ONLY_REJECTION_MESSAGE,
  OUT_OF_SCOPE_REJECTION_MESSAGE,
  CLARIFICATION_MESSAGE,
  evaluateSmartDiagnosisScope
};
