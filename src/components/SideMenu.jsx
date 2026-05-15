export default function SideMenu({ open, profile, activeView, onClose, onNavigate, onCopyCode, onLogout, onToggleDark, darkMode }) {
  const items = [
    { id: "calendar", icon: "▦", label: "Takvim" },
    { id: "scan", icon: "◉", label: "Tara / Ekle" },
    { id: "medicines", icon: "●", label: "İlaçlarım" },
    { id: "family", icon: "👥", label: "Aile Takip" },
    { id: "summary", icon: "▥", label: "Özet" },
    { id: "pharmacy", icon: "+", label: "Eczane" },
    { id: "assistant", icon: "?", label: "Asistan" },
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
              <i>{item.icon}</i>
              {item.label}
            </button>
          ))}
        </div>
        <div className="drawer-list muted">
          <button type="button" onClick={() => { onNavigate("settings"); onClose(); }}>
            <i>🔐</i>
            PIN Değiştir
          </button>
          <button type="button" onClick={onCopyCode}>
            <i>▣</i>
            Kodumu Kopyala
          </button>
          <button type="button" onClick={onToggleDark}>
            <i>{darkMode ? "☀" : "☾"}</i>
            {darkMode ? "Aydınlık Mod" : "Karanlık Mod"}
          </button>
          <button className="logout" type="button" onClick={onLogout}>
            <i>⇥</i>
            Çıkış Yap
          </button>
        </div>
      </aside>
    </div>
  );
}
