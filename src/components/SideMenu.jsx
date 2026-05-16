import NavIcon from "./NavIcon";

export default function SideMenu({ open, profile, activeView, onClose, onNavigate, onCopyCode, onLogout, onToggleDark, darkMode }) {
  const items = [
    { id: "calendar", label: "Takvim" },
    { id: "scan", label: "Tara / Ekle" },
    { id: "medicines", label: "İlaçlarım" },
    { id: "family", label: "Aile Takip" },
    { id: "summary", label: "Özet" },
    { id: "assistant", label: "Asistan" },
    { id: "pharmacy", label: "Eczane" },
  ];

  return (
    <div className={`drawer-layer ${open ? "open" : ""}`} onMouseDown={onClose}>
      <aside className="side-drawer" onMouseDown={(event) => event.stopPropagation()} aria-hidden={!open}>
        <div className="drawer-profile">
          <div className="avatar-circle">{(profile?.name || "T").slice(0, 1).toUpperCase()}</div>
          <strong>{profile?.name || "TakviMed Kullanıcısı"}</strong>
          <span>Kod: {profile?.code}</span>
        </div>
        <div className="drawer-list">
          {items.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              type="button"
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <i><NavIcon id={item.id} /></i>
              {item.label}
            </button>
          ))}
        </div>
        <div className="drawer-list muted">
          <button type="button" onClick={() => { onNavigate("settings"); onClose(); }}>
            <i><NavIcon id="settings" /></i>
            Ayarlar
          </button>
          <button type="button" onClick={onCopyCode}>
            <i><NavIcon id="copy" /></i>
            Kodumu Kopyala
          </button>
          <button type="button" onClick={onToggleDark}>
            <i><NavIcon id={darkMode ? "light" : "dark"} /></i>
            {darkMode ? "Aydınlık Mod" : "Karanlık Mod"}
          </button>
          <button className="logout" type="button" onClick={onLogout}>
            <i><NavIcon id="logout" /></i>
            Çıkış Yap
          </button>
        </div>
      </aside>
    </div>
  );
}
