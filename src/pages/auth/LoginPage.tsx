import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2, LogIn, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useSignIn } from '@/hooks/useAuth';
import { errorCode } from '@/api/errors';
import { DEV_TEST_ACCOUNTS } from '@/config';
import type { Profile, SignInInput } from '@/types';
import { AuthCard, safeNext } from './AuthCard';

const schema = z.object({
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signIn = useSignIn();
  const { register, handleSubmit, formState: { errors } } = useForm<SignInInput>({ resolver: zodResolver(schema) });

  const done = (user: Profile) => navigate(safeNext(params.get('next'), user.role === 'admin' ? '/admin' : '/'), { replace: true });
  const onSubmit = handleSubmit((v) => signIn.mutate(v, { onSuccess: done }));
  const err = (m?: string) => (m ? t(m) : undefined);

  return (
    <AuthCard title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {signIn.isError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {t(`errors.${errorCode(signIn.error)}`)}
          </p>
        )}
        <Field label={t('auth.email')} htmlFor="email" error={err(errors.email?.message)}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label={t('auth.password')} htmlFor="password" error={err(errors.password?.message)}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">{t('auth.forgot')}</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={signIn.isPending}>
          {signIn.isPending ? <Loader2 className="animate-spin" /> : <LogIn />} {t('auth.signIn')}
        </Button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-5 space-y-2 border-t pt-4">
          <p className="text-center text-xs font-medium uppercase text-muted-foreground">{t('auth.devOnly')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={signIn.isPending} onClick={() => signIn.mutate(DEV_TEST_ACCOUNTS.resident, { onSuccess: done })}>
              <User /> {t('auth.asResident')}
            </Button>
            <Button variant="secondary" disabled={signIn.isPending} onClick={() => signIn.mutate(DEV_TEST_ACCOUNTS.admin, { onSuccess: done })}>
              <Shield /> {t('auth.asAdmin')}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next') as string)}` : ''}`} className="font-medium text-primary hover:underline">
          {t('auth.register')}
        </Link>
      </p>
    </AuthCard>
  );
}
