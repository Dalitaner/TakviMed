const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const NOSYAPI_KEY = defineSecret("NOSYAPI_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";

// Gemini "high demand" (503) gibi gecici hatalarda otomatik yeniden deneme.
const MAX_GEMINI_ATTEMPTS = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryDelayMs = (attempt) => 700 * 2 ** (attempt - 1) + Math.random() * 300;

const MAX_MESSAGE_CHARS = 500;
const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SCAN_HOURLY_LIMIT = 10;
const SCAN_DAILY_LIMIT = 30;

exports.chatWithGemini = onCall(
  { secrets: [GEMINI_API_KEY], timeoutSeconds: 30, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Asistanı kullanmak için giriş yapmalısınız.");
    }
    const uid = request.auth.uid;

    const { message, medicineName, medicines } = request.data || {};
    if (typeof message !== "string" || !message.trim()) {
      throw new HttpsError("invalid-argument", "Mesaj boş olamaz.");
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      throw new HttpsError("invalid-argument", `Mesaj en fazla ${MAX_MESSAGE_CHARS} karakter olabilir.`);
    }

    await enforceRateLimit(uid);

    const reply = await callGemini({
      apiKey: GEMINI_API_KEY.value(),
      message: message.trim(),
      medicineName: typeof medicineName === "string" ? medicineName.slice(0, 100) : "",
      medicines: Array.isArray(medicines) ? medicines.slice(0, 30).map((m) => String(m).slice(0, 60)) : [],
    });

    return { reply, model: GEMINI_MODEL };
  },
);

exports.scanPrescription = onCall(
  { secrets: [GEMINI_API_KEY], timeoutSeconds: 60, invoker: "public", memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Reçete taramak için giriş yapmalısınız.");
    }
    const uid = request.auth.uid;

    const { imageBase64, mimeType } = request.data || {};
    if (typeof imageBase64 !== "string" || !imageBase64) {
      throw new HttpsError("invalid-argument", "Görsel boş.");
    }
    if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
      throw new HttpsError("invalid-argument", "Görsel türü geçersiz.");
    }
    const estimatedBytes = Math.floor(imageBase64.length * 3 / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      throw new HttpsError("invalid-argument", "Görsel 5 MB sınırını aşıyor. Daha küçük bir fotoğraf deneyin.");
    }

    await enforceScanLimit(uid);

    const extracted = await scanWithGemini({
      apiKey: GEMINI_API_KEY.value(),
      imageBase64,
      mimeType,
    });

    return extracted;
  },
);

exports.onDutyPharmacies = onCall(
  { secrets: [NOSYAPI_KEY], timeoutSeconds: 20, invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Nöbetçi eczaneleri görmek için giriş yapmalısınız.");
    }

    const { latitude, longitude } = request.data || {};
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new HttpsError("invalid-argument", "Geçerli bir konum (enlem/boylam) gerekli.");
    }

    const pharmacies = await fetchOnDutyPharmacies({
      apiKey: NOSYAPI_KEY.value(),
      latitude: lat,
      longitude: lng,
    });

    return { pharmacies };
  },
);

