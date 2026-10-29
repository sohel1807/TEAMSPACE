import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const emptyTask = { title: "", description: "", due_date: "", assigned_employee_id: "" };
const emptyActivity = { summary: "", details: "", task_id: "", hours: 1 };

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [people, setPeople] = useState([]);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const [editing, setEditing] = useState(false);
  const [projectForm, setProjectForm] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const managerEmployees = useMemo(() => {
    if (!info) return [];
    return people.filter(person =>
      person.role === "employee" &&
      person.manager_id === info.manager_id
    );
  }, [info, people]);
  const projectMemberIds = useMemo(
    () => new Set(info?.members.map(member => member.id) || []),
    [info]
  );
  const projectEmployees = managerEmployees.filter(person => projectMemberIds.has(person.id));
  const availableManagerEmployees = managerEmployees.filter(person => !projectMemberIds.has(person.id));
  const loggableTasks = tasks.filter(({ task, assigned_employee_id }) =>
    info?.can_manage || assigned_employee_id === user?.id
  );

  async function load() {
    try {
      const [projectResponse, taskResponse, peopleResponse, activityResponse] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/tasks`),
        api.get("/employees"),
        api.get(`/projects/${id}/activities`)
      ]);
      const projectInfo = projectResponse.data;
      setInfo(projectInfo);
      setProjectForm({
        name: projectInfo.project.name || "",
        description: projectInfo.project.description || "",
        status: projectInfo.project.status || "PLANNED",
        due_date: projectInfo.project.due_date || "",
        tech_stack: (projectInfo.project.tech_stack || []).join(", ")
      });
      setTasks(taskResponse.data);
      setPeople(peopleResponse.data);
      setActivities(activityResponse.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load project");
    }
  }

  useEffect(() => { load(); }, [id]);

  async function addTask(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post(`/projects/${id}/tasks`, {
        ...taskForm,
        due_date: taskForm.due_date || null,
        assigned_employee_id: taskForm.assigned_employee_id || null
      });
      setTaskForm(emptyTask);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create task");
    }
  }

  async function updateTask(taskId, status) {
    setError("");
    try {
      await api.patch(`/tasks/${taskId}`, { status });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update task");
    }
  }

  async function assignTask(taskId, employeeId) {
    setError("");
    try {
      await api.put(`/tasks/${taskId}/assignee`, { employee_id: employeeId || null });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not assign task");
    }
  }

  async function addMember(employeeId) {
    setError("");
    try {
      await api.post(`/projects/${id}/members/${employeeId}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not add team member");
    }
  }

  async function removeMember(employeeId, employeeName) {
    if (!window.confirm(`Remove ${employeeName} from this project? Their tasks will become unassigned; tasks and work logs will be kept.`)) return;
    setError("");
    try {
      await api.delete(`/projects/${id}/members/${employeeId}`);
      setMessage(`${employeeName} was removed from the project.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not remove team member");
    }
  }

  async function deleteProject() {
    if (!window.confirm(`Permanently delete "${info.project.name}" and all of its tasks and work logs? This cannot be undone.`)) return;
    setError("");
    try {
      await api.delete(`/projects/${id}`);
      navigate("/projects", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete project");
    }
  }

  async function saveProject(event) {
    event.preventDefault();
    setError("");
    try {
      await api.patch(`/projects/${id}`, {
        ...projectForm,
        due_date: projectForm.due_date || null,
        tech_stack: projectForm.tech_stack.split(",").map(item => item.trim()).filter(Boolean)
      });
      setEditing(false);
      setMessage("Project details saved.");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save project details");
    }
  }

  async function addActivity(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post(`/projects/${id}/activities`, {
        ...activityForm,
        hours: Number(activityForm.hours)
      });
      setActivityForm(emptyActivity);
      setMessage("Work log recorded.");
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not record work");
    }
  }

  return <div className="page">
    <Link to="/projects" className="text-link">← Back to projects</Link>
    {error && <div className="alert">{error}</div>}
    {message && <div className="success-message">{message}</div>}
    {info && <>
      <div className="page-heading project-detail-heading">
        <div>
          <span className="eyebrow">PROJECT DETAILS</span>
          <h1>{info.project.name}</h1>
          <p className="muted">{info.project.description || "No project description yet."}</p>
          {!!info.project.tech_stack?.length && <div className="chips">{info.project.tech_stack.map(stack => <span className="chip" key={stack}>{stack}</span>)}</div>}
        </div>
        <div className="project-detail-actions"><span className={`status status-${(info.project.status || "planned").toLowerCase()}`}>{(info.project.status || "PLANNED").replace("_", " ")}</span>{user?.role === "manager" && info.can_manage && <button type="button" className="btn btn-danger" onClick={deleteProject}>Delete project</button>}</div>
      </div>

      {info.can_manage && <section className="content-card project-edit-card">
        <div className="section-heading">
          <div><h2>Project information</h2><p className="muted">Update the project details, technology stack, and timeline.</p></div>
          <button type="button" className="btn btn-light" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit project"}</button>
        </div>
        {editing && <form onSubmit={saveProject}>
          <label>Project name<input required minLength="2" maxLength="120" value={projectForm.name} onChange={event => setProjectForm({ ...projectForm, name: event.target.value })} /></label>
          <label>Description<textarea value={projectForm.description} onChange={event => setProjectForm({ ...projectForm, description: event.target.value })} rows="3" /></label>
          <label>Technology stack<input value={projectForm.tech_stack} onChange={event => setProjectForm({ ...projectForm, tech_stack: event.target.value })} placeholder="e.g. React, FastAPI, Neo4j" /><small className="muted">Separate technologies with commas.</small></label>
          <div className="form-row">
            <label>Status<select value={projectForm.status} onChange={event => setProjectForm({ ...projectForm, status: event.target.value })}><option>PLANNED</option><option>IN_PROGRESS</option><option>COMPLETED</option></select></label>
            <label>Due date<input type="date" value={projectForm.due_date} onChange={event => setProjectForm({ ...projectForm, due_date: event.target.value })} /></label>
          </div>
          <button className="btn btn-primary">Save project</button>
        </form>}
      </section>}

      <div className="detail-layout">
        <section className="content-card">
          <div className="section-heading"><div><h2>Project tasks</h2><p className="muted">Each task has a clear owner and progress status.</p></div></div>
          {info.can_manage && <form className="create-form" onSubmit={addTask}>
            <h3>Create and assign a task</h3>
            <label>Task title<input required minLength="2" maxLength="160" value={taskForm.title} onChange={event => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="What needs to be done?" /></label>
            <label>What does the task involve?<textarea value={taskForm.description} onChange={event => setTaskForm({ ...taskForm, description: event.target.value })} rows="2" /></label>
            <label>Assign to<select value={taskForm.assigned_employee_id} onChange={event => setTaskForm({ ...taskForm, assigned_employee_id: event.target.value })}><option value="">Leave unassigned</option>{projectEmployees.map(person => <option key={person.id} value={person.id}>{person.name} · {person.title}</option>)}</select>{!projectEmployees.length && <small className="muted">Add a direct report to this project team first.</small>}</label>
            <label>Due date<input type="date" value={taskForm.due_date} onChange={event => setTaskForm({ ...taskForm, due_date: event.target.value })} /></label>
            <button className="btn btn-primary">Create task</button>
          </form>}
          <div className="task-list">
            {tasks.map(({ task, assigned_employee_id, assignee }) => <div className="task-row" key={task.id}>
              <span className={`task-dot task-${task.status?.toLowerCase()}`}></span>
              <div className="task-copy"><strong>{task.title}</strong><small>{task.description || "No details"}{task.due_date && ` · Due ${task.due_date}`}{` · Assigned to ${assignee || "nobody"}`}</small></div>
              {info.can_manage && <select aria-label={`Assignee for ${task.title}`} value={assigned_employee_id || ""} onChange={event => assignTask(task.id, event.target.value)}><option value="">Unassigned</option>{projectEmployees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select>}
              {(info.can_manage || assigned_employee_id === user?.id) && <select aria-label={`Status for ${task.title}`} value={task.status} onChange={event => updateTask(task.id, event.target.value)}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select>}
            </div>)}
            {!tasks.length && <p className="muted">No tasks yet. The project owner can create and assign the first task.</p>}
          </div>
        </section>

        <aside className="content-card">
          <h2>Project team</h2>
          <p className="muted">Project owner: {info.manager || "—"}</p>
          {info.members?.map(member => <div className="member-row" key={member.id}><span className="avatar">{member.name?.[0]}</span><span className="member-details">{member.name}{member.email && <small className="muted">{member.email}</small>}</span>{user?.role === "manager" && info.can_manage && member.id !== user.id && projectEmployees.some(person => person.id === member.id) && <button type="button" className="btn btn-light btn-small" onClick={() => removeMember(member.id, member.name)}>Remove</button>}</div>)}
          {info.can_manage && <label className="assign-label">Add one of your direct reports<select value="" onChange={event => { if (event.target.value) addMember(event.target.value); }}><option value="">Choose a teammate…</option>{availableManagerEmployees.map(person => <option key={person.id} value={person.id}>{person.name} · {person.title}</option>)}</select>{!managerEmployees.length && <small className="muted">No employee accounts are assigned to you as their manager yet. Employees can choose you in their Profile.</small>}{managerEmployees.length > 0 && !availableManagerEmployees.length && <small className="muted">All your direct reports are already on this project.</small>}</label>}
        </aside>
      </div>

      <div className="detail-layout activity-layout">
        <section className="content-card">
          <h2>Project work log</h2>
          <p className="muted">A shared record of completed work, linked to tasks and team members.</p>
          <div className="activity-list">{activities.map(({ activity, employee_name, task_title }) => <article className="activity-entry" key={activity.id}>
            <div className="activity-entry-heading"><strong>{activity.summary || activity.description || "Work logged"}</strong><span>{employee_name} · {activity.hours}h</span></div>
            <p>{activity.details || activity.description || "No additional details."}</p>
            <small>{task_title ? `Task: ${task_title} · ` : ""}{activity.work_date}</small>
          </article>)}{!activities.length && <p className="muted">No work has been logged on this project yet.</p>}</div>
        </section>
        <section className="content-card">
          <h2>Log work</h2>
          <p className="muted">Record what you completed against a task assigned to you.</p>
          <form className="activity-form" onSubmit={addActivity}>
            <label>Task<select required value={activityForm.task_id} onChange={event => setActivityForm({ ...activityForm, task_id: event.target.value })}><option value="">Choose one of your tasks…</option>{loggableTasks.map(({ task }) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
            <label>Work summary<input required minLength="3" maxLength="160" value={activityForm.summary} onChange={event => setActivityForm({ ...activityForm, summary: event.target.value })} placeholder="e.g. Built the login form" /></label>
            <label>Details<textarea required minLength="3" maxLength="1000" value={activityForm.details} onChange={event => setActivityForm({ ...activityForm, details: event.target.value })} rows="3" placeholder="What did you complete or what is blocked?" /></label>
            <label>Time spent (hours)<input type="number" min="0.25" max="24" step="0.25" value={activityForm.hours} onChange={event => setActivityForm({ ...activityForm, hours: event.target.value })} /></label>
            <button className="btn btn-primary btn-wide" disabled={!loggableTasks.length}>Record work</button>
            {!loggableTasks.length && <small className="muted">You need a task assigned to you before logging work.</small>}
          </form>
        </section>
      </div>
    </>}
  </div>;
}
