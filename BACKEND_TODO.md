# Backend Yapılacaklar (Arkadaş için)

Frontend'in çağırdığı ama henüz var olmayan iki endpoint var. Aşağıdakileri Cloud Function (veya başka bir backend) olarak yazın.

## 1. `POST /api/chat` — Gemini asistan endpoint'i

### Frontend'in gönderdiği request

```json
{
  "message": "Aspirin'i tok mu aç mı almalıyım?",
  "medicineName": "Aspirin 500mg",
  "userContext": {
    "medicationCount": 4,
    "medicines": ["Aspirin 500mg", "Concor", "Glucophage", "Omega-3"]
  },
  "systemInstruction": "Sen TakviMed adlı bir ilaç..." 
}
```

`systemInstruction` alanı **çok önemli** — bu alan, Gemini'nin çağrısında `systemInstruction` parametresine birebir aktarılmalı. İçinde:
- Asistanın yalnızca ilaç/sağlık konularında yanıt vermesini
- Tanı koymamasını
- Doz değişikliği önermemesini
- App Store/etik kurallarını ihlal eden konulara girmemesini

söyleyen detaylı kurallar var. Tam metin için: `src/services/assistantService.js` → `ASSISTANT_SYSTEM_PROMPT`.

### Frontend'in beklediği response

```json
{
  "reply": "Aspirin'i tok karnına almak mide irritasyonunu azaltır...",
  "source": "gemini-1.5-flash"
}
```

`source` alanı opsiyonel ama loglama için faydalı.

### Gemini çağrısı (Node.js örneği)

```js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function handleChat(req, res) {
  const { message, medicineName, userContext, systemInstruction } = req.body;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction, // ← frontend'den geleni birebir kullan
  });

  const userPrompt = `Aktif ilaç: ${medicineName || "-"}
Kayıtlı tüm ilaçlar: ${userContext?.medicines?.join(", ") || "-"}

Kullanıcı sorusu: ${message}`;

  const result = await model.generateContent(userPrompt);
  res.json({ reply: result.response.text(), source: "gemini-1.5-flash" });
}
```

### Önemli güvenlik notu
**Gemini API key kesinlikle backend'de tutulmalı.** Frontend'de `VITE_GEMINI_API_KEY` koyma — App Store build'inden çıkarılabilir.

---

## 2. `POST /api/scan-prescription` — Reçete OCR endpoint'i

### Frontend'in gönderdiği request

`multipart/form-data` formatında:
- `image`: dosya (jpeg/png, max ~2MB)

### Frontend'in beklediği response

```json
{
  "name": "IBURAMIN ZERO",
  "dose": "1 tablet",
  "foodTiming": "tok",
  "times": ["08:00", "20:00"],
  "duration": "7 gün",
  "stock": 14,
  "initialStock": 14,
  "expiryDate": "2027-05-12",
  "reminderMinutes": 0,
  "notes": "İlaç hakkında varsa kısa not"
}
```

Tüm alanlar opsiyonel. Frontend bulamadıkları için makul defaultlar ile gösterir.

### Gemini Vision çağrısı

```js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function handleScan(req, res) {
  const imageBuffer = req.file.buffer; // multer veya benzeri
  const base64 = imageBuffer.toString("base64");

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `Bu reçete veya ilaç kutusu fotoğrafından şu JSON yapısını çıkar:
{
  "name": "ilacın adı",
  "dose": "tek seferde alınan miktar (örn. '1 tablet')",
  "foodTiming": "tok | aç | önemli değil",
  "times": ["HH:MM" formatında alma saatleri],
  "duration": "kaç gün kullanılacağı",
  "stock": "kutuda kaç adet/doz var",
  "initialStock": "stock ile aynı",
  "expiryDate": "YYYY-MM-DD format son kullanma tarihi",
  "reminderMinutes": 0,
  "notes": "varsa önemli açıklama"
}
Bulamadığın alanları null veya boş bırak. Sadece JSON döndür.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType: "image/jpeg", data: base64 } },
  ]);

  res.json(JSON.parse(result.response.text()));
}
```

---

## 3. (Opsiyonel ama önerilir) Cloud Function ile push notification

İlaç hatırlatıcıları şu an cihazda local notification olarak çalışıyor (sesli, kilitliyken bile). Ama "aile takip" özelliğinde takipçi birine hatırlatma gönderdiğinde, karşı tarafa **anlık push notification** atmak için Cloud Function gerekli.

Mantık:
- Firestore'da `users/{uid}/reminders/{id}` create event'ini dinle
- O kullanıcının FCM token'ını al
- FCM ile push gönder

Bu olmadan da uygulama çalışır — kullanıcı aile sekmesini açtığında inbox'ta görür. Sadece anlık bildirim eksik kalır.

---

## Özet

| Endpoint | Öncelik | Notlar |
|----------|---------|--------|
| `/api/chat` | YÜKSEK | `systemInstruction`'ı birebir Gemini'ye geç, key backend'de |
| `/api/scan-prescription` | ORTA | Gemini Vision ile JSON dönsün |
| Reminder push (CF) | DÜŞÜK | Yokken aile bildirimi sadece inbox'ta görünür |
