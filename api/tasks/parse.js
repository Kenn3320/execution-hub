const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
];

const MAX_RETRIES_PER_MODEL = 2;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  return res.json(data);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function askGemini(model, prompt, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    console.log(
      `Gemini request: ${model} | attempt ${attempt}/${MAX_RETRIES_PER_MODEL}`
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("")
          .trim();

        if (!text) {
          throw new Error("Gemini returned an empty response");
        }

        console.log(`Gemini success: ${model}`);

        return {
          success: true,
          model,
          text,
        };
      }

      console.error(
        `Gemini ${model} HTTP ${response.status}:`,
        data?.error?.message || data
      );

      if (
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504
      ) {
        if (attempt < MAX_RETRIES_PER_MODEL) {
          const delay = attempt * 2000;

          console.log(
            `Temporary Gemini error. Retrying in ${delay / 1000}s...`
          );

          await sleep(delay);
          continue;
        }

        return {
          success: false,
          temporary: true,
          status: response.status,
          message:
            data?.error?.message ||
            "Temporary Gemini service error",
        };
      }

      return {
        success: false,
        temporary: false,
        status: response.status,
        message:
          data?.error?.message ||
          "Gemini API request failed",
      };
    } catch (error) {
      console.error(`Network error with ${model}:`, error);

      if (attempt < MAX_RETRIES_PER_MODEL) {
        const delay = attempt * 2000;

        console.log(
          `Network error. Retrying in ${delay / 1000}s...`
        );

        await sleep(delay);
        continue;
      }

      return {
        success: false,
        temporary: true,
        status: 503,
        message: error.message || "Network error",
      };
    }
  }

  return {
    success: false,
    temporary: true,
    status: 503,
    message: "Gemini request failed",
  };
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "POST, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Method not allowed",
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const { instruction, today } = body;

    // Validate instruction
    if (!instruction?.trim()) {
      return sendJson(res, 400, {
        error: "Instruction is required",
      });
    }

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY");

      return sendJson(res, 500, {
        error: "Gemini API key is not configured",
      });
    }

    const prompt = `
You are the task parser for a productivity app called Execution Hub.

Convert the user's natural-language task into ONLY valid JSON.

Today's date is:
${today}

User instruction:
"${instruction}"

Return exactly this JSON structure:

{
  "title": "short task title",
  "description": "optional useful description",
  "priority": "Low | Medium | High",
  "category": "short category",
  "dueDate": "YYYY-MM-DD",
  "dueTime": "HH:MM or empty string",
  "estimatedMinutes": number or null
}

Rules:
- Return JSON only.
- Do not use markdown.
- Do not use code fences.
- Use the user's requested date if explicitly provided.
- If no date is provided, use today's date.
- If no priority is obvious, use "Medium".
- Keep the title concise and actionable.
- estimatedMinutes should be a reasonable estimate.
- If no time is provided, use an empty string for dueTime.
- Do not invent unnecessary details.
`;

    console.log("");
    console.log("========================================");
    console.log("Execution Hub AI Task Parser");
    console.log("Instruction:", instruction);
    console.log("========================================");

    let result = null;

    for (const model of GEMINI_MODELS) {
      console.log(`Trying model: ${model}`);

      result = await askGemini(
        model,
        prompt,
        process.env.GEMINI_API_KEY
      );

      if (result.success) {
        break;
      }

      console.log(
        `Model ${model} failed: ${result.status} - ${result.message}`
      );

      if (!result.temporary) {
        break;
      }

      console.log("Trying next Gemini model...");
    }

    if (!result?.success) {
      console.error("All Gemini models failed.");

      return sendJson(res, 502, {
        error: "Gemini service temporarily unavailable",
        status: result?.status || 503,
        details:
          result?.message ||
          "All configured Gemini models failed",
      });
    }

    console.log("Successful model:", result.model);
    console.log("Gemini raw response:", result.text);

    let parsed;

    try {
      parsed = JSON.parse(result.text);
    } catch (error) {
      console.error("Invalid Gemini JSON:", result.text);
      console.error("JSON parse error:", error);

      return sendJson(res, 502, {
        error: "Gemini returned invalid JSON",
      });
    }

    if (!parsed.title) {
      console.error("Gemini response missing title:", parsed);

      return sendJson(res, 502, {
        error: "AI response missing title",
      });
    }

    // Normalize fields
    parsed.description = parsed.description || "";
    parsed.priority = parsed.priority || "Medium";
    parsed.category = parsed.category || "General";
    parsed.dueDate = parsed.dueDate || today;
    parsed.dueTime = parsed.dueTime || "";

    const validPriorities = [
      "Low",
      "Medium",
      "High",
    ];

    if (!validPriorities.includes(parsed.priority)) {
      parsed.priority = "Medium";
    }

    if (
      parsed.estimatedMinutes !== null &&
      parsed.estimatedMinutes !== undefined &&
      parsed.estimatedMinutes !== ""
    ) {
      parsed.estimatedMinutes = Number(
        parsed.estimatedMinutes
      );

      if (
        Number.isNaN(parsed.estimatedMinutes) ||
        parsed.estimatedMinutes < 0
      ) {
        parsed.estimatedMinutes = null;
      }
    } else {
      parsed.estimatedMinutes = null;
    }

    console.log("Final parsed task:", parsed);
    console.log("========================================");
    console.log("");

    return sendJson(res, 200, parsed);
  } catch (error) {
    console.error("Backend error:", error);

    return sendJson(res, 500, {
      error: error.message || "Internal server error",
    });
  }
}