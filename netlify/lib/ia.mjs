// Servicio de Inteligencia Artificial mediante API.
// Por defecto usa Google Gemini (tiene nivel gratuito). También admite OpenAI.
// La API Key se lee de variables de entorno del servidor.

const TIEMPO_MAXIMO_MS = 8500; // Netlify corta las funciones a los 10 s

export async function generarRespuesta({ sistema, usuario }) {
  const proveedor = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (proveedor === "openai") return conOpenAI({ sistema, usuario });
  return conGemini({ sistema, usuario });
}

async function conGemini({ sistema, usuario }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno GEMINI_API_KEY.");
  const modelo = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const generationConfig = { temperature: 0.3 };
  // En Gemini 2.5 Flash se desactiva el "razonamiento" para responder más rápido.
  if (modelo.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: usuario }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gemini respondió HTTP ${res.status}: ${data?.error?.message || "error desconocido"}`);
  }
  const texto = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text || "")
    .join("")
    .trim();
  return { texto, modelo, proveedor: "Google Gemini" };
}

async function conOpenAI({ sistema, usuario }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno OPENAI_API_KEY.");
  const modelo = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: usuario },
      ],
    }),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OpenAI respondió HTTP ${res.status}: ${data?.error?.message || "error desconocido"}`);
  }
  const texto = (data?.choices?.[0]?.message?.content || "").trim();
  return { texto, modelo, proveedor: "OpenAI" };
}
