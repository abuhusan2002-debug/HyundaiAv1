function isApiRequest(req) {
  return req.path.startsWith("/api") || req.originalUrl.startsWith("/api/");
}

function ensureAdminAuth(req, res, next) {
  if (req.session.admin) {
    return next();
  }

  if (isApiRequest(req)) {
    return res
      .status(401)
      .json({ success: false, message: "يجب تسجيل دخول المدير أولاً للمتابعة." });
  }

  return res.redirect("/login");
}

function ensureUserAuth(req, res, next) {
  if (req.session.customer) {
    return next();
  }

  if (isApiRequest(req)) {
    return res
      .status(401)
      .json({ success: false, message: "يجب تسجيل دخول المستخدم أولاً للمتابعة." });
  }

  return res.redirect("/login");
}

function ensureGuest(req, res, next) {
  if (!req.session.admin && !req.session.customer) {
    return next();
  }

  if (isApiRequest(req)) {
    return res.status(400).json({
      success: false,
      message: "أنت مسجل الدخول بالفعل."
    });
  }

  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }

  if (req.session.customer) {
    return res.redirect("/user/home");
  }

  return res.redirect("/admin/dashboard");
}

module.exports = {
  ensureAuth: ensureAdminAuth,
  ensureAdminAuth,
  ensureUserAuth,
  ensureGuest
};
