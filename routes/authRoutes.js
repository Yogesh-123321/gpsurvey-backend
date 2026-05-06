const express = require("express");
const router = express.Router();

const {
  login,
  createUser,
} = require("../controllers/authController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");


// LOGIN
router.post("/login", login);


// CREATE USER
router.post(
  "/create-user",
  protect,
  authorize("ADMIN"),
  createUser
);


// CURRENT USER
router.get(
  "/me",
  protect,
  (req, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  }
);


// ADMIN TEST
router.get(
  "/admin-test",
  protect,
  authorize("ADMIN"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Admin",
    });
  }
);

module.exports = router;