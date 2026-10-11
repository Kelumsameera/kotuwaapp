// A coloured message box for success or error messages.
const STYLES = {
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  success: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
  info: "border-line bg-muted text-ink",
};

export default function Alert({ type = "info", children }) {
  if (!children) return null;
  return (
    <div role={type === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${STYLES[type]}`}>
      {children}
    </div>
  );
}
