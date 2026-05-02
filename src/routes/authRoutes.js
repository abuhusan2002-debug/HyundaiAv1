const express = require("express");
const path = require("path");

const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
const { ensureGuest } = require("../middleware/auth");
const { isBlank, toTrimmed } = require("../utils/validators");

const router = express.Router();

router.get("/login", ensureGuest, (req, res) => {
  return res.sendFile(path.join(process.cwd(), "public", "login.html"));
});

router.post("/api/auth/login", ensureGuest, async (req, res) => {
  try {
    const username = toTrimmed(req.body.username);
    const password = toTrimmed(req.body.password);

    if (isBlank(username) || isBlank(password)) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال اسم المستخدم وكلمة المرور."
      });
    }

    const normalized = username.toLowerCase();

    const admin = await Admin.findOne({
      $or: [{ email: normalized }, { name: username }]
    });

    if (admin) {
      const adminPasswordMatch = await admin.comparePassword(password);
      if (adminPasswordMatch) {
        req.session.customer = null;
        req.session.admin = {
          id: admin._id,
          name: admin.name,
          email: admin.email
        };

        return res.json({
          success: true,
          message: "تم تسجيل دخول المدير بنجاح.",
          role: "admin",
          redirectTo: "/admin/dashboard",
          admin: req.session.admin
        });
      }
    }

    const customer = await Customer.findOne({ username: normalized }).select("+password");
    if (customer) {
      const customerPasswordMatch = await customer.comparePassword(password);
      if (customerPasswordMatch) {
        req.session.admin = null;
        req.session.customer = {
          id: customer._id,
          fullName: customer.fullName,
          username: customer.username,
          phone: customer.phone
        };

        return res.json({
          success: true,
          message: "تم تسجيل دخول المستخدم بنجاح.",
          role: "user",
          redirectTo: "/user/home",
          customer: req.session.customer
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: "بيانات الدخول غير صحيحة."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء تسجيل الدخول."
    });
  }
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "تم تسجيل الخروج بنجاح." });
  });
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

router.get("/api/auth/me", (req, res) => {
  if (req.session.admin) {
    return res.json({ success: true, role: "admin", admin: req.session.admin });
  }

  if (req.session.customer) {
    return res.json({ success: true, role: "user", customer: req.session.customer });
  }

  return res.status(401).json({ success: false, message: "غير مسجل الدخول." });
});

module.exports = router;
