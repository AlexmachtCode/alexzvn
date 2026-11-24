// Benutzer im Setup. Rollen-Auswahl mit „Setzen“ (UX Welle 2b, Nachtrag zu Task 19, Global Constraint „Wahl ≠ Bewegung“): eine
// native Auswahl feuert change auch per Pfeiltaste; darum ändert die Wahl nur den Entwurf der Zeile, und erst „Setzen“ ruft dasselbe
// updateRole wie bisher. Sonst unverändert (Liste, Passwort, Löschen, Anlegen).
import { useEffect, useId, useState } from 'react';
import { PEERS_TEXTE } from '@jm/settings';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { Button } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { STUDIO_TEXTE } from '@/lib/oberflaeche';
import { apiFetch } from '@/sync/client';
import type { Role } from '@shared/roles';
import type { UserRow } from '@/types/admin';

const ROLES: Role[] = ['admin', 'operator', 'viewer'];

/** Entwurf der Rollen-Auswahl je Benutzer (Kennung → gewählte Rolle). Eine Wahl gleich der gemeldeten Rolle ist kein Entwurf. */
export type RollenEntwurf = Readonly<Record<number, Role>>;

/** Der Entwurf ohne die Zeile `id`. */
function ohneZeile(entwurf: RollenEntwurf, id: number): RollenEntwurf {
  const rest: Record<number, Role> = { ...entwurf };
  delete rest[id];
  return rest;
}

/** Eine Wahl übernehmen, nur in den Entwurf; gleicht sie der gemeldeten Rolle, fällt die Zeile aus dem Entwurf. */
export function rollenEntwurfMit(entwurf: RollenEntwurf, id: number, rolle: Role, gemeldet: Role): RollenEntwurf {
  return rolle === gemeldet ? ohneZeile(entwurf, id) : { ...ohneZeile(entwurf, id), [id]: rolle };
}

/** Was die Rollen-Auswahl einer Zeile zeigt und auslöst (hooklos prüfbar). */
export interface RollenZeile {
  /** Angezeigte Rolle: der Entwurf, sonst die gemeldete. */
  wert: Role;
  /** Die eigene Zeile: Auswahl und „Setzen“ gesperrt (wie bisher die Auswahl). */
  eigene: boolean;
  /** Warum „Setzen“ gesperrt ist; undefined = frei (der Entwurf weicht von der gemeldeten Rolle ab). */
  setzenGrund: string | undefined;
  /** Auswahl (change, auch per Pfeiltaste): ändert nur den Entwurf, sendet nichts. */
  waehlen(rolle: Role): void;
  /** „Setzen“: ruft updateRole(id, Entwurf) wie bisher; gelingt es, fällt der gesendete Entwurf weg. */
  setzen(): Promise<void>;
}

/**
 * Rollen-Auswahl einer Zeile: frei ist „Setzen“ nur, wenn der Entwurf von der gemeldeten Rolle abweicht, sonst gesperrt mit Grund.
 * Nach dem Setzen fällt der Entwurf weg, die Zeile folgt wieder der gemeldeten Rolle; so dreht kein veralteter Entwurf eine spätere
 * Änderung (aus einem anderen Fenster) still zurück. Verworfen wird nur der gesendete Entwurf, eine neue Wahl während der Anfrage
 * bleibt. Scheitert die Anfrage, bleibt der Entwurf; der Fehler bleibt still wie bisher.
 */
export function rollenZeile(a: {
  user: Pick<UserRow, 'id' | 'role'>;
  meId: number | undefined;
  entwurf: RollenEntwurf;
  setzeEntwurf(f: (e: RollenEntwurf) => RollenEntwurf): void;
  updateRole(id: number, role: Role): Promise<void>;
}): RollenZeile {
  const { id, role: gemeldet } = a.user;
  const eigene = id === a.meId;
  const entwurf = eigene ? undefined : a.entwurf[id];
  const abweichung = entwurf !== undefined && entwurf !== gemeldet;
  const T = STUDIO_TEXTE.rollenWahl;
  const setzenGrund = eigene ? T.eigene : abweichung ? undefined : T.unveraendert;
  return {
    wert: entwurf ?? gemeldet,
    eigene,
    setzenGrund,
    waehlen: (rolle) => {
      if (!eigene) a.setzeEntwurf((e) => rollenEntwurfMit(e, id, rolle, gemeldet));
    },
    setzen: async () => {
      if (setzenGrund !== undefined || entwurf === undefined) return;
      const gesendet = entwurf;
      await a.updateRole(id, gesendet).then(
        () => a.setzeEntwurf((e) => (e[id] === gesendet ? ohneZeile(e, id) : e)),
        () => undefined,
      );
    },
  };
}

