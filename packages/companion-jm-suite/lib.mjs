// Pure Hilfsfunktionen des JM-Suite-Companion-Moduls — bewusst frei von
// @companion-module/base, damit sie ohne Companion-Runtime getestet werden
// können (test/selftest.mjs). main.js nutzt sie.

/** Eine CapabilityArg in ein Companion-Options-Feld übersetzen. */
export function toCompanionOption(arg) {
  if (arg.type === 'dropdown') {
    return { type: 'dropdown', id: arg.id, label: arg.label, default: arg.default, choices: arg.choices ?? [] };
  }
  if (arg.type === 'number') {
    return { type: 'number', id: arg.id, label: arg.label, default: arg.default ?? 0, min: arg.min, max: arg.max };
  }
  return { type: 'textinput', id: arg.id, label: arg.label, default: String(arg.default ?? '') };
}

/**
 * Eine Befehlszeile aus einer Capability-Action + Companion-Optionswerten bauen.
 *  - Switcher-Befehle haben KEINEN Namespace (PREVIEW 2, CUT) — Rückwärtskompat.
 *  - Toggle-Actions (toggleKey) lösen 'toggle' clientseitig über den letzten
 *    STATE-Wert auf und senden ON/OFF (alle Tools akzeptieren ON/OFF).
 *
 * @param {string} role      Tool-Rolle (z. B. 'timer')
 * @param {object} action    Capability-Action {verb, args?, toggleKey?}
 * @param {object} options   Companion-Optionswerte (per arg.id)
 * @param {object} state     Letzter STATE (kv) als Record<string,string>
 * @returns {string}         Protokollzeile OHNE abschließendes \n
 */
export function buildCommandLine(role, action, options, state) {
  const args = [];
  for (const arg of action.args ?? []) {
    let val = options?.[arg.id];
    if (arg.id === 'mode' && action.toggleKey) {
      if (val === 'toggle') {
        const cur = state?.[action.toggleKey];
        val = cur === '1' || cur === 'an' || cur === 'true' ? 'off' : 'on';
      }
      args.push(String(val).toUpperCase());
    } else {
      args.push(String(val));
    }
  }
  const verb = action.verb.toUpperCase();
  const prefix = role === 'switcher' ? '' : `${role.toUpperCase()} `;
  const tail = args.length ? ` ${args.join(' ')}` : '';
  return `${prefix}${verb}${tail}`;
}

/** Passt eine empfangene STATE-Zeile (ns) zur konfigurierten Rolle? */
export function matchesRole(role, ns) {
  if (role === 'switcher') return ns === '' || ns === 'switcher';
  return ns === role;
}

/**
 * Ein STATE-Feld als Boolean interpretieren (für truthy-Feedbacks): '1', 'an', 'true' oder eine
 * positive ganze Zahl. So leuchten auch Anzahlen wie onair=2 (Gäste auf Sendung) oder lobby=5
 * (Zoom Stage 4b, Spec 17.2 Nr. 2). '0', leer, negativ, mit führender Null oder Leerraum → aus.
 */
export function isTruthy(v) {
  return v === 'an' || v === 'true' || (typeof v === 'string' && /^[1-9]\d*$/.test(v));
}

/**
 * Ist dieser per mDNS entdeckte Dienst ein Suite-Steuer-Endpunkt (spricht das
 * TCP-Zeilenprotokoll)? Steuer-Endpunkte tragen TXT `ctl=1`. Der Switcher ist
 * der Sonderfall: sein einziger (Alt-)Advert IST der Steuerserver und trägt
 * rückwärtskompatibel KEIN `ctl` — daher `role==='switcher'` ebenfalls gelten
 * lassen. (Spiegelbild zu Stage Display, das für seine Rollen `!ctl` filtert.)
 */
export function isControlService(svc) {
  return !!svc && (svc.ctl === true || svc.role === 'switcher');
}

/**
 * Aus einer Liste entdeckter Dienste den Steuer-Endpunkt für eine Rolle wählen
 * → `{ host, port, name }` oder `null`. Bevorzugt einen echten `ctl=1`-Treffer
 * (eindeutiger Steuer-Endpunkt); fällt sonst (Switcher) auf den ctl-losen Advert
 * zurück.
 *
 * @param {string} role
 * @param {Array<{role:string,host:string,port:number,name?:string,ctl?:boolean}>} services
 */
export function pickEndpoint(role, services) {
  const candidates = (services || []).filter((s) => s.role === role && isControlService(s));
  const best = candidates.find((s) => s.ctl === true) || candidates[0];
  return best ? { host: best.host, port: best.port, name: best.name } : null;
}
