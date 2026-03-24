const express = require("express");
const {
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
} = require("../controllers/workspaceController");
const { requireAuth, requireRole, forbidRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWorkspace);
router.get("/updates", getWorkspaceUpdates);
router.get("/tasks", getTasks);
router.post("/members", requireRole("management", "admin"), addMember);
router.delete("/members/:memberId", requireRole("management", "admin"), removeMember);
router.post("/tasks", forbidRole("viewer"), addTask);
router.patch("/tasks/:taskId", forbidRole("viewer"), updateTask);
router.delete("/tasks/bulk-delete", requireRole("admin"), deleteTasksBulk);
router.delete("/tasks/:taskId", requireRole("management", "admin"), deleteTask);
router.patch("/tasks/:taskId/toggle", forbidRole("viewer"), toggleTask);
router.post("/tasks/:taskId/comments", forbidRole("viewer"), addTaskComment);
router.post("/tasks/:taskId/subtasks", forbidRole("viewer"), addSubtask);
router.patch("/tasks/:taskId/subtasks/:subtaskId/toggle", forbidRole("viewer"), toggleSubtask);
router.delete("/tasks/:taskId/subtasks/:subtaskId", forbidRole("viewer"), deleteSubtask);
router.get("/messages", getMessages);
router.post("/messages", forbidRole("viewer"), addMessage);
router.get("/activity", requireRole("management", "admin"), getActivityLog);
router.get("/notifications", getNotifications);
router.patch("/notifications/read-all", markAllNotificationsRead);
router.patch("/notifications/:notificationId/read", markNotificationRead);
router.get("/views", getSavedViews);
router.post("/views", saveTaskView);
router.delete("/views/:viewId", deleteTaskView);
router.get("/reports/summary", requireRole("management", "admin"), getTaskSummaryReport);
router.get("/reports/tasks.csv", requireRole("management", "admin"), exportTasksCsv);

module.exports = router;
