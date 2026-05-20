import { useEffect, useState } from "react";
import Mascot from "./Mascot";

// Adımlar — inDrawer:false alt menüde, inDrawer:true ☰ burger menüde tanıtılır.
const STEPS = [
  {
    view: "calendar",
    inDrawer: false,
    title: "Takvim",
    speech: "Günlük ilaçların burada! 📅",
    desc: "Bugün almanız gereken ilaçları takvimde görürsünüz. İlacı aldıkça işaretleyin; uyum oranınız kendiliğinden hesaplanır.",
    hint: "Takvimde her günün rengi o günkü ilaç durumunu gösterir.",
  },
  {
    view: "scan",
    inDrawer: false,
    title: "Tara / Ekle",
    speech: "İlaç eklemek çok kolay 📸",
    desc: "İlaç kutunuzu veya reçetenizi fotoğraflayın; yapay zeka bilgileri otomatik doldurur. İsterseniz elle de ekleyebilirsiniz.",
    hint: "Net bir fotoğraf daha doğru sonuç verir.",
  },
  {
    view: "medicines",
    inDrawer: false,
    title: "İlaçlarım",
    speech: "Tüm ilaçların tek yerde 💊",
    desc: "Eklediğiniz ilaçları buradan görüntüler, düzenler veya arşivlersiniz. Stok ve son kullanma tarihi takibi de burada.",
    hint: "Süresi yaklaşan ilaçlar için otomatik uyarı alırsınız.",
  },
  {
    view: "family",
    inDrawer: false,
    title: "Aile Takip",
    speech: "Sevdiklerini de takip et 👨‍👩‍👧",
    desc: "Paylaşım kodunuzla yakınlarınıza bağlanın. Onların ilaç takibini görebilir, hatırlatma gönderebilirsiniz.",
    hint: "Onayınız olmadan kimse verilerinizi göremez.",
  },
  {
    view: "summary",
    inDrawer: false,
    title: "Özet",
    speech: "İlerlemen hep gözünün önünde 📊",
    desc: "Haftalık ve aylık ilaç uyum oranınızı, grafiklerle ve istatistiklerle buradan takip edersiniz.",
    hint: "Düzenli kullanım uyum oranınızı yükseltir.",
  },
  {
    view: "assistant",
    inDrawer: true,
    title: "Asistan",
    speech: "Sağlık sorularını bana sor 💬",
    desc: "İlaçların hakkında merak ettiklerini Asistan'a sorabilirsin. Buraya ☰ menüden ya da köşedeki maskota dokunarak ulaşırsın.",
    hint: "Asistan yalnızca sağlık ve ilaç konularında yardımcı olur.",
  },
  {
    view: "pharmacy",
    inDrawer: true,
    title: "Eczane",
    speech: "En yakın nöbetçi eczane 🏥",
    desc: "Konumuna en yakın nöbetçi eczaneleri ve çevredeki eczaneleri haritada gösterir. Buraya ☰ menüden ulaşırsın.",
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

export default function Tutorial({ open, onNavigate, onDrawer, onClose }) {
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

  // Her adımda ekranı hazırla ve spotlight/maskot/kartı konumlandır.
  useEffect(() => {
    if (!open) return undefined;

    const stepDef = step >= 0 && step < STEPS.length ? STEPS[step] : null;
    if (stepDef) {
      if (stepDef.inDrawer) {
        onDrawer(true); // Asistan/Eczane adımları için burger menüyü aç
      } else {
        onDrawer(false);
        onNavigate(stepDef.view);
      }
    } else {
      onDrawer(false);
    }

    function position() {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      if (!stepDef) {
        setSpotlight(null);
        setMascotPos({ left: Math.round(sw / 2 - FLOAT_WIDTH / 2), top: Math.round(sh * 0.18) });
        setCardTop(Math.round(sh * 0.44));
        return;
      }
      const selector = stepDef.inDrawer
        ? `.side-drawer [data-tut="${stepDef.view}"]`
        : `.bottom-nav [data-tut="${stepDef.view}"]`;
      const el = document.querySelector(selector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pad = 7;
      setSpotlight({
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
      if (stepDef.inDrawer) {
        // Çekmece solda açık; maskot sağ tarafta dursun.
        setMascotPos({
          left: Math.max(8, sw - FLOAT_WIDTH - 12),
          top: Math.max(140, Math.min(sh - 240, Math.round(rect.top - 70))),
        });
      } else {
        const center = step % 2 === 1 ? sw * 0.6 : sw * 0.4;
        setMascotPos({
          left: Math.max(8, Math.min(sw - FLOAT_WIDTH - 8, Math.round(center - FLOAT_WIDTH / 2))),
          top: Math.max(132, Math.round(rect.top - 246)),
        });
      }
      setCardTop(16);
    }

    const delay = stepDef && stepDef.inDrawer ? 400 : 70;
    const timer = window.setTimeout(position, delay);
    window.addEventListener("resize", position);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", position);
    };
  }, [step, open, onNavigate, onDrawer]);

  if (!open) return null;

  const isIntro = step < 0;
  const isFinish = step >= STEPS.length;
  const current = !isIntro && !isFinish ? STEPS[step] : null;
  const speech = isIntro
    ? "Merhaba! Ben Takvi 📅"
    : isFinish
      ? "Köşede seni bekliyorum! 💬"
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
            <p>Artık her şeyi bana sorabilirsin — sağlık, ilaçların, hatta nöbetçi eczaneler. Sağ üst köşedeki butondan bana ulaş!</p>
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
