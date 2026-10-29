from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..database import fetch_all, fetch_one, get_connection
from ..dependencies import get_current_user, require_manager

router = APIRouter(tags=["Skills"])


class SkillUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    level: int = Field(ge=1, le=5)


@router.get("/skills")
def search_skills(q: str = "", user=Depends(get_current_user)):
    return fetch_all("""
        SELECT id, name, normalized_name FROM skills
        WHERE %s = '' OR name ILIKE %s
        ORDER BY name LIMIT 100
    """, (q.strip(), f"%{q.strip()}%"))


@router.put("/employees/me/skills")
def set_my_skill(data: SkillUpdate, user=Depends(get_current_user)):
    name = data.name.strip()
    normalized_name = name.lower()
    with get_connection() as connection:
        skill = connection.execute("""
            INSERT INTO skills (id, name, normalized_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (str(uuid4()), name, normalized_name)).fetchone()
        connection.execute("""
            INSERT INTO employee_skills (employee_id, skill_id, level)
            VALUES (%s, %s, %s)
            ON CONFLICT (employee_id, skill_id) DO UPDATE SET level = EXCLUDED.level
        """, (user["id"], skill["id"], data.level))
    return {"name": name, "level": data.level}


@router.get("/employees/me/skills")
def list_my_skills(user=Depends(get_current_user)):
    return fetch_all("""
        SELECT s.name, es.level
        FROM employee_skills es JOIN skills s ON s.id = es.skill_id
        WHERE es.employee_id = %s
        ORDER BY LOWER(s.name)
    """, (user["id"],))


@router.delete("/employees/me/skills/{name}")
def delete_my_skill(name: str, user=Depends(get_current_user)):
    row = fetch_one("""
        DELETE FROM employee_skills es USING skills s
        WHERE es.skill_id = s.id AND es.employee_id = %s
          AND s.normalized_name = %s
        RETURNING es.skill_id
    """, (user["id"], name.strip().lower()))
    if not row:
        raise HTTPException(404, "Skill not found on your profile")
    return {"message": "Skill removed"}


@router.post("/skills", status_code=201)
def create_skill(data: SkillUpdate, user=Depends(require_manager)):
    name = data.name.strip()
    fetch_one("""
        INSERT INTO skills (id, name, normalized_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
    """, (str(uuid4()), name, name.lower()))
    return {"name": name}
