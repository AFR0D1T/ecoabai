import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useUpdateProfile } from '@/hooks/useAuth';
import type { Profile } from '@/types';

const schema = z.object({
  first_name: z.string().trim().min(1, 'validation.required').max(50, 'validation.tooLong'),
  last_name: z.string().trim().min(1, 'validation.required').max(50, 'validation.tooLong'),
});
type FormValues = z.infer<typeof schema>;

export function EditProfileDialog({ user, open, onOpenChange }: { user: Profile; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ first_name: user.first_name, last_name: user.last_name });
  }, [open, user, reset]);

  const err = (m?: string) => (m ? t(m) : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.edit')}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((v) => update.mutate(v, { onSuccess: () => onOpenChange(false) }))}
          noValidate
        >
          <Field label={t('auth.firstName')} htmlFor="pf-first" error={err(errors.first_name?.message)}>
            <Input id="pf-first" {...register('first_name')} aria-invalid={!!errors.first_name} />
          </Field>
          <Field label={t('auth.lastName')} htmlFor="pf-last" error={err(errors.last_name?.message)}>
            <Input id="pf-last" {...register('last_name')} aria-invalid={!!errors.last_name} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" />} {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
