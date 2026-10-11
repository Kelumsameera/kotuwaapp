// A labelled dropdown. options: [{ value, label }]
export default function SelectField({ label, name, options, error, placeholder, className = "", ...selectProps }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <select
        name={name}
        aria-invalid={Boolean(error)}
        className={`block min-h-11 w-full rounded-md border bg-surface px-3 text-base text-ink outline-none focus:ring-2 focus:ring-brand ${
          error ? "border-red-500" : "border-line"
        }`}
        {...selectProps}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
