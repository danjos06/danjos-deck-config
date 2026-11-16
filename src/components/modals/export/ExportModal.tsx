import { useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { Modal, Tabs } from '../../ui';
import { BackupTab } from './BackupTab';
import { InoTab } from './InoTab';

type ExportTab = 'ino' | 'json';
const TABS = [
  { value: 'ino', label: 'Firmware .ino', icon: 'code' },
  { value: 'json', label: 'Backup JSON', icon: 'data_object' },
] as const;

export function ExportModal() {
  const open = useUiStore((s) => s.modal === 'export');
  const close = useUiStore((s) => s.closeModal);
  const [tab, setTab] = useState<ExportTab>('ino');

  return (
    <Modal open={open} onClose={close} title="Exportar" subtitle="Firmware para o ESP32-S3 e backup da configuração" className="[--w:1180px]">
      <Tabs label="Tipo de exportação" value={tab} onChange={setTab} items={TABS} className="px-3 sm:px-4" />
      {tab === 'ino' ? <InoTab open={open} /> : <BackupTab />}
    </Modal>
  );
}
