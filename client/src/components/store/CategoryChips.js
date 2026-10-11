import Link from "next/link";
import { pickText } from "@/lib/pickText";

// A scrollable row of top-level category links. activeSlug highlights the current one.
export default function CategoryChips({ categories, locale, activeSlug, allLabel }) {
  const topLevel = categories.filter((category) => !category.parent);
  const chipClass = (isActive) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
      isActive ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:bg-muted"
    }`;

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {allLabel && (
        <Link href="/products" className={chipClass(!activeSlug)}>
          {allLabel}
        </Link>
      )}
      {topLevel.map((category) => (
        <Link key={category.id} href={`/products?category=${category.slug}`} className={chipClass(activeSlug === category.slug)}>
          {pickText(category.name, locale)}
        </Link>
      ))}
    </nav>
  );
}
