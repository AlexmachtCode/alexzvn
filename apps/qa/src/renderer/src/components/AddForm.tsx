import { useState } from 'react';
import { Button, TextInput } from '@jm/ui';
import { useQa } from '@/store/useQa';

/** Operator fügt eine Wortmeldung von Hand hinzu. */
export function AddForm(): React.JSX.Element {
  const { addEntry } = useQa();
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [question, setQuestion] = useState('');

  const submit = (): void => {
    if (!name.trim()) return;
    void addEntry({ name, affiliation, question });
    setName('');
    setAffiliation('');
    setQuestion('');
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
      <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Wortmeldung hinzufügen</h2>
      <div className="grid grid-cols-2 gap-2">
        <TextInput value={name} placeholder="Name *" onChange={setName} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <TextInput
          value={affiliation}
          placeholder="Funktion / Medium / Fraktion"
          onChange={setAffiliation}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <TextInput className="mt-2" value={question} placeholder="Frage (optional)" onChange={setQuestion} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="outline" size="sm" uppercase={false} onClick={submit} disabled={!name.trim()}>
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}
