const express = require("express");
const {
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
} = require("../controllers/workspaceController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWorkspace);
router.get("/tasks", getTasks);
router.post("/members", requireRole("management"), addMember);
router.delete("/members/:memberId", requireRole("management"), removeMember);
router.post("/tasks", addTask);
router.patch("/tasks/:taskId", updateTask);
router.delete("/tasks/:taskId", requireRole("management"), deleteTask);
router.patch("/tasks/:taskId/toggle", toggleTask);
router.post("/tasks/:taskId/comments", addTaskComment);
router.get("/messages", getMessages);
router.post("/messages", addMessage);
router.get("/activity", requireRole("management"), getActivityLog);

module.exports = router;
