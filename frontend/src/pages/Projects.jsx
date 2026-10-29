import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const emptyForm = { name: "", description: "", status: "PLANNED", due_date: "", tech_stack: "" };

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState("");

  async function load() {
    try {
      setProjects((await api.get("/projects")).data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load projects");
    }
  }

  useEffect(() => { load(); }, []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/projects", {
        ...form,
        due_date: form.due_date || null,
        tech_stack: form.tech_stack.split(",").map(item => item.trim()).filter(Boolean)
      });
      setForm(emptyForm);
      setShow(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject(projectId, projectName) {
    if (!window.confirm(`Permanently delete "${projectName}" and all of its tasks and work logs? This cannot be undone.`)) return;
    setDeletingId(projectId);
    setError("");
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects(current => current.filter(item => item.project.id !== projectId));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete project");
    } finally {
      setDeletingId("");
    }
  }

  return <div className="page"><div className="page-heading"><div><span className="eyebrow">WORKSPACE</span><h1>Projects</h1><p className="muted">Keep initiatives, people, and progress connected.</p></div><button className="btn btn-primary" onClick={() => setShow(!show)}>{show ? "Cancel" : "+ New project"}</button></div>
    {error && <div className="alert">{error}</div>}
    {show && <form className="content-card create-form" onSubmit={create}><h2>Create a project</h2><label>Project name<input required minLength="2" maxLength="120" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows="3" /></label><label>Technology stack<input value={form.tech_stack} onChange={event => setForm({ ...form, tech_stack: event.target.value })} placeholder="e.g. React, FastAPI, Neo4j" /><small className="muted">Separate technologies with commas.</small></label><div className="form-row"><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>PLANNED</option><option>IN_PROGRESS</option><option>COMPLETED</option></select></label><label>Due date<input type="date" value={form.due_date} onChange={event => setForm({ ...form, due_date: event.target.value })} /></label></div><button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button></form>}
    <div className="project-grid">{projects.map(({ project, manager, manager_id, can_manage, members }) => <article className="project-card" key={project.id}><Link to={`/projects/${project.id}`} className="project-card-link"><div className="project-card-top"><span className="project-icon">▧</span><span className={`status status-${(project.status || "planned").toLowerCase()}`}>{(project.status || "PLANNED").replace("_", " ")}</span></div><h3>{project.name}</h3><p>{project.description || "No description added yet."}</p>{project.tech_stack?.length > 0 && <div className="chips">{project.tech_stack.map(stack => <span className="chip" key={stack}>{stack}</span>)}</div>}<div className="project-meta"><span>♙ {members?.length || 0} members</span><span>Lead: {manager || "—"}</span></div>{project.due_date && <small className="muted">Due {project.due_date}</small>}</Link>{user?.role === "manager" && can_manage && manager_id === user.id && <button type="button" className="btn btn-danger btn-small project-delete-button" disabled={deletingId === project.id} onClick={() => deleteProject(project.id, project.name)}>{deletingId === project.id ? "Deleting…" : "Delete project"}</button>}</article>)}{!projects.length && <div className="empty-state">No projects yet. Create one to get started.</div>}</div>
  </div>;
}
