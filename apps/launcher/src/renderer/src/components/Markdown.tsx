import { Fragment, type ReactNode } from 'react';

/**
 * Schlanker, sicherer Markdown-Renderer (kein dangerouslySetInnerHTML, keine
 * externe Lib — passt zur Kochbuch-Designlinie). Deckt die Teilmenge ab, die die
 * Best-Practices-Docs nutzen: Überschriften, Absätze, Auflistungen inkl.
 * Checkboxen, Tabellen, Code-Fences (ASCII-Flowcharts), Trennlinien; inline fett
 * (**…**), Code (`…`) und Links ([text](url)).
 */

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: { text: string; checked?: boolean }[] }
  | { t: 'code'; lines: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'hr' };

const cells = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSep = (cs: string[]): boolean => cs.length > 0 && cs.every((c) => /^:?-{2,}:?$/.test(c));

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = (): void => {
    if (para.length) {
      blocks.push({ t: 'p', text: para.join(' ') });
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    // Code-Fence
    if (t.startsWith('```')) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // schließendes ```
      blocks.push({ t: 'code', lines: code });
      continue;
    }

    if (t === '') {
      flushPara();
      i++;
      continue;
    }

    // Trennlinie
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushPara();
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }

    // Überschrift
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      blocks.push({ t: 'h', level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }

    // Tabelle (Zeile mit | und Folgezeile als Trenner)
    if (t.startsWith('|') && i + 1 < lines.length && isSep(cells(lines[i + 1]))) {
      flushPara();
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(cells(lines[i]));
        i++;
      }
      blocks.push({ t: 'table', head, rows });
      continue;
    }

    // Auflistung (-, *, +, optional Checkbox)
    const li = t.match(/^[-*+]\s+(.*)$/);
    if (li) {
      flushPara();
      const items: { text: string; checked?: boolean }[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^[-*+]\s+(.*)$/);
        if (!m) break;
        const cb = m[1].match(/^\[([ xX])\]\s+(.*)$/);
        if (cb) items.push({ text: cb[2], checked: cb[1].toLowerCase() === 'x' });
        else items.push({ text: m[1] });
        i++;
      }
      blocks.push({ t: 'ul', items });
      continue;
    }

    para.push(t);
    i++;
  }
  flushPara();
  return blocks;
}

/** Inline: **fett**, `code`, [text](url) — sicher, ohne HTML. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${n++}`;
    if (m[2] !== undefined) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3] !== undefined)
      out.push(
        <code key={k} className="rounded bg-[var(--highlight)]/60 px-1 py-0.5 text-[0.85em]">
          {m[3]}
        </code>,
      );
    else if (m[4] !== undefined)
      out.push(
        <a key={k} href={m[5]} target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">
          {m[4]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const H_CLS: Record<number, string> = {
  1: 'text-lg font-extrabold tracking-tight mt-2',
  2: 'text-base font-extrabold tracking-tight mt-1',
  3: 'text-sm font-extrabold text-[var(--foreground)]/90',
  4: 'text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--muted-foreground)]',
  5: 'text-xs font-bold text-[var(--muted-foreground)]',
  6: 'text-xs font-bold text-[var(--muted-foreground)]',
};

export function Markdown({ source }: { source: string }): React.JSX.Element {
  const blocks = parse(source);
  return (
    <div className="flex flex-col gap-3 text-sm leading-snug text-[var(--foreground)]/90">
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.t) {
          case 'h': {
            const Tag = (`h${Math.min(b.level + 1, 6)}` as keyof React.JSX.IntrinsicElements);
            return (
              <Tag key={key} className={H_CLS[b.level] ?? H_CLS[6]}>
                {inline(b.text, key)}
              </Tag>
            );
          }
          case 'p':
            return (
              <p key={key} className="text-[var(--foreground)]/85">
                {inline(b.text, key)}
              </p>
            );
          case 'hr':
            return <hr key={key} className="border-[var(--border)]" />;
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-[12px] leading-tight"
              >
                <code>{b.lines.join('\n')}</code>
              </pre>
            );
          case 'ul':
            return (
              <ul key={key} className="flex flex-col gap-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    {it.checked === undefined ? (
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                    ) : (
                      <span className="shrink-0" aria-hidden>
                        {it.checked ? '☑' : '☐'}
                      </span>
                    )}
                    <span>{inline(it.text, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'table':
            return (
              <div key={key} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[var(--highlight)]/60 text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                      {b.head.map((c, j) => (
                        <th key={j} className="px-3 py-2 font-extrabold">
                          {inline(c, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri} className="border-t border-[var(--border)] align-top">
                        {row.map((c, ci) => (
                          <td key={ci} className="px-3 py-2 text-[var(--foreground)]/85">
                            {inline(c, `${key}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <Fragment key={key} />;
        }
      })}
    </div>
  );
}
