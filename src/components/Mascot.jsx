// Takvi — TakviMed'in takvim temalı maskotu (saf CSS ile çizilir, düz/sade stil).
export default function Mascot({ className = "" }) {
  return (
    <div className={`takvi ${className}`.trim()} aria-hidden="true">
      <span className="takvi-ring takvi-ring-l" />
      <span className="takvi-ring takvi-ring-r" />
      <div className="takvi-body">
        <div className="takvi-header" />
        <span className="takvi-eye takvi-eye-l" />
        <span className="takvi-eye takvi-eye-r" />
        <span className="takvi-mouth" />
      </div>
    </div>
  );
}
