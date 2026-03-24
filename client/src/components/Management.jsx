import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import API from "../services/api";
import "../assets/styles/management.css";

const TEAM_POSITIONS = ["team_head", "manager", "team_member"];

export default function Management() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
  const isPrivileged = loggedInUser?.role === "management" || loggedInUser?.role === "admin";

  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [projects, setProjects] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectSelections, setProjectSelections] = useState({});
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [addProjectMemberUserId, setAddProjectMemberUserId] = useState("");
  const [addProjectMemberPosition, setAddProjectMemberPosition] = useState("team_member");
  const [projectMemberDrafts, setProjectMemberDrafts] = useState({});
  const [bulkDeleteAssignee, setBulkDeleteAssignee] = useState("");
  const [bulkDeleteProjectId, setBulkDeleteProjectId] = useState("");
  const [summary, setSummary] = useState(null);
  const [newTask, setNewTask] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [recurringFrequency, setRecurringFrequency] = useState("none");
  const [assignedMember, setAssignedMember] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [taskMemberFilter, setTaskMemberFilter] = useState("all");
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");
  const [modalState, setModalState] = useState({
    open: false,
    type: "",
    taskId: "",
    title: "",
    dueDate: "",
    comment: "",
  });

  const syncWorkspace = (workspace) => {
    const members = workspace.members || [];
    const taskList = workspace.tasks || [];
    setTeamMembers(members);
    setTasks(taskList);
    setAssignedMember((current) => {
      if (current && members.some((member) => member._id === current)) return current;
      return members[0]?._id || "";
    });
  };

  const fetchSummary = async () => {
    try {
      const response = await API.get("/workspace/reports/summary");
      setSummary(response.data.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load summary report");
    }
  };

  const fetchUsers = async () => {
    if (loggedInUser?.role !== "admin") return;
    try {
      const response = await API.get("/users");
      const fetchedUsers = response.data.data || [];
      setUsers(fetchedUsers);
      const drafts = {};
      const selections = {};
      for (const user of fetchedUsers) {
        drafts[user._id] = user.role;
        selections[user._id] = { selected: false, position: "team_member" };
      }
      setRoleDrafts(drafts);
      setProjectSelections((prev) => ({ ...selections, ...prev }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    }
  };

  const fetchProjects = async () => {
    if (loggedInUser?.role !== "admin") return;
    try {
      const response = await API.get("/projects");
      const list = response.data.data || [];
      setProjects(list);
      if (!selectedProjectId && list[0]?._id) {
        setSelectedProjectId(list[0]._id);
      }

      const drafts = {};
      for (const project of list) {
        for (const member of project.members || []) {
          drafts[member._id] = member.position;
        }
      }
      setProjectMemberDrafts(drafts);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load projects");
    }
  };

  const fetchWorkspace = async () => {
    try {
      const [workspaceResponse, activityResponse] = await Promise.all([
        API.get("/workspace"),
        API.get("/workspace/activity", { params: { limit: 10, page: 1 } }),
      ]);
      syncWorkspace(workspaceResponse.data.data);
      setActivity(activityResponse.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load management data");
    }
  };

  useEffect(() => {
    if (!isPrivileged) return;
    fetchWorkspace();
    fetchSummary();
    fetchUsers();
    fetchProjects();
    const timer = setInterval(() => {
      fetchWorkspace();
      fetchSummary();
      fetchUsers();
      fetchProjects();
    }, 9000);
    return () => clearInterval(timer);
  }, [isPrivileged]);

  const updateUserRole = async (userId) => {
    if (loggedInUser?.role !== "admin") return;
    const role = roleDrafts[userId];
    if (!role) return;

    try {
      await API.patch(`/users/${userId}/role`, { role });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update user role");
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (loggedInUser?.role !== "admin") return;
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    const members = Object.entries(projectSelections)
      .filter(([, value]) => value?.selected)
      .map(([userId, value]) => ({
        userId,
        position: TEAM_POSITIONS.includes(value.position) ? value.position : "team_member",
      }));

    try {
      await API.post("/projects", {
        name: projectName.trim(),
        description: projectDescription.trim(),
        members,
      });
      setProjectName("");
      setProjectDescription("");
      setProjectSelections((prev) =>
        Object.fromEntries(
          Object.keys(prev).map((userId) => [userId, { selected: false, position: "team_member" }])
        )
      );
      fetchProjects();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create project");
    }
  };

  const addMemberToProject = async () => {
    if (!selectedProjectId || !addProjectMemberUserId) return;
    try {
      await API.post(`/projects/${selectedProjectId}/members`, {
        userId: addProjectMemberUserId,
        position: addProjectMemberPosition,
      });
      setAddProjectMemberUserId("");
      setAddProjectMemberPosition("team_member");
      fetchProjects();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add member to project");
    }
  };

  const updateProjectMemberPosition = async (projectId, memberId) => {
    const position = projectMemberDrafts[memberId];
    if (!position) return;
    try {
      await API.patch(`/projects/${projectId}/members/${memberId}`, { position });
      fetchProjects();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update member position");
    }
  };

  const removeProjectMember = async (projectId, memberId) => {
    try {
      await API.delete(`/projects/${projectId}/members/${memberId}`);
      fetchProjects();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member from project");
    }
  };

  const removeAllTasksForPerson = async () => {
    if (!bulkDeleteAssignee) {
      setError("Select a person to remove tasks.");
      return;
    }
    try {
      await API.delete("/workspace/tasks/bulk-delete", {
        data: { scope: "person", assignee: bulkDeleteAssignee },
      });
      fetchWorkspace();
      fetchSummary();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove tasks for person");
    }
  };

  const removeAllTasksForTeam = async () => {
    if (!bulkDeleteProjectId) {
      setError("Select a team/project to remove tasks.");
      return;
    }
    try {
      await API.delete("/workspace/tasks/bulk-delete", {
        data: { scope: "team", projectId: bulkDeleteProjectId },
      });
      fetchWorkspace();
      fetchSummary();
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove tasks for team");
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const selectedMember = teamMembers.find((member) => member._id === assignedMember);
      const response = await API.post("/workspace/tasks", {
        title: newTask.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        assignedTo: selectedMember?.name || "Unassigned",
        dueDate: newDueDate || null,
        recurringFrequency,
      });
      syncWorkspace(response.data.data);
      fetchWorkspace();
      fetchSummary();
      setNewTask("");
      setNewDescription("");
      setNewDueDate("");
      setNewPriority("Medium");
      setRecurringFrequency("none");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign task");
    }
  };

  const toggleTask = async (id) => {
    try {
      const response = await API.patch(`/workspace/tasks/${id}/toggle`);
      syncWorkspace(response.data.data);
      fetchWorkspace();
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update task");
    }
  };

  const addMember = async () => {
    if (!newMemberName.trim()) return;
    try {
      const response = await API.post("/workspace/members", { name: newMemberName.trim() });
      syncWorkspace(response.data.data);
      fetchWorkspace();
      setNewMemberName("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add member");
    }
  };

  const removeMember = async (id) => {
    try {
      const response = await API.delete(`/workspace/members/${id}`);
      syncWorkspace(response.data.data);
      fetchWorkspace();
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member");
    }
  };

  const deleteTask = async (id) => {
    try {
      const response = await API.delete(`/workspace/tasks/${id}`);
      syncWorkspace(response.data.data);
      fetchWorkspace();
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete task");
    }
  };

  const submitEditTask = async () => {
    if (!modalState.taskId) return;
    try {
      const targetTask = tasks.find((task) => task._id === modalState.taskId);
      if (!targetTask) return;

      const response = await API.patch(`/workspace/tasks/${targetTask._id}`, {
        title: modalState.title.trim() || targetTask.title,
        dueDate: modalState.dueDate.trim() || null,
      });
      syncWorkspace(response.data.data);
      fetchWorkspace();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to edit task");
    }
  };

  const submitTaskComment = async () => {
    if (!modalState.taskId || !modalState.comment.trim()) return;
    try {
      const response = await API.post(`/workspace/tasks/${modalState.taskId}/comments`, {
        text: modalState.comment.trim(),
        user: loggedInUser.name || "User",
      });
      syncWorkspace(response.data.data);
      fetchWorkspace();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment");
    }
  };

  const openEditModal = (task) => {
    setModalState({
      open: true,
      type: "edit",
      taskId: task._id,
      title: task.title || "",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
      comment: "",
    });
  };

  const openCommentModal = (taskId) => {
    setModalState({
      open: true,
      type: "comment",
      taskId,
      title: "",
      dueDate: "",
      comment: "",
    });
  };

  const closeModal = () => {
    setModalState({
      open: false,
      type: "",
      taskId: "",
      title: "",
      dueDate: "",
      comment: "",
    });
  };

  const exportCsv = async () => {
    try {
      const response = await API.get("/workspace/reports/tasks.csv", {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `devflow-tasks-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export CSV");
    }
  };

  if (!isPrivileged) {
    return (
      <>
        <Navbar />
        <div className="management">
          <h2>Management</h2>
          <p className="management-error">Access denied. This page is for Management/Admin roles.</p>
        </div>
        <Footer />
      </>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done === b.done) return 0;
    return a.done ? 1 : -1;
  });
  const filteredSortedTasks = sortedTasks.filter((task) =>
    taskMemberFilter === "all" ? true : task.assignedTo === taskMemberFilter
  );
  const selectedProject = projects.find((project) => project._id === selectedProjectId) || null;
  const taskAssignees = [...new Set(tasks.map((task) => task.assignedTo).filter(Boolean))];
  const projectAssignableUsers = users.filter(
    (user) =>
      !selectedProject?.members?.some((member) => String(member.userId) === String(user._id))
  );

  return (
    <>
      <Navbar />
      <div className="management">
        <h2>Team Task Management</h2>
        {error && <p className="management-error">{error}</p>}

        {summary && (
          <div className="management-summary-grid">
            <div className="management-summary-card">
              <h4>Total Tasks</h4>
              <p>{summary.total}</p>
            </div>
            <div className="management-summary-card">
              <h4>Completed</h4>
              <p>{summary.completed}</p>
            </div>
            <div className="management-summary-card">
              <h4>Overdue</h4>
              <p>{summary.overdue}</p>
            </div>
            <div className="management-summary-card">
              <h4>Completion Rate</h4>
              <p>{summary.completionRate}%</p>
            </div>
            <button type="button" className="management-export-btn" onClick={exportCsv}>
              Export Tasks CSV
            </button>
          </div>
        )}

        {loggedInUser?.role === "admin" && (
          <div className="admin-user-section">
            <h3>Admin Role Management</h3>
            {!users.length && <p className="management-empty">No users found.</p>}
            <div className="admin-user-list">
              {users.map((user) => (
                <div key={user._id} className="admin-user-row">
                  <div className="admin-user-meta">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div className="admin-user-controls">
                    <select
                      value={roleDrafts[user._id] || user.role}
                      onChange={(e) =>
                        setRoleDrafts((prev) => ({ ...prev, [user._id]: e.target.value }))
                      }
                    >
                      <option value="viewer">Viewer</option>
                      <option value="team_member">Team Member</option>
                      <option value="management">Management</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="button" onClick={() => updateUserRole(user._id)}>
                      Update Role
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loggedInUser?.role === "admin" && (
          <div className="admin-project-section">
            <h3>Project And Team Builder</h3>
            <form className="admin-project-create" onSubmit={createProject}>
              <input
                type="text"
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Project description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
              <button type="submit">Create Project</button>
            </form>

            <div className="admin-project-user-pool">
              {users.map((user) => (
                <div key={user._id} className="admin-project-user-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(projectSelections[user._id]?.selected)}
                      onChange={(e) =>
                        setProjectSelections((prev) => ({
                          ...prev,
                          [user._id]: {
                            selected: e.target.checked,
                            position: prev[user._id]?.position || "team_member",
                          },
                        }))
                      }
                    />
                    <span>{user.name} ({user.email})</span>
                  </label>
                  <select
                    value={projectSelections[user._id]?.position || "team_member"}
                    onChange={(e) =>
                      setProjectSelections((prev) => ({
                        ...prev,
                        [user._id]: {
                          selected: prev[user._id]?.selected || false,
                          position: e.target.value,
                        },
                      }))
                    }
                  >
                    {TEAM_POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="admin-project-manage">
              <div className="admin-project-manage-head">
                <h4>Manage Team After Creation</h4>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="">Select Project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProject && (
                <>
                  <div className="admin-project-add-member">
                    <select
                      value={addProjectMemberUserId}
                      onChange={(e) => setAddProjectMemberUserId(e.target.value)}
                    >
                      <option value="">Select user to add</option>
                      {projectAssignableUsers.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                    <select
                      value={addProjectMemberPosition}
                      onChange={(e) => setAddProjectMemberPosition(e.target.value)}
                    >
                      {TEAM_POSITIONS.map((position) => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={addMemberToProject}>Add To Team</button>
                  </div>

                  <div className="admin-project-member-list">
                    {selectedProject.members?.map((member) => (
                      <div key={member._id} className="admin-project-member-row">
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                        <div className="admin-project-member-controls">
                          <select
                            value={projectMemberDrafts[member._id] || member.position}
                            onChange={(e) =>
                              setProjectMemberDrafts((prev) => ({
                                ...prev,
                                [member._id]: e.target.value,
                              }))
                            }
                          >
                            {TEAM_POSITIONS.map((position) => (
                              <option key={position} value={position}>
                                {position}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => updateProjectMemberPosition(selectedProject._id, member._id)}
                          >
                            Update Position
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => removeProjectMember(selectedProject._id, member._id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="admin-bulk-delete-section">
              <h4>Admin Task Cleanup</h4>
              <div className="admin-bulk-delete-grid">
                <select
                  value={bulkDeleteAssignee}
                  onChange={(e) => setBulkDeleteAssignee(e.target.value)}
                >
                  <option value="">Select person</option>
                  {taskAssignees.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button type="button" className="danger-btn" onClick={removeAllTasksForPerson}>
                  Remove All Tasks Of Person
                </button>
              </div>
              <div className="admin-bulk-delete-grid">
                <select
                  value={bulkDeleteProjectId}
                  onChange={(e) => setBulkDeleteProjectId(e.target.value)}
                >
                  <option value="">Select team/project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>{project.name}</option>
                  ))}
                </select>
                <button type="button" className="danger-btn" onClick={removeAllTasksForTeam}>
                  Remove All Tasks Of Team
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="team-member-management">
          <input
            type="text"
            placeholder="New member name..."
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />
          <button type="button" onClick={addMember}>Add Member</button>

          <ul className="team-list">
            {teamMembers.map((member) => (
              <li key={member._id}>
                {member.name}
                <button className="remove-btn" onClick={() => removeMember(member._id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>

        <form className="add-task-form" onSubmit={addTask}>
          <input
            type="text"
            placeholder="Task title..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Description..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value)}>
            <option value="none">One-time</option>
            <option value="daily">Recurring Daily</option>
            <option value="weekly">Recurring Weekly</option>
            <option value="monthly">Recurring Monthly</option>
          </select>
          <select value={assignedMember} onChange={(e) => setAssignedMember(e.target.value)}>
            {teamMembers.map((member) => (
              <option key={member._id} value={member._id}>{member.name}</option>
            ))}
          </select>
          <button type="submit">Assign Task</button>
        </form>

        <div className="team-sub-lists">
          {teamMembers.map((member) => {
            const memberTasks = tasks.filter((task) => task.assignedTo === member.name);
            const completed = memberTasks.filter((task) => task.done).length;
            const total = memberTasks.length;
            const completionRate = total ? ((completed / total) * 100).toFixed(1) : 0;
            return (
              <div key={member._id} className="member-sub-list">
                <div className="member-sub-list-head">
                  <h4>{member.name}</h4>
                  <span>{completionRate}%</span>
                </div>
                {!memberTasks.length && <p className="member-sub-list-empty">No tasks assigned</p>}
                {memberTasks.map((task) => (
                  <div key={task._id} className={`task-item ${task.done ? "done" : ""}`}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task._id)} />
                    <span className="task-title">{task.title}</span>
                    <span className={`task-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="management-task-board">
          <div className="management-task-toolbar">
            <h3>All Assigned Tasks</h3>
            <select
              value={taskMemberFilter}
              onChange={(e) => setTaskMemberFilter(e.target.value)}
            >
              <option value="all">All Members</option>
              {[...new Set(tasks.map((task) => task.assignedTo || "Unassigned"))].map((memberName) => (
                <option key={memberName} value={memberName}>
                  {memberName}
                </option>
              ))}
            </select>
          </div>
          <div className="management-task-head">
            <span>Task</span>
            <span>Assigned To</span>
            <span>Due Date</span>
            <span>Priority</span>
            <span>Actions</span>
          </div>
          <div className="management-task-list">
            {!filteredSortedTasks.length && <p className="management-empty">No tasks for selected member.</p>}
            {filteredSortedTasks.map((task) => (
              <div key={task._id} className={`management-task-row ${task.done ? "done" : ""}`}>
                <span className="m-task-title">{task.title}</span>
                <span className="m-task-member">{task.assignedTo}</span>
                <span className="m-task-due">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
                </span>
                <span className={`task-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
                <div className="management-actions">
                  <button className="status-toggle-btn" onClick={() => toggleTask(task._id)}>
                    {task.done ? "Completed" : "Mark Done"}
                  </button>
                  <button className="edit-task-btn" onClick={() => openEditModal(task)}>Edit</button>
                  <button className="comment-task-btn" onClick={() => openCommentModal(task._id)}>
                    Comment ({task.comments?.length || 0})
                  </button>
                  <button className="delete-task-btn" onClick={() => deleteTask(task._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="management-activity">
          <h3>Recent Activity</h3>
          {!activity.length && <p className="management-empty">No activity yet.</p>}
          {activity.map((log) => (
            <div key={log._id} className="activity-row">
              <p>
                <strong>{log.actor}</strong> {log.action.replaceAll("_", " ")} ({log.targetType})
              </p>
              <span>{new Date(log.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {modalState.open && (
        <div className="popup-overlay">
          <div className="popup-card">
            {modalState.type === "edit" && (
              <>
                <div className="management-modal-header"><h3>Edit Task</h3></div>
                <div className="management-modal-body">
                  <input
                    type="text"
                    placeholder="Task title"
                    value={modalState.title}
                    onChange={(e) => setModalState((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <input
                    type="date"
                    value={modalState.dueDate}
                    onChange={(e) => setModalState((prev) => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
                <div className="management-modal-footer">
                  <button className="ghost-btn" onClick={closeModal}>Cancel</button>
                  <button onClick={submitEditTask}>Save</button>
                </div>
              </>
            )}
            {modalState.type === "comment" && (
              <>
                <div className="management-modal-header"><h3>Add Comment</h3></div>
                <div className="management-modal-body">
                  <textarea
                    placeholder="Write your comment..."
                    value={modalState.comment}
                    onChange={(e) => setModalState((prev) => ({ ...prev, comment: e.target.value }))}
                  />
                </div>
                <div className="management-modal-footer">
                  <button className="ghost-btn" onClick={closeModal}>Cancel</button>
                  <button onClick={submitTaskComment}>Submit</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
