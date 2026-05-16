export default function Header({ title, subtitle, onMenu }) {
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
    </header>
  );
}
