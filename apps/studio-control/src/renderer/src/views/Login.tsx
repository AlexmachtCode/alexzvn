// Anmeldung im Inhalt des Rahmens (UX Welle 2b, Studio-Control d1; B15, Spec 3.8): Kopf mit Logo, „JM Studio Control“ und
// Hell/Dunkel kommt aus dem AppShell, die Karte wiederholt Logo und Titel darum nicht mehr. Felder, Anfrage und Fehlertexte wie
// bisher.
import { useState } from 'react';
import { Card } from '@jm/ui';
import { Button } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useSession } from '@/store/session';
import { apiFetch } from '@/sync/client';
import type { SessionUser } from '@shared/protocol';

export function LoginView() {
  const setSession = useSession((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: SessionUser }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setSession(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <SectionHeader className="mb-6">Anmelden</SectionHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            Benutzer
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            Passwort
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p className="text-xs text-[var(--destructive)] uppercase tracking-wide font-bold">
              {error === '401: {"error":"invalid_credentials"}' ? 'Falsche Zugangsdaten' : error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="mt-2">
            {busy ? 'Anmelden …' : 'Anmelden'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
