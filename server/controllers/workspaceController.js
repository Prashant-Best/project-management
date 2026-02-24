const Workspace = require("../models/workspace");

const legacyDefaultMemberNames = new Set(["Rahul Sharma", "Ananya Singh", "Vikas Patel"]);
const VALID_PRIORITIES = new Set(["Urgent", "High", "Medium", "Low"]);

function hasOnlyLegacyDefaultMembers(members) {
  return (
    members.length > 0 &&
    members.every((member) => legacyDefaultMemberNames.has(member.name))
  );
}

function getActor(req) {
  return req.user?.name || req.user?.email || "Unknown User";
}

function addActivity(workspace, req, action, targetType, targetId, details = "") {
  workspace.activityLog.unshift({
    actor: getActor(req),
    action,
    targetType,
    targetId,
    details,
  });

  if (workspace.activityLog.length > 500) {
    workspace.activityLog = workspace.activityLog.slice(0, 500);
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function getOrCreateWorkspace() {
  let workspace = await Workspace.findOne();

  if (!workspace) {
    workspace = await Workspace.create({
      members: [],
      tasks: [],
      messages: [],
      activityLog: [],
    });
  }

  // One-time cleanup for previously seeded placeholder members.
  if (hasOnlyLegacyDefaultMembers(workspace.members)) {
    workspace.members = [];
    workspace.tasks = workspace.tasks.filter(
      (task) => !legacyDefaultMemberNames.has(task.assignedTo)
    );
    await workspace.save();
  }

  return workspace;
}

const getWorkspace = async (_req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTasks = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const q = (req.query.q || "").trim().toLowerCase();
    const priority = req.query.priority;
    const status = req.query.status;
    const assignedTo = (req.query.assignedTo || "").trim().toLowerCase();

    let filtered = workspace.tasks;

    if (q) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.description.toLowerCase().includes(q) ||
          task.assignedTo.toLowerCase().includes(q)
      );
    }

    if (priority && VALID_PRIORITIES.has(priority)) {
      filtered = filtered.filter((task) => task.priority === priority);
    }

    if (status === "done") {
      filtered = filtered.filter((task) => task.done);
    } else if (status === "undone") {
      filtered = filtered.filter((task) => !task.done);
    }

    if (assignedTo) {
      filtered = filtered.filter((task) => task.assignedTo.toLowerCase() === assignedTo);
    }

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const items = sorted.slice(start, start + limit);

    res.status(200).json({
      success: true,
      data: items,
      meta: { total, page: safePage, limit, totalPages },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addMember = async (req, res) => {
  const name = (req.body?.name || "").trim();

  if (!name) {
    return res.status(400).json({ success: false, message: "Member name is required" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    const alreadyExists = workspace.members.some(
      (member) => member.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      return res.status(409).json({ success: false, message: "Member already exists" });
    }

    workspace.members.push({ name });
    addActivity(workspace, req, "member_added", "member", "", `Added member ${name}`);
    await workspace.save();

    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const removeMember = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const member = workspace.members.id(req.params.memberId);

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }

    const memberName = member.name;
    member.deleteOne();
    workspace.tasks = workspace.tasks.filter((task) => task.assignedTo !== memberName);
    addActivity(workspace, req, "member_removed", "member", req.params.memberId, memberName);
    await workspace.save();

    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addTask = async (req, res) => {
  const title = (req.body?.title || "").trim();
  const description = (req.body?.description || "").trim();
  const priority = req.body?.priority || "Medium";
  const assignedTo = (req.body?.assignedTo || "Unassigned").trim() || "Unassigned";
  const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : null;

  if (!title) {
    return res.status(400).json({ success: false, message: "Task title is required" });
  }

  if (!VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ success: false, message: "Invalid priority" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    workspace.tasks.push({
      title,
      description,
      priority,
      done: false,
      assignedTo,
      dueDate: Number.isNaN(dueDate?.getTime?.()) ? null : dueDate,
      comments: [],
    });

    const createdTask = workspace.tasks[workspace.tasks.length - 1];
    addActivity(
      workspace,
      req,
      "task_created",
      "task",
      createdTask._id.toString(),
      `${title} -> ${assignedTo}`
    );
    await workspace.save();

    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (typeof req.body.title === "string" && req.body.title.trim()) {
      task.title = req.body.title.trim();
    }

    if (typeof req.body.description === "string") {
      task.description = req.body.description.trim();
    }

    if (typeof req.body.assignedTo === "string" && req.body.assignedTo.trim()) {
      task.assignedTo = req.body.assignedTo.trim();
    }

    if (typeof req.body.priority === "string" && VALID_PRIORITIES.has(req.body.priority)) {
      task.priority = req.body.priority;
    }

    if (typeof req.body.done === "boolean") {
      task.done = req.body.done;
    }

    if (req.body.dueDate === null || req.body.dueDate === "") {
      task.dueDate = null;
    } else if (req.body.dueDate) {
      const parsedDueDate = new Date(req.body.dueDate);
      if (!Number.isNaN(parsedDueDate.getTime())) {
        task.dueDate = parsedDueDate;
      }
    }

    addActivity(workspace, req, "task_updated", "task", task._id.toString(), task.title);
    await workspace.save();
    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const taskTitle = task.title;
    task.deleteOne();
    addActivity(workspace, req, "task_deleted", "task", req.params.taskId, taskTitle);
    await workspace.save();

    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addTaskComment = async (req, res) => {
  const text = (req.body?.text || "").trim();
  const user = (req.body?.user || "").trim() || getActor(req);

  if (!text) {
    return res.status(400).json({ success: false, message: "Comment text is required" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.comments.push({ user, text });
    addActivity(workspace, req, "task_commented", "task", task._id.toString(), task.title);
    await workspace.save();
    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleTask = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.done = !task.done;
    addActivity(
      workspace,
      req,
      "task_toggled",
      "task",
      task._id.toString(),
      `${task.title} -> ${task.done ? "done" : "undone"}`
    );
    await workspace.save();

    res.status(200).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 30);
    const total = workspace.messages.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = Math.max(0, total - safePage * limit);
    const end = total - (safePage - 1) * limit;
    const items = workspace.messages.slice(start, end);

    res.status(200).json({
      success: true,
      data: items,
      meta: { total, page: safePage, limit, totalPages },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addMessage = async (req, res) => {
  const user = (req.body?.user || "").trim();
  const text = (req.body?.text || "").trim();

  if (!user || !text) {
    return res.status(400).json({ success: false, message: "User and text are required" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    workspace.messages.push({ user, text });
    addActivity(workspace, req, "message_sent", "message", "", `${user}: ${text.slice(0, 30)}`);
    await workspace.save();
    res.status(201).json({ success: true, data: workspace.messages || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getActivityLog = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const q = (req.query.q || "").trim().toLowerCase();
    const action = (req.query.action || "").trim().toLowerCase();

    let filtered = workspace.activityLog;

    if (action) {
      filtered = filtered.filter((log) => log.action.toLowerCase() === action);
    }

    if (q) {
      filtered = filtered.filter(
        (log) =>
          log.actor.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.targetType.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const items = filtered.slice(start, start + limit);

    res.status(200).json({
      success: true,
      data: items,
      meta: { total, page: safePage, limit, totalPages },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWorkspace,
  getTasks,
  addMember,
  removeMember,
  addTask,
  updateTask,
  deleteTask,
  addTaskComment,
  toggleTask,
  getMessages,
  addMessage,
  getActivityLog,
};
