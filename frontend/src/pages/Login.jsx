import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", title: "Employee", role: "employee", manager_id: "" });
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isRegistering || form.role !== "employee") return;
    api.get("/auth/managers")
      .then(response => setManagers(response.data))
      .catch(err => setError(err.response?.data?.detail || "Could not load the manager list."));
  }, [isRegistering, form.role]);

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegistering) {
        await register({ ...form, manager_id: form.role === "employee" ? (form.manager_id || null) : null });
      } else {
        await login(form.email, form.password);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || (isRegistering
        ? "Unable to create your account. Check the details and try again."
        : "Unable to log in. Check the backend and credentials."));
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    setIsRegistering(current => !current);
    setError("");
  }

  return <main className="login-page"><section className="login-art"><div className="brand brand-white"><span className="brand-mark">T</span> TeamSpace</div><div><span className="eyebrow">YOUR TEAM, IN SYNC</span><h1>Great work happens when teams work together.</h1><p>One place to discover talent, organize projects, and move work forward.</p></div><div className="art-footer">PEOPLE · PROJECTS · PROGRESS</div></section>
    <section className="login-panel"><form className="login-form" onSubmit={submit}><div className="mobile-brand brand"><span className="brand-mark">T</span> TeamSpace</div><span className="eyebrow">{isRegistering ? "JOIN YOUR WORKSPACE" : "WELCOME BACK"}</span><h2>{isRegistering ? "Create your account" : "Sign in to your workspace"}</h2><p className="muted">{isRegistering ? "Create an account to manage your profile, skills, and projects." : "Enter your account details to continue."}</p>
      {error && <div className="alert">{error}</div>}
      {isRegistering && <>
        <label>Full name<input value={form.name} onChange={event => update("name", event.target.value)} required minLength="2" maxLength="100" autoComplete="name" /></label>
        <label>Job title<input value={form.title} onChange={event => update("title", event.target.value)} required minLength="2" maxLength="100" /></label>
        <label>Account type<select value={form.role} onChange={event => { update("role", event.target.value); update("title", event.target.value === "manager" ? "Manager" : "Employee"); }}><option value="employee">Employee</option><option value="manager">Manager</option></select></label>
        {form.role === "employee" && <label>Manager (optional)<select value={form.manager_id} onChange={event => update("manager_id", event.target.value)}><option value="">Choose later</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.title ? ` · ${manager.title}` : ""}</option>)}</select></label>}
        {form.role === "manager" && <div className="alert">Manager accounts can manage projects and employees. Anyone can select this role in this demo app.</div>}
      </>}
      <label>Email address<input type="email" value={form.email} onChange={event => update("email", event.target.value)} required autoComplete="email" /></label>
      <label>Password<input type="password" value={form.password} onChange={event => update("password", event.target.value)} required minLength={isRegistering ? 8 : undefined} autoComplete={isRegistering ? "new-password" : "current-password"} /></label>
      <button className="btn btn-primary btn-wide" disabled={busy}>{busy ? (isRegistering ? "Creating account…" : "Signing in…") : (isRegistering ? "Create account →" : "Sign in →")}</button>
      <p className="muted">{isRegistering ? "Already have an account?" : "New to TeamSpace?"} <button type="button" className="btn btn-light btn-small" onClick={toggleMode}>{isRegistering ? "Sign in" : "Create an account"}</button></p>
    </form><span className="login-foot">TEAMSPACE · EMPLOYEE & PROJECT MANAGEMENT</span></section></main>;
}
