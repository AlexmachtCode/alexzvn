import { create } from 'zustand';
import { COOKBOOK } from '@jm/cookbook';
import type { Recipe } from '@jm/cookbook';
import type { RecipeDraftInput, RecipeDraftResult } from '@shared/types';
import { useTools } from '@/store/tools';

// Kochbuch-Reader. Start mit dem gebündelten Stand (Offline-Erststart), dann live
// vom Proxy nachgeladen (analog Patch Notes / store/changelog.ts). `load()` und das
// `cookbook-changed`-Event (store/tools.ts) übernehmen den Live-Stand.
interface CookbookStore {
  recipes: Recipe[];
  /** Modal offen? */
  open: boolean;
  /** Aktuell gewähltes Rezept (ID) oder null. */
  selectedId: string | null;
  /** Formular „Neues Rezept" (Pfad B = KI) offen? */
  draftOpen: boolean;
  load: () => Promise<void>;
  openCookbook: (recipeId?: string) => void;
  closeCookbook: () => void;
  select: (recipeId: string) => void;
  findRecipe: (id: string) => Recipe | undefined;
  openDraft: () => void;
  closeDraft: () => void;
  /** Rezept einreichen (KI erzeugt es, öffnet einen PR). Notice landet im Tools-Store. */
  submitDraft: (input: RecipeDraftInput) => Promise<RecipeDraftResult>;
}

export const useCookbook = create<CookbookStore>((set, get) => ({
  recipes: COOKBOOK.recipes as Recipe[],
  open: false,
  selectedId: null,
  draftOpen: false,
  load: async () => {
    try {
      const live = await window.jmps.getCookbook();
      if (Array.isArray(live) && live.length) set({ recipes: live });
    } catch {
      // offline / Quelle nicht erreichbar → gebündelten Stand behalten
    }
  },
  openCookbook: (recipeId) =>
    set((s) => ({ open: true, selectedId: recipeId ?? s.selectedId ?? s.recipes[0]?.id ?? null })),
  closeCookbook: () => set({ open: false }),
  select: (recipeId) => set({ selectedId: recipeId }),
  findRecipe: (id) => get().recipes.find((r) => r.id === id),
  openDraft: () => set({ draftOpen: true }),
  closeDraft: () => set({ draftOpen: false }),
  submitDraft: async (input) => {
    const res = await window.jmps.submitRecipeDraft(input);
    // Notice nur bei Fehler — Erfolg zeigt das Modal inline mit klickbarem PR-Link.
    if (!res.ok) useTools.getState().setNotice(res.message ?? 'Senden fehlgeschlagen.');
    return res;
  },
}));
