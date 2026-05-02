const mongoose = require("mongoose");

const sparePartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    partNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      enum: ["SYP", "USD"]
    },
    stock: {
      type: Number,
      required: true,
      min: 0
    },
    carType: {
      type: String,
      required: true,
      trim: true
    },
    carName: {
      type: String,
      required: true,
      trim: true
    },
    modelYearFrom: {
      type: Number,
      required: true,
      min: 2020,
      validate: {
        validator(value) {
          return value <= new Date().getFullYear();
        },
        message: "من سنة الموديل يجب ألا تتجاوز السنة الحالية."
      }
    },
    modelYearTo: {
      type: Number,
      required: true,
      min: 2020,
      validate: {
        validator(value) {
          return value <= new Date().getFullYear();
        },
        message: "إلى سنة الموديل يجب ألا تتجاوز السنة الحالية."
      }
    },
    compatibleModels: {
      type: String,
      required: true,
      trim: true
    },
    origin: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SparePart", sparePartSchema);
