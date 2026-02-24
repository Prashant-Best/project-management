import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import TaskManager from "../components/TaskManager";
import TeamChat from "../components/TeamChat";
import Visualization from "../components/Visualization";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import API from "../services/api";
import "../assets/styles/home.css"; // We'll use a separate CSS file

export default function Home() {
  const [workspace, setWorkspace] = useState({
    teamName: "DevFlow Team",
    teamHead: "Rahul Sharma",
    leaderContact: "rahulsharma@devflow.com",
    members: [],
  });
  const [error, setError] = useState("");

  const savedUser = localStorage.getItem("loggedInUser");
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const user = {
    name: loggedInUser?.name || "User",
    email: loggedInUser?.email || "N/A",
    phone: loggedInUser?.phone || "N/A",
  };
  const isManagement = loggedInUser?.role === "management";

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await API.get("/workspace");
        setWorkspace(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load profile data");
      }
    };

    fetchWorkspace();
  }, []);

  return (
    <div className="home-page">
      <Navbar />

      {/* Navigation Links */}
      <div className="home-nav-links">
        <NavLink to="/home/tasks" className="home-link">Tasks</NavLink>
        <NavLink to="/home/chat" className="home-link">Team Chat</NavLink>
        <NavLink to="/home/visualization" className="home-link">Visualization</NavLink>
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
          <p><strong>Team Name:</strong> {workspace.teamName}</p>
          <p><strong>Team Head:</strong> {workspace.teamHead}</p>
          <p><strong>Leader Contact:</strong> {workspace.leaderContact}</p>
          <h4>Team Members</h4>
          <ul className="team-members-list">
            {(workspace.members || []).map((member) => (
              <li key={member._id}>{member.name}</li>
            ))}
          </ul>
        </div>

        {/* Right: Routed Content */}
        <div className="home-content">
          <Routes>
            <Route path="tasks" element={<TaskManager />} />
            <Route path="chat" element={<TeamChat />} />
            <Route path="visualization" element={<Visualization />} />
            <Route path="*" element={<TaskManager />} />
          </Routes>
        </div>
      </div>

      <Footer />
    </div>
  );
}
