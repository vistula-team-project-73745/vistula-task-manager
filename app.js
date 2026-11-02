let config = null;
let editingId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const submitButton = document.getElementById("task-submit");
const cancelButton = document.getElementById("task-cancel");
const taskList = document.getElementById("task-list");
const statusMessage = document.getElementById("status-message");

function showStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.className = isError ? "error" : "success";
}

async function api(path, options = {}) {
  const url = `${config.supabaseUrl}/rest/v1/${config.tableName}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let details = response.statusText;
    try {
      const body = await response.json();
      details = body.message || details;
    } catch (e) {
      // response has no JSON body
    }
    throw new Error(`${response.status} ${details}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadTasks() {
  try {
    const tasks = await api("?select=*&order=id.asc");
    renderTasks(tasks);
  } catch (error) {
    showStatus(`Could not load tasks: ${error.message}`, true);
  }
}

function renderTasks(tasks) {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    taskList.textContent = "No tasks yet.";
    return;
  }

  for (const task of tasks) {
    const item = document.createElement("div");
    item.className = "task-item" + (task.completed ? " done" : "");
    item.dataset.id = task.id;

    const title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title;

    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "";

    const status = document.createElement("span");
    status.className = "task-status";
    status.textContent = task.completed ? "Completed" : "Incomplete";

    const toggleButton = document.createElement("button");
    toggleButton.className = "toggle-task";
    toggleButton.textContent = task.completed ? "Mark incomplete" : "Mark completed";
    toggleButton.addEventListener("click", () => toggleTask(task));

    const editButton = document.createElement("button");
    editButton.className = "edit-task";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEdit(task));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-task";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    const buttons = document.createElement("div");
    buttons.className = "task-buttons";
    buttons.append(toggleButton, editButton, deleteButton);

    item.append(title, description, status, buttons);
    taskList.append(item);
  }
}

function startEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  descriptionInput.value = task.description || "";
  submitButton.textContent = "Save changes";
  cancelButton.hidden = false;
  titleInput.focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitButton.textContent = "Add task";
  cancelButton.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  if (!title) {
    showStatus("Title is required.", true);
    return;
  }

  try {
    if (editingId === null) {
      await api("", {
        method: "POST",
        body: JSON.stringify({ title, description, completed: false }),
      });
      showStatus("Task added.");
    } else {
      await api(`?id=eq.${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description }),
      });
      showStatus("Task updated.");
    }
    resetForm();
    await loadTasks();
  } catch (error) {
    showStatus(`Could not save task: ${error.message}`, true);
  }
});

cancelButton.addEventListener("click", resetForm);

async function toggleTask(task) {
  try {
    await api(`?id=eq.${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: !task.completed }),
    });
    showStatus("Task status changed.");
    await loadTasks();
  } catch (error) {
    showStatus(`Could not change status: ${error.message}`, true);
  }
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;

  try {
    await api(`?id=eq.${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    showStatus("Task deleted.");
    await loadTasks();
  } catch (error) {
    showStatus(`Could not delete task: ${error.message}`, true);
  }
}

async function init() {
  try {
    const response = await fetch("config.json");
    if (!response.ok) throw new Error(`config.json: ${response.status}`);
    config = await response.json();
  } catch (error) {
    showStatus(`Could not load configuration: ${error.message}`, true);
    return;
  }
  await loadTasks();
}

init();
