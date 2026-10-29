from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation

from ..database import fetch_all, fetch_one, get_connection
from ..dependencies import get_current_user, require_manager
from ..schemas import EmployeeCreate, ProfileUpdate
from ..security import hash_password

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("")
def list_employees(q: str = "", skill: str = "", current=Depends(get_current_user)):
    search = f"%{q.strip()}%"
    rows = fetch_all("""
        SELECT e.id, e.name, e.email, e.title, e.role,
               m.name AS manager, m.id AS manager_id,
               COALESCE((
                   SELECT json_agg(json_build_object('name', s.name, 'level', es.level)
                                   ORDER BY LOWER(s.name))
                   FROM employee_skills es JOIN skills s ON s.id = es.skill_id
                   WHERE es.employee_id = e.id
               ), '[]'::json) AS skills
        FROM employees e
        LEFT JOIN employees m ON m.id = e.manager_id
        WHERE e.active = TRUE
          AND (%s = '' OR e.name ILIKE %s OR e.email ILIKE %s OR e.title ILIKE %s)
          AND (%s = '' OR EXISTS (
              SELECT 1 FROM employee_skills es JOIN skills s ON s.id = es.skill_id
              WHERE es.employee_id = e.id AND LOWER(s.name) = LOWER(%s)
          ))
        ORDER BY LOWER(e.name) LIMIT 100
    """, (q.strip(), search, search, search, skill.strip(), skill.strip()))
    return rows


@router.get("/me/overview")
def my_overview(current=Depends(get_current_user)):
    manager = fetch_one("""
        SELECT id, name, title FROM employees
        WHERE id = (SELECT manager_id FROM employees WHERE id = %s)
          AND active = TRUE
    """, (current["id"],))
    projects = fetch_all("""
        SELECT p.id, p.name, p.description, p.status, p.due_date, p.tech_stack
        FROM projects p JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.employee_id = %s
        ORDER BY p.name
    """, (current["id"],))
    return {"manager": manager, "projects": projects}


@router.get("/me/team")
def my_team(current=Depends(get_current_user)):
    manager_id = current["id"] if current.get("role") == "manager" else None
    if not manager_id:
        row = fetch_one(
            "SELECT manager_id FROM employees WHERE id = %s AND active = TRUE",
            (current["id"],),
        )
        manager_id = row["manager_id"] if row else None
    if not manager_id:
        return {"manager": None, "teammates": [], "projects": []}

    manager = fetch_one("""
        SELECT id, name, title, email FROM employees
        WHERE id = %s AND role = 'manager' AND active = TRUE
    """, (manager_id,))
    if not manager:
        return {"manager": None, "teammates": [], "projects": []}

    teammates = fetch_all("""
        SELECT e.id, e.name, e.title,
               COALESCE(json_agg(json_build_object(
                   'id', p.id, 'name', p.name, 'status', p.status
               ) ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS projects
        FROM employees e
        LEFT JOIN project_members pm ON pm.employee_id = e.id AND pm.role = 'member'
        LEFT JOIN projects p ON p.id = pm.project_id AND p.manager_id = %s
        WHERE e.manager_id = %s AND e.active = TRUE
        GROUP BY e.id ORDER BY LOWER(e.name)
    """, (manager_id, manager_id))
    projects = fetch_all("""
        SELECT p.id AS project_id, p.name, p.description, p.status, p.due_date,
               p.tech_stack, e.id AS employee_id, e.name AS employee_name,
               e.title AS employee_title
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.role = 'member'
        LEFT JOIN employees e ON e.id = pm.employee_id
             AND e.active = TRUE AND e.manager_id = %s
        WHERE p.manager_id = %s
        ORDER BY p.name, LOWER(e.name)
    """, (manager_id, manager_id))
    by_project = {}
    for row in projects:
        project = by_project.setdefault(row["project_id"], {
            "project": {
                "id": row["project_id"], "name": row["name"],
                "description": row["description"], "status": row["status"],
                "due_date": row["due_date"], "tech_stack": row["tech_stack"],
            },
            "members": [],
        })
        if row["employee_id"]:
            project["members"].append({
                "id": row["employee_id"],
                "name": row["employee_name"],
                "title": row["employee_title"],
            })
    return {
        "manager": manager,
        "teammates": teammates,
        "projects": list(by_project.values()),
    }


