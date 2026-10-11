// A button in one of three styles. Shows a loading label while busy.
const STYLES = {
  primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-60",
  secondary: "border border-line bg-surface text-ink hover:bg-muted disabled:opacity-60",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
};

export default function Button({ variant = "primary", isBusy = false, className = "", children, ...props }) {
  return (
    <button
      {...props}
      disabled={isBusy || props.disabled}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors ${STYLES[variant]} ${className}`}
    >
      {isBusy ? "…" : children}
    </button>
  );
}
