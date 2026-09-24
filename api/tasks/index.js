let tasks = [];

function json(res, status, data) {
  res.status(status).json(data);
}

function normalizeTask(input) {
  const now = new Date().toISOString();

  return {
    id:
      input.id ||
      "t" + Date.now() + Math.random().toString(36).slice(2, 7),
    title: String(input.title || "").trim(),
    description: String(input.description || ""),
    priority: ["Low", "Medium", "High"].includes(input.priority)
      ? input.priority
      : "Medium",
    category: String(input.category || ""),
    dueDate: input.dueDate || "",
    dueTime: input.dueTime || "",
    estimatedMinutes:
      input.estimatedMinutes == null || input.estimatedMinutes === ""
        ? null
        : Number(input.estimatedMinutes),
    status: input.status || "pending",
    createdAt: input.createdAt || now,
    completedAt: input.completedAt || null,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return json(res, 200, {
        tasks,
      });
    }

    if (req.method === "POST") {
      const task = normalizeTask(req.body || {});

      if (!task.title) {
        return json(res, 400, {
          error: "Task title is required",
        });
      }

      tasks.push(task);

      return json(res, 201, {
        task,
      });
    }

    return json(res, 405, {
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("Task API error:", error);

    return json(res, 500, {
      error: "Internal server error",
    });
  }
}