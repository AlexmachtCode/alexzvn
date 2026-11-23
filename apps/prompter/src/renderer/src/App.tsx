import { useEffect } from 'react';
import { PrompterOberflaeche } from '@/views/PrompterOberflaeche';
import { usePrompter } from '@/store/prompter';

export function App(): React.JSX.Element {
  const load = usePrompter((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <PrompterOberflaeche />;
}
