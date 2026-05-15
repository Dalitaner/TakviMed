export default function SplashScreen({ visible, onDone }) {
  if (!visible) return null;

  return (
    <section className="splash-screen">
      <div className="splash-logo" aria-hidden="true">
        <img src="/icon.svg" alt="" />
      </div>
      <p>İlaçlarınızı, stoklarınızı ve günlük alışkanlıklarınızı tek yerde takip edin.</p>
      <button className="primary-button splash-button" type="button" onClick={onDone}>
        Başlayalım
      </button>
    </section>
  );
}
