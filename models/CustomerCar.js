const mongoose = require("mongoose");

const customerCarSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
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
    vin: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    color: {
      type: String,
      required: true,
      trim: true
    },
    plateNumber: {
      type: String,
      required: false,
      default: "",
      trim: true
    },
    purchaseDate: {
      type: Date,
      required: true
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
    warrantyUntil: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    specSnapshot: {
      carType: {
        type: String,
        default: "",
        trim: true
      },
      carName: {
        type: String,
        default: "",
        trim: true
      },
      modelYearFrom: {
        type: Number,
        default: null
      },
      modelYearTo: {
        type: Number,
        default: null
      },
      engine: {
        type: String,
        default: "",
        trim: true
      },
      power_hp: {
        type: Number,
        default: null
      },
      torque_nm: {
        type: Number,
        default: null
      },
      transmission: {
        type: String,
        default: "",
        trim: true
      },
      drivetrain: {
        type: String,
        default: "",
        trim: true
      },
      energySource: {
        type: String,
        default: "",
        trim: true
      },
      efficiency: {
        type: String,
        default: "",
        trim: true
      },
      key_safety_features: {
        type: [String],
        default: []
      },
      sourceTitle: {
        type: String,
        default: "",
        trim: true
      },
      sourceUrl: {
        type: String,
        default: "",
        trim: true
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomerCar", customerCarSchema);
