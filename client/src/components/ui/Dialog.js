"use client";

import { useEffect } from "react";

// A simple pop-up window over the page. Escape or clicking outside closes it.
export default function Dialog({ title, onClose, children, wide = false }) {
  useEffect(() => {
    // Closes on the Escape key.
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-surface p-5 shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded px-2 text-xl text-subtle hover:bg-muted" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
