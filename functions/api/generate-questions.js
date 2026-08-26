const MAX_QUESTIONS = 20;
const MIN_TEXT_LEN = 200;
const MAX_TEXT_LEN = 60000;
const MAX_ATTEMPTS = 3;

function toolSchema(needed) {
  return {
    name: "return_questions",
    description: "Return generated CCA-F exam-style practice questions grounded in the provided source text.",
    input_schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: needed,
          maxItems: needed,
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
}

const STYLE_EXAMPLES = [
  {
    scenario: "A team built an agent that processes refund requests. They notice the agent sometimes stops after just 2 tool calls when clearly more steps were needed, and other times keeps iterating unnecessarily for 15+ turns on simple requests. Their current implementation checks whether the word \"done\" appears anywhere in Claude's response text to decide whether to stop.",
    question: "What is the most reliable way to fix this premature/excessive termination problem?",
    options: [
      "Increase the iteration cap to 20 to give the agent more room.",
      "Check the stop_reason field in the API response — continue while it is \"tool_use\" and stop when it changes to \"end_turn\".",
      "Ask Claude in the system prompt to always say \"TASK COMPLETE\" as the very last word, and check for that exact string.",
      "Track how many tool calls have been made and stop automatically once 5 have been executed."
    ],
    correct: 1,
    why: "Why: stop_reason is the only deterministic and unambiguous termination signal. A) doesn't fix the root cause — iteration caps are only a safety net. C) is still parsing natural language, which is ambiguous. D) is an arbitrary cap not tied to whether the task actually finished."
  },
  {
    scenario: "A search tool queries a customer database for \"blue winter jacket\" and returns zero results because the store genuinely never carried that item.",
    question: "How should this be handled?",
    options: [
      "Treat it as an error and retry the search with different parameters automatically.",
      "Accept it as a valid empty result — the tool executed successfully and the absence of data IS the answer.",
      "Escalate to a human because the search failed.",
      "Return a generic error message: \"Something went wrong.\""
    ],
    correct: 1,
    why: "Why: if the tool executed successfully and returned nothing, that's a valid result, not an error. \"Not found\" is deliberately absent from the error categories. A) misdiagnoses a legitimate empty result as a failure. C) escalation isn't warranted when nothing actually went wrong. D) is a generic-failure message that hides what actually happened, which real systems should never do."
  }
];

function systemPrompt(needed, avoidQuestions) {
  const examplesBlock = STYLE_EXAMPLES.map((ex, i) =>
    `Example ${i + 1}:\n` + JSON.stringify(ex, null, 2)
  ).join("\n\n");

  const avoidBlock = avoidQuestions.length
    ? `\n\nYou already generated these ${avoidQuestions.length} questions in a previous pass — do NOT repeat them or write close variations of them. Cover different sub-topics or a different angle on the material instead:\n` +
      avoidQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
    : "";

  return `You are writing practice exam questions for the Claude Certified Architect (CCA-F) certification exam. This is a real, fairly difficult professional certification — not a trivia quiz. Match its actual bar:

- Each question poses a realistic, specific workplace scenario (names, systems, concrete numbers/details) before asking what to do.
- All 4 options must be plausible to someone who has only partially understood the material — wrong options should represent common misconceptions or "trap" answers, never options that are obviously silly or trivially eliminable.
- The question must test APPLIED judgment (what should this team/agent/engineer do, and why), not simple recall of a definition or fact.
- The "why" explanation must justify the correct answer AND briefly explain, option by option (A/B/C/D), why each wrong option is wrong — not just restate the correct answer.

Here are two real examples from this exact exam bank, showing the expected style, tone, and difficulty level:

${examplesBlock}

You MUST generate exactly ${needed} questions, grounded strictly in the source text the user provides below (it was extracted from a PDF and may contain messy formatting, page breaks, or repeated headers/footers — ignore those artifacts and focus on the substantive content). Do not invent facts that aren't supported by the source text or well-established, correct technical knowledge. If the source text is too thin to support ${needed} questions on fully distinct topics, cover the same concepts from different angles, scenarios, or emphases instead of leaving fewer than ${needed} questions — the count of ${needed} is a hard requirement, never optional. Vary the sub-topics and framing across the questions as much as the material allows.${avoidBlock}

Call the return_questions tool with your result. Do not include any other text.`;
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function callAnthropic(apiKey, sourceText, needed, avoidQuestions) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      system: systemPrompt(needed, avoidQuestions),
      messages: [{ role: "user", content: "Source text:\n\n" + sourceText }],
      tools: [toolSchema(needed)],
      tool_choice: { type: "tool", name: "return_questions" }
    })
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error?.message || ""; } catch (e) {}
    const err = new Error("Anthropic API error (" + res.status + "): " + detail);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const toolUse = (data.content || []).find(b => b.type === "tool_use" && b.name === "return_questions");
  if (!toolUse || !toolUse.input || !Array.isArray(toolUse.input.questions)) return [];

  return toolUse.input.questions
    .filter(q => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4 &&
      typeof q.correct === "number" && q.correct >= 0 && q.correct <= 3 && typeof q.why === "string")
    .map(q => ({
      scenario: typeof q.scenario === "string" ? q.scenario : "",
      question: q.question,
      options: q.options,
      correct: q.correct,
      why: q.why
    }));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, { error: "El servidor no tiene configurada la API key de Anthropic (ANTHROPIC_API_KEY)." });
  }

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const requestedCount = parseInt(body.count, 10) || 10;
  const count = Math.max(1, Math.min(MAX_QUESTIONS, requestedCount));

  if (text.length < MIN_TEXT_LEN) {
    return json(400, { error: "El texto extraído del PDF es demasiado corto para generar preguntas (mínimo " + MIN_TEXT_LEN + " caracteres)." });
  }
  const truncated = text.length > MAX_TEXT_LEN;
  const sourceText = truncated ? text.slice(0, MAX_TEXT_LEN) : text;

  let collected = [];
  let attempts = 0;
  try {
    while (collected.length < count && attempts < MAX_ATTEMPTS) {
      attempts++;
      const needed = count - collected.length;
      const avoid = collected.map(q => q.question);
      const batch = await callAnthropic(apiKey, sourceText, needed, avoid);
      const fresh = batch.filter(b => !collected.some(c => c.question === b.question));
      collected = collected.concat(fresh);
      if (fresh.length === 0) break; // el modelo ya no está produciendo preguntas nuevas: evita loop inútil
    }
  } catch (e) {
    if (collected.length === 0) {
      return json(e.status || 502, { error: e.message });
    }
    // ya teníamos algunas preguntas de un intento anterior exitoso: las devolvemos aunque un reintento haya fallado
  }

  if (!collected.length) {
    return json(502, { error: "La respuesta del modelo no tuvo el formato esperado." });
  }

  return json(200, { questions: collected.slice(0, count), truncated, requested: count });
}
