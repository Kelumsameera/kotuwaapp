// Shows a rating like ★★★★☆ (4.2) with the number of reviews.
export default function RatingStars({ average, count, label }) {
  if (!count) return null;
  const rounded = Math.round(average);
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={label}>
      <span className="text-amber-500" aria-hidden="true">
        {"★".repeat(rounded)}
        {"☆".repeat(5 - rounded)}
      </span>
      <span className="text-subtle">
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}
