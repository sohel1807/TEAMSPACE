import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [title, setTitle] = useState(user?.title || "");
  const [managerId, setManagerId] = useState("");
  const [managers, setManagers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [skill, setSkill] = useState("");
  const [level, setLevel] = useState("3");
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSkills() {
    try {
      setSkills((await api.get("/employees/me/skills")).data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load your skills");
    }
  }

  async function loadWorkOverview() {
    try {
      const [overview, managerResponse] = await Promise.all([
        api.get("/employees/me/overview"),
        api.get("/auth/managers")
      ]);
      setManagerId(overview.data.manager?.id || "");
      setProjects(overview.data.projects);
      setManagers(managerResponse.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load your manager and project information");
    }
  }

  useEffect(() => {
    loadSkills();
    loadWorkOverview();
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await api.patch("/employees/me", {
        name,
        title,
        ...(user?.role === "employee" ? { manager_id: managerId || null } : {})
      });
      updateUser(data);
      setManagerId(data.manager?.id || "");
      setMessage("Profile updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Profile update failed");
    }
  }

  async function addSkill(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.put("/employees/me/skills", { name: skill, level: Number(level) });
      setMessage(`Skill ${skill.trim()} saved.`);
      setSkill("");
      await loadSkills();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save skill");
    }
  }

  async function removeSkill(skillName) {
    setError("");
    setMessage("");
    try {
      await api.delete(`/employees/me/skills/${encodeURIComponent(skillName)}`);
      setSkills(current => current.filter(item => item.name !== skillName));
      setMessage(`${skillName} removed from your profile.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not remove skill");
    }
  }

  return <div className="page"><div className="page-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>My profile</h1><p className="muted">Keep your information and skills up to date.</p></div></div>{error && <div className="alert">{error}</div>}{message && <div className="success-message">{message}</div>}
    <div className="profile-layout"><form className="content-card" onSubmit={saveProfile}><h2>Basic information</h2><label>Full name<input value={name} onChange={event => setName(event.target.value)} required minLength="2" maxLength="100" /></label><label>Email address<input value={user?.email || ""} disabled /></label><label>Job title<input value={title} onChange={event => setTitle(event.target.value)} maxLength="100" /></label><label>Workspace role<input value={user?.role || ""} disabled /></label>{user?.role === "employee" && <label>Manager (optional)<select value={managerId} onChange={event => setManagerId(event.target.value)}><option value="">No manager selected</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.name}{manager.title ? ` · ${manager.title}` : ""}</option>)}</select></label>}<button className="btn btn-primary">Save changes</button></form>
      <section className="content-card"><h2>My skills</h2><p className="muted">Add skills and proficiency levels to your profile.</p><form onSubmit={addSkill}><label>Skill name<input value={skill} onChange={event => setSkill(event.target.value)} placeholder="e.g. Python" required maxLength="80" /></label><label>Proficiency level<select value={level} onChange={event => setLevel(event.target.value)}><option value="1">1 — Beginner</option><option value="2">2 — Basic</option><option value="3">3 — Intermediate</option><option value="4">4 — Advanced</option><option value="5">5 — Expert</option></select></label><button className="btn btn-primary">Save skill</button></form><div className="skill-list">{skills.map(item => <div className="skill-row" key={item.name}><span>{item.name}</span><span className="skill-level">{"●".repeat(item.level)}{"○".repeat(5 - item.level)} <small>{item.level}/5</small> <button type="button" className="btn btn-light btn-small" onClick={() => removeSkill(item.name)} aria-label={`Remove ${item.name}`}>Remove</button></span></div>)}{!skills.length && <p className="muted">No skills added yet.</p>}</div></section>
    </div>
    <section className="content-card profile-projects"><h2>My projects</h2><p className="muted">Projects you’ve been assigned to and the technologies they use.</p><div className="project-grid">{projects.map(project => <Link to={`/projects/${project.id}`} className="project-card" key={project.id}><div className="project-card-top"><span className="project-icon">▧</span><span className={`status status-${(project.status || "planned").toLowerCase()}`}>{(project.status || "PLANNED").replace("_", " ")}</span></div><h3>{project.name}</h3><p>{project.description || "No description added yet."}</p><div className="chips">{project.tech_stack?.length ? project.tech_stack.map(stack => <span className="chip" key={stack}>{stack}</span>) : <span className="muted">Tech stack not listed</span>}</div></Link>)}{!projects.length && <div className="empty-state">You haven’t been assigned to a project yet. Ask your manager to add you to a project.</div>}</div></section>
  </div>;
}
