import { useEffect, useState } from "react";
import Mascot from "./Mascot";

// Adımlar — alt menü sırasına göre (navIndex, .nav-item dizini).
const STEPS = [
  {
    view: "calendar",
    navIndex: 0,
    title: "Takvim",
    speech: "Günlük ilaçların burada! 📅",
    desc: "Bugün almanız gereken ilaçları takvimde görürsünüz. İlacı aldıkça işaretleyin; uyum oranınız kendiliğinden hesaplanır.",
    hint: "Takvimde her günün rengi o günkü ilaç durumunu gösterir.",
  },
  {
    view: "scan",
    navIndex: 1,
    title: "Tara / Ekle",
    speech: "İlaç eklemek çok kolay 📸",
    desc: "İlaç kutunuzu veya reçetenizi fotoğraflayın; yapay zeka bilgileri otomatik doldurur. İsterseniz elle de ekleyebilirsiniz.",
    hint: "Net bir fotoğraf daha doğru sonuç verir.",
  },
  {
    view: "medicines",
    navIndex: 2,
    title: "İlaçlarım",
    speech: "Tüm ilaçların tek yerde 💊",
    desc: "Eklediğiniz ilaçları buradan görüntüler, düzenler veya arşivlersiniz. Stok ve son kullanma tarihi takibi de burada.",
    hint: "Süresi yaklaşan ilaçlar için otomatik uyarı alırsınız.",
  },
  {
    view: "family",
    navIndex: 3,
    title: "Aile Takip",
    speech: "Sevdiklerini de takip et 👨‍👩‍👧",
    desc: "Paylaşım kodunuzla yakınlarınıza bağlanın. Onların ilaç takibini görebilir, hatırlatma gönderebilirsiniz.",
    hint: "Onayınız olmadan kimse verilerinizi göremez.",
  },
  {
    view: "summary",
    navIndex: 4,
    title: "Özet",
    speech: "İlerlemen hep gözünün önünde 📊",
    desc: "Haftalık ve aylık ilaç uyum oranınızı, grafiklerle ve istatistiklerle buradan takip edersiniz.",
    hint: "Düzenli kullanım uyum oranınızı yükseltir.",
  },
  {
    view: "assistant",
    navIndex: 5,
    title: "Asistan",
    speech: "Sağlık sorularını bana sor 💬",
    desc: "İlaçlarınız hakkında merak ettiklerinizi yapay zeka asistana sorabilirsiniz; size anlaşılır yanıtlar verir.",
    hint: "Asistan yalnızca sağlık ve ilaç konularında yardımcı olur.",
  },
  {
    view: "pharmacy",
    navIndex: 6,
    title: "Eczane",
    speech: "En yakın nöbetçi eczane 🏥",
    desc: "Konumunuza en yakın nöbetçi eczaneleri ve çevredeki eczaneleri haritada görürsünüz.",
    hint: "Nöbetçi eczane listesi günde bir kez güncellenir.",
  },
];

const FLOAT_WIDTH = 220;

