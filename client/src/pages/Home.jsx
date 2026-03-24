import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import TaskManager from "../components/TaskManager";
import TeamChat from "../components/TeamChat";
import Visualization from "../components/Visualization";
import NotificationCenter from "../components/NotificationCenter";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import API from "../services/api";
import "../assets/styles/home.css"; // We'll use a separate CSS file

export default function Home() {
  const [projectInfo, setProjectInfo] = useState({
    teamName: "N/A",
    teamHead: "N/A",
    leaderContact: "N/A",
    members: [],
  });
  const [error, setError] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const savedUser = localStorage.getItem("loggedInUser");
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const user = {
    name: loggedInUser?.name || "User",
    email: loggedInUser?.email || "N/A",
    phone: loggedInUser?.phone || "N/A",
  };
  const isManagement = loggedInUser?.role === "management" || loggedInUser?.role === "admin";

  useEffect(() => {
    const fetchProjectInfo = async () => {
      try {
        const response = await API.get("/projects");
        const projects = response.data.data || [];
        const activeProject = projects[0];

        if (!activeProject) {
          setProjectInfo({
            teamName: "N/A",
            teamHead: "N/A",
            leaderContact: "N/A",
            members: [],
          });
          return;
        }

        const teamHead =
          (activeProject.members || []).find((member) => member.position === "team_head") || null;

        setProjectInfo({
          teamName: activeProject.name || "N/A",
          teamHead: teamHead?.name || "N/A",
          leaderContact: teamHead?.email || "N/A",
          members: activeProject.members || [],
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load profile data");
      }
    };

    fetchProjectInfo();
  }, []);

  useEffect(() => {
    const pollUpdates = async () => {
      try {
        const response = await API.get("/workspace/updates", {
          params: { since: lastSyncedAt || undefined },
        });
        const updates = response.data.data || {};
        setUnreadNotifications(updates.unreadNotifications || 0);
        if (updates.changed) {
          const workspaceResponse = await API.get("/workspace");
          setWorkspace(workspaceResponse.data.data);
        }
        if (updates.updatedAt) {
          setLastSyncedAt(updates.updatedAt);
        }
      } catch (_err) {
        // silent polling errors keep the page usable
      }
    };

    pollUpdates();
    const timer = setInterval(pollUpdates, 8000);
    return () => clearInterval(timer);
  }, [lastSyncedAt]);

  return (
    <div className="home-page">
      <Navbar unreadNotifications={unreadNotifications} />

      {/* Navigation Links */}
      <div className="home-nav-links">
        <NavLink to="/home/tasks" className="home-link">Tasks</NavLink>
        <NavLink to="/home/chat" className="home-link">Team Chat</NavLink>
        <NavLink to="/home/visualization" className="home-link">Visualization</NavLink>
        <NavLink to="/home/notifications" className="home-link">
          Notifications {unreadNotifications > 0 ? `(${unreadNotifications})` : ""}
        </NavLink>
        <NavLink to="/home/profile" className="home-link">Profile</NavLink>
        {isManagement && (
          <NavLink to="/home/management" className="home-link">Management</NavLink>
        )}
      </div>

      {/* Main Content: Two-column layout */}
      <div className="home-main">
        {/* Left: Profile / Team Info Box */}
        <div className="profile-box">
          {error && <p className="home-error">{error}</p>}
          <h3>My Profile</h3>
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Phone:</strong> {user.phone}</p>
          <hr />
          <h4>Team Info</h4>
          <p><strong>Team Name:</strong> {projectInfo.teamName || "N/A"}</p>
          <p><strong>Team Head:</strong> {projectInfo.teamHead || "N/A"}</p>
          <p><strong>Leader Contact:</strong> {projectInfo.leaderContact || "N/A"}</p>
          <h4>Team Members</h4>
          {projectInfo.members?.length ? (
            <ul className="team-members-list">
              {(projectInfo.members || []).map((member) => (
                <li key={member._id}>
                  {member.name} ({member.position || "team_member"})
                </li>
              ))}
            </ul>
          ) : (
            <p>N/A</p>
          )}
        </div>

        {/* Right: Routed Content */}
        <div className="home-content">
          <Routes>
            <Route path="tasks" element={<TaskManager />} />
            <Route path="chat" element={<TeamChat />} />
            <Route path="visualization" element={<Visualization />} />
            <Route path="notifications" element={<NotificationCenter />} />
            <Route path="*" element={<TaskManager />} />
          </Routes>
        </div>
      </div>

      <Footer />
    </div>
  );
}
