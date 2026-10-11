"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A row of section tabs, e.g. Dashboard | Shop | Products. links: [{ href, label }]
export default function SubNav({ links }) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== links[0].href && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              isActive ? "border-brand font-medium text-brand" : "border-transparent text-subtle hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
