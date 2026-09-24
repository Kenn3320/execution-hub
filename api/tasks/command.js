import crypto from "node:crypto";

/* ============================================================================
   ENV
============================================================================ */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const EXECUTION_HUB_API_KEY =
  process.env.EXECUTION_HUB_API_KEY;

/* ============================================================================
   RESPONSE HELPERS
============================================================================ */

function json(res, status, payload) {
  return res.status(status).json(payload);
}

/* ============================================================================
   SUPABASE
============================================================================ */

async function createTask(body) {
  const estimatedMinutes =
    body.estimatedMinutes === null ||
    body.estimatedMinutes === undefined ||
    body.estimatedMinutes === ""
      ? null
      : Number(body.estimatedMinutes);

  const safeEstimatedMinutes =
    Number.isFinite(estimatedMinutes) &&
    estimatedMinutes >= 0
      ? Math.round(estimatedMinutes)
      : null;

  const priority = [
    "Low",
    "Medium",
    "High",
  ].includes(body.priority)
    ? body.priority
    : "Medium";

  const status = [
    "pending",
    "in_progress",
    "completed",
  ].includes(body.status)
    ? body.status
    : "pending";

  const now =
    new Date().toISOString();

  const task = {
    id:
      "t" +
      Date.now().toString() +
      crypto.randomBytes(3).toString("hex"),

    title:
      String(body.title || "").trim(),

    description:
      String(body.description || "").trim(),

    priority,

    category:
      String(body.category || "").trim(),

    dueDate:
      String(body.dueDate || ""),

    dueTime:
      String(body.dueTime || ""),

    estimatedMinutes:
      safeEstimatedMinutes,

    status,

    createdAt: now,

    completedAt:
      status === "completed"
        ? now
        : null,
  };

  if (!task.title) {
    throw new Error(
      "Task title is required"
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/tasks`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        apikey:
          SUPABASE_SECRET_KEY,

        Authorization:
          `Bearer ${SUPABASE_SECRET_KEY}`,

        Prefer:
          "return=representation",
      },

      body: JSON.stringify(task),
    }
  );

  const rawText =
    await response.text();

  let payload;

  try {
    payload =
      rawText
        ? JSON.parse(rawText)
        : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase CREATE task failed: ${
        payload?.message ||
        rawText ||
        response.status
      }`
    );
  }

  return Array.isArray(payload)
    ? payload[0]
    : payload;
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

function extractGeminiText(
  payload
) {
  return (
    payload?.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part) =>
          part.text || ""
      )
      .join("")
      .trim() || ""
  );
}

function cleanJsonText(text) {
  return text
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
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
    [
      "Low",
      "Medium",
      "High",
    ].includes(parsed.priority)
      ? parsed.priority
      : "Medium";

  let estimatedMinutes =
    Number(
      parsed.estimatedMinutes
    );

  if (
    !Number.isFinite(
      estimatedMinutes
    ) ||
    estimatedMinutes <= 0
  ) {
    estimatedMinutes = 30;
  }

  estimatedMinutes =
    Math.round(
      estimatedMinutes
    );

  const title =
    String(
      parsed.title || ""
    ).trim();

  if (!title) {
    throw new Error(
      "Gemini returned an empty task title"
    );
  }

  return {
    title,

    description:
      String(
        parsed.description || ""
      ).trim(),

    priority,

    category:
      String(
        parsed.category || ""
      ).trim(),

    dueDate:
      String(
        parsed.dueDate ||
          todayIso
      ),

    dueTime:
      String(
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
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing"
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=` +
    `${encodeURIComponent(
      GEMINI_API_KEY
    )}`;

  const response =
    await fetch(
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
    payload =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      `Gemini returned non-JSON response (${response.status})`
    );
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `Gemini request failed with status ${response.status}`;

    const error =
      new Error(message);

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
    parsed =
      JSON.parse(cleaned);
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
          "Final parsed task:",
          result
        );

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
   VERCEL HANDLER
============================================================================ */

export default async function handler(
  req,
  res
) {
  /* --------------------------------------------------------------------------
     CORS
  -------------------------------------------------------------------------- */

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /* --------------------------------------------------------------------------
     METHOD
  -------------------------------------------------------------------------- */

  if (req.method !== "POST") {
    return json(
      res,
      405,
      {
        error:
          "Method not allowed",
      }
    );
  }

  /* --------------------------------------------------------------------------
     AUTHENTICATION
  -------------------------------------------------------------------------- */

  const authHeader =
    req.headers.authorization ||
    "";

  if (
    !EXECUTION_HUB_API_KEY ||
    authHeader !==
      `Bearer ${EXECUTION_HUB_API_KEY}`
  ) {
    console.warn(
      "Unauthorized request to /api/tasks/command"
    );

    return json(
      res,
      401,
      {
        error:
          "Unauthorized",
      }
    );
  }

  /* --------------------------------------------------------------------------
     ENV VALIDATION
  -------------------------------------------------------------------------- */

  if (!SUPABASE_URL) {
    return json(
      res,
      500,
      {
        error:
          "SUPABASE_URL is missing",
      }
    );
  }

  if (!SUPABASE_SECRET_KEY) {
    return json(
      res,
      500,
      {
        error:
          "SUPABASE_SECRET_KEY is missing",
      }
    );
  }

  if (!GEMINI_API_KEY) {
    return json(
      res,
      500,
      {
        error:
          "GEMINI_API_KEY is missing",
      }
    );
  }

  /* --------------------------------------------------------------------------
     BODY
  -------------------------------------------------------------------------- */

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const instruction =
      String(
        body.instruction || ""
      ).trim();

    const todayIso =
      String(
        body.today ||
          new Date()
            .toISOString()
            .slice(0, 10)
      ).trim();

    if (!instruction) {
      return json(
        res,
        400,
        {
          error:
            "Instruction is required",
        }
      );
    }

    console.log(
      "ChatGPT Command Received:",
      instruction
    );

    /* ------------------------------------------------------------------------
       STEP 1 — GEMINI
    ------------------------------------------------------------------------ */

    const parsed =
      await parseTaskInstruction(
        instruction,
        todayIso
      );

    /* ------------------------------------------------------------------------
       STEP 2 — SUPABASE
    ------------------------------------------------------------------------ */

    const task =
      await createTask({
        ...parsed,
        status: "pending",
      });

    /* ------------------------------------------------------------------------
       STEP 3 — RESPONSE
    ------------------------------------------------------------------------ */

    return json(
      res,
      201,
      {
        success: true,

        source:
          "chatgpt-command",

        task,
      }
    );
  } catch (error) {
    console.error(
      "Command API error:",
      error
    );

    return json(
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