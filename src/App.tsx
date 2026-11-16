import { MotionConfig } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { ModalHost } from '@/components/modals/ModalHost';
import { Toaster } from '@/components/ui';
import { useDeckBootstrap } from '@/hooks/useDeckBootstrap';
import { useShortcuts } from '@/hooks/useShortcuts';

export default function App() {
  useDeckBootstrap();
  useShortcuts();
  return (
    <MotionConfig reducedMotion="user">
      <AppShell />
      <ModalHost />
      <Toaster />
    </MotionConfig>
  );
}
