/**
 * The phone remote UI, served as a single self-contained HTML document by
 * remote.ts. No build step, no external assets — inline CSS + vanilla JS. It
 * connects to /events (SSE) for live slide state and POSTs to /cmd for actions.
 */
export function controllerHtml(pinRequired: boolean): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#0c0c0c" />
<title>JM Presenter · Fernsteuerung</title>
<style>
  :root { --bg:#0c0c0c; --card:#191919; --line:#2a2a2a; --fg:#fff; --muted:#9a9a9a; --accent:#ffe000; --danger:#ff5a5a; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { margin:0; height:100%; }
  body { background:var(--bg); color:var(--fg); font:16px/1.4 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;
         display:flex; flex-direction:column; padding:env(safe-area-inset-top) 14px env(safe-area-inset-bottom); user-select:none; -webkit-user-select:none; overscroll-behavior:none; }
  .hidden { display:none !important; }
  header { display:flex; align-items:center; gap:10px; padding:14px 2px 8px; }
  header .dot { width:9px; height:9px; border-radius:50%; background:#555; flex:none; }
  header .dot.on { background:#36d36b; box-shadow:0 0 8px #36d36b; }
  header b { font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
  header span { color:var(--muted); font-size:12px; margin-left:auto; }
  .pos { text-align:center; padding:6px 0 2px; }
  .pos .n { font-size:54px; font-weight:800; color:var(--accent); line-height:1; }
  .pos .t { color:var(--muted); font-size:15px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; margin:10px 0; }
  .lbl { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); font-weight:700; margin-bottom:5px; }
  .title { font-size:19px; font-weight:700; min-height:24px; }
  .next { color:var(--muted); font-size:15px; }
  .notes { white-space:pre-wrap; font-size:15px; max-height:26vh; overflow:auto; }
  .nav { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:6px 0 12px; }
  button { font:inherit; color:var(--fg); border:1px solid var(--line); background:var(--card); border-radius:14px; padding:0; cursor:pointer; }
  button:active { transform:scale(.97); }
  .nav button { height:96px; font-size:21px; font-weight:800; }
  .nav .prev { background:#1f1f1f; }
  .nav .next { background:var(--accent); color:#1a1a1a; border-color:var(--accent); }
  .nav button:disabled { opacity:.3; }
  .screens { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .screens button { height:58px; font-size:15px; font-weight:700; }
  .screens button.active { outline:2px solid var(--accent); }
  .screens .b { background:#000; } .screens .w { background:#fff; color:#000; } .screens .l { background:#1f1f1f; }
  .stop { width:100%; height:52px; margin-top:12px; font-weight:700; color:var(--danger); border-color:#5a2a2a; background:#1a1010; }
  .gate { margin:auto; width:100%; max-width:320px; text-align:center; }
  .gate h1 { font-size:20px; } .gate p { color:var(--muted); font-size:14px; }
  .pin { width:100%; height:60px; font-size:30px; letter-spacing:.4em; text-align:center; border-radius:14px;
         border:1px solid var(--line); background:var(--card); color:var(--fg); margin:14px 0; }
  .gate button { width:100%; height:54px; background:var(--accent); color:#1a1a1a; border-color:var(--accent); font-weight:800; font-size:17px; }
  .err { color:var(--danger); font-size:14px; min-height:18px; }
  .toast { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); background:#000; border:1px solid var(--line);
           padding:10px 16px; border-radius:12px; font-size:14px; opacity:0; transition:opacity .2s; pointer-events:none; }
  .toast.show { opacity:1; }
</style>
</head>
<body>
  <div id="gate" class="gate ${pinRequired ? '' : 'hidden'}">
    <h1>JM Presenter</h1>
    <p>PIN aus der App eingeben, um die Präsentation zu steuern.</p>
    <input id="pin" class="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" />
    <div class="err" id="gateErr"></div>
    <button id="connect">Verbinden</button>
  </div>

  <div id="app" class="${pinRequired ? 'hidden' : ''}" style="flex:1; display:flex; flex-direction:column;">
    <header>
      <span class="dot" id="conn"></span>
      <b>Fernsteuerung</b>
      <span id="screenTag"></span>
    </header>
    <div class="pos"><div class="n" id="pos">–</div><div class="t" id="of"></div></div>
    <div class="card"><div class="lbl">Aktuelle Folie</div><div class="title" id="title">—</div>
      <div class="next" id="next"></div></div>
    <div class="nav">
      <button class="prev" id="prev">‹ Zurück</button>
      <button class="next" id="fwd">Weiter ›</button>
    </div>
    <div class="screens">
      <button class="b" data-screen="black">Schwarz</button>
      <button class="w" data-screen="white">Weiß</button>
      <button class="l" data-screen="live">Folie</button>
    </div>
    <div class="card" style="flex:1; min-height:0;"><div class="lbl">Notizen</div>
      <div class="notes" id="notes"></div></div>
    <button class="stop" id="stop">■ Präsentation beenden</button>
  </div>
  <div class="toast" id="toast"></div>

<script>
(function(){
  var pinRequired = ${pinRequired ? 'true' : 'false'};
  var pin = localStorage.getItem('jmpr_pin') || '';
  var es = null;
  var $ = function(id){ return document.getElementById(id); };

  function toast(t){ var el=$('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(function(){el.classList.remove('show');},1400); }

  function cmd(action, extra){
    var body = Object.assign({ action: action, pin: pin }, extra||{});
    return fetch('/cmd', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) })
      .then(function(r){
        if (r.status === 401){ onAuthFail(); throw new Error('pin'); }
        return r.json();
      }).then(render).catch(function(){});
  }

  function onAuthFail(){
    localStorage.removeItem('jmpr_pin'); pin='';
    if (es){ es.close(); es=null; }
    $('app').classList.add('hidden'); $('gate').classList.remove('hidden');
    $('gateErr').textContent = 'Falsche PIN.';
  }

  function render(v){
    if (!v) return;
    if (!v.active){ $('pos').textContent='–'; $('of').textContent='Keine Präsentation aktiv'; $('title').textContent='—'; $('next').textContent=''; $('notes').textContent=''; return; }
    $('pos').textContent = (v.index+1);
    $('of').textContent = '/ ' + v.total;
    $('title').textContent = v.title || ('Folie ' + (v.index+1));
    $('next').textContent = v.nextTitle ? ('Nächste: ' + v.nextTitle) : 'Ende der Präsentation';
    $('notes').textContent = v.notes || '';
    $('prev').disabled = v.index<=0; $('fwd').disabled = v.index>=v.total-1;
    document.querySelectorAll('[data-screen]').forEach(function(b){ b.classList.toggle('active', b.dataset.screen===v.screen); });
    var tag={black:'Schwarzbild',white:'Weißbild',live:''}[v.screen]||''; $('screenTag').textContent=tag;
  }

  function connect(){
    if (es) es.close();
    es = new EventSource('/events' + (pin ? '?pin='+encodeURIComponent(pin) : ''));
    es.onopen = function(){ $('conn').classList.add('on'); };
    es.onmessage = function(e){ try{ render(JSON.parse(e.data)); }catch(_){} };
    es.onerror = function(){ $('conn').classList.remove('on'); };
  }

  // gate (PS-15: die PIN prüft der lesende Strom /events, der nichts schaltet; nach der Antwort wird er abgebrochen)
  $('connect').addEventListener('click', function(){
    var v = $('pin').value.trim();
    if (v.length<4){ $('gateErr').textContent='4-stellige PIN.'; return; }
    pin = v; localStorage.setItem('jmpr_pin', pin);
    var pruefung = typeof AbortController === 'function' ? new AbortController() : null; // iOS Safari vor 12.2, Chrome vor 66: ohne
    fetch('/events?pin=' + encodeURIComponent(pin), pruefung ? { signal: pruefung.signal } : {})
      .then(function(r){ if (r.status===401){ $('gateErr').textContent='Falsche PIN.'; return; }
        if (pruefung) pruefung.abort(); else if (r.body && r.body.cancel) r.body.cancel(); $('gate').classList.add('hidden'); $('app').classList.remove('hidden'); connect(); });
  });
  $('pin').addEventListener('keydown', function(e){ if(e.key==='Enter') $('connect').click(); });

  // controls
  $('prev').addEventListener('click', function(){ cmd('prev'); });
  $('fwd').addEventListener('click', function(){ cmd('next'); });
  $('stop').addEventListener('click', function(){ if(confirm('Präsentation beenden?')) cmd('stop'); });
  document.querySelectorAll('[data-screen]').forEach(function(b){
    b.addEventListener('click', function(){ cmd(b.dataset.screen==='live'?'live':b.dataset.screen); });
  });
  // volume / page keys on some BT clickers arrive as keydown in the browser
  document.addEventListener('keydown', function(e){
    if (e.key==='ArrowRight'||e.key==='PageDown'){ cmd('next'); }
    else if (e.key==='ArrowLeft'||e.key==='PageUp'){ cmd('prev'); }
  });

  if (!pinRequired || pin){ if(pinRequired){ $('gate').classList.add('hidden'); $('app').classList.remove('hidden'); } connect(); }
})();
</script>
</body>
</html>`;
}
