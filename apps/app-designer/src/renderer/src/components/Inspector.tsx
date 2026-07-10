import { Collapsible, SettingsSection } from '@jm/ui';
import {
  newId,
  type AppNode,
  type MemoryPair,
  type QuizAnswer,
  type QuizQuestion,
  type WheelSegment,
} from '@jm/appkit';
import { useCurrentScene, useEditor, useSelectedNode } from '../store';
import { RuleEditor } from './RuleEditor';
import { CheckField, ColorField, NumberField, Row, SelectField, TextField, type Option } from './fields';

/** Ein `props`-Feld ändern, ohne den Rest zu verlieren. */
function useProps<T extends AppNode>(node: T): (patch: Partial<T['props']>) => void {
  const patchNode = useEditor((s) => s.patchNode);
  return (patch) => patchNode(node.id, { props: { ...node.props, ...patch } } as Partial<AppNode>);
}

function Geometry({ node }: { node: AppNode }): JSX.Element {
  const patchNode = useEditor((s) => s.patchNode);
  return (
    <>
      <div className="flex gap-2">
        <Row label="X">
          <NumberField value={node.x} onChange={(v) => patchNode(node.id, { x: v })} />
        </Row>
        <Row label="Y">
          <NumberField value={node.y} onChange={(v) => patchNode(node.id, { y: v })} />
        </Row>
      </div>
      <div className="flex gap-2">
        <Row label="Breite">
          <NumberField value={node.w} min={1} onChange={(v) => patchNode(node.id, { w: v })} />
        </Row>
        <Row label="Höhe">
          <NumberField value={node.h} min={1} onChange={(v) => patchNode(node.id, { h: v })} />
        </Row>
      </div>
      <Row label="Drehung">
        <NumberField value={node.rotation} min={-360} max={360} onChange={(v) => patchNode(node.id, { rotation: v })} />
      </Row>
      <Row label="Deckkraft">
        <NumberField
          value={node.opacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patchNode(node.id, { opacity: Math.min(1, Math.max(0, v)) })}
        />
      </Row>
      <CheckField checked={node.visible} label="Beim Start sichtbar" onChange={(v) => patchNode(node.id, { visible: v })} />
      <CheckField checked={node.locked} label="Gesperrt" onChange={(v) => patchNode(node.id, { locked: v })} />
    </>
  );
}

function TypeProps({ node }: { node: AppNode }): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const setProps = useProps(node);

  const varOptions: Option[] = doc.variables.map((v) => ({ value: v.name, label: v.name }));
  const imageOptions: Option[] = doc.assets.filter((a) => a.kind === 'image').map((a) => ({ value: a.id, label: a.fileName }));
  const videoOptions: Option[] = doc.assets.filter((a) => a.kind === 'video').map((a) => ({ value: a.id, label: a.fileName }));

  switch (node.type) {
    case 'text':
      return (
        <>
          <Row label="Text">
            <TextField value={node.props.text} onChange={(v) => setProps({ text: v })} />
          </Row>
          <Row label="Zeigt Variable">
            <SelectField
              value={node.props.bindTextTo ?? ''}
              options={varOptions}
              placeholder="— fester Text —"
              onChange={(v) => setProps({ bindTextTo: v || undefined })}
            />
          </Row>
          <Row label="Schriftgröße">
            <NumberField value={node.props.fontSize} min={1} onChange={(v) => setProps({ fontSize: v })} />
          </Row>
          <Row label="Farbe">
            <ColorField value={node.props.color} onChange={(v) => setProps({ color: v })} />
          </Row>
          <Row label="Stärke">
            <NumberField value={node.props.weight} min={100} max={900} step={100} onChange={(v) => setProps({ weight: v })} />
          </Row>
          <Row label="Ausrichtung">
            <SelectField
              value={node.props.align}
              options={[
                { value: 'left', label: 'links' },
                { value: 'center', label: 'mittig' },
                { value: 'right', label: 'rechts' },
              ]}
              onChange={(v) => setProps({ align: v as 'left' })}
            />
          </Row>
        </>
      );

    case 'image':
      return (
        <>
          <Row label="Bild">
            <SelectField
              value={node.props.assetId ?? ''}
              options={imageOptions}
              placeholder="— kein Bild —"
              onChange={(v) => setProps({ assetId: v || null })}
            />
          </Row>
          <Row label="Einpassen">
            <SelectField
              value={node.props.fit}
              options={[
                { value: 'contain', label: 'ganz zeigen' },
                { value: 'cover', label: 'Fläche füllen' },
                { value: 'fill', label: 'verzerren' },
              ]}
              onChange={(v) => setProps({ fit: v as 'contain' })}
            />
          </Row>
          <Row label="Ecken">
            <NumberField value={node.props.radius} min={0} onChange={(v) => setProps({ radius: v })} />
          </Row>
        </>
      );

    case 'shape':
      return (
        <>
          <Row label="Form">
            <SelectField
              value={node.props.kind}
              options={[
                { value: 'rect', label: 'Rechteck' },
                { value: 'ellipse', label: 'Ellipse' },
              ]}
              onChange={(v) => setProps({ kind: v as 'rect' })}
            />
          </Row>
          <Row label="Füllung">
            <ColorField value={node.props.fill} onChange={(v) => setProps({ fill: v })} />
          </Row>
          <Row label="Rand">
            <ColorField value={node.props.stroke} onChange={(v) => setProps({ stroke: v })} />
          </Row>
          <Row label="Randbreite">
            <NumberField value={node.props.strokeWidth} min={0} onChange={(v) => setProps({ strokeWidth: v })} />
          </Row>
          <Row label="Ecken">
            <NumberField value={node.props.radius} min={0} onChange={(v) => setProps({ radius: v })} />
          </Row>
        </>
      );

    case 'button':
      return (
        <>
          <Row label="Beschriftung">
            <TextField value={node.props.label} onChange={(v) => setProps({ label: v })} />
          </Row>
          <Row label="Hintergrund">
            <ColorField value={node.props.bg} onChange={(v) => setProps({ bg: v })} />
          </Row>
          <Row label="Schriftfarbe">
            <ColorField value={node.props.color} onChange={(v) => setProps({ color: v })} />
          </Row>
          <Row label="Schriftgröße">
            <NumberField value={node.props.fontSize} min={1} onChange={(v) => setProps({ fontSize: v })} />
          </Row>
          <Row label="Ecken">
            <NumberField value={node.props.radius} min={0} onChange={(v) => setProps({ radius: v })} />
          </Row>
        </>
      );

    case 'video':
      return (
        <>
          <Row label="Video">
            <SelectField
              value={node.props.assetId ?? ''}
              options={videoOptions}
              placeholder="— kein Video —"
              onChange={(v) => setProps({ assetId: v || null })}
            />
          </Row>
          <CheckField
            checked={node.props.autoplay}
            label="Automatisch abspielen (nur stumm erlaubt)"
            onChange={(v) => setProps({ autoplay: v, muted: v ? true : node.props.muted })}
          />
          <CheckField checked={node.props.loop} label="Endlosschleife" onChange={(v) => setProps({ loop: v })} />
          <CheckField checked={node.props.muted} label="Stumm" onChange={(v) => setProps({ muted: v })} />
          <CheckField checked={node.props.controls} label="Bedienelemente zeigen" onChange={(v) => setProps({ controls: v })} />
        </>
      );

    case 'wheel': {
      const segs = node.props.segments;
      const setSeg = (i: number, patch: Partial<WheelSegment>): void => {
        const segments = [...segs];
        segments[i] = { ...segments[i], ...patch };
        setProps({ segments });
      };
      return (
        <>
          <Row label="Dauer (ms)">
            <NumberField value={node.props.spinMs} min={200} step={100} onChange={(v) => setProps({ spinMs: v })} />
          </Row>
          <Row label="Umdrehungen">
            <NumberField value={node.props.turns} min={1} max={20} onChange={(v) => setProps({ turns: v })} />
          </Row>
          <Row label="Schriftfarbe">
            <ColorField value={node.props.textColor} onChange={(v) => setProps({ textColor: v })} />
          </Row>
          <Row label="Ergebnis in">
            <SelectField
              value={node.props.resultVar ?? ''}
              options={varOptions}
              placeholder="— nur $result —"
              onChange={(v) => setProps({ resultVar: v || undefined })}
            />
          </Row>

          <div className="mt-3 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Felder</div>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            Die Feldgröße folgt dem Gewicht — was man sieht, ist die Gewinnchance.
          </p>
          {segs.map((s, i) => (
            <div key={s.id} className="mb-2 flex items-center gap-1">
              <div className="flex-1">
                <TextField value={s.label} onChange={(v) => setSeg(i, { label: v })} />
              </div>
              <div className="w-24">
                <TextField value={s.value} onChange={(v) => setSeg(i, { value: v })} />
              </div>
              <div className="w-16">
                <NumberField value={s.weight} min={0} step={0.5} onChange={(v) => setSeg(i, { weight: v })} />
              </div>
              <input
                type="color"
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#000000'}
                onChange={(e) => setSeg(i, { color: e.target.value })}
              />
              <button
                className="rounded px-2 text-xs hover:bg-[var(--muted)]"
                onClick={() => setProps({ segments: segs.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
            onClick={() =>
              setProps({
                segments: [
                  ...segs,
                  { id: newId('seg'), label: `Feld ${segs.length + 1}`, color: '#4f8cff', weight: 1, value: `feld${segs.length + 1}` },
                ],
              })
            }
          >
            + Feld
          </button>
        </>
      );
    }

    case 'quiz': {
      const qs = node.props.questions;
      const setQuestion = (i: number, patch: Partial<QuizQuestion>): void => {
        const questions = [...qs];
        questions[i] = { ...questions[i], ...patch };
        setProps({ questions });
      };
      const setAnswer = (qi: number, ai: number, patch: Partial<QuizAnswer>): void => {
        const answers = [...qs[qi].answers];
        answers[ai] = { ...answers[ai], ...patch };
        setQuestion(qi, { answers });
      };
      return (
        <>
          <Row label="Punkte in">
            <SelectField
              value={node.props.scoreVar ?? ''}
              options={varOptions}
              placeholder="— nicht zählen —"
              onChange={(v) => setProps({ scoreVar: v || undefined })}
            />
          </Row>
          <Row label="Fragennummer in">
            <SelectField
              value={node.props.indexVar ?? ''}
              options={varOptions}
              placeholder="— nicht anzeigen —"
              onChange={(v) => setProps({ indexVar: v || undefined })}
            />
          </Row>
          <Row label="Weiter nach (ms)">
            <NumberField
              value={node.props.advanceMs}
              min={0}
              step={100}
              onChange={(v) => setProps({ advanceMs: v })}
            />
          </Row>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            0 = wartet auf die Aktion „Nächste Frage".
          </p>
          <CheckField
            checked={node.props.shuffleQuestions}
            label="Fragen mischen"
            onChange={(v) => setProps({ shuffleQuestions: v })}
          />
          <CheckField
            checked={node.props.shuffleAnswers}
            label="Antworten mischen"
            onChange={(v) => setProps({ shuffleAnswers: v })}
          />

          <div className="mt-3 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Fragen</div>
          {qs.map((q, qi) => (
            <div key={q.id} className="mb-3 rounded border border-[var(--border)] p-2">
              <div className="mb-2 flex items-center gap-1">
                <span className="w-5 text-xs text-[var(--muted-foreground)]">{qi + 1}.</span>
                <div className="flex-1">
                  <TextField value={q.text} onChange={(text) => setQuestion(qi, { text })} />
                </div>
                <button
                  className="rounded px-2 text-xs hover:bg-[var(--muted)]"
                  onClick={() => setProps({ questions: qs.filter((_, j) => j !== qi) })}
                >
                  ✕
                </button>
              </div>
              <div className="mb-2 pl-6">
                <SelectField
                  value={q.imageAssetId ?? ''}
                  options={imageOptions}
                  placeholder="— kein Bild zur Frage —"
                  onChange={(v) => setQuestion(qi, { imageAssetId: v || null })}
                />
              </div>
              {q.answers.map((a, ai) => (
                <div key={a.id} className="mb-1 flex items-center gap-2 pl-6">
                  <input
                    type="checkbox"
                    checked={a.correct}
                    title="Richtige Antwort"
                    onChange={(e) => setAnswer(qi, ai, { correct: e.target.checked })}
                  />
                  <div className="flex-1">
                    <TextField value={a.text} onChange={(text) => setAnswer(qi, ai, { text })} />
                  </div>
                  <button
                    className="rounded px-2 text-xs hover:bg-[var(--muted)]"
                    onClick={() => setQuestion(qi, { answers: q.answers.filter((_, j) => j !== ai) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="ml-6 rounded border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--muted)]"
                onClick={() =>
                  setQuestion(qi, { answers: [...q.answers, { id: newId('a'), text: 'Antwort', correct: false }] })
                }
              >
                + Antwort
              </button>
              {!q.answers.some((a) => a.correct) && (
                <p className="ml-6 mt-1 text-xs text-[#f5a524]">Keine Antwort ist als richtig markiert.</p>
              )}
            </div>
          ))}
          <button
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
            onClick={() =>
              setProps({
                questions: [
                  ...qs,
                  {
                    id: newId('q'),
                    text: 'Neue Frage?',
                    imageAssetId: null,
                    answers: [
                      { id: newId('a'), text: 'Richtig', correct: true },
                      { id: newId('a'), text: 'Falsch', correct: false },
                    ],
                  },
                ],
              })
            }
          >
            + Frage
          </button>

          <Collapsible title="Aussehen" persistId="quiz-look" defaultOpen={false}>
            <Row label="Frage-Größe">
              <NumberField value={node.props.questionFontSize} min={8} onChange={(v) => setProps({ questionFontSize: v })} />
            </Row>
            <Row label="Antwort-Größe">
              <NumberField value={node.props.answerFontSize} min={8} onChange={(v) => setProps({ answerFontSize: v })} />
            </Row>
            <Row label="Antwort-Farbe">
              <ColorField value={node.props.answerColor} onChange={(v) => setProps({ answerColor: v })} />
            </Row>
            <Row label="Richtig">
              <ColorField value={node.props.correctColor} onChange={(v) => setProps({ correctColor: v })} />
            </Row>
            <Row label="Falsch">
              <ColorField value={node.props.wrongColor} onChange={(v) => setProps({ wrongColor: v })} />
            </Row>
            <Row label="Schriftfarbe">
              <ColorField value={node.props.textColor} onChange={(v) => setProps({ textColor: v })} />
            </Row>
          </Collapsible>
        </>
      );
    }

    case 'memory': {
      const pairs = node.props.pairs;
      const setPair = (i: number, patch: Partial<MemoryPair>): void => {
        const next = [...pairs];
        next[i] = { ...next[i], ...patch };
        setProps({ pairs: next });
      };
      return (
        <>
          <Row label="Spalten">
            <NumberField value={node.props.columns} min={1} max={12} onChange={(v) => setProps({ columns: v })} />
          </Row>
          <Row label="Zurück nach (ms)">
            <NumberField value={node.props.flipBackMs} min={100} step={100} onChange={(v) => setProps({ flipBackMs: v })} />
          </Row>
          <Row label="Paare in">
            <SelectField
              value={node.props.matchesVar ?? ''}
              options={varOptions}
              placeholder="— nicht zählen —"
              onChange={(v) => setProps({ matchesVar: v || undefined })}
            />
          </Row>

          <div className="mt-3 text-xs font-semibold uppercase text-[var(--muted-foreground)]">Paare</div>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            Bleibt das Gegenstück leer, zeigen beide Karten dasselbe. Sonst wird ein Zuordnungsspiel daraus.
          </p>
          {pairs.map((p, i) => (
            <div key={p.id} className="mb-2 rounded border border-[var(--border)] p-2">
              <div className="mb-1 flex items-center gap-1">
                <div className="flex-1">
                  <TextField value={p.label} placeholder="Karte A" onChange={(label) => setPair(i, { label })} />
                </div>
                <div className="w-32">
                  <SelectField
                    value={p.assetId ?? ''}
                    options={imageOptions}
                    placeholder="— Bild —"
                    onChange={(v) => setPair(i, { assetId: v || null })}
                  />
                </div>
                <button
                  className="rounded px-2 text-xs hover:bg-[var(--muted)]"
                  onClick={() => setProps({ pairs: pairs.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <TextField
                    value={p.matchLabel}
                    placeholder="Gegenstück (leer = gleich)"
                    onChange={(matchLabel) => setPair(i, { matchLabel })}
                  />
                </div>
                <div className="w-32">
                  <SelectField
                    value={p.matchAssetId ?? ''}
                    options={imageOptions}
                    placeholder="— Bild —"
                    onChange={(v) => setPair(i, { matchAssetId: v || null })}
                  />
                </div>
                <span className="w-6" />
              </div>
            </div>
          ))}
          <button
            className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--muted)]"
            onClick={() =>
              setProps({
                pairs: [...pairs, { id: newId('pair'), label: '', assetId: null, matchLabel: '', matchAssetId: null }],
              })
            }
          >
            + Paar
          </button>

          <Collapsible title="Aussehen" persistId="memory-look" defaultOpen={false}>
            <Row label="Rückseite">
              <ColorField value={node.props.backColor} onChange={(v) => setProps({ backColor: v })} />
            </Row>
            <Row label="Rückseiten-Text">
              <TextField value={node.props.backLabel} onChange={(v) => setProps({ backLabel: v })} />
            </Row>
            <Row label="Vorderseite">
              <ColorField value={node.props.faceColor} onChange={(v) => setProps({ faceColor: v })} />
            </Row>
            <Row label="Schriftfarbe">
              <ColorField value={node.props.textColor} onChange={(v) => setProps({ textColor: v })} />
            </Row>
            <Row label="Schriftgröße">
              <NumberField value={node.props.fontSize} min={8} onChange={(v) => setProps({ fontSize: v })} />
            </Row>
            <Row label="Abstand">
              <NumberField value={node.props.gap} min={0} onChange={(v) => setProps({ gap: v })} />
            </Row>
            <Row label="Ecken">
              <NumberField value={node.props.radius} min={0} onChange={(v) => setProps({ radius: v })} />
            </Row>
          </Collapsible>
        </>
      );
    }

    case 'dragitem':
      return (
        <>
          <Row label="Beschriftung">
            <TextField value={node.props.label} onChange={(v) => setProps({ label: v })} />
          </Row>
          <Row label="Bild">
            <SelectField
              value={node.props.assetId ?? ''}
              options={imageOptions}
              placeholder="— nur Text —"
              onChange={(v) => setProps({ assetId: v || null })}
            />
          </Row>
          <Row label="Gruppe">
            <TextField value={node.props.tag} onChange={(v) => setProps({ tag: v })} />
          </Row>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            Eine Ablagefläche nimmt nur Elemente ihrer Gruppen an.
          </p>
          <CheckField
            checked={node.props.returnOnMiss}
            label="Springt zurück, wenn es nicht passt"
            onChange={(v) => setProps({ returnOnMiss: v })}
          />
          <CheckField
            checked={node.props.lockOnDrop}
            label="Bleibt nach korrekter Ablage liegen"
            onChange={(v) => setProps({ lockOnDrop: v })}
          />
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            Aus lassen für freies Sortieren. An zählt eine Regel „abgelegt +1" verlässlich die Elemente
            statt der Ablage-Vorgänge.
          </p>
          <Row label="Hintergrund">
            <ColorField value={node.props.bg} onChange={(v) => setProps({ bg: v })} />
          </Row>
          <Row label="Schriftfarbe">
            <ColorField value={node.props.color} onChange={(v) => setProps({ color: v })} />
          </Row>
          <Row label="Schriftgröße">
            <NumberField value={node.props.fontSize} min={8} onChange={(v) => setProps({ fontSize: v })} />
          </Row>
          <Row label="Ecken">
            <NumberField value={node.props.radius} min={0} onChange={(v) => setProps({ radius: v })} />
          </Row>
        </>
      );

    case 'dropzone':
      return (
        <>
          <Row label="Beschriftung">
            <TextField value={node.props.label} onChange={(v) => setProps({ label: v })} />
          </Row>
          <Row label="Nimmt Gruppen">
            <TextField
              value={node.props.accepts.join(', ')}
              placeholder="gruppe1, gruppe2"
              onChange={(v) =>
                setProps({
                  accepts: v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Row>
          <Row label="Höchstzahl">
            <NumberField value={node.props.capacity} min={0} onChange={(v) => setProps({ capacity: v })} />
          </Row>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">0 = unbegrenzt.</p>
          <CheckField
            checked={node.props.snap}
            label="Abgelegte Elemente einrasten"
            onChange={(v) => setProps({ snap: v })}
          />
          <Row label="Hintergrund">
            <ColorField value={node.props.bg} onChange={(v) => setProps({ bg: v })} />
          </Row>
          <Row label="Rahmen">
            <ColorField value={node.props.borderColor} onChange={(v) => setProps({ borderColor: v })} />
          </Row>
          <Row label="Schriftfarbe">
            <ColorField value={node.props.color} onChange={(v) => setProps({ color: v })} />
          </Row>
          <Row label="Schriftgröße">
            <NumberField value={node.props.fontSize} min={8} onChange={(v) => setProps({ fontSize: v })} />
          </Row>
          <Row label="Ecken">
            <NumberField value={node.props.radius} min={0} onChange={(v) => setProps({ radius: v })} />
          </Row>
        </>
      );
  }
}

export function Inspector(): JSX.Element {
  const node = useSelectedNode();
  const scene = useCurrentScene();
  const patchNode = useEditor((s) => s.patchNode);
  const patchScene = useEditor((s) => s.patchScene);

  if (!node) {
    return (
      <div className="space-y-4 p-3">
        <SettingsSection title="Szene" description="Kein Element ausgewählt.">
          <Row label="Name">
            <TextField value={scene.name} onChange={(v) => patchScene(scene.id, { name: v })} />
          </Row>
          <Row label="Hintergrund">
            <ColorField value={scene.background} onChange={(v) => patchScene(scene.id, { background: v })} />
          </Row>
        </SettingsSection>

        <Collapsible title="Regeln der Szene" persistId="scene-rules" description="Wenn → Dann für die ganze Szene">
          <RuleEditor
            scope="scene"
            rules={scene.rules}
            onChange={(rules) => patchScene(scene.id, { rules })}
          />
        </Collapsible>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      <SettingsSection title={node.name} description="Eigenschaften des Elements">
        <Row label="Name">
          <TextField value={node.name} onChange={(v) => patchNode(node.id, { name: v })} />
        </Row>
        <TypeProps node={node} />
      </SettingsSection>

      <Collapsible title="Position & Größe" persistId="node-geometry" defaultOpen={false}>
        <Geometry node={node} />
      </Collapsible>

      <Collapsible title="Regeln" persistId="node-rules" description="Wenn → Dann für dieses Element">
        <RuleEditor
          scope="node"
          nodeType={node.type}
          rules={node.rules}
          onChange={(rules) => patchNode(node.id, { rules })}
        />
      </Collapsible>
    </div>
  );
}
