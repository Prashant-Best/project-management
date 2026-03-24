const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const subtaskSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const recurringSchema = new mongoose.Schema(
  {
    isTemplate: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    nextRunAt: { type: Date, default: null },
    parentTaskId: { type: String, default: "" },
  },
  { _id: false }
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
    subtasks: { type: [subtaskSchema], default: [] },
    recurring: { type: recurringSchema, default: () => ({}) },
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

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, default: "general", trim: true },
    read: { type: Boolean, default: false },
    link: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const savedViewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    userName: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
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
    notifications: { type: [notificationSchema], default: [] },
    savedViews: { type: [savedViewSchema], default: [] },
    activityLog: { type: [activityLogSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workspace", workspaceSchema);
