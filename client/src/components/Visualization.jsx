import { useEffect, useState } from "react";
import API from "../services/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, ResponsiveContainer
} from "recharts";
import "../assets/styles/visualization.css";

export default function Visualization() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const savedUser = localStorage.getItem("loggedInUser");
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const currentUserName = loggedInUser?.name?.trim() || "";

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await API.get("/workspace");
        setTasks(response.data.data.tasks || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load visualization data");
      }
    };

    fetchWorkspace();
  }, []);

  const userTasks = tasks.filter((task) => task.assignedTo === currentUserName);

  const total = userTasks.length;
  const completed = userTasks.filter(t => t.done).length;
  const pending = total - completed;
  const completionRate = total ? ((completed / total) * 100).toFixed(1) : 0;

  // Count tasks by priority
  const priorityData = [
    { name: "Urgent", value: userTasks.filter(t => t.priority === "Urgent").length },
    { name: "High", value: userTasks.filter(t => t.priority === "High").length },
    { name: "Medium", value: userTasks.filter(t => t.priority === "Medium").length },
    { name: "Low", value: userTasks.filter(t => t.priority === "Low").length },
  ];

  const statusData = [
    { name: "Completed", value: completed },
    { name: "Remaining", value: pending },
  ];

  const COLORS = ["#e74a3b", "#f6c23e", "#1cc88a", "#36b9cc"];

  return (
    <div className="visualization">
      <h2>My Performance Dashboard</h2>
      {error && <p className="visualization-error">{error}</p>}

      <div className="dashboard-container">
        {/* Left Side: Stats + Priority */}
        <div className="dashboard-left">
          {/* Stats Cards */}
          <div className="stats-container">
            <div className="stat-card total"><h3>Total Tasks</h3><p>{total}</p></div>
            <div className="stat-card completed"><h3>Completed</h3><p>{completed}</p></div>
            <div className="stat-card pending"><h3>Pending</h3><p>{pending}</p></div>
            <div className="stat-card rate"><h3>Completion Rate</h3><p>{completionRate}%</p></div>
          </div>

          {/* Priority Bars */}
          <div className="priority-section">
            <h3>Priority Distribution</h3>
            <div className="priority-bar urgent">Urgent: {priorityData[0].value}</div>
            <div className="priority-bar high">High: {priorityData[1].value}</div>
            <div className="priority-bar medium">Medium: {priorityData[2].value}</div>
            <div className="priority-bar low">Low: {priorityData[3].value}</div>
          </div>
        </div>

        {/* Right Side: Charts */}
        <div className="dashboard-right">
          {/* Bar Chart: Priority */}
          <div className="chart-card">
            <h3>Tasks by Priority</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value">
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart: Completion per Member */}
          <div className="chart-card">
            <h3>My Completion Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  label
                >
                  <Cell fill="#1cc88a" />
                  <Cell fill="#e74a3b" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
