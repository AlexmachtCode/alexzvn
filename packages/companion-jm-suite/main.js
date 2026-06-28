// Bitfocus-Companion-Modul für die JM Production Suite. EIN Modul für ALLE
// Tools: je Verbindung wählt man die Rolle (Switcher/Timer/Player/Titler/
// Presenter/Prompter/Recorder/DAW); Actions, Feedbacks und Variablen werden
// dynamisch aus der geteilten Capabilities-Tabelle generiert. Gesprochen wird
// das suite-weite Zeilenprotokoll (@jm/suite-control-protocol) über TCP.
//
// Das Protokoll + die Capabilities liegen generiert in ./generated/protocol.mjs
// (aus packages/suite-control-protocol via scripts/sync-companion-protocol.mjs)
// — so bleibt das Modul standalone baubar und driftet nicht von der Suite ab.
import net from 'node:net'
import tls from 'node:tls'
import { InstanceBase, runEntrypoint, InstanceStatus, TCPHelper, Regex, combineRgb } from '@companion-module/base'
import {
  parseSuiteState,
  createLineBuffer,
  parseAuthReq,
  formatAuth,
  isAuthOk,
  isAuthFail,
  CAPABILITIES,
  KNOWN_ROLES,
} from './generated/protocol.mjs'
import { buildCommandLine, toCompanionOption, matchesRole, isTruthy, isControlService, pickEndpoint } from './lib.mjs'
import { computeAuthProof, normalizeFingerprint } from './auth.mjs'
import { browseSuite } from './discovery.mjs'

const rgb = (t) => combineRgb(t[0], t[1], t[2])

class JmSuiteInstance extends InstanceBase {
  async init(config) {
    this.config = config
    this.role = config?.role || 'switcher'
    this.state = {}
    this.discovered = this.discovered || []
    const cap = CAPABILITIES[this.role]
    if (cap) {
      this.setActionDefinitions(this.buildActions(cap))
      this.setFeedbackDefinitions(this.buildFeedbacks(cap))
      this.setVariableDefinitions(this.buildVariables(cap))
      this.setPresetDefinitions(this.buildPresets(cap))
    } else {
      this.setActionDefinitions({})
      this.setFeedbackDefinitions({})
      this.setVariableDefinitions([])
    }
    this.startDiscovery()
    this.connect()
  }

  async destroy() {
    this.stopDiscovery()
    this.disconnect()
  }

  async configUpdated(config) {
    // Rollenwechsel → alles neu aufbauen.
    await this.init(config)
  }

  getConfigFields() {
    const ports = KNOWN_ROLES.map((r) => `${CAPABILITIES[r].label}: ${CAPABILITIES[r].port}`).join(' · ')
    // Momentaufnahme der per mDNS gefundenen Steuer-Endpunkte (Hilfe beim Setup).
    const found = (this.discovered || []).filter(isControlService)
    const foundText = found.length
      ? found.map((s) => `${CAPABILITIES[s.role]?.label ?? s.role} → ${s.host}:${s.port}`).join(' · ')
      : 'Noch nichts gefunden — Tools im selben LAN starten (mDNS/UDP 5353 offen).'
    return [
      {
        type: 'dropdown',
        id: 'role',
        label: 'Tool (Rolle)',
        width: 6,
        default: 'switcher',
        choices: KNOWN_ROLES.map((r) => ({ id: r, label: CAPABILITIES[r].label })),
      },
      {
        type: 'dropdown',
        id: 'mode',
        label: 'Verbindung',
        width: 6,
        default: 'manual',
        choices: [
          { id: 'manual', label: 'Manuell (IP/Port)' },
          { id: 'auto', label: 'Automatisch (mDNS)' },
        ],
      },
      { type: 'textinput', id: 'host', label: 'IP-Adresse (manuell)', width: 6, default: '127.0.0.1', regex: Regex.IP },
      { type: 'number', id: 'port', label: 'Port (manuell)', width: 4, default: 8723, min: 1, max: 65535 },
      {
        type: 'static-text',
        id: 'secinfo',
        label: 'Sichere Steuerebene (optional)',
        width: 12,
        value:
          'Token + TLS-Fingerprint aus dem Launcher → „Sichere Steuerebene". ' +
          'Beide leer = offen (wie bisher). Nur Token = Authentifizierung ohne ' +
          'Verschlüsselung. Mit Fingerprint = TLS-verschlüsselt + gepinnt (Schutz vor MITM).',
      },
      { type: 'textinput', id: 'token', label: 'Suite-Token', width: 12, default: '' },
      { type: 'textinput', id: 'tlsFingerprint', label: 'TLS-Fingerprint (SHA-256)', width: 12, default: '' },
      { type: 'static-text', id: 'discovered', label: 'Gefunden im LAN', width: 12, value: foundText },
      { type: 'static-text', id: 'ports', label: 'Standard-Ports', width: 12, value: ports },
    ]
  }

