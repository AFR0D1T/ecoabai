import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
