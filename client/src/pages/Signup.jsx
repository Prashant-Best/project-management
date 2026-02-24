import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import "../assets/styles/signup.css";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("team_member");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (name.trim().length < 2) {
      setSuccess("");
      setError("Name must be at least 2 characters");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setSuccess("");
      setError("Please enter a valid email");
      return;
    }

    if (password.length < 6) {
      setSuccess("");
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      const response = await API.post("/users/signup", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      if (response.data.success) {
        setError("");
        setSuccess("Account created successfully. Redirecting to login...");
        setTimeout(() => navigate("/login"), 1200);
      }
    } catch (err) {
      setSuccess("");
      setError(
        err.response?.data?.message ||
          "Signup failed: backend or database is unreachable. Start server and check MongoDB Atlas IP access."
      );
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h1>Create DevFlow Account</h1>
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

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
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} required>
            <option value="team_member">Team Member</option>
            <option value="management">Management</option>
          </select>

          {error && <p className="signup-error">{error}</p>}
          {success && <p className="signup-success">{success}</p>}

          <button type="submit">Sign Up</button>
        </form>

        <p className="signup-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
