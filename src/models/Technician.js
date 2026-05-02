const mongoose = require("mongoose");

const SYRIAN_GOVERNORATES = [
  "دمشق",
  "ريف دمشق",
  "حلب",
  "حماة",
  "حمص",
  "دير الزور",
  "درعا",
  "طرطوس",
  "اللاذقية",
  "الرقة",
  "الحسكة",
  "السويداء"
];

const GOVERNORATE_ALIASES = {
  الاذقية: "اللاذقية"
};

function normalizeGovernorate(value) {
  const governorate = String(value || "").trim();
  return GOVERNORATE_ALIASES[governorate] || governorate;
}

const technicianSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    specialty: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    governorate: {
      type: String,
      required: true,
      trim: true,
      enum: SYRIAN_GOVERNORATES
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5
    },
    mobile: {
      type: String,
      default: "",
      trim: true
    },
    whatsapp: {
      type: String,
      default: "",
      trim: true
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    }
  },
  { timestamps: true }
);

technicianSchema.pre("validate", function validateTechnician(next) {
  this.governorate = normalizeGovernorate(this.governorate);

  const hasMobile = Boolean(this.mobile && this.mobile.trim());
  const hasWhatsapp = Boolean(this.whatsapp && this.whatsapp.trim());
  const hasEmail = Boolean(this.email && this.email.trim());

  if (!hasMobile && !hasWhatsapp && !hasEmail) {
    this.invalidate(
      "mobile",
      "يجب إدخال وسيلة تواصل واحدة على الأقل (جوال أو واتس آب أو بريد إلكتروني)."
    );
  }

  return next();
});

module.exports = mongoose.model("Technician", technicianSchema);
