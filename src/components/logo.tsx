import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Brand logo components.
 *  - <BrandMark />  : emblem mark (F + flame) with the optional wordmark
 *                     beside it — used in navbars, auth pages, footer.
 *  - <BrandLogo />  : the full square logo (wordmark baked in) — used
 *                     standalone (e.g. large centerpieces).
 * Assets live in /public (logo.png, logo-mark.png).
 */

export function BrandMark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/logo-mark.png"
        alt="Forge Strength Club emblem"
        width={48}
        height={45}
        priority
        className={cn('h-9 w-auto', markClassName)}
      />
      <span className="font-display text-2xl tracking-wide text-bone">
        FORGE <span className="text-ember">STRENGTH</span>
      </span>
    </span>
  );
}

export function BrandLogo({
  size = 96,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Forge Strength Club"
      width={size}
      height={size}
      priority={priority}
      className={cn('h-auto w-auto rounded-2xl', className)}
    />
  );
}
