// ===== Config =====
const GATEWAY_WSS = 'wss://transcriber-gateway.onrender.com/v1/stream'; // <-- your Render URL

// Friendly language list (flag + name + code)
const LANGS = [
  {code:'nl-NL', flag:'🇳🇱', name:'Dutch (Netherlands)'},
  {code:'nl-BE', flag:'🇧🇪', name:'Dutch (Belgium)'},
  {code:'en-US', flag:'🇺🇸', name:'English (US)'},
  {code:'en-GB', flag:'🇬🇧', name:'English (UK)'},
  {code:'ar-SY', flag:'🇸🇾', name:'Arabic (Syrian)'},
  {code:'ar-LB', flag:'🇱🇧', name:'Arabic (Lebanon)'},
  {code:'ar-SA', flag:'🇸🇦', name:'Arabic (Saudi)'},
  {code:'fr-FR', flag:'🇫🇷', name:'French'},
  {code:'de-DE', flag:'🇩🇪', name:'German'},
  {code:'es-ES', flag:'🇪🇸', name:'Spanish'},
  {code:'it-IT', flag:'🇮🇹', name:'Italian'},
  {code:'pt-PT', flag:'🇵🇹', name:'Portuguese (EU)'},
  {code:'pt-BR', flag:'🇧🇷', name:'Portuguese (BR)'},
  {code:'tr-TR', flag:'🇹🇷', name:'Turkish'},
  {code:'fa-IR', flag:'🇮🇷', name:'Persian'},
  {code:'ru-RU', flag:'🇷🇺', name:'Russian'},
  {code:'uk-UA', flag:'🇺🇦', name:'Ukrainian'},
  {code:'sv-SE', flag:'🇸🇪', name:'Swedish'},
  {code:'da-DK', flag:'🇩🇰', name:'Danish'},
  {code:'nb-NO', flag:'🇳🇴', name:'Norwegian'},
  {code:'fi-FI', flag:'🇫🇮', name:'Finnish'},
  {code:'pl-PL', flag:'🇵🇱', name:'Polish'},
  {code:'ro-RO', flag:'🇷🇴', name:'Romanian'},
  {code:'cs-CZ', flag:'🇨🇿', name:'Czech'},
  {code:'el-GR', flag:'🇬🇷', name:'Greek'},
  {code:'hi-IN', flag:'🇮🇳', name:'Hindi'},
  {code:'bn-BD', flag:'🇧🇩', name:'Bengali'},
  {code:'zh-CN', flag:'🇨🇳', name:'Chinese (CN)'},
  {code:'zh-TW', flag:'🇹🇼', name:'Chinese (TW)'},
  {code:'ja-JP', flag:'🇯🇵', name:'Japanese'},
  {code:'ko-KR', flag:'🇰🇷', name:'Korean'}
];

// ===== UI refs =====
const els = {
  start: document.getElementById('start'),
  stop: document.getElementById('stop'),
  dl: document.getElementById('download'),
  save: document.getElementById('save'),
  historyBtn: document.getElementById('historyBtn'),
  status: document.getElementById('status'),
  lang: document.getElementById('lang'),
  pro: document.getElementById('pro'),
  partial: document.getElementById('partial'),
  finals: document.getElementById('finals'),
  meter: document.getElementById('meter'),
  autodetect: document.getElementById('autodetect'),
  historyList: document.getElementById('historyList')
};

// Populate dropdown (with flags)
function fillLanguages(){
  els.lang.innerHTML = '';
  // Auto entry:
  const auto = document.createElement('option');
  auto.value = '__auto__'; auto.textContent = '🤖 Auto (EN/NL/AR)';
  els.lang.appendChild(auto);
  LANGS.forEach(({code, flag, name})=>{
    const opt = document.createElement('option');
    opt.value = code; opt.textContent = `${flag} ${name} — ${code}`;
    if (code==='nl-NL') opt.selected = true;
    els.lang.appendChild(opt);
  });
}
fillLanguages();