function Confetti() {
  const colors = ["#1E88C8", "#3d8b5e", "#e07b2a", "#6b4fa0", "#f59e0b", "#ef4444", "#10b981"];
  return (
    <div className="tut-confetti" aria-hidden="true">
      {Array.from({ length: 60 }, (_, index) => {
        const size = 6 + Math.random() * 8;
        return (
          <span
            key={index}
            style={{
              left: `${Math.random() * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: colors[index % colors.length],
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${1 + Math.random() * 0.9}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Tutorial({ open, onNavigate, onClose }) {
  const [step, setStep] = useState(-1); // -1 giriş · 0..6 adımlar · 7 final
  const [spotlight, setSpotlight] = useState(null);
  const [mascotPos, setMascotPos] = useState({ left: 0, top: 0 });
  const [cardTop, setCardTop] = useState(0);

  // Açılınca giriş adımına dön.
  useEffect(() => {
    if (open) {
      setStep(-1);
      setSpotlight(null);
    }
  }, [open]);

  // Her adımda konumlandırma — spotlight, maskot, kart.
  useEffect(() => {
    if (!open) return undefined;

    function position() {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      if (step < 0 || step >= STEPS.length) {
        setSpotlight(null);
        setMascotPos({ left: Math.round(sw / 2 - FLOAT_WIDTH / 2), top: Math.round(sh * 0.18) });
        setCardTop(Math.round(sh * 0.44));
        return;
      }
      const navItems = document.querySelectorAll(".nav-item");
      const el = navItems[STEPS[step].navIndex];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pad = 7;
      setSpotlight({
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
      const center = step % 2 === 1 ? sw * 0.6 : sw * 0.4;
      setMascotPos({
        left: Math.max(8, Math.min(sw - FLOAT_WIDTH - 8, Math.round(center - FLOAT_WIDTH / 2))),
        top: Math.max(132, Math.round(rect.top - 246)),
      });
      setCardTop(16);
    }

    if (step >= 0 && step < STEPS.length) onNavigate(STEPS[step].view);
    const timer = window.setTimeout(position, 60);
    window.addEventListener("resize", position);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", position);
    };
  }, [step, open, onNavigate]);

  if (!open) return null;

  const isIntro = step < 0;
  const isFinish = step >= STEPS.length;
  const current = !isIntro && !isFinish ? STEPS[step] : null;
  const speech = isIntro
    ? "Merhaba! Ben Takvi 📅"
    : isFinish
      ? "Hadi başlayalım! 🎉"
      : current.speech;

  return (
    <div className="tut-root">
      {isIntro || isFinish ? <div className="tut-overlay" /> : null}
      {spotlight ? (
        <div
          className="tut-spotlight"
          style={{
            left: `${spotlight.left}px`,
            top: `${spotlight.top}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
          }}
        />
      ) : null}

      <div className="tut-mascot-float" style={{ left: `${mascotPos.left}px`, top: `${mascotPos.top}px` }}>
        <div className="tut-speech" key={step}>{speech}</div>
        <Mascot />
      </div>

      <div className="tut-card" style={{ top: `${cardTop}px` }}>
        {current ? (
          <div className="tut-dots">
            {STEPS.map((item, index) => (
              <span key={item.view} className={`tut-dot ${index === step ? "active" : ""}`} />
            ))}
          </div>
        ) : null}

        {isIntro ? (
          <>
            <h2>TakviMed'e Hoş Geldin! 👋</h2>
            <p>Uygulamayı kısaca tanıtmamı ister misin? Sadece birkaç adım sürer.</p>
            <div className="tut-actions">
              <button className="tut-btn" type="button" onClick={() => setStep(0)}>Evet, anlat! 📅</button>
              <button className="tut-btn ghost" type="button" onClick={onClose}>Şimdi değil</button>
            </div>
          </>
        ) : isFinish ? (
          <>
            <h2>🎉 Hazırsın!</h2>
            <p>Her şey hazır. İlk ilacını ekleyerek başlayabilirsin. Sağlıklı günler dileriz!</p>
            <div className="tut-actions">
              <button className="tut-btn" type="button" onClick={onClose}>Başla! 🚀</button>
            </div>
          </>
        ) : (
          <>
            <h2>{current.title}</h2>
            <p>{current.desc}</p>
            <div className="tut-hint">
              <span className="tut-hint-icon">💡</span>
              <span>{current.hint}</span>
            </div>
            <div className="tut-actions">
              <button className="tut-btn" type="button" onClick={() => setStep(step + 1)}>
                {step === STEPS.length - 1 ? "Harika! 🎉" : "Anladım →"}
              </button>
              <button className="tut-skip" type="button" onClick={onClose}>Turu geç</button>
            </div>
          </>
        )}
      </div>

      {isFinish ? <Confetti /> : null}
    </div>
  );
}
