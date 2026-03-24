const express = require("express");
const router = express.Router();
const {
  getUsers,
  createUsers,
  deleteUser,
  updateUserRole,
  loginUser,
  getCurrentUser,
  updateProfile,
  changePassword,
} = require("../controllers/userController.js");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, requireRole("management", "admin"), getUsers);
router.post("/", createUsers);
router.post("/signup", createUsers);
router.delete("/:id", requireAuth, requireRole("management", "admin"), deleteUser);
router.patch("/:id/role", requireAuth, requireRole("admin"), updateUserRole);

router.post("/login", loginUser);
router.get("/me", requireAuth, getCurrentUser);
router.patch("/me", requireAuth, updateProfile);
router.patch("/me/password", requireAuth, changePassword);

module.exports = router;
