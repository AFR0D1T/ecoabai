import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="container max-w-lg py-12">
      <EmptyState
        icon={MapPinOff}
        title={t('notFound.title')}
        description={t('notFound.text')}
        action={<Button asChild><Link to="/">{t('notFound.home')}</Link></Button>}
      />
    </div>
  );
}
