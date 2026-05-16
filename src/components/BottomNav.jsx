import NavIcon from "./NavIcon";

const items = [
  { id: "calendar", label: "Takvim" },
  { id: "scan", label: "Tara / Ekle" },
  { id: "medicines", label: "İlaçlarım" },
  { id: "family", label: "Aile" },
  { id: "summary", label: "Özet" },
  { id: "assistant", label: "Asistan" },
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
