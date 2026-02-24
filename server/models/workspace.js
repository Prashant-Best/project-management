const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priority: {
      type: String,
      enum: ["Urgent", "High", "Medium", "Low"],
      default: "Medium",
    },
    done: { type: Boolean, default: false },
    assignedTo: { type: String, default: "Unassigned" },
    dueDate: { type: Date, default: null },
    comments: {
      type: [
        new mongoose.Schema(
          {
            user: { type: String, required: true, trim: true },
            text: { type: String, required: true, trim: true },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  { _id: true }
);

const messageSchema = new mongoose.Schema(
  {
    user: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, required: true, trim: true },
    targetId: { type: String, default: "" },
    details: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const workspaceSchema = new mongoose.Schema(
  {
    teamName: { type: String, default: "DevFlow Team" },
    teamHead: { type: String, default: "Rahul Sharma" },
    leaderContact: { type: String, default: "rahulsharma@devflow.com" },
    members: { type: [memberSchema], default: [] },
    tasks: { type: [taskSchema], default: [] },
    messages: { type: [messageSchema], default: [] },
    activityLog: { type: [activityLogSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workspace", workspaceSchema);
