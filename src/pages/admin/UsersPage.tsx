import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, MoreVertical, Search, Shield, ShieldOff, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/Avatar';
import { useProfiles, useSetUserBlocked, useSetUserRole } from '@/hooks/useCommunity';
import { useSession } from '@/hooks/useAuth';
import { fmtDate, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: me } = useSession();
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const { data, isLoading } = useProfiles({ search: deferred });
  const block = useSetUserBlocked();
  const role = useSetUserRole();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title={t('admin.users.title')} subtitle={data ? t('admin.users.count', { count: data.length }) : undefined} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder={t('admin.users.search')}
            aria-label={t('admin.users.search')}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        {isLoading && <div className="space-y-2 p-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>}
        {!isLoading && data?.length === 0 && <EmptyState icon={Users} title={t('admin.users.empty')} className="m-3" />}
        {!!data?.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.users.name')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('auth.email')}</TableHead>
                <TableHead className="text-right">{t('admin.users.points')}</TableHead>
                <TableHead className="hidden xl:table-cell">{t('admin.users.registered')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('admin.users.lastActive')}</TableHead>
                <TableHead>{t('admin.users.role')}</TableHead>
                <TableHead><span className="sr-only">{t('admin.events.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => {
                const self = p.id === me?.id;
                return (
                  <TableRow key={p.id} className={cn(p.is_blocked && 'opacity-60')}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar first={p.first_name} last={p.last_name} url={p.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.last_name} {p.first_name}</p>
                          <p className="truncate text-xs text-muted-foreground md:hidden">{p.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{p.email}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{p.points}</TableCell>
                    <TableCell className="hidden whitespace-nowrap xl:table-cell">{fmtDate(p.created_at, 'dd.MM.yyyy')}</TableCell>
                    <TableCell className="hidden whitespace-nowrap lg:table-cell">{fmtRelative(p.last_active_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', p.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          {t(`role.${p.role}`)}
                        </span>
                        {p.is_blocked && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">{t('admin.users.blocked')}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={self} aria-label={t('admin.users.actionsFor', { name: `${p.first_name} ${p.last_name}` })}>
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {p.is_blocked ? (
                            <DropdownMenuItem onSelect={() => block.mutate({ id: p.id, blocked: false })}><UserCheck /> {t('admin.users.unblock')}</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => block.mutate({ id: p.id, blocked: true })}><Ban /> {t('admin.users.block')}</DropdownMenuItem>
                          )}
                          {p.role === 'admin' ? (
                            <DropdownMenuItem onSelect={() => role.mutate({ id: p.id, role: 'resident' })}><ShieldOff /> {t('admin.users.removeAdmin')}</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => role.mutate({ id: p.id, role: 'admin' })}><Shield /> {t('admin.users.makeAdmin')}</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
