const express = require("express");
const {
  listProjects,
  getProjectById,
  createProject,
  addProjectMember,
  updateProjectMember,
  removeProjectMember,
} = require("../controllers/projectController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", listProjects);
router.get("/:projectId", getProjectById);
router.post("/", requireRole("admin"), createProject);
router.post("/:projectId/members", requireRole("admin"), addProjectMember);
router.patch("/:projectId/members/:memberId", requireRole("admin"), updateProjectMember);
router.delete("/:projectId/members/:memberId", requireRole("admin"), removeProjectMember);

module.exports = router;
