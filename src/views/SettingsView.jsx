import { useState } from "react";
import PasswordField from "../components/PasswordField";
import { createPinCredential, sanitizePin, validatePin, verifyPin } from "../services/authService";

const reminderOptions = [5, 10, 15, 30];
const version = "1.0.0";

export default function SettingsView({ settings, onChange, onLogout }) {
  const [modal, setModal] = useState(null);
  const [quietStart, setQuietStart] = useState(settings.quietStart || "22:00");
  const [quietEnd, setQuietEnd] = useState(settings.quietEnd || "07:00");
  const [passwordForm, setPasswordForm] = useState({ old: "", next: "", confirm: "" });
  const [visiblePasswordFields, setVisiblePasswordFields] = useState({ old: false, next: false, confirm: false });
  const [passwordError, setPasswordError] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);

  function togglePasswordField(field) {
    setVisiblePasswordFields((current) => ({ ...current, [field]: !current[field] }));
  }

  function update(patch) {
    onChange(patch);
  }

  return (
    <main className="settings-screen">
      <div className="settings-title">
        <h1>Ayarlar</h1>
      </div>

      <SettingsGroup title="BİLDİRİMLER">
        <SettingsRow icon="bell" title="Hatırlatma bildirimleri" right={<Switch checked={settings.reminderNotifications ?? true} onChange={(value) => update({ reminderNotifications: value })} />} />
        <SettingsRow
          icon="clock"
          title="Hatırlatma süresi"
          value={`${settings.reminderLeadMinutes ?? 10} dakika önce`}
          onClick={() => setModal("reminder")}
        />
        <SettingsRow
          icon="moon"
          title="Sessiz saatler"
          value={`${settings.quietStart || "22:00"} - ${settings.quietEnd || "07:00"}`}
          onClick={() => setModal("quiet")}
        />
      </SettingsGroup>

      <SettingsGroup title="GÜVENLİK">
        <SettingsRow icon="lock" title="Uygulama kilidi" right={<Switch checked={Boolean(settings.pinEnabled)} onChange={(value) => update({ pinEnabled: value })} />} />
        {settings.pinEnabled ? <SettingsRow icon="key" title="PIN değiştir" onClick={() => setModal("password")} /> : null}
      </SettingsGroup>

      <SettingsGroup title="TERCİHLER">
        <SettingsRow icon="contrast" title="Karanlık mod" right={<Switch checked={Boolean(settings.darkMode)} onChange={(value) => update({ darkMode: value })} />} />
        <SettingsRow icon="language" title="Dil" value="Türkçe" onClick={() => setModal("language")} />
      </SettingsGroup>

      <SettingsGroup title="VERİ & GİZLİLİK">
        <SettingsRow icon="shield" title="Gizlilik politikası" onClick={() => setPrivacyOpen(true)} />
      </SettingsGroup>

      <SettingsGroup title="HAKKINDA">
        <SettingsRow icon="star" title="Değerlendirme yap" onClick={() => window.open("https://apps.apple.com/", "_blank")} />
        <SettingsRow icon="contact" title="İletişim" onClick={() => { window.location.href = "mailto:destek@takvimed.app?subject=TakviMed%20Destek"; }} />
      </SettingsGroup>

      <footer className="settings-footer">
        <img src="/icon.svg" alt="TakviMed" />
        <span>TakviMed v{version}</span>
        <button type="button" onClick={onLogout}>Çıkış Yap</button>
      </footer>

      {modal === "reminder" ? (
        <SettingsModal title="Hatırlatma süresi" onClose={() => setModal(null)}>
          <div className="settings-options">
            {reminderOptions.map((minutes) => (
              <button
                className={(settings.reminderLeadMinutes ?? 10) === minutes ? "selected" : ""}
                type="button"
                key={minutes}
                onClick={() => {
                  update({ reminderLeadMinutes: minutes });
                  setModal(null);
                }}
              >
                {minutes} dakika önce
              </button>
            ))}
          </div>
        </SettingsModal>
      ) : null}

      {modal === "quiet" ? (
        <SettingsModal title="Sessiz saatler" onClose={() => setModal(null)}>
          <div className="time-range-form">
            <label>Başlangıç<input type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} /></label>
            <label>Bitiş<input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} /></label>
            <button className="primary-button" type="button" onClick={() => { update({ quietStart, quietEnd }); setModal(null); }}>Kaydet</button>
          </div>
        </SettingsModal>
      ) : null}

      {modal === "password" ? (
        <SettingsModal title="PIN değiştir" onClose={() => setModal(null)}>
          <div className="time-range-form">
            <label>
              Eski PIN
              <PasswordField
                value={passwordForm.old}
                onChange={(event) => setPasswordForm((current) => ({ ...current, old: sanitizePin(event.target.value) }))}
                visible={visiblePasswordFields.old}
                onToggle={() => togglePasswordField("old")}
                placeholder="6 rakam"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
              />
            </label>
            <label>
              Yeni PIN
              <PasswordField
                value={passwordForm.next}
                onChange={(event) => setPasswordForm((current) => ({ ...current, next: sanitizePin(event.target.value) }))}
                visible={visiblePasswordFields.next}
                onToggle={() => togglePasswordField("next")}
                placeholder="6 rakam"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength="6"
                maxLength="6"
              />
            </label>
            <label>
              Yeni PIN tekrar
              <PasswordField
                value={passwordForm.confirm}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: sanitizePin(event.target.value) }))}
                visible={visiblePasswordFields.confirm}
                onToggle={() => togglePasswordField("confirm")}
                placeholder="PIN'i tekrar girin"
                inputMode="numeric"
                pattern="[0-9]*"
                minLength="6"
                maxLength="6"
              />
            </label>
            {passwordError ? <p className="settings-error">{passwordError}</p> : null}
            <button
              className="primary-button"
              type="button"
              onClick={async () => {
                const oldPinValid = settings.pinCredential
                  ? await verifyPin(passwordForm.old, settings.pinCredential)
                  : passwordForm.old === settings.pin;
                if (!oldPinValid) {
                  setPasswordError("Eski PIN hatalı.");
                  return;
                }
                const validation = validatePin(passwordForm.next);
                if (!validation.valid) {
                  setPasswordError(validation.message);
                  return;
                }
                if (passwordForm.next !== passwordForm.confirm) {
                  setPasswordError("Yeni PIN alanları eşleşmiyor.");
                  return;
                }
                const credential = await createPinCredential(passwordForm.next);
                if (!credential.ok) {
                  setPasswordError(credential.error);
                  return;
                }
                update({ pinCredential: credential.pinCredential, pin: "" });
                setPasswordForm({ old: "", next: "", confirm: "" });
                setVisiblePasswordFields({ old: false, next: false, confirm: false });
                setPasswordError("");
                setModal(null);
              }}
            >
              PIN'i Güncelle
            </button>
          </div>
        </SettingsModal>
      ) : null}

      {modal === "language" ? (
        <SettingsModal title="Dil" onClose={() => setModal(null)}>
          <p className="settings-modal-copy">Çoklu dil desteği sonraki sürüm için hazırlanıyor. Şu an uygulama dili Türkçe.</p>
        </SettingsModal>
      ) : null}

      {privacyOpen ? (
        <SettingsModal title="Gizlilik politikası" onClose={() => setPrivacyOpen(false)}>
          <p className="settings-modal-copy">
            TakviMed, ilaç takibi için girdiğiniz verileri cihazınızda saklar. E-posta doğrulama, PIN sıfırlama ve aile takibi gibi
            çevrim içi özellikler backend bağlandığında açık rıza, veri minimizasyonu ve hesap silme ilkeleriyle çalışacak şekilde tasarlanmıştır.
          </p>
        </SettingsModal>
      ) : null}
    </main>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <section className="settings-group-wrap">
      <h2>{title}</h2>
      <div className="settings-group">{children}</div>
    </section>
  );
}

