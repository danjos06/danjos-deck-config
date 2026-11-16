import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/store/uiStore';
import { DeckStage } from '../deck/DeckStage';
import { Inspector } from '../inspector/Inspector';
import { PageSwitcher } from '../pages/PageSwitcher';
import { PagesRail } from '../pages/PagesRail';
import { Drawer } from '../ui';
import { TopBar } from './TopBar';

/**
 * Grid shell: top bar / pages rail / stage / inspector.
 * >=1280px inspector docked; <1280px it becomes a right drawer opened by selection;
 * <1024px the pages rail collapses into a top switcher + left sheet.
 */
export function AppShell() {
  const wide = useMediaQuery('(min-width: 1280px)');
  const lg = useMediaQuery('(min-width: 1024px)');
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);

  return (
    <div className="bg-studio flex h-dvh w-full min-w-0 flex-col overflow-hidden">
      <TopBar />
      {!lg && <PageSwitcher />}
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] min-w-0 flex-1">
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid-cols-[clamp(210px,16vw,260px)_minmax(0,1fr)] xl:grid-cols-[clamp(220px,15vw,260px)_minmax(0,1fr)_clamp(340px,22vw,400px)]">
          {lg && (
            <aside className="surface-matte min-h-0 min-w-0 border-r border-white/[0.06] bg-ink-900/50">
              <PagesRail className="h-full" />
            </aside>
          )}
          <main className="relative min-h-0 min-w-0">
            <DeckStage />
          </main>
          {wide && (
            <aside aria-label="Inspetor" className="surface-matte min-h-0 min-w-0 border-l border-white/[0.06] bg-ink-900/70">
              <Inspector />
            </aside>
          )}
        </div>
      </div>
      {!wide && (
        <Drawer open={selection !== null} onClose={() => select(null)} title="Inspetor" side="right" bare className="[--w:420px]">
          <div className="h-full">
            <Inspector />
          </div>
        </Drawer>
      )}
    </div>
  );
}
