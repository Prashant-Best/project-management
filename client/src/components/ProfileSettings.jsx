import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import API from "../services/api";
import "../assets/styles/profile.css";

export default function ProfileSettings() {
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "team_member" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchProfile = async () => {
    try {
      const response = await API.get("/users/me");
      const data = response.data.data;
      setProfile({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        role: data.role || "team_member",
      });
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profile");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      const response = await API.patch("/users/me", {
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
      });

      localStorage.setItem("loggedInUser", JSON.stringify(response.data.data));
      setMessage("Profile updated successfully");
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
      setMessage("");
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    try {
      await API.patch("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed successfully");
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password");
      setMessage("");
    }
  };

  return (
    <div className="profile-page">
      <Navbar />
      <div className="profile-layout">
        <div className="profile-card">
          <h2>Profile Settings</h2>
          {error && <p className="profile-error">{error}</p>}
          {message && <p className="profile-success">{message}</p>}

          <form onSubmit={updateProfile} className="profile-form">
            <label>Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />

            <label>Email</label>
            <input type="email" value={profile.email} disabled />

            <label>Phone</label>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />

            <label>Role</label>
            <select
              value={profile.role}
              onChange={(e) => setProfile({ ...profile, role: e.target.value })}
              disabled={profile.role !== "management"}
            >
              <option value="team_member">Team Member</option>
              <option value="management">Management</option>
            </select>

            <button type="submit">Save Profile</button>
          </form>
        </div>

        <div className="profile-card">
          <h2>Change Password</h2>
          <form onSubmit={updatePassword} className="profile-form">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />

            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <button type="submit">Change Password</button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
