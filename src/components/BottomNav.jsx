import NavIcon from "./NavIcon";

const items = [
  { id: "calendar", label: "Takvim" },
  { id: "scan", label: "Tara / Ekle" },
  { id: "medicines", label: "İlaçlarım" },
  { id: "family", label: "Aile" },
  { id: "summary", label: "Özet" },
];

export default function BottomNav({ activeView, onChange }) {
  const activeIndex = items.findIndex((item) => item.id === activeView);

  return (
    <nav className="bottom-nav" aria-label="Alt gezinme">
      {activeIndex >= 0 ? (
        <span className="nav-indicator" style={{ transform: `translateX(${activeIndex * 100}%)` }} />
      ) : null}
      {items.map((item) => (
        <button
          className={`nav-item ${activeView === item.id ? "active" : ""}`}
          key={item.id}
          type="button"
          data-tut={item.id}
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
