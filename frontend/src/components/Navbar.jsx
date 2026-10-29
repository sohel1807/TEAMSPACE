import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function Navbar() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  return <header className="topbar"><NavLink to="/" className="brand"><span className="brand-mark">T</span> TeamSpace</NavLink>
    <nav><NavLink to="/">Dashboard</NavLink><NavLink to="/employees">People</NavLink><NavLink to="/projects">Projects</NavLink><NavLink to="/profile">Profile</NavLink></nav>
    <div className="user-menu"><span className="avatar">{user?.name?.[0] || "U"}</span><span className="user-name">{user?.name}</span><button className="btn btn-light btn-small" onClick={() => { logout(); navigate("/login"); }}>Log out</button></div>
  </header>;
}
