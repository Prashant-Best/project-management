const STORAGE_KEY = "devflow-local-db";
const TOKEN_KEY = "authToken";
const DEFAULT_DB_NAME = "devflow";
const USER_ROLES = new Set(["admin", "management", "team_member", "viewer"]);
const TEAM_POSITIONS = new Set(["team_head", "manager", "team_member"]);
const PRIORITY_ORDER = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

const clone = (value) => JSON.parse(JSON.stringify(value));

const now = () => new Date().toISOString();

const createId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const readCurrentUser = () => {
  const raw = localStorage.getItem("loggedInUser");
  return raw ? JSON.parse(raw) : null;
};

const sanitizeUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || "",
  createdAt: user.createdAt,
});

const createActivity = (actor, action, targetType) => ({
  _id: createId("activity"),
  actor,
  action,
  targetType,
  createdAt: now(),
});

const createNotification = (title, message) => ({
  _id: createId("notification"),
  title,
  message,
  read: false,
  createdAt: now(),
});

const createMemberFromUser = (user, position = "team_member") => ({
  _id: createId("member"),
  userId: user._id,
  name: user.name,
  email: user.email,
  position,
});

const createSeedData = () => {
  const createdAt = now();
  const users = [
    {
      _id: createId("user"),
      name: "Prashant Panwar",
      email: "admin@devflow.app",
      password: "admin123",
      role: "admin",
      phone: "6398890593",
      createdAt,
    },
    {
      _id: createId("user"),
      name: "Aarav Sharma",
      email: "manager@devflow.app",
      password: "manager123",
      role: "management",
      phone: "9876543210",
      createdAt,
    },
    {
      _id: createId("user"),
      name: "Neha Singh",
      email: "member@devflow.app",
      password: "member123",
      role: "team_member",
      phone: "9123456780",
      createdAt,
    },
    {
      _id: createId("user"),
      name: "Riya Verma",
      email: "viewer@devflow.app",
      password: "viewer123",
      role: "viewer",
      phone: "",
      createdAt,
    },
  ];

  const members = [
    createMemberFromUser(users[0], "team_head"),
    createMemberFromUser(users[1], "manager"),
    createMemberFromUser(users[2], "team_member"),
  ];

  const tasks = [
    {
      _id: createId("task"),
      title: "Launch Vercel deployment",
      description: "Finalize the hosted version of DevFlow.",
      assignedTo: users[1].name,
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      priority: "High",
      done: false,
      recurringFrequency: "none",
      recurring: {},
      comments: [],
      subtasks: [
        { _id: createId("subtask"), text: "Verify build settings", done: true },
        { _id: createId("subtask"), text: "Confirm live URL", done: false },
      ],
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: createId("task"),
      title: "Review product analytics",
      description: "Check completion charts and summary cards.",
      assignedTo: users[2].name,
      dueDate: new Date(Date.now() + 4 * 86400000).toISOString(),
      priority: "Medium",
      done: false,
      recurringFrequency: "weekly",
      recurring: { parentTaskId: createId("recurring") },
      comments: [],
      subtasks: [],
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const project = {
    _id: createId("project"),
    name: "DevFlow Launch Team",
    description: "Core workspace for planning and execution.",
    members: [
      { ...members[0] },
      { ...members[1] },
      { ...members[2] },
    ],
    createdAt,
  };

  return {
    name: DEFAULT_DB_NAME,
    users,
    projects: [project],
    workspace: {
      members,
      tasks,
      messages: [
        {
          _id: createId("message"),
          user: users[1].name,
          text: "Let’s keep the launch checklist moving.",
          createdAt,
        },
      ],
      notifications: [
        createNotification("Welcome to DevFlow", "Your local workspace is ready to use."),
      ],
      savedViews: [],
      activity: [
        createActivity(users[0].name, "initialized_workspace", "workspace"),
      ],
      updatedAt: createdAt,
    },
  };
};

const loadDb = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = createSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const seed = createSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
};

const saveDb = (db) => {
  db.workspace.updatedAt = now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
};

const ok = (payload = {}) => Promise.resolve({ data: payload });

const fail = (status, message) =>
  Promise.reject({
    response: {
      status,
      data: { success: false, message },
    },
  });

const normalizePath = (path) => path.replace(/^\/api/, "");

const findUserByToken = (db) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token?.startsWith("local-token:")) return null;
  const userId = token.split(":")[1];
  return db.users.find((user) => user._id === userId) || null;
};

