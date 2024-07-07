const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "../user_tasks.db");

let db;

const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBandServer();

//Middleware for authentication

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/signup", async (request, response) => {
  const { username, password_hash } = request.body;
  try {
    const hashedPassword = await bcrypt.hash(request.body.password_hash, 10);
    const selectUserQuery = `SELECT * FROM Users WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      const createUserQuery = `
        INSERT INTO 
        Users (username, password_hash) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send(`Created new user with userId ${newUserId}`);
    } else {
      response.status = 400;
      response.send("User already exists");
    }
  } catch (error) {
    console.error("Error signing up:", error);
    response.status(500).send("Internal Server Error");
  }
});

app.post("/login", async (request, response) => {
  const { username, password_hash } = request.body;
  const selectUserQuery = `SELECT * FROM Users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password_hash,
      dbUser.password_hash
    );
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.post("/tasks", authenticateToken, async (request, response) => {
  try {
    const { title, description, status, assignee_id } = request.body;
    const createdAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const addTaskQuery = `
      INSERT INTO Tasks (title, description, status, assignee_id, created_at, updated_at) 
      VALUES ('${title}', '${description}', '${status}', ${assignee_id}, '${createdAt}', '${updatedAt}')
    `;

    const dbResponse = await db.run(addTaskQuery);
    const taskId = dbResponse.lastID;
    response.status(201).send(`Task created successfully. TaskId = ${taskId}`);
  } catch (error) {
    console.error("Error creating task:", error);
    response.status(500).send("Error: Failed to create task");
  }
});

app.get("/tasks", authenticateToken, async (request, response) => {
  try {
    const getTasksQuery = `SELECT * FROM Tasks;`;
    const tasks = await db.all(getTasksQuery);
    if (tasks.length === 0) {
      response.send("Yet No Tasks were Created");
    } else {
      response.send(tasks);
    }
  } catch (error) {
    console.error("Error fetching tasking:", error);
    response.status(500).send("Failed to fetch tasks");
  }
});

app.get("/tasks/:id", authenticateToken, async (request, response) => {
  try {
    const { id } = request.params;
    const getTasksQuery = `SELECT * FROM Tasks WHERE id = ${id};`;
    const task = await db.get(getTasksQuery);
    if (!task) {
      response.status(404).send("Task Not Found");
    }
    response.send(task);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    response.status(500).send("Failed to fetch tasks");
  }
});

app.put("/tasks/:id", authenticateToken, async (request, response) => {
  try {
    const { id } = request.params;
    const { title, description, status, assignee_id } = request.body;
    const updatedAt = new Date().toISOString();

    const updateTaskQuery = `
      UPDATE Tasks 
      SET title = '${title}', description = '${description}', status = '${status}', assignee_id = ${assignee_id}, updated_at = '${updatedAt}' 
      WHERE id = ${id};
    `;

    await db.run(updateTaskQuery);

    response.send("Task updated successfully");
  } catch (error) {
    console.error("Error updating task:", error);
    response.status(500).send("Failed to update task");
  }
});

app.delete("/tasks/:id", authenticateToken, async (request, response) => {
  try {
    const { id } = request.params;
    const deleteTaskQuery = `DELETE FROM Tasks WHERE id = ${id};`;
    await db.run(deleteTaskQuery);
    response.send("Task deleted successfully");
  } catch (error) {
    console.error("Error deleting task:", error);
    response.status(500).send("Failed to delete task");
  }
});