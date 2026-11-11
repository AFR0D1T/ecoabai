import { useTranslation } from 'react-i18next';
import { Download, Share, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isIos, isStandalone, useInstallPrompt } from '@/lib/pwa';

/** Предложение поставить EcoAbai на главный экран телефона. */
export function InstallAppCard() {
  const { t } = useTranslation();
  const { canInstall, install } = useInstallPrompt();
  if (isStandalone()) return null;
  const ios = isIos();
  if (!canInstall && !ios) return null;

  return (
    <Card className="flex items-start gap-3 border-primary/40 bg-secondary/60 p-4">
      <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
      <div className="flex-1 space-y-2">
        <p className="font-semibold">{t('pwa.title')}</p>
        {canInstall ? (
          <>
            <p className="text-sm text-muted-foreground">{t('pwa.text')}</p>
            <Button size="sm" onClick={() => void install()}>
              <Download /> {t('pwa.install')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('pwa.iosHintBefore')} <Share className="inline h-4 w-4 align-text-bottom" aria-label={t('pwa.shareIcon')} />{' '}
            {t('pwa.iosHintAfter')}
          </p>
        )}
      </div>
    </Card>
  );
}
