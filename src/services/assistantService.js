export const ASSISTANT_SYSTEM_PROMPT = `Sen TakviMed adlı bir ilaç ve takviye hatırlatma uygulamasının sağlık asistanısın.

KAPSAM (yalnızca şunlara cevap ver):
- Kullanıcının kayıtlı ilaçları, etken maddeleri ya da takviyeleri hakkında genel bilgi (ne için kullanılır, kullanım zamanı, yaygın yan etkiler, depolama)
- Aç/tok kullanım, sıklık, etiket bilgisi
- İlaç-ilaç veya ilaç-takviye etkileşimleri hakkında genel uyarı ve eczacıya yönlendirme
- TakviMed uygulamasının nasıl kullanılacağı (hatırlatma, aile takip, eczane bul gibi özellikler)
- Sağlık personeline başvurmayı gerektiren belirti uyarıları

KAPSAM DIŞI — REDDET:
İlaç ve sağlık konuları dışındaki her şey (matematik, kod, hava durumu, genel sohbet, oyun, kişisel tavsiye, finans, vs.) için kibarca şu cevabı ver ve KONUYA GİRME:
"Üzgünüm, yalnızca TakviMed uygulamanızdaki ilaç ve sağlık konularına yardımcı olabiliyorum. Bu konuda yardımcı olamam."

KESİNLİKLE YAPMA (App Store ve etik kurallar):
- Tanı (teşhis) koymak — "X hastalığınız var", "Y nedenle olabilir" gibi cümleler kurma. Bunun yerine "Bu belirtinin nedeni için doktorunuza danışmanız gerekir" de.
- Doz önermek, doz değişikliği önermek, ilaç başlatma veya durdurma tavsiyesi vermek
- Reçete yazmak veya hangi ilacı kullanması gerektiğini söylemek
- Belirli bir hastalık için "şunu kullanın" tarzı kesin tavsiye vermek
- Acil durumlarda kendi kendine müdahale önermek — daima "Acilse 112'yi arayın veya acile başvurun" de

HER YANITTA:
- Türkçe, sade, kısa ve net dilde cevap ver (3-5 cümleyi geç me)
- Sağlık personeline danışma yönergesini ekle ("doktor/eczacınıza danışın")
- Emin değilsen veya bilgin yoksa açıkça "Bu konuda kesin bilgi veremem, eczacınıza danışın" de — uydurma
- Yanıtın sonunda kısa bir disclaimer ekle: "Bu bilgi yalnızca bilgilendirme amaçlıdır, tanı veya tedavi yerine geçmez."`;

export async function sendAssistantMessage({ message, medicineName, userContext }) {
  const payload = {
    message,
    medicineName: medicineName || "",
    userContext: userContext || {},
    systemInstruction: ASSISTANT_SYSTEM_PROMPT,
  };

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error("Asistan şu anda yanıt veremiyor.");
  } catch (error) {
    if (!["Failed to fetch", "Asistan şu anda yanıt veremiyor."].includes(error.message)) throw error;
  }

  return {
    reply: buildLocalAssistantReply(payload),
    source: "local-dev-fallback",
  };
}

function buildLocalAssistantReply({ message, medicineName, userContext }) {
  const med = medicineName || "seçili ilaç";
  const lower = message.toLocaleLowerCase("tr-TR");
  const prefix = "Geliştirme modunda backend bağlı değil; bu yanıt genel bilgilendirme amaçlıdır. ";

  const medicalKeywords = ["ilaç", "ilac", "doz", "yan etki", "tok", "aç", "etkileş", "doktor", "eczac", "reçete", "rece", "takvi", "kullan", "saat", "uyku", "ağrı", "agri", "alerj", "vitamin", "takvi", "antibiy"];
  const looksMedical = medicalKeywords.some((k) => lower.includes(k));
  if (!looksMedical) {
    return "Üzgünüm, yalnızca TakviMed uygulamanızdaki ilaç ve sağlık konularına yardımcı olabiliyorum. Bu konuda yardımcı olamam.";
  }

  if (lower.includes("yan etki")) {
    return `${prefix}${med} için yan etkiler kişiye ve etken maddeye göre değişir. Uyku hali, mide rahatsızlığı, döküntü veya beklenmeyen bir belirti olursa doktorunuza ya da eczacınıza danışın.`;
  }
  if (lower.includes("tok") || lower.includes("aç")) {
    return `${prefix}${med} için aç/tok kullanımı reçete etiketine göre belirlenmelidir. TakviMed'deki ilaç kaydınızda kullanım bilgisini not alanına ekleyebilirsiniz.`;
  }
  if (lower.includes("etkileş")) {
    const names = userContext?.medicines?.join(", ") || "kayıtlı ilaçlarınız";
    return `${prefix}Etkileşim kontrolü için tüm ilaçlarınızı ve takviyelerinizi eczacınıza gösterin. TakviMed'de görünen kayıtlar: ${names}.`;
  }
  if (lower.includes("doktor")) {
    return `${prefix}Nefes darlığı, şiddetli alerji, bayılma, kanama, göğüs ağrısı veya belirtilerde kötüleşme olursa gecikmeden sağlık kuruluşuna başvurun.`;
  }
  return `${prefix}${med} hakkında güvenilir yanıt verebilmem için backend'de /api/chat endpoint'i Gemini anahtarıyla bağlanmalı. Şimdilik doz değişikliği yapmadan doktor/eczacı önerisini esas alın.`;
}