  // ── Definitionen aus der Capabilities-Tabelle ───────────────────────────────

  buildActions(cap) {
    const actions = {}
    for (const a of cap.actions) {
      actions[a.id] = {
        name: a.label,
        options: (a.args ?? []).map(toCompanionOption),
        callback: (ev) => this.send(buildCommandLine(cap.role, a, ev.options, this.state)),
      }
    }
    return actions
  }

  buildFeedbacks(cap) {
    const fb = {}
    for (const f of cap.feedbacks) {
      fb[f.id] = {
        type: 'boolean',
        name: f.label,
        defaultStyle: { bgcolor: rgb(f.bgcolor), color: rgb(f.color) },
        options: f.arg ? [toCompanionOption(f.arg)] : [],
        callback: (feedback) => {
          const v = this.state[f.stateKey]
          if (f.match === 'truthy') return isTruthy(v)
          return Number(v) === Number(feedback.options[f.arg.id])
        },
      }
    }
    return fb
  }

  buildVariables(cap) {
    return cap.variables.map((v) => ({ variableId: v.id, name: v.label }))
  }

  buildPresets(cap) {
    const presets = {}
    for (const a of cap.actions) {
      const options = {}
      for (const arg of a.args ?? []) options[arg.id] = arg.default
      const fb = cap.feedbacks.find((f) => f.id === a.verb || f.stateKey === a.toggleKey)
      presets[a.id] = {
        type: 'button',
        category: cap.label,
        name: a.label,
        style: {
          text: a.label.length > 14 ? a.verb.toUpperCase() : a.label,
          size: '14',
          color: combineRgb(255, 255, 255),
          bgcolor: combineRgb(0, 0, 0),
        },
        steps: [{ down: [{ actionId: a.id, options }], up: [] }],
        feedbacks: fb && !fb.arg ? [{ feedbackId: fb.id, options: {} }] : [],
      }
    }
    return presets
  }

  // ── mDNS-Auto-Discovery (Welle 1.6, Stufe 2) ────────────────────────────────

  startDiscovery() {
    this.stopDiscovery()
    try {
      this.browser = browseSuite((services) => {
        this.discovered = services
        this.onDiscovered()
      })
    } catch (e) {
      // mDNS optional (z. B. headless/Firewall) — manueller Modus bleibt nutzbar.
      this.log('warn', `mDNS-Discovery nicht verfügbar: ${String(e?.message ?? e)}`)
    }
  }

  stopDiscovery() {
    if (this.browser) {
      try {
        this.browser.stop()
      } catch {
        /* egal */
      }
      this.browser = undefined
    }
  }

  /** Im Auto-Modus: passenden Steuer-Endpunkt wählen und (neu) verbinden. */
  onDiscovered() {
    if (this.config?.mode !== 'auto') return
    const ep = pickEndpoint(this.role, this.discovered)
    if (!ep) return
    // Nur (neu) verbinden, wenn sich der Endpunkt geändert hat — sonst übernimmt
    // der Auto-Reconnect von TCPHelper das Wiederverbinden bei kurzen Aussetzern.
    if (this.socket && this.activeHost === ep.host && this.activePort === ep.port) return
    this.connectTo(ep.host, ep.port)
  }

  // ── TCP-Verbindung + STATE ──────────────────────────────────────────────────

  connect() {
    if (this.config?.mode === 'auto') {
      const ep = pickEndpoint(this.role, this.discovered)
      if (!ep) {
        this.disconnect()
        this.updateStatus(InstanceStatus.Connecting, 'Suche Tool per mDNS …')
        return // onDiscovered() verbindet, sobald das Tool auftaucht
      }
      this.connectTo(ep.host, ep.port)
      return
    }
    // Manueller Modus: feste IP/Port aus der Config.
    const host = this.config?.host
    const port = Number(this.config?.port) || CAPABILITIES[this.role]?.port || 8723
    if (!host) {
      this.updateStatus(InstanceStatus.BadConfig, 'Keine IP gesetzt')
      return
    }
    this.connectTo(host, port)
  }

  /** Token/Fingerprint aus der Config (getrimmt/normalisiert). */
  secureConfig() {
    const token = String(this.config?.token ?? '').trim()
    const fingerprint = normalizeFingerprint(this.config?.tlsFingerprint ?? '')
    return { token, fingerprint, secure: !!(token || fingerprint) }
  }

  connectTo(host, port) {
    this.disconnect()
    this.activeHost = host
    this.activePort = port
    const { token, fingerprint } = this.secureConfig()
    if (token || fingerprint) this.openSecure(host, port, token, fingerprint)
    else this.openPlain(host, port)
  }

