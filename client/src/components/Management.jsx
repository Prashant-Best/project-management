import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer"; // <-- Import Footer
import API from "../services/api";
import "../assets/styles/management.css";

export default function Management() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [newTask, setNewTask] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [assignedMember, setAssignedMember] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");

  const syncWorkspace = (workspace) => {
    const members = workspace.members || [];
    const taskList = workspace.tasks || [];

    setTeamMembers(members);
    setTasks(taskList);
    setAssignedMember((currentValue) => {
      if (currentValue && members.some((member) => member._id === currentValue)) {
        return currentValue;
      }
      return members[0]?._id || "";
    });
  };

  const fetchWorkspace = async () => {
    try {
      const [workspaceResponse, activityResponse] = await Promise.all([
        API.get("/workspace"),
        API.get("/workspace/activity", { params: { limit: 10, page: 1 } }),
      ]);
      syncWorkspace(workspaceResponse.data.data);
      setActivity(activityResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load management data");
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask) return;

    try {
      setError("");
      const selectedMember = teamMembers.find((member) => member._id === assignedMember);
      const response = await API.post("/workspace/tasks", {
        title: newTask.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        assignedTo: selectedMember?.name || "Unassigned",
        dueDate: newDueDate || null,
      });
      syncWorkspace(response.data.data);
      fetchWorkspace();
      setNewTask("");
      setNewDescription("");
      setNewDueDate("");
      setNewPriority("Medium");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign task");
    }
  };

  const toggleTask = async (id) => {
    try {
      const response = await API.patch(`/workspace/tasks/${id}/toggle`);
      syncWorkspace(response.data.data);
      fetchWorkspace();
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
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member");
    }
  };

  const deleteTask = async (id) => {
    try {
      const response = await API.delete(`/workspace/tasks/${id}`);
      syncWorkspace(response.data.data);
      fetchWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete task");
    }
  };

  const editTask = async (task) => {
    const title = prompt("Update task title", task.title);
    if (title === null) return;

    const dueDate = prompt(
      "Update due date (YYYY-MM-DD, leave blank to clear)",
      task.dueDate ? String(task.dueDate).slice(0, 10) : ""
    );
    if (dueDate === null) return;

    try {
      const response = await API.patch(`/workspace/tasks/${task._id}`, {
        title: title.trim() || task.title,
        dueDate: dueDate.trim() || null,
      });
      syncWorkspace(response.data.data);
      fetchWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to edit task");
    }
  };

  const addComment = async (taskId) => {
    const text = prompt("Add task comment");
    if (!text || !text.trim()) return;

    const actor = JSON.parse(localStorage.getItem("loggedInUser") || "{}");
    try {
      const response = await API.post(`/workspace/tasks/${taskId}/comments`, {
        text: text.trim(),
        user: actor.name || "User",
      });
      syncWorkspace(response.data.data);
      fetchWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment");
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done === b.done) return 0;
    return a.done ? 1 : -1;
  });

  return (
    <>
      <Navbar />

      <div className="management">
        <h2>Team Task Management</h2>
        {error && <p className="management-error">{error}</p>}

        {/* Add / Remove Team Members */}
        <div className="team-member-management">
          <input
            type="text"
            placeholder="New member name..."
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />
          <button onClick={addMember}>Add Member</button>

          <ul className="team-list">
            {teamMembers.map(member => (
              <li key={member._id}>
                {member.name}
                <button className="remove-btn" onClick={() => removeMember(member._id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Add Task Form */}
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
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
          />
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={assignedMember} onChange={(e) => setAssignedMember(e.target.value)}>
            {teamMembers.map(member => (
              <option key={member._id} value={member._id}>{member.name}</option>
            ))}
          </select>
          <button type="submit">Assign Task</button>
        </form>

        {/* Team Member Dropdowns */}
        <div className="team-dropdowns">
          {teamMembers.map(member => {
            const memberTasks = tasks.filter(t => t.assignedTo === member.name);
            const completed = memberTasks.filter(t => t.done).length;
            const total = memberTasks.length;
            const completionRate = total ? ((completed / total) * 100).toFixed(1) : 0;

            return (
              <div key={member._id} className="member-dropdown">
                <button className="dropdown-btn">{member.name} ({completionRate}%)</button>
                <div className="dropdown-content">
                  {memberTasks.length === 0 ? <p>No tasks assigned</p> :
                    memberTasks.map(task => (
                      <div key={task._id} className={`task-item ${task.done ? "done" : ""}`}>
                        <input type="checkbox" checked={task.done} onChange={() => toggleTask(task._id)} />
                        <span className="task-title">{task.title}</span>
                        <span className={`task-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>

        <div className="management-task-board">
          <h3>All Assigned Tasks</h3>
          <div className="management-task-head">
            <span>Task</span>
            <span>Assigned To</span>
            <span>Due Date</span>
            <span>Priority</span>
            <span>Actions</span>
          </div>

          <div className="management-task-list">
            {sortedTasks.length === 0 && <p className="management-empty">No tasks yet.</p>}
            {sortedTasks.map((task) => (
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
                  <button className="edit-task-btn" onClick={() => editTask(task)}>Edit</button>
                  <button className="comment-task-btn" onClick={() => addComment(task._id)}>
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

      {/* Footer added here */}
      <Footer />
    </>
  );
}