const requireAuth = (db) => {
  const user = findUserByToken(db) || readCurrentUser();
  if (!user?._id) {
    throw fail(401, "Unauthorized");
  }

  const dbUser = db.users.find((item) => item._id === user._id) || null;
  if (!dbUser) {
    throw fail(401, "Unauthorized");
  }
  return dbUser;
};

const requireRole = (user, roles) => {
  if (!roles.includes(user.role)) {
    throw fail(403, "Forbidden");
  }
};

const addWorkspaceMemberIfMissing = (db, user, position = "team_member") => {
  const existing = db.workspace.members.find((member) => member.userId === user._id);
  if (existing) {
    existing.name = user.name;
    existing.email = user.email;
    existing.position = TEAM_POSITIONS.has(existing.position) ? existing.position : position;
    return existing;
  }

  const member = createMemberFromUser(user, position);
  db.workspace.members.push(member);
  return member;
};

const logActivity = (db, actor, action, targetType) => {
  db.workspace.activity.unshift(createActivity(actor, action, targetType));
  db.workspace.activity = db.workspace.activity.slice(0, 100);
};

const pushNotification = (db, title, message) => {
  db.workspace.notifications.unshift(createNotification(title, message));
  db.workspace.notifications = db.workspace.notifications.slice(0, 100);
};

const getWorkspaceSnapshot = (db) => ({
  members: clone(db.workspace.members),
  tasks: clone(db.workspace.tasks),
  updatedAt: db.workspace.updatedAt,
});

