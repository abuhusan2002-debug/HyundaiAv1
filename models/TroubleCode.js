const mongoose = require("mongoose");

const troubleCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    system: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      required: true,
      enum: ["منخفض", "متوسط", "عال"]
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    possibleCauses: {
      type: [String],
      default: []
    },
    suggestedFixes: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    popularRank: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TroubleCode", troubleCodeSchema);
