from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from ..database import fetch_all, fetch_one, get_connection
from ..dependencies import get_current_user
from ..schemas import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projects"])

PROJECT_SELECT = """
    SELECT p.*, m.name AS manager, m.id AS manager_id,
           (m.id = %s) AS can_manage,
           COALESCE((
               SELECT json_agg(json_build_object(
                   'id', e.id, 'name', e.name, 'email', e.email
               ) ORDER BY LOWER(e.name))
               FROM project_members pm JOIN employees e ON e.id = pm.employee_id
               WHERE pm.project_id = p.id AND e.active = TRUE
           ), '[]'::json) AS members
    FROM projects p JOIN employees m ON m.id = p.manager_id
    WHERE (m.id = %s
       OR EXISTS (SELECT 1 FROM project_members pm
                  WHERE pm.project_id = p.id AND pm.employee_id = %s)
       OR EXISTS (SELECT 1 FROM employees e
                  WHERE e.id = %s AND e.manager_id = m.id))
"""


@router.get("")
def list_projects(user=Depends(get_current_user)):
    rows = fetch_all(
        PROJECT_SELECT + " ORDER BY LOWER(p.name)",
        (user["id"], user["id"], user["id"], user["id"]),
    )
    return [{
        "project": {
            key: row[key] for key in (
                "id", "name", "description", "status",
                "due_date", "tech_stack", "created_at",
            )
        },
        "manager": row["manager"],
        "manager_id": row["manager_id"],
        "can_manage": row["can_manage"],
        "members": row["members"],
    } for row in rows]


@router.post("", status_code=201)
def create_project(data: ProjectCreate, user=Depends(get_current_user)):
    project_id = str(uuid4())
    tech_stack = list(dict.fromkeys(item.strip() for item in data.tech_stack if item.strip()))
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO projects (id, manager_id, name, description, status, due_date, tech_stack)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            project_id, user["id"], data.name.strip(), data.description,
            data.status, data.due_date, tech_stack,
        ))
        connection.execute("""
            INSERT INTO project_members (project_id, employee_id, role)
            VALUES (%s, %s, 'manager')
        """, (project_id, user["id"]))
    return {"id": project_id, "name": data.name, "status": data.status, "tech_stack": tech_stack}


@router.patch("/{project_id}")
def update_project(project_id: str, data: ProjectUpdate, user=Depends(get_current_user)):
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(422, "Provide at least one project field to update")
    if "tech_stack" in updates and updates["tech_stack"] is not None:
        updates["tech_stack"] = list(dict.fromkeys(
            item.strip() for item in updates["tech_stack"] if item.strip()
        ))
    assignments = ", ".join(f"{key} = %s" for key in updates)
    row = fetch_one(
        f"UPDATE projects SET {assignments} WHERE id = %s AND manager_id = %s RETURNING *",
        (*updates.values(), project_id, user["id"]),
    )
    if not row:
        raise HTTPException(404, "Project not found or you do not own it")
    return {
        key: row[key] for key in (
            "id", "name", "description", "status", "due_date",
            "tech_stack", "created_at",
        )
    }


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, user=Depends(get_current_user)):
    row = fetch_one(
        "DELETE FROM projects WHERE id = %s AND manager_id = %s RETURNING id",
        (project_id, user["id"]),
    )
    if not row:
        raise HTTPException(404, "Project not found or you do not own it")


@router.get("/{project_id}")
def get_project(project_id: str, user=Depends(get_current_user)):
    row = fetch_one(
        PROJECT_SELECT + " AND p.id = %s",
        (user["id"], user["id"], user["id"], user["id"], project_id),
    )
    if not row:
        raise HTTPException(404, "Project not found or access denied")
    project = {
        key: row[key] for key in (
            "id", "name", "description", "status",
            "due_date", "tech_stack", "created_at",
        )
    }
    return {
        "project": project,
        "manager": row["manager"],
        "manager_id": row["manager_id"],
        "can_manage": row["can_manage"],
        "members": row["members"],
    }


@router.post("/{project_id}/members/{employee_id}")
def add_member(project_id: str, employee_id: str, user=Depends(get_current_user)):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT e.name FROM projects p
            JOIN employees owner ON owner.id = p.manager_id
            JOIN employees e ON e.manager_id = owner.id
            WHERE p.id = %s AND owner.id = %s AND owner.role = 'manager'
              AND owner.active = TRUE AND e.id = %s AND e.active = TRUE
        """, (project_id, user["id"], employee_id)).fetchone()
        if row:
            connection.execute("""
                INSERT INTO project_members (project_id, employee_id, role)
                VALUES (%s, %s, 'member') ON CONFLICT DO NOTHING
            """, (project_id, employee_id))
    if not row:
        raise HTTPException(404, "Only the manager who owns this project can add one of their direct reports")
    return {"message": f"Assigned {row['name']} to project"}


@router.delete("/{project_id}/members/{employee_id}", status_code=204)
def remove_member(project_id: str, employee_id: str, user=Depends(get_current_user)):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT e.id FROM projects p
            JOIN employees owner ON owner.id = p.manager_id
            JOIN project_members pm ON pm.project_id = p.id AND pm.employee_id = %s
            JOIN employees e ON e.id = pm.employee_id
            WHERE p.id = %s AND owner.id = %s AND owner.role = 'manager'
              AND owner.active = TRUE AND e.role = 'employee'
              AND e.active = TRUE AND e.manager_id = owner.id
        """, (employee_id, project_id, user["id"])).fetchone()
        if row:
            connection.execute("""
                UPDATE tasks SET assigned_employee_id = NULL
                WHERE project_id = %s AND assigned_employee_id = %s
            """, (project_id, employee_id))
            connection.execute("""
                DELETE FROM project_members
                WHERE project_id = %s AND employee_id = %s
            """, (project_id, employee_id))
    if not row:
        raise HTTPException(404, "Project member not found or you do not manage this project")
