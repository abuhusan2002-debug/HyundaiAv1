const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    city: {
      type: String,
      required: true,
      trim: true,
      enum: SYRIAN_GOVERNORATES
    },
    purchaseSource: {
      type: String,
      required: true,
      enum: ["شركة هيونداي", "وكالة معتمدة"]
    },
    password: {
      type: String,
      required() {
        return this.isNew;
      },
      minlength: 8,
      select: false
    },
    notes: {
      type: String,
      default: "",
      trim: true
    }
  },
  { timestamps: true }
);

customerSchema.pre("save", async function hashCustomerPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

customerSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

customerSchema.set("toJSON", {
  transform: (_, returnedObject) => {
    delete returnedObject.password;
    return returnedObject;
  }
});

module.exports = mongoose.model("Customer", customerSchema);
