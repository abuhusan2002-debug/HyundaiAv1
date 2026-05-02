const fs = require("fs");
const path = require("path");
const express = require("express");

const { ensureAuth } = require("../middleware/auth");
const Customer = require("../models/Customer");
const CustomerCar = require("../models/CustomerCar");
const CarSpecification = require("../models/CarSpecification");
const ShowroomCar = require("../models/ShowroomCar");
const Technician = require("../models/Technician");
const SparePart = require("../models/SparePart");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const { normalizeCarToken } = require("../utils/carSpecLookup");
const {
  toTrimmed,
  isBlank,
  validateRequiredFields,
  validateModelYear,
  validateNonNegative,
  isValidEmail
} = require("../utils/validators");

const router = express.Router();

router.use(ensureAuth);

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
  const city = toTrimmed(value);
  return GOVERNORATE_ALIASES[city] || city;
}

function collectErrors(errors) {
  return errors.filter(Boolean);
}

function sendValidationError(res, errors, fallback = "المدخلات غير صحيحة.") {
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }
  return res.status(400).json({ success: false, message: fallback });
}

function isCurrencyValid(currency) {
  return ["SYP", "USD"].includes(currency);
}

function parseCustomerPayload(body) {
  return {
    fullName: toTrimmed(body.fullName),
    phone: toTrimmed(body.phone),
    username: toTrimmed(body.username).toLowerCase(),
    city: normalizeGovernorate(body.city),
    purchaseSource: toTrimmed(body.purchaseSource),
    password: toTrimmed(body.password),
    notes: toTrimmed(body.notes)
  };
}

function getCustomerDuplicateMessage(error) {
  if (!error || error.code !== 11000) {
    return null;
  }

  if (error.keyPattern?.username || String(error.message || "").includes("username")) {
    return "اسم المستخدم مستخدم مسبقاً لعميل آخر.";
  }

  if (error.keyPattern?.phone || String(error.message || "").includes("phone")) {
    return "رقم الجوال مستخدم مسبقاً لعميل آخر.";
  }

  return "هذه البيانات مستخدمة مسبقاً لعميل آخر.";
}

function validateCustomerPayload(payload, options = {}) {
  const { isUpdate = false } = options;

  const requiredFields = {
    fullName: "اسم العميل",
    phone: "رقم الجوال",
    username: "اسم المستخدم",
    city: "المدينة",
    purchaseSource: "مصدر الشراء"
  };

  if (!isUpdate) {
    requiredFields.password = "كلمة المرور";
  }

  return collectErrors([
    ...validateRequiredFields(payload, requiredFields),
    !SYRIAN_GOVERNORATES.includes(payload.city)
      ? "يرجى اختيار محافظة سورية صحيحة من القائمة."
      : null,
    !["شركة هيونداي", "وكالة معتمدة"].includes(payload.purchaseSource)
      ? "مصدر الشراء يجب أن يكون شركة هيونداي أو وكالة معتمدة."
      : null,
    (!isUpdate || !isBlank(payload.password)) && payload.password.length < 8
      ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
      : null
  ]);
}

function parseCustomerCarPayload(body) {
  return {
    customer: toTrimmed(body.customerId || body.customer),
    customerFullName: toTrimmed(body.customerFullName),
    customerPhone: toTrimmed(body.customerPhone),
    carType: toTrimmed(body.carType),
    carName: toTrimmed(body.carName),
    modelYear: Number(body.modelYear),
    vin: toTrimmed(body.vin).toUpperCase(),
    color: toTrimmed(body.color),
    purchaseDate: toTrimmed(body.purchaseDate),
    price: Number(body.price),
    currency: toTrimmed(body.currency),
    warrantyUntil: toTrimmed(body.warrantyUntil) || null,
    notes: toTrimmed(body.notes)
  };
}

