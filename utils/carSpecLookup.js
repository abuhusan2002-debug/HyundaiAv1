const TOKEN_ALIAS_MAP = {
  accent: "accent",
  اكسنت: "accent",
  elantra: "elantra",
  النترا: "elantra",
  sonata: "sonata",
  سوناتا: "sonata",
  "sonatahybrid": "sonatahybrid",
  "سوناتاهايبرد": "sonatahybrid",
  azera: "azera",
  ازيرا: "azera",
  kona: "kona",
  كونا: "kona",
  tucson: "tucson",
  توسان: "tucson",
  "santafe": "santafe",
  "سانتافي": "santafe",
  palisade: "palisade",
  باليسيد: "palisade",
  creta: "creta",
  كريتا: "creta",
  bayon: "bayon",
  بايون: "bayon",
  veloster: "veloster",
  فيلوستر: "veloster",
  staria: "staria",
  ستاريا: "staria",
  "santacruz": "santacruz",
  "سانتاكروز": "santacruz",
  "سانتكروز": "santacruz",
  "ioniq5": "ioniq5",
  "ايونيك5": "ioniq5",
  "ايونك5": "ioniq5",
  "ioniq6": "ioniq6",
  "ايونيك6": "ioniq6",
  "ايونك6": "ioniq6",
  "konaelectric": "konaelectric",
  "كوناكهرباييه": "konaelectric",
  sedan: "sedan",
  سيدان: "sedan",
  suv: "suv",
  "crossover": "crossover",
  "كروساوفر": "crossover",
  "hatchback": "hatchback",
  "هاتشباك": "hatchback",
  "van": "van",
  "فان": "van",
  "pickup": "pickup",
  "بيكاب": "pickup",
  electric: "electric",
  "كهرباييه": "electric",
  hybrid: "hybrid",
  "هجينه": "hybrid"
};

function normalizeCarToken(value) {
  const base = String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\s\-_/]+/g, "")
    .trim();

  return TOKEN_ALIAS_MAP[base] || base;
}

module.exports = {
  normalizeCarToken
};
