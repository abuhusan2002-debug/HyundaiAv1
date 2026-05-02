const mongoose = require("mongoose");
const { normalizeCarToken } = require("../utils/carSpecLookup");

const carSpecificationSchema = new mongoose.Schema(
  {
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
      min: 2020
    },
    modelYearTo: {
      type: Number,
      required: true,
      min: 2020,
      validate: {
        validator(value) {
          return value >= this.modelYearFrom;
        },
        message: "modelYearTo must be greater than or equal to modelYearFrom."
      }
    },
    normalizedCarType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    normalizedCarName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    specifications: {
      engine: {
        type: String,
        required: true,
        trim: true
      },
      power_hp: {
        type: Number,
        required: true,
        min: 0
      },
      torque_nm: {
        type: Number,
        required: true,
        min: 0
      },
      transmission: {
        type: String,
        required: true,
        trim: true
      },
      drivetrain: {
        type: String,
        required: true,
        trim: true
      },
      energySource: {
        type: String,
        required: true,
        trim: true
      },
      efficiency: {
        type: String,
        required: true,
        trim: true
      },
      key_safety_features: {
        type: [String],
        required: true,
        validate: {
          validator(value) {
            return Array.isArray(value) && value.length > 0;
          },
          message: "At least one safety feature is required."
        }
      }
    },
    source: {
      title: {
        type: String,
        required: true,
        trim: true
      },
      url: {
        type: String,
        required: true,
        trim: true
      }
    }
  },
  { timestamps: true }
);

carSpecificationSchema.index(
  { normalizedCarType: 1, normalizedCarName: 1, modelYearFrom: 1, modelYearTo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      normalizedCarType: { $exists: true, $type: "string", $ne: "" },
      normalizedCarName: { $exists: true, $type: "string", $ne: "" }
    }
  }
);

carSpecificationSchema.pre("validate", function preValidate(next) {
  this.normalizedCarType = normalizeCarToken(this.carType);
  this.normalizedCarName = normalizeCarToken(this.carName);
  next();
});

function applyNormalizedToUpdate(update) {
  if (!update) {
    return update;
  }

  const set = update.$set || update;
  const nextCarType = set.carType;
  const nextCarName = set.carName;

  if (typeof nextCarType !== "undefined") {
    set.normalizedCarType = normalizeCarToken(nextCarType);
  }

  if (typeof nextCarName !== "undefined") {
    set.normalizedCarName = normalizeCarToken(nextCarName);
  }

  if (update.$set) {
    update.$set = set;
  }

  return update;
}

carSpecificationSchema.pre("updateOne", function preUpdateOne(next) {
  this.setUpdate(applyNormalizedToUpdate(this.getUpdate()));
  next();
});

carSpecificationSchema.pre("findOneAndUpdate", function preFindOneAndUpdate(next) {
  this.setUpdate(applyNormalizedToUpdate(this.getUpdate()));
  next();
});

module.exports = mongoose.model("CarSpecification", carSpecificationSchema);
