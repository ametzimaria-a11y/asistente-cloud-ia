// Servicio de Inteligencia Artificial mediante API.
// Por defecto usa Google Gemini (tiene nivel gratuito). También admite OpenAI.
// La API Key se lee de variables de entorno del servidor.

const TIEMPO_MAXIMO_MS = 8500; // Netlify corta las funciones a los 10 s

// Si un modelo ya no está disponible (HTTP 404) se prueba el siguiente.
const MODELOS_GEMINI = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
];

export async function generarRespuesta({ sistema, usuario }, tiempoMs = TIEMPO_MAXIMO_MS) {
  const proveedor = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (proveedor === "openai") return conOpenAI({ sistema, usuario }, tiempoMs);
  return conGemini({ sistema, usuario }, tiempoMs);
}

async function conGemini({ sistema, usuario }, tiempoMs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno GEMINI_API_KEY.");

  const modelos = [...new Set([process.env.GEMINI_MODEL, ...MODELOS_GEMINI].filter(Boolean))];
  const limite = Date.now() + tiempoMs;
  let ultimoError;

  for (const modelo of modelos) {
    const restante = limite - Date.now();
    if (restante < 1500) break;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: { temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(restante),
      }
    );

    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      ultimoError = new Error(`El modelo ${modelo} no está disponible: ${data?.error?.message || ""}`);
      console.warn(ultimoError.message);
      continue; // probar el siguiente modelo
    }
    if (!res.ok) {
      throw new Error(`Gemini (${modelo}) respondió HTTP ${res.status}: ${data?.error?.message || "error desconocido"}`);
    }

    const texto = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text || "")
      .join("")
      .trim();
    return { texto, modelo, proveedor: "Google Gemini" };
  }

  throw ultimoError || new Error("Se agotó el tiempo antes de obtener respuesta de Gemini.");
}

async function conOpenAI({ sistema, usuario }, tiempoMs) {
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
    signal: AbortSignal.timeout(tiempoMs),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`OpenAI respondió HTTP ${res.status}: ${data?.error?.message || "error desconocido"}`);
  }
  const texto = (data?.choices?.[0]?.message?.content || "").trim();
  return { texto, modelo, proveedor: "OpenAI" };
}