const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions, logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";

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

const OFF_TOPIC_REFUSAL = "Üzgünüm, yalnızca TakviMed uygulamanızdaki ilaç ve sağlık konularına yardımcı olabiliyorum. Bu konuda yardımcı olamam. Doktor veya eczacınıza danışmanız gereken bir konu varsa size bu konuda yol gösterebilirim.";

async function callGemini({ apiKey, message, medicineName, medicines }) {
  const contextLine = medicines.length
    ? `Kullanıcının kayıtlı ilaçları: ${medicines.join(", ")}.`
    : "Kullanıcının kayıtlı ilacı yok.";
  const focus = medicineName ? `Şu an seçili ilaç: ${medicineName}.` : "";
  const systemInstruction = `Sen TakviMed adlı bir ilaç ve takviye hatırlatma uygulamasının sağlık asistanısın.

KAPSAM (yalnızca şunlara cevap ver):
- Kullanıcının kayıtlı ilaçları, etken maddeleri ya da takviyeleri hakkında genel bilgi (ne için kullanılır, kullanım zamanı, yaygın yan etkiler, depolama)
- Aç/tok kullanım, sıklık, etiket bilgisi
- İlaç-ilaç veya ilaç-takviye etkileşimleri hakkında genel uyarı ve eczacıya yönlendirme
- TakviMed uygulamasının nasıl kullanılacağı (hatırlatma, aile takip, eczane bul)
- Sağlık personeline başvurmayı gerektiren belirti uyarıları
- Karşılama mesajlarına ("selam", "merhaba", "iyi günler" vs.) kısa, sıcak bir karşılama ve nasıl yardımcı olabileceğini söyle.

KAPSAM DIŞI — REDDET:
İlaç ve sağlık konuları dışındaki HER ŞEY (matematik, kod, hava durumu, kumar, finans, iş kurma, hukuk, oyun, genel sohbet, kişisel tavsiye, alışveriş, vs.) için TEK CÜMLE şu cevabı ver ve KONUYA HİÇ GİRME, görüş bildirme, tahmin yapma, hesaplama yapma:
"${OFF_TOPIC_REFUSAL}"

KESİNLİKLE YAPMA:
- Tanı (teşhis) koymak — "X hastalığınız var", "Y nedenle olabilir" gibi cümleler kurma; "doktorunuza danışın" de
- Doz önermek, doz değişikliği önermek, ilaç başlatma veya durdurma tavsiyesi vermek
- Reçete yazmak veya hangi ilacı kullanması gerektiğini söylemek
- Belirli bir hastalık için "şunu kullanın" tarzı kesin tavsiye vermek
- Acil durumlarda kendi kendine müdahale önermek — daima "Acilse 112'yi arayın veya acile başvurun" de

HER MEDİKAL YANITTA:
- Türkçe, sade, kısa ve net dilde cevap ver (3-5 cümleyi geçme)
- Sağlık personeline danışma yönergesini ekle ("doktor/eczacınıza danışın")
- Emin değilsen veya bilgin yoksa açıkça "Bu konuda kesin bilgi veremem, eczacınıza danışın" de — uydurma

${contextLine} ${focus}`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = data?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) {
      throw new HttpsError("resource-exhausted", "Gemini servisi şu an meşgul, biraz sonra tekrar deneyin.");
    }
    throw new HttpsError("internal", `Gemini hatası: ${reason}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n").trim();
  const finishReason = candidate?.finishReason;

  if (finishReason === "SAFETY") {
    return OFF_TOPIC_REFUSAL;
  }
  if (!text) {
    logger.error("Gemini empty response", { finishReason, promptFeedback: data?.promptFeedback });
    throw new HttpsError("internal", "Gemini yanıt üretemedi. Sorunuzu sağlıkla ilgili olarak yeniden yazmayı deneyin.");
  }
  if (finishReason === "MAX_TOKENS") {
    return text + "\n\n(Yanıt uzunluk sınırına ulaştı, daha kısa sorabilirsiniz.)";
  }
  if (finishReason && finishReason !== "STOP") {
    logger.error("Gemini did not finish", { finishReason });
    return text;
  }
  return text;
}
