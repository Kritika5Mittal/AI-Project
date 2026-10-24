// Wordmark: a small "rolling band" glyph + name.
export default function Logo({ light = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect width="28" height="28" rx="7" fill={light ? "#19B3A6" : "#0E1B3D"} />
        <path d="M4 19 C9 8, 13 22, 24 9 L24 14 C13 27, 9 13, 4 24 Z" fill={light ? "#0A1226" : "#19B3A6"} />
      </svg>
      <span className={`font-display text-lg font-bold ${light ? "text-white" : "text-navy-900"}`}>RollAlpha AI</span>
    </span>
  );
}
