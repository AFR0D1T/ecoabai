import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/components/layout/ThemeProvider';

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="top-center"
      richColors
      closeButton
      style={{ zIndex: 1300 }}
      toastOptions={{ className: 'text-sm' }}
    />
  );
}
