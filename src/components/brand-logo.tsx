import Link from "next/link";

export function BrandLogo({ href = "/", title, compact = false }: { href?: string; title?: string; compact?: boolean }) {
  return (
    <Link href={href} className={`brand-logo${compact ? " brand-logo-compact" : ""}`} title={title ?? "Research Room — ir al inicio"}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="brand-logo-mark">
        <circle cx="9" cy="13" r="6.5" fill="var(--accent)" opacity=".85" />
        <circle cx="17" cy="13" r="6.5" fill="var(--text)" opacity=".85" />
        <rect x="11.5" y="10.5" width="3" height="5" rx=".6" fill="var(--surface)" />
      </svg>
      {!compact && (
        <span className="brand-logo-text">
          <span className="brand-logo-primary">Research</span>
          <span className="brand-logo-secondary">Room</span>
        </span>
      )}
    </Link>
  );
}
