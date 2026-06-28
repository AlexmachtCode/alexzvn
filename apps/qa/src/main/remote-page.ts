// Selbsterhaltende HTML-Seite der Saal-Einreichung (wird von @jm/remote unter `/`
// ausgeliefert). Kein Build/Asset-Bundling — alles inline (CSS + Vanilla-JS), wie
// apps/prompter/src/main/remote-page.ts. Das Publikum reicht Name/Funktion/Frage
// ein; die Seite POSTet { type:'submit', ... } an /cmd und zeigt per /events, ob
// die Einreichung offen ist und wie viele Wortmeldungen warten.
export const REMOTE_PAGE = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>Wortmeldung — JM Q&amp;A</title>
<style>
  :root{ --bg:#121212; --fg:#fff; --muted:#9a9a9a; --line:#2a2a2a; --yellow:#fbe73b; --dark:#121212; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body{ margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap{ max-width:560px; margin:0 auto; padding:20px 16px 40px; }
  h1{ font-size:20px; margin:8px 0 2px; }
  .sub{ color:var(--muted); font-size:13px; margin-bottom:18px; }
  label{ display:block; font-size:13px; color:var(--muted); margin:14px 0 6px; }
  input,textarea{ width:100%; background:#1c1c1c; border:1px solid var(--line); color:var(--fg);
    border-radius:10px; padding:13px 12px; font-size:16px; font-family:inherit; }
  textarea{ min-height:96px; resize:vertical; }
  button{ width:100%; margin-top:20px; padding:15px; border:0; border-radius:12px; background:var(--yellow);
    color:var(--dark); font-size:17px; font-weight:700; }
  button:disabled{ opacity:.5; }
  .status{ margin-top:16px; text-align:center; color:var(--muted); font-size:13px; min-height:18px; }
  .ok{ color:#7bd88f; }
  .closed{ margin-top:24px; padding:16px; border:1px solid var(--line); border-radius:12px; text-align:center; color:var(--muted); }
  .hide{ display:none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Wortmeldung</h1>
  <div class="sub" id="sub">Frage oder Wortmeldung einreichen.</div>

  <div id="form">
    <label for="name">Name *</label>
    <input id="name" autocomplete="name" placeholder="Vor- und Nachname" />
    <label for="aff">Funktion / Medium / Fraktion</label>
    <input id="aff" placeholder="z. B. ARD, Fraktion XY" />
    <label for="q">Frage (optional)</label>
    <textarea id="q" placeholder="Worum geht es?"></textarea>
    <button id="send">Einreichen</button>
    <div class="status" id="st"></div>
  </div>

  <div class="closed hide" id="closed">Die Einreichung ist gerade geschlossen.</div>
</div>
<script>
  var nameEl=document.getElementById('name'), affEl=document.getElementById('aff'), qEl=document.getElementById('q');
  var sendEl=document.getElementById('send'), stEl=document.getElementById('st'), subEl=document.getElementById('sub');
  var formEl=document.getElementById('form'), closedEl=document.getElementById('closed');

  // P1 (#59): Zugriffs-Token aus der eigenen URL (?t=) lesen und an jeden
  // Daten-Aufruf anhängen. Der QR-Link trägt das Token; ohne Token (open-Modus)
  // bleibt withT() ein No-Op und alles funktioniert wie bisher.
  var T=new URLSearchParams(location.search).get('t')||'';
  function withT(p){ return T ? p+(p.indexOf('?')<0?'?':'&')+'t='+encodeURIComponent(T) : p; }

  function apply(s){
    if(!s) return;
    var accepting = s.accepting !== false;
    formEl.classList.toggle('hide', !accepting);
    closedEl.classList.toggle('hide', accepting);
    if(typeof s.waiting === 'number'){
      subEl.textContent = s.waiting > 0 ? (s.waiting + ' Wortmeldung' + (s.waiting===1?'':'en') + ' in der Warteschlange.') : 'Frage oder Wortmeldung einreichen.';
    }
  }
  function send(){
    var name=(nameEl.value||'').trim();
    if(!name){ stEl.textContent='Bitte einen Namen angeben.'; stEl.className='status'; nameEl.focus(); return; }
    sendEl.disabled=true; stEl.textContent='Sende …'; stEl.className='status';
    fetch(withT('/cmd'),{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'submit',name:name,affiliation:(affEl.value||'').trim(),question:(qEl.value||'').trim()})})
      .then(function(){ stEl.textContent='Danke! Deine Wortmeldung ist eingegangen.'; stEl.className='status ok';
        affEl.value=''; qEl.value=''; nameEl.value=''; })
      .catch(function(){ stEl.textContent='Senden fehlgeschlagen — bitte erneut versuchen.'; stEl.className='status'; })
      .finally(function(){ sendEl.disabled=false; });
  }
  sendEl.addEventListener('click', send);
  function connect(){
    try{
      var es=new EventSource(withT('/events'));
      es.onmessage=function(e){ try{ apply(JSON.parse(e.data)); }catch(_){} };
    }catch(_){}
  }
  fetch(withT('/state')).then(function(r){return r.json();}).then(apply).catch(function(){});
  connect();
</script>
</body>
</html>`;
