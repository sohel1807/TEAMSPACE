from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from psycopg.errors import UniqueViolation
from ..database import fetch_all, fetch_one, get_connection
from ..schemas import LoginRequest, RegisterRequest
from ..security import verify_password, create_access_token, hash_password
from ..dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/managers")
def list_managers():
    return fetch_all("""
        SELECT id, name, title FROM employees
        WHERE role = 'manager' AND active = TRUE
        ORDER BY LOWER(name)
    """)

@router.post("/register", status_code=201)
def register(data: RegisterRequest):
    user_id = str(uuid4())
    name = data.name.strip()
    title = data.title.strip() or data.role.title()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Name must contain at least 2 non-space characters")
    try:
        manager_id = data.manager_id if data.role == "employee" else None
        with get_connection() as connection:
            if manager_id and not connection.execute("""
                SELECT id FROM employees
                WHERE id = %s AND role = 'manager' AND active = TRUE
            """, (manager_id,)).fetchone():
                raise HTTPException(status_code=422, detail="Choose an active manager from the list")
            row = connection.execute("""
                INSERT INTO employees (id, name, email, password_hash, role, title, manager_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, email, role, title, active, created_at
            """, (
                user_id, name, data.email.lower(), hash_password(data.password),
                data.role, title, manager_id,
            )).fetchone()
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="An account with this email already exists") from exc
    return {"access_token": create_access_token(user_id), "token_type": "bearer", "user": row}

@router.post("/login")
def login(data: LoginRequest):
    row = fetch_one("""
        SELECT id, name, email, password_hash, role, title, active, created_at
        FROM employees WHERE email = %s AND active = TRUE
    """, (data.email.lower(),))
    if not row or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user = {key: value for key, value in row.items() if key != "password_hash"}
    return {"access_token": create_access_token(user["id"]), "token_type": "bearer", "user": user}

@router.get("/me")
def me(user=Depends(get_current_user)):
    return user
