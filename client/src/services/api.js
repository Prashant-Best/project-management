import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:3000/api" // backend URL
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