function validateCustomerCarPayload(payload, body) {
  const customerReference = payload.customer || payload.customerFullName;

  const requiredFields = {
    customer: "اسم العميل الثلاثي",
    carType: "نوع السيارة",
    carName: "اسم السيارة",
    modelYear: "سنة الموديل",
    vin: "رقم الهيكل (VIN)",
    color: "اللون",
    purchaseDate: "تاريخ الشراء",
    price: "السعر",
    currency: "العملة"
  };

  if (!payload.customer) {
    requiredFields.customerPhone = "رقم جوال العميل";
  }

  return collectErrors([
    ...validateRequiredFields(
      {
        customer: customerReference,
        customerPhone: payload.customerPhone,
        carType: payload.carType,
        carName: payload.carName,
        modelYear: body.modelYear,
        vin: payload.vin,
        color: payload.color,
        purchaseDate: payload.purchaseDate,
        price: body.price,
        currency: payload.currency
      },
      requiredFields
    ),
    validateModelYear(body.modelYear),
    validateNonNegative(body.price, "السعر"),
    !isCurrencyValid(payload.currency) ? "العملة يجب أن تكون SYP أو USD." : null
  ]);
}

async function resolveCustomerFromPayload(payload) {
  if (payload.customer) {
    const byId = await Customer.findById(payload.customer);
    if (byId) {
      payload.customerFullName = byId.fullName;
      payload.customerPhone = byId.phone;
      return { customer: byId, error: null };
    }
  }

  const fullName = payload.customerFullName;
  const phone = payload.customerPhone;
  if (!fullName || !phone) {
    return { customer: null, error: "يجب إدخال الاسم الثلاثي ورقم الجوال للعميل." };
  }

  const exactMatch = await Customer.findOne({ fullName, phone });
  if (exactMatch) {
    payload.customer = String(exactMatch._id);
    return { customer: exactMatch, error: null };
  }

  const byPhone = await Customer.findOne({ phone });
  if (byPhone && byPhone.fullName !== fullName) {
    return {
      customer: null,
      error: "رقم الجوال موجود لكن الاسم الثلاثي لا يطابق الحساب المسجل."
    };
  }

  const byNameCount = await Customer.countDocuments({ fullName });
  if (byNameCount > 1) {
    return {
      customer: null,
      error: "يوجد أكثر من عميل بنفس الاسم الثلاثي. أضف رقم جوال صحيح مطابق للحساب المطلوب."
    };
  }

  return {
    customer: null,
    error: "العميل غير موجود. تحقق من الاسم الثلاثي ورقم الجوال، أو أنشئ حساب العميل أولاً."
  };
}

async function findCarSpecification(payload) {
  const modelYear = Number(payload.modelYear);
  if (!Number.isInteger(modelYear)) {
    return null;
  }

  const normalizedCarType = normalizeCarToken(payload.carType);
  const normalizedCarName = normalizeCarToken(payload.carName);

  if (!normalizedCarType || !normalizedCarName) {
    return null;
  }

  return CarSpecification.findOne({
    normalizedCarType,
    normalizedCarName,
    modelYearFrom: { $lte: modelYear },
    modelYearTo: { $gte: modelYear }
  });
}

function createSpecSnapshot(specDoc) {
  if (!specDoc) {
    return null;
  }

  return {
    carType: specDoc.carType,
    carName: specDoc.carName,
    modelYearFrom: specDoc.modelYearFrom,
    modelYearTo: specDoc.modelYearTo,
    engine: specDoc.specifications?.engine || "",
    power_hp: Number.isFinite(specDoc.specifications?.power_hp)
      ? specDoc.specifications.power_hp
      : null,
    torque_nm: Number.isFinite(specDoc.specifications?.torque_nm)
      ? specDoc.specifications.torque_nm
      : null,
    transmission: specDoc.specifications?.transmission || "",
    drivetrain: specDoc.specifications?.drivetrain || "",
    energySource: specDoc.specifications?.energySource || "",
    efficiency: specDoc.specifications?.efficiency || "",
    key_safety_features: Array.isArray(specDoc.specifications?.key_safety_features)
      ? specDoc.specifications.key_safety_features
      : [],
    sourceTitle: specDoc.source?.title || "",
    sourceUrl: specDoc.source?.url || ""
  };
}
function parseShowroomCarPayload(body) {
  const rawImageDataUrls = Array.isArray(body.imageDataUrls)
    ? body.imageDataUrls
    : body.imageDataUrl
      ? [body.imageDataUrl]
      : [];
  const rawExistingImageUrls = Array.isArray(body.existingImageUrls)
    ? body.existingImageUrls
    : body.existingImageUrl
      ? [body.existingImageUrl]
      : [];

  return {
    name: toTrimmed(body.name),
    modelYear: Number(body.modelYear),
    category: toTrimmed(body.category),
    price: Number(body.price),
    currency: toTrimmed(body.currency),
    quantity: Number(body.quantity),
    imageDataUrls: rawImageDataUrls.map((item) => toTrimmed(item)).filter(Boolean),
    existingImageUrls: rawExistingImageUrls.map((item) => toTrimmed(item)).filter(Boolean),
    description: toTrimmed(body.description),
    available: Boolean(body.available)
  };
}

