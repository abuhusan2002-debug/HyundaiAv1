const express = require("express");
const path = require("path");

const { ensureAuth } = require("../middleware/auth");

const router = express.Router();

router.use(ensureAuth);

function sendAdminPage(pageName) {
  return (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "admin", `${pageName}.html`));
  };
}

router.get("/", (req, res) => res.redirect("/admin/dashboard"));
router.get("/dashboard", sendAdminPage("dashboard"));
router.get("/customers", sendAdminPage("customers"));
router.get("/customer-cars", sendAdminPage("customer-cars"));
router.get("/showroom-cars", sendAdminPage("showroom-cars"));
router.get("/technicians", sendAdminPage("technicians"));
router.get("/spare-parts", sendAdminPage("spare-parts"));
router.get("/maintenance-requests", sendAdminPage("maintenance-requests"));

module.exports = router;