async function fetchOnDutyPharmacies({ apiKey, latitude, longitude }) {
  const url = `https://www.nosyapi.com/apiv2/service/pharmacies-on-duty/locations?latitude=${latitude}&longitude=${longitude}`;

  let response;
  try {
    response = await fetch(url, { headers: { "X-NSYP": apiKey } });
  } catch (error) {
    logger.error("NosyAPI fetch failed", { error: error.message });
    throw new HttpsError("unavailable", "Nöbetçi eczane servisine ulaşılamadı.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("NosyAPI non-ok response", { status: response.status, body: body.slice(0, 300) });
    if (response.status === 401 || response.status === 403) {
      throw new HttpsError("internal", "Nöbetçi eczane servisi yetkilendirme hatası (API anahtarını kontrol edin).");
    }
    if (response.status === 429) {
      throw new HttpsError("resource-exhausted", "Nöbetçi eczane sorgu limiti doldu, biraz sonra tekrar deneyin.");
    }
    throw new HttpsError("internal", "Nöbetçi eczane verisi alınamadı.");
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.status !== "success" || !Array.isArray(payload.data)) {
    logger.error("NosyAPI unexpected payload", { payload });
    throw new HttpsError("internal", (payload && payload.message) || "Nöbetçi eczane verisi okunamadı.");
  }

  const pharmacies = payload.data
    .map((item) => ({
      name: String(item.pharmacyName || "").trim(),
      address: String(item.address || "").trim(),
      district: String(item.district || item.town || "").trim(),
      city: String(item.city || "").trim(),
      phone: String(item.phone || "").trim(),
      directions: String(item.directions || "").trim(),
      dutyStart: String(item.pharmacyDutyStart || "").trim(),
      dutyEnd: String(item.pharmacyDutyEnd || "").trim(),
      latitude: Number(item.latitude) || null,
      longitude: Number(item.longitude) || null,
    }))
    .filter((item) => item.name);

  if (pharmacies.length === 0 && payload.data.length > 0) {
    logger.warn("NosyAPI satır döndü ama isim ayrıştırılamadı", { sample: payload.data[0] });
  }

  return pharmacies;
}

async function scanWithGemini({ apiKey, imageBase64, mimeType }) {
  const prompt = `Bu görsel bir reçete, ilaç kutusu veya çoklu ilaç etiketi içeren bir kağıt olabilir. Görselde BİRDEN FAZLA ilaç olabilir (Türkiye'de eczanelerin verdiği reçete kağıtlarında genellikle her ilaç için ayrı bir kutucuk vardır).

GÖRSELDEKİ HER BİR İLACI ayrı ayrı çıkar ve aşağıdaki yapıda GEÇERLİ bir JSON döndür. Başka metin, açıklama veya markdown ekleme. Sadece JSON.

{
  "medications": [
    {
      "name": "İlacın ticari adı (örn. LANSOR, PARAFON, XATRAL-XL)",
      "dose": "Doz miktarı (örn. '1 kapsül', '30 mg, 1 tablet', '5 ml')",
      "foodTiming": "aç karna | tok karna | önemli değil",
      "times": ["HH:MM formatında saatler. 'Günde 1 kez akşam' ise ['20:00'], 'Günde 2 kez' ise ['08:00', '20:00'], 'Günde 3 kez' ise ['08:00', '14:00', '20:00']"],
      "duration": "Kullanım süresi, örn. '7 gün', 'reçeteye göre'",
      "expiryDate": "YYYY-MM-DD formatında SKT veya boş string",
      "notes": "Açıklamalar: 'Yemekten önce', 'Mide koruyucu', '1 bardak suyla' gibi uyarılar"
    }
  ]
}

Kurallar:
- Her ilaç kutucuğunu/etiketini AYRI bir nesne olarak ekle.
- Görselde hiç ilaç yoksa medications boş dizi olsun: { "medications": [] }
- "Günde 1 kez akşam" → times: ["20:00"], notes'a "akşam" ekle
- "Günde 1 kez sabah" → times: ["08:00"]
- "Günde 1 kez yatmadan önce" → times: ["22:00"]
- "Aç karna" geçiyorsa foodTiming: "aç karna"
- "Yemekten sonra" / "tok karna" geçiyorsa foodTiming: "tok karna"
- Belirsizse foodTiming: "önemli değil"`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    logger.error("Gemini fetch failed", { error: error.message });
    throw new HttpsError("unavailable", `Gemini servisine ulaşılamadı: ${error.message}`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = data?.error?.message || `HTTP ${response.status}`;
    logger.error("Gemini returned non-ok", { status: response.status, reason, body: data });
    if (response.status === 429) throw new HttpsError("resource-exhausted", "Gemini servisi meşgul.");
    if (response.status === 400) throw new HttpsError("invalid-argument", `Gemini reddetti: ${reason}`);
    throw new HttpsError("internal", `Gemini hatası: ${reason}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("").trim();
  if (!text) {
    logger.error("Gemini empty response", { candidates: data?.candidates, promptFeedback: data?.promptFeedback });
    throw new HttpsError("internal", "Gemini boş yanıt döndü.");
  }
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    logger.error("Gemini did not finish", { finishReason: candidate.finishReason, textLength: text.length });
    if (candidate.finishReason === "MAX_TOKENS") {
      throw new HttpsError("resource-exhausted", "Reçetede çok fazla ilaç var, hepsini tek seferde okuyamadık. Reçeteyi parçalara bölüp tekrar deneyin.");
    }
    if (candidate.finishReason === "SAFETY") {
      throw new HttpsError("invalid-argument", "Görsel güvenlik filtresine takıldı. Farklı bir fotoğraf deneyin.");
    }
    throw new HttpsError("internal", `Gemini yanıtı tamamlanamadı: ${candidate.finishReason}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    logger.error("Gemini JSON parse failed", { text: text.slice(0, 500), error: error.message });
    throw new HttpsError("internal", "Yanıt JSON olarak okunamadı.");
  }

  const rawList = Array.isArray(parsed?.medications) ? parsed.medications : [];
  const medications = rawList
    .map((med) => sanitizeMedication(med))
    .filter((med) => med.name);

  if (medications.length === 0) {
    throw new HttpsError("not-found", "Görselde ilaç tespit edilemedi. Daha net bir fotoğraf deneyin.");
  }

  return { medications };
}

function sanitizeMedication(med) {
  if (!med || typeof med !== "object") return { name: "" };
  return {
    name: String(med.name || "").trim(),
    dose: String(med.dose || "").trim(),
    foodTiming: ["aç karna", "tok karna", "önemli değil"].includes(med.foodTiming) ? med.foodTiming : "önemli değil",
    times: Array.isArray(med.times) ? med.times.filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)) : [],
    duration: String(med.duration || "").trim(),
    expiryDate: typeof med.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(med.expiryDate) ? med.expiryDate : "",
    notes: String(med.notes || "").trim(),
  };
}

