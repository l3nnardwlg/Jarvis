const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TASKS_FILE = path.join(__dirname, "..", "data", "tasks.json");

const defaultData = { tasks: [] };

function ensureFile() {
  fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readTasks() {
  ensureFile();
  try {
    const content = fs.readFileSync(TASKS_FILE, "utf8");
    const parsed = JSON.parse(content);
    return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  } catch {
    return { ...defaultData };
  }
}

function writeTasks(data) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
}

function createTask(title, description = "", steps = []) {
  const data = readTasks();
  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    steps: steps.map((text) => ({ text, done: false })),
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.tasks.unshift(task);
  data.tasks = data.tasks.slice(0, 100);
  writeTasks(data);
  return task;
}

function listTasks(status) {
  const data = readTasks();
  if (status) return data.tasks.filter((t) => t.status === status);
  return data.tasks;
}

function getTask(id) {
  return readTasks().tasks.find((t) => t.id === id) || null;
}

function updateTask(id, patch) {
  const data = readTasks();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;

  if (patch.title !== undefined) task.title = patch.title;
  if (patch.description !== undefined) task.description = patch.description;
  if (patch.status !== undefined) task.status = patch.status;
  task.updatedAt = new Date().toISOString();

  writeTasks(data);
  return task;
}

function deleteTask(id) {
  const data = readTasks();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  writeTasks(data);
  return data.tasks.length < before;
}

function addStep(taskId, text) {
  const data = readTasks();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  task.steps.push({ text, done: false });
  task.updatedAt = new Date().toISOString();
  writeTasks(data);
  return task;
}

function toggleStep(taskId, stepIndex) {
  const data = readTasks();
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || !task.steps[stepIndex]) return null;

  task.steps[stepIndex].done = !task.steps[stepIndex].done;
  task.updatedAt = new Date().toISOString();

  // Auto-update status based on steps
  const allDone = task.steps.length > 0 && task.steps.every((s) => s.done);
  const anyDone = task.steps.some((s) => s.done);
  if (allDone) task.status = "done";
  else if (anyDone) task.status = "in_progress";
  else task.status = "open";

  writeTasks(data);
  return task;
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  addStep,
  toggleStep,
};
