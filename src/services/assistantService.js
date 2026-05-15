export async function sendAssistantMessage({ message, medicineName, userContext }) {
  const payload = {
    message,
    medicineName: medicineName || "",
    userContext: userContext || {},
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
