import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("access_token")) {
      api.get("/auth/me").then(r => setUser(r.data)).catch(() => localStorage.removeItem("access_token")).finally(() => setReady(true));
    } else setReady(true);
  }, []);
  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token); setUser(data.user); return data.user;
  }
  async function register(account) {
    const { data } = await api.post("/auth/register", account);
    localStorage.setItem("access_token", data.access_token); setUser(data.user); return data.user;
  }
  function updateUser(updates) { setUser(current => current ? { ...current, ...updates } : current); }
  function logout() { localStorage.removeItem("access_token"); setUser(null); }
  return <AuthContext.Provider value={{ user, ready, login, register, updateUser, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
