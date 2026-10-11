// A labelled input with an optional hint and error message underneath.
export default function TextField({ label, name, error, hint, className = "", ...inputProps }) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`block min-h-11 w-full rounded-md border bg-surface px-3 text-base text-ink outline-none focus:ring-2 focus:ring-brand ${
          error ? "border-red-500" : "border-line"
        }`}
        {...inputProps}
      />
      {hint && !error && (
        <span id={`${name}-hint`} className="mt-1 block text-xs text-subtle">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${name}-error`} className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
