import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";

const GEMINI_KEY_STORAGE = "takvimed:geminiKey";
const GEMINI_MODEL = "gemini-2.5-flash";

// Gemini "high demand" (503) gibi geçici hatalarda otomatik yeniden deneme.
const MAX_GEMINI_ATTEMPTS = 3; // ilk istek + 2 yeniden deneme
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Artan bekleme + rastgele jitter: ~0.7sn, sonra ~1.5sn
const retryDelayMs = (attempt) => 700 * 2 ** (attempt - 1) + Math.random() * 300;

const chatCallable = httpsCallable(functions, "chatWithGemini");
const scanCallable = httpsCallable(functions, "scanPrescription");

export async function scanPrescriptionImage(file) {
  if (!auth.currentUser) {
    throw new Error("Reçete taramak için giriş yapın.");
  }
  if (!file) throw new Error("Görsel seçilmedi.");
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Görsel 5 MB sınırını aşıyor. Daha küçük bir fotoğraf çekin veya seçin.");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(",")[1] || "";
  const mimeType = file.type || "image/jpeg";

  try {
    const result = await scanCallable({ imageBase64: base64, mimeType });
    const medications = Array.isArray(result?.data?.medications) ? result.data.medications : [];
    return { medications, preview: dataUrl };
  } catch (error) {
    const code = error?.code || "";
    if (code === "functions/unauthenticated") throw new Error("Reçete taramak için giriş yapın.");
    if (code === "functions/resource-exhausted") throw new Error(error.message);
    if (code === "functions/not-found") throw new Error(error.message || "Görselde ilaç adı tespit edilemedi.");
    if (code === "functions/invalid-argument") throw new Error(error.message);
    throw new Error(error.message || "Reçete okunamadı.");
  }
}

