require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const connectDB = require("./src/config/db");
const Admin = require("./src/models/Admin");
const Customer = require("./src/models/Customer");
const TroubleCode = require("./src/models/TroubleCode");
const CarSpecification = require("./src/models/CarSpecification");
const hyundaiTroubleCodes = require("./src/data/hyundaiTroubleCodes");
const hyundaiCarSpecifications = require("./src/data/hyundaiCarSpecifications");
const { normalizeCarToken } = require("./src/utils/carSpecLookup");
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const adminApiRoutes = require("./src/routes/adminApiRoutes");
const userRoutes = require("./src/routes/userRoutes");
const userApiRoutes = require("./src/routes/userApiRoutes");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(express.json({ limit: "8mb" }));
app.use("/admin", (req, res, next) => {
  if (req.path.endsWith(".html")) {
    return res.redirect("/admin/dashboard");
  }
  return next();
});
app.use("/user", (req, res, next) => {
  if (req.path.endsWith(".html")) {
    return res.redirect("/user/home");
  }
  return next();
});
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.get("/", (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  if (req.session.customer) {
    return res.redirect("/user/home");
  }
  return res.redirect("/login");
});

app.use("/", authRoutes);
app.use("/admin", adminRoutes);
app.use("/api/admin", adminApiRoutes);
app.use("/user", userRoutes);
app.use("/api/user", userApiRoutes);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "المسار غير موجود." });
  }
  return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

async function seedDefaultAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@hyundai-syria.com")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";

  const exists = await Admin.findOne({ email });
  if (exists) {
    return;
  }

  await Admin.create({
    name: "مدير ما بعد البيع",
    email,
    password
  });

  // eslint-disable-next-line no-console
  console.log("Default admin account created:", email);
}

async function backfillCustomerUsernames() {
  const customers = await Customer.find({
    $or: [{ username: { $exists: false } }, { username: null }, { username: "" }]
  }).select("fullName phone");

  for (const customer of customers) {
    const phoneDigits = String(customer.phone || "").replace(/\D/g, "");
    let baseUsername = `user${phoneDigits || String(customer._id).slice(-6)}`.toLowerCase();
    if (baseUsername.length < 3) {
      baseUsername = `user${String(customer._id).slice(-6)}`;
    }

    let candidate = baseUsername;
    let counter = 1;
    // Ensure username uniqueness for old records without username.
    while (await Customer.exists({ _id: { $ne: customer._id }, username: candidate })) {
      counter += 1;
      candidate = `${baseUsername}${counter}`;
    }

    customer.username = candidate;
    await customer.save();
  }
}

async function seedTroubleCodes() {
  for (const entry of hyundaiTroubleCodes) {
    await TroubleCode.updateOne(
      { code: entry.code },
      { $set: entry },
      { upsert: true }
    );
  }
}

async function backfillCarSpecNormalizedFields() {
  const invalidDocs = await CarSpecification.find({
    $or: [
      { normalizedCarType: { $in: [null, ""] } },
      { normalizedCarName: { $in: [null, ""] } }
    ]
  }).select("_id carType carName modelYearFrom modelYearTo");

  for (const doc of invalidDocs) {
    const normalizedCarType = normalizeCarToken(doc.carType);
    const normalizedCarName = normalizeCarToken(doc.carName);

    if (!normalizedCarType || !normalizedCarName) {
      await CarSpecification.deleteOne({ _id: doc._id });
      continue;
    }

    try {
      await CarSpecification.updateOne(
        { _id: doc._id },
        {
          $set: {
            normalizedCarType,
            normalizedCarName
          }
        }
      );
    } catch (error) {
      // If a valid duplicate already exists, keep one and remove the broken duplicate.
      if (error && error.code === 11000) {
        await CarSpecification.deleteOne({ _id: doc._id });
      } else {
        throw error;
      }
    }
  }
}

async function seedCarSpecifications() {
  const operations = [];

  for (const entry of hyundaiCarSpecifications) {
    const carType = String(entry.carType || "").trim();
    const carName = String(entry.carName || "").trim();
    const modelYearFrom = Number(entry.modelYearFrom);
    const modelYearTo = Number(entry.modelYearTo);
    const normalizedCarType = normalizeCarToken(carType);
    const normalizedCarName = normalizeCarToken(carName);

    const rowIsValid =
      carType &&
      carName &&
      normalizedCarType &&
      normalizedCarName &&
      Number.isInteger(modelYearFrom) &&
      Number.isInteger(modelYearTo);

    if (!rowIsValid) {
      // eslint-disable-next-line no-console
      console.warn("Skipped invalid car spec seed row:", entry);
      continue;
    }

    operations.push({
      updateOne: {
        filter: {
          normalizedCarType,
          normalizedCarName,
          modelYearFrom,
          modelYearTo
        },
        update: {
          $set: {
            ...entry,
            carType,
            carName,
            modelYearFrom,
            modelYearTo,
            normalizedCarType,
            normalizedCarName
          }
        },
        upsert: true
      }
    });
  }

  if (operations.length) {
    await CarSpecification.bulkWrite(operations, { ordered: false });
  }
}

async function bootstrap() {
  await connectDB();
  await seedDefaultAdmin();
  await backfillCustomerUsernames();
  await seedTroubleCodes();
  await backfillCarSpecNormalizedFields();
  await seedCarSpecifications();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
