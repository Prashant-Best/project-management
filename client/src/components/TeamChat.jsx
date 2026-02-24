import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "../assets/styles/teamChat.css";

export default function TeamChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const savedUser = localStorage.getItem("loggedInUser");
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const currentUserName = useMemo(
    () => (loggedInUser?.name || "User").trim() || "User",
    [loggedInUser?.name]
  );

  const fetchMessages = async () => {
    try {
      const response = await API.get("/workspace/messages");
      setMessages(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load chat messages");
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      setError("");
      const response = await API.post("/workspace/messages", {
        user: currentUserName,
        text: input.trim(),
      });
      setMessages(response.data.data || []);
      setInput("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Team Chat</h2>
      </div>

      {error && <p className="chat-error">{error}</p>}

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg._id || `${msg.user}-${msg.createdAt}`}
            className={`chat-message ${msg.user === currentUserName ? "own" : ""}`}
          >
            <span className="chat-user">{msg.user}</span>
            <p>{msg.text}</p>
          </div>
        ))}
      </div>

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