export function getGeminiKey() {
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function hasGeminiKey() {
  return Boolean(getGeminiKey());
}

export function setGeminiKey(key) {
  const trimmed = (key || "").trim();
  if (trimmed) localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  else localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export async function validateGeminiKey(key) {
  const trimmed = (key || "").trim();
  if (!trimmed) return { ok: false, error: "Anahtar boş olamaz." };
  if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(trimmed)) {
    return { ok: false, error: "Anahtar formatı geçersiz. Google AI Studio'dan aldığın anahtarı 'AIza...' ile başlamalı." };
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}?key=${encodeURIComponent(trimmed)}`,
    );
    if (response.ok) return { ok: true };
    const data = await response.json().catch(() => ({}));
    const reason = data?.error?.message || "";
    if (response.status === 400 || response.status === 403) {
      return { ok: false, error: `Anahtar geçersiz veya yetkisiz. ${reason}`.trim() };
    }
    return { ok: false, error: `Doğrulama başarısız (${response.status}). ${reason}`.trim() };
  } catch (error) {
    return { ok: false, error: `Ağ hatası: ${error.message}` };
  }
}

export async function sendAssistantMessage({ message, medicineName, userContext }) {
  const medicines = userContext?.medicines || [];

  if (typeof auth.authStateReady === "function") {
    try { await auth.authStateReady(); } catch { /* ignore */ }
  }

  // Geliştirme modunda yerel Gemini anahtarı tanımlıysa Cloud Function yerine
  // doğrudan onu kullan. Böylece bu dosyadaki değişiklikler (sistem talimatı vb.)
  // fonksiyonları yeniden deploy etmeden anında geçerli olur.
  if (import.meta.env.DEV && getGeminiKey()) {
    const devReply = await tryLocalKey({ message, medicineName, medicines });
    if (devReply) return devReply;
  }

  if (auth.currentUser) {
    try {
      const result = await chatCallable({ message, medicineName: medicineName || "", medicines });
      const reply = result?.data?.reply;
      if (reply) return { reply, source: "cloud-function" };
    } catch (error) {
      if (error?.code === "functions/not-found" || error?.code === "functions/unavailable") {
        const fallback = await tryLocalKey({ message, medicineName, medicines });
        if (fallback) return fallback;
      }
      throw new Error(translateCallableError(error));
    }
  }

  const fallback = await tryLocalKey({ message, medicineName, medicines });
  if (fallback) return fallback;

  return {
    reply: "Asistan henüz aktif değil. Giriş yaparsanız bağlanırsınız; geliştirme modunda Ayarlar → Asistan'dan kendi Gemini anahtarınızı da ekleyebilirsiniz.",
    source: "not-configured",
  };
}

function translateCallableError(error) {
  const code = error?.code || "";
  const msg = error?.message || "Asistan şu anda yanıt veremiyor.";
  if (code === "functions/unauthenticated") return "Asistanı kullanmak için giriş yapın.";
  if (code === "functions/resource-exhausted") return msg;
  if (code === "functions/invalid-argument") return msg;
  return msg;
}

async function tryLocalKey({ message, medicineName, medicines }) {
  const key = getGeminiKey();
  if (!key) return null;
  try {
    const reply = await callGeminiDirect({ key, message, medicineName, medicines });
    return { reply, source: "local-key-dev" };
  } catch (error) {
    throw new Error(error.message || "Yerel anahtarla bağlanılamadı.");
  }
}

async function callGeminiDirect({ key, message, medicineName, medicines }) {
  const medsLine = medicines.length ? `Kullanıcının kayıtlı ilaçları: ${medicines.join(", ")}.` : "Kullanıcının kayıtlı ilacı yok.";
  const focus = medicineName ? `Soru bu ilaç hakkında: ${medicineName}.` : "Genel bir soru.";
  const systemInstruction = [
    "Sen TakviMed adlı bir Türk ilaç takip uygulamasının yardımcı asistanısın.",
    "Yanıtlarını her zaman Türkçe ver. Kısa, anlaşılır ve net ol (3-5 cümle).",
    "GÖREV ALANIN: Yalnızca sağlık, ilaçlar, takviyeler, hastalıklar, tedaviler, belirtiler, beslenme ve TakviMed uygulamasının kullanımı ile ilgili soruları yanıtla.",
    "Bu alanın DIŞINDAKİ hiçbir soruya cevap verme (örn. matematik, fizik, tarih, coğrafya, kodlama, genel kültür, güncel olaylar, eğlence, kişisel görüş veya sohbet). Kullanıcı ısrar etse veya konuyu zorla sağlıkla ilişkilendirmeye çalışsa bile konu dışına çıkma.",
    "Konu dışı bir soru gelirse SADECE şu cümleyle yanıt ver ve başka hiçbir bilgi ekleme: \"Üzgünüm, ben yalnızca sağlık ve ilaçlarınızla ilgili sorularda yardımcı olabilirim.\"",
    "İSTİSNA: Karşılama mesajlarına ('selam', 'merhaba' vb.) bunu konu dışı sayma; kısa ve sıcak karşıla.",
    "Sağlık tavsiyesi vermek yerine bilgilendirme yap. Doz değişikliği ÖNERME.",
    "TANI KOYMA: teşhis cümleleri kurma; doktora danışmayı öner.",
    "Şüpheli/acil durumlarda doktor veya eczacıya yönlendir.",
    "Kullanıcı nöbetçi eczane veya yakındaki eczaneleri sorarsa, ☰ menüdeki Eczane sayfasından konumuna en yakın nöbetçi eczaneleri ve haritayı görebileceğini söyle.",
    medsLine,
    focus,
  ].join(" ");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const requestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  };

  // 503/500/429 (sunucu meşgul) veya ağ hatası gelirse bekleyip tekrar dene.
  let response;
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, requestInit);
    } catch (networkError) {
      if (attempt >= MAX_GEMINI_ATTEMPTS) {
        throw new Error(`Gemini'ye ulaşılamadı: ${networkError.message}`);
      }
      await sleep(retryDelayMs(attempt));
      continue;
    }
    if ([500, 503, 429].includes(response.status) && attempt < MAX_GEMINI_ATTEMPTS) {
      await sleep(retryDelayMs(attempt));
      continue;
    }
    break;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = data?.error?.message || `HTTP ${response.status}`;
    if (response.status === 400 || response.status === 403) {
      throw new Error(`Gemini anahtarı geçersiz veya yetkisiz: ${reason}`);
    }
    if (response.status === 429) {
      throw new Error("Gemini kullanım kotası dolu görünüyor. Lütfen biraz sonra tekrar deneyin.");
    }
    if (response.status === 503 || response.status === 500) {
      throw new Error("Gemini sunucuları şu an çok yoğun. Birkaç kez denedik ama yanıt alamadık — lütfen birkaç dakika sonra tekrar deneyin.");
    }
    throw new Error(`Gemini hatası: ${reason}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n").trim();
  if (!text) throw new Error("Gemini boş yanıt döndü.");
  return text;
}
