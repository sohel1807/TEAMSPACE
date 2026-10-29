from app.database import get_connection, verify_database
from app.security import hash_password

verify_database()

manager_id = "demo-manager-001"
employee_id = "demo-employee-001"
project_id = "demo-project-001"
task_id = "demo-task-001"

with get_connection() as connection:
    connection.execute("""
        INSERT INTO employees (id, name, email, password_hash, role, title)
        VALUES (%s, 'Demo Manager', 'manager@example.com', %s, 'manager', 'Engineering Manager')
        ON CONFLICT (id) DO NOTHING
    """, (manager_id, hash_password("Manager123!")))
    connection.execute("""
        INSERT INTO employees (id, name, email, password_hash, role, title, manager_id)
        VALUES (%s, 'Demo Employee', 'employee@example.com', %s, 'employee',
                'Software Engineer', %s)
        ON CONFLICT (id) DO NOTHING
    """, (employee_id, hash_password("Employee123!"), manager_id))

    skills = {}
    for name in ("Python", "SQL"):
        row = connection.execute("""
            INSERT INTO skills (id, name, normalized_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (f"demo-skill-{name.lower()}", name, name.lower())).fetchone()
        skills[name] = row["id"]

    for name, level in (("Python", 4), ("SQL", 3)):
        connection.execute("""
            INSERT INTO employee_skills (employee_id, skill_id, level)
            VALUES (%s, %s, %s)
            ON CONFLICT (employee_id, skill_id) DO NOTHING
        """, (employee_id, skills[name], level))

    connection.execute("""
        INSERT INTO projects (id, manager_id, name, description, status)
        VALUES (%s, %s, 'Employee Portal Demo', 'Sample project for the MVP', 'IN_PROGRESS')
        ON CONFLICT (id) DO NOTHING
    """, (project_id, manager_id))
    connection.execute("""
        INSERT INTO project_members (project_id, employee_id, role)
        VALUES (%s, %s, 'manager'), (%s, %s, 'member')
        ON CONFLICT DO NOTHING
    """, (project_id, manager_id, project_id, employee_id))
    connection.execute("""
        INSERT INTO tasks (id, project_id, title, description)
        VALUES (%s, %s, 'Explore the project dashboard', 'Review the MVP screens')
        ON CONFLICT (id) DO NOTHING
    """, (task_id, project_id))

print("Seed complete. Manager: manager@example.com / Manager123!; Employee: employee@example.com / Employee123!")
