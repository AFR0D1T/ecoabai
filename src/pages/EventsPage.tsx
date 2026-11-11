import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarX, List } from 'lucide-react';
import type { EventCategory, EventScope } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { EventCard, EventCardSkeleton } from '@/features/events/EventCard';
import { EventCalendar } from '@/features/events/EventCalendar';
import { useEvents } from '@/hooks/useEvents';
import { EVENT_CATEGORIES, CATEGORY_META } from '@/lib/domain';

export default function EventsPage() {
  const { t } = useTranslation();
  const [scope, setScope] = useState<EventScope>('upcoming');
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [view, setView] = useState<'list' | 'calendar'>('list');

  // в календаре показываем всё (и прошедшие, и будущие)
  const { data, isLoading } = useEvents({ scope: view === 'calendar' ? 'all' : scope, category });

  return (
    <div className="container max-w-4xl py-4 md:py-8">
      <PageHeader title={t('events.title')} subtitle={t('events.subtitle')} />
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          {view === 'list' ? (
            <Tabs value={scope} onValueChange={(v) => setScope(v as EventScope)} className="flex-1 sm:flex-none">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="upcoming" className="flex-1">{t('events.upcoming')}</TabsTrigger>
                <TabsTrigger value="past" className="flex-1">{t('events.past')}</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <div className="flex-1" />
          )}
          <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'calendar')} className="ml-auto">
            <TabsList>
              <TabsTrigger value="list" aria-label={t('events.viewList')}>
                <List /> <span className="hidden sm:inline">{t('events.viewList')}</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" aria-label={t('events.viewCalendar')}>
                <CalendarDays /> <span className="hidden sm:inline">{t('events.viewCalendar')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* категории — горизонтально прокручиваемые «чипсы», удобнее пальцем, чем выпадающий список */}
        <div
          role="radiogroup"
          aria-label={t('events.category')}
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(['all', ...EVENT_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'flex h-10 shrink-0 snap-start items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                category === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
              )}
            >
              {c !== 'all' && <span aria-hidden>{CATEGORY_META[c].emoji}</span>}
              {c === 'all' ? t('events.allCategories') : t(`eventCategory.${c}`)}
            </button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <EventCalendar events={data ?? []} />
      ) : (
        <div className="space-y-3">
          {isLoading && Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} />)}
          {!isLoading && data?.length === 0 && (
            <EmptyState
              icon={CalendarX}
              title={scope === 'upcoming' ? t('events.emptyUpcoming') : t('events.emptyPast')}
              description={t('events.emptyHint')}
            />
          )}
          {data?.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
