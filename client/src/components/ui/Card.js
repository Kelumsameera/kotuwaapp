// A white box with a title, used for forms and panels.
export default function Card({ title, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {title && <h1 className="mb-4 text-xl font-semibold text-ink">{title}</h1>}
      {children}
    </section>
  );
}
