import { summaryFor } from "../services/medicationService";

export default function FamilyView({ profile, medications, checked, family, onFollow, onCopyCode, onNudge }) {
  const summary = summaryFor(medications, checked, 7);

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
          <input id="family-code" placeholder="Örn. AB1C2D" maxLength="8" />
          <button type="button" onClick={() => onFollow(document.getElementById("family-code")?.value)}>Takip Et →</button>
        </div>
      </section>

      <section className="family-share-card">
        <div className="section-heading">
          <h2>Paylaş & Takip Et</h2>
          <span>Sizin kodunuz</span>
        </div>
        <div className="family-code">{profile.code}</div>
        <p>Bu kodu aile üyenize gönderin, size takip isteği atsın.</p>
        <button className="ghost-button" type="button" onClick={onCopyCode}>Kodu Kopyala</button>
      </section>

      <section className="family-grid">
        <div className="family-card">
          <strong>Gelen Hatırlatmalar</strong>
          <p>Hatırlatma yok</p>
        </div>
        <div className="family-card">
          <strong>Takip Ettiklerim <small>{family.following.length}</small></strong>
          {family.following.length ? family.following.map((item) => (
            <div className="family-person" key={item.code}>
              <span>{item.name}</span>
              <small>{item.code}</small>
            </div>
          )) : <p>Henüz kimseyi takip etmiyorsunuz.</p>}
        </div>
        <div className="family-card">
          <strong>Beni Takip Edenler <small>{family.followers.length}</small></strong>
          {family.followers.length ? family.followers.map((item) => <p key={item.code}>{item.name}</p>) : <p>Henüz takipçiniz yok.</p>}
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
          <span>{summary.rate}% uyum</span>
        </div>
        <div className="family-stats">
          <div><strong>{medications.length}</strong><span>Aktif ilaç</span></div>
          <div><strong>{summary.takenDose}</strong><span>7 günde alınan</span></div>
          <div><strong>{summary.missedDose}</strong><span>Atlanan</span></div>
        </div>
        <button className="primary-button" type="button" onClick={onNudge}>Hatırlatma gönder</button>
      </section>
    </main>
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
