import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Contacts from "./components/Contacts";
import Management from "./components/Management";
import ProfileSettings from "./components/ProfileSettings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home/*" element={<Home />} /> {/* catch-all for nested pages */}
        <Route path="/home/contacts" element={<Contacts />} />
        <Route path="/home/management" element={<Management />} />
        <Route path="/home/profile" element={<ProfileSettings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