async function enforceScanLimit(uid) {
  const db = admin.firestore();
  const now = Date.now();
  const hourKey = Math.floor(now / 3_600_000);
  const dayKey = Math.floor(now / 86_400_000);
  const ref = db.collection("usage").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const hourly = data.scanHourKey === hourKey ? (data.scanHourlyCount || 0) : 0;
    const daily = data.scanDayKey === dayKey ? (data.scanDailyCount || 0) : 0;

    if (hourly >= SCAN_HOURLY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Saatlik tarama limitine ulaştınız.");
    }
    if (daily >= SCAN_DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Günlük tarama limitine ulaştınız.");
    }

    tx.set(ref, {
      scanHourKey: hourKey,
      scanDayKey: dayKey,
      scanHourlyCount: hourly + 1,
      scanDailyCount: daily + 1,
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function enforceRateLimit(uid) {
  const db = admin.firestore();
  const now = Date.now();
  const hourKey = Math.floor(now / 3_600_000);
  const dayKey = Math.floor(now / 86_400_000);
  const ref = db.collection("usage").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const hourly = data.hourKey === hourKey ? (data.hourlyCount || 0) : 0;
    const daily = data.dayKey === dayKey ? (data.dailyCount || 0) : 0;

    if (hourly >= HOURLY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Saatlik soru limitine ulaştınız. Bir saat sonra tekrar deneyin.");
    }
    if (daily >= DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Günlük soru limitine ulaştınız. Yarın tekrar deneyin.");
    }

    tx.set(ref, {
      hourKey,
      dayKey,
      hourlyCount: hourly + 1,
      dailyCount: daily + 1,
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

async function callGemini({ apiKey, message, medicineName, medicines }) {
  const contextLine = medicines.length
    ? `Kullanıcının kayıtlı ilaçları: ${medicines.join(", ")}.`
    : "Kullanıcının kayıtlı ilacı yok.";
  const focus = medicineName ? `Soru bu ilaç hakkında: ${medicineName}.` : "Genel bir soru.";
  const systemInstruction = [
    "Sen TakviMed adlı bir Türk ilaç takip uygulamasının yardımcı asistanısın.",
    "Yanıtlarını her zaman Türkçe ver. Kısa, anlaşılır ve net ol (3-5 cümle).",
    "GÖREV ALANIN: Yalnızca sağlık, ilaçlar, takviyeler, hastalıklar, tedaviler, belirtiler, beslenme ve TakviMed uygulamasının kullanımı ile ilgili soruları yanıtla.",
    "Bu alanın DIŞINDAKİ hiçbir soruya cevap verme (örn. matematik, fizik, tarih, coğrafya, kodlama, genel kültür, güncel olaylar, eğlence, kişisel görüş veya sohbet). Kullanıcı ısrar etse veya konuyu zorla sağlıkla ilişkilendirmeye çalışsa bile konu dışına çıkma.",
    "Konu dışı bir soru gelirse SADECE şu cümleyle yanıt ver ve başka hiçbir bilgi ekleme: \"Üzgünüm, ben yalnızca sağlık ve ilaçlarınızla ilgili sorularda yardımcı olabilirim.\"",
    "Sağlık tavsiyesi vermek yerine bilgilendirme yap. Doz değişikliği ÖNERME.",
    "Şüpheli/acil durumlarda doktor veya eczacıya yönlendir.",
    contextLine,
    focus,
  ].join(" ");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const requestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  };

  // 503/500/429 (sunucu mesgul) veya ag hatasi gelirse bekleyip tekrar dene.
  let response;
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(url, requestInit);
    } catch (networkError) {
      if (attempt >= MAX_GEMINI_ATTEMPTS) {
        throw new HttpsError("unavailable", `Gemini servisine ulaşılamadı: ${networkError.message}`);
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
    if (response.status === 429 || response.status === 503 || response.status === 500) {
      throw new HttpsError("resource-exhausted", "Gemini servisi şu an çok yoğun. Lütfen biraz sonra tekrar deneyin.");
    }
    throw new HttpsError("internal", `Gemini hatası: ${reason}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n").trim();
  if (!text) throw new HttpsError("internal", "Gemini boş yanıt döndü.");
  return text;
}
