// Browser Speech Recognition (Chrome: webkitSpeechRecognition)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const dlBtn = document.getElementById('download');
const statusEl = document.getElementById('status');
const langSel = document.getElementById('lang');
const partialEl = document.getElementById('partial');
const finalsEl = document.getElementById('finals');

let rec = null;
let running = false;
let transcript = []; // {t: 'text', at: Date}

function supportsSR(){ return !!SR; }
function stamp(){ return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
function setStatus(txt){ statusEl.textContent = txt; }

function addFinal(text){
  transcript.push({ t: text, at: new Date() });
  const wrap = document.createElement('div');
  wrap.className = 'segment';
  const tm = document.createElement('div');
  tm.className = 'time';
  tm.textContent = stamp();
  const p = document.createElement('div');
  p.textContent = text;
  wrap.appendChild(tm); wrap.appendChild(p);
  finalsEl.appendChild(wrap);
  dlBtn.disabled = transcript.length === 0;
}

function downloadTXT(){
  const content = transcript.map(x => `[${x.at.toISOString()}] ${x.t}`).join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${Date.now()}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function start(){
  if (!supportsSR()){
    alert('Your browser does not support Speech Recognition. Please use Chrome on desktop or Android.');
    return;
  }
  finalsEl.innerHTML = '';
  partialEl.textContent = '';
  transcript = [];

  rec = new SR();
  rec.lang = langSel.value;       // 'nl-NL' or 'en-US'
  rec.interimResults = true;
  rec.continuous = true;

  rec.onstart = () => { running = true; setStatus('listening…'); startBtn.disabled = true; stopBtn.disabled = false; };
  rec.onerror = (e) => { setStatus('error: ' + (e.error || 'unknown')); };
  rec.onend = () => { running = false; setStatus('stopped'); startBtn.disabled = false; stopBtn.disabled = true; };

  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++){
      const res = ev.results[i];
      if (res.isFinal) addFinal(res[0].transcript.trim());
      else interim += res[0].transcript;
    }
    partialEl.textContent = interim.trim();
  };

  rec.start();
}

function stop(){ if (rec && running){ rec.stop(); } }

startBtn.onclick = start;
stopBtn.onclick = stop;
dlBtn.onclick = downloadTXT;
setStatus('idle');
