import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/* ============================================================================
   EXECUTION HUB — LOCAL BACKEND
   Phase 3.2B — ChatGPT -> Execution Hub Command API
   Authentication added for /api/tasks/command
============================================================================ */

/* -------------------------------- ENV --------------------------------------- */

const PORT = Number(process.env.PORT || 3001);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const EXECUTION_HUB_API_KEY =
  process.env.EXECUTION_HUB_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing.");
}

if (!SUPABASE_URL) {
  console.error("ERROR: SUPABASE_URL is missing from .env");
  process.exit(1);
}

if (!SUPABASE_SECRET_KEY) {
  console.error(
    "ERROR: SUPABASE_SECRET_KEY is missing from .env"
  );
  process.exit(1);
}

if (!EXECUTION_HUB_API_KEY) {
  console.error(
    "ERROR: EXECUTION_HUB_API_KEY is missing from .env"
  );
  process.exit(1);
}

/*
  IMPORTANT:
  These secret keys stay server-side only.
  Never expose them to App.jsx or the browser.
*/

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/* -------------------------------- HELPERS ----------------------------------- */

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
  });

  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });

  res.end(text);
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function makeTaskId() {
  return (
    "t" +
    Date.now().toString() +
    crypto.randomBytes(3).toString("hex")
  );
}

function normalizeTaskInput(body = {}) {
  return {
    title: String(body.title || "").trim(),

    description: String(
      body.description || ""
    ).trim(),

    priority: ["Low", "Medium", "High"].includes(
      body.priority
    )
      ? body.priority
      : "Medium",

    category: String(
      body.category || ""
    ).trim(),

    dueDate: String(
      body.dueDate || ""
    ),

    dueTime: String(
      body.dueTime || ""
    ),

    estimatedMinutes:
      body.estimatedMinutes === null ||
      body.estimatedMinutes === undefined ||
      body.estimatedMinutes === ""
        ? null
        : Number(body.estimatedMinutes),

    status: [
      "pending",
      "in_progress",
      "completed",
    ].includes(body.status)
      ? body.status
      : "pending",
  };
}

function sanitizeEstimatedMinutes(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.round(number);
}

/* ============================================================================
   SUPABASE TASK OPERATIONS
============================================================================ */

async function getTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("createdAt", { ascending: true });

  if (error) {
    throw new Error(
      `Supabase GET tasks failed: ${error.message}`
    );
  }

  return data || [];
}

