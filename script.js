// ===== Config =====
const GATEWAY_WSS = 'wss://transcriber-gateway.onrender.com/v1/stream'; // ✅ Replace with your exact URL if needed

// A broad language list (add more anytime)
const LANGS = [
  'nl-NL','nl-BE','en-US','en-GB','en-AU','en-CA','en-IN','en-IE','en-NZ','en-ZA',
  'ar-SA','ar-AE','ar-LB','ar-SY','ar-EG','ar-MA','ar-TN','ar-IQ','ar-JO','ar-BH','ar-QA',
  'fr-FR','de-DE','es-ES','it-IT','pt-PT','pt-BR','pl-PL','sv-SE','da-DK','nb-NO','fi-FI',
  'tr-TR','fa-IR','ru-RU','uk-UA','ja-JP','ko-KR','zh-CN','zh-TW','hi-IN','bn-BD'
];

// ===== UI refs =====
const startBtn = document.getElementById('start');
const stopBtn  = document.getElementById('stop');
const dlBtn    = document.getElementById('download');
const statusEl = document.getElementById('status');
const langSel  = document.getElementById('lang');
const proChk   = document.getElementById('pro');
const partialEl= document.getElementById('partial');
const finalsEl = document.getElementById('finals');

// Fill dropdown
LANGS.forEach(code=>{
  const opt = document.createElement('option');
  opt.value = code; opt.textContent = code;
  if (code==='nl-NL') opt.selected = true;
  langSel.appendChild(opt);
});

let transcript = [];
function setStatus(s){ statusEl.textContent = s; }
function stamp(){ return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
function addFinal(t){
  transcript.push({t, at:new Date()});
  const wrap=document.createElement('div'); wrap.className='segment';
  const tm=document.createElement('div'); tm.className='time'; tm.textContent=stamp();
  const p=document.createElement('div'); p.textContent=t;
  wrap.appendChild(tm); wrap.appendChild(p); finalsEl.appendChild(wrap);
  dlBtn.disabled = transcript.length===0;
}
function downloadTXT(){
  const content = transcript.map(x=>`[${x.at.toISOString()}] ${x.t}`).join('\n');
  const blob = new Blob([content], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`transcript-${Date.now()}.txt`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
dlBtn.onclick = downloadTXT;

// ===== Mode A: Browser SR =====
let rec=null, running=false;
function startBrowser(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert('Use Chrome, or enable Pro mode.'); return; }
  rec = new SR();
  rec.lang = langSel.value; rec.interimResults=true; rec.continuous=true;
  rec.onstart=()=>{ running=true; setStatus('listening…'); startBtn.disabled=true; stopBtn.disabled=false; };
  rec.onerror=e=>setStatus('error:'+ (e.error||'unknown'));
  rec.onend =()=>{ running=false; setStatus('stopped'); startBtn.disabled=false; stopBtn.disabled=true; };
  rec.onresult=(ev)=>{ let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){const r=ev.results[i]; if(r.isFinal) addFinal(r[0].transcript.trim()); else interim+=r[0].transcript;} partialEl.textContent=interim.trim(); };
  rec.start();
}
function stopBrowser(){ if(rec && running) rec.stop(); }

// ===== Mode B: Deepgram =====
let ctx, proc, stream, ws;
function floatTo16(f32){
  const b=new ArrayBuffer(f32.length*2), v=new DataView(b); let o=0;
  for(let i=0;i<f32.length;i++,o+=2){ let s=Math.max(-1,Math.min(1,f32[i])); v.setInt16(o, s<0?s*0x8000:s*0x7fff, true); }
  return b;
}
async function startDeepgram(){
  try{ stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, channelCount:1 }});}
  catch{ alert('Mic blocked'); return;}

  ctx = new AudioContext({ sampleRate: 16000 });
  const src = ctx.createMediaStreamSource(stream);
  proc = ctx.createScriptProcessor(4096,1,1);

  ws = new WebSocket(`${GATEWAY_WSS}?lang=${encodeURIComponent(langSel.value)}`);
  ws.onopen = () => { setStatus('connected'); startBtn.disabled=true; stopBtn.disabled=false; };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type==='partial') partialEl.textContent = msg.text;
    if (msg.type==='final'){ partialEl.textContent=''; addFinal(msg.text); }
  };
  ws.onclose = () => setStatus('stopped');

  src.connect(proc);
  proc.onaudioprocess = (ev) => {
    const f32 = ev.inputBuffer.getChannelData(0);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(floatTo16(f32));
  };
  proc.connect(ctx.destination);
}
function stopDeepgram(){
  try{ proc?.disconnect(); }catch{}
  try{ stream?.getTracks().forEach(t=>t.stop()); }catch{}
  try{ ws?.close(); }catch{}
  try{ ctx?.close(); }catch{}
}

// ===== Buttons =====
startBtn.onclick = () => {
  finalsEl.innerHTML=''; partialEl.textContent=''; transcript=[];
  if(proChk.checked) startDeepgram(); else startBrowser();
};
stopBtn.onclick = () => {
  if(proChk.checked) stopDeepgram(); else stopBrowser();
  startBtn.disabled=false; stopBtn.disabled=true;
};
setStatus('idle');