function SettingsRow({ icon, title, value, right, danger = false, chevron = true, onClick }) {
  return (
    <button className={`settings-row ${danger ? "danger" : ""}`} type="button" onClick={onClick} disabled={!onClick && !right}>
      <span className="settings-row-icon"><SettingsIcon id={icon} /></span>
      <span className="settings-row-title">{title}</span>
      <span className="settings-row-right">
        {right || (value ? <span className="settings-value">{value}</span> : null)}
        {chevron && !right ? <span className="chevron">›</span> : null}
      </span>
    </button>
  );
}

function Switch({ checked, onChange }) {
  return (
    <span className={`ios-switch ${checked ? "checked" : ""}`} onClick={(event) => { event.stopPropagation(); onChange(!checked); }} role="switch" aria-checked={checked} tabIndex="0">
      <span />
    </span>
  );
}

function SettingsModal({ title, children, onClose }) {
  return (
    <div className="settings-modal-backdrop" onMouseDown={onClose}>
      <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SettingsIcon({ id }) {
  const common = { "aria-hidden": "true", viewBox: "0 0 28 28" };
  const paths = {
    bell: <path d="M8 19h12M10 19V11a4 4 0 0 1 8 0v8M12 22c1.2 1.2 2.8 1.2 4 0" />,
    clock: <><circle cx="14" cy="14" r="9" /><path d="M14 9v6l4 2" /></>,
    moon: <path d="M20 18.5A8 8 0 0 1 9.5 8 7 7 0 1 0 20 18.5Z" />,
    lock: <><rect x="7" y="12" width="14" height="10" rx="3" /><path d="M10 12V9a4 4 0 0 1 8 0v3" /></>,
    key: <><circle cx="10" cy="14" r="4" /><path d="M14 14h8M19 14v3M22 14v-3" /></>,
    contrast: <><circle cx="14" cy="14" r="9" /><path d="M14 5v18a9 9 0 0 0 0-18Z" /></>,
    language: <path d="M5 8h12M11 5v3M8 8c1 4 4 7 8 9M15 8c-2 5-5 8-10 10M17 22l4-10 4 10M19 18h4" />,
    shield: <path d="M14 4 22 7v6c0 5-3 9-8 11-5-2-8-6-8-11V7l8-3Z" />,
    star: <path d="m14 4 3 6 7 .9-5 4.8 1.2 6.8L14 19l-6.2 3.5L9 15.7l-5-4.8 7-.9 3-6Z" />,
    contact: <><path d="M8 21c1-4 3-6 6-6s5 2 6 6" /><circle cx="14" cy="9" r="4" /></>,
  };
  return (
    <svg {...common}>
      {paths[id]}
    </svg>
  );
}
