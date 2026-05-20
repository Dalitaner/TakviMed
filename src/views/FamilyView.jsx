import { useEffect, useRef, useState } from "react";
import { useFollowedMemberData } from "../hooks/useFamily";
import { getDayItems, summaryFor, todayKey } from "../services/medicationService";

function initial(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase() || "?";
}

export default function FamilyView({
  profile,
  family,
  onFollow,
  onUnfollow,
  onRemoveFollower,
  onSendReminder,
  onDismissReminder,
  onCopyCode,
}) {
  const inputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("following");
  const [detailUid, setDetailUid] = useState(null);

  const hasConnections = family.following.length > 0 || family.followers.length > 0;
  const detailItem = detailUid ? family.following.find((f) => f.uid === detailUid) : null;

  // Takip bırakılır/silinirse detay sayfasından listeye dön.
  useEffect(() => {
    if (detailUid && !family.following.some((f) => f.uid === detailUid)) {
      setDetailUid(null);
    }
  }, [detailUid, family.following]);

  function handleFollow() {
    const value = inputRef.current?.value;
    if (!value) return;
    onFollow(value).then(() => {
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  // ===== Detay sayfası — takip edilen kişinin ilaç durumu =====
  if (detailItem) {
    return (
      <FollowingDetail
        item={detailItem}
        onBack={() => setDetailUid(null)}
        onUnfollow={() => {
          onUnfollow(detailItem.uid, detailItem.followedName);
          setDetailUid(null);
        }}
        onRemind={(message) =>
          onSendReminder({ targetUid: detailItem.uid, targetName: detailItem.followedName, message })
        }
      />
    );
  }

  // ===== Liste sayfası =====
  return (
    <main className="view-shell family-view">
      <div className="section-heading">
        <h1>Aile Takip</h1>
        <span>Paylaş ve takip et</span>
      </div>

      {/* Tek kompakt kart: kendi kodun + yakınını ekle */}
      <section className="family-connect">
        <div className="family-connect-mine">
          <span className="family-connect-label">Sizin kodunuz</span>
          <div className="family-connect-code-row">
            <div className="family-connect-code">{profile.code}</div>
            <button className="ghost-button" type="button" onClick={onCopyCode}>Kopyala</button>
          </div>
        </div>
        <div className="family-connect-divider">veya</div>
        <div className="family-connect-add">
          <span className="family-connect-label">Yakınınızın koduyla takip edin</span>
          <div className="follow-form">
            <input ref={inputRef} placeholder="Örn. AB1C2D" maxLength="8" />
            <button type="button" onClick={handleFollow}>Takip Et →</button>
          </div>
        </div>
      </section>

      {/* İpucu yalnızca hiç bağlantı yokken */}
      {!hasConnections ? (
        <p className="family-connect-hint">
          💡 Kendi kodunuzu yakınınıza gönderin ya da onların kodunu girin —
          ilaç kullanım durumunu birlikte takip edin.
        </p>
      ) : null}

      {/* Instagram tarzı sekmeler */}
      {hasConnections ? (
        <section className="family-profile">
          <div className="family-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "following"}
              className={`family-tab ${activeTab === "following" ? "active" : ""}`}
              onClick={() => setActiveTab("following")}
            >
              <span className="family-tab-count">{family.following.length}</span>
              <span className="family-tab-label">Takip Ettiklerim</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "followers"}
              className={`family-tab ${activeTab === "followers" ? "active" : ""}`}
              onClick={() => setActiveTab("followers")}
            >
              <span className="family-tab-count">{family.followers.length}</span>
              <span className="family-tab-label">Beni Takip Edenler</span>
            </button>
          </div>

          <div className="family-tab-list">
            {activeTab === "following" ? (
              family.following.length ? (
                family.following.map((item) => (
                  <button
                    key={item.uid}
                    type="button"
                    className="family-person-row"
                    onClick={() => setDetailUid(item.uid)}
                  >
                    <span className="family-row-avatar">{initial(item.followedName)}</span>
                    <span className="family-person-info">
                      <strong>{item.followedName}</strong>
                      <small>{item.followedCode}</small>
                    </span>
                    <span className="family-person-chevron">›</span>
                  </button>
                ))
              ) : (
                <p className="family-tab-empty">Henüz kimseyi takip etmiyorsunuz.</p>
              )
            ) : (
              family.followers.length ? (
                family.followers.map((item) => (
                  <div className="family-follower-row" key={item.uid}>
                    <div className="family-row-avatar">{initial(item.followerName)}</div>
                    <div className="family-person-info">
                      <strong>{item.followerName}</strong>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => onRemoveFollower(item.uid, item.followerName)}>Kaldır</button>
                  </div>
                ))
              ) : (
                <p className="family-tab-empty">Henüz takipçiniz yok.</p>
              )
            )}
          </div>
        </section>
      ) : null}

      {/* Hatırlatmalar yalnızca varsa */}
      {family.reminders.length ? (
        <section className="family-card">
          <strong>Gelen Hatırlatmalar <small>{family.reminders.length}</small></strong>
          {family.reminders.map((reminder) => (
            <div className="family-reminder" key={reminder.id}>
              <div>
                <strong>{reminder.fromName}</strong>
                <span>{reminder.message}</span>
              </div>
              <button className="ghost-button" type="button" onClick={() => onDismissReminder(reminder.id)}>Kapat</button>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function FollowingDetail({ item, onBack, onUnfollow, onRemind }) {
  const { medications, checked } = useFollowedMemberData(item.uid);
  const summary = summaryFor(medications, checked, 7);
  const today = todayKey();
  const todayItems = getDayItems(medications, today);
  const todayChecked = checked?.[today] || {};
  const defaultMessage = `İlacınızı almayı unutmayın 💊`;

  return (
    <main className="view-shell family-view">
      <button type="button" className="pharmacy-back" onClick={onBack}>
        ← Takip Ettiklerim
      </button>

      <section className="family-profile">
        <div className="family-profile-top">
          <div className="family-avatar">{initial(item.followedName)}</div>
          <div className="family-profile-name">
            <strong>{item.followedName}</strong>
            <span>%{summary.rate} ilaç uyumu</span>
          </div>
        </div>
      </section>

      <div className="family-stats">
        <div><strong>{medications.length}</strong><span>Aktif ilaç</span></div>
        <div><strong>{summary.takenDose}</strong><span>7 günde alınan</span></div>
        <div><strong>{summary.missedDose}</strong><span>Atlanan</span></div>
      </div>

      <section className="family-card">
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
      </section>

      {medications.length > 0 ? (
        <section className="family-card">
          <strong>Tüm ilaçlar</strong>
          <ul className="family-medlist">
            {medications.map((med) => (
              <li key={med.id}>
                <strong>{med.name}</strong>
                <small>{med.dose} · {med.times?.join(", ")}{med.foodTiming && med.foodTiming !== "önemli değil" ? ` · ${med.foodTiming}` : ""}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="family-person-actions">
        <button className="primary-button" type="button" onClick={() => onRemind(defaultMessage)}>Hatırlatma gönder</button>
        <button className="ghost-button" type="button" onClick={onUnfollow}>Takipten çık</button>
      </div>
    </main>
  );
}
