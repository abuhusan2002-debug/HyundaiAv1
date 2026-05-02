function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function toTrimmed(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function validateRequiredFields(data, fieldsMap) {
  const errors = [];

  Object.entries(fieldsMap).forEach(([key, label]) => {
    if (isBlank(data[key])) {
      errors.push(`الحقل "${label}" مطلوب.`);
    }
  });

  return errors;
}

function validateNonNegative(value, label, options = {}) {
  const { integerOnly = false } = options;
  const num = Number(value);

  if (Number.isNaN(num)) {
    return `الحقل "${label}" يجب أن يكون رقماً صالحاً.`;
  }

  if (num < 0) {
    return `الحقل "${label}" لا يقبل قيماً سالبة.`;
  }

  if (integerOnly && !Number.isInteger(num)) {
    return `الحقل "${label}" يجب أن يكون رقماً صحيحاً.`;
  }

  return null;
}

function validateModelYear(value, label = "سنة الموديل") {
  const year = Number(value);
  const currentYear = getCurrentYear();

  if (Number.isNaN(year) || !Number.isInteger(year)) {
    return `الحقل "${label}" يجب أن يكون سنة صحيحة.`;
  }

  if (year < 2020 || year > currentYear) {
    return `الحقل "${label}" يجب أن يكون بين 2020 و ${currentYear}.`;
  }

  return null;
}

function isValidEmail(email) {
  const normalized = toTrimmed(email);
  if (!normalized) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

module.exports = {
  isBlank,
  toTrimmed,
  getCurrentYear,
  validateRequiredFields,
  validateNonNegative,
  validateModelYear,
  isValidEmail
};
