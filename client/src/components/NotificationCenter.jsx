import { useEffect, useState } from "react";
import API from "../services/api";
import "../assets/styles/notifications.css";

export default function NotificationCenter() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const response = await API.get("/workspace/notifications", {
        params: { page: 1, limit: 50 },
      });
      setItems(response.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 10000);
    return () => clearInterval(timer);
  }, []);

  const markRead = async (notificationId) => {
    try {
      await API.patch(`/workspace/notifications/${notificationId}/read`);
      setItems((prev) =>
        prev.map((item) => (item._id === notificationId ? { ...item, read: true } : item))
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark notification");
    }
  };

  const markAllRead = async () => {
    try {
      await API.patch("/workspace/notifications/read-all");
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark all notifications");
    }
  };

  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <div className="notifications-center">
      <div className="notifications-head">
        <h2>Notifications</h2>
        <button type="button" onClick={markAllRead} disabled={!unreadCount}>
          Mark All Read
        </button>
      </div>
      <p className="notifications-subtitle">{unreadCount} unread</p>
      {error && <p className="notifications-error">{error}</p>}
      {loading && <p className="notifications-empty">Loading...</p>}
      {!loading && !items.length && <p className="notifications-empty">No notifications yet.</p>}

      <div className="notifications-list">
        {items.map((item) => (
          <div key={item._id} className={`notification-item ${item.read ? "read" : "unread"}`}>
            <div>
              <h4>{item.title}</h4>
              <p>{item.message}</p>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            {!item.read && (
              <button type="button" onClick={() => markRead(item._id)}>
                Mark Read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
