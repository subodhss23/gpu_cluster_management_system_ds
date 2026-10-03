import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-ink-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-500">
            {breadcrumb.map((b, i) => (
              <span key={`${b.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <Icon name="chevron" size={12} className="text-ink-600" />}
                {b.href ? (
                  <Link href={b.href} className="hover:text-ink-300">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-ink-300">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink-100">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
