import { useEffect, useRef, useState } from "react";
import { useFollowedMemberData } from "../hooks/useFamily";
import { getDayItems, summaryFor, todayKey } from "../services/medicationService";

export default function FamilyView({
  profile,
  medications,
  checked,
  family,
  onFollow,
  onUnfollow,
  onRemoveFollower,
  onSendReminder,
  onDismissReminder,
  onCopyCode,
}) {
  const inputRef = useRef(null);
  const [selectedFollowingUid, setSelectedFollowingUid] = useState(null);

  useEffect(() => {
    if (family.following.length === 1 && selectedFollowingUid === null) {
      setSelectedFollowingUid(family.following[0].uid);
    }
  }, [family.following, selectedFollowingUid]);

  const ownSummary = summaryFor(medications, checked, 7);

  function handleFollow() {
    const value = inputRef.current?.value;
    if (!value) return;
    onFollow(value).then(() => {
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <main className="view-shell family-view">
      <div className="section-heading">
        <h1>Aile Takip</h1>
        <span>Paylaş ve takip et</span>
      </div>

      <section className="family-intro">
        <FamilyPlusIllustration />
        <h2>Yakınınızı Takip Edin</h2>
        <p>Aile üyelerinizle bağlanın, ilaç takibini birlikte yapın.</p>
        <ol>
          <li>Kodunuzu kopyalayıp yakınınıza gönderin</li>
          <li>Ya da onların kodunu girerek siz takip edin</li>
          <li>İlaç kullanım durumunu anlık olarak görün</li>
        </ol>
        <div className="follow-form">
          <input ref={inputRef} placeholder="Örn. AB1C2D" maxLength="8" />
          <button type="button" onClick={handleFollow}>Takip Et →</button>
        </div>
      </section>

      <section className="family-share-card">
        <div className="section-heading">
          <h2>Paylaş & Takip Et</h2>
          <span>Sizin kodunuz</span>
        </div>
        <div className="family-code">{profile.code}</div>
        <p>Bu kodu aile üyenize gönderin, kodunuzla sizi takip etsin.</p>
        <button className="ghost-button" type="button" onClick={onCopyCode}>Kodu Kopyala</button>
      </section>

      <section className="family-card">
        <strong>Gelen Hatırlatmalar <small>{family.reminders.length}</small></strong>
        {family.reminders.length ? (
          family.reminders.map((reminder) => (
            <div className="family-reminder" key={reminder.id}>
              <div>
                <strong>{reminder.fromName}</strong>
                <span>{reminder.message}</span>
              </div>
              <button className="ghost-button" type="button" onClick={() => onDismissReminder(reminder.id)}>Kapat</button>
            </div>
          ))
        ) : (
          <p>Hatırlatma yok</p>
        )}
      </section>

      <section className="family-grid">
        <div className="family-card">
          <strong>Takip Ettiklerim <small>{family.following.length}</small></strong>
          {family.following.length ? family.following.map((item) => (
            <FollowingItem
              key={item.uid}
              item={item}
              selected={selectedFollowingUid === item.uid}
              onSelect={() => setSelectedFollowingUid((current) => current === item.uid ? null : item.uid)}
              onUnfollow={() => onUnfollow(item.uid, item.followedName)}
              onRemind={(message) => onSendReminder({ targetUid: item.uid, targetName: item.followedName, message })}
            />
          )) : <p>Henüz kimseyi takip etmiyorsunuz.</p>}
        </div>
        <div className="family-card">
          <strong>Beni Takip Edenler <small>{family.followers.length}</small></strong>
          {family.followers.length ? family.followers.map((item) => (
            <div className="family-person" key={item.uid}>
              <span>{item.followerName}</span>
              <button className="ghost-button" type="button" onClick={() => onRemoveFollower(item.uid, item.followerName)}>Kaldır</button>
            </div>
          )) : <p>Henüz takipçiniz yok.</p>}
        </div>
      </section>

      {!family.following.length && !family.followers.length ? (
        <section className="designed-empty-state">
          <FamilyPlusIllustration />
          <h2>Henüz kimse eklenmedi</h2>
          <p>Yakınınızın kodunu girerek ilaç takibini birlikte yapabilirsiniz.</p>
        </section>
      ) : null}

      <section className="section-block">
        <div className="section-heading">
          <h2>{profile.name} profili</h2>
          <span>{ownSummary.rate}% uyum</span>
        </div>
        <div className="family-stats">
          <div><strong>{medications.length}</strong><span>Aktif ilaç</span></div>
          <div><strong>{ownSummary.takenDose}</strong><span>7 günde alınan</span></div>
          <div><strong>{ownSummary.missedDose}</strong><span>Atlanan</span></div>
        </div>
      </section>
    </main>
  );
}

function FollowingItem({ item, selected, onSelect, onUnfollow, onRemind }) {
  const { medications, checked } = useFollowedMemberData(selected ? item.uid : null);
  const summary = selected ? summaryFor(medications, checked, 7) : null;
  const today = todayKey();
  const todayItems = selected ? getDayItems(medications, today) : [];
  const todayChecked = checked?.[today] || {};
  const defaultMessage = `İlacınızı almayı unutmayın 💊`;

  return (
    <div className={`family-person ${selected ? "expanded" : ""}`}>
      <button className="family-person-row" type="button" onClick={onSelect}>
        <span>{item.followedName}</span>
        <small>{item.followedCode}</small>
        <span className={`family-person-chevron ${selected ? "open" : ""}`}>▾</span>
      </button>
      {selected ? (
        <div className="family-person-detail">
          <div className="family-stats">
            <div><strong>{medications.length}</strong><span>Aktif ilaç</span></div>
            <div><strong>{summary?.takenDose ?? 0}</strong><span>7 günde alınan</span></div>
            <div><strong>{summary?.missedDose ?? 0}</strong><span>Atlanan</span></div>
          </div>

          <div className="family-today-section">
            <strong>Bugün ({today})</strong>
            {todayItems.length === 0 ? (
              <p className="family-empty-note">Bugün için planlanmış ilaç yok.</p>
            ) : (
              <ul className="family-today-list">
                {todayItems.map(({ med, time, key }) => {
                  const taken = Boolean(todayChecked[key]);
                  return (
                    <li key={key} className={`family-today-row ${taken ? "taken" : "pending"}`}>
                      <span className="family-today-time">{time}</span>
                      <span className="family-today-name">
                        <strong>{med.name}</strong>
                        <small>{med.dose}{med.foodTiming && med.foodTiming !== "önemli değil" ? ` · ${med.foodTiming}` : ""}</small>
                      </span>
                      <span className={`family-today-status ${taken ? "taken" : "pending"}`}>
                        {taken ? "✓ alındı" : "bekliyor"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {medications.length > 0 ? (
            <div className="family-today-section">
              <strong>Tüm ilaçlar</strong>
              <ul className="family-medlist">
                {medications.map((med) => (
                  <li key={med.id}>
                    <strong>{med.name}</strong>
                    <small>{med.dose} · {med.times?.join(", ")}{med.foodTiming && med.foodTiming !== "önemli değil" ? ` · ${med.foodTiming}` : ""}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="family-person-actions">
            <button className="primary-button" type="button" onClick={() => onRemind(defaultMessage)}>Hatırlatma gönder</button>
            <button className="ghost-button" type="button" onClick={onUnfollow}>Takipten çık</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FamilyPlusIllustration() {
  return (
    <svg className="family-plus-illustration" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="45" cy="42" r="16" />
      <circle cx="76" cy="47" r="13" />
      <path d="M22 94c5-22 15-32 27-32s22 10 27 32M66 92c4-16 12-24 23-24 7 0 13 4 17 13" />
      <path d="M92 24v22M81 35h22" />
    </svg>
  );
}
