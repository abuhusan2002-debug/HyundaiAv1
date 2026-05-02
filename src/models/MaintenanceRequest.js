const mongoose = require("mongoose");

const maintenanceRequestSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    customerCar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerCar",
      required: true
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician",
      default: null
    },
    requestType: {
      type: String,
      required: true,
      enum: ["صيانة دورية", "إصلاح", "فحص", "أخرى"]
    },
    priority: {
      type: String,
      required: true,
      enum: ["منخفضة", "متوسطة", "عالية"]
    },
    preferredDate: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: ["قيد الانتظار", "مقبول", "مرفوض", "ملغى"],
      default: "قيد الانتظار"
    },
    appointmentDate: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true
    },
    cancellationReason: {
      type: String,
      default: "",
      trim: true
    },
    canceledAt: {
      type: Date,
      default: null
    },
    canceledBy: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
      },
      customerName: {
        type: String,
        default: ""
      }
    },
    adminNote: {
      type: String,
      default: "",
      trim: true
    },
    reviewedBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null
      },
      adminName: {
        type: String,
        default: ""
      }
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