/**
 * Eine Zeile der Benutzerliste, ohne Hooks: Name, Rollen-Auswahl mit „Setzen“ (gesperrt mit sichtbarem Grund darunter), Datum,
 * „Passwort“ und „Löschen“ wie bisher.
 */
export function BenutzerZeile({
  user,
  zeile,
  grundId,
  loeschenGesperrt,
  onPasswort,
  onLoeschen,
}: {
  user: UserRow;
  zeile: RollenZeile;
  grundId: string;
  loeschenGesperrt: boolean;
  onPasswort(): void;
  onLoeschen(): void;
}): React.JSX.Element {
  const grund = zeile.setzenGrund;
  return (
    <div className="grid grid-cols-[1.5fr_220px_140px_auto] gap-3 items-center px-2 py-3 border-b border-[var(--border)]/20">
      <div className="text-sm font-semibold">{user.username}</div>
      <div data-studio="rolle" className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <select
            value={zeile.wert}
            onChange={(e) => zeile.waehlen(e.target.value as Role)}
            disabled={zeile.eigene}
            className="h-9 w-[120px] px-2 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            uppercase={false}
            aria-label={PEERS_TEXTE.setzenFuer(user.username)}
            aria-describedby={grund === undefined ? undefined : grundId}
            disabled={grund !== undefined}
            onClick={() => void zeile.setzen()}
          >
            {PEERS_TEXTE.setzen}
          </Button>
        </div>
        {grund === undefined ? null : (
          <p id={grundId} className="text-[11px] text-[var(--muted-foreground)]">
            {grund}
          </p>
        )}
      </div>
      <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
        {new Date(user.created_at).toLocaleDateString('de-DE')}
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onPasswort}>
          Passwort
        </Button>
        <Button size="sm" variant="ghost" onClick={onLoeschen} disabled={loeschenGesperrt}>
          Löschen
        </Button>
      </div>
    </div>
  );
}

export function UserManager() {
  const users = useApp((s) => s.users);
  const setUsers = useApp((s) => s.setUsers);
  const token = useSession((s) => s.token);
  const me = useSession((s) => s.user);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Entwurf der Rollen-Auswahl je Zeile; die gemeldete Rolle kommt immer frisch aus dem Store, nie aus einer Kopie.
  const [entwurf, setEntwurf] = useState<RollenEntwurf>({});
  const grundBasis = useId();

  useEffect(() => {
    refresh();
  }, []);

  async function refresh(): Promise<void> {
    try {
      const res = await apiFetch<{ users: UserRow[] }>('/api/users', { token });
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function create(username: string, password: string, role: Role): Promise<void> {
    setError(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        token,
        body: JSON.stringify({ username, password, role }),
      });
      await refresh();
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function updateRole(id: number, role: Role): Promise<void> {
    await apiFetch(`/api/users/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role }),
    });
    await refresh();
  }

  async function resetPassword(id: number): Promise<void> {
    const pw = prompt('Neues Passwort (min. 6 Zeichen)');
    if (!pw || pw.length < 6) return;
    await apiFetch(`/api/users/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ password: pw }),
    });
  }

  async function remove(id: number): Promise<void> {
    if (id === me?.id) {
      alert('Du kannst dich nicht selbst löschen.');
      return;
    }
    if (!confirm('Benutzer wirklich löschen?')) return;
    await apiFetch(`/api/users/${id}`, { method: 'DELETE', token });
    await refresh();
  }

  return (
    <div>
      {error && <p className="text-xs text-[var(--destructive)] mb-3 select-text">{error}</p>}
      <div className="grid grid-cols-[1.5fr_220px_140px_auto] gap-3 px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] border-b border-[var(--border)]/40">
        <div>Benutzer</div>
        <div>Rolle</div>
        <div>Erstellt</div>
        <div></div>
      </div>
      {users.map((u) => (
        <BenutzerZeile
          key={u.id}
          user={u}
          zeile={rollenZeile({ user: u, meId: me?.id, entwurf, setzeEntwurf: setEntwurf, updateRole })}
          grundId={`${grundBasis}-rolle-${u.id}`}
          loeschenGesperrt={u.id === me?.id}
          onPasswort={() => resetPassword(u.id)}
          onLoeschen={() => remove(u.id)}
        />
      ))}
      <div className="mt-4">
        {adding ? (
          <AddUserForm onCreate={create} onCancel={() => setAdding(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            + Benutzer anlegen
          </Button>
        )}
      </div>
    </div>
  );
}

function AddUserForm({
  onCreate,
  onCancel,
}: {
  onCreate: (username: string, password: string, role: Role) => Promise<void>;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onCreate(username, password, role);
      }}
      className="flex items-end gap-2 flex-wrap"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Benutzer
        <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Passwort
        <Input
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Rolle
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit">Anlegen</Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Abbrechen
      </Button>
    </form>
  );
}
