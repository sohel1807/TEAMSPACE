from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from .database import fetch_one
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    row = fetch_one(
        """SELECT id, name, email, role, title, active, created_at
        FROM employees WHERE id = %s AND active = TRUE""",
        (payload["sub"],),
    )
    if not row:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return row

def require_manager(user=Depends(get_current_user)):
    if user.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return user
