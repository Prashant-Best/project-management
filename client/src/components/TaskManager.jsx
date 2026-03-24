import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "../assets/styles/taskManager.css";

const DEFAULT_META = { page: 1, totalPages: 1, total: 0, limit: 10 };

export default function TaskManager() {
  const savedUser = localStorage.getItem("loggedInUser");
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const currentUserName = useMemo(() => loggedInUser?.name?.trim() || "", [loggedInUser?.name]);
  const currentRole = loggedInUser?.role || "team_member";
  const canEdit = currentRole !== "viewer";
  const isPrivileged = currentRole === "management" || currentRole === "admin";

  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [savedViews, setSavedViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [viewName, setViewName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [assignedTo, setAssignedTo] = useState(isPrivileged ? "" : currentUserName);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [recurringFrequency, setRecurringFrequency] = useState("none");
  const [subtaskDraft, setSubtaskDraft] = useState({});
  const [error, setError] = useState("");

  const fetchSavedViews = async () => {
    try {
      const response = await API.get("/workspace/views");
      setSavedViews(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load saved views");
    }
  };

  const fetchTasks = async () => {
    try {
      const params = { page, limit: 10, sortBy };
      if (assignedTo.trim()) params.assignedTo = assignedTo.trim();
      if (search.trim()) params.q = search.trim();
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterPriority !== "all") params.priority = filterPriority;
      if (dueFrom) params.dueFrom = dueFrom;
      if (dueTo) params.dueTo = dueTo;
      if (recurringOnly) params.recurringOnly = "true";

      const response = await API.get("/workspace/tasks", { params });
      setTasks(response.data.data || []);
      setMeta(response.data.meta || DEFAULT_META);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tasks");
    }
  };

  useEffect(() => {
    fetchSavedViews();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [page, filterStatus, filterPriority, sortBy, recurringOnly]);

  useEffect(() => {
    const timer = setInterval(fetchTasks, 9000);
    return () => clearInterval(timer);
  }, [page, filterStatus, filterPriority, sortBy, recurringOnly, assignedTo, dueFrom, dueTo, search]);

  const runSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTasks();
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim() || !canEdit) return;
    try {
      await API.post("/workspace/tasks", {
        title: newTask.trim(),
        priority: newPriority,
        assignedTo: assignedTo || currentUserName || "Unassigned",
        recurringFrequency,
      });
      setNewTask("");
      setNewPriority("Medium");
      setRecurringFrequency("none");
      setPage(1);
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add task");
    }
  };

  const toggleTask = async (taskId) => {
    if (!canEdit) return;
    try {
      await API.patch(`/workspace/tasks/${taskId}/toggle`);
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle task");
    }
  };

  const addSubtask = async (taskId) => {
    const draft = (subtaskDraft[taskId] || "").trim();
    if (!draft || !canEdit) return;
    try {
      await API.post(`/workspace/tasks/${taskId}/subtasks`, { text: draft });
      setSubtaskDraft((prev) => ({ ...prev, [taskId]: "" }));
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add subtask");
    }
  };

  const toggleSubtask = async (taskId, subtaskId) => {
    if (!canEdit) return;
    try {
      await API.patch(`/workspace/tasks/${taskId}/subtasks/${subtaskId}/toggle`);
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle subtask");
    }
  };

  const saveCurrentView = async () => {
    if (!viewName.trim()) return;
    try {
      const payload = {
        name: viewName.trim(),
        filters: {
          filterStatus,
          filterPriority,
          search,
          assignedTo,
          dueFrom,
          dueTo,
          sortBy,
          recurringOnly,
        },
      };
      const response = await API.post("/workspace/views", payload);
      setSavedViews(response.data.data || []);
      setViewName("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save view");
    }
  };

  const applyView = (viewId) => {
    setSelectedViewId(viewId);
    const selected = savedViews.find((view) => view._id === viewId);
    if (!selected) return;
    const filters = selected.filters || {};
    setFilterStatus(filters.filterStatus || "all");
    setFilterPriority(filters.filterPriority || "all");
    setSearch(filters.search || "");
    setAssignedTo(filters.assignedTo || (isPrivileged ? "" : currentUserName));
    setDueFrom(filters.dueFrom || "");
    setDueTo(filters.dueTo || "");
    setSortBy(filters.sortBy || "created_desc");
    setRecurringOnly(Boolean(filters.recurringOnly));
    setPage(1);
  };

  const deleteView = async () => {
    if (!selectedViewId) return;
    try {
      const response = await API.delete(`/workspace/views/${selectedViewId}`);
      setSavedViews(response.data.data || []);
      setSelectedViewId("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete view");
    }
  };

  return (
    <div className="task-manager">
      <h2>My Tasks</h2>
      {error && <p className="task-error">{error}</p>}

      {!canEdit && (
        <p className="task-empty">Viewer mode: you have read-only access.</p>
      )}

      <form className="add-task-form" onSubmit={addTask}>
        <input
          type="text"
          placeholder="Add new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          required
          disabled={!canEdit}
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} disabled={!canEdit}>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          value={recurringFrequency}
          onChange={(e) => setRecurringFrequency(e.target.value)}
          disabled={!canEdit}
        >
          <option value="none">One-time</option>
          <option value="daily">Recurring Daily</option>
          <option value="weekly">Recurring Weekly</option>
          <option value="monthly">Recurring Monthly</option>
        </select>
        <button type="submit" disabled={!canEdit}>Add Task</button>
      </form>

      <form className="task-search-form" onSubmit={runSearch}>
        <input
          type="text"
          placeholder="Search title, assignee, description or subtask..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="task-filters task-advanced-grid">
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="done">Done</option>
          <option value="undone">Undone</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}>
          <option value="all">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        {isPrivileged ? (
          <input
            type="text"
            placeholder="Filter by assignee"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />
        ) : (
          <input type="text" value={currentUserName} disabled />
        )}
        <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
        <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="created_desc">Newest First</option>
          <option value="due_asc">Due Date Asc</option>
          <option value="due_desc">Due Date Desc</option>
          <option value="priority_desc">Priority High-Low</option>
          <option value="priority_asc">Priority Low-High</option>
        </select>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={recurringOnly}
            onChange={(e) => setRecurringOnly(e.target.checked)}
          />
          Recurring Only
        </label>
      </div>

      <div className="task-saved-views">
        <input
          type="text"
          placeholder="Saved view name"
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
        />
        <button type="button" onClick={saveCurrentView}>Save View</button>
        <select value={selectedViewId} onChange={(e) => applyView(e.target.value)}>
          <option value="">Select Saved View</option>
          {savedViews.map((view) => (
            <option key={view._id} value={view._id}>{view.name}</option>
          ))}
        </select>
        <button type="button" onClick={deleteView} disabled={!selectedViewId}>
          Delete View
        </button>
      </div>

      <ul className="task-list">
        {tasks.map((task) => {
          const doneSubtasks = (task.subtasks || []).filter((subtask) => subtask.done).length;
          const totalSubtasks = (task.subtasks || []).length;
          return (
            <li key={task._id} className={`task-item ${task.done ? "done" : ""}`}>
              <div className="task-left task-item-main">
                <label className="task-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task._id)}
                    disabled={!canEdit}
                  />
                  <span className="task-title">{task.title}</span>
                </label>
                <small className="task-subtask-progress">
                  Subtasks: {doneSubtasks}/{totalSubtasks}
                </small>
                {(task.subtasks || []).length > 0 && (
                  <div className="subtask-list">
                    {task.subtasks.map((subtask) => (
                      <label key={subtask._id} className={`subtask-row ${subtask.done ? "done" : ""}`}>
                        <input
                          type="checkbox"
                          checked={subtask.done}
                          onChange={() => toggleSubtask(task._id, subtask._id)}
                          disabled={!canEdit}
                        />
                        <span>{subtask.text}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="subtask-add">
                  <input
                    type="text"
                    placeholder="Add checklist item..."
                    value={subtaskDraft[task._id] || ""}
                    onChange={(e) =>
                      setSubtaskDraft((prev) => ({ ...prev, [task._id]: e.target.value }))
                    }
                    disabled={!canEdit}
                  />
                  <button type="button" onClick={() => addSubtask(task._id)} disabled={!canEdit}>
                    Add
                  </button>
                </div>
              </div>
              <div className="task-right">
                <span className={`task-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
                {task.dueDate && (
                  <small className="task-due">Due: {new Date(task.dueDate).toLocaleDateString()}</small>
                )}
                {task.recurring?.parentTaskId && <small className="task-recurring-chip">Recurring</small>}
              </div>
            </li>
          );
        })}
      </ul>

      {!tasks.length && <p className="task-empty">No tasks found.</p>}

      <div className="task-pagination">
        <button disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <span>Page {meta.page} / {meta.totalPages} ({meta.total} tasks)</span>
        <button
          disabled={meta.page >= meta.totalPages}
          onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
