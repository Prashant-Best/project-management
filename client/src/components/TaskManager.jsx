import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "../assets/styles/taskManager.css";

export default function TaskManager() {
  const savedUser = localStorage.getItem("loggedInUser");
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const currentUserName = useMemo(() => loggedInUser?.name?.trim() || "", [loggedInUser?.name]);

  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [error, setError] = useState("");

  const fetchTasks = async () => {
    try {
      const params = {
        assignedTo: currentUserName,
        page,
        limit: 10,
      };

      if (search.trim()) params.q = search.trim();
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterPriority !== "all") params.priority = filterPriority[0].toUpperCase() + filterPriority.slice(1);

      const response = await API.get("/workspace/tasks", { params });
      setTasks(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0, limit: 10 });
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load tasks");
    }
  };

  useEffect(() => {
    if (!currentUserName) return;
    fetchTasks();
  }, [currentUserName, filterStatus, filterPriority, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTasks();
  };

  const toggleTask = async (id) => {
    try {
      await API.patch(`/workspace/tasks/${id}/toggle`);
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update task");
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      await API.post("/workspace/tasks", {
        title: newTask.trim(),
        priority: newPriority,
        assignedTo: currentUserName || "Unassigned",
      });
      setNewTask("");
      setNewPriority("Medium");
      setPage(1);
      fetchTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add task");
    }
  };

  return (
    <div className="task-manager">
      <h2>My Tasks</h2>
      {error && <p className="task-error">{error}</p>}

      <form className="add-task-form" onSubmit={addTask}>
        <input
          type="text"
          placeholder="Add new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          required
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <button type="submit">Add Task</button>
      </form>

      <form className="task-search-form" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search title, assignee or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="task-filters">
        <button className={filterStatus === "all" ? "active" : ""} onClick={() => { setFilterStatus("all"); setPage(1); }}>All</button>
        <button className={filterStatus === "done" ? "active" : ""} onClick={() => { setFilterStatus("done"); setPage(1); }}>Done</button>
        <button className={filterStatus === "undone" ? "active" : ""} onClick={() => { setFilterStatus("undone"); setPage(1); }}>Undone</button>

        <button className={filterPriority === "all" ? "active" : ""} onClick={() => { setFilterPriority("all"); setPage(1); }}>All Priorities</button>
        <button className={filterPriority === "urgent" ? "active" : ""} onClick={() => { setFilterPriority("urgent"); setPage(1); }}>Urgent</button>
        <button className={filterPriority === "high" ? "active" : ""} onClick={() => { setFilterPriority("high"); setPage(1); }}>High</button>
        <button className={filterPriority === "medium" ? "active" : ""} onClick={() => { setFilterPriority("medium"); setPage(1); }}>Medium</button>
        <button className={filterPriority === "low" ? "active" : ""} onClick={() => { setFilterPriority("low"); setPage(1); }}>Low</button>
      </div>

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task._id} className={`task-item ${task.done ? "done" : ""}`}>
            <label className="task-left">
              <input type="checkbox" checked={task.done} onChange={() => toggleTask(task._id)} />
              <span className="task-title">{task.title}</span>
            </label>
            <span className={`task-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
          </li>
        ))}
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
