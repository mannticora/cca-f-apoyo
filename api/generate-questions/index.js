const MAX_QUESTIONS = 20;
const MIN_TEXT_LEN = 200;
const MAX_TEXT_LEN = 60000;

const TOOL_SCHEMA = {
  name: "return_questions",
  description: "Return generated CCA-F exam-style practice questions grounded in the provided source text.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            scenario: { type: "string", description: "1-4 sentence realistic scenario. Empty string if not needed." },
            question: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correct: { type: "integer", minimum: 0, maximum: 3 },
            why: { type: "string", description: "Explains why the correct answer is right and briefly why each wrong option is wrong." }
          },
          required: ["question", "options", "correct", "why"]
        }
      }
    },
    required: ["questions"]
  }
};

function systemPrompt(count) {
  return `You are writing practice exam questions for the Claude Certified Architect (CCA-F) certification exam, in the same style as its official domain guides: a short realistic workplace scenario, a question, exactly 4 multiple-choice options, one correct answer, and a "why" explanation that justifies the correct answer and briefly explains why each wrong option is wrong.

Generate exactly ${count} NEW questions, grounded strictly in the source text the user provides (it was extracted from a PDF and may contain messy formatting, page breaks, or repeated headers/footers — ignore those artifacts and focus on the substantive content). Do not invent facts that aren't supported by the source text or well-established, correct technical knowledge. Vary the sub-topics covered across the ${count} questions instead of clustering on one narrow point. Match the difficulty and tone of a real certification exam: scenario-based, testing applied understanding, not trivia.

Call the return_questions tool with your result. Do not include any other text.`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.rawBody || "{}"); } catch (e) { return {}; }
}

module.exports = async function (context, req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, body: { error: "El servidor no tiene configurada la API key de Anthropic (ANTHROPIC_API_KEY)." } };
    return;
  }

  const body = await readBody(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const requestedCount = parseInt(body.count, 10) || 10;
  const count = Math.max(1, Math.min(MAX_QUESTIONS, requestedCount));

  if (text.length < MIN_TEXT_LEN) {
    context.res = { status: 400, body: { error: "El texto extraído del PDF es demasiado corto para generar preguntas (mínimo " + MIN_TEXT_LEN + " caracteres)." } };
    return;
  }
  const truncated = text.length > MAX_TEXT_LEN;
  const sourceText = truncated ? text.slice(0, MAX_TEXT_LEN) : text;

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8192,
        system: systemPrompt(count),
        messages: [{ role: "user", content: "Source text:\n\n" + sourceText }],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "return_questions" }
      })
    });
  } catch (e) {
    context.res = { status: 502, body: { error: "No se pudo contactar la API de Anthropic: " + e.message } };
    return;
  }

  if (!anthropicRes.ok) {
    let detail = "";
    try { detail = (await anthropicRes.json()).error?.message || ""; } catch (e) {}
    context.res = { status: anthropicRes.status, body: { error: "Anthropic API error (" + anthropicRes.status + "): " + detail } };
    return;
  }

  const data = await anthropicRes.json();
  const toolUse = (data.content || []).find(b => b.type === "tool_use" && b.name === "return_questions");
  if (!toolUse || !toolUse.input || !Array.isArray(toolUse.input.questions)) {
    context.res = { status: 502, body: { error: "La respuesta del modelo no tuvo el formato esperado." } };
    return;
  }

  const questions = toolUse.input.questions
    .filter(q => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4 &&
      typeof q.correct === "number" && q.correct >= 0 && q.correct <= 3 && typeof q.why === "string")
    .map(q => ({
      scenario: typeof q.scenario === "string" ? q.scenario : "",
      question: q.question,
      options: q.options,
      correct: q.correct,
      why: q.why
    }));

  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: { questions, truncated }
  };
};
