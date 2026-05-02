const mongoose = require("mongoose");

const showroomCarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    modelYear: {
      type: Number,
      required: true,
      min: 2020,
      validate: {
        validator(value) {
          return value <= new Date().getFullYear();
        },
        message: "سنة الموديل يجب ألا تتجاوز السنة الحالية."
      }
    },
    category: {
      type: String,
      required: true,
      trim: true
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
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true
    },
    imageUrls: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    available: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShowroomCar", showroomCarSchema);
