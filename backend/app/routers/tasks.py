from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..database import fetch_all, fetch_one, get_connection
from ..dependencies import get_current_user
from ..schemas import TaskAssignment, TaskCreate, TaskUpdate

router = APIRouter(tags=["Tasks"])


def can_access_project(project_id, user):
    row = fetch_one("""
        SELECT EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = %s AND (
                p.manager_id = %s
                OR EXISTS (SELECT 1 FROM project_members pm
                           WHERE pm.project_id = p.id AND pm.employee_id = %s)
                OR EXISTS (SELECT 1 FROM employees e
                           WHERE e.id = %s AND e.manager_id = p.manager_id)
            )
        ) AS allowed
    """, (project_id, user["id"], user["id"], user["id"]))
    return row["allowed"]


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: str, data: TaskCreate, user=Depends(get_current_user)):
    task_id = str(uuid4())
    with get_connection() as connection:
        if not connection.execute("""
            SELECT 1 FROM projects WHERE id = %s AND manager_id = %s
        """, (project_id, user["id"])).fetchone():
            raise HTTPException(404, "Only the project owner can create and assign tasks")
        if data.assigned_employee_id:
            eligible = connection.execute("""
                SELECT 1 FROM employees e
                JOIN projects p ON p.manager_id = e.manager_id
                JOIN project_members pm ON pm.project_id = p.id AND pm.employee_id = e.id
                WHERE p.id = %s AND p.manager_id = %s AND e.id = %s
                  AND e.active = TRUE
            """, (project_id, user["id"], data.assigned_employee_id)).fetchone()
            if not eligible:
                raise HTTPException(422, "Assign tasks only to an active direct report who is on this project")
        row = connection.execute("""
            INSERT INTO tasks (id, project_id, title, description, due_date, assigned_employee_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, title, status, assigned_employee_id
        """, (
            task_id, project_id, data.title, data.description,
            data.due_date, data.assigned_employee_id,
        )).fetchone()
        if row["assigned_employee_id"]:
            assignee = connection.execute(
                "SELECT name FROM employees WHERE id = %s",
                (row["assigned_employee_id"],),
            ).fetchone()
        else:
            assignee = None
    return {
        "id": row["id"], "title": row["title"], "status": row["status"],
        "assigned_employee_id": row["assigned_employee_id"],
        "assignee": assignee["name"] if assignee else None,
    }


@router.get("/projects/{project_id}/tasks")
def list_tasks(project_id: str, user=Depends(get_current_user)):
    if not can_access_project(project_id, user):
        raise HTTPException(404, "Project not found or access denied")
    return fetch_all("""
        SELECT json_build_object(
                   'id', t.id, 'project_id', t.project_id, 'title', t.title,
                   'description', t.description, 'status', t.status,
                   'due_date', t.due_date, 'created_at', t.created_at
               ) AS task,
               e.id AS assigned_employee_id, e.name AS assignee
        FROM tasks t LEFT JOIN employees e ON e.id = t.assigned_employee_id
        WHERE t.project_id = %s
        ORDER BY t.created_at DESC
    """, (project_id,))


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, data: TaskUpdate, user=Depends(get_current_user)):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT t.project_id, t.assigned_employee_id, p.manager_id
            FROM tasks t JOIN projects p ON p.id = t.project_id
            WHERE t.id = %s
        """, (task_id,)).fetchone()
        if not row or not (
            row["manager_id"] == user["id"]
            or row["assigned_employee_id"] == user["id"]
        ):
            raise HTTPException(404, "Task not found or access denied")
        connection.execute(
            "UPDATE tasks SET status = %s WHERE id = %s",
            (data.status, task_id),
        )
    return {"id": task_id, "status": data.status}


@router.put("/tasks/{task_id}/assignee")
def assign_task(task_id: str, data: TaskAssignment, user=Depends(get_current_user)):
    with get_connection() as connection:
        if data.employee_id:
            row = connection.execute("""
                SELECT e.id, e.name FROM tasks t
                JOIN projects p ON p.id = t.project_id
                JOIN employees e ON e.id = %s AND e.manager_id = p.manager_id
                     AND e.active = TRUE
                JOIN project_members pm ON pm.project_id = p.id
                     AND pm.employee_id = e.id
                WHERE t.id = %s AND p.manager_id = %s
            """, (data.employee_id, task_id, user["id"])).fetchone()
            if not row:
                raise HTTPException(422, "Assign tasks only to an active direct report who is on this project")
            connection.execute(
                "UPDATE tasks SET assigned_employee_id = %s WHERE id = %s",
                (data.employee_id, task_id),
            )
            return {"task_id": task_id, "employee_id": row["id"], "assignee": row["name"]}

        row = connection.execute("""
            UPDATE tasks t SET assigned_employee_id = NULL
            FROM projects p
            WHERE t.project_id = p.id AND p.manager_id = %s AND t.id = %s
            RETURNING t.id
        """, (user["id"], task_id)).fetchone()
        if not row:
            raise HTTPException(404, "Task not found or you do not own its project")
    return {"task_id": task_id, "employee_id": None, "assignee": None}


class ActivityCreate(BaseModel):
    summary: str = Field(min_length=3, max_length=160)
    details: str = Field(min_length=3, max_length=1000)
    task_id: str
    hours: float = Field(gt=0, le=24)


@router.post("/projects/{project_id}/activities", status_code=201)
def add_activity(project_id: str, data: ActivityCreate, user=Depends(get_current_user)):
    activity_id = str(uuid4())
    with get_connection() as connection:
        task = connection.execute("""
            SELECT t.id FROM tasks t
            JOIN projects p ON p.id = t.project_id
            JOIN project_members pm ON pm.project_id = p.id AND pm.employee_id = %s
            WHERE t.id = %s AND p.id = %s
              AND (p.manager_id = %s OR t.assigned_employee_id = %s)
        """, (user["id"], data.task_id, project_id, user["id"], user["id"])).fetchone()
        if not task:
            raise HTTPException(
                422,
                "Log activity only against a task on your project that you own or are assigned to",
            )
        connection.execute("""
            INSERT INTO activities
                (id, project_id, task_id, employee_id, summary, details, hours)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            activity_id, project_id, data.task_id, user["id"],
            data.summary.strip(), data.details.strip(), data.hours,
        ))
    return {"id": activity_id, "message": "Work log recorded"}


@router.get("/projects/{project_id}/activities")
def list_activities(project_id: str, user=Depends(get_current_user)):
    if not can_access_project(project_id, user):
        raise HTTPException(404, "Project not found or access denied")
    return fetch_all("""
        SELECT json_build_object(
                   'id', a.id, 'summary', a.summary, 'description', NULL,
                   'details', a.details, 'hours', a.hours,
                   'work_date', a.work_date::text, 'created_at', a.created_at
               ) AS activity,
               e.id AS employee_id, e.name AS employee_name,
               t.id AS task_id, t.title AS task_title
        FROM activities a
        JOIN employees e ON e.id = a.employee_id
        LEFT JOIN tasks t ON t.id = a.task_id
        WHERE a.project_id = %s
        ORDER BY a.created_at DESC LIMIT 100
    """, (project_id,))
