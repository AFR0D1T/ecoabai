import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { useSignUp } from '@/hooks/useAuth';
import { useStreets } from '@/hooks/useSettings';
import { errorCode } from '@/api/errors';
import { streetName } from '@/lib/format';
import { AuthCard, safeNext } from './AuthCard';

const schema = z
  .object({
    first_name: z.string().trim().min(1, 'validation.required').max(50, 'validation.tooLong'),
    last_name: z.string().trim().min(1, 'validation.required').max(50, 'validation.tooLong'),
    email: z.string().trim().min(1, 'validation.required').email('validation.email'),
    street_id: z.string({ required_error: 'validation.street' }).min(1, 'validation.street'),
    password: z.string().min(6, 'validation.passwordMin'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'validation.passwordMatch' });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signUp = useSignUp();
  const { data: streets = [] } = useStreets();
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { street_id: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit(({ confirm: _confirm, ...v }) =>
    signUp.mutate(v, { onSuccess: () => navigate(safeNext(params.get('next'), '/'), { replace: true }) }),
  );

  return (
    <AuthCard title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {signUp.isError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {t(`errors.${errorCode(signUp.error)}`)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('auth.firstName')} htmlFor="first_name" error={err(errors.first_name?.message)}>
            <Input id="first_name" autoComplete="given-name" aria-invalid={!!errors.first_name} {...register('first_name')} />
          </Field>
          <Field label={t('auth.lastName')} htmlFor="last_name" error={err(errors.last_name?.message)}>
            <Input id="last_name" autoComplete="family-name" aria-invalid={!!errors.last_name} {...register('last_name')} />
          </Field>
        </div>
        <Field label={t('auth.email')} htmlFor="email" error={err(errors.email?.message)}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label={t('auth.street')} htmlFor="street" error={err(errors.street_id?.message)}>
          <Controller
            control={control}
            name="street_id"
            render={({ field }) => (
              <SimpleSelect
                id="street"
                value={field.value}
                onValueChange={field.onChange}
                placeholder={t('auth.chooseStreet')}
                options={streets.map((s) => ({ value: s.id, label: streetName(s) }))}
              />
            )}
          />
        </Field>
        <Field label={t('auth.password')} htmlFor="password" error={err(errors.password?.message)} hint={t('validation.passwordMin')}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={err(errors.confirm?.message)}>
          <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={signUp.isPending}>
          {signUp.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} {t('auth.register')}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">{t('auth.signIn')}</Link>
      </p>
    </AuthCard>
  );
}
