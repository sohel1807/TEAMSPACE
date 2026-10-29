from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    title: str = Field(default="Employee", min_length=2, max_length=100)
    role: Literal["employee", "manager"]
    manager_id: Optional[str] = None

class EmployeeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    title: str = "Employee"

class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    title: Optional[str] = Field(default=None, max_length=100)
    manager_id: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""
    status: str = "PLANNED"
    due_date: Optional[str] = None
    tech_stack: list[str] = Field(default_factory=list, max_length=30)

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(PLANNED|IN_PROGRESS|COMPLETED)$")
    due_date: Optional[str] = None
    tech_stack: Optional[list[str]] = Field(default=None, max_length=30)

class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str = ""
    due_date: Optional[str] = None
    assigned_employee_id: Optional[str] = None

class TaskUpdate(BaseModel):
    status: str = Field(pattern="^(TODO|IN_PROGRESS|DONE)$")

class TaskAssignment(BaseModel):
    employee_id: Optional[str] = None
