const express = require("express");
const path = require("path");

const { ensureUserAuth } = require("../middleware/auth");

const router = express.Router();

router.use(ensureUserAuth);

function sendUserPage(pageName) {
  return (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "user", `${pageName}.html`));
  };
}

router.get("/", (req, res) => res.redirect("/user/home"));
router.get("/home", sendUserPage("home"));
router.get("/my-cars", sendUserPage("my-cars"));
router.get("/showroom-cars", sendUserPage("showroom-cars"));
router.get("/maintenance", sendUserPage("maintenance"));
router.get("/smart-diagnosis", sendUserPage("smart-diagnosis"));
router.get("/maintenance-guide", sendUserPage("maintenance-guide"));
router.get("/maintenance-guide/oil-change", sendUserPage("maintenance-guide-oil-change"));
router.get("/maintenance-guide/air-filter", sendUserPage("maintenance-guide-air-filter"));
router.get("/fault-codes", sendUserPage("fault-codes"));
router.get("/service-centers", sendUserPage("service-centers"));
router.get("/spare-parts", sendUserPage("spare-parts"));

module.exports = router;
