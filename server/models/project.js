const mongoose = require("mongoose");

const TEAM_POSITIONS = ["team_head", "manager", "team_member"];

const projectMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    systemRole: { type: String, required: true, trim: true },
    position: { type: String, enum: TEAM_POSITIONS, default: "team_member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
    },
    members: { type: [projectMemberSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = {
  Project: mongoose.model("Project", projectSchema),
  TEAM_POSITIONS,
};
