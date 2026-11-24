// Reiter Setup (UX Welle 2b, Studio-Control d1; S4-A): bleibt Reiter mit Inventar, Discovery und Benutzer (nur mit users:read).
// Die Unterreiter sind Tabs aus @jm/ui wie die Reiter der Werkzeugleiste (vorher ein eigener TabButton); Vorgabe Inventar, bei
// jedem Abschnittswechsel zurück, nicht gemerkt – wie bisher.
import { useState } from 'react';
import { Card, Tabs, type TabItem } from '@jm/ui';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useSession } from '@/store/session';
import { canDo } from '@shared/roles';
import { DeviceTable } from '@/components/setup/DeviceTable';
import { DiscoverPanel } from '@/components/setup/DiscoverPanel';
import { UserManager } from '@/components/setup/UserManager';

type Tab = 'inventory' | 'discovery' | 'users';

export function SetupView() {
  const role = useSession((s) => s.user?.role);
  const isAdmin = role ? canDo(role, 'users:read') : false;
  const [tab, setTab] = useState<Tab>('inventory');
  const reiter: TabItem<Tab>[] = [
    { key: 'inventory', label: 'Inventar' },
    { key: 'discovery', label: 'Discovery' },
    ...(isAdmin ? [{ key: 'users' as const, label: 'Benutzer' }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHeader>Setup</SectionHeader>
        <Headline variant="section" className="mt-2">
          Geräte · Discovery · Benutzer
        </Headline>
      </div>
      <Tabs items={reiter} value={tab} onChange={setTab} fill={false} className="self-start" />
      <Card className="p-6">
        {tab === 'inventory' && <DeviceTable />}
        {tab === 'discovery' && <DiscoverPanel />}
        {tab === 'users' && isAdmin && <UserManager />}
      </Card>
    </div>
  );
}
