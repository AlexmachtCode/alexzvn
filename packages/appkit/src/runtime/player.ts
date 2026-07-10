// ─────────────────────────────────────────────────────────────────────────────
// Die Laufzeit. Dieselbe Datei läuft in drei Hüllen:
//   1. Editor-Sandbox (iframe auf jmapp://preview/)
//   2. Kiosk-Vollbildfenster
//   3. exportiertes Bundle (file:// oder Webserver)
//
// Der einzige Unterschied ist `resolveAsset` — sonst nichts. Damit kann eine
// Vorschau nicht laufen, während der Export kaputt ist.
//
// Regeln werden interpretiert, nie evaluiert: der Aktions-Dispatch ist ein fester
// switch. Kein eval, kein new Function → die Prod-CSP braucht kein 'unsafe-eval'.
// ─────────────────────────────────────────────────────────────────────────────

import {
  initialVars,
  startScene,
  type AppNode,
  type AppProject,
  type NodeId,
  type Scene,
  type SceneId,
  type VarName,
} from '../model';
import { evalConditions, type Action, type Rule, type TriggerType, type VarValue } from '../logic';
import { createWheel, type WheelView } from './wheel';

export interface RuntimeEvent {
  kind: 'ready' | 'scene' | 'vars' | 'trigger' | 'error';
  sceneId?: SceneId;
  nodeId?: NodeId;
  ruleId?: string;
  trigger?: TriggerType;
  vars?: Record<VarName, VarValue>;
  message?: string;
}

export interface MountOptions {
  doc: AppProject;
  root: HTMLElement;
  /** Asset-ID → URL. Der einzige Unterschied zwischen Sandbox, Kiosk und Export. */
  resolveAsset: (id: string) => string;
  onEvent?: (e: RuntimeEvent) => void;
  /** Im Editor: Klicks melden statt Regeln feuern. */
  interactive?: boolean;
}

export interface RuntimeHandle {
  update(doc: AppProject): void;
  goToScene(id: SceneId): void;
  getVars(): Record<VarName, VarValue>;
  setVar(name: VarName, value: VarValue): void;
  restart(): void;
  destroy(): void;
}

interface Mounted {
  node: AppNode;
  el: HTMLElement;
  wheel?: WheelView;
}

/** Schutz gegen Regel-Zyklen (setVar → onVarChange → setVar → …). */
const MAX_CHAIN_DEPTH = 32;

