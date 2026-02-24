import Navbar from "./Navbar";
import Footer from "./Footer";
import "../assets/styles/contacts.css";

export default function Contacts() {
  const myContact = {
    name: "Prashant Panwar",
    phone: "6398890593",
    email: "prashantpanwar003003@gmail.com",
    role: "Project Owner"
  };

  return (
    <div className="contacts-page">
      <Navbar />

      <div className="contacts">
        <div className="contact-card personal">
          <h2>My Contact Info</h2>
          <h3>{myContact.name}</h3>
          <p><strong>Phone:</strong> {myContact.phone}</p>
          <p><strong>Email:</strong> {myContact.email}</p>
          <p><strong>Role:</strong> {myContact.role}</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
