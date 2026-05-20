const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_MESSAGE_CHARS = 500;
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let jwksCache = null;
let jwksCacheTime = 0;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

    try {
      const authHeader = request.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Yetkilendirme başlığı yok." }, 401, cors);
      const idToken = authHeader.slice(7).trim();

      const claims = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
      const uid = claims.sub;

      const body = await request.json().catch(() => ({}));
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) return json({ error: "Mesaj boş olamaz." }, 400, cors);
      if (message.length > MAX_MESSAGE_CHARS) {
        return json({ error: `Mesaj en fazla ${MAX_MESSAGE_CHARS} karakter olabilir.` }, 400, cors);
      }
      const medicineName = typeof body.medicineName === "string" ? body.medicineName.slice(0, 100) : "";
      const medicines = Array.isArray(body.medicines)
        ? body.medicines.slice(0, 30).map((m) => String(m).slice(0, 60))
        : [];

      const reply = await callGemini({
        apiKey: env.GEMINI_API_KEY,
        message,
        medicineName,
        medicines,
      });

      return json({ reply, model: GEMINI_MODEL, uid }, 200, cors);
    } catch (error) {
      const status = error.status || 500;
      return json({ error: error.message || "Bilinmeyen hata" }, status, cors);
    }
  },
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

async function verifyFirebaseIdToken(token, projectId) {
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) {
    throwHttp(401, "Token formatı geçersiz.");
  }

  const header = JSON.parse(b64UrlDecodeToString(headerB64));
  if (header.alg !== "RS256") throwHttp(401, "Algoritma desteklenmiyor.");
  if (!header.kid) throwHttp(401, "Token kid yok.");

  const jwks = await getJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throwHttp(401, "Token anahtarı bilinmiyor.");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = b64UrlDecodeToBytes(sigB64);
  const valid = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, sig, data);
  if (!valid) throwHttp(401, "Token imzası geçersiz.");

  const payload = JSON.parse(b64UrlDecodeToString(payloadB64));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throwHttp(401, "Token süresi doldu.");
  if (!payload.iat || payload.iat > now + 60) throwHttp(401, "Token iat geçersiz.");
  if (payload.aud !== projectId) throwHttp(401, "Token audience geçersiz.");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throwHttp(401, "Token issuer geçersiz.");
  if (!payload.sub) throwHttp(401, "Token subject yok.");
  return payload;
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < 60 * 60 * 1000) return jwksCache;
  const response = await fetch(JWKS_URL);
  if (!response.ok) throwHttp(503, "Firebase anahtar servisine ulaşılamadı.");
  jwksCache = await response.json();
  jwksCacheTime = now;
  return jwksCache;
}

async function callGemini({ apiKey, message, medicineName, medicines }) {
  if (!apiKey) throwHttp(500, "Gemini anahtarı sunucuda tanımsız.");
  const medsLine = medicines.length ? `Kullanıcının kayıtlı ilaçları: ${medicines.join(", ")}.` : "Kullanıcının kayıtlı ilacı yok.";
  const focus = medicineName ? `Soru bu ilaç hakkında: ${medicineName}.` : "Genel bir soru.";
  const systemInstruction = [
    "Sen TakviMed adlı bir Türk ilaç takip uygulamasının yardımcı asistanısın.",
    "Yanıtlarını her zaman Türkçe ver. Kısa, anlaşılır ve net ol (3-5 cümle).",
    "Sağlık tavsiyesi vermek yerine bilgilendirme yap. Doz değişikliği ÖNERME.",
    "Şüpheli/acil durumlarda doktor veya eczacıya yönlendir.",
    medsLine,
    focus,
  ].join(" ");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = data?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) throwHttp(429, "Gemini servisi şu an meşgul.");
    throwHttp(502, `Gemini hatası: ${reason}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n").trim();
  if (!text) throwHttp(502, "Gemini boş yanıt döndü.");
  return text;
}

function throwHttp(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function b64UrlDecodeToString(input) {
  return new TextDecoder().decode(b64UrlDecodeToBytes(input));
}

function b64UrlDecodeToBytes(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