@router.get("/{employee_id}")
def get_employee(employee_id: str, current=Depends(get_current_user)):
    employee = fetch_one("""
        SELECT e.id, e.name, e.email, e.role, e.title, e.active, e.created_at,
               m.id AS manager_id, m.name AS manager_name, m.title AS manager_title
        FROM employees e
        LEFT JOIN employees m ON m.id = e.manager_id
        WHERE e.id = %s AND e.active = TRUE
    """, (employee_id,))
    if not employee:
        raise HTTPException(404, "Employee not found")
    skills = fetch_all("""
        SELECT s.name, es.level
        FROM employee_skills es JOIN skills s ON s.id = es.skill_id
        WHERE es.employee_id = %s ORDER BY LOWER(s.name)
    """, (employee_id,))
    projects = fetch_all("""
        SELECT p.id, p.name, p.description, p.status, p.due_date, p.tech_stack
        FROM projects p JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.employee_id = %s ORDER BY p.name
    """, (employee_id,))
    manager_id = employee.pop("manager_id")
    manager_name = employee.pop("manager_name")
    manager_title = employee.pop("manager_title")
    employee["manager"] = (
        {"id": manager_id, "name": manager_name, "title": manager_title}
        if manager_id else None
    )
    employee["skills"] = skills
    employee["projects"] = projects
    return employee


@router.post("", status_code=201)
def create_employee(data: EmployeeCreate, manager=Depends(require_manager)):
    employee_id = str(uuid4())
    try:
        with get_connection() as connection:
            row = connection.execute("""
                INSERT INTO employees (id, name, email, password_hash, role, title, manager_id)
                VALUES (%s, %s, %s, %s, 'employee', %s, %s)
                RETURNING id, name, email, role
            """, (
                employee_id, data.name.strip(), data.email.lower(),
                hash_password(data.password), data.title, manager["id"],
            )).fetchone()
    except UniqueViolation as exc:
        raise HTTPException(409, "Email already exists") from exc
    return row


@router.patch("/me")
def update_me(data: ProfileUpdate, current=Depends(get_current_user)):
    updates = data.model_dump(exclude_unset=True)
    manager_id = updates.pop("manager_id", ...)
    profile_updates = {key: value for key, value in updates.items() if value is not None}
    if not profile_updates and manager_id is ...:
        return current
    if manager_id is not ... and current.get("role") != "employee":
        raise HTTPException(403, "Only employees can update their manager")
    if manager_id is not ... and manager_id == current["id"]:
        raise HTTPException(422, "You cannot select yourself as your manager")

    with get_connection() as connection:
        if manager_id is not ... and manager_id is not None:
            manager = connection.execute("""
                SELECT id FROM employees
                WHERE id = %s AND role = 'manager' AND active = TRUE
            """, (manager_id,)).fetchone()
            if not manager:
                raise HTTPException(422, "Choose an active manager from the list")
        if profile_updates:
            assignments = ", ".join(f"{key} = %s" for key in profile_updates)
            connection.execute(
                f"UPDATE employees SET {assignments} WHERE id = %s",
                (*profile_updates.values(), current["id"]),
            )
        if manager_id is not ...:
            connection.execute(
                "UPDATE employees SET manager_id = %s WHERE id = %s",
                (manager_id, current["id"]),
            )
        row = connection.execute("""
            SELECT e.id, e.name, e.email, e.role, e.title,
                   m.id AS manager_id, m.name AS manager_name, m.title AS manager_title
            FROM employees e LEFT JOIN employees m ON m.id = e.manager_id
            WHERE e.id = %s
        """, (current["id"],)).fetchone()
    manager_id = row.pop("manager_id")
    manager_name = row.pop("manager_name")
    manager_title = row.pop("manager_title")
    row["manager"] = (
        {"id": manager_id, "name": manager_name, "title": manager_title}
        if manager_id else None
    )
    return row
