const items = [
  { id: "calendar", label: "Takvim" },
  { id: "scan", label: "Tara / Ekle" },
  { id: "medicines", label: "İlaçlarım" },
  { id: "family", label: "Aile" },
  { id: "summary", label: "Özet" },
  { id: "pharmacy", label: "Eczane" },
];

export default function BottomNav({ activeView, onChange }) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeView));

  return (
    <nav className="bottom-nav" aria-label="Alt gezinme">
      <span className="nav-indicator" style={{ transform: `translateX(${activeIndex * 100}%)` }} />
      {items.map((item) => (
        <button
          className={`nav-item ${activeView === item.id ? "active" : ""}`}
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-current={activeView === item.id ? "page" : undefined}
        >
          <span className="nav-icon"><NavIcon id={item.id} /></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function NavIcon({ id }) {
  if (id === "calendar") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <rect x="5" y="7" width="18" height="16" rx="4" />
        <path d="M9 5v5M19 5v5M5 12h18M10 17h.1M14 17h.1M18 17h.1" />
      </svg>
    );
  }
  if (id === "scan") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M7 11V8a1 1 0 0 1 1-1h3M17 7h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M11 21H8a1 1 0 0 1-1-1v-3M14 10v8M10 14h8" />
      </svg>
    );
  }
  if (id === "medicines") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <rect x="9" y="4" width="10" height="20" rx="5" />
        <path d="M9 14h10" />
      </svg>
    );
  }
  if (id === "family") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="11" cy="10" r="3" />
        <circle cx="18.5" cy="9" r="2.5" />
        <path d="M5.5 22c.8-4 2.8-6 5.5-6s4.7 2 5.5 6M15.5 16.5c2.7.2 4.5 2 5 5.5" />
      </svg>
    );
  }
  if (id === "summary") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M6 8h10M6 14h13M6 20h8" />
        <circle cx="20" cy="20" r="4" />
        <path d="m18.5 20 1 1 2-2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M6 23V10l8-5 8 5v13H6Z" />
      <path d="M14 10v8M10 14h8M11 23v-4h6v4" />
    </svg>
  );
}
