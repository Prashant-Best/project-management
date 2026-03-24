const mongoose = require("mongoose");
const User = require("../models/user");
const { Project, TEAM_POSITIONS } = require("../models/project");

function isValidPosition(position) {
  return TEAM_POSITIONS.includes(position);
}

function sanitizeMembersInput(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((member) => ({
      userId: String(member?.userId || "").trim(),
      position: String(member?.position || "team_member").trim(),
    }))
    .filter((member) => member.userId);
}

async function buildMemberDocs(memberInputs) {
  const uniqueInputs = [];
  const seen = new Set();
  for (const input of memberInputs) {
    if (!seen.has(input.userId) && mongoose.isValidObjectId(input.userId)) {
      seen.add(input.userId);
      uniqueInputs.push(input);
    }
  }

  const ids = uniqueInputs.map((input) => input.userId);
  const users = await User.find({ _id: { $in: ids } });
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  const members = [];
  for (const input of uniqueInputs) {
    const user = userMap.get(input.userId);
    if (!user) continue;
    members.push({
      userId: user._id,
      name: user.name,
      email: user.email,
      systemRole: user.role,
      position: isValidPosition(input.position) ? input.position : "team_member",
    });
  }

  return members;
}

const listProjects = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const query = isAdmin ? {} : { "members.userId": req.user.id };
    const projects = await Project.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const isAdmin = req.user?.role === "admin";
    const isMember = project.members.some(
      (member) => member.userId.toString() === req.user.id
    );
    if (!isAdmin && !isMember) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createProject = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();

  if (!name) {
    return res.status(400).json({ success: false, message: "Project name is required" });
  }

  try {
    const rawMembers = sanitizeMembersInput(req.body?.members);
    rawMembers.push({ userId: req.user.id, position: "team_head" });

    const members = await buildMemberDocs(rawMembers);
    if (!members.length) {
      return res.status(400).json({ success: false, message: "At least one valid member is required" });
    }

    if (!members.some((member) => member.position === "team_head")) {
      members[0].position = "team_head";
    }

    const creator = await User.findById(req.user.id);
    const project = await Project.create({
      name,
      description,
      createdBy: {
        userId: req.user.id,
        name: creator?.name || req.user.name || "Admin",
        email: creator?.email || req.user.email || "",
      },
      members,
    });

    res.status(201).json({ success: true, message: "Project created", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addProjectMember = async (req, res) => {
  const userId = String(req.body?.userId || "").trim();
  const position = String(req.body?.position || "team_member").trim();

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: "Valid userId is required" });
  }

  if (!isValidPosition(position)) {
    return res.status(400).json({ success: false, message: "Invalid position" });
  }

  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const alreadyExists = project.members.some((member) => member.userId.toString() === userId);
    if (alreadyExists) {
      return res.status(409).json({ success: false, message: "User already in this project" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    project.members.push({
      userId: user._id,
      name: user.name,
      email: user.email,
      systemRole: user.role,
      position,
    });

    await project.save();
    res.status(201).json({ success: true, message: "Member added", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProjectMember = async (req, res) => {
  const position = String(req.body?.position || "").trim();
  if (!isValidPosition(position)) {
    return res.status(400).json({ success: false, message: "Invalid position" });
  }

  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const member = project.members.id(req.params.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found in project" });
    }

    member.position = position;
    await project.save();
    res.status(200).json({ success: true, message: "Member updated", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const removeProjectMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const member = project.members.id(req.params.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found in project" });
    }

    const isCreator = member.userId.toString() === project.createdBy.userId.toString();
    if (isCreator) {
      return res.status(400).json({ success: false, message: "Project creator cannot be removed" });
    }

    member.deleteOne();
    await project.save();
    res.status(200).json({ success: true, message: "Member removed", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listProjects,
  getProjectById,
  createProject,
  addProjectMember,
  updateProjectMember,
  removeProjectMember,
};
