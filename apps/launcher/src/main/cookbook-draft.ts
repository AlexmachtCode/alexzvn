import type { Recipe, RecipeDraftInput, RecipeDraftResult } from '@shared/types';
import { resolveProxy, resolveProxyKey, resolvePolaris } from './settings';

/**
 * Reicht ein neues Rezept ein (Pfad B = KI). Der Client bleibt tokenlos; der PR
 * wird immer serverseitig vom Release-Proxy geöffnet (GitHub-Token bleibt an
 * einer auditierten Stelle).
 *
 * Reihenfolge (Entscheidung: Polaris primär + Anthropic-Fallback):
 *  1) Lokaler Polaris-Agent erzeugt das Rezept-JSON → an den Proxy als
 *     `mode:"form"` (Proxy validiert + öffnet den PR). Daten bleiben intern.
 *  2) Ist Polaris nicht konfiguriert/erreichbar → Proxy lässt Anthropic das
 *     Rezept erzeugen (`mode:"ai"`). So funktioniert es auch offline-fern (z. B.
 *     Event-Laptop ohne Polaris) weiter.
 *
 * Das feste Format ist strukturell erzwungen (Schema + Compiler + CI + Review) —
 * die KI füllt nur Inhalt.
 */
export async function submitRecipeDraft(input: RecipeDraftInput): Promise<RecipeDraftResult> {
  const title = input.title?.trim();
  const notes = input.notes?.trim();
  if (!title || !notes) {
    return { ok: false, message: 'Bitte Titel und Notizen ausfüllen.' };
  }

  const proxy = resolveProxy();
  const key = resolveProxyKey();
  if (!proxy || !key) {
    return {
      ok: false,
      message: 'Kein Einreich-Kanal verfügbar — Proxy/Key in den Einstellungen prüfen.',
    };
  }
  const clean = { title, category: input.category, notes };

  // 1) Bevorzugt: lokaler Polaris-Agent erzeugt das Rezept (interne Daten bleiben intern).
  try {
    const recipe = await draftViaPolaris(clean);
    if (recipe) {
      return await openPrViaProxy(proxy, key, { mode: 'form', recipe });
    }
  } catch {
    // Polaris nicht erreichbar/Fehler → transparent auf den Anthropic-Fallback gehen.
  }

  // 2) Fallback: Proxy lässt Anthropic das Rezept erzeugen.
  return await openPrViaProxy(proxy, key, { mode: 'ai', input: clean });
}

/**
 * Lokaler Polaris-Agent: Stichpunkte → fertiges Rezept-Objekt. Liefert `null`,
 * wenn Polaris nicht konfiguriert ist (dann greift der Anthropic-Fallback).
 *
 * TODO(Polaris-Vertrag): Request-/Response-Form gegen die echte Polaris-API
 * bestätigen. Angenommen wird aktuell: POST <url> { task, title, category, notes }
 * → { recipe }. Falls Polaris' Agent ohne Schema-Vorgabe nicht formattreu
 * antwortet, hier zusätzlich `buildAuthoringPrompt()` aus @jm/cookbook mitschicken.
 */
async function draftViaPolaris(input: {
  title: string;
  category: RecipeDraftInput['category'];
  notes: string;
}): Promise<Recipe | null> {
  const polaris = resolvePolaris();
  if (!polaris) return null; // nicht konfiguriert → Fallback

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (polaris.key) headers['Authorization'] = `Bearer ${polaris.key}`;

  const res = await fetch(polaris.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ task: 'cookbook-recipe', ...input }),
  });
  if (!res.ok) throw new Error(`Polaris ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as { recipe?: Recipe };
  return data.recipe ?? null;
}

/** Rezept (fertig oder per KI zu erzeugen) an den Proxy → der öffnet den PR. */
async function openPrViaProxy(
  proxy: string,
  key: string,
  payload: { mode: 'form'; recipe: Recipe } | { mode: 'ai'; input: RecipeDraftInput },
): Promise<RecipeDraftResult> {
  try {
    const res = await fetch(`${proxy.replace(/\/$/, '')}/cookbook/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Proxy-Key': key },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      prUrl?: string;
      error?: string;
      details?: string[];
    };
    if (res.ok && data.ok) {
      return {
        ok: true,
        url: data.prUrl,
        message: data.prUrl ? `Entwurf als PR geöffnet: ${data.prUrl}` : 'Entwurf eingereicht.',
      };
    }
    const detail = data.details?.length ? ` (${data.details.join('; ')})` : '';
    return {
      ok: false,
      message: `Einreichen fehlgeschlagen: ${data.error || `HTTP ${res.status}`}${detail}`,
    };
  } catch (e) {
    return { ok: false, message: `Senden fehlgeschlagen: ${String((e as Error).message || e)}` };
  }
}
