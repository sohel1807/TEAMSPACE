import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeDetails from "./pages/EmployeeDetails";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import Profile from "./pages/Profile";
function Shell({children}) { const {user}=useAuth(); return <>{user&&<Navbar/>}{children}</>; }
function RoutesView(){const {user}=useAuth();return <Routes><Route path="/login" element={user?<Navigate to="/" replace/>:<Login/>}/><Route path="/" element={<ProtectedRoute><Shell><Dashboard/></Shell></ProtectedRoute>}/><Route path="/employees" element={<ProtectedRoute><Shell><Employees/></Shell></ProtectedRoute>}/><Route path="/employees/:id" element={<ProtectedRoute><Shell><EmployeeDetails/></Shell></ProtectedRoute>}/><Route path="/projects" element={<ProtectedRoute><Shell><Projects/></Shell></ProtectedRoute>}/><Route path="/projects/:id" element={<ProtectedRoute><Shell><ProjectDetails/></Shell></ProtectedRoute>}/><Route path="/profile" element={<ProtectedRoute><Shell><Profile/></Shell></ProtectedRoute>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
export default function App(){return <BrowserRouter><AuthProvider><RoutesView/></AuthProvider></BrowserRouter>}
