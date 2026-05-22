import { useEffect, useRef, useState } from "react";
import Mascot from "./Mascot";

// Maskotun arada gösterdiği ipuçları — kullanıcı asistanı keşfetsin.
const HINTS = [
  "Bana bir şey sorabilirsin! 💬",
  "En yakın nöbetçi eczaneyi söyleyebilirim 🏥",
  "İlaçların hakkında merak ettiğini sor 💊",
  "Sağlıkla ilgili sorularına yardımcı olurum 🩺",
];

const DRAG_THRESHOLD = 14; // parmak dokunuşu doğal olarak birkaç piksel oynar

const FIRST_DELAY = 9000; // ilk ipucu ~9 sn sonra
const VISIBLE_MS = 6000; // ipucu ekranda ~6 sn kalır
const INTERVAL_MS = 38000; // ipuçları arası ~38 sn
const FAB_SIZE = 58;
const EDGE = 10;
const HOME_TOP = 12;

export default function MascotButton({ onClick }) {
  const [hint, setHint] = useState("");
  const [pos, setPos] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  useEffect(() => {
    let active = true;
    let index = 0;
    let nextTimer;
    let hideTimer;

    function showNext() {
      if (!active) return;
      setHint(HINTS[index % HINTS.length]);
      index += 1;
      hideTimer = window.setTimeout(() => {
        if (active) setHint("");
      }, VISIBLE_MS);
      nextTimer = window.setTimeout(showNext, INTERVAL_MS);
    }

    const firstTimer = window.setTimeout(showNext, FIRST_DELAY);
    return () => {
      active = false;
      window.clearTimeout(firstTimer);
      window.clearTimeout(nextTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  function clampPos(x, y) {
    const maxX = window.innerWidth - FAB_SIZE - EDGE;
    const maxY = window.innerHeight - FAB_SIZE - EDGE;
    return {
      x: Math.max(EDGE, Math.min(maxX, x)),
      y: Math.max(EDGE, Math.min(maxY, y)),
    };
  }

  function handlePointerDown(event) {
    setSnapping(false);
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      active: true,
      moved: false,
      sx: event.clientX,
      sy: event.clientY,
      ox: event.clientX - rect.left,
      oy: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const d = drag.current;
    if (!d.active) return;
    if (!d.moved && (Math.abs(event.clientX - d.sx) > DRAG_THRESHOLD || Math.abs(event.clientY - d.sy) > DRAG_THRESHOLD)) {
      d.moved = true;
    }
    if (d.moved) {
      setPos(clampPos(event.clientX - d.ox, event.clientY - d.oy));
    }
  }

  function handlePointerCancel() {
    drag.current.active = false;
  }

  function handlePointerUp() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (d.moved) {
      // Bırakınca sağ üst köşedeki evine yumuşakça geri dön.
      setSnapping(true);
      setPos({ x: window.innerWidth - FAB_SIZE - EDGE, y: HOME_TOP });
      window.setTimeout(() => setSnapping(false), 420);
    } else {
      // Sürüklenmedi → dokunma sayılır → asistanı aç.
      onClick();
    }
  }

  const style = pos ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto" } : undefined;

  return (
    <div className={`mascot-fab-wrap ${snapping ? "snapping" : ""}`.trim()} style={style}>
      <button
        type="button"
        className="mascot-fab"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={() => { if (!drag.current.moved) onClick(); }}
        aria-label="Asistana sor — basılı tutup sürükleyebilirsin"
      >
        <span className="mascot-fab-scale"><Mascot /></span>
      </button>
      {hint ? <div className="mascot-hint" key={hint}>{hint}</div> : null}
    </div>
  );
}
