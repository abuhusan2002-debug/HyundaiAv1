const express = require("express");

const { ensureUserAuth } = require("../middleware/auth");
const CustomerCar = require("../models/CustomerCar");
const Technician = require("../models/Technician");
const SparePart = require("../models/SparePart");
const ShowroomCar = require("../models/ShowroomCar");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const TroubleCode = require("../models/TroubleCode");
const SmartDiagnosisConversation = require("../models/SmartDiagnosisConversation");
const { requestSmartDiagnosisAnswer } = require("../services/smartDiagnosisAiClient");
const {
  DECISIONS,
  evaluateSmartDiagnosisScope
} = require("../services/smartDiagnosisScopeGuard");
const { logSmartDiagnosisEvent } = require("../utils/smartDiagnosisLogger");

const router = express.Router();

router.use(ensureUserAuth);

const TOKEN_ALIAS_MAP = {
  accent: "accent",
  اكسنت: "accent",
  elantra: "elantra",
  النترا: "elantra",
  sonata: "sonata",
  سوناتا: "sonata",
  azera: "azera",
  ازيرا: "azera",
  kona: "kona",
  كونا: "kona",
  tucson: "tucson",
  توسان: "tucson",
  santafe: "santafe",
  سانتافي: "santafe",
  palisade: "palisade",
  باليسيد: "palisade",
  creta: "creta",
  كريتا: "creta",
  bayon: "bayon",
  بايون: "bayon",
  veloster: "veloster",
  فيلوستر: "veloster",
  staria: "staria",
  ستاريا: "staria",
  santacruz: "santacruz",
  سانتاكروز: "santacruz",
  سانتكروز: "santacruz",
  ioniq5: "ioniq5",
  ايونيك5: "ioniq5",
  ايونك5: "ioniq5",
  ioniq6: "ioniq6",
  ايونيك6: "ioniq6",
  ايونك6: "ioniq6",
  konaelectric: "konaelectric",
  sonatahybrid: "sonatahybrid",
  tucsonhybrid: "tucsonhybrid",
  santafehybrid: "santafehybrid",
  sedan: "sedan",
  سيدان: "sedan",
  suv: "suv",
  كروساوفر: "crossover",
  crossover: "crossover",
  هاتشباك: "hatchback",
  hatchback: "hatchback",
  فان: "van",
  van: "van",
  بيكاب: "pickup",
  pickup: "pickup",
  كهرباييه: "electric",
  electric: "electric",
  هجينه: "hybrid",
  hybrid: "hybrid"
};

function normalizeBaseToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\s\-_/]+/g, "")
    .trim();
}