function validateShowroomCarPayload(payload, body) {
  const invalidImageDataUrl = payload.imageDataUrls.find(
    (item) => !/^data:image\/(png|jpeg|jpg);base64,/i.test(item)
  );

  return collectErrors([
    ...validateRequiredFields(
      {
        name: payload.name,
        modelYear: body.modelYear,
        category: payload.category,
        price: body.price,
        currency: payload.currency,
        quantity: body.quantity,
        description: payload.description
      },
      {
        name: "اسم السيارة",
        modelYear: "سنة الموديل",
        category: "الفئة",
        price: "السعر",
        currency: "العملة",
        quantity: "الكمية",
        description: "الوصف"
      }
    ),
    validateModelYear(body.modelYear),
    validateNonNegative(body.price, "السعر"),
    validateNonNegative(body.quantity, "الكمية", { integerOnly: true }),
    invalidImageDataUrl ? "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو JPEG." : null,
    !isCurrencyValid(payload.currency) ? "العملة يجب أن تكون SYP أو USD." : null
  ]);
}

function getShowroomUploadsDir() {
  return path.join(process.cwd(), "public", "uploads", "showroom-cars");
}

function buildShowroomImagePublicPath(fileName) {
  return `/uploads/showroom-cars/${fileName}`;
}

function isShowroomUploadPath(value) {
  return /^\/uploads\/showroom-cars\/[a-z0-9._-]+$/i.test(String(value || ""));
}

