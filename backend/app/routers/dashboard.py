from fastapi import APIRouter, Depends

from ..database import fetch_all, fetch_one
from ..dependencies import get_current_user

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard")
def dashboard(user=Depends(get_current_user)):
    employees = fetch_one(
        "SELECT COUNT(*) AS n FROM employees WHERE active = TRUE"
    )["n"]
    if user["role"] == "manager":
        projects = fetch_one(
            "SELECT COUNT(*) AS n FROM projects WHERE manager_id = %s",
            (user["id"],),
        )["n"]
        tasks = fetch_all("""
            SELECT t.status, COUNT(*) AS n
            FROM tasks t JOIN projects p ON p.id = t.project_id
            WHERE p.manager_id = %s GROUP BY t.status
        """, (user["id"],))
    else:
        projects = fetch_one("""
            SELECT COUNT(*) AS n FROM project_members
            WHERE employee_id = %s
        """, (user["id"],))["n"]
        tasks = fetch_all("""
            SELECT t.status, COUNT(*) AS n
            FROM tasks t JOIN project_members pm ON pm.project_id = t.project_id
            WHERE pm.employee_id = %s GROUP BY t.status
        """, (user["id"],))
    return {
        "role": user["role"],
        "employee_count": employees,
        "project_count": projects,
        "tasks": {row["status"]: row["n"] for row in tasks},
    }