function normalizeToken(value) {
  const token = normalizeBaseToken(value);
  return TOKEN_ALIAS_MAP[token] || token;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCompatibleModels(value) {
  return String(value || "")
    .split(/[,،|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function derivePartCategory(part) {
  const text = `${part.name || ""} ${part.description || ""}`.toLowerCase();
  if (text.includes("فلتر") || text.includes("filter")) {
    return "الفلاتر";
  }
  if (text.includes("فرامل") || text.includes("brake")) {
    return "الفرامل";
  }
  if (text.includes("زيت") || text.includes("fluid")) {
    return "الزيوت والسوائل";
  }
  if (text.includes("بطارية") || text.includes("battery")) {
    return "الكهرباء";
  }
  if (text.includes("شمعة") || text.includes("بوجي") || text.includes("spark")) {
    return "الإشعال";
  }
  return "عام";
}

function tokensMatch(left, right) {
  if (!left || !right) {
    return false;
  }
  return left === right || left.includes(right) || right.includes(left);
}

function buildStructuredCompatibility(part, cars) {
  const partTypeToken = normalizeToken(part.carType);
  const partNameToken = normalizeToken(part.carName);
  const fromYear = Number(part.modelYearFrom);
  const toYear = Number(part.modelYearTo);
  const hasStructuredField = Boolean(partTypeToken || partNameToken);

  if (!hasStructuredField) {
    return null;
  }

  const compatibleList =
    part.carType && part.carName && Number.isInteger(fromYear) && Number.isInteger(toYear)
      ? [`${part.carType} - ${part.carName} (${fromYear}-${toYear})`]
      : [String(part.compatibleModels || "").trim()].filter(Boolean);

  const matchedBy = cars
    .filter((car) => {
      const carTypeToken = normalizeToken(car.carType);
      const carNameToken = normalizeToken(car.carName);
      const carYear = Number(car.modelYear);

      const typeMatches = partTypeToken ? tokensMatch(partTypeToken, carTypeToken) : true;
      const nameMatches = partNameToken ? tokensMatch(partNameToken, carNameToken) : true;
      const yearMatches =
        Number.isInteger(fromYear) && Number.isInteger(toYear) && Number.isInteger(carYear)
          ? carYear >= fromYear && carYear <= toYear
          : true;

      return typeMatches && nameMatches && yearMatches;
    })
    .map((car) => `${car.carName} ${car.modelYear}`);

  return {
    compatibleList,
    matchedBy
  };
}

function buildPartsForCars(cars, parts) {
  const carModels = Array.from(
    new Set(cars.map((car) => String(car.carName || "").trim()).filter(Boolean))
  );

  const carTokens = new Set(
    cars
      .flatMap((car) => [car.carName, car.carType])
      .map(normalizeToken)
      .filter(Boolean)
  );

  const universalTokens = new Set([
    "all",
    "allmodels",
    "allmodel",
    "جميع",
    "جميعالموديلات",
    "كلالموديلات",
    "كافةالموديلات"
  ]);

  const matchedParts = parts
    .map((part) => {
      const structured = buildStructuredCompatibility(part, cars);
      if (structured) {
        if (!structured.matchedBy.length) {
          return null;
        }

        return {
          ...part.toObject(),
          compatibleList: structured.compatibleList,
          category: derivePartCategory(part),
          availability: part.stock > 0 ? "متوفر" : "حسب الطلب",
          matchedBy: structured.matchedBy
        };
      }

      const compatibleList = parseCompatibleModels(part.compatibleModels);
      const compatibleTokens = compatibleList.map(normalizeToken).filter(Boolean);
      const isUniversal = compatibleTokens.some((token) => universalTokens.has(token));

      const matchedBy = compatibleList.filter((label, index) => {
        const token = compatibleTokens[index];
        if (!token) {
          return false;
        }
        for (const carToken of carTokens) {
          if (token === carToken || token.includes(carToken) || carToken.includes(token)) {
            return true;
          }
        }
        return false;
      });

      if (!isUniversal && matchedBy.length === 0) {
        return null;
      }

      return {
        ...part.toObject(),
        compatibleList,
        category: derivePartCategory(part),
        availability: part.stock > 0 ? "متوفر" : "حسب الطلب",
        matchedBy: isUniversal ? ["جميع الموديلات"] : matchedBy
      };
    })
    .filter(Boolean);

  return {
    carModels,
    parts: matchedParts
  };
}

function normalizeShowroomImageUrls(carDocOrObject) {
  const imageUrls = Array.isArray(carDocOrObject?.imageUrls)
    ? carDocOrObject.imageUrls
    : [];
  const legacyImage = String(carDocOrObject?.imageUrl || "").trim();
  const combined = legacyImage ? [...imageUrls, legacyImage] : imageUrls;
  return Array.from(
    new Set(
      combined
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

async function saveSmartDiagnosisConversation(entry) {
  const normalizedQuestion = String(entry.question || "").trim().slice(0, 1500);
  const normalizedResponse = String(entry.response || "").trim().slice(0, 5000);
  const normalizedStatus = ["accepted", "rejected", "clarification", "error"].includes(entry.status)
    ? entry.status
    : "error";

  if (!normalizedQuestion || !normalizedResponse) {
    return;
  }

  try {
    await SmartDiagnosisConversation.create({
      customer: entry.customer,
      question: normalizedQuestion,
      response: normalizedResponse,
      status: normalizedStatus,
      reasonCode: String(entry.reasonCode || "").trim().slice(0, 120)
    });
  } catch (error) {
    logSmartDiagnosisEvent("conversation_log_failed", {
      customerId: entry.customer,
      decision: normalizedStatus,
      reasonCode: entry.reasonCode || "log_failed",
      questionLength: normalizedQuestion.length,
      statusCode: 500,
      errorCode: error.code || "SMART_DIAGNOSIS_CONVERSATION_SAVE_FAILED"
    });
  }
}

router.get("/home/summary", async (req, res) => {
  const customerId = req.session.customer.id;

  const [cars, technicians, parts, maintenanceRequestsCount] = await Promise.all([
    CustomerCar.find({ customer: customerId }).sort({ createdAt: -1 }),
    Technician.find().sort({ rating: -1, createdAt: -1 }),
    SparePart.find().sort({ createdAt: -1 }),
    MaintenanceRequest.countDocuments({ customer: customerId })
  ]);

  const { carModels, parts: matchedParts } = buildPartsForCars(cars, parts);

  return res.json({
    success: true,
    data: {
      customer: req.session.customer,
      counts: {
        myCars: cars.length,
        maintenanceRequests: maintenanceRequestsCount,
        serviceCenters: technicians.length,
        spareParts: matchedParts.length
      },
      carModels
    }
  });
});

router.get("/smart-diagnosis/history", async (req, res) => {
  const customerId = req.session.customer.id;
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 30;

  const rows = await SmartDiagnosisConversation.find({ customer: customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("question response status reasonCode createdAt");

  return res.json({
    success: true,
    data: rows
  });
});

router.post("/smart-diagnosis", async (req, res) => {
  const requestId = `sd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const customerId = req.session.customer.id;
  const question = String(req.body.question || "").trim();

  if (!question) {
    return res.status(400).json({
      success: false,
      status: "clarification",
      message: "يرجى كتابة سؤال واضح متعلق بسيارات هيونداي."
    });
  }

  if (question.length > 1500) {
    await saveSmartDiagnosisConversation({
      customer: customerId,
      question: question.slice(0, 1500),
      response: "السؤال طويل جداً. يرجى الاختصار إلى 1500 حرف كحد أقصى.",
      status: "rejected",
      reasonCode: "question_too_long"
    });

    return res.status(400).json({
      success: false,
      status: "rejected",
      message: "السؤال طويل جداً. يرجى الاختصار إلى 1500 حرف كحد أقصى."
    });
  }

  const scopeResult = evaluateSmartDiagnosisScope(question);
  if (scopeResult.decision !== DECISIONS.ACCEPT) {
    const statusCode = scopeResult.decision === DECISIONS.CLARIFY ? 400 : 403;
    logSmartDiagnosisEvent("request_rejected", {
      requestId,
      customerId,
      decision: scopeResult.decision,
      reasonCode: scopeResult.reasonCode,
      questionLength: question.length,
      statusCode
    });

    await saveSmartDiagnosisConversation({
      customer: customerId,
      question,
      response: scopeResult.message,
      status: scopeResult.decision === DECISIONS.CLARIFY ? "clarification" : "rejected",
      reasonCode: scopeResult.reasonCode
    });

    return res.status(statusCode).json({
      success: false,
      status: scopeResult.decision === DECISIONS.CLARIFY ? "clarification" : "rejected",
      message: scopeResult.message
    });
  }

  const startedAt = Date.now();
  logSmartDiagnosisEvent("request_accepted", {
    requestId,
    customerId,
    decision: scopeResult.decision,
    reasonCode: scopeResult.reasonCode,
    questionLength: question.length,
    statusCode: 200
  });

  try {
    const answer = await requestSmartDiagnosisAnswer(question);
    const latencyMs = Date.now() - startedAt;

    await saveSmartDiagnosisConversation({
      customer: customerId,
      question,
      response: answer,
      status: "accepted",
      reasonCode: scopeResult.reasonCode
    });

    logSmartDiagnosisEvent("response_success", {
      requestId,
      customerId,
      decision: scopeResult.decision,
      reasonCode: scopeResult.reasonCode,
      questionLength: question.length,
      statusCode: 200,
      latencyMs
    });

    return res.json({
      success: true,
      status: "accepted",
      data: {
        answer
      }
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    logSmartDiagnosisEvent("response_error", {
      requestId,
      customerId,
      decision: scopeResult.decision,
      reasonCode: scopeResult.reasonCode,
      questionLength: question.length,
      statusCode: 502,
      latencyMs,
      errorCode: error.code || "SMART_DIAGNOSIS_UNKNOWN_ERROR",
      providerStatusCode: error.statusCode || 0,
      providerMessage: error.providerMessage || ""
    });

    const fallbackMessage = "تعذر تنفيذ التشخيص الذكي حالياً. يرجى المحاولة لاحقاً.";
    await saveSmartDiagnosisConversation({
      customer: customerId,
      question,
      response: fallbackMessage,
      status: "error",
      reasonCode: error.code || "smart_diagnosis_error"
    });

    return res.status(502).json({
      success: false,
      status: "error",
      message: fallbackMessage
    });
  }
});

router.get("/maintenance-requests", async (req, res) => {
  const customerId = req.session.customer.id;
  const requests = await MaintenanceRequest.find({ customer: customerId })
    .populate("customerCar", "carName carType modelYear vin")
    .populate("technician", "fullName specialty governorate mobile whatsapp email")
    .sort({ createdAt: -1 });

  return res.json({ success: true, data: requests });
});

router.post("/maintenance-requests", async (req, res) => {
  const customerId = req.session.customer.id;
  const customerCar = String(req.body.customerCar || "").trim();
  const technician = String(req.body.technician || "").trim();
  const requestType = String(req.body.requestType || "").trim();
  const priority = String(req.body.priority || "").trim();
  const preferredDate = String(req.body.preferredDate || "").trim();
  const description = String(req.body.description || "").trim();

  if (!customerCar || !technician || !requestType || !priority || !preferredDate || !description) {
    return res.status(400).json({ success: false, message: "لا يمكن ترك الحقول المطلوبة فارغة." });
  }

  if (!["صيانة دورية", "إصلاح", "فحص", "أخرى"].includes(requestType)) {
    return res.status(400).json({ success: false, message: "نوع الطلب غير صالح." });
  }

  if (!["منخفضة", "متوسطة", "عالية"].includes(priority)) {
    return res.status(400).json({ success: false, message: "الأولوية غير صالحة." });
  }

  const preferredDateObj = new Date(preferredDate);
  if (Number.isNaN(preferredDateObj.getTime())) {
    return res.status(400).json({ success: false, message: "صيغة التاريخ المفضل غير صحيحة." });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (preferredDateObj < startOfToday) {
    return res.status(400).json({
      success: false,
      message: "التاريخ المفضل يجب أن يكون اليوم أو تاريخاً مستقبلياً."
    });
  }

  const ownedCar = await CustomerCar.findOne({ _id: customerCar, customer: customerId });
  if (!ownedCar) {
    return res.status(400).json({ success: false, message: "المركبة المختارة غير موجودة في حسابك." });
  }

  const selectedTechnician = await Technician.findById(technician);
  if (!selectedTechnician) {
    return res.status(400).json({ success: false, message: "الفني المختار غير موجود." });
  }

  const requestDoc = await MaintenanceRequest.create({
    customer: customerId,
    customerCar: ownedCar._id,
    technician: selectedTechnician._id,
    requestType,
    priority,
    preferredDate: preferredDateObj,
    description
  });

  return res.status(201).json({
    success: true,
    message: "تم إرسال طلب الصيانة بنجاح وسيتم مراجعته من مدير ما بعد البيع.",
    data: requestDoc
  });
});

router.put("/maintenance-requests/:id/cancel", async (req, res) => {
  const customerId = req.session.customer.id;
  const customerName = req.session.customer.fullName || req.session.customer.username || "العميل";
  const reason = String(req.body.reason || "").trim();

  if (!reason) {
    return res.status(400).json({ success: false, message: "يرجى كتابة سبب الإلغاء." });
  }

  const requestDoc = await MaintenanceRequest.findOne({
    _id: req.params.id,
    customer: customerId
  });

  if (!requestDoc) {
    return res.status(404).json({ success: false, message: "طلب الصيانة غير موجود." });
  }

  if (requestDoc.status === "ملغى") {
    return res.status(400).json({ success: false, message: "تم إلغاء هذا الطلب سابقاً." });
  }

  if (requestDoc.status === "مرفوض") {
    return res.status(400).json({ success: false, message: "لا يمكن إلغاء طلب مرفوض." });
  }

  if (requestDoc.status !== "مقبول") {
    return res.status(400).json({
      success: false,
      message: "يمكن إلغاء الطلب فقط بعد قبول المدير وتحديد الموعد."
    });
  }

  if (!requestDoc.appointmentDate) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن إلغاء الطلب لأنه لا يحتوي على موعد محدد."
    });
  }

  const appointmentDate = new Date(requestDoc.appointmentDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (appointmentDate < startOfToday) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن إلغاء الطلب بعد انتهاء موعد الصيانة."
    });
  }

  requestDoc.status = "ملغى";
  requestDoc.cancellationReason = reason;
  requestDoc.canceledAt = new Date();
  requestDoc.canceledBy = {
    customerId,
    customerName
  };
  requestDoc.appointmentDate = null;

  await requestDoc.save();

  return res.json({
    success: true,
    message: "تم إلغاء طلب الصيانة ونقله إلى الأرشيف.",
    data: requestDoc
  });
});

router.get("/my-cars", async (req, res) => {
  const customerId = req.session.customer.id;
  const cars = await CustomerCar.find({ customer: customerId }).sort({ createdAt: -1 });
  return res.json({ success: true, data: cars });
});

router.get("/showroom-cars", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const category = String(req.query.category || "").trim();

  const query = {
    available: true
  };

  if (q) {
    query.$or = [
      { name: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } }
    ];
  }

  if (category && category !== "all") {
    query.category = category;
  }

  const [cars, categoryRows] = await Promise.all([
    ShowroomCar.find(query).sort({ modelYear: -1, createdAt: -1 }),
    ShowroomCar.find({ available: true }).select("category -_id")
  ]);

  const normalizedCars = cars.map((car) => {
    const object = car.toObject();
    object.imageUrls = normalizeShowroomImageUrls(object);
    object.imageUrl = object.imageUrls[0] || "";
    return object;
  });

  const categories = Array.from(
    new Set(
      categoryRows
        .map((item) => String(item.category || "").trim())
        .filter(Boolean)
    )
  );

  return res.json({
    success: true,
    data: {
      cars: normalizedCars,
      categories
    }
  });
});

router.get("/service-centers", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const query = q
    ? {
        $or: [
          { fullName: { $regex: q, $options: "i" } },
          { specialty: { $regex: q, $options: "i" } },
          { address: { $regex: q, $options: "i" } }
        ]
      }
    : {};

  const technicians = await Technician.find(query).sort({ rating: -1, createdAt: -1 });
  return res.json({ success: true, data: technicians });
});

router.get("/spare-parts", async (req, res) => {
  const customerId = req.session.customer.id;
  const q = String(req.query.q || "").trim().toLowerCase();
  const category = String(req.query.category || "").trim();

  const [cars, parts] = await Promise.all([
    CustomerCar.find({ customer: customerId }).sort({ createdAt: -1 }),
    SparePart.find().sort({ createdAt: -1 })
  ]);

  const { carModels, parts: matchedParts } = buildPartsForCars(cars, parts);
  const filtered = matchedParts.filter((part) => {
    if (category && category !== "all" && part.category !== category) {
      return false;
    }

    if (!q) {
      return true;
    }

    const haystack = `${part.name} ${part.partNumber} ${part.description} ${part.origin}`.toLowerCase();
    return haystack.includes(q);
  });

  const categories = Array.from(new Set(matchedParts.map((part) => part.category)));

  return res.json({
    success: true,
    data: {
      carModels,
      categories,
      parts: filtered
    }
  });
});

router.get("/trouble-codes", async (req, res) => {
  const query = String(req.query.q || "").trim().toUpperCase();
  const safeQuery = escapeRegex(query);

  if (!query) {
    const topCodes = await TroubleCode.find().sort({ popularRank: 1, code: 1 }).limit(10);
    return res.json({
      success: true,
      data: {
        exact: null,
        suggestions: topCodes,
        message: "أدخل كود عطل مثل P0301 للبحث، أو اختر من الأكواد الشائعة."
      }
    });
  }

  const exact = await TroubleCode.findOne({ code: query });
  const suggestions = await TroubleCode.find({
    $or: [
      { code: { $regex: `^${safeQuery}`, $options: "i" } },
      { title: { $regex: safeQuery, $options: "i" } },
      { description: { $regex: safeQuery, $options: "i" } }
    ]
  })
    .sort({ popularRank: 1, code: 1 })
    .limit(10);

  return res.json({
    success: true,
    data: {
      exact,
      suggestions,
      message: exact ? "" : "لم يتم العثور على تطابق كامل، هذه أقرب النتائج."
    }
  });
});

module.exports = router;