async function createTask(body) {
  const input = normalizeTaskInput(body);

  if (!input.title) {
    throw new Error("Task title is required");
  }

  const now = new Date().toISOString();

  const task = {
    id: makeTaskId(),
    title: input.title,
    description: input.description,
    priority: input.priority,
    category: input.category,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    estimatedMinutes:
      sanitizeEstimatedMinutes(
        input.estimatedMinutes
      ),
    status: input.status,
    createdAt: now,
    completedAt:
      input.status === "completed"
        ? now
        : null,
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Supabase CREATE task failed: ${error.message}`
    );
  }

  console.log(
    "\n========================================"
  );
  console.log("Execution Hub Task API");
  console.log("Task created:", data);
  console.log(
    "========================================\n"
  );

  return data;
}

async function updateTask(id, body) {
  const patch = {};

  /*
    Only update fields actually supplied by the request.
    This prevents PATCH from accidentally overwriting fields.
  */

  if (body.title !== undefined) {
    const title = String(body.title).trim();

    if (!title) {
      throw new Error(
        "Task title cannot be empty"
      );
    }

    patch.title = title;
  }

  if (body.description !== undefined) {
    patch.description = String(
      body.description || ""
    ).trim();
  }

  if (body.priority !== undefined) {
    if (
      !["Low", "Medium", "High"].includes(
        body.priority
      )
    ) {
      throw new Error("Invalid priority");
    }

    patch.priority = body.priority;
  }

  if (body.category !== undefined) {
    patch.category = String(
      body.category || ""
    ).trim();
  }

  if (body.dueDate !== undefined) {
    patch.dueDate = String(
      body.dueDate || ""
    );
  }

  if (body.dueTime !== undefined) {
    patch.dueTime = String(
      body.dueTime || ""
    );
  }

  if (body.estimatedMinutes !== undefined) {
    patch.estimatedMinutes =
      sanitizeEstimatedMinutes(
        body.estimatedMinutes
      );
  }

  if (body.status !== undefined) {
    if (
      ![
        "pending",
        "in_progress",
        "completed",
      ].includes(body.status)
    ) {
      throw new Error("Invalid status");
    }

    patch.status = body.status;

    if (body.status === "completed") {
      patch.completedAt =
        body.completedAt ||
        new Date().toISOString();
    } else {
      patch.completedAt = null;
    }
  }

  if (
    body.completedAt !== undefined &&
    body.status === undefined
  ) {
    patch.completedAt = body.completedAt;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No fields to update");
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(
      `Supabase UPDATE task failed: ${error.message}`
    );
  }

  console.log("Task updated:", data);

  return data;
}

async function deleteTask(id) {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(
      `Supabase DELETE task failed: ${error.message}`
    );
  }

  console.log("Task deleted:", data);

  return data;
}

/* ============================================================================
   GEMINI TASK PARSER
============================================================================ */

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
];

function buildTaskParserPrompt(
  instruction,
  todayIso
) {
  return `
You are the task parsing engine for Execution Hub.

Convert the user's natural-language instruction into ONE structured task.

Today's local date is:
${todayIso}

User instruction:
${instruction}

Return ONLY valid JSON.

Required JSON shape:

{
  "title": "short task title",
  "description": "short useful description",
  "priority": "Low | Medium | High",
  "category": "project or category name",
  "dueDate": "YYYY-MM-DD",
  "dueTime": "HH:MM",
  "estimatedMinutes": 30
}

Rules:

1. Keep the title concise and actionable.
2. Preserve the user's intended task.
3. If priority is not specified, use "Medium".
4. If duration is not specified, estimate a reasonable duration.
5. If category/project is not specified, use an empty string.
6. If due date is not specified, use today's date.
7. If due time is not specified, use an empty string.
8. Resolve words such as "today", "tomorrow", "besok", "kemarin", etc. relative to today's date.
9. Use 24-hour time.
10. estimatedMinutes must be an integer.
11. Do not return markdown.
12. Do not explain your answer outside the JSON.
`;
}

function extractGeminiText(payload) {
  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  return text;
}

function cleanJsonText(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeParsedTask(
  parsed,
  todayIso
) {
  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "Gemini returned invalid task object"
    );
  }

  const priority =
    ["Low", "Medium", "High"].includes(
      parsed.priority
    )
      ? parsed.priority
      : "Medium";

  let estimatedMinutes = Number(
    parsed.estimatedMinutes
  );

  if (
    !Number.isFinite(estimatedMinutes) ||
    estimatedMinutes <= 0
  ) {
    estimatedMinutes = 30;
  }

  estimatedMinutes = Math.round(
    estimatedMinutes
  );

  const title = String(
    parsed.title || ""
  ).trim();

  if (!title) {
    throw new Error(
      "Gemini returned an empty task title"
    );
  }

  return {
    title,

    description: String(
      parsed.description || ""
    ).trim(),

    priority,

    category: String(
      parsed.category || ""
    ).trim(),

    dueDate: String(
      parsed.dueDate || todayIso
    ),

    dueTime: String(
      parsed.dueTime || ""
    ),

    estimatedMinutes,
  };
}

async function callGemini(
  model,
  instruction,
  todayIso
) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`;

  const response = await fetch(
    url,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",

            parts: [
              {
                text:
                  buildTaskParserPrompt(
                    instruction,
                    todayIso
                  ),
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.1,
          responseMimeType:
            "application/json",
        },
      }),
    }
  );

  const rawText =
    await response.text();

  let payload;

  try {
    payload = JSON.parse(
      rawText
    );
  } catch {
    throw new Error(
      `Gemini returned non-JSON response (${response.status})`
    );
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `Gemini request failed with status ${response.status}`;

    const error = new Error(
      message
    );

    error.status =
      response.status;

    throw error;
  }

  const text =
    extractGeminiText(
      payload
    );

  if (!text) {
    throw new Error(
      "Gemini returned empty response"
    );
  }

  const cleaned =
    cleanJsonText(text);

  let parsed;

  try {
    parsed = JSON.parse(
      cleaned
    );
  } catch {
    throw new Error(
      "Gemini returned invalid JSON task"
    );
  }

  return normalizeParsedTask(
    parsed,
    todayIso
  );
}