const filterTasks = (tasks, params = {}) => {
  let list = [...tasks];
  const q = String(params.q || "").trim().toLowerCase();

  if (params.assignedTo) {
    list = list.filter((task) => task.assignedTo === params.assignedTo);
  }
  if (params.status === "done") {
    list = list.filter((task) => task.done);
  }
  if (params.status === "undone") {
    list = list.filter((task) => !task.done);
  }
  if (params.status === "overdue") {
    list = list.filter((task) => task.dueDate && !task.done && new Date(task.dueDate) < new Date());
  }
  if (params.priority && params.priority !== "all") {
    list = list.filter((task) => task.priority === params.priority);
  }
  if (params.dueFrom) {
    list = list.filter((task) => task.dueDate && new Date(task.dueDate) >= new Date(params.dueFrom));
  }
  if (params.dueTo) {
    list = list.filter((task) => task.dueDate && new Date(task.dueDate) <= new Date(params.dueTo));
  }
  if (String(params.recurringOnly) === "true") {
    list = list.filter((task) => task.recurringFrequency && task.recurringFrequency !== "none");
  }
  if (q) {
    list = list.filter((task) => {
      const haystack = [
        task.title,
        task.description,
        task.assignedTo,
        ...(task.subtasks || []).map((subtask) => subtask.text),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  switch (params.sortBy) {
    case "due_asc":
      list.sort((a, b) => new Date(a.dueDate || 8640000000000000) - new Date(b.dueDate || 8640000000000000));
      break;
    case "due_desc":
      list.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
      break;
    case "priority_desc":
      list.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
      break;
    case "priority_asc":
      list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      break;
    default:
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  return list;
};

const paginate = (items, page = 1, limit = 10) => {
  const safeLimit = Math.max(1, Number(limit) || 10);
  const safePage = Math.max(1, Number(page) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;

  return {
    data: items.slice(start, start + safeLimit),
    meta: { page: safePage, totalPages, total, limit: safeLimit },
  };
};

const buildCsv = (tasks) => {
  const header = ["Title", "Assigned To", "Priority", "Status", "Due Date"];
  const rows = tasks.map((task) => [
    task.title,
    task.assignedTo,
    task.priority,
    task.done ? "Done" : "Pending",
    task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new Blob([csv], { type: "text/csv;charset=utf-8" });
};

const routeRequest = (method, rawPath, config = {}) => {
  const db = loadDb();
  const path = normalizePath(rawPath);
  const payload = config.data || {};
  const params = config.params || {};

  try {
    if (method === "POST" && (path === "/users" || path === "/users/signup")) {
      const { name, email, password, role, phone = "" } = payload;
      if (!name || !email || !password || !role) {
        return fail(400, "Name, email, password and role are required");
      }
      if (!USER_ROLES.has(role)) {
        return fail(400, "Invalid role selected");
      }
      const existing = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return fail(409, "Email already registered");
      }

      const user = {
        _id: createId("user"),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        phone: phone.trim(),
        createdAt: now(),
      };
      db.users.push(user);
      addWorkspaceMemberIfMissing(db, user);
      logActivity(db, user.name, "created_account", "user");
      pushNotification(db, "New user joined", `${user.name} created an account.`);
      saveDb(db);

      return ok({
        success: true,
        message: "User created successfully",
        data: sanitizeUser(user),
      });
    }

    if (method === "POST" && path === "/users/login") {
      const { email, password, role } = payload;
      const user = db.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
      if (!user || user.password !== password) {
        return fail(401, "Invalid email or password");
      }
      if (role && user.role !== role) {
        return fail(401, "Role does not match this account");
      }

      localStorage.setItem(TOKEN_KEY, `local-token:${user._id}`);
      localStorage.setItem("loggedInUser", JSON.stringify(sanitizeUser(user)));
      addWorkspaceMemberIfMissing(db, user, user.role === "admin" ? "team_head" : "team_member");
      saveDb(db);

      return ok({
        success: true,
        message: `Welcome ${user.name}`,
        token: `local-token:${user._id}`,
        data: sanitizeUser(user),
      });
    }

    const currentUser = requireAuth(db);

    if (method === "GET" && path === "/users") {
      requireRole(currentUser, ["management", "admin"]);
      return ok({ success: true, data: db.users.map(sanitizeUser) });
    }

    if (method === "GET" && path === "/users/me") {
      return ok({ success: true, data: sanitizeUser(currentUser) });
    }

    if (method === "PATCH" && path === "/users/me") {
      currentUser.name = String(payload.name || currentUser.name).trim() || currentUser.name;
      currentUser.phone = String(payload.phone || "").trim();
      if (
        ["management", "admin"].includes(currentUser.role) &&
        payload.role &&
        USER_ROLES.has(payload.role)
      ) {
        currentUser.role = payload.role;
      }

      addWorkspaceMemberIfMissing(db, currentUser);
      logActivity(db, currentUser.name, "updated_profile", "user");
      saveDb(db);
      localStorage.setItem("loggedInUser", JSON.stringify(sanitizeUser(currentUser)));

      return ok({ success: true, message: "Profile updated", data: sanitizeUser(currentUser) });
    }

    if (method === "PATCH" && path === "/users/me/password") {
      if (payload.currentPassword !== currentUser.password) {
        return fail(401, "Current password is incorrect");
      }
      if (!payload.newPassword || String(payload.newPassword).length < 6) {
        return fail(400, "Current password and new password (min 6 chars) are required");
      }
      currentUser.password = payload.newPassword;
      logActivity(db, currentUser.name, "changed_password", "user");
      saveDb(db);
      return ok({ success: true, message: "Password changed successfully" });
    }

    {
      const match = path.match(/^\/users\/([^/]+)\/role$/);
      if (method === "PATCH" && match) {
        requireRole(currentUser, ["admin"]);
        const user = db.users.find((item) => item._id === match[1]);
        if (!user) return fail(404, "User not found");
        if (!USER_ROLES.has(payload.role)) return fail(400, "Invalid role selected");
        user.role = payload.role;
        logActivity(db, currentUser.name, "updated_user_role", "user");
        pushNotification(db, "Role updated", `${user.name} is now ${user.role}.`);
        saveDb(db);
        return ok({ success: true, message: "User role updated", data: sanitizeUser(user) });
      }
    }

    if (method === "GET" && path === "/projects") {
      return ok({ success: true, data: clone(db.projects) });
    }

    if (method === "POST" && path === "/projects") {
      requireRole(currentUser, ["admin"]);
      if (!String(payload.name || "").trim()) return fail(400, "Project name is required");

      const members = (payload.members || []).map((memberInput) => {
        const user = db.users.find((item) => item._id === memberInput.userId);
        if (!user) return null;
        const position = TEAM_POSITIONS.has(memberInput.position) ? memberInput.position : "team_member";
        addWorkspaceMemberIfMissing(db, user, position);
        return {
          _id: createId("project_member"),
          userId: user._id,
          name: user.name,
          email: user.email,
          position,
        };
      }).filter(Boolean);

      const project = {
        _id: createId("project"),
        name: String(payload.name).trim(),
        description: String(payload.description || "").trim(),
        members,
        createdAt: now(),
      };
      db.projects.unshift(project);
      logActivity(db, currentUser.name, "created_project", "project");
      pushNotification(db, "Project created", `${project.name} is now active.`);
      saveDb(db);
      return ok({ success: true, data: clone(project) });
    }

    {
      const match = path.match(/^\/projects\/([^/]+)\/members$/);
      if (method === "POST" && match) {
        requireRole(currentUser, ["admin"]);
        const project = db.projects.find((item) => item._id === match[1]);
        if (!project) return fail(404, "Project not found");
        const user = db.users.find((item) => item._id === payload.userId);
        if (!user) return fail(404, "User not found");
        if (project.members.some((member) => member.userId === user._id)) {
          return fail(409, "User already assigned to project");
        }
        const position = TEAM_POSITIONS.has(payload.position) ? payload.position : "team_member";
        project.members.push({
          _id: createId("project_member"),
          userId: user._id,
          name: user.name,
          email: user.email,
          position,
        });
        addWorkspaceMemberIfMissing(db, user, position);
        logActivity(db, currentUser.name, "added_project_member", "project");
        saveDb(db);
        return ok({ success: true, data: clone(project) });
      }
    }

    {
      const match = path.match(/^\/projects\/([^/]+)\/members\/([^/]+)$/);
      if (method === "PATCH" && match) {
        requireRole(currentUser, ["admin"]);
        const project = db.projects.find((item) => item._id === match[1]);
        if (!project) return fail(404, "Project not found");
        const member = project.members.find((item) => item._id === match[2]);
        if (!member) return fail(404, "Member not found");
        member.position = TEAM_POSITIONS.has(payload.position) ? payload.position : member.position;
        const workspaceMember = db.workspace.members.find((item) => item.userId === member.userId);
        if (workspaceMember) workspaceMember.position = member.position;
        logActivity(db, currentUser.name, "updated_project_member", "project");
        saveDb(db);
        return ok({ success: true, data: clone(project) });
      }

      if (method === "DELETE" && match) {
        requireRole(currentUser, ["admin"]);
        const project = db.projects.find((item) => item._id === match[1]);
        if (!project) return fail(404, "Project not found");
        project.members = project.members.filter((item) => item._id !== match[2]);
        logActivity(db, currentUser.name, "removed_project_member", "project");
        saveDb(db);
        return ok({ success: true, data: clone(project) });
      }
    }

    if (method === "GET" && path === "/workspace") {
      return ok({ success: true, data: getWorkspaceSnapshot(db) });
    }

    if (method === "GET" && path === "/workspace/reports/summary") {
      const total = db.workspace.tasks.length;
      const completed = db.workspace.tasks.filter((task) => task.done).length;
      const overdue = db.workspace.tasks.filter(
        (task) => task.dueDate && !task.done && new Date(task.dueDate) < new Date()
      ).length;
      const completionRate = total ? Number(((completed / total) * 100).toFixed(1)) : 0;
      return ok({ success: true, data: { total, completed, overdue, completionRate } });
    }

    if (method === "GET" && path === "/workspace/activity") {
      const page = Number(params.page) || 1;
      const limit = Number(params.limit) || 10;
      const start = (page - 1) * limit;
      return ok({ success: true, data: clone(db.workspace.activity.slice(start, start + limit)) });
    }

    if (method === "GET" && path === "/workspace/reports/tasks.csv") {
      return Promise.resolve({ data: buildCsv(db.workspace.tasks) });
    }

    if (method === "GET" && path === "/workspace/updates") {
      const unreadNotifications = db.workspace.notifications.filter((item) => !item.read).length;
      return ok({
        success: true,
        data: {
          unreadNotifications,
          changed: false,
          updatedAt: db.workspace.updatedAt,
        },
      });
    }

    if (method === "GET" && path === "/workspace/messages") {
      return ok({ success: true, data: clone(db.workspace.messages) });
    }

    if (method === "POST" && path === "/workspace/messages") {
      if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
      const message = {
        _id: createId("message"),
        user: String(payload.user || currentUser.name).trim() || currentUser.name,
        text: String(payload.text || "").trim(),
        createdAt: now(),
      };
      if (!message.text) return fail(400, "Message text is required");
      db.workspace.messages.push(message);
      logActivity(db, currentUser.name, "sent_message", "message");
      saveDb(db);
      return ok({ success: true, data: clone(db.workspace.messages) });
    }

    if (method === "GET" && path === "/workspace/notifications") {
      return ok({ success: true, data: clone(db.workspace.notifications) });
    }

    {
      const match = path.match(/^\/workspace\/notifications\/([^/]+)\/read$/);
      if (method === "PATCH" && match) {
        const notification = db.workspace.notifications.find((item) => item._id === match[1]);
        if (!notification) return fail(404, "Notification not found");
        notification.read = true;
        saveDb(db);
        return ok({ success: true, message: "Notification marked as read" });
      }
    }

    if (method === "PATCH" && path === "/workspace/notifications/read-all") {
      db.workspace.notifications.forEach((item) => {
        item.read = true;
      });
      saveDb(db);
      return ok({ success: true, message: "All notifications marked as read" });
    }

    if (method === "GET" && path === "/workspace/views") {
      return ok({ success: true, data: clone(db.workspace.savedViews) });
    }

    if (method === "POST" && path === "/workspace/views") {
      const view = {
        _id: createId("view"),
        name: String(payload.name || "").trim(),
        filters: clone(payload.filters || {}),
      };
      if (!view.name) return fail(400, "Saved view name is required");
      db.workspace.savedViews.unshift(view);
      saveDb(db);
      return ok({ success: true, data: clone(db.workspace.savedViews) });
    }

    {
      const match = path.match(/^\/workspace\/views\/([^/]+)$/);
      if (method === "DELETE" && match) {
        db.workspace.savedViews = db.workspace.savedViews.filter((item) => item._id !== match[1]);
        saveDb(db);
        return ok({ success: true, data: clone(db.workspace.savedViews) });
      }
    }

    if (method === "GET" && path === "/workspace/tasks") {
      const filtered = filterTasks(db.workspace.tasks, params);
      const result = paginate(filtered, params.page, params.limit);
      return ok({ success: true, data: clone(result.data), meta: result.meta });
    }

    if (method === "POST" && path === "/workspace/tasks") {
      if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
      if (!String(payload.title || "").trim()) return fail(400, "Task title is required");
      const task = {
        _id: createId("task"),
        title: String(payload.title).trim(),
        description: String(payload.description || "").trim(),
        assignedTo: String(payload.assignedTo || "Unassigned").trim(),
        dueDate: payload.dueDate || null,
        priority: payload.priority || "Medium",
        done: false,
        recurringFrequency: payload.recurringFrequency || "none",
        recurring:
          payload.recurringFrequency && payload.recurringFrequency !== "none"
            ? { parentTaskId: createId("recurring") }
            : {},
        comments: [],
        subtasks: [],
        createdAt: now(),
        updatedAt: now(),
      };
      db.workspace.tasks.unshift(task);
      logActivity(db, currentUser.name, "created_task", "task");
      pushNotification(db, "Task created", `${task.title} was assigned to ${task.assignedTo}.`);
      saveDb(db);
      return ok({ success: true, data: getWorkspaceSnapshot(db) });
    }

    {
      const match = path.match(/^\/workspace\/tasks\/([^/]+)\/toggle$/);
      if (method === "PATCH" && match) {
        if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
        const task = db.workspace.tasks.find((item) => item._id === match[1]);
        if (!task) return fail(404, "Task not found");
        task.done = !task.done;
        task.updatedAt = now();
        logActivity(db, currentUser.name, task.done ? "completed_task" : "reopened_task", "task");
        pushNotification(db, "Task updated", `${task.title} is now ${task.done ? "done" : "active"}.`);
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }
    }

    {
      const match = path.match(/^\/workspace\/tasks\/([^/]+)$/);
      if (method === "PATCH" && match) {
        if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
        const task = db.workspace.tasks.find((item) => item._id === match[1]);
        if (!task) return fail(404, "Task not found");
        if (payload.title !== undefined) task.title = String(payload.title || task.title).trim() || task.title;
        if ("dueDate" in payload) task.dueDate = payload.dueDate || null;
        task.updatedAt = now();
        logActivity(db, currentUser.name, "edited_task", "task");
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }

      if (method === "DELETE" && match) {
        if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
        db.workspace.tasks = db.workspace.tasks.filter((item) => item._id !== match[1]);
        logActivity(db, currentUser.name, "deleted_task", "task");
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }
    }

    if (method === "DELETE" && path === "/workspace/tasks/bulk-delete") {
      requireRole(currentUser, ["admin", "management"]);
      if (payload.scope === "person") {
        db.workspace.tasks = db.workspace.tasks.filter((task) => task.assignedTo !== payload.assignee);
      } else if (payload.scope === "team") {
        const project = db.projects.find((item) => item._id === payload.projectId);
        const memberNames = new Set((project?.members || []).map((member) => member.name));
        db.workspace.tasks = db.workspace.tasks.filter((task) => !memberNames.has(task.assignedTo));
      }
      logActivity(db, currentUser.name, "bulk_deleted_tasks", "task");
      saveDb(db);
      return ok({ success: true, data: getWorkspaceSnapshot(db) });
    }

    {
      const match = path.match(/^\/workspace\/tasks\/([^/]+)\/comments$/);
      if (method === "POST" && match) {
        if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
        const task = db.workspace.tasks.find((item) => item._id === match[1]);
        if (!task) return fail(404, "Task not found");
        task.comments.push({
          _id: createId("comment"),
          text: String(payload.text || "").trim(),
          user: String(payload.user || currentUser.name).trim() || currentUser.name,
          createdAt: now(),
        });
        task.updatedAt = now();
        logActivity(db, currentUser.name, "commented_on_task", "task");
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }
    }

    {
      const match = path.match(/^\/workspace\/tasks\/([^/]+)\/subtasks$/);
      if (method === "POST" && match) {
        if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
        const task = db.workspace.tasks.find((item) => item._id === match[1]);
        if (!task) return fail(404, "Task not found");
        task.subtasks.push({
          _id: createId("subtask"),
          text: String(payload.text || "").trim(),
          done: false,
        });
        task.updatedAt = now();
        logActivity(db, currentUser.name, "created_subtask", "task");
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }
    }

    {
      const match = path.match(/^\/workspace\/tasks\/([^/]+)\/subtasks\/([^/]+)\/toggle$/);
      if (method === "PATCH" && match) {
        if (currentUser.role === "viewer") return fail(403, "Viewer mode is read-only");
        const task = db.workspace.tasks.find((item) => item._id === match[1]);
        const subtask = task?.subtasks?.find((item) => item._id === match[2]);
        if (!task || !subtask) return fail(404, "Subtask not found");
        subtask.done = !subtask.done;
        task.updatedAt = now();
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }
    }

    if (method === "POST" && path === "/workspace/members") {
      requireRole(currentUser, ["admin", "management"]);
      const memberName = String(payload.name || "").trim();
      if (!memberName) return fail(400, "Member name is required");
      const member = {
        _id: createId("member"),
        userId: null,
        name: memberName,
        email: "",
        position: "team_member",
      };
      db.workspace.members.push(member);
      logActivity(db, currentUser.name, "added_member", "workspace");
      saveDb(db);
      return ok({ success: true, data: getWorkspaceSnapshot(db) });
    }

    {
      const match = path.match(/^\/workspace\/members\/([^/]+)$/);
      if (method === "DELETE" && match) {
        requireRole(currentUser, ["admin", "management"]);
        const member = db.workspace.members.find((item) => item._id === match[1]);
        if (!member) return fail(404, "Member not found");
        db.workspace.members = db.workspace.members.filter((item) => item._id !== match[1]);
        db.workspace.tasks = db.workspace.tasks.filter((task) => task.assignedTo !== member.name);
        logActivity(db, currentUser.name, "removed_member", "workspace");
        saveDb(db);
        return ok({ success: true, data: getWorkspaceSnapshot(db) });
      }
    }

    if (method === "GET" && path === "/api/health") {
      return ok({ success: true, message: "Local storage mode is active" });
    }
  } catch (error) {
    return Promise.reject(error);
  }

  return fail(404, `Unsupported route: ${method} ${path}`);
};

const API = {
  get(path, config = {}) {
    return routeRequest("GET", path, config);
  },
  post(path, data = {}, config = {}) {
    return routeRequest("POST", path, { ...config, data });
  },
  patch(path, data = {}, config = {}) {
    return routeRequest("PATCH", path, { ...config, data });
  },
  delete(path, config = {}) {
    return routeRequest("DELETE", path, config);
  },
};

export default API;
