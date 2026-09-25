const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function json(res, status, data) {
  return res.status(status).json(data);
}

function mapSupabaseTask(row) {
  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    priority: row.priority || "Medium",
    category: row.category || "",
    dueDate: row.dueDate || "",
    dueTime: row.dueTime || "",
    estimatedMinutes:
      row.estimatedMinutes == null
        ? null
        : Number(row.estimatedMinutes),
    status: row.status || "pending",
    createdAt: row.createdAt || null,
    completedAt: row.completedAt || null,
  };
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is missing");
  }

  if (!SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        ...(options.headers || {}),
      },
    }
  );

  const rawText = await response.text();

  let payload = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase request failed (${response.status}): ${
        payload?.message ||
        payload?.error ||
        rawText ||
        "Unknown error"
      }`
    );
  }

  return payload;
}

function normalizeTask(input) {
  const now = new Date().toISOString();

  const estimatedMinutes =
    input.estimatedMinutes == null ||
    input.estimatedMinutes === ""
      ? null
      : Number(input.estimatedMinutes);

  return {
    id:
      input.id ||
      "t" +
        Date.now() +
        Math.random().toString(36).slice(2, 7),

    title: String(input.title || "").trim(),

    description: String(input.description || "").trim(),

    priority: ["Low", "Medium", "High"].includes(
      input.priority
    )
      ? input.priority
      : "Medium",

    category: String(input.category || "").trim(),

    dueDate: String(input.dueDate || ""),

    dueTime: String(input.dueTime || ""),

    estimatedMinutes:
      Number.isFinite(estimatedMinutes) &&
      estimatedMinutes >= 0
        ? Math.round(estimatedMinutes)
        : null,

    status: [
      "pending",
      "in_progress",
      "completed",
    ].includes(input.status)
      ? input.status
      : "pending",

    createdAt: input.createdAt || now,

    completedAt:
      input.completedAt || null,
  };
}

export default async function handler(req, res) {
  try {
    /*
     * CORS
     */

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    /*
     * GET
     * Load tasks from Supabase
     */

    if (req.method === "GET") {
      const rows = await supabaseRequest(
        "tasks?select=*&order=createdAt.desc"
      );

      const tasks = Array.isArray(rows)
        ? rows.map(mapSupabaseTask)
        : [];

      return json(res, 200, {
        tasks,
      });
    }

    /*
     * POST
     * Create task directly in Supabase
     */

    if (req.method === "POST") {
      const input =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body || {};

      const task = normalizeTask(input);

      if (!task.title) {
        return json(res, 400, {
          error: "Task title is required",
        });
      }

      const rows = await supabaseRequest(
        "tasks",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(task),
        }
      );

      const createdTask =
        Array.isArray(rows) && rows.length > 0
          ? mapSupabaseTask(rows[0])
          : task;

      return json(res, 201, {
        task: createdTask,
      });
    }

    /*
     * PATCH
     * Update an existing task
     */

    if (req.method === "PATCH") {
      const input =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body || {};

      const id = String(input.id || "").trim();

      if (!id) {
        return json(res, 400, {
          error: "Task id is required",
        });
      }

      const updates = {};

      if (input.title !== undefined) {
        updates.title = String(input.title).trim();
      }

      if (input.description !== undefined) {
        updates.description =
          String(input.description).trim();
      }

      if (input.priority !== undefined) {
        updates.priority = [
          "Low",
          "Medium",
          "High",
        ].includes(input.priority)
          ? input.priority
          : "Medium";
      }

      if (input.category !== undefined) {
        updates.category =
          String(input.category).trim();
      }

      if (input.dueDate !== undefined) {
        updates.dueDate =
          String(input.dueDate);
      }

      if (input.dueTime !== undefined) {
        updates.dueTime =
          String(input.dueTime);
      }

      if (input.estimatedMinutes !== undefined) {
        const value =
          input.estimatedMinutes === null ||
          input.estimatedMinutes === ""
            ? null
            : Number(input.estimatedMinutes);

        updates.estimatedMinutes =
          Number.isFinite(value) && value >= 0
            ? Math.round(value)
            : null;
      }

      if (input.status !== undefined) {
        updates.status = [
          "pending",
          "in_progress",
          "completed",
        ].includes(input.status)
          ? input.status
          : "pending";

        if (
          input.status === "completed"
        ) {
          updates.completedAt =
            new Date().toISOString();
        } else {
          updates.completedAt = null;
        }
      }

      const rows = await supabaseRequest(
        `tasks?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(updates),
        }
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return json(res, 404, {
          error: "Task not found",
        });
      }

      return json(res, 200, {
        task: mapSupabaseTask(rows[0]),
      });
    }

    /*
     * DELETE
     * Delete task from Supabase
     */

    if (req.method === "DELETE") {
      const id =
        String(
          req.query?.id ||
            req.body?.id ||
            ""
        ).trim();

      if (!id) {
        return json(res, 400, {
          error: "Task id is required",
        });
      }

      const rows = await supabaseRequest(
        `tasks?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=representation",
          },
        }
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return json(res, 404, {
          error: "Task not found",
        });
      }

      return json(res, 200, {
        task: mapSupabaseTask(rows[0]),
      });
    }

    /*
     * METHOD NOT ALLOWED
     */

    return json(res, 405, {
      error: "Method not allowed",
    });
  } catch (error) {
    console.error(
      "Task API error:",
      error
    );

    return json(res, 500, {
      error:
        error.message ||
        "Internal server error",
    });
  }
}