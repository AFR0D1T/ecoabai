import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { usePasswordReset } from '@/hooks/useAuth';
import { AuthCard } from './AuthCard';

const schema = z.object({ email: z.string().trim().min(1, 'validation.required').email('validation.email') });

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const reset = usePasswordReset();
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  return (
    <AuthCard title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form onSubmit={handleSubmit((v) => reset.mutate(v.email))} className="space-y-4" noValidate>
        <Field label={t('auth.email')} htmlFor="email" error={errors.email?.message ? t(errors.email.message) : undefined}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? <Loader2 className="animate-spin" /> : <Mail />} {t('auth.sendReset')}
        </Button>
        {reset.isSuccess && <p role="status" className="text-center text-sm text-primary">{t('auth.resetSent')}</p>}
      </form>
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline">{t('auth.backToLogin')}</Link>
      </p>
    </AuthCard>
  );
}
