import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/contexts/LanguageContext';

interface ArdanaLogoProps {
  /** Size of the square logo mark in pixels */
  size?: number;
  className?: string;
  /** Show the wordmark next to the icon */
  showWordmark?: boolean;
  /** Colour variant — controls background fill */
  variant?: 'dark' | 'light' | 'transparent';
}

/**
 * Ardana brand logo — a stylised Lebanese cedar tree inside a rounded square.
 * The cedar (Cedrus libani) is the national symbol of Lebanon and the most
 * recognisable emblem of Levantine land and heritage.
 */
export function ArdanaLogo({
  size = 40,
  className,
  showWordmark = false,
  variant = 'dark',
}: ArdanaLogoProps) {
  const { t } = useLanguage();
  const bg =
    variant === 'dark'
      ? '#2B4A2F'
      : variant === 'light'
      ? '#F5F0E8'
      : 'none';

  const treeColor =
    variant === 'light' ? '#2B4A2F' : '#EDE3CC';

  const r = size * 0.22; // corner radius

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={t('brand.logo_aria')}
      >
        {/* Background tile */}
        {variant !== 'transparent' && (
          <rect width="40" height="40" rx={r} fill={bg} />
        )}

        {/* ── Lebanese Cedar silhouette ────────────────────────────────── */}
        {/* Each layer is a triangle; they overlap slightly to create the  */}
        {/* characteristic tiered, spreading profile of the cedar tree.   */}

        {/* Trunk */}
        <rect x="18.5" y="26.5" width="3" height="6.5" rx="1" fill={treeColor} />

        {/* Tier 1 — widest, bottom */}
        <polygon points="20,20 5.5,27.5 34.5,27.5" fill={treeColor} />

        {/* Tier 2 */}
        <polygon points="20,14.5 9,22.5 31,22.5" fill={treeColor} />

        {/* Tier 3 */}
        <polygon points="20,9.5 13,17 27,17" fill={treeColor} />

        {/* Tier 4 — crown tip */}
        <polygon points="20,5 16.5,11 23.5,11" fill={treeColor} />

        {/* Ground / root hint — two small dots symbolising roots */}
        <circle cx="16" cy="34.5" r="1" fill={treeColor} opacity="0.5" />
        <circle cx="24" cy="34.5" r="1" fill={treeColor} opacity="0.5" />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <span
            className="font-serif font-bold tracking-tight text-sidebar-foreground"
            style={{ fontSize: size * 0.55 }}
          >
            Ardana
          </span>
        </div>
      )}
    </div>
  );
}
