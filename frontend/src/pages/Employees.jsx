import { useEffect, useState } from "react";
import api from "../api/client";
import { Link } from "react-router-dom";
export default function Employees(){
 const [people,setPeople]=useState([]),[q,setQ]=useState(""),[skill,setSkill]=useState(""),[error,setError]=useState("");
 async function load(){try{const r=await api.get("/employees",{params:{q,skill}});setPeople(r.data);setError("")}catch(e){setError(e.response?.data?.detail||"Could not load employees")}}
 useEffect(()=>{load()},[]);
 return <div className="page"><div className="page-heading"><div><span className="eyebrow">DIRECTORY</span><h1>People</h1><p className="muted">Find teammates by name, role, or skill.</p></div></div>
 <div className="filter-bar"><input placeholder="Search by name, email, role…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/><input placeholder="Filter by exact skill (e.g. Python)" value={skill} onChange={e=>setSkill(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/><button className="btn btn-primary" onClick={load}>Search</button></div>
 {error&&<div className="alert">{error}</div>}<div className="table-wrap"><table><thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>SKILLS</th><th>MANAGER</th><th></th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td><div className="person-cell"><span className="avatar avatar-large">{p.name?.[0]}</span><span><strong>{p.name}</strong><small>{p.email}</small></span></div></td><td>{p.title||p.role}</td><td><div className="chips">{p.skills?.length?p.skills.map(s=><span className="chip" key={s.name}>{s.name} · {s.level}/5</span>):<span className="muted">No skills listed</span>}</div></td><td>{p.manager||"—"}</td><td><Link className="text-link" to={`/employees/${p.id}`}>View →</Link></td></tr>)}</tbody></table>{!people.length&&!error&&<div className="empty-state">No matching team members found.</div>}</div></div>
}
