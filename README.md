# Employee & Project Management MVP

React + Vite frontend, FastAPI backend, Supabase PostgreSQL database. This is a demo scaffold; review and harden it before production use.

## Requirements
- Python 3.11+
- Node.js 20+
- A Supabase project

## 1. Configure and start backend
Create a Supabase project and copy its PostgreSQL connection URI from **Project Settings → Database**. Use the session pooler URI if your network cannot connect to the direct database host. URL-encode special characters in the database password and keep it private.

```bash
cd backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# If activation is blocked, use Command Prompt: venv\Scripts\activate.bat
pip install -r requirements.txt
# Only if backend/.env does not already exist:
copy .env.example .env
```

Set `SUPABASE_DB_URL` in `backend/.env` to your connection URI (replace the old database setting if migrating an existing local setup). The backend creates its tables the first time it connects. To add optional demo accounts and sample project data, run:
```bash
python seed.py
```

Start the backend:
```bash
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

You can also register an employee or manager account from the sign-in page. New users can create projects, edit projects they created, add project tasks, and maintain their own profile skills. The `seed.py` command is optional demo data and creates sample accounts and a sample project.

Employees can optionally choose an active manager when registering or later from their profile. Project owners can add a comma-separated technology stack to projects; assigned employees see their manager, projects, and project stacks on their profiles. Existing or seeded projects without a stack show no technologies until the owner adds them.

Managers can add only their own direct reports to their projects and assign those teammates to tasks. An employee can view the manager's projects and team even before they are individually assigned, but only assigned project members can update tasks or log work. Employees can update the status of tasks assigned to them and record a work summary, details, and hours against those tasks. Project team members can review the shared project work log. The dashboard shows the manager's projects and which direct reports are working on each one.

Managers can remove a direct report from a project or add that employee to another project they manage. Removing a member unassigns their tasks but preserves tasks and work logs. Deleting a project permanently deletes the project, its tasks, and its work logs.

**Demo security note:** this scaffold permits public manager registration, as well as employee registration. Manager accounts have elevated permissions. Do not expose this demo to the public internet or use it with real organization data without replacing open manager signup with an invite/admin-controlled flow and hardening authentication.

Demo logins (available only if you ran `python seed.py`; change these before sharing the app):
- Manager: `manager@example.com` / `Manager123!`
- Employee: `employee@example.com` / `Employee123!`

## 2. Start frontend
In another terminal:
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```
Open http://localhost:5173

## Deploy the frontend to Vercel
Vercel can host this Vite frontend, but it does not host the FastAPI backend. Before deploying, host the backend on a service that supports Python/ASGI and set its `SUPABASE_DB_URL` to your Supabase connection URI.

1. Push this project to a Git provider and import it into Vercel.
2. Set the Vercel project **Root Directory** to `frontend`. Use the default Vite settings: build command `npm run build` and output directory `dist`.
3. In the Vercel project's **Environment Variables**, add `VITE_API_URL` with the public backend base URL, for example `https://your-api.example.com`. Use the backend origin only (no `/api` suffix); do not set this to `localhost`.
4. In the deployed backend's environment, set `CORS_ORIGINS` to the exact Vercel site origin, such as `https://your-project.vercel.app`. Add any custom domain as another comma-separated origin. Keep `http://localhost:5173` as well if you still use local development.
5. Deploy or redeploy the frontend after setting its environment variable. The `frontend/vercel.json` rewrite sends application routes back to `index.html`, so refreshing routes such as `/projects` works.

Keep the Supabase database password and backend secrets only in the backend host's environment settings. Never add real `.env` files to Git. The root `.gitignore` excludes local environment files, virtual environments, and frontend build/dependency folders.

## Notes
- Data is persisted in Supabase PostgreSQL. This setup starts with empty tables; it does not import existing Neo4j data.
- JWT tokens are stored in localStorage for demo convenience. For production, consider secure HttpOnly cookies, refresh/revocation strategy, rate limiting, stronger secret management, audit logging, and comprehensive authorization tests.
- This MVP implements login, dashboard, employee search/list, project list/create, and profile. Additional modules in the requested structure are lightweight starting points and can be expanded through `/docs`.
