import { Leaf } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container flex min-h-full max-w-md flex-col justify-center py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow">
          <Leaf className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <Card className="p-5">{children}</Card>
    </div>
  );
}

export function safeNext(next: string | null, fallback: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