// ===== Helpers =====
let transcript = [];
function setStatus(text, spinning=false){
  els.status.textContent = text;
  els.status.classList.toggle('spin', spinning);
}
function stamp(){return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});}
function addFinal(t){
  transcript.push({ t, at: new Date(), lang: currentLang(), pro: els.pro.checked });
  const wrap=document.createElement('div'); wrap.className='segment';
  const tm=document.createElement('div'); tm.className='time'; tm.textContent=stamp();
  const p=document.createElement('div'); p.textContent=t;
  wrap.appendChild(tm); wrap.appendChild(p);
  els.finals.appendChild(wrap);
  els.dl.disabled = els.save.disabled = transcript.length===0;
}
function downloadTXT(){
  const content = transcript.map(x => `[${x.at.toISOString()}] (${x.lang}${x.pro?'/pro':''}) ${x.t}`).join('\n');
  const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`transcript-${Date.now()}.txt`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
els.dl.onclick = downloadTXT;

function saveTranscript(){
  const storeKey='tx.history';
  const entry = {
    id: String(Date.now()),
    at: new Date().toISOString(),
    lang: currentLang(),
    pro: els.pro.checked,
    text: transcript.map(t=>t.t).join(' ')
  };
  const arr = JSON.parse(localStorage.getItem(storeKey) || '[]');
  arr.unshift(entry);
  localStorage.setItem(storeKey, JSON.stringify(arr));
  paintHistory();
}
els.save.onclick = saveTranscript;

function paintHistory(){
  const arr = JSON.parse(localStorage.getItem('tx.history') || '[]');
  els.historyList.innerHTML = '';
  arr.forEach(e=>{
    const row=document.createElement('div'); row.className='historyItem';
    const meta=document.createElement('div'); meta.className='meta';
    meta.textContent = `${new Date(e.at).toLocaleString()} — ${e.lang}${e.pro?'/pro':''}`;
    const copy=document.createElement('button'); copy.textContent='Copy';
    copy.onclick=()=>navigator.clipboard.writeText(e.text);
    row.appendChild(meta); row.appendChild(copy);
    els.historyList.appendChild(row);
  });
}
paintHistory();

// ===== Browser SR (fallback) =====
let rec=null, running=false;
function currentLang(){
  const v = els.lang.value;
  if (v==='__auto__') return 'auto';
  return v;
}
function startBrowser(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert('Browser SR not available. Turn on Pro mode.'); return; }
  const chosen = currentLang()==='auto' ? 'en-US' : currentLang(); // start somewhere
  rec = new SR();
  rec.lang = chosen; rec.interimResults=true; rec.continuous=true;
  rec.onstart=()=>{ running=true; setStatus('listening…'); els.start.disabled=true; els.stop.disabled=false; };
  rec.onerror=e=>setStatus('error: '+(e.error||'unknown'));
  rec.onend =()=>{ running=false; setStatus('stopped'); els.start.disabled=false; els.stop.disabled=true; };
  rec.onresult=(ev)=>{ let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){const r=ev.results[i]; if(r.isFinal) addFinal(r[0].transcript.trim()); else interim+=r[0].transcript;} els.partial.textContent=interim.trim(); };
  rec.start();
}
function stopBrowser(){ if(rec && running) rec.stop(); }