export function mountApp(opts: MountOptions): RuntimeHandle {
  let doc = opts.doc;
  const emit = (e: RuntimeEvent): void => opts.onEvent?.(e);

  let vars: Record<VarName, VarValue> = initialVars(doc);
  let currentScene: Scene = startScene(doc);
  let mounted = new Map<NodeId, Mounted>();
  let timers: ReturnType<typeof setTimeout>[] = [];
  let audio: HTMLAudioElement | null = null;
  let depth = 0;
  let destroyed = false;

  // ── Bühne ──────────────────────────────────────────────────────────────────
  const host = opts.root;
  host.textContent = '';
  host.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';

  const stage = document.createElement('div');
  stage.setAttribute('data-jmapp-stage', '');
  host.appendChild(stage);

  function layoutStage(): void {
    const { width, height, fit } = doc.canvas;
    const hw = host.clientWidth || width;
    const hh = host.clientHeight || height;
    const sx = hw / width;
    const sy = hh / height;
    const scale = fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
    stage.style.cssText =
      `position:absolute;left:50%;top:50%;width:${width}px;height:${height}px;` +
      `transform:translate(-50%,-50%) scale(${scale});transform-origin:center center;` +
      `background:${currentScene.background};font-family:${doc.theme.fontFamily};` +
      `color:${doc.theme.colorText};overflow:hidden;`;
  }

  const onResize = (): void => layoutStage();
  window.addEventListener('resize', onResize);

  // ── Node-Rendering ─────────────────────────────────────────────────────────

  function baseStyle(n: AppNode): string {
    return (
      `position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;` +
      `transform:rotate(${n.rotation}deg);opacity:${n.opacity};` +
      `display:${n.visible ? 'flex' : 'none'};box-sizing:border-box;`
    );
  }

  function textOf(n: AppNode & { props: { text: string; bindTextTo?: VarName } }): string {
    if (n.props.bindTextTo) return String(vars[n.props.bindTextTo] ?? '');
    return n.props.text;
  }

  function renderNode(n: AppNode): Mounted {
    let el: HTMLElement;
    let wheel: WheelView | undefined;

    switch (n.type) {
      case 'text': {
        el = document.createElement('div');
        el.style.cssText =
          baseStyle(n) +
          `align-items:center;justify-content:${
            n.props.align === 'left' ? 'flex-start' : n.props.align === 'right' ? 'flex-end' : 'center'
          };` +
          `font-size:${n.props.fontSize}px;color:${n.props.color};font-weight:${n.props.weight};` +
          `line-height:${n.props.lineHeight};text-align:${n.props.align};white-space:pre-wrap;word-break:break-word;`;
        el.textContent = textOf(n);
        break;
      }
      case 'image': {
        el = document.createElement('div');
        el.style.cssText = baseStyle(n) + `border-radius:${n.props.radius}px;overflow:hidden;`;
        if (n.props.assetId) {
          const img = document.createElement('img');
          img.src = opts.resolveAsset(n.props.assetId);
          img.alt = n.name;
          img.draggable = false;
          img.style.cssText = `width:100%;height:100%;object-fit:${n.props.fit};`;
          el.appendChild(img);
        } else {
          el.style.cssText += 'background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);';
        }
        break;
      }
      case 'shape': {
        el = document.createElement('div');
        const radius = n.props.kind === 'ellipse' ? '50%' : `${n.props.radius}px`;
        el.style.cssText =
          baseStyle(n) +
          `background:${n.props.fill};border-radius:${radius};` +
          (n.props.strokeWidth > 0 ? `border:${n.props.strokeWidth}px solid ${n.props.stroke};` : '');
        break;
      }
      case 'button': {
        el = document.createElement('button');
        el.style.cssText =
          baseStyle(n) +
          `align-items:center;justify-content:center;cursor:pointer;border:0;` +
          `background:${n.props.bg};color:${n.props.color};border-radius:${n.props.radius}px;` +
          `font-size:${n.props.fontSize}px;font-weight:600;font-family:inherit;` +
          `touch-action:manipulation;-webkit-tap-highlight-color:transparent;`;
        el.textContent = n.props.label;
        break;
      }
      case 'video': {
        el = document.createElement('div');
        el.style.cssText = baseStyle(n);
        const v = document.createElement('video');
        // Unter file:// funktioniert <video src> mit relativem Pfad; fetch nicht.
        if (n.props.assetId) v.src = opts.resolveAsset(n.props.assetId);
        v.autoplay = n.props.autoplay;
        v.loop = n.props.loop;
        v.muted = n.props.muted; // Autoplay verlangt muted
        v.controls = n.props.controls;
        v.playsInline = true;
        v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
        el.appendChild(v);
        break;
      }
      case 'wheel': {
        el = document.createElement('div');
        el.style.cssText = baseStyle(n) + 'touch-action:manipulation;';
        wheel = createWheel(n);
        el.appendChild(wheel.el);
        break;
      }
    }

    el.setAttribute('data-node-id', n.id);
    return { node: n, el, wheel };
  }

  // ── Szenenwechsel ──────────────────────────────────────────────────────────

  function clearTimers(): void {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }

  function unmountScene(): void {
    clearTimers();
    for (const m of mounted.values()) m.wheel?.destroy();
    mounted = new Map();
    stage.textContent = '';
  }

  /**
   * `start=false` baut die Szene nur neu, ohne sie zu betreten: keine
   * onLoad-Regeln, keine Timer. Genau das braucht der Live-Edit im Editor —
   * sonst würde jeder Tastendruck im Textfeld das Spiel neu starten und der
   * Autor landete bei `onLoad → goToScene` sofort in einer anderen Szene.
   */
  function mountScene(scene: Scene, start = true): void {
    unmountScene();
    currentScene = scene;
    layoutStage();

    for (const n of scene.nodes) {
      const m = renderNode(n);
      mounted.set(n.id, m);
      stage.appendChild(m.el);
      bindNodeRules(m);
    }

    emit({ kind: 'scene', sceneId: scene.id });
    if (!start) return;

    fireRules(scene.rules, 'onLoad', { sceneId: scene.id });
    scheduleTimers(scene.rules, { sceneId: scene.id });
    for (const m of mounted.values()) scheduleTimers(m.node.rules, { nodeId: m.node.id });
  }

  function bindNodeRules(m: Mounted): void {
    const hasClick = m.node.rules.some((r) => r.enabled && r.trigger.type === 'onClick');
    if (hasClick) {
      m.el.style.cursor = 'pointer';
      m.el.addEventListener('click', () => fireRules(m.node.rules, 'onClick', { nodeId: m.node.id }));
    }
    if (m.wheel) {
      // Ein Tipp aufs Rad dreht — ohne dass der Autor eine Regel schreiben muss.
      m.el.addEventListener('click', () => spin(m));
    }
  }

  function scheduleTimers(rules: Rule[], ctx: { sceneId?: SceneId; nodeId?: NodeId }): void {
    for (const r of rules) {
      if (!r.enabled || r.trigger.type !== 'onTimer') continue;
      const t = setTimeout(() => runRule(r, ctx, undefined), Math.max(0, r.trigger.afterMs ?? 0));
      timers.push(t);
    }
  }

  function spin(m: Mounted): void {
    if (!m.wheel || m.node.type !== 'wheel') return;
    const resultVar = m.node.props.resultVar;
    m.wheel.spin((value) => {
      if (resultVar) setVar(resultVar, value);
      fireRules(m.node.rules, 'onWheelStop', { nodeId: m.node.id }, value);
    });
  }

  // ── Regel-Engine ───────────────────────────────────────────────────────────

  function fireRules(
    rules: Rule[],
    trigger: TriggerType,
    ctx: { sceneId?: SceneId; nodeId?: NodeId },
    result?: VarValue,
  ): void {
    for (const r of rules) {
      if (!r.enabled || r.trigger.type !== trigger) continue;
      runRule(r, ctx, result);
    }
  }

  function runRule(r: Rule, ctx: { sceneId?: SceneId; nodeId?: NodeId }, result?: VarValue): void {
    if (destroyed || !r.enabled) return;
    if (depth > MAX_CHAIN_DEPTH) {
      emit({ kind: 'error', message: `Regelkette zu tief — Schleife in „${r.id}"?` });
      return;
    }
    if (!evalConditions(r.conditions, vars, result)) return;

    emit({ kind: 'trigger', trigger: r.trigger.type, ruleId: r.id, ...ctx });

    depth++;
    try {
      for (const a of r.actions) {
        if (!a.enabled) continue;
        if (a.delayMs && a.delayMs > 0) {
          const t = setTimeout(() => runAction(a), a.delayMs);
          timers.push(t);
        } else {
          runAction(a);
        }
      }
    } finally {
      depth--;
    }
  }

  function nodeById(id: unknown): Mounted | undefined {
    return typeof id === 'string' ? mounted.get(id) : undefined;
  }

  function runAction(a: Action): void {
    if (destroyed) return;
    const [a0, a1] = a.args;
    switch (a.verb) {
      case 'goToScene': {
        const target = doc.scenes.find((s) => s.id === a0);
        if (target) mountScene(target);
        else emit({ kind: 'error', message: `Szene nicht gefunden: ${String(a0)}` });
        break;
      }
      case 'setVar':
        if (typeof a0 === 'string' && a0) setVar(a0, coerce(a0, a1));
        break;
      case 'addVar': {
        if (typeof a0 !== 'string' || !a0) break;
        const cur = Number(vars[a0] ?? 0);
        const inc = Number(a1);
        setVar(a0, (Number.isFinite(cur) ? cur : 0) + (Number.isFinite(inc) ? inc : 0));
        break;
      }
      case 'show':
      case 'hide':
      case 'toggle': {
        const m = nodeById(a0);
        if (!m) break;
        const shown = m.el.style.display !== 'none';
        const next = a.verb === 'show' ? true : a.verb === 'hide' ? false : !shown;
        m.el.style.display = next ? 'flex' : 'none';
        break;
      }
      case 'setText': {
        const m = nodeById(a0);
        if (!m) break;
        if (m.node.type === 'text') m.el.textContent = String(a1 ?? '');
        else if (m.node.type === 'button') m.el.textContent = String(a1 ?? '');
        break;
      }
      case 'playSound': {
        if (typeof a0 !== 'string' || !a0) break;
        // Bewusst <audio> statt WebAudio: decodeAudioData braucht fetch, und das
        // scheitert unter file:// an der null-Origin.
        audio?.pause();
        audio = new Audio(opts.resolveAsset(a0));
        void audio.play().catch(() => {
          /* Autoplay-Sperre vor erster Interaktion — kein Grund zu scheitern */
        });
        break;
      }
      case 'stopSound':
        audio?.pause();
        audio = null;
        break;
      case 'spinWheel': {
        const m = nodeById(a0);
        if (m) spin(m);
        break;
      }
      case 'restart':
        restart();
        break;
    }
  }

  /** Typ der Zielvariable respektieren — der Editor liefert Argumente als Strings. */
  function coerce(name: VarName, raw: unknown): VarValue {
    const def = doc.variables.find((v) => v.name === name);
    if (!def) return raw as VarValue;
    if (def.type === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    if (def.type === 'boolean') return raw === true || raw === 'true' || raw === 1 || raw === '1';
    return String(raw ?? '');
  }

  function setVar(name: VarName, value: VarValue): void {
    if (vars[name] === value) return;
    vars = { ...vars, [name]: value };
    emit({ kind: 'vars', vars });

    // Text-Nodes, die an diese Variable gebunden sind, live nachziehen.
    for (const m of mounted.values()) {
      if (m.node.type === 'text' && m.node.props.bindTextTo === name) {
        m.el.textContent = String(value);
      }
    }

    for (const r of currentScene.rules) {
      if (r.enabled && r.trigger.type === 'onVarChange' && r.trigger.varName === name) {
        runRule(r, { sceneId: currentScene.id }, value);
      }
    }
  }

  function restart(): void {
    vars = initialVars(doc);
    emit({ kind: 'vars', vars });
    mountScene(startScene(doc));
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  mountScene(currentScene);
  emit({ kind: 'ready' });
  emit({ kind: 'vars', vars });

  return {
    update(next) {
      doc = next;
      // Szene beibehalten, wenn sie noch existiert — sonst wandert der Autor bei
      // jedem Tastendruck zurück auf die Startszene.
      const keep = doc.scenes.find((s) => s.id === currentScene.id) ?? startScene(doc);
      // Neue Variablen ergänzen, laufende Werte behalten (der Autor will seinen
      // Punktestand nicht bei jeder Änderung verlieren).
      vars = { ...initialVars(doc), ...vars };
      mountScene(keep, false);
    },
    goToScene(id) {
      const s = doc.scenes.find((x) => x.id === id);
      if (s) mountScene(s);
    },
    getVars: () => vars,
    setVar,
    restart,
    destroy() {
      destroyed = true;
      window.removeEventListener('resize', onResize);
      unmountScene();
      audio?.pause();
      audio = null;
      host.textContent = '';
    },
  };
}
