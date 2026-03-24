const Workspace = require("../models/workspace");
const { Project } = require("../models/project");

const legacyDefaultMemberNames = new Set(["Rahul Sharma", "Ananya Singh", "Vikas Patel"]);
const VALID_PRIORITIES = new Set(["Urgent", "High", "Medium", "Low"]);
const VALID_RECURRING_FREQUENCY = new Set(["none", "daily", "weekly", "monthly"]);

function hasOnlyLegacyDefaultMembers(members) {
  return (
    members.length > 0 &&
    members.every((member) => legacyDefaultMemberNames.has(member.name))
  );
}

function getActor(req) {
  return req?.user?.name || req?.user?.email || "Unknown User";
}

function addActivity(workspace, req, action, targetType, targetId, details = "", actorOverride = "") {
  workspace.activityLog.unshift({
    actor: actorOverride || getActor(req),
    action,
    targetType,
    targetId,
    details,
  });

  if (workspace.activityLog.length > 500) {
    workspace.activityLog = workspace.activityLog.slice(0, 500);
  }
}

function addNotification(workspace, payload) {
  workspace.notifications.unshift({
    userId: payload.userId || "",
    userName: payload.userName || "",
    title: payload.title || "Update",
    message: payload.message || "",
    type: payload.type || "general",
    read: false,
    link: payload.link || "",
  });

  if (workspace.notifications.length > 1000) {
    workspace.notifications = workspace.notifications.slice(0, 1000);
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addRecurringInterval(date, frequency) {
  const next = new Date(date);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function serializeWorkspace(workspace, includeTemplates = false) {
  const data = workspace.toObject();
  if (!includeTemplates) {
    data.tasks = (data.tasks || []).filter((task) => !task.recurring?.isTemplate);
  }
  return data;
}

function notificationBelongsToUser(notification, req) {
  if (!notification) return false;
  const byId = notification.userId && notification.userId === req.user.id;
  const byName =
    notification.userName &&
    req.user.name &&
    notification.userName.toLowerCase() === req.user.name.toLowerCase();
  const isGlobal = !notification.userId && !notification.userName;
  return byId || byName || isGlobal;
}

function buildCsvLine(fields) {
  return fields
    .map((field) => {
      const value = String(field ?? "");
      const escaped = value.replaceAll('"', '""');
      return `"${escaped}"`;
    })
    .join(",");
}

function materializeRecurringTasks(workspace) {
  let generated = 0;
  const now = new Date();
  const templates = workspace.tasks.filter(
    (task) => task.recurring?.isTemplate && task.recurring?.enabled && task.recurring?.nextRunAt
  );

  for (const template of templates) {
    let safetyCounter = 0;
    while (
      template.recurring?.nextRunAt &&
      new Date(template.recurring.nextRunAt).getTime() <= now.getTime() &&
      safetyCounter < 8
    ) {
      const nextDueDate = new Date(template.recurring.nextRunAt);
      workspace.tasks.push({
        title: template.title,
        description: template.description,
        priority: template.priority,
        done: false,
        assignedTo: template.assignedTo,
        dueDate: nextDueDate,
        subtasks: (template.subtasks || []).map((subtask) => ({
          text: subtask.text,
          done: false,
        })),
        recurring: {
          isTemplate: false,
          enabled: false,
          frequency: "none",
          nextRunAt: null,
          parentTaskId: template._id.toString(),
        },
        comments: [],
      });

      const createdTask = workspace.tasks[workspace.tasks.length - 1];
      addActivity(
        workspace,
        null,
        "recurring_task_generated",
        "task",
        createdTask._id.toString(),
        `${createdTask.title} -> ${createdTask.assignedTo}`,
        "System"
      );
      addNotification(workspace, {
        userName: createdTask.assignedTo,
        title: "Recurring Task Generated",
        message: `${createdTask.title} is ready for you.`,
        type: "task",
        link: "/home/tasks",
      });

      template.recurring.nextRunAt = addRecurringInterval(
        template.recurring.nextRunAt,
        template.recurring.frequency
      );
      generated += 1;
      safetyCounter += 1;
    }
  }

  return generated;
}

async function getOrCreateWorkspace() {
  let workspace = await Workspace.findOne();

  if (!workspace) {
    workspace = await Workspace.create({
      members: [],
      tasks: [],
      messages: [],
      notifications: [],
      savedViews: [],
      activityLog: [],
    });
  }

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
    const generated = materializeRecurringTasks(workspace);
    if (generated > 0) {
      await workspace.save();
    }
    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getWorkspaceUpdates = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const generated = materializeRecurringTasks(workspace);
    if (generated > 0) {
      await workspace.save();
    }

    const sinceDate = parseDate(req.query.since);
    const changed = !sinceDate || workspace.updatedAt.getTime() > sinceDate.getTime();
    const unreadNotifications = workspace.notifications.filter(
      (notification) => notificationBelongsToUser(notification, req) && !notification.read
    ).length;

    res.status(200).json({
      success: true,
      data: {
        changed,
        updatedAt: workspace.updatedAt,
        unreadNotifications,
        generatedRecurringTasks: generated,
        serverTime: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTasks = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const generated = materializeRecurringTasks(workspace);
    if (generated > 0) {
      await workspace.save();
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const q = (req.query.q || "").trim().toLowerCase();
    const priority = req.query.priority;
    const status = req.query.status;
    const assignedTo = (req.query.assignedTo || "").trim().toLowerCase();
    const dueFrom = parseDate(req.query.dueFrom);
    const dueTo = parseDate(req.query.dueTo);
    const recurringOnly = req.query.recurringOnly === "true";
    const includeTemplates = req.query.includeTemplates === "true";
    const sortBy = req.query.sortBy || "created_desc";

    let filtered = workspace.tasks.filter(
      (task) => includeTemplates || !task.recurring?.isTemplate
    );

    if (q) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.description.toLowerCase().includes(q) ||
          task.assignedTo.toLowerCase().includes(q) ||
          (task.subtasks || []).some((subtask) => subtask.text.toLowerCase().includes(q))
      );
    }

    if (priority && VALID_PRIORITIES.has(priority)) {
      filtered = filtered.filter((task) => task.priority === priority);
    }

    if (status === "done") {
      filtered = filtered.filter((task) => task.done);
    } else if (status === "undone") {
      filtered = filtered.filter((task) => !task.done);
    } else if (status === "overdue") {
      const now = Date.now();
      filtered = filtered.filter((task) => task.dueDate && !task.done && new Date(task.dueDate).getTime() < now);
    }

    if (assignedTo) {
      filtered = filtered.filter((task) => task.assignedTo.toLowerCase() === assignedTo);
    }

    if (dueFrom) {
      filtered = filtered.filter((task) => task.dueDate && new Date(task.dueDate).getTime() >= dueFrom.getTime());
    }
    if (dueTo) {
      filtered = filtered.filter((task) => task.dueDate && new Date(task.dueDate).getTime() <= dueTo.getTime());
    }

    if (recurringOnly) {
      filtered = filtered.filter((task) => task.recurring?.parentTaskId || task.recurring?.enabled);
    }

    const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "due_asc") {
        return (new Date(a.dueDate || "9999-12-31").getTime() - new Date(b.dueDate || "9999-12-31").getTime());
      }
      if (sortBy === "due_desc") {
        return (new Date(b.dueDate || "1970-01-01").getTime() - new Date(a.dueDate || "1970-01-01").getTime());
      }
      if (sortBy === "priority_desc") {
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      if (sortBy === "priority_asc") {
        return (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const items = sorted.slice(start, start + limit);

    res.status(200).json({
      success: true,
      data: items,
      meta: { total, page: safePage, limit, totalPages, generatedRecurringTasks: generated },
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

    res.status(201).json({ success: true, data: serializeWorkspace(workspace) });
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

    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addTask = async (req, res) => {
  const title = (req.body?.title || "").trim();
  const description = (req.body?.description || "").trim();
  const priority = req.body?.priority || "Medium";
  const assignedTo = (req.body?.assignedTo || "Unassigned").trim() || "Unassigned";
  const dueDate = parseDate(req.body?.dueDate);
  const recurringFrequency = req.body?.recurringFrequency || "none";
  const isRecurringTemplate =
    VALID_RECURRING_FREQUENCY.has(recurringFrequency) && recurringFrequency !== "none";

  if (!title) {
    return res.status(400).json({ success: false, message: "Task title is required" });
  }

  if (!VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ success: false, message: "Invalid priority" });
  }

  if (!VALID_RECURRING_FREQUENCY.has(recurringFrequency)) {
    return res.status(400).json({ success: false, message: "Invalid recurring frequency" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    const nextRunAt = isRecurringTemplate
      ? dueDate || addRecurringInterval(new Date(), recurringFrequency)
      : null;

    workspace.tasks.push({
      title,
      description,
      priority,
      done: false,
      assignedTo,
      dueDate: isRecurringTemplate ? null : dueDate,
      subtasks: [],
      recurring: {
        isTemplate: isRecurringTemplate,
        enabled: isRecurringTemplate,
        frequency: recurringFrequency,
        nextRunAt,
        parentTaskId: "",
      },
      comments: [],
    });

    const createdTask = workspace.tasks[workspace.tasks.length - 1];
    addActivity(
      workspace,
      req,
      isRecurringTemplate ? "recurring_template_created" : "task_created",
      "task",
      createdTask._id.toString(),
      `${title} -> ${assignedTo}`
    );

    if (assignedTo && assignedTo !== "Unassigned" && assignedTo !== getActor(req)) {
      addNotification(workspace, {
        userName: assignedTo,
        title: "New Task Assigned",
        message: `${title} was assigned to you.`,
        type: "task",
        link: "/home/tasks",
      });
    }

    await workspace.save();

    res.status(201).json({ success: true, data: serializeWorkspace(workspace) });
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

    const previousAssignee = task.assignedTo;

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
      const parsedDueDate = parseDate(req.body.dueDate);
      if (parsedDueDate) {
        task.dueDate = parsedDueDate;
      }
    }

    addActivity(workspace, req, "task_updated", "task", task._id.toString(), task.title);

    if (
      task.assignedTo &&
      task.assignedTo !== previousAssignee &&
      task.assignedTo !== getActor(req) &&
      task.assignedTo !== "Unassigned"
    ) {
      addNotification(workspace, {
        userName: task.assignedTo,
        title: "Task Reassigned",
        message: `${task.title} has been assigned to you.`,
        type: "task",
        link: "/home/tasks",
      });
    }

    await workspace.save();
    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
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

    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTasksBulk = async (req, res) => {
  const scope = String(req.body?.scope || "").trim(); // person | team
  const assignee = String(req.body?.assignee || "").trim();
  const projectId = String(req.body?.projectId || "").trim();

  if (!scope || !["person", "team"].includes(scope)) {
    return res.status(400).json({ success: false, message: "Valid scope (person/team) is required" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    const before = workspace.tasks.length;

    if (scope === "person") {
      if (!assignee) {
        return res.status(400).json({ success: false, message: "Assignee is required for person scope" });
      }
      workspace.tasks = workspace.tasks.filter((task) => task.assignedTo !== assignee);
      addActivity(
        workspace,
        req,
        "tasks_bulk_deleted_person",
        "task",
        "",
        `All tasks removed for ${assignee}`
      );
    }

    if (scope === "team") {
      if (!projectId) {
        return res.status(400).json({ success: false, message: "Project ID is required for team scope" });
      }
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: "Project not found" });
      }

      const teamNames = new Set((project.members || []).map((member) => member.name));
      workspace.tasks = workspace.tasks.filter((task) => !teamNames.has(task.assignedTo));
      addActivity(
        workspace,
        req,
        "tasks_bulk_deleted_team",
        "task",
        projectId,
        `All tasks removed for team ${project.name}`
      );
    }

    const deletedCount = before - workspace.tasks.length;
    await workspace.save();

    res.status(200).json({
      success: true,
      message: `${deletedCount} task(s) deleted`,
      deletedCount,
      data: serializeWorkspace(workspace),
    });
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
    if (task.assignedTo && task.assignedTo !== user && task.assignedTo !== "Unassigned") {
      addNotification(workspace, {
        userName: task.assignedTo,
        title: "New Task Comment",
        message: `${user} commented on ${task.title}.`,
        type: "comment",
        link: "/home/tasks",
      });
    }
    await workspace.save();
    res.status(201).json({ success: true, data: serializeWorkspace(workspace) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addSubtask = async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ success: false, message: "Subtask text is required" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.subtasks.push({ text, done: false });
    addActivity(workspace, req, "subtask_added", "task", task._id.toString(), text);
    await workspace.save();
    res.status(201).json({ success: true, data: serializeWorkspace(workspace) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleSubtask = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, message: "Subtask not found" });
    }

    subtask.done = !subtask.done;
    addActivity(
      workspace,
      req,
      "subtask_toggled",
      "task",
      task._id.toString(),
      `${subtask.text} -> ${subtask.done ? "done" : "undone"}`
    );
    await workspace.save();
    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteSubtask = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const task = workspace.tasks.id(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, message: "Subtask not found" });
    }

    const subtaskText = subtask.text;
    subtask.deleteOne();
    addActivity(workspace, req, "subtask_deleted", "task", task._id.toString(), subtaskText);
    await workspace.save();
    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
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

    res.status(200).json({ success: true, data: serializeWorkspace(workspace) });
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

const getNotifications = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const unreadOnly = req.query.unreadOnly === "true";

    let notifications = workspace.notifications.filter((notification) =>
      notificationBelongsToUser(notification, req)
    );

    if (unreadOnly) {
      notifications = notifications.filter((notification) => !notification.read);
    }

    const total = notifications.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const items = notifications.slice(start, start + limit);

    res.status(200).json({
      success: true,
      data: items,
      meta: {
        total,
        page: safePage,
        limit,
        totalPages,
        unreadCount: notifications.filter((notification) => !notification.read).length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const notification = workspace.notifications.id(req.params.notificationId);
    if (!notification || !notificationBelongsToUser(notification, req)) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    notification.read = true;
    await workspace.save();
    res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    for (const notification of workspace.notifications) {
      if (notificationBelongsToUser(notification, req)) {
        notification.read = true;
      }
    }
    await workspace.save();
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSavedViews = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const views = workspace.savedViews.filter((view) => view.userId === req.user.id);
    res.status(200).json({ success: true, data: views });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const saveTaskView = async (req, res) => {
  const name = (req.body?.name || "").trim();
  const filters = req.body?.filters || {};

  if (!name) {
    return res.status(400).json({ success: false, message: "View name is required" });
  }

  try {
    const workspace = await getOrCreateWorkspace();
    const existing = workspace.savedViews.find(
      (view) => view.userId === req.user.id && view.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      existing.filters = filters;
      existing.createdAt = new Date();
    } else {
      workspace.savedViews.push({
        userId: req.user.id,
        userName: req.user.name || req.user.email || "User",
        name,
        filters,
      });
    }

    await workspace.save();
    const views = workspace.savedViews.filter((view) => view.userId === req.user.id);
    res.status(201).json({ success: true, data: views });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTaskView = async (req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const view = workspace.savedViews.id(req.params.viewId);
    if (!view || view.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Saved view not found" });
    }

    view.deleteOne();
    await workspace.save();
    const views = workspace.savedViews.filter((item) => item.userId === req.user.id);
    res.status(200).json({ success: true, data: views });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTaskSummaryReport = async (_req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const visibleTasks = workspace.tasks.filter((task) => !task.recurring?.isTemplate);
    const now = Date.now();
    const total = visibleTasks.length;
    const completed = visibleTasks.filter((task) => task.done).length;
    const pending = total - completed;
    const overdue = visibleTasks.filter(
      (task) => task.dueDate && !task.done && new Date(task.dueDate).getTime() < now
    ).length;

    const byPriority = {
      Urgent: visibleTasks.filter((task) => task.priority === "Urgent").length,
      High: visibleTasks.filter((task) => task.priority === "High").length,
      Medium: visibleTasks.filter((task) => task.priority === "Medium").length,
      Low: visibleTasks.filter((task) => task.priority === "Low").length,
    };

    const memberMap = new Map();
    for (const task of visibleTasks) {
      const key = task.assignedTo || "Unassigned";
      if (!memberMap.has(key)) {
        memberMap.set(key, { assignedTo: key, total: 0, completed: 0 });
      }
      const entry = memberMap.get(key);
      entry.total += 1;
      if (task.done) entry.completed += 1;
    }

    const memberBreakdown = [...memberMap.values()]
      .map((entry) => ({
        ...entry,
        completionRate: entry.total ? Number(((entry.completed / entry.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    res.status(200).json({
      success: true,
      data: {
        total,
        completed,
        pending,
        overdue,
        completionRate: total ? Number(((completed / total) * 100).toFixed(1)) : 0,
        byPriority,
        memberBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportTasksCsv = async (_req, res) => {
  try {
    const workspace = await getOrCreateWorkspace();
    const tasks = workspace.tasks.filter((task) => !task.recurring?.isTemplate);

    const header = buildCsvLine([
      "Task ID",
      "Title",
      "Description",
      "Assigned To",
      "Priority",
      "Status",
      "Due Date",
      "Subtasks Done",
      "Subtasks Total",
      "Created At",
    ]);

    const lines = tasks.map((task) => {
      const subtaskTotal = task.subtasks?.length || 0;
      const subtaskDone = (task.subtasks || []).filter((subtask) => subtask.done).length;
      return buildCsvLine([
        task._id,
        task.title,
        task.description,
        task.assignedTo,
        task.priority,
        task.done ? "Done" : "Undone",
        task.dueDate ? new Date(task.dueDate).toISOString() : "",
        subtaskDone,
        subtaskTotal,
        task.createdAt ? new Date(task.createdAt).toISOString() : "",
      ]);
    });

    const csv = [header, ...lines].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=\"devflow-tasks-${stamp}.csv\"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWorkspace,
  getWorkspaceUpdates,
  getTasks,
  addMember,
  removeMember,
  addTask,
  updateTask,
  deleteTask,
  deleteTasksBulk,
  addTaskComment,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  toggleTask,
  getMessages,
  addMessage,
  getActivityLog,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getSavedViews,
  saveTaskView,
  deleteTaskView,
  getTaskSummaryReport,
  exportTasksCsv,
};
