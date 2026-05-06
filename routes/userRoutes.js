const express = require("express");

const router = express.Router();

const {
  getAllUsers,
  updateUser,
} = require("../controllers/userController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");


// ======================================================
// GET ALL USERS
// ======================================================

router.get(
  "/",
  protect,
  authorize("ADMIN"),
  getAllUsers
);


// ======================================================
// UPDATE USER
// ======================================================

router.put(
  "/:id",
  protect,
  authorize("ADMIN"),
  updateUser
);

module.exports = router;