import { useState } from "react";

export default function SettingsView({ settings, onChange, onResetSplash }) {
  const [showPin, setShowPin] = useState(false);

  return (
    <main className="view-shell">
      <div className="section-heading">
        <h1>Ayarlar</h1>
        <span>Cihaz ve görünüm</span>
      </div>
      <section className="form-card">
        <label className="switch-row">
          <span>
            <strong>Büyük yazı</strong>
            <small>Daha rahat okunabilir metin boyutu</small>
          </span>
          <input type="checkbox" checked={settings.largeText} onChange={(event) => onChange({ largeText: event.target.checked })} />
        </label>
        <label className="switch-row">
          <span>
            <strong>PIN kilidi</strong>
            <small>Basit yerel erişim koruması</small>
          </span>
          <input type="checkbox" checked={settings.pinEnabled} onChange={(event) => onChange({ pinEnabled: event.target.checked })} />
        </label>
        {settings.pinEnabled ? (
          <label className="field-label">
            4 haneli PIN
            <span className="password-field">
              <input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength="4"
                value={settings.pin}
                onChange={(event) => onChange({ pin: event.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
              <button type="button" onClick={() => setShowPin((value) => !value)} aria-label={showPin ? "PIN'i gizle" : "PIN'i göster"}>
                {showPin ? "○" : "◉"}
              </button>
            </span>
          </label>
        ) : null}
        <button className="ghost-button" type="button" onClick={onResetSplash}>Splash ekranını tekrar göster</button>
      </section>
    </main>
  );
}
