import { cn, initials } from '@/lib/utils';

const SIZES = { sm: 'h-9 w-9 text-sm', md: 'h-12 w-12 text-base', lg: 'h-20 w-20 text-2xl' } as const;

export function Avatar({
  first,
  last,
  url,
  size = 'md',
  className,
}: {
  first: string;
  last: string;
  url?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (url) {
    return <img src={url} alt="" className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)} />;
  }
  // стабильный цвет от имени
  const hue = [...(first + last)].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', SIZES[size], className)}
      style={{ backgroundColor: `hsl(${hue} 45% 40%)` }}
    >
      {initials(first, last)}
    </span>
  );
}
