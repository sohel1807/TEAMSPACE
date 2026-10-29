import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";

export default function EmployeeDetails() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/employees/${id}`)
      .then(response => setProfile(response.data))
      .catch(err => setError(err.response?.data?.detail || "Could not load profile"));
  }, [id]);

  return <div className="page"><Link to="/employees" className="text-link">← Back to people</Link>{error && <div className="alert">{error}</div>}{profile && <>
    <div className="profile-hero"><span className="avatar avatar-xl">{profile.name?.[0]}</span><div><span className="eyebrow">TEAM MEMBER</span><h1>{profile.name}</h1><p className="muted">{profile.title} · {profile.email}</p></div></div>
    <div className="detail-layout"><section className="content-card"><h2>Skills & expertise</h2><div className="skill-list">{profile.skills?.map(skill => <div className="skill-row" key={skill.name}><span>{skill.name}</span><span className="skill-level">{"●".repeat(skill.level)}{"○".repeat(5 - skill.level)} <small>{skill.level}/5</small></span></div>)}</div>{!profile.skills?.length && <p className="muted">No skills added yet.</p>}<h2>Projects</h2>{profile.projects?.map(project => <Link to={`/projects/${project.id}`} className="member-row" key={project.id}><span className="project-icon">▧</span><span>{project.name}<small className="muted">{project.tech_stack?.length ? project.tech_stack.join(" · ") : "Tech stack not listed"}</small></span></Link>)}{!profile.projects?.length && <p className="muted">No project assignments yet.</p>}</section>
      <aside className="content-card"><h2>Manager</h2>{profile.manager ? <div className="member-row"><span className="avatar">{profile.manager.name?.[0]}</span><span>{profile.manager.name}<small className="muted">{profile.manager.title || "Manager"}</small></span></div> : <p className="muted">No manager assigned.</p>}<h2>Project technology stack</h2>{profile.projects?.length ? profile.projects.map(project => <div className="skill-row" key={project.id}><span>{project.name}</span><span className="chips">{project.tech_stack?.length ? project.tech_stack.map(stack => <span className="chip" key={stack}>{stack}</span>) : <small className="muted">Not listed</small>}</span></div>) : <p className="muted">Project stacks appear here when this employee is assigned to projects.</p>}</aside>
    </div>
  </>}</div>;
}
