export default function Header({ title, subtitle, onMenu, onAssistant, onSettings }) {
  return (
    <header className="app-header">
      <button className="hamburger-button" type="button" onClick={onMenu} aria-label="Menüyü aç">
        <span />
        <span />
        <span />
      </button>
      <div className="brand-mark" aria-hidden="true">
        <img src="/icon.svg" alt="" />
      </div>
      <div className="header-copy">
        <strong>{title || "TakviMed"}</strong>
        <small>{subtitle || "İlaç ve takviye takibi"}</small>
      </div>
      <button className="icon-button assistant-header-button" type="button" onClick={onAssistant} aria-label="Asistan">
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <path d="M9 17.5c-2 0-3.5-1.5-3.5-3.5S7 10.5 9 10.5h.4C10 8 12 6.5 14.5 6.5c2.8 0 5 2.1 5.2 4.8 1.7.4 2.8 1.8 2.8 3.5 0 2-1.6 3.7-3.7 3.7H18" />
          <path d="M11 20h6M12 23h4M14 12v5M11.5 14.5h5" />
        </svg>
      </button>
      <button className="icon-button" type="button" onClick={onSettings} aria-label="Ayarlar">
        ⚙
      </button>
    </header>
  );
}