// ===== Deepgram mode =====
let ctx, proc, stream, ws, rafId, analyser;
function floatTo16(f32){
  const b=new ArrayBuffer(f32.length*2), v=new DataView(b); let o=0;
  for(let i=0;i<f32.length;i++,o+=2){ let s=Math.max(-1,Math.min(1,f32[i])); v.setInt16(o, s<0?s*0x8000:s*0x7fff, true); }
  return b;
}
async function startDeepgram(){
  // Wake server
  setStatus('waking…', true);
  try{ await fetch(GATEWAY_WSS.replace('wss://','https://').replace('/v1/stream','/health')); }catch{}
  // Mic
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, channelCount:1 }});
  }catch(e){ alert('Please Allow microphone'); setStatus('mic blocked'); return; }
  // Audio context + analyser for volume
  try{ ctx = new (window.AudioContext||window.webkitAudioContext)({ sampleRate:16000 }); }catch{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }
  const src = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
  src.connect(analyser);
  const meterBuf = new Uint8Array(analyser.fftSize);
  const meterLoop = () => {
    analyser.getByteTimeDomainData(meterBuf);
    // Compute RMS
    let sum=0; for(let i=0;i<meterBuf.length;i++){ const v=(meterBuf[i]-128)/128; sum+=v*v; }
    const rms=Math.sqrt(sum/meterBuf.length);
    els.meter.style.width = Math.min(100, Math.round(rms*220)) + '%';
    rafId = requestAnimationFrame(meterLoop);
  };
  meterLoop();

  // Processor for PCM16
  proc = ctx.createScriptProcessor(4096,1,1);
  const chosen = currentLang()==='auto' ? 'en-US' : currentLang();
  setStatus('connecting…', true);
  ws = new WebSocket(`${GATEWAY_WSS}?lang=${encodeURIComponent(chosen)}`);
  ws.onopen = () => { setStatus('connected'); els.start.disabled=true; els.stop.disabled=false; };
  ws.onerror = () => setStatus('ws error');
  ws.onclose = () => setStatus('stopped');

  ws.onmessage = (e) => {
    let msg; try{ msg = JSON.parse(e.data); }catch{ return; }
    if (msg.type==='partial') els.partial.textContent = msg.text || '';
    if (msg.type==='final'){ els.partial.textContent=''; if (msg.text) addFinal(msg.text); }
  };

  const join = ctx.createMediaStreamSource(stream);
  join.connect(proc);
  proc.onaudioprocess = (ev) => {
    const f32 = ev.inputBuffer.getChannelData(0);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(floatTo16(f32));
  };
  proc.connect(ctx.destination);
}
function stopDeepgram(){
  try{ cancelAnimationFrame(rafId); }catch{}
  try{ proc?.disconnect(); }catch{}
  try{ stream?.getTracks().forEach(t=>t.stop()); }catch{}
  try{ ws?.close(); }catch{}
  try{ ctx?.close(); }catch{}
  els.meter.style.width='0%';
}

// ===== Auto-detect (simple EN/NL/AR) =====
els.autodetect.onclick = async () => {
  // Quick 2-second browser SR to detect script/words, then switch dropdown
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ alert('Auto-detect needs the browser speech engine. Use Chrome.'); return; }
  const rec = new SR(); rec.lang='en-US'; rec.interimResults=true; rec.continuous=false;
  let text=''; setStatus('listening for auto-detect…');
  rec.onresult=(ev)=>{ for(let i=ev.resultIndex;i<ev.results.length;i++){ text += ev.results[i][0].transcript + ' '; } };
  rec.onend=()=> {
    // Arabic script?
    if (/[ء-ي]/.test(text)) { setLang('ar-SY'); setStatus('Detected: Arabic'); return; }
    // Dutch keywords
    const t = text.toLowerCase();
    const nlHits = ['de','het','een','ik','jij','je','niet','en','is','met','gaat','hoe','bedankt','alsjeblieft','goed'].filter(w=>t.includes(` ${w} `)).length;
    setLang(nlHits>=2 ? 'nl-NL' : 'en-US');
    setStatus('Detected: ' + (nlHits>=2 ? 'Dutch' : 'English'));
  };
  rec.start(); setTimeout(()=>rec.stop(), 2000);
};
function setLang(code){
  const opt = [...els.lang.options].find(o=>o.value===code);
  if (opt) els.lang.value = code;
}

// ===== Buttons =====
els.start.onclick = () => {
  els.finals.innerHTML=''; els.partial.textContent=''; transcript=[];
  els.dl.disabled = els.save.disabled = true;
  if (els.pro.checked) startDeepgram(); else startBrowser();
};
els.stop.onclick = () => {
  if (els.pro.checked) stopDeepgram(); else stopBrowser();
  els.start.disabled=false; els.stop.disabled=true;
};
els.historyBtn.onclick = () => document.getElementById('history').open = true;
