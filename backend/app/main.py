import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import verify_database
from .routers import auth, employees, skills, projects, tasks, dashboard

@asynccontextmanager
async def lifespan(app: FastAPI):
    verify_database()
    yield

app = FastAPI(title="Employee & Project Management API", version="0.1.0", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
for router in [auth.router, employees.router, skills.router, projects.router, tasks.router, dashboard.router]:
    app.include_router(router)

@app.get("/")
def root():
    return {"message": "Employee & Project Management API", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}
