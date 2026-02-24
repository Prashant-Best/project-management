import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api"; // Axios instance
import "../assets/styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("team_member");
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email!");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters!");
      return;
    }

    try {
      const res = await API.post("/users/login", { email, password, role });

      if (res.data.success) {
        setError("");
        if (res.data.token) {
          localStorage.setItem("authToken", res.data.token);
        }
        localStorage.setItem("loggedInUser", JSON.stringify(res.data.data));
        setPopupMessage(res.data.message || "Welcome");
        setShowPopup(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    const saved = localStorage.getItem("loggedInUser");
    const currentUser = saved ? JSON.parse(saved) : null;
    if (currentUser?.role === "management") {
      navigate("/home/management");
      return;
    }
    navigate("/home/tasks");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>DevFlow Login</h1>
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} required>
            <option value="team_member">Team Member</option>
            <option value="management">Management</option>
          </select>

          {error && <p className="login-error">{error}</p>}

          <button type="submit">Login</button>
        </form>

        <p className="login-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>

      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-card">
            <h3>Login Successful</h3>
            <p>{popupMessage}</p>
            <button type="button" onClick={handlePopupClose}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