  // Offener Modus: unveränderter TCPHelper-Pfad (Klartext, kein Handshake) — der
  // Auto-Reconnect von TCPHelper bleibt erhalten.
  openPlain(host, port) {
    this.updateStatus(InstanceStatus.Connecting)
    this.socket = new TCPHelper(host, port)
    const feed = createLineBuffer((line) => {
      const st = parseSuiteState(line)
      if (st && matchesRole(this.role, st.ns)) this.applyState(st.kv)
    })
    this.socket.on('connect', () => {
      this.updateStatus(InstanceStatus.Ok)
      this.send('STATE?')
    })
    this.socket.on('data', (chunk) => feed(chunk.toString('utf8')))
    this.socket.on('error', (err) => {
      this.updateStatus(InstanceStatus.ConnectionFailure, String(err?.message ?? err))
    })
    this.socket.on('end', () => {
      this.updateStatus(InstanceStatus.Disconnected)
    })
  }

  // Sicherer Modus (P1, #59): TLS + Fingerprint-Pinning und/oder Token-Handshake.
  // TCPHelper kann kein TLS → eigener node:net/tls-Socket mit eigenem Reconnect.
  // Spiegelt SuiteControlClient.open() (packages/suite-control-protocol/client.ts).
  openSecure(host, port, token, fingerprint) {
    const useTls = !!fingerprint
    this.updateStatus(InstanceStatus.Connecting, useTls ? 'TLS-Verbindung …' : 'Verbinde …')
    const socket = useTls
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.connect({ host, port })
    socket.setEncoding('utf8')
    this.secureSocket = socket
    const feed = createLineBuffer((line) => {
      // secure-Handshake: Server fordert mit AUTHREQ einen Beweis an.
      const req = parseAuthReq(line)
      if (req) {
        if (token) this.sendSecure(formatAuth(computeAuthProof(token, req.nonce)))
        return // ohne Token: nichts senden → Server schließt mit AUTHFAIL
      }
      if (isAuthOk(line)) {
        this.updateStatus(InstanceStatus.Ok)
        this.sendSecure('STATE?') // Server liefert den Greeting-STATE direkt danach
        return
      }
      if (isAuthFail(line)) {
        this.updateStatus(InstanceStatus.ConnectionFailure, 'Authentifizierung abgelehnt — Token prüfen')
        return // 'close' folgt → Reconnect
      }
      const st = parseSuiteState(line)
      if (st && matchesRole(this.role, st.ns)) this.applyState(st.kv)
    })
    const onReady = () => {
      if (useTls) {
        // Selbstsigniert → Kette NICHT prüfen; stattdessen Fingerprint pinnen (TOFU).
        const peer = socket.getPeerCertificate()
        const got = peer && peer.fingerprint256 ? normalizeFingerprint(peer.fingerprint256) : ''
        if (!got || got !== fingerprint) {
          this.updateStatus(InstanceStatus.ConnectionFailure, 'TLS-Fingerprint stimmt nicht (MITM?) — verworfen')
          socket.destroy() // 'close' folgt → Reconnect
          return
        }
      }
      // Mit Token: nichts senden — der Server schickt AUTHREQ, Antwort erfolgt im
      // feed(). Nur TLS ohne Token (auth-loser secure-Server): Zustand anfordern.
      if (!token) {
        this.updateStatus(InstanceStatus.Ok)
        this.sendSecure('STATE?')
      } else {
        this.updateStatus(InstanceStatus.Connecting, 'Authentifiziere …')
      }
    }
    socket.on(useTls ? 'secureConnect' : 'connect', onReady)
    socket.on('data', (chunk) => feed(chunk))
    socket.on('error', (err) => {
      this.updateStatus(InstanceStatus.ConnectionFailure, String(err?.message ?? err))
    })
    socket.on('close', () => {
      this.secureSocket = undefined
      this.scheduleReconnect()
    })
  }

  sendSecure(line) {
    if (this.secureSocket && !this.secureSocket.destroyed) {
      try {
        this.secureSocket.write(line.endsWith('\n') ? line : line + '\n')
      } catch {
        /* egal */
      }
    }
  }

  // Reconnect nur im Secure-Pfad (im offenen Modus reconnectet TCPHelper selbst).
  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const host = this.activeHost
    const port = this.activePort
    if (!host) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.connectTo(host, port)
    }, 2000)
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.socket) {
      this.socket.destroy()
      this.socket = undefined
    }
    if (this.secureSocket) {
      this.secureSocket.removeAllListeners()
      this.secureSocket.destroy()
      this.secureSocket = undefined
    }
    this.activeHost = undefined
    this.activePort = undefined
  }

  send(line) {
    if (this.secureSocket) {
      this.sendSecure(line)
      return
    }
    if (this.socket && this.socket.isConnected) this.socket.send(line + '\n')
  }

  applyState(kv) {
    this.state = kv
    const cap = CAPABILITIES[this.role]
    if (!cap) return
    const values = {}
    for (const v of cap.variables) values[v.id] = kv[v.id] ?? ''
    this.setVariableValues(values)
    this.checkFeedbacks(...cap.feedbacks.map((f) => f.id))
  }
}

runEntrypoint(JmSuiteInstance, [])
