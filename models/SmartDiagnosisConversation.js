const mongoose = require("mongoose");

const smartDiagnosisConversationSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500
    },
    response: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    status: {
      type: String,
      required: true,
      enum: ["accepted", "rejected", "clarification", "error"]
    },
    reasonCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120
    }
  },
  { timestamps: true }
);

smartDiagnosisConversationSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model("SmartDiagnosisConversation", smartDiagnosisConversationSchema);
