import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useConfirmPasswordReset } from '@/hooks/useAuth';
import { errorCode } from '@/api/errors';
import { AuthCard } from './AuthCard';

const schema = z
  .object({ password: z.string().min(6, 'validation.passwordMin'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'validation.passwordMatch' });
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const confirm = useConfirmPasswordReset();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const err = (m?: string) => (m ? t(m) : undefined);

  if (confirm.isSuccess) {
    return (
      <AuthCard title={t('auth.resetDoneTitle')}>
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('auth.resetDoneText')}</p>
          <Button asChild className="w-full"><Link to="/login">{t('auth.signIn')}</Link></Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.resetTitle')}>
      {!token ? (
        <p role="alert" className="text-sm text-destructive">{t('errors.invalid_token')}</p>
      ) : (
        <form onSubmit={handleSubmit((v) => confirm.mutate({ token, password: v.password }))} className="space-y-4" noValidate>
          {confirm.isError && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {t(`errors.${errorCode(confirm.error)}`)}
            </p>
          )}
          <Field label={t('auth.newPassword')} htmlFor="password" error={err(errors.password?.message)}>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={err(errors.confirm?.message)}>
            <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={confirm.isPending}>
            {confirm.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />} {t('auth.setPassword')}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline">{t('auth.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
}
