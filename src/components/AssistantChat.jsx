import { useMemo, useState } from "react";
import { sendAssistantMessage } from "../services/assistantService";

const quickQuestions = [
  "Bu ilaç ne için kullanılır?",
  "Yan etkileri nelerdir?",
  "Tok mu aç mı alınır?",
  "Başka ilaçlarla etkileşir mi?",
  "Ne zaman doktora danışmalıyım?",
];

const medicalDisclaimer = "Bu asistan yalnızca bilgilendirme amaçlıdır. Tanı, tedavi veya doz değişikliği için doktorunuza/eczacınıza danışın.";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function AssistantChat({ medications }) {
  const [medicineName, setMedicineName] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const userContext = useMemo(() => ({ medicationCount: medications.length, medicines: medications.map((med) => med.name) }), [medications]);

  async function submit(text = message) {
    const clean = text.trim();
    if (!clean || loading) return;
    setMessages((current) => [...current, { role: "user", text: clean }]);
    setMessage("");
    setLoading(true);
    try {
      const [data] = await Promise.all([
        sendAssistantMessage({ message: clean, medicineName, userContext }),
        wait(1400),
      ]);
      setMessages((current) => [...current, { role: "assistant", text: withDisclaimer(data.reply || data.message || "Yanıt alınamadı.") }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: withDisclaimer(error.message) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="assistant-panel">
      <p className="assistant-disclaimer">
        {medicalDisclaimer}
      </p>

      <label className="field-label compact-select">
        <span>İlaç seçimi</span>
        <select value={medicineName} onChange={(event) => setMedicineName(event.target.value)}>
          <option value="">Genel soru</option>
          {medications.map((med) => <option key={med.id} value={med.name}>{med.name}</option>)}
        </select>
      </label>

      <div className="chip-row">
        {quickQuestions.map((question) => (
          <button key={question} type="button" onClick={() => submit(question)}>
            {question}
          </button>
        ))}
      </div>

      <div className="chat-log">
        {messages.length === 0 ? <div className="empty-state compact">Sorunuzu yazın veya hızlı sorulardan birini seçin.</div> : null}
        {messages.map((item, index) => (
          <div className={`chat-bubble ${item.role}`} key={`${item.role}-${index}`}>{item.text}</div>
        ))}
        {loading ? (
          <div className="assistant-thinking-card" aria-label="Asistan yanıt hazırlıyor">
            <div className="assistant-thinking">
              <span className="thinking-calendar-frame" />
              <span className="thinking-calendar" />
              <span className="thinking-pill" />
            </div>
            <span>Yanıt hazırlanıyor</span>
          </div>
        ) : null}
      </div>

      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Asistana sorun..." />
        <button type="submit" disabled={loading || !message.trim()}>Gönder</button>
      </form>
    </section>
  );
}

function withDisclaimer(text) {
  if (text.includes(medicalDisclaimer)) return text;
  return `${text}\n\n${medicalDisclaimer}`;
}