async function parseTaskInstruction(
  instruction,
  todayIso
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing"
    );
  }

  let lastError = null;

  for (
    const model of GEMINI_MODELS
  ) {
    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      try {
        console.log(
          `Trying model: ${model} (attempt ${attempt}/2)`
        );

        const result =
          await callGemini(
            model,
            instruction,
            todayIso
          );

        console.log(
          "Final parsed task:"
        );

        console.log(result);

        return result;
      } catch (error) {
        lastError = error;

        console.error(
          `Model ${model} attempt ${attempt} failed:`,
          error.message
        );

        const status =
          error.status;

        if (
          status === 400 ||
          status === 401 ||
          status === 403
        ) {
          break;
        }

        if (attempt < 2) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                1000 * attempt
              )
          );
        }
      }
    }
  }

  throw new Error(
    `All Gemini models failed. Last error: ${
      lastError?.message ||
      "Unknown error"
    }`
  );
}

/* ============================================================================
   HTTP SERVER
============================================================================ */

const server =
  http.createServer(
    async (req, res) => {
      /*
        CORS preflight
      */

      if (
        req.method === "OPTIONS"
      ) {
        res.writeHead(204, {
          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Methods":
            "GET,POST,PATCH,DELETE,OPTIONS",

          "Access-Control-Allow-Headers":
            "Content-Type, Authorization",
        });

        res.end();

        return;
      }

      try {
        const url =
          new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
          );

        const pathname =
          url.pathname;

        /* ------------------------------- HEALTH -------------------------------- */

        if (
          req.method === "GET" &&
          pathname === "/api/health"
        ) {
          return sendJson(
            res,
            200,
            {
              ok: true,
              service:
                "Execution Hub API",
              database:
                "supabase",
              timestamp:
                new Date().toISOString(),
            }
          );
        }

        /* -------------------------------- TASKS --------------------------------- */

        if (
          req.method === "GET" &&
          pathname === "/api/tasks"
        ) {
          const tasks =
            await getTasks();

          return sendJson(
            res,
            200,
            {
              tasks,
            }
          );
        }

        if (
          req.method === "POST" &&
          pathname === "/api/tasks"
        ) {
          const body =
            await readJsonBody(
              req
            );

          const task =
            await createTask(
              body
            );

          return sendJson(
            res,
            201,
            {
              task,
            }
          );
        }

        /* -------------------------- TASK COMMAND API --------------------------- */

        /*
          ChatGPT -> Execution Hub

          This endpoint requires:

          Authorization: Bearer <EXECUTION_HUB_API_KEY>

          Example request:

          POST /api/tasks/command

          {
            "instruction":
              "Besok jam 7 malam belajar Python selama 1 jam"
          }

          Flow:

          authenticated request
                ↓
          natural language
                ↓
          Gemini parser
                ↓
          structured task
                ↓
          Supabase
                ↓
          created task
        */

        if (
          req.method === "POST" &&
          pathname === "/api/tasks/command"
        ) {
          /* -------------------------- AUTH CHECK -------------------------- */

          const authHeader =
            req.headers.authorization || "";

          if (
            !EXECUTION_HUB_API_KEY ||
            authHeader !==
              `Bearer ${EXECUTION_HUB_API_KEY}`
          ) {
            console.warn(
              "Unauthorized request to /api/tasks/command"
            );

            return sendJson(
              res,
              401,
              {
                error:
                  "Unauthorized",
              }
            );
          }

          /* ------------------------ REQUEST BODY -------------------------- */

          const body =
            await readJsonBody(
              req
            );

          const instruction =
            String(
              body.instruction ||
                ""
            ).trim();

          const todayIso =
            String(
              body.today ||
                new Date()
                  .toISOString()
                  .slice(0, 10)
            ).trim();

          if (!instruction) {
            return sendJson(
              res,
              400,
              {
                error:
                  "Instruction is required",
              }
            );
          }

          console.log(
            "\n========================================"
          );

          console.log(
            "ChatGPT Command Received"
          );

          console.log(
            "Instruction:",
            instruction
          );

          console.log(
            "========================================\n"
          );

          /* ------------------------- GEMINI PARSE ------------------------- */

          const parsed =
            await parseTaskInstruction(
              instruction,
              todayIso
            );

          /* ------------------------- SUPABASE ----------------------------- */

          const task =
            await createTask({
              ...parsed,
              status:
                "pending",
            });

          /* ------------------------- RESPONSE ----------------------------- */

          return sendJson(
            res,
            201,
            {
              success: true,
              source:
                "chatgpt-command",
              task,
            }
          );
        }

        /* --------------------------- TASK BY ID ---------------------------- */

        const taskMatch =
          pathname.match(
            /^\/api\/tasks\/([^/]+)$/
          );

        if (taskMatch) {
          const taskId =
            decodeURIComponent(
              taskMatch[1]
            );

          /* ----------------------------- PATCH ----------------------------- */

          if (
            req.method === "PATCH"
          ) {
            const body =
              await readJsonBody(
                req
              );

            const task =
              await updateTask(
                taskId,
                body
              );

            if (!task) {
              return sendJson(
                res,
                404,
                {
                  error:
                    "Task not found",
                }
              );
            }

            return sendJson(
              res,
              200,
              {
                task,
              }
            );
          }

          /* ---------------------------- DELETE ----------------------------- */

          if (
            req.method === "DELETE"
          ) {
            const task =
              await deleteTask(
                taskId
              );

            if (!task) {
              return sendJson(
                res,
                404,
                {
                  error:
                    "Task not found",
                }
              );
            }

            return sendJson(
              res,
              200,
              {
                success: true,
                task,
              }
            );
          }
        }

        /* ------------------------------ AI PARSER ------------------------------- */

        if (
          req.method === "POST" &&
          pathname ===
            "/api/tasks/parse"
        ) {
          const body =
            await readJsonBody(
              req
            );

          const instruction =
            String(
              body.instruction ||
                ""
            ).trim();

          const todayIso =
            String(
              body.today ||
                new Date()
                  .toISOString()
                  .slice(0, 10)
            ).trim();

          if (!instruction) {
            return sendJson(
              res,
              400,
              {
                error:
                  "Instruction is required",
              }
            );
          }

          const parsed =
            await parseTaskInstruction(
              instruction,
              todayIso
            );

          return sendJson(
            res,
            200,
            parsed
          );
        }

        /* -------------------------------- 404 ----------------------------------- */

        return sendJson(
          res,
          404,
          {
            error:
              "Not found",
          }
        );
      } catch (error) {
        console.error(
          "\nAPI ERROR:",
          error
        );

        return sendJson(
          res,
          500,
          {
            error:
              error.message ||
              "Internal server error",
          }
        );
      }
    }
  );

/* ============================================================================
   START
============================================================================ */

server.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      `AI backend running at http://localhost:${PORT}`
    );

    console.log(
      `Supabase database connected: ${SUPABASE_URL}`
    );

    console.log(
      "Task storage: Supabase PostgreSQL"
    );

    console.log(
      "ChatGPT Command API authentication: ENABLED"
    );
  }
);