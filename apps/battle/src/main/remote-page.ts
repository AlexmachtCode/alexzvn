// Selbsterhaltende HTML-Seite des Publikums-Votings (von @jm/remote unter `/`
// ausgeliefert; inline CSS+JS, Muster apps/qa/src/main/remote-page.ts). Zwei große
// Buttons für A/B; abstimmbar nur wenn das Voting der aktuellen Runde offen ist.
// Eine Stimme je Runde/Gerät (localStorage, best-effort). Live-Stand via /events.
export const REMOTE_PAGE = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<title>Voting — JM Battle</title>
<style>
  :root{ --bg:#0e0e10; --fg:#fff; --muted:#9a9a9a; --line:#2a2a2a; --a:#3da5ff; --b:#ff5c5c; --dark:#121212; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body{ margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap{ max-width:560px; margin:0 auto; padding:20px 16px 40px; min-height:100vh; display:flex; flex-direction:column; }
  h1{ font-size:20px; margin:6px 0 2px; text-align:center; }
  .round{ text-align:center; color:var(--muted); font-size:14px; margin-bottom:18px; }
  .vs{ display:flex; flex-direction:column; gap:14px; flex:1; justify-content:center; }
  button.vote{ width:100%; padding:30px 16px; border:0; border-radius:16px; font-size:24px; font-weight:800; color:#fff; }
  button.vote:disabled{ opacity:.45; }
  .a{ background:linear-gradient(135deg,#1f6fb2,#3da5ff); }
  .b{ background:linear-gradient(135deg,#b23030,#ff5c5c); }
  .crew{ display:block; font-size:13px; font-weight:500; opacity:.85; margin-top:4px; }
  .status{ margin-top:18px; text-align:center; color:var(--muted); font-size:14px; min-height:20px; }
  .ok{ color:#7bd88f; }
  .closed{ text-align:center; color:var(--muted); padding:24px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Wer hat die Runde?</h1>
  <div class="round" id="round">Runde –</div>
  <div class="vs">
    <button class="vote a" id="voteA" onclick="vote('A')"><span id="nameA">A</span><span class="crew" id="crewA"></span></button>
    <button class="vote b" id="voteB" onclick="vote('B')"><span id="nameB">B</span><span class="crew" id="crewB"></span></button>
  </div>
  <div class="status" id="st"></div>
</div>
<script>
  var cur = { round:0, votingOpen:false };
  // P1 (#59): Zugriffs-Token aus der eigenen URL (?t=) lesen und an jeden
  // Daten-Aufruf anhängen. Der QR-Link trägt das Token; ohne Token (open-Modus)
  // bleibt withT() ein No-Op.
  var T=new URLSearchParams(location.search).get('t')||'';
  function withT(p){ return T ? p+(p.indexOf('?')<0?'?':'&')+'t='+encodeURIComponent(T) : p; }
  function setText(id,t){ var el=document.getElementById(id); if(el) el.textContent=t; }
  function votedKey(r){ return 'jmbattle_voted_'+r; }
  function apply(s){
    if(!s) return;
    cur.round = s.round||0; cur.votingOpen = !!s.votingOpen;
    setText('round', s.round ? ('Runde '+s.round+(s.rounds?(' / '+s.rounds):'')) : 'Runde –');
    setText('nameA', s.A||'A'); setText('nameB', s.B||'B');
    setText('crewA', s.crewA||''); setText('crewB', s.crewB||'');
    var voted = localStorage.getItem(votedKey(cur.round)) === '1';
    var open = cur.votingOpen && !voted;
    document.getElementById('voteA').disabled = !open;
    document.getElementById('voteB').disabled = !open;
    var st=document.getElementById('st');
    if(!s.votingEnabled){ st.textContent='Publikums-Voting ist deaktiviert.'; st.className='status'; }
    else if(!cur.votingOpen){ st.textContent='Voting geschlossen — warte auf die nächste Runde.'; st.className='status'; }
    else if(voted){ st.textContent='Danke, deine Stimme zählt!'; st.className='status ok'; }
    else { st.textContent='Stimme jetzt ab.'; st.className='status'; }
  }
  function vote(side){
    if(!cur.votingOpen) return;
    var r=cur.round; if(localStorage.getItem(votedKey(r))==='1') return;
    localStorage.setItem(votedKey(r),'1');
    document.getElementById('voteA').disabled=true; document.getElementById('voteB').disabled=true;
    var st=document.getElementById('st'); st.textContent='Danke, deine Stimme zählt!'; st.className='status ok';
    fetch(withT('/cmd'),{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'vote',side:side,round:r})}).catch(function(){});
  }
  function connect(){ try{ var es=new EventSource(withT('/events')); es.onmessage=function(e){ try{ apply(JSON.parse(e.data)); }catch(_){} }; }catch(_){} }
  fetch(withT('/state')).then(function(r){return r.json();}).then(apply).catch(function(){});
  connect();
</script>
</body>
</html>`;