async function saveShowroomImageFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) {
    throw new Error("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو JPEG.");
  }

  const mime = match[1].toLowerCase();
  const base64Body = match[2];
  const extension = mime === "png" ? "png" : "jpg";
  const fileName = `showroom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const uploadsDir = getShowroomUploadsDir();
  const absoluteFilePath = path.join(uploadsDir, fileName);

  await fs.promises.mkdir(uploadsDir, { recursive: true });
  await fs.promises.writeFile(absoluteFilePath, Buffer.from(base64Body, "base64"));

  return buildShowroomImagePublicPath(fileName);
}

async function saveShowroomImagesFromDataUrls(dataUrls) {
  const input = Array.isArray(dataUrls) ? dataUrls : [];
  const savedImageUrls = [];

  for (const item of input) {
    const savedPath = await saveShowroomImageFromDataUrl(item);
    savedImageUrls.push(savedPath);
  }

  return savedImageUrls;
}

async function removeShowroomImageIfExists(imageUrl) {
  if (!isShowroomUploadPath(imageUrl)) {
    return;
  }

  const uploadsDir = getShowroomUploadsDir();
  const fileName = imageUrl.split("/").pop();
  const absoluteFilePath = path.join(uploadsDir, fileName);
  const normalizedUploads = path.resolve(uploadsDir);
  const normalizedFile = path.resolve(absoluteFilePath);

  if (!normalizedFile.startsWith(normalizedUploads)) {
    return;
  }

  try {
    await fs.promises.unlink(normalizedFile);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function removeShowroomImagesIfExist(imageUrls) {
  const urls = Array.isArray(imageUrls) ? imageUrls : [];
  for (const imageUrl of urls) {
    await removeShowroomImageIfExists(imageUrl);
  }
}

function normalizeShowroomImageUrls(carDocOrObject) {
  const imageUrls = Array.isArray(carDocOrObject?.imageUrls)
    ? carDocOrObject.imageUrls
    : [];
  const legacyImage = toTrimmed(carDocOrObject?.imageUrl);
  const combined = legacyImage ? [...imageUrls, legacyImage] : imageUrls;
  return Array.from(
    new Set(
      combined
        .map((item) => toTrimmed(item))
        .filter(Boolean)
    )
  );
}

function parseTechnicianPayload(body) {
  return {
    fullName: toTrimmed(body.fullName),
    specialty: toTrimmed(body.specialty),
    address: toTrimmed(body.address),
    governorate: normalizeGovernorate(body.governorate),
    rating: Number(body.rating),
    mobile: toTrimmed(body.mobile),
    whatsapp: toTrimmed(body.whatsapp),
    email: toTrimmed(body.email).toLowerCase(),
    notes: toTrimmed(body.notes)
  };
}

function validateTechnicianPayload(payload, body) {
  const hasContact =
    !isBlank(payload.mobile) || !isBlank(payload.whatsapp) || !isBlank(payload.email);

  return collectErrors([
    ...validateRequiredFields(
      {
        fullName: payload.fullName,
        specialty: payload.specialty,
        address: payload.address,
        governorate: payload.governorate,
        rating: body.rating
      },
      {
        fullName: "اسم الفني",
        specialty: "التخصص",
        address: "العنوان",
        governorate: "المحافظة",
        rating: "التقييم"
      }
    ),
    !SYRIAN_GOVERNORATES.includes(payload.governorate)
      ? "يرجى اختيار محافظة سورية صحيحة من القائمة."
      : null,
    validateNonNegative(body.rating, "التقييم"),
    payload.rating > 5 ? "قيمة التقييم يجب ألا تتجاوز 5." : null,
    !hasContact
      ? "يجب إدخال وسيلة تواصل واحدة على الأقل (جوال أو واتس آب أو بريد إلكتروني)."
      : null,
    !isValidEmail(payload.email) ? "صيغة البريد الإلكتروني غير صحيحة." : null
  ]);
}

function parseSparePartPayload(body) {
  return {
    name: toTrimmed(body.name),
    partNumber: toTrimmed(body.partNumber).toUpperCase(),
    price: Number(body.price),
    currency: toTrimmed(body.currency),
    stock: Number(body.stock),
    carType: toTrimmed(body.carType),
    carName: toTrimmed(body.carName),
    modelYearFrom: Number(body.modelYearFrom),
    modelYearTo: Number(body.modelYearTo),
    origin: toTrimmed(body.origin),
    description: toTrimmed(body.description)
  };
}

function validateSparePartPayload(payload, body) {
  const rangeError =
    Number(body.modelYearFrom) > Number(body.modelYearTo)
      ? "سنة البداية يجب ألا تكون أكبر من سنة النهاية."
      : null;

  return collectErrors([
    ...validateRequiredFields(
      {
        name: payload.name,
        partNumber: payload.partNumber,
        price: body.price,
        currency: payload.currency,
        stock: body.stock,
        carType: payload.carType,
        carName: payload.carName,
        modelYearFrom: body.modelYearFrom,
        modelYearTo: body.modelYearTo,
        origin: payload.origin,
        description: payload.description
      },
      {
        name: "اسم القطعة",
        partNumber: "رقم القطعة",
        price: "السعر",
        currency: "العملة",
        stock: "الكمية المتوفرة",
        carType: "نوع السيارة",
        carName: "اسم السيارة",
        modelYearFrom: "من سنة الموديل",
        modelYearTo: "إلى سنة الموديل",
        origin: "بلد المنشأ",
        description: "الوصف"
      }
    ),
    validateModelYear(body.modelYearFrom, "من سنة الموديل"),
    validateModelYear(body.modelYearTo, "إلى سنة الموديل"),
    rangeError,
    validateNonNegative(body.price, "السعر"),
    validateNonNegative(body.stock, "الكمية المتوفرة", { integerOnly: true }),
    !isCurrencyValid(payload.currency) ? "العملة يجب أن تكون SYP أو USD." : null
  ]);
}

function applySparePartCompatibilityLabel(payload) {
  const fromYear = Number(payload.modelYearFrom);
  const toYear = Number(payload.modelYearTo);
  payload.compatibleModels = `${payload.carType} - ${payload.carName} (${fromYear}-${toYear})`;
  return payload;
}

function parseMaintenanceReviewPayload(body) {
  return {
    decision: toTrimmed(body.decision),
    appointmentDate: toTrimmed(body.appointmentDate) || null,
    rejectionReason: toTrimmed(body.rejectionReason),
    adminNote: toTrimmed(body.adminNote)
  };
}

function validateMaintenanceReviewPayload(payload) {
  if (!["مقبول", "مرفوض"].includes(payload.decision)) {
    return "يجب اختيار قرار صحيح (مقبول أو مرفوض).";
  }

  if (payload.decision === "مقبول" && isBlank(payload.appointmentDate)) {
    return "عند قبول الطلب يجب تحديد موعد للعميل.";
  }

  if (payload.decision === "مقبول" && Number.isNaN(new Date(payload.appointmentDate).getTime())) {
    return "صيغة موعد العميل غير صحيحة.";
  }

  if (payload.decision === "مقبول") {
    const appointment = new Date(payload.appointmentDate);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (appointment < startOfToday) {
      return "موعد العميل يجب أن يكون اليوم أو تاريخاً مستقبلياً.";
    }
  }

  if (payload.decision === "مرفوض" && isBlank(payload.rejectionReason)) {
    return "عند رفض الطلب يجب إدخال سبب الرفض.";
  }

  return null;
}
router.get("/dashboard/stats", async (req, res) => {
  const [
    customersCount,
    customerCarsCount,
    showroomCarsCount,
    techniciansCount,
    sparePartsCount,
    maintenanceRequestsCount
  ] = await Promise.all([
    Customer.countDocuments(),
    CustomerCar.countDocuments(),
    ShowroomCar.countDocuments(),
    Technician.countDocuments(),
    SparePart.countDocuments(),
    MaintenanceRequest.countDocuments()
  ]);

  return res.json({
    success: true,
    data: {
      customersCount,
      customerCarsCount,
      showroomCarsCount,
      techniciansCount,
      sparePartsCount,
      maintenanceRequestsCount
    }
  });
});

router.get("/customers/options", async (req, res) => {
  const customers = await Customer.find().sort({ fullName: 1 });
  return res.json({
    success: true,
    data: customers.map((customer) => ({
      _id: customer._id,
      fullName: customer.fullName,
      phone: customer.phone
    }))
  });
});

router.get("/car-specs/resolve", async (req, res) => {
  const payload = {
    carType: toTrimmed(req.query.carType),
    carName: toTrimmed(req.query.carName),
    modelYear: Number(req.query.modelYear)
  };

  if (!payload.carType || !payload.carName || !Number.isInteger(payload.modelYear)) {
    return res.status(400).json({
      success: false,
      message: "يرجى اختيار نوع السيارة واسمها وسنة موديل صحيحة."
    });
  }

  const validationError = validateModelYear(payload.modelYear, "سنة الموديل");
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const specDoc = await findCarSpecification(payload);
  if (!specDoc) {
    return res.status(404).json({
      success: false,
      message: "لم يتم العثور على مواصفات معتمدة لهذه السيارة في قاعدة البيانات."
    });
  }

  return res.json({ success: true, data: createSpecSnapshot(specDoc) });
});

router.get("/customers", async (req, res) => {
  const customers = await Customer.find().sort({ createdAt: -1 });
  return res.json({ success: true, data: customers });
});

router.post("/customers", async (req, res) => {
  try {
    const payload = parseCustomerPayload(req.body);
    const errors = validateCustomerPayload(payload, { isUpdate: false });

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const customer = await Customer.create(payload);
    return res.status(201).json({
      success: true,
      message: "تم إنشاء حساب العميل بنجاح.",
      data: customer
    });
  } catch (error) {
    const duplicateMessage = getCustomerDuplicateMessage(error);
    if (duplicateMessage) {
      return res.status(400).json({ success: false, message: duplicateMessage });
    }
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء إنشاء حساب العميل." });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const payload = parseCustomerPayload(req.body);
    const errors = validateCustomerPayload(payload, { isUpdate: true });

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const customer = await Customer.findById(req.params.id).select("+password");

    if (!customer) {
      return res.status(404).json({ success: false, message: "العميل غير موجود." });
    }

    customer.fullName = payload.fullName;
    customer.phone = payload.phone;
    customer.username = payload.username;
    customer.city = payload.city;
    customer.purchaseSource = payload.purchaseSource;
    customer.notes = payload.notes;

    if (!isBlank(payload.password)) {
      customer.password = payload.password;
    }

    await customer.save();

    return res.json({
      success: true,
      message: "تم تعديل بيانات العميل بنجاح.",
      data: customer
    });
  } catch (error) {
    const duplicateMessage = getCustomerDuplicateMessage(error);
    if (duplicateMessage) {
      return res.status(400).json({ success: false, message: duplicateMessage });
    }
    return res.status(500).json({ success: false, message: "تعذر تعديل بيانات العميل." });
  }
});

router.delete("/customers/:id", async (req, res) => {
  const carsCount = await CustomerCar.countDocuments({ customer: req.params.id });
  if (carsCount > 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف العميل لأنه يملك سيارات مسجلة. احذف سياراته أولاً."
    });
  }

  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "العميل غير موجود." });
  }

  return res.json({ success: true, message: "تم حذف العميل بنجاح." });
});

router.get("/customer-cars", async (req, res) => {
  const cars = await CustomerCar.find().populate("customer").sort({ createdAt: -1 });
  return res.json({ success: true, data: cars });
});

router.post("/customer-cars", async (req, res) => {
  try {
    const payload = parseCustomerCarPayload(req.body);
    const errors = validateCustomerCarPayload(payload, req.body);

    const resolution = await resolveCustomerFromPayload(payload);
    if (!resolution.customer) {
      errors.push(resolution.error || "لا يمكن إضافة سيارة بدون حساب عميل موجود.");
    }

    const specDoc = await findCarSpecification(payload);
    if (!specDoc) {
      errors.push("لا توجد مواصفات معتمدة لهذه السيارة في قاعدة البيانات. أضف المواصفات أولاً ثم أعد المحاولة.");
    }

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const { customerFullName, customerPhone, ...persistPayload } = payload;
    persistPayload.specSnapshot = createSpecSnapshot(specDoc);

    const customerCar = await CustomerCar.create(persistPayload);
    return res.status(201).json({
      success: true,
      message: "تمت إضافة سيارة العميل بنجاح.",
      data: customerCar
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "رقم الهيكل (VIN) مسجل مسبقاً." });
    }

    return res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة سيارة العميل." });
  }
});

router.put("/customer-cars/:id", async (req, res) => {
  try {
    const payload = parseCustomerCarPayload(req.body);
    const errors = validateCustomerCarPayload(payload, req.body);

    const resolution = await resolveCustomerFromPayload(payload);
    if (!resolution.customer) {
      errors.push(resolution.error || "لا يمكن حفظ السيارة بدون اختيار عميل موجود.");
    }

    const specDoc = await findCarSpecification(payload);
    if (!specDoc) {
      errors.push("لا توجد مواصفات معتمدة لهذه السيارة في قاعدة البيانات. أضف المواصفات أولاً ثم أعد المحاولة.");
    }

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const { customerFullName, customerPhone, ...persistPayload } = payload;
    persistPayload.specSnapshot = createSpecSnapshot(specDoc);

    const car = await CustomerCar.findByIdAndUpdate(req.params.id, persistPayload, {
      new: true,
      runValidators: true
    });

    if (!car) {
      return res.status(404).json({ success: false, message: "سيارة العميل غير موجودة." });
    }

    return res.json({
      success: true,
      message: "تم تعديل سيارة العميل بنجاح.",
      data: car
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "رقم الهيكل (VIN) مسجل مسبقاً." });
    }

    return res.status(500).json({ success: false, message: "تعذر تعديل سيارة العميل." });
  }
});

router.delete("/customer-cars/:id", async (req, res) => {
  const car = await CustomerCar.findByIdAndDelete(req.params.id);
  if (!car) {
    return res.status(404).json({ success: false, message: "سيارة العميل غير موجودة." });
  }
  return res.json({ success: true, message: "تم حذف سيارة العميل بنجاح." });
});
router.get("/showroom-cars", async (req, res) => {
  const cars = await ShowroomCar.find().sort({ createdAt: -1 });
  const normalizedCars = cars.map((car) => {
    const object = car.toObject();
    object.imageUrls = normalizeShowroomImageUrls(object);
    object.imageUrl = object.imageUrls[0] || "";
    return object;
  });
  return res.json({ success: true, data: normalizedCars });
});

router.post("/showroom-cars", async (req, res) => {
  try {
    const payload = parseShowroomCarPayload(req.body);
    const errors = validateShowroomCarPayload(payload, req.body);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const imageUrls = await saveShowroomImagesFromDataUrls(payload.imageDataUrls);

    const showroomCar = await ShowroomCar.create({
      name: payload.name,
      modelYear: payload.modelYear,
      category: payload.category,
      price: payload.price,
      currency: payload.currency,
      quantity: payload.quantity,
      imageUrls,
      imageUrl: imageUrls[0] || "",
      description: payload.description,
      available: payload.available
    });

    return res.status(201).json({
      success: true,
      message: "تمت إضافة سيارة جديدة إلى المعرض.",
      data: showroomCar
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة سيارة المعرض." });
  }
});

router.put("/showroom-cars/:id", async (req, res) => {
  try {
    const payload = parseShowroomCarPayload(req.body);
    const errors = validateShowroomCarPayload(payload, req.body);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const existingCar = await ShowroomCar.findById(req.params.id);
    if (!existingCar) {
      return res.status(404).json({ success: false, message: "سيارة المعرض غير موجودة." });
    }

    const previousImageUrls = normalizeShowroomImageUrls(existingCar);
    const retainedExistingUrls = payload.existingImageUrls.filter((item) =>
      previousImageUrls.includes(item)
    );
    const newlyUploadedUrls = await saveShowroomImagesFromDataUrls(payload.imageDataUrls);
    const nextImageUrls = Array.from(
      new Set([...retainedExistingUrls, ...newlyUploadedUrls].filter(Boolean))
    );
    const removedImageUrls = previousImageUrls.filter((item) => !nextImageUrls.includes(item));
    await removeShowroomImagesIfExist(removedImageUrls);

    existingCar.name = payload.name;
    existingCar.modelYear = payload.modelYear;
    existingCar.category = payload.category;
    existingCar.price = payload.price;
    existingCar.currency = payload.currency;
    existingCar.quantity = payload.quantity;
    existingCar.imageUrls = nextImageUrls;
    existingCar.imageUrl = nextImageUrls[0] || "";
    existingCar.description = payload.description;
    existingCar.available = payload.available;

    const car = await existingCar.save();

    return res.json({ success: true, message: "تم تعديل بيانات سيارة المعرض.", data: car });
  } catch (error) {
    return res.status(500).json({ success: false, message: "تعذر تعديل سيارة المعرض." });
  }
});

router.delete("/showroom-cars/:id", async (req, res) => {
  const car = await ShowroomCar.findByIdAndDelete(req.params.id);
  if (!car) {
    return res.status(404).json({ success: false, message: "سيارة المعرض غير موجودة." });
  }
  await removeShowroomImagesIfExist(normalizeShowroomImageUrls(car));
  return res.json({ success: true, message: "تم حذف سيارة المعرض بنجاح." });
});

router.get("/technicians", async (req, res) => {
  const technicians = await Technician.find().sort({ createdAt: -1 });
  return res.json({ success: true, data: technicians });
});

router.post("/technicians", async (req, res) => {
  try {
    const payload = parseTechnicianPayload(req.body);
    const errors = validateTechnicianPayload(payload, req.body);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const technician = await Technician.create(payload);
    return res.status(201).json({
      success: true,
      message: "تمت إضافة الفني بنجاح.",
      data: technician
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة الفني." });
  }
});

router.put("/technicians/:id", async (req, res) => {
  try {
    const payload = parseTechnicianPayload(req.body);
    const errors = validateTechnicianPayload(payload, req.body);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const technician = await Technician.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!technician) {
      return res.status(404).json({ success: false, message: "الفني غير موجود." });
    }

    return res.json({
      success: true,
      message: "تم تعديل بيانات الفني بنجاح.",
      data: technician
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "تعذر تعديل بيانات الفني." });
  }
});

router.delete("/technicians/:id", async (req, res) => {
  const technician = await Technician.findByIdAndDelete(req.params.id);
  if (!technician) {
    return res.status(404).json({ success: false, message: "الفني غير موجود." });
  }
  return res.json({ success: true, message: "تم حذف الفني بنجاح." });
});

router.get("/spare-parts", async (req, res) => {
  const spareParts = await SparePart.find().sort({ createdAt: -1 });
  return res.json({ success: true, data: spareParts });
});

router.post("/spare-parts", async (req, res) => {
  try {
    const payload = applySparePartCompatibilityLabel(parseSparePartPayload(req.body));
    const errors = validateSparePartPayload(payload, req.body);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const sparePart = await SparePart.create(payload);
    return res.status(201).json({
      success: true,
      message: "تمت إضافة قطعة الغيار بنجاح.",
      data: sparePart
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "رقم القطعة مستخدم مسبقاً." });
    }
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة قطعة الغيار." });
  }
});

router.put("/spare-parts/:id", async (req, res) => {
  try {
    const payload = applySparePartCompatibilityLabel(parseSparePartPayload(req.body));
    const errors = validateSparePartPayload(payload, req.body);

    if (errors.length) {
      return sendValidationError(res, errors);
    }

    const sparePart = await SparePart.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });

    if (!sparePart) {
      return res.status(404).json({ success: false, message: "قطعة الغيار غير موجودة." });
    }

    return res.json({
      success: true,
      message: "تم تعديل قطعة الغيار بنجاح.",
      data: sparePart
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "رقم القطعة مستخدم مسبقاً." });
    }
    return res.status(500).json({ success: false, message: "تعذر تعديل قطعة الغيار." });
  }
});

router.delete("/spare-parts/:id", async (req, res) => {
  const sparePart = await SparePart.findByIdAndDelete(req.params.id);
  if (!sparePart) {
    return res.status(404).json({ success: false, message: "قطعة الغيار غير موجودة." });
  }
  return res.json({ success: true, message: "تم حذف قطعة الغيار بنجاح." });
});

router.get("/maintenance-requests", async (req, res) => {
  const requests = await MaintenanceRequest.find()
    .populate("customer", "fullName username phone")
    .populate("customerCar", "carName carType modelYear vin")
    .populate("technician", "fullName specialty governorate mobile whatsapp email")
    .sort({ createdAt: -1 });

  return res.json({ success: true, data: requests });
});

router.put("/maintenance-requests/:id/review", async (req, res) => {
  const payload = parseMaintenanceReviewPayload(req.body);
  const validationError = validateMaintenanceReviewPayload(payload);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const requestDoc = await MaintenanceRequest.findById(req.params.id);
  if (!requestDoc) {
    return res.status(404).json({ success: false, message: "طلب الصيانة غير موجود." });
  }

  if (requestDoc.status === "ملغى") {
    return res.status(400).json({
      success: false,
      message: "لا يمكن مراجعة هذا الطلب لأنه ملغى من العميل."
    });
  }

  requestDoc.status = payload.decision;
  requestDoc.adminNote = payload.adminNote;
  requestDoc.reviewedAt = new Date();
  requestDoc.reviewedBy = {
    adminId: req.session.admin.id,
    adminName: req.session.admin.name
  };

  if (payload.decision === "مقبول") {
    requestDoc.appointmentDate = new Date(payload.appointmentDate);
    requestDoc.rejectionReason = "";
  } else {
    requestDoc.rejectionReason = payload.rejectionReason;
    requestDoc.appointmentDate = null;
  }

  requestDoc.cancellationReason = "";
  requestDoc.canceledAt = null;
  requestDoc.canceledBy = {
    customerId: null,
    customerName: ""
  };

  await requestDoc.save();

  return res.json({
    success: true,
    message:
      payload.decision === "مقبول"
        ? "تم قبول طلب الصيانة وتحديد موعد للعميل."
        : "تم رفض طلب الصيانة.",
    data: requestDoc
  });
});

module.exports = router;
