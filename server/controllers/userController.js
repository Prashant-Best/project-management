const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");
const ALLOWED_ROLES = new Set(["management", "team_member"]);

const getUsers = async (_req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUsers = async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "Name, email, password and role are required" });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ success: false, message: "Invalid role selected" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone: (phone || "").trim(),
    });
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// LOGIN endpoint
const loginUser = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const effectiveRole = user.role || "team_member";
    if (!role || !ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: "Please select a valid role" });
    }

    if (effectiveRole !== role) {
      return res.status(401).json({ success: false, message: "Role does not match this account" });
    }

    const isHashedPassword = user.password.startsWith("$2a$") || user.password.startsWith("$2b$");
    const isValidPassword = isHashedPassword
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!isValidPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // Auto-migrate legacy plain-text password to hash after successful login.
    if (!isHashedPassword) {
      user.password = await bcrypt.hash(password, 10);
      if (!user.role) {
        user.role = "team_member";
      }
      await user.save();
    }

    // Successful login
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: effectiveRole, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: `Welcome ${user.name}`,
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: effectiveRole,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  const updates = {};

  if (typeof req.body.name === "string" && req.body.name.trim()) {
    updates.name = req.body.name.trim();
  }

  if (typeof req.body.phone === "string") {
    updates.phone = req.body.phone.trim();
  }

  if (
    req.user.role === "management" &&
    typeof req.body.role === "string" &&
    ALLOWED_ROLES.has(req.body.role)
  ) {
    updates.role = req.body.role;
  }

  try {
    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "Profile updated", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password (min 6 chars) are required",
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUsers,
  createUsers,
  deleteUser,
  loginUser,
  getCurrentUser,
  updateProfile,
  changePassword,
};
