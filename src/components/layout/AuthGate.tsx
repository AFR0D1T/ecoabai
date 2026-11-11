import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useAuth';

interface AuthGateCtx {
  /** Выполнит действие, если пользователь вошёл, иначе покажет модалку «Войдите». */
  requireAuth: (action?: () => void) => boolean;
}

const Ctx = createContext<AuthGateCtx | null>(null);

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const requireAuth = useCallback(
    (action?: () => void) => {
      if (user) {
        action?.();
        return true;
      }
      setOpen(true);
      return false;
    },
    [user],
  );

  const next = encodeURIComponent(location.pathname + location.search);
  const value = useMemo(() => ({ requireAuth }), [requireAuth]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('auth.gateTitle')}</DialogTitle>
            <DialogDescription>{t('auth.gateText')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" asChild onClick={() => setOpen(false)}>
              <Link to={`/register?next=${next}`}>{t('auth.register')}</Link>
            </Button>
            <Button asChild onClick={() => setOpen(false)}>
              <Link to={`/login?next=${next}`}>
                <LogIn /> {t('auth.signIn')}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useAuthGate(): AuthGateCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuthGate outside AuthGateProvider');
  return v;
}
