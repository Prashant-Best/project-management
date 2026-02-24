import { useNavigate } from "react-router-dom";
import "../assets/styles/navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <div className="nav-logo" onClick={() => navigate("/home")}>DevFlow</div>
        <button className="home-btn" onClick={() => navigate("/home")}>Home</button>
      </div>

      <div className="nav-right">
        <button className="profile-btn" onClick={() => navigate("/home/profile")}>
          Profile
        </button>
        <button className="contacts-btn" onClick={() => navigate("/home/contacts")}>
          Contacts
        </button>
        <button className="logout-btn nav-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
