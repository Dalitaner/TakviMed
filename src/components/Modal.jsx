export default function Modal({ title, children, open, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-panel" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
