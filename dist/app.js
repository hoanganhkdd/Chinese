/* ============ Học Tiếng Trung HSK — app logic ============ */
const D = window.APPDATA;
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => (s||"").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- Persistent progress (localStorage) ---------- */
const STORE = "hsk_app_v1";
let progress = JSON.parse(localStorage.getItem(STORE) || "{}");
progress.learned = progress.learned || {};      // han -> true
progress.srs = progress.srs || {};              // han -> {ef, interval, due, reps}
progress.quizStats = progress.quizStats || {correct:0, total:0};
progress.listenStats = progress.listenStats || {correct:0, total:0};
progress.myWords = progress.myWords || [];      // THƯ VIỆN KEYWORD: [{han,pinyin,vi,source,date}]
progress.rooms = progress.rooms || [];          // [{name, date, words:[{han,pinyin,vi}]}]
progress.settings = progress.settings || {openaiKey:"", viVoiceName:"", model:"gpt-4o-mini"};
progress.daily = progress.daily || {date:"", reviews:0, listens:0, newLearned:0};
progress.streak = progress.streak || {count:0, best:0, lastDate:""};
progress.goal = progress.goal || {reviews:20, newWords:10};
progress.playCount = progress.playCount || {};   // han -> số lần nghe/phát
progress.studyCount = progress.studyCount || {}; // han -> số lần học (ôn/kiểm tra/viết)
progress.history = progress.history || {};       // "YYYY-MM-DD" -> {reviews,listens,newLearned,sent}
progress.sentSrs = progress.sentSrs || {};       // câu(han) -> {ef,interval,due,reps,lapses}
progress.dailyList = progress.dailyList || {date:"", words:[], sents:[]};
progress.links = progress.links || [];           // [{title,url,type,note,tag,date}] tài liệu/link nhanh
progress.examBest = progress.examBest || 0;      // % cao nhất bài thi thử
progress.saved = progress.saved || {};           // han -> {han,pinyin,vi,mnemonic,date} từ đã lưu (mọi từ)
if(!progress.settings) progress.settings = {};
if(progress.settings.reminderOn==null) progress.settings.reminderOn=false;
if(!progress.settings.reminderTime) progress.settings.reminderTime="08:00";
progress.settings.reminderLast = progress.settings.reminderLast||"";
function save(){ localStorage.setItem(STORE, JSON.stringify(progress)); }
let _saveT; function saveSoon(){ clearTimeout(_saveT); _saveT=setTimeout(save,800); }
function bumpPlay(han){ if(!han)return; progress.playCount[han]=(progress.playCount[han]||0)+1; saveSoon(); }
function bumpStudy(han){ if(!han)return; progress.studyCount[han]=(progress.studyCount[han]||0)+1; save(); }
const pc = han => progress.playCount[han]||0;
const sc = han => progress.studyCount[han]||0;

/* ---------- Daily activity + streak ---------- */
function todayStr(){ return new Date().toISOString().slice(0,10); }
function ensureToday(){ if(progress.daily.date!==todayStr()) progress.daily={date:todayStr(),reviews:0,listens:0,newLearned:0}; }
function bumpDaily(kind){
  ensureToday();
  if(kind==="review") progress.daily.reviews++;
  else if(kind==="listen") progress.daily.listens++;
  else if(kind==="new") progress.daily.newLearned++;
  const t=todayStr();
  const h=progress.history[t]||(progress.history[t]={reviews:0,listens:0,newLearned:0,sent:0});
  if(kind==="review") h.reviews++;
  else if(kind==="listen") h.listens++;
  else if(kind==="new") h.newLearned++;
  else if(kind==="sent") h.sent++;
  const st=progress.streak;
  if(st.lastDate!==t){
    const y=new Date(Date.now()-86400000).toISOString().slice(0,10);
    st.count = (st.lastDate===y)? (st.count||0)+1 : 1;
    st.lastDate=t; st.best=Math.max(st.best||0, st.count);
  }
  save();
}

/* ---------- Nhắc ôn tập theo giờ ---------- */
function notify(title, body){
  if('Notification' in window && Notification.permission==='granted'){
    try{ new Notification(title,{body, icon:'icon-192.png'}); return; }catch(e){}
  }
  toast(title+" — "+body);
}
function checkReminder(){
  const s=progress.settings; if(!s.reminderOn) return;
  const today=todayStr();
  if(s.reminderLast===today) return;
  const hhmm=new Date().toTimeString().slice(0,5);
  if(hhmm>=s.reminderTime){
    s.reminderLast=today; save();
    const due=srsCounts().due + sentCounts().due;
    notify("⏰ Đến giờ ôn tiếng Trung", due>0?`Bạn có ${due} thẻ/câu cần ôn hôm nay.`:"Học vài từ mới hôm nay nhé!");
  }
}

/* ---------- Danh sách cố định hôm nay (100 từ + 100 câu) ---------- */
function ensureDailyList(){
  const t=todayStr();
  if(progress.dailyList.date===t && progress.dailyList.words.length) return progress.dailyList;
  const vocab=allVocab().slice();
  // ưu tiên chưa thuộc + ít học
  vocab.sort((a,b)=>{ const la=progress.learned[a.han]?1:0, lb=progress.learned[b.han]?1:0;
    if(la!==lb) return la-lb; return (progress.studyCount[a.han]||0)-(progress.studyCount[b.han]||0); });
  const words=vocab.slice(0,100).map(v=>v.han);
  const idx=shuffle(D.sentences.map((_,i)=>i)).slice(0,100);
  progress.dailyList={date:t, words, sents:idx};
  save();
  return progress.dailyList;
}

/* ---------- Unified vocab pool (built-in + user-added) ---------- */
function allVocab(){
  const seen = new Set(D.vocab.map(v=>v.han));
  const extra = progress.myWords.filter(w=>!seen.has(w.han));
  return D.vocab.concat(extra);
}
function findWord(han){
  return D.vocab.find(v=>v.han===han) || progress.myWords.find(w=>w.han===han) || null;
}
function inLibrary(han){ return D.vocab.some(v=>v.han===han) || progress.myWords.some(m=>m.han===han); }
function addMyWord(w){
  if(inLibrary(w.han)) return false;
  if(!w.date) w.date=new Date().toISOString().slice(0,10);
  progress.myWords.push(w); srsInit(w.han); save(); return true;
}

/* ---------- Lưu từ (bookmark mọi từ) + Lưu cách nhớ ---------- */
function isSaved(han){ return !!progress.saved[han]; }
function ensureSaved(han, data={}){
  if(!progress.saved[han]) progress.saved[han]={han, pinyin:data.pinyin||"", vi:data.vi||"", mnemonic:"", date:new Date().toISOString().slice(0,10)};
  else { if(data.pinyin&&!progress.saved[han].pinyin) progress.saved[han].pinyin=data.pinyin; if(data.vi&&!progress.saved[han].vi) progress.saved[han].vi=data.vi; }
  return progress.saved[han];
}
function toggleSaved(han, data={}){
  if(progress.saved[han]){ delete progress.saved[han]; save(); return false; }
  ensureSaved(han, data); save(); return true;
}
function saveMnemonic(han, text, data={}){ ensureSaved(han, data).mnemonic=text; save(); }
function getMnemonic(han){ return (progress.saved[han]||{}).mnemonic || (progress.myWords.find(x=>x.han===han)||{}).mnemonic || ""; }
window.toggleSaved=toggleSaved;

/* ---------- Âm bồi (phiên âm tiếng Việt gần đúng) ---------- */
// Chinese tone -> Vietnamese diacritic: 1 ngang, 2 sắc, 3 hỏi, 4 huyền
const VTONE = {
  a:["a","á","ả","à"], "ă":["ă","ắ","ẳ","ằ"], "â":["â","ấ","ẩ","ầ"],
  e:["e","é","ẻ","è"], "ê":["ê","ế","ể","ề"], i:["i","í","ỉ","ì"],
  o:["o","ó","ỏ","ò"], "ô":["ô","ố","ổ","ồ"], "ơ":["ơ","ớ","ở","ờ"],
  u:["u","ú","ủ","ù"], "ư":["ư","ứ","ử","ừ"], y:["y","ý","ỷ","ỳ"]
};
function pyStrip(py){ // -> base key matching D.amboi
  let s=(py||"").toLowerCase().replace(/[ǖǘǚǜü]/g,"v");
  return s.normalize("NFD").replace(/[̀-ͯ]/g,"");
}
function pyTone(py){
  const s=(py||"").normalize("NFD");
  if(s.includes("̄")) return 1;
  if(s.includes("́")) return 2;
  if(s.includes("̌")) return 3;
  if(s.includes("̀")) return 4;
  return 0;
}
function applyVTone(base, tone){
  if(!tone) return base;
  const t=tone-1; // index in VTONE (0 base... but tone1 -> index0=plain)
  // choose main vowel: priority marked vowels first
  const pri=["ê","ơ","ô","â","ă","ư"];
  let idx=-1, vowel=null;
  for(const v of pri){ const p=base.indexOf(v); if(p>=0){ idx=p; vowel=v; break; } }
  if(idx<0){
    const vowels=[...base].map((c,i)=>({c,i})).filter(o=>"aeiouy".includes(o.c));
    if(!vowels.length) return base;
    // diphthong starting with o/u glide -> tone on 2nd vowel
    if(vowels.length>=2 && (base[0]==="o"||base[0]==="u")) { idx=vowels[1].i; vowel=vowels[1].c; }
    else { idx=vowels[0].i; vowel=vowels[0].c; }
  }
  const table=VTONE[vowel]; if(!table) return base;
  return base.slice(0,idx)+table[t]+base.slice(idx+1);
}
// override cho vài âm tiết đọc tự nhiên hơn theo âm tiếng Việt
const AMBOI_OVERRIDE = {
  de:"tơ", le:"lơ", ne:"nơ", me:"mơ", he:"hơ", ge:"cơ", ke:"khơ", te:"thơ",
  ne0:"nơ", ma:"ma", ba:"pa", la:"la", er:"ơ", zhe:"trơ", che:"trơ", she:"sơ", re:"rơ", ze:"chơ", ce:"chơ", se:"xơ"
};
function amBoiSyllable(pinyinSyl){
  const key=pyStrip(pinyinSyl);
  const base=AMBOI_OVERRIDE[key] || D.amboi[key];
  if(!base) return "";
  return applyVTone(base, pyTone(pinyinSyl));
}
function amBoiForHan(han){ // build from per-char pinyin
  const out=[];
  for(const ch of han){
    const py=D.charPinyin[ch];
    if(py){ const ab=amBoiSyllable(py); out.push(ab||ch); }
  }
  return out.join(" ");
}

/* ---------- Chiết tự (character breakdown) ---------- */
function charInfo(ch){ return D.chars[ch] || null; }  // {hv, g}
// Bộ thủ mà 1 chữ thuộc về (nhận diện qua danh sách ví dụ + chứa glyph)
function charRadicals(ch){
  if(typeof RADICALS==="undefined") return [];
  return Object.keys(RADICALS).filter(r=> r!==ch && (ch.includes(r) || (RADICALS[r].ex||"").split(/\s+/).includes(ch)))
    .map(r=>({r, hv:RADICALS[r].hv, m:RADICALS[r].m}));
}
// Build per-character breakdown for any word (kể cả từ mới ngoài kho)
function charBreakdownHTML(han){
  const rows=[...han].filter(ch=>D.charPinyin[ch]).map(ch=>{
    const info=charInfo(ch), py=D.charPinyin[ch], rads=charRadicals(ch);
    const radLine = rads.length
      ? `<div class="sub" style="margin-top:3px">🌿 Bộ thủ: ${rads.map(x=>`<b>${esc(x.r)}</b> ${esc(x.hv)} <span style="opacity:.8">(${esc(x.m)})</span>`).join(" · ")}</div>`
      : "";
    return `<div style="display:flex;gap:12px;align-items:baseline;padding:8px 0;border-bottom:1px dashed var(--line)">
      <div class="han-cell" style="font-size:30px;min-width:42px">${esc(ch)}</div>
      <div style="flex:1">
        <div><span class="pin-cell">${esc(py)}</span> · <span style="color:var(--warn)">🗣️ ${esc(amBoiSyllable(py))}</span>
          ${info?`· <b>${esc(info.hv)}</b> (Hán-Việt)`:''}
          <button class="mini" style="margin-left:6px" onclick="speak('${esc(ch)}')">🔊</button></div>
        <div class="sub" style="margin:2px 0 0">${info?esc(info.g):'<i>Nghĩa gốc: (chưa có sẵn — dùng 💡 Cách nhớ để phân tích chi tiết)</i>'}</div>
        ${radLine}
      </div></div>`;
  }).join("");
  return rows;
}

/* ---------- Audio (Web Speech) + Youglish ---------- */
let zhVoice = null, viVoice = null, allVoices = [];
function pickVoice(){
  allVoices = speechSynthesis.getVoices();
  zhVoice = allVoices.find(v=>/zh[-_]?CN/i.test(v.lang)) || allVoices.find(v=>/zh/i.test(v.lang)) || null;
  const pref = progress.settings.viVoiceName;
  viVoice = (pref && allVoices.find(v=>v.name===pref)) ||
            allVoices.find(v=>/vi[-_]?VN/i.test(v.lang)) || allVoices.find(v=>/^vi/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text){
  if(!('speechSynthesis' in window)) { toast("Trình duyệt không hỗ trợ đọc tiếng Trung"); return; }
  speechSynthesis.cancel();
  bumpPlay(text);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN"; if(zhVoice) u.voice = zhVoice; u.rate = 0.85;
  speechSynthesis.speak(u);
}
// đọc âm bồi bằng giọng tiếng Việt (phát âm theo âm tiếng Việt)
function speakAmboi(han){
  if(!('speechSynthesis' in window)) return;
  const text = amBoiForHan(han);
  if(!text){ speak(han); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "vi-VN"; if(viVoice) u.voice = viVoice; u.rate = 0.8;
  if(!viVoice) toast("Chưa có giọng tiếng Việt — vào ⚙️ Cài đặt để chọn/tải giọng");
  speechSynthesis.speak(u);
}
window.speakAmboi = speakAmboi;
const youglish = h => `https://youglish.com/pronounce/${encodeURIComponent(h)}/chinese`;

/* ---------- Dịch tự động: Google (không chính thức) → MyMemory ---------- */
async function gTranslate(text, sl="zh-CN", tl="vi"){
  const url=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const res=await fetch(url); if(!res.ok) throw new Error("gt"+res.status);
  const j=await res.json(); return (j[0]||[]).map(s=>s[0]).join("").trim();
}
async function myMemory(text, tl="vi"){
  const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|${tl}`;
  const res=await fetch(url); const j=await res.json(); return (j.responseData&&j.responseData.translatedText||"").trim();
}
async function translateVi(text){
  try{ const r=await gTranslate(text); if(r) return r; }catch(e){}
  try{ return await myMemory(text); }catch(e){ return ""; }
}

/* ---------- OpenAI (ChatGPT) story generation ---------- */
async function openaiChat(messages, opts={}){
  const key=(progress.settings.openaiKey||"").trim();
  if(!key) throw new Error("no-key");
  const res=await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify({model:progress.settings.model||"gpt-4o-mini", messages, temperature:opts.temperature??0.8, max_tokens:opts.max_tokens??900})
  });
  if(!res.ok){ const t=await res.text(); throw new Error("API "+res.status+": "+t.slice(0,200)); }
  const j=await res.json();
  return j.choices?.[0]?.message?.content || "";
}
async function aiStory(words){
  const prompt=`Bạn là giáo viên tiếng Trung cho người Việt. Viết một câu chuyện ngắn (6-10 câu) bằng tiếng Trung trình độ HSK1-3, sử dụng tự nhiên các từ: ${words}.
Trả về đúng định dạng cho MỖI câu, mỗi câu 3 dòng liên tiếp:
汉字: <câu chữ Hán>
拼音: <pinyin>
Việt: <dịch tiếng Việt>
Không thêm giải thích nào khác.`;
  return openaiChat([{role:"user",content:prompt}], {max_tokens:1100});
}
async function aiMnemonic(han, pinyin, vi, sentence){
  const ctx = sentence ? `\nTừ này xuất hiện trong câu: "${sentence}". Hãy giải thích thêm vai trò/ý nghĩa của từ TRONG CÂU đó.` : "";
  const prompt=`Bạn là chuyên gia dạy tiếng Trung cho người Việt bằng phương pháp CHIẾT TỰ + LIÊN TƯỞNG.
Từ cần nhớ: ${han}${pinyin?` (pinyin: ${pinyin})`:""}${vi?` — nghĩa: ${vi}`:""}.${ctx}
Hãy viết hướng dẫn ghi nhớ bằng tiếng Việt, ngắn gọn, có emoji, theo đúng các mục sau (giữ nguyên tiêu đề):
🧩 CHIẾT TỰ: tách từng chữ Hán thành bộ thủ/thành phần, mỗi thành phần ghi nghĩa gốc + âm Hán-Việt.
💡 MẸO LIÊN TƯỞNG: một hình ảnh hoặc câu chuyện ngắn, sinh động, nối các thành phần với nghĩa của từ để dễ nhớ.
🔊 CÁCH ĐỌC: pinyin + gợi ý âm bồi (phiên âm tiếng Việt gần đúng).
📝 VÍ DỤ: 1-2 câu (Hán tự + pinyin + dịch Việt) và cách dùng.${sentence?"\n🔎 TRONG CÂU: vai trò/ý nghĩa của từ trong câu đã cho.":""}`;
  return openaiChat([{role:"user",content:prompt}], {max_tokens:900, temperature:0.7});
}
// Modal "Cách nhớ từ" — chiết tự offline + mẹo ghi nhớ AI
function openMemoryGuide(han, opts={}){
  const w=findWord(han)||{}; const pinyin=opts.pinyin||w.pinyin||toPinyin(han); const vi=opts.vi||w.vi||""; const sentence=opts.sentence||"";
  $("#modalCard").innerHTML=`
    <button class="close-x" onclick="closeModal()">×</button>
    <div class="detail-han">${esc(han)}</div>
    <div class="detail-pin">${esc(pinyin)}</div>
    <div style="color:var(--warn);font-size:16px">🗣️ ${esc(amBoiForHan(han))}</div>
    ${vi?`<div class="detail-vi">${esc(vi)}</div>`:""}
    ${sentence?`<div class="sub" style="margin-top:4px">🔎 Trong câu: <span class="han-cell" style="font-size:15px">${esc(sentence)}</span></div>`:""}
    <div class="toolbar" style="margin-top:12px">
      <button class="btn sm primary" onclick="speak('${esc(han)}')">🔊 Nghe</button>
      <button class="btn sm" onclick="speakAmboi('${esc(han)}')">🇻🇳 Âm bồi</button>
      <button class="btn sm" id="mgSave" style="border-color:var(--warn)">${isSaved(han)?'⭐ Đã lưu từ':'☆ Lưu từ'}</button>
      <button class="btn sm" onclick="openYouglish('${esc(han)}')">🌐 Youglish</button>
    </div>
    <div class="detail-row"><div class="lab">🧩 Chiết tự từng chữ (offline)</div>${charBreakdownHTML(han)}</div>
    <div class="detail-row">
      <div class="lab">💡 Cách nhớ chi tiết (AI)</div>
      <div id="mnBox"></div>
    </div>`;
  $("#modal").classList.remove("hidden");
  $("#mgSave").onclick=()=>{ const on=toggleSaved(han,{pinyin,vi}); $("#mgSave").textContent=on?'⭐ Đã lưu từ':'☆ Lưu từ'; toast(on?'Đã lưu từ':'Đã bỏ lưu'); };
  const renderGen=(label)=>`<button class="btn primary" id="mnGen">${label||('✨ Tạo hướng dẫn ghi nhớ'+(sentence?" (theo câu)":""))}</button>
    <p class="sub" style="margin-top:6px">Chiết tự sâu + mẹo liên tưởng dễ nhớ. Cần OpenAI API key (⚙️ Cài đặt).</p>`;
  const bindGen=()=>{ $("#mnGen").onclick=async()=>{
    if(!(progress.settings.openaiKey||"").trim()){ toast("Cần OpenAI API key ở ⚙️ Cài đặt"); go("settings"); closeModal(); return; }
    $("#mnBox").innerHTML=`<p class="sub">✨ Đang phân tích cách nhớ…</p>`;
    try{ const text=await aiMnemonic(han, pinyin, vi, sentence); showMn(text); }
    catch(e){ $("#mnBox").innerHTML=`<p class="sub" style="color:var(--brand)">Lỗi: ${esc(e.message)}</p>`+renderGen("↻ Thử lại"); bindGen(); }
  }; };
  const showMn=(text)=>{
    $("#mnBox").innerHTML=`<div class="mnemonic">${mnFormat(text)}</div>
      <div class="toolbar" style="margin-top:8px"><button class="btn sm primary" id="mnSave">💾 Lưu cách nhớ</button><button class="btn sm" id="mnRe">🔄 Tạo lại</button></div>`;
    $("#mnSave").onclick=()=>{ saveMnemonic(han, text, {pinyin,vi}); toast("💾 Đã lưu cách nhớ (⭐ từ cũng được lưu)"); if($("#mgSave")) $("#mgSave").textContent='⭐ Đã lưu từ'; };
    $("#mnRe").onclick=()=>{ $("#mnBox").innerHTML=renderGen("✨ Tạo lại hướng dẫn"); bindGen(); };
  };
  const existing=getMnemonic(han);
  if(existing) showMn(existing); else { $("#mnBox").innerHTML=renderGen(); bindGen(); }
}
function mnFormat(text){
  // làm nổi các tiêu đề mục + xuống dòng
  return esc(text).replace(/\n/g,"<br>")
    .replace(/(🧩[^<]*|💡[^<]*|🔊[^<]*|📝[^<]*|🔎[^<]*)/g, m=>`<b>${m}</b>`);
}
window.openMemoryGuide=openMemoryGuide;

/* ---------- Youglish embedded widget ---------- */
let ygLoaded=false, ygLoading=false, ygWidget=null;
function loadYouglishScript(cb){
  if(ygLoaded){ cb(true); return; }
  if(ygLoading){ setTimeout(()=>loadYouglishScript(cb),300); return; }
  ygLoading=true;
  const s=document.createElement("script");
  s.src="https://youglish.com/public/emb/widget.js"; s.async=true; s.charset="utf-8";
  s.onload=()=>{ ygLoaded=true; ygLoading=false; cb(true); };
  s.onerror=()=>{ ygLoading=false; cb(false); };
  document.head.appendChild(s);
  setTimeout(()=>{ if(!ygLoaded) cb(false); },4000);
}
function openYouglish(query){
  $("#modalCard").innerHTML = `
    <button class="close-x" onclick="closeModal()">×</button>
    <h3 style="margin:0 0 4px">🌐 Youglish · phát âm thật trong video</h3>
    <div class="sub" style="margin-bottom:12px">Nghe người bản xứ phát âm <b class="han-cell" style="font-size:20px">${esc(query)}</b> trong ngữ cảnh thật.</div>
    <div id="ygBox" style="min-height:360px;display:grid;place-items:center">
      <div class="sub">Đang tải Youglish… (cần kết nối mạng)</div>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn" onclick="speak('${esc(query)}')">🔊 Đọc máy</button>
      <a class="btn primary" href="${youglish(query)}" target="_blank" rel="noopener">Mở Youglish.com ↗</a>
    </div>`;
  $("#modal").classList.remove("hidden");
  loadYouglishScript(ok=>{
    const box=$("#ygBox"); if(!box) return;
    if(!ok || typeof YG==="undefined"){
      box.innerHTML=`<div class="sub" style="text-align:center">Không tải được widget (offline?).<br>Dùng nút <b>Mở Youglish.com</b> bên dưới.</div>`;
      return;
    }
    box.innerHTML=`<div id="ygWidgetEl" style="width:100%"></div>`;
    try{
      ygWidget = new YG.Widget("ygWidgetEl", { width: 560, components: 9, autoStart:1 });
      ygWidget.fetch(query, "chinese");
    }catch(e){
      box.innerHTML=`<div class="sub">Không khởi tạo được widget. Dùng nút Mở Youglish.com.</div>`;
    }
  });
}

/* ---------- SRS engine (SM-2 lite for memory) ---------- */
const DAY_MS = 86400000;
const today0 = () => { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); };
function srsInit(han){
  if(!progress.srs[han]) progress.srs[han]={ef:2.5,interval:0,due:today0(),reps:0,lapses:0};
  else if(progress.srs[han].lapses==null) progress.srs[han].lapses=0;
}
// classify a card: new | hard | learning | easy | mature(thuộc)
function srsCategory(han){
  const s=progress.srs[han];
  if(!s) return "new";
  if(s.interval>=21) return "mature";
  if((s.lapses||0)>=2 || s.ef<2.0) return "hard";
  if(s.ef>=2.6 && s.reps>=2) return "easy";
  return "learning";
}
function srsCatCounts(){
  const c={new:0,hard:0,learning:0,easy:0,mature:0};
  allVocab().forEach(v=>{ c[srsCategory(v.han)]++; });
  return c;
}
function srsDueList(){
  const now=today0();
  return allVocab().filter(v=>{ const s=progress.srs[v.han]; return s && s.due<=now; });
}
function srsNewList(limit){
  return allVocab().filter(v=>!progress.srs[v.han]).slice(0,limit);
}
// grade: 0 Again, 3 Hard, 4 Good, 5 Easy
function srsReview(han, grade){
  srsInit(han);
  const s=progress.srs[han];
  if(grade<3){ s.reps=0; s.interval=0; s.due=today0(); s.lapses=(s.lapses||0)+1; }  // relearn today
  else{
    s.reps++;
    if(s.reps===1) s.interval=1;
    else if(s.reps===2) s.interval=3;
    else s.interval=Math.round(s.interval*s.ef);
    s.ef=Math.max(1.3, s.ef + (0.1 - (5-grade)*(0.08+(5-grade)*0.02)));
    s.due=today0()+s.interval*DAY_MS;
    if(grade>=4) progress.learned[han]=true;
  }
  save();
  bumpDaily("review"); bumpStudy(han);
}
function srsCounts(){
  const now=today0(); let due=0, learning=0, mature=0, newc=0;
  allVocab().forEach(v=>{ const s=progress.srs[v.han];
    if(!s) newc++; else if(s.due<=now) due++; else if(s.interval>=21) mature++; else learning++; });
  return {due,learning,mature,newc};
}

/* ---------- SRS engine cho CÂU (sentSrs) ---------- */
// pool câu: câu nguồn + câu ví dụ của từ trong thư viện
function sentencePool(){
  const arr = D.sentences.map(s=>({han:s.han, meaning:s.meaning, src:s.source||"Câu nguồn"}));
  D.vocab.forEach(v=>{ if(v.example) arr.push({han:v.example, meaning:(v.examplePinyin||"").replace(/\n/g," "), src:"Ví dụ HSK"}); });
  progress.myWords.forEach(w=>{ if(w.example) arr.push({han:w.example, meaning:w.vi||"", src:"Ví dụ của tôi"}); });
  return arr;
}
function sentInit(k){ if(!progress.sentSrs[k]) progress.sentSrs[k]={ef:2.5,interval:0,due:today0(),reps:0,lapses:0}; }
function sentReview(k, grade){
  sentInit(k); const s=progress.sentSrs[k];
  if(grade<3){ s.reps=0; s.interval=0; s.due=today0(); s.lapses=(s.lapses||0)+1; }
  else{ s.reps++; s.interval = s.reps===1?1 : s.reps===2?3 : Math.round(s.interval*s.ef);
    s.ef=Math.max(1.3, s.ef+(0.1-(5-grade)*(0.08+(5-grade)*0.02))); s.due=today0()+s.interval*DAY_MS; }
  save(); bumpDaily("sent");
}
function sentCounts(){
  const now=today0(), pool=sentencePool(); let due=0,newc=0,learning=0,mature=0;
  pool.forEach(x=>{ const s=progress.sentSrs[x.han];
    if(!s) newc++; else if(s.due<=now) due++; else if(s.interval>=21) mature++; else learning++; });
  return {due,newc,learning,mature,total:pool.length};
}

/* ---------- Bộ thủ (radicals) ---------- */
const RADICALS = {
  "一":{hv:"NHẤT",m:"một"},
  "丨":{hv:"CỔN",m:"nét sổ"},
  "丶":{hv:"CHỦ",m:"điểm, chấm"},
  "丿":{hv:"PHIỆT",m:"nét phẩy"},
  "乙":{hv:"ẤT",m:"can Ất; cong"},
  "亅":{hv:"QUYẾT",m:"nét móc"},
  "二":{hv:"NHỊ",m:"hai"},
  "亠":{hv:"ĐẦU",m:"nét đầu (trên)"},
  "人":{hv:"NHÂN",m:"người",ex:"人 从 众 今 会 全 介"},
  "亻":{hv:"NHÂN",m:"người",ex:"你 他 们 什 件 住 位 但 做 假"},
  "儿":{hv:"NHÂN",m:"người (chân)"},
  "入":{hv:"NHẬP",m:"vào"},
  "八":{hv:"BÁT",m:"tám; chia"},
  "冂":{hv:"QUYNH",m:"vùng biên"},
  "冖":{hv:"MỊCH",m:"trùm khăn"},
  "冫":{hv:"BĂNG",m:"băng, nước đá"},
  "几":{hv:"KỶ",m:"ghế nhỏ"},
  "凵":{hv:"KHẢM",m:"há miệng"},
  "刀":{hv:"ĐAO",m:"dao",ex:"分 切 召"},
  "刂":{hv:"ĐAO",m:"dao",ex:"到 前 别 刻 剧 利"},
  "力":{hv:"LỰC",m:"sức mạnh",ex:"办 加 动 助 努 男 劳"},
  "勹":{hv:"BAO",m:"bao bọc"},
  "匕":{hv:"CHỦY",m:"thìa, muỗng"},
  "匚":{hv:"PHƯƠNG",m:"hộp vuông"},
  "匸":{hv:"HỆ",m:"che đậy"},
  "十":{hv:"THẬP",m:"mười"},
  "卜":{hv:"BỐC",m:"bói toán"},
  "卩":{hv:"TIẾT",m:"dấu, đốt"},
  "厂":{hv:"HÁN",m:"sườn núi"},
  "厶":{hv:"KHƯ",m:"riêng tư"},
  "又":{hv:"HỰU",m:"lại; tay phải"},
  "口":{hv:"KHẨU",m:"miệng",ex:"吃 喝 叫 吗 名 听 唱 问 员 和"},
  "囗":{hv:"VI",m:"vây quanh"},
  "土":{hv:"THỔ",m:"đất",ex:"地 场 城 坐 块 圾 增"},
  "士":{hv:"SĨ",m:"kẻ sĩ"},
  "夂":{hv:"TRI",m:"đến sau"},
  "夊":{hv:"TUY",m:"đi chậm"},
  "夕":{hv:"TỊCH",m:"chiều tối"},
  "大":{hv:"ĐẠI",m:"to lớn",ex:"天 太 头 夹 奖"},
  "女":{hv:"NỮ",m:"phụ nữ",ex:"她 妈 好 姐 妹 婚 娘 要 安"},
  "子":{hv:"TỬ",m:"con"},
  "宀":{hv:"MIÊN",m:"mái nhà",ex:"家 客 完 宝 定 安 室 宿 容"},
  "寸":{hv:"THỐN",m:"tấc"},
  "小":{hv:"TIỂU",m:"nhỏ",ex:"少 尖 尘"},
  "尢":{hv:"UÔNG",m:"yếu, què"},
  "尸":{hv:"THI",m:"thây, xác"},
  "屮":{hv:"TRIỆT",m:"mầm cây"},
  "山":{hv:"SƠN",m:"núi",ex:"岁 岛 峰 岭"},
  "巛":{hv:"XUYÊN",m:"sông"},
  "川":{hv:"XUYÊN",m:"sông"},
  "工":{hv:"CÔNG",m:"công việc"},
  "己":{hv:"KỶ",m:"mình, bản thân"},
  "巾":{hv:"CÂN",m:"khăn"},
  "干":{hv:"CAN",m:"can; khiên"},
  "幺":{hv:"YÊU",m:"nhỏ bé"},
  "广":{hv:"NGHIỄM",m:"mái hiên",ex:"店 床 座 应 底 度"},
  "廴":{hv:"DẪN",m:"bước dài"},
  "廾":{hv:"CỦNG",m:"chắp tay"},
  "弋":{hv:"DỰC",m:"bắn; cọc"},
  "弓":{hv:"CUNG",m:"cây cung"},
  "彐":{hv:"KÝ",m:"đầu con nhím"},
  "彡":{hv:"SAM",m:"lông, tia"},
  "彳":{hv:"XÍCH",m:"bước ngắn",ex:"很 得 往 律 徐 街"},
  "心":{hv:"TÂM",m:"tim, lòng",ex:"想 念 感 意 思 息 忘 急"},
  "忄":{hv:"TÂM",m:"tim, lòng",ex:"忙 快 慢 怕 情 惯 懂"},
  "戈":{hv:"QUA",m:"giáo mác"},
  "戶":{hv:"HỘ",m:"cửa một cánh"},
  "户":{hv:"HỘ",m:"cửa một cánh"},
  "手":{hv:"THỦ",m:"tay",ex:"手 拿 掌 拳"},
  "扌":{hv:"THỦ",m:"tay",ex:"打 拿 找 提 把 推 拉 接 换 掉"},
  "支":{hv:"CHI",m:"cành, chi"},
  "攴":{hv:"PHỘC",m:"đánh khẽ"},
  "攵":{hv:"PHỘC",m:"đánh khẽ"},
  "文":{hv:"VĂN",m:"văn, chữ"},
  "斗":{hv:"ĐẨU",m:"cái đấu (đong)"},
  "斤":{hv:"CÂN",m:"cái rìu; cân"},
  "方":{hv:"PHƯƠNG",m:"vuông; phương"},
  "无":{hv:"VÔ",m:"không"},
  "日":{hv:"NHẬT",m:"mặt trời, ngày",ex:"明 时 昨 早 星 春 是 晚 暖"},
  "曰":{hv:"VIẾT",m:"nói rằng"},
  "月":{hv:"NGUYỆT",m:"trăng, tháng",ex:"服 期 朋 有 能 脸 胖 脚"},
  "木":{hv:"MỘC",m:"cây, gỗ",ex:"林 树 桌 椅 校 样 机 果 条"},
  "欠":{hv:"KHIẾM",m:"thiếu; ngáp"},
  "止":{hv:"CHỈ",m:"dừng"},
  "歹":{hv:"ĐÃI",m:"xấu; chết"},
  "殳":{hv:"THÙ",m:"binh khí"},
  "毋":{hv:"VÔ",m:"chớ, đừng"},
  "比":{hv:"TỶ",m:"so sánh"},
  "毛":{hv:"MAO",m:"lông"},
  "氏":{hv:"THỊ",m:"họ (tên họ)"},
  "气":{hv:"KHÍ",m:"hơi, khí"},
  "水":{hv:"THỦY",m:"nước"},
  "氵":{hv:"THỦY",m:"nước",ex:"河 海 湖 江 洗 汉 酒 没 游 清"},
  "火":{hv:"HỎA",m:"lửa",ex:"烧 烤 灯 炒 烟 灾"},
  "灬":{hv:"HỎA",m:"lửa",ex:"点 热 然 照 熊"},
  "爪":{hv:"TRẢO",m:"móng vuốt"},
  "爫":{hv:"TRẢO",m:"móng vuốt"},
  "父":{hv:"PHỤ",m:"cha"},
  "爻":{hv:"HÀO",m:"hào (quẻ)"},
  "爿":{hv:"TƯỜNG",m:"mảnh gỗ trái"},
  "片":{hv:"PHIẾN",m:"tấm, mảnh"},
  "牙":{hv:"NHA",m:"răng"},
  "牛":{hv:"NGƯU",m:"trâu bò"},
  "牜":{hv:"NGƯU",m:"trâu bò"},
  "犬":{hv:"KHUYỂN",m:"chó"},
  "犭":{hv:"KHUYỂN",m:"chó",ex:"猫 狗 猪 狮 独 猴"},
  "玄":{hv:"HUYỀN",m:"huyền bí; đen"},
  "玉":{hv:"NGỌC",m:"ngọc"},
  "王":{hv:"NGỌC",m:"ngọc",ex:"玩 现 球 环 理 珍"},
  "瓜":{hv:"QUA",m:"quả dưa"},
  "瓦":{hv:"NGÕA",m:"ngói"},
  "甘":{hv:"CAM",m:"ngọt"},
  "生":{hv:"SINH",m:"sinh, sống"},
  "用":{hv:"DỤNG",m:"dùng"},
  "田":{hv:"ĐIỀN",m:"ruộng",ex:"男 界 留 略 番"},
  "疋":{hv:"THẤT",m:"vải; chân"},
  "疒":{hv:"NẠCH",m:"bệnh",ex:"病 疼 痛 疯 瘦 疫"},
  "癶":{hv:"BÁT",m:"đôi chân gạt ngược"},
  "白":{hv:"BẠCH",m:"trắng"},
  "皮":{hv:"BÌ",m:"da"},
  "皿":{hv:"MÃNH",m:"bát đĩa"},
  "目":{hv:"MỤC",m:"mắt",ex:"看 眼 睡 睛 眠 瞌"},
  "矛":{hv:"MÂU",m:"cây giáo"},
  "矢":{hv:"THỈ",m:"mũi tên"},
  "石":{hv:"THẠCH",m:"đá",ex:"矿 码 硬 碰 确 碗"},
  "示":{hv:"THỊ",m:"thần; chỉ bảo"},
  "礻":{hv:"THỊ",m:"thần; chỉ bảo"},
  "禸":{hv:"NHỮU",m:"vết chân thú"},
  "禾":{hv:"HÒA",m:"lúa",ex:"和 秋 种 科 秒 税"},
  "穴":{hv:"HUYỆT",m:"hang"},
  "立":{hv:"LẬP",m:"đứng"},
  "竹":{hv:"TRÚC",m:"tre",ex:"笑 笔 笨 答 篮 简 筷"},
  "米":{hv:"MỄ",m:"gạo",ex:"料 粉 精 糖 粥"},
  "糸":{hv:"MỊCH",m:"sợi tơ"},
  "纟":{hv:"MỊCH",m:"sợi tơ",ex:"红 给 经 线 纸 结 组 练"},
  "缶":{hv:"PHẪU",m:"vò sành"},
  "网":{hv:"VÕNG",m:"lưới"},
  "罒":{hv:"VÕNG",m:"lưới"},
  "羊":{hv:"DƯƠNG",m:"dê cừu"},
  "羽":{hv:"VŨ",m:"lông vũ"},
  "老":{hv:"LÃO",m:"già"},
  "耂":{hv:"LÃO",m:"già"},
  "而":{hv:"NHI",m:"mà; râu"},
  "耒":{hv:"LỖI",m:"cái cày"},
  "耳":{hv:"NHĨ",m:"tai",ex:"听 取 聊 职 聪"},
  "聿":{hv:"DUẬT",m:"bút"},
  "肉":{hv:"NHỤC",m:"thịt"},
  "臣":{hv:"THẦN",m:"bề tôi"},
  "自":{hv:"TỰ",m:"tự; mũi"},
  "至":{hv:"CHÍ",m:"đến"},
  "臼":{hv:"CỰU",m:"cối giã"},
  "舌":{hv:"THIỆT",m:"lưỡi"},
  "舛":{hv:"SUYỄN",m:"ngang trái"},
  "舟":{hv:"CHU",m:"thuyền"},
  "艮":{hv:"CẤN",m:"dừng; quẻ Cấn"},
  "色":{hv:"SẮC",m:"màu sắc"},
  "艸":{hv:"THẢO",m:"cỏ, cây"},
  "艹":{hv:"THẢO",m:"cỏ, cây",ex:"花 草 茶 菜 药 苦 苹 落 蓝"},
  "虍":{hv:"HÔ",m:"vằn hổ"},
  "虫":{hv:"TRÙNG",m:"sâu bọ",ex:"蚊 蛇 蜂 虾 蝶"},
  "血":{hv:"HUYẾT",m:"máu"},
  "行":{hv:"HÀNH",m:"đi; hàng"},
  "衣":{hv:"Y",m:"áo",ex:"表 装 裂"},
  "衤":{hv:"Y",m:"áo",ex:"衬 补 被 裤 袜"},
  "襾":{hv:"Á",m:"che đậy"},
  "見":{hv:"KIẾN",m:"thấy"},
  "见":{hv:"KIẾN",m:"thấy"},
  "角":{hv:"GIÁC",m:"sừng; góc"},
  "言":{hv:"NGÔN",m:"lời nói",ex:"警 誉"},
  "讠":{hv:"NGÔN",m:"lời nói",ex:"说 话 语 请 谢 课 认 识 读 谁"},
  "谷":{hv:"CỐC",m:"thung lũng"},
  "豆":{hv:"ĐẬU",m:"đậu; bát đậu"},
  "豕":{hv:"THỈ",m:"con lợn"},
  "豸":{hv:"TRĨ",m:"thú không chân"},
  "貝":{hv:"BỐI",m:"vỏ sò; tiền của"},
  "贝":{hv:"BỐI",m:"vỏ sò; tiền của",ex:"贵 费 买 卖 财 货 赢 贷"},
  "赤":{hv:"XÍCH",m:"đỏ"},
  "走":{hv:"TẨU",m:"chạy",ex:"起 越 超 趣"},
  "足":{hv:"TÚC",m:"chân",ex:"跑 跳 路 踢 跟 距"},
  "身":{hv:"THÂN",m:"thân mình"},
  "車":{hv:"XA",m:"xe"},
  "车":{hv:"XA",m:"xe",ex:"轮 转 软 较 辆"},
  "辛":{hv:"TÂN",m:"cay; can Tân"},
  "辰":{hv:"THẦN",m:"chi Thìn; sớm"},
  "辵":{hv:"SƯỚC",m:"bước đi"},
  "辶":{hv:"SƯỚC",m:"bước đi",ex:"这 边 过 进 远 近 送 通 道 迎"},
  "邑":{hv:"ẤP",m:"làng (bên phải)"},
  "阝":{hv:"ẤP",m:"làng (bên phải)",ex:"院 阳 除 队 都 部 陪"},
  "酉":{hv:"DẬU",m:"rượu; chi Dậu"},
  "釆":{hv:"BIỆN",m:"phân biệt"},
  "里":{hv:"LÝ",m:"dặm; làng"},
  "金":{hv:"KIM",m:"kim loại, vàng",ex:"金 鑫"},
  "钅":{hv:"KIM",m:"kim loại, vàng",ex:"钱 银 铁 错 钟 镇 铅"},
  "長":{hv:"TRƯỜNG",m:"dài"},
  "长":{hv:"TRƯỜNG",m:"dài"},
  "門":{hv:"MÔN",m:"cửa"},
  "门":{hv:"MÔN",m:"cửa",ex:"们 问 间 闻 闹 闭"},
  "阜":{hv:"PHỤ",m:"gò đất (bên trái)"},
  "隶":{hv:"ĐÃI",m:"bắt kịp"},
  "隹":{hv:"CHUY",m:"chim đuôi ngắn"},
  "雨":{hv:"VŨ",m:"mưa",ex:"雪 需 雷 零 雾 震"},
  "青":{hv:"THANH",m:"xanh"},
  "非":{hv:"PHI",m:"không; trái"},
  "面":{hv:"DIỆN",m:"mặt"},
  "革":{hv:"CÁCH",m:"da thuộc"},
  "韋":{hv:"VI",m:"da mềm"},
  "韦":{hv:"VI",m:"da mềm"},
  "韭":{hv:"CỬU",m:"rau hẹ"},
  "音":{hv:"ÂM",m:"âm thanh"},
  "頁":{hv:"HIỆT",m:"trang; đầu"},
  "页":{hv:"HIỆT",m:"trang; đầu",ex:"顶 顺 须 顾 领 颜 题"},
  "風":{hv:"PHONG",m:"gió"},
  "风":{hv:"PHONG",m:"gió"},
  "飛":{hv:"PHI",m:"bay"},
  "飞":{hv:"PHI",m:"bay"},
  "食":{hv:"THỰC",m:"ăn",ex:"餐"},
  "饣":{hv:"THỰC",m:"ăn",ex:"饭 饿 馆 饱 饺 饮"},
  "首":{hv:"THỦ",m:"đầu"},
  "香":{hv:"HƯƠNG",m:"mùi thơm"},
  "馬":{hv:"MÃ",m:"ngựa"},
  "马":{hv:"MÃ",m:"ngựa"},
  "骨":{hv:"CỐT",m:"xương"},
  "高":{hv:"CAO",m:"cao"},
  "髟":{hv:"BƯU",m:"tóc dài"},
  "鬥":{hv:"ĐẤU",m:"đánh nhau"},
  "鬯":{hv:"SƯỞNG",m:"rượu nếp"},
  "鬲":{hv:"CÁCH",m:"nồi ba chân"},
  "鬼":{hv:"QUỶ",m:"ma quỷ"},
  "魚":{hv:"NGƯ",m:"cá"},
  "鱼":{hv:"NGƯ",m:"cá",ex:"鲜 鲨 鲤"},
  "鳥":{hv:"ĐIỂU",m:"chim"},
  "鸟":{hv:"ĐIỂU",m:"chim",ex:"鸡 鸭 鹅 鸦"},
  "鹵":{hv:"LỖ",m:"đất mặn"},
  "鹿":{hv:"LỘC",m:"con hươu"},
  "麥":{hv:"MẠCH",m:"lúa mạch"},
  "麦":{hv:"MẠCH",m:"lúa mạch"},
  "麻":{hv:"MA",m:"cây gai"},
  "黃":{hv:"HOÀNG",m:"vàng"},
  "黄":{hv:"HOÀNG",m:"vàng"},
  "黍":{hv:"THỬ",m:"lúa nếp"},
  "黑":{hv:"HẮC",m:"đen"},
  "黹":{hv:"CHỈ",m:"may vá thêu"},
  "黽":{hv:"MẪNH",m:"ễnh ương"},
  "鼎":{hv:"ĐỈNH",m:"cái đỉnh"},
  "鼓":{hv:"CỔ",m:"cái trống"},
  "鼠":{hv:"THỬ",m:"con chuột"},
  "鼻":{hv:"TỴ",m:"mũi"},
  "齊":{hv:"TỀ",m:"đều, ngay ngắn"},
  "齐":{hv:"TỀ",m:"đều, ngay ngắn"},
  "齒":{hv:"XỈ",m:"răng"},
  "齿":{hv:"XỈ",m:"răng"},
  "龍":{hv:"LONG",m:"rồng"},
  "龙":{hv:"LONG",m:"rồng"},
  "龜":{hv:"QUY",m:"con rùa"},
  "龟":{hv:"QUY",m:"con rùa"},
  "龠":{hv:"DƯỢC",m:"sáo, ống"}
};

/* ---------- Toast ---------- */
let toastT;
function toast(msg){
  let t = $("#toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; document.body.appendChild(t);
    t.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:24px;z-index:99;font-size:14px;box-shadow:var(--shadow);transition:opacity .3s"; }
  t.textContent = msg; t.style.opacity="1";
  clearTimeout(toastT); toastT=setTimeout(()=>t.style.opacity="0",1800);
}

/* ---------- Navigation ---------- */
const PAGES = [
  {id:"home",   ico:"🏠", name:"Tổng quan"},
  {id:"srs",    ico:"🧠", name:"Ôn tập ghi nhớ"},
  {id:"sentsrs",ico:"📖", name:"Ôn câu ví dụ"},
  {id:"listen", ico:"🎧", name:"Luyện nghe"},
  {id:"vocab",  ico:"📚", name:"Từ vựng HSK", badge:D.vocab.length},
  {id:"flash",  ico:"🎴", name:"Flashcard"},
  {id:"write",  ico:"✍️", name:"Luyện viết"},
  {id:"quiz",   ico:"📝", name:"Kiểm tra"},
  {id:"exam",   ico:"🎯", name:"Thi thử"},
  {id:"hanzi",  ico:"🧩", name:"Chiết tự"},
  {id:"radicals",ico:"🌿", name:"Bộ thủ"},
  {id:"video",  ico:"➕", name:"Thêm nguồn từ"},
  {id:"library",ico:"📇", name:"Thư viện keyword"},
  {id:"links",  ico:"📎", name:"Tài liệu / Link"},
  {id:"phrases",ico:"🗣️", name:"Khẩu ngữ", badge:D.phrases.length},
  {id:"biz",    ico:"💼", name:"Thương mại", badge:D.business.length},
  {id:"sents",  ico:"📄", name:"Câu nguồn", badge:D.sentences.length},
  {id:"subtitle",ico:"📋", name:"Phụ đề → Pinyin"},
  {id:"stats",  ico:"📊", name:"Thống kê"},
  {id:"settings",ico:"⚙️", name:"Cài đặt"},
];
function buildNav(){
  $("#nav").innerHTML = PAGES.map(p=>`
    <button class="nav-item" data-page="${p.id}">
      <span class="ico">${p.ico}</span><span>${p.name}</span>
      ${p.badge!=null?`<span class="badge">${p.badge}</span>`:""}
    </button>`).join("");
  $$(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));
}
let current = "home";
function go(id){
  if(id!=="exam" && typeof examTimer!=="undefined" && examTimer){ clearInterval(examTimer); examTimer=null; if(examState) examState.running=false; }
  current = id;
  $$(".nav-item").forEach(b=>b.classList.toggle("active", b.dataset.page===id));
  $("#pageTitle").textContent = PAGES.find(p=>p.id===id).name;
  $("#sidebar").classList.remove("open");
  RENDER[id]();
  $("#view").scrollTop = 0;
  location.hash = id;
}

/* ---------- Pinyin + âm bồi combined display ---------- */
function pinAmbHTML(pinyin, han){
  return `<span class="pin-cell">${esc(pinyin)}<span class="ab">🗣️ ${esc(amBoiForHan(han))}</span></span>`;
}

/* ---------- Speaking test (Web Speech Recognition) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSR = !!SR;
function normHan(s){ return (s||"").replace(/[\s，。！？、,.!?：:；;""'']/g,""); }
function recognizeSpeech(onResult){
  if(!hasSR){ toast("Trình duyệt không hỗ trợ nhận giọng nói (dùng Chrome/Edge)"); onResult(null,"nosupport"); return null; }
  const r=new SR(); r.lang="zh-CN"; r.interimResults=false; r.maxAlternatives=5;
  r.onresult=e=>{ const alts=[...e.results[0]].map(a=>a.transcript); onResult(alts); };
  r.onerror=ev=>onResult(null, ev.error);
  try{ r.start(); }catch(e){}
  return r;
}
// Renders a mic button that checks pronunciation of `han`. cb(ok) optional.
function speakTestWidget(containerSel, han, cb){
  const box=$(containerSel); if(!box) return;
  box.innerHTML=`<button class="mic-btn" id="micBtn">🎤 Nhấn &amp; đọc to</button>
    <div id="micResult" style="margin-top:10px;font-size:15px"></div>`;
  let rec=null, recording=false;
  $("#micBtn").onclick=()=>{
    if(recording){ if(rec)rec.stop(); return; }
    recording=true; $("#micBtn").classList.add("rec"); $("#micBtn").textContent="🔴 Đang nghe… (nhấn để dừng)";
    $("#micResult").innerHTML="";
    rec=recognizeSpeech((alts,err)=>{
      recording=false; $("#micBtn").classList.remove("rec"); $("#micBtn").textContent="🎤 Nhấn & đọc to";
      if(!alts){ $("#micResult").innerHTML=`<span class="sub">${err==="no-speech"?"Không nghe rõ, thử lại.":err==="not-allowed"?"Bạn cần cấp quyền micro cho trình duyệt.":"Không nhận được ("+err+")"}</span>`; if(cb)cb(false); return; }
      const target=normHan(han);
      const ok=alts.some(a=>normHan(a)===target || normHan(a).includes(target));
      $("#micResult").innerHTML = ok
        ? `<span style="color:var(--ok);font-weight:700">✓ Phát âm khớp!</span> Bạn đọc: “${esc(alts[0])}”`
        : `<span style="color:var(--warn);font-weight:700">Gần đúng.</span> Bạn đọc: “${esc(alts[0])}” · Mẫu: <span class="han-cell">${esc(han)}</span> <button class="mini" onclick="speak('${esc(han)}')">🔊 nghe mẫu</button>`;
      if(cb)cb(ok);
    });
  };
}

/* ---------- Wake Lock (giữ màn hình sáng khi nghe rảnh tay) ---------- */
let _wakeLock=null;
async function requestWakeLock(){ try{ if('wakeLock' in navigator){ _wakeLock=await navigator.wakeLock.request('screen'); _wakeLock.addEventListener('release',()=>{}); } }catch(e){} }
function releaseWakeLock(){ try{ _wakeLock&&_wakeLock.release(); _wakeLock=null; }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && Player.playing) requestWakeLock(); });

/* ---------- Sequential audio player (playlist, hands-free) ---------- */
const Player = {
  items:[], idx:0, playing:false, pauseMs:900, rate:0.9, repeat:false, onItem:null, label:"", bilingual:true,
  start(items, opts={}){
    this.items=items; this.idx=0; this.playing=true;
    this.pauseMs=opts.pauseMs??900; this.rate=opts.rate??0.9; this.repeat=opts.repeat??false;
    this.onItem=opts.onItem||null; this.label=opts.label||"";
    if(opts.bilingual!=null) this.bilingual=opts.bilingual;
    $("#playerBar").classList.remove("hidden");
    requestWakeLock();
    this.play();
  },
  play(){
    if(!this.playing) return;
    if(this.idx>=this.items.length){ if(this.repeat){this.idx=0;} else { this.finish(); return; } }
    const it=this.items[this.idx];
    this.render();
    if(this.onItem) this.onItem(it, this.idx);
    if(it.han) bumpPlay(it.han);
    speechSynthesis.cancel();
    const advance=()=>{ if(!this.playing)return; setTimeout(()=>{ if(!this.playing)return; this.idx++; this.play(); }, this.pauseMs); };
    const sayVi=()=>{ // đọc nghĩa tiếng Việt sau tiếng Trung
      if(!this.playing) return;
      if(this.bilingual && it.vi){
        const u2=new SpeechSynthesisUtterance(it.vi);
        u2.lang="vi-VN"; if(viVoice)u2.voice=viVoice; u2.rate=0.95;
        u2.onend=advance; u2.onerror=advance;
        setTimeout(()=>{ if(this.playing) speechSynthesis.speak(u2); else return; }, 250);
      } else advance();
    };
    const u=new SpeechSynthesisUtterance(it.speak||it.han);
    u.lang="zh-CN"; if(zhVoice)u.voice=zhVoice; u.rate=this.rate;
    u.onend=()=>{ if(!this.playing) return; sayVi(); };
    u.onerror=()=>{ if(!this.playing)return; setTimeout(()=>{ this.idx++; this.play(); }, 400); };
    speechSynthesis.speak(u);
  },
  toggle(){ this.playing=!this.playing; if(this.playing){ this.play(); } else { speechSynthesis.cancel(); } this.render(); },
  next(){ speechSynthesis.cancel(); this.idx++; if(this.idx>=this.items.length)this.idx=this.repeat?0:this.items.length-1; this.playing=true; this.play(); },
  prev(){ speechSynthesis.cancel(); this.idx=Math.max(0,this.idx-1); this.playing=true; this.play(); },
  stop(){ this.playing=false; speechSynthesis.cancel(); releaseWakeLock(); $("#playerBar").classList.add("hidden"); },
  finish(){ this.playing=false; speechSynthesis.cancel(); releaseWakeLock(); this.render(true); },
  render(done){
    const bar=$("#playerBar"); if(!bar) return;
    const it=this.items[Math.min(this.idx,this.items.length-1)]||{};
    bar.innerHTML=`
      <button onclick="Player.prev()" title="Trước">⏮</button>
      <button class="big" onclick="Player.toggle()" title="Phát/Dừng">${done?'↺':(this.playing?'⏸':'▶')}</button>
      <button onclick="Player.next()" title="Sau">⏭</button>
      <div class="pnow"><span class="ph">${esc(it.han||'')}</span><span class="pm">${esc(it.vi||it.sub||'')}</span></div>
      <span class="pcount">${done?'xong':(this.idx+1)+'/'+this.items.length}</span>
      <button onclick="Player.toggleBi()" title="Đọc kèm nghĩa tiếng Việt" style="${this.bilingual?'color:var(--brand)':''}">🇻🇳</button>
      <button onclick="Player.toggleRepeat()" title="Lặp lại" style="${this.repeat?'color:var(--brand)':''}">🔁</button>
      <button onclick="Player.stop()" title="Đóng">✕</button>`;
    if(done){ bar.querySelector('.big').onclick=()=>{ Player.idx=0; Player.playing=true; Player.play(); }; }
  },
  toggleRepeat(){ this.repeat=!this.repeat; this.render(); },
  toggleBi(){ this.bilingual=!this.bilingual; this.render(); toast(this.bilingual?"Đọc kèm nghĩa tiếng Việt: BẬT":"Chỉ đọc tiếng Trung"); }
};
window.Player=Player;

/* đọc tuần tự 1 mục: tiếng Trung → nghĩa tiếng Việt */
function speakBilingual(han, vi){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u1=new SpeechSynthesisUtterance(han); u1.lang="zh-CN"; if(zhVoice)u1.voice=zhVoice; u1.rate=0.85;
  u1.onend=()=>{ if(!vi) return; const u2=new SpeechSynthesisUtterance(vi); u2.lang="vi-VN"; if(viVoice)u2.voice=viVoice; u2.rate=0.95; setTimeout(()=>speechSynthesis.speak(u2),200); };
  speechSynthesis.speak(u1);
}
window.speakBilingual=speakBilingual;

/* ================= PAGES ================= */
const RENDER = {};

/* ---------- Home ---------- */
RENDER.home = () => {
  const learned = Object.keys(progress.learned).length;
  const byLevel = {};
  D.vocab.forEach(v=>byLevel[v.level]=(byLevel[v.level]||0)+1);
  const topics = new Set(D.vocab.map(v=>v.topic).filter(Boolean));
  const c = srsCounts();
  ensureToday();
  const dl=progress.daily, goal=progress.goal, st=progress.streak;
  const revPct=Math.min(100, Math.round(dl.reviews/Math.max(1,goal.reviews)*100));
  const goalDone = dl.reviews>=goal.reviews;
  // build today's task list
  const tasks=[];
  if(c.due>0) tasks.push({ico:"🧠",t:`Ôn ${c.due} thẻ đến hạn`,d:`Đã ôn ${dl.reviews}/${goal.reviews} hôm nay`,go:"srs",done:goalDone});
  else tasks.push({ico:"✅",t:"Không còn thẻ đến hạn",d:"Tuyệt vời! Học thêm từ mới nhé",go:"srs",done:true});
  tasks.push({ico:"🆕",t:`Học ${goal.newWords} từ mới`,d:`${c.newc} từ mới đang chờ`,go:"srs",done:dl.newLearned>=goal.newWords});
  tasks.push({ico:"🎧",t:"Luyện nghe 1 phiên",d:`Đã nghe ${dl.listens} lượt hôm nay`,go:"listen",done:dl.listens>=10});
  if(progress.myWords.length) tasks.push({ico:"📇",t:"Nghe lại thư viện keyword",d:`${progress.myWords.length} từ tự thu thập`,go:"library",done:false});

  $("#view").innerHTML = `
    <h2 class="section-h">Chào mừng trở lại 👋</h2>
    <p class="sub">App ghi nhớ &amp; học tiếng Trung — tập trung luyện nghe và từ vựng.</p>

    <div class="panel" style="background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;border:none">
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div>
          <div style="font-size:13px;opacity:.85">🔥 Chuỗi ngày học</div>
          <div style="font-size:42px;font-weight:800;line-height:1">${st.count||0} ngày</div>
          <div style="font-size:13px;opacity:.85">Kỷ lục: ${st.best||0} ngày · ${c.due} thẻ cần ôn hôm nay</div>
        </div>
        <div style="margin-left:auto;text-align:center">
          <div style="font-size:12px;opacity:.85;margin-bottom:4px">Mục tiêu hôm nay</div>
          <div style="font-size:22px;font-weight:800">${dl.reviews}/${goal.reviews} thẻ</div>
          <div style="height:8px;width:140px;background:rgba(255,255,255,.3);border-radius:20px;overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:${revPct}%;background:#fff"></i></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3>📅 Hôm nay học gì</h3>
      <div id="todayTasks">
        ${tasks.map((k,i)=>`<div class="today-task ${k.done?'done':''}" data-go="${k.go}">
          <span class="tk-ico">${k.done?'✅':k.ico}</span>
          <div style="flex:1"><div style="font-weight:600">${esc(k.t)}</div><div class="sub" style="font-size:12.5px">${esc(k.d)}</div></div>
          <span class="btn sm">Vào ›</span>
        </div>`).join("")}
      </div>
      <div class="toolbar" style="margin-top:10px">
        <label class="sub">🎯 Mục tiêu thẻ/ngày <input class="txt" id="goalRev" type="number" value="${goal.reviews}" min="5" max="200" style="width:70px"></label>
        <label class="sub">Từ mới/ngày <input class="txt" id="goalNew" type="number" value="${goal.newWords}" min="0" max="100" style="width:66px"></label>
        <button class="btn sm" id="goalSave">Lưu mục tiêu</button>
      </div>
    </div>

    <div class="panel">
      <h3>🗓️ Danh sách cố định hôm nay</h3>
      <p class="sub">100 từ + 100 câu được chọn tự động, giữ nguyên cả ngày (sang ngày mới tự đổi). Ưu tiên từ chưa thuộc / ít học.</p>
      <div class="toolbar">
        <button class="btn primary" id="dlLearn">🧠 Học 100 từ</button>
        <button class="btn" id="dlListen">🎧 Nghe 100 từ</button>
        <button class="btn" id="dlSent">📖 Ôn 100 câu</button>
        <button class="btn" id="dlView">👁 Xem danh sách</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="n">${allVocab().length}</div><div class="l">Tổng từ vựng</div></div>
      <div class="stat"><div class="n">${learned}</div><div class="l">Từ đã thuộc ✓</div></div>
      <div class="stat"><div class="n">${progress.myWords.length}</div><div class="l">Từ tự thêm 🎬</div></div>
      <div class="stat"><div class="n">${D.phrases.length}</div><div class="l">Khẩu ngữ</div></div>
      <div class="stat"><div class="n">${D.sentences.length}</div><div class="l">Câu nguồn</div></div>
      <div class="stat"><div class="n">${topics.size}</div><div class="l">Chủ đề</div></div>
    </div>
    <div class="panel">
      <h3>Bắt đầu học nhanh</h3>
      <div class="toolbar">
        <button class="btn primary" data-jump="srs">🧠 Ôn tập ghi nhớ</button>
        <button class="btn" data-jump="listen">🎧 Luyện nghe</button>
        <button class="btn" data-jump="flash">🎴 Flashcard</button>
        <button class="btn" data-jump="write">✍️ Luyện viết</button>
        <button class="btn" data-jump="video">➕ Thêm nguồn từ mới</button>
      </div>
    </div>
    <div class="panel">
      <h3>Từ vựng theo cấp độ</h3>
      <div class="chips">
        ${Object.entries(byLevel).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
          `<span class="chip" data-lvl="${esc(k)}">${esc(k)} · ${v}</span>`).join("")}
      </div>
    </div>`;
  $$("[data-jump]").forEach(b=>b.onclick=()=>go(b.dataset.jump));
  $$(".today-task").forEach(t=>t.onclick=()=>go(t.dataset.go));
  $("#goalSave").onclick=()=>{ progress.goal={reviews:parseInt($("#goalRev").value)||20, newWords:parseInt($("#goalNew").value)||10}; save(); toast("Đã lưu mục tiêu"); RENDER.home(); };
  const dList=ensureDailyList();
  const dlWords=()=>dList.words.map(h=>findWord(h)).filter(Boolean);
  $("#dlLearn").onclick=()=>{ dailyStudyList=dlWords(); go("srs"); toast("Học danh sách hôm nay ở chế độ Nhận biết"); };
  $("#dlListen").onclick=()=>Player.start(dlWords().map(v=>({han:v.han,sub:v.vi,vi:v.vi})),{pauseMs:1000});
  $("#dlSent").onclick=()=>{ dailySentList=dList.sents.map(i=>D.sentences[i]).filter(Boolean); go("sentsrs"); toast("Ôn 100 câu hôm nay"); };
  $("#dlView").onclick=()=>{
    $("#modalCard").innerHTML=`<button class="close-x" onclick="closeModal()">×</button>
      <h3 style="margin:0 0 8px">🗓️ Danh sách hôm nay (${dList.date})</h3>
      <div class="toolbar"><button class="btn sm" onclick="Player.start(window._dlPlay,{pauseMs:1000})">▶ Nghe cả 100 từ</button></div>
      <div class="lab" style="margin-top:10px">100 TỪ</div>
      <div class="cards-grid">${dlWords().slice(0,100).map(v=>`<div class="vcard" onclick="speak('${esc(v.han)}')"><div class="han" style="font-size:26px">${esc(v.han)}</div><div class="pin">${esc(v.pinyin||toPinyin(v.han))}</div><div class="vi">${esc(v.vi||"")}</div></div>`).join("")}</div>
      <div class="lab" style="margin-top:14px">100 CÂU</div>
      ${dList.sents.slice(0,100).map(i=>{const s=D.sentences[i]; return s?`<div class="sent-line"><span class="han-cell" style="font-size:16px">${esc(s.han)}</span> <button class="mini" onclick="speak('${esc(s.han)}')">🔊</button><div class="pin-cell" style="font-size:12px">${esc(toPinyin(s.han))}</div></div>`:"";}).join("")}`;
    window._dlPlay=dlWords().map(v=>({han:v.han,sub:v.vi,vi:v.vi}));
    $("#modal").classList.remove("hidden");
  };
  $$("[data-lvl]").forEach(c=>c.onclick=()=>{ vocabFilter.level=c.dataset.lvl; go("vocab"); });
};

/* ---------- SRS review page (ghi nhớ) ---------- */
let srsQueue=[], srsShown=false, srsSessionDone=0, srsMode="recognize", srsChecked=false;
let dailyStudyList=null, dailySentList=null;
RENDER.srs = () => {
  const c = srsCounts(), cc = srsCatCounts();
  $("#view").innerHTML = `
    <h2 class="section-h">🧠 Ôn tập ghi nhớ</h2>
    <p class="sub">Lặp lại ngắt quãng: nhớ tốt → giãn cách xa dần, quên → lặp lại sớm. Kiểm tra qua nghe, viết, hoặc nói.</p>
    <div class="stat-grid">
      <div class="stat"><div class="n" style="color:var(--warn)">${c.due}</div><div class="l">Đến hạn ôn</div></div>
      <div class="stat"><div class="n" style="color:var(--accent)">${cc.new}</div><div class="l">Từ mới</div></div>
      <div class="stat"><div class="n" style="color:#e0533b">${cc.hard}</div><div class="l">😓 Khó</div></div>
      <div class="stat"><div class="n">${cc.learning}</div><div class="l">📖 Đang học</div></div>
      <div class="stat"><div class="n" style="color:var(--ok)">${cc.easy}</div><div class="l">😀 Dễ</div></div>
      <div class="stat"><div class="n" style="color:var(--ok)">${cc.mature}</div><div class="l">🏆 Thuộc</div></div>
    </div>
    <div class="panel">
      <div class="play-all-row">
        <b>Chế độ kiểm tra:</b>
        <span class="chip ${srsMode==='recognize'?'active':''}" data-m="recognize">🎧 Nhận biết (nghe→đoán)</span>
        <span class="chip ${srsMode==='write'?'active':''}" data-m="write">✍️ Viết hán tự</span>
        <span class="chip ${srsMode==='speak'?'active':''}" data-m="speak">🎤 Nói hán tự</span>
      </div>
      <div class="toolbar">
        <select id="srsLevel"><option value="">Mọi cấp độ</option>
          ${[...new Set(D.vocab.map(v=>v.level))].sort().map(l=>`<option>${esc(l)}</option>`).join("")}</select>
        <select id="srsFocus">
          <option value="due">Đến hạn + từ mới</option>
          <option value="hard">Ưu tiên từ Khó 😓</option>
          <option value="all">Tất cả (xáo trộn)</option>
        </select>
        <label class="sub">Số từ mới: <input class="txt" id="srsNew" type="number" value="10" min="0" max="50" style="width:66px"></label>
        <button class="btn primary" id="srsStart">Bắt đầu ôn</button>
      </div>
    </div>
    <div class="progress-bar"><i id="srsProg"></i></div>
    <div id="srsArea"></div>`;
  $$(".chip[data-m]").forEach(ch=>ch.onclick=()=>{srsMode=ch.dataset.m; RENDER.srs();});
  $("#srsStart").onclick = startSrs;
  $("#srsArea").innerHTML = `<p class="sub" style="text-align:center">Chọn chế độ &amp; nhấn <b>Bắt đầu ôn</b>.</p>`;
  if(dailyStudyList && dailyStudyList.length) startSrs();
};
function startSrs(){
  if(dailyStudyList && dailyStudyList.length){
    dailyStudyList.forEach(v=>srsInit(v.han));
    srsQueue=dailyStudyList.slice(); dailyStudyList=null; srsShown=false; srsSessionDone=0; srsChecked=false;
    drawSrs(); return;
  }
  const lvl=$("#srsLevel").value, focus=$("#srsFocus").value;
  const nNew=parseInt($("#srsNew").value)||0;
  let pool;
  if(focus==="hard") pool=allVocab().filter(v=>!lvl||v.level===lvl).filter(v=>srsCategory(v.han)==="hard");
  else if(focus==="all") pool=allVocab().filter(v=>!lvl||v.level===lvl);
  else {
    let due=srsDueList().filter(v=>!lvl||v.level===lvl);
    let news=srsNewList(500).filter(v=>!lvl||v.level===lvl).slice(0,nNew);
    news.forEach(v=>srsInit(v.han));
    pool=due.concat(news);
  }
  srsQueue=shuffle(pool).slice(0,60); srsShown=false; srsSessionDone=0; srsChecked=false;
  if(!srsQueue.length){ $("#srsArea").innerHTML=`<div class="panel" style="text-align:center"><h3>🎉 Không còn thẻ phù hợp!</h3><p class="sub">Đổi bộ lọc, quay lại sau, hoặc thêm từ ở 🎬 Nhập video.</p></div>`; return; }
  drawSrs();
}
function srsGradeButtons(v){
  return `<button class="btn" style="border-color:var(--brand)" data-g="0">Quên</button>
    <button class="btn" data-g="3">Khó</button>
    <button class="btn primary" data-g="4">Nhớ</button>
    <button class="btn" style="border-color:var(--ok)" data-g="5">Dễ</button>`;
}
function bindGrades(v){
  $$("[data-g]").forEach(b=>b.onclick=()=>{
    const g=parseInt(b.dataset.g);
    srsReview(v.han, g);
    srsQueue.shift();
    if(g<3) srsQueue.push(v); else srsSessionDone++;
    srsShown=false; srsChecked=false; drawSrs();
  });
}
function drawSrs(){
  if(!srsQueue.length){
    $("#srsProg").style.width="100%";
    $("#srsArea").innerHTML=`<div class="panel" style="text-align:center"><h3>✅ Xong phiên ôn!</h3>
      <p class="sub">Đã ôn ${srsSessionDone} thẻ.</p>
      <button class="btn primary" onclick="RENDER.srs()">Về trang ôn tập</button></div>`;
    return;
  }
  const v=srsQueue[0];
  const total=srsSessionDone+srsQueue.length;
  $("#srsProg").style.width=(srsSessionDone/total*100)+"%";
  const cat=srsCategory(v.han);
  const catBadge={new:'🆕 Mới',hard:'😓 Khó',learning:'📖 Đang học',easy:'😀 Dễ',mature:'🏆 Thuộc'}[cat];

  if(srsMode==="write"){
    srsWriteCard(v, catBadge); return;
  }
  if(srsMode==="speak"){
    srsSpeakCard(v, catBadge); return;
  }
  // recognize (listening)
  $("#srsArea").innerHTML=`
    <div class="flash-wrap">
      <div style="margin-bottom:8px"><span class="chip">${catBadge}</span></div>
      <div class="flash" id="srsCard">
        <div class="fhan">${esc(v.han)}</div>
        <div id="srsBack" class="${srsShown?'':'hidden'}">
          <div class="fpin">${esc(v.pinyin)}</div>
          <div style="color:var(--warn);font-size:18px">🗣️ ${esc(amBoiForHan(v.han))}</div>
          <div class="fvi">${esc(v.vi)}</div>
        </div>
        <div class="hint">${srsShown?'Bạn nhớ tốt tới mức nào?':'Nghe &amp; đoán nghĩa → nhấn để lật'} · còn ${srsQueue.length} thẻ</div>
      </div>
      <div class="flash-controls">
        <button class="btn" onclick="speak('${esc(v.han)}')">🔊 Nghe</button>
        <button class="btn" onclick="openYouglish('${esc(v.han)}')">🌐 Youglish</button>
        ${srsShown?srsGradeButtons(v):`<button class="btn primary" id="srsFlip">Lật thẻ</button>`}
      </div>
    </div>`;
  speak(v.han);
  $("#srsCard").onclick=()=>{ if(!srsShown){srsShown=true; drawSrs();} };
  if($("#srsFlip")) $("#srsFlip").onclick=()=>{srsShown=true; drawSrs();};
  bindGrades(v);
}
function srsWriteCard(v, catBadge){
  $("#srsArea").innerHTML=`
    <div class="center-narrow">
      <div style="margin-bottom:8px;text-align:center"><span class="chip">${catBadge}</span> <span class="sub">còn ${srsQueue.length} thẻ</span></div>
      <div class="panel" style="text-align:center">
        <div class="quiz-q">✍️ Nghe / đọc nghĩa rồi viết hán tự</div>
        <div class="detail-vi" style="font-size:22px">${esc(v.vi)}</div>
        <div class="detail-pin" style="font-size:19px">${esc(v.pinyin)} · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(v.han))}</span></div>
        <input class="big-input" id="srsInput" placeholder="Viết hán tự..." autocomplete="off">
        <div class="toolbar" style="justify-content:center;margin-top:12px">
          <button class="btn" onclick="speak('${esc(v.han)}')">🔊 Nghe</button>
          <button class="btn primary" id="srsCheck">Kiểm tra</button>
        </div>
        <div id="srsResult" style="margin-top:10px;font-size:16px"></div>
        <div class="flash-controls" id="srsGrades" style="margin-top:10px"></div>
      </div>
    </div>`;
  const inp=$("#srsInput"); inp.focus();
  const check=()=>{
    const ok=inp.value.trim()===v.han;
    $("#srsResult").innerHTML= ok
      ? `<span style="color:var(--ok);font-weight:700">✓ Chính xác!</span> <span class="han-cell">${esc(v.han)}</span>`
      : `<span style="color:var(--brand);font-weight:700">✗ Chưa đúng.</span> Đáp án: <span class="han-cell">${esc(v.han)}</span>`;
    $("#srsGrades").innerHTML = ok
      ? `<button class="btn primary" data-g="4">Nhớ ✓</button><button class="btn" style="border-color:var(--ok)" data-g="5">Dễ</button><button class="btn" data-g="3">Khó</button>`
      : `<button class="btn" style="border-color:var(--brand)" data-g="0">Quên</button><button class="btn" data-g="3">Khó</button>`;
    bindGrades(v);
  };
  $("#srsCheck").onclick=check;
  inp.onkeydown=e=>{ if(e.key==="Enter") check(); };
}
function srsSpeakCard(v, catBadge){
  $("#srsArea").innerHTML=`
    <div class="center-narrow">
      <div style="margin-bottom:8px;text-align:center"><span class="chip">${catBadge}</span> <span class="sub">còn ${srsQueue.length} thẻ</span></div>
      <div class="panel" style="text-align:center">
        <div class="quiz-q">🎤 Đọc to hán tự sau — app kiểm tra phát âm</div>
        <div class="detail-han" style="font-size:52px">${esc(v.han)}</div>
        <div class="detail-pin">${esc(v.pinyin)} · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(v.han))}</span></div>
        <div class="detail-vi" style="font-size:16px">${esc(v.vi)}</div>
        <div class="toolbar" style="justify-content:center;margin:12px 0">
          <button class="btn" onclick="speak('${esc(v.han)}')">🔊 Nghe mẫu</button>
        </div>
        <div id="srsMic"></div>
        <div class="flash-controls" style="margin-top:12px">${srsGradeButtons(v)}</div>
      </div>
    </div>`;
  speakTestWidget("#srsMic", v.han, null);
  bindGrades(v);
}

/* ---------- Vocab ---------- */
let vocabFilter = {level:"", topic:"", q:"", onlyNew:false, sort:"", src:"all"};
RENDER.vocab = () => {
  const pool = vocabFilter.src==="mywords" ? progress.myWords : (vocabFilter.src==="hsk"?D.vocab:allVocab());
  const levels = [...new Set(D.vocab.map(v=>v.level))].sort();
  const topics = [...new Set(D.vocab.map(v=>v.topic).filter(Boolean))].sort();
  $("#view").innerHTML = `
    <h2 class="section-h">Từ vựng HSK</h2>
    <p class="sub">Nhấn thẻ để xem chi tiết. Badge 🔊×n = số lần đã nghe. Sắp xếp "ít học nhất" để ưu tiên từ chưa quen.</p>
    <div class="toolbar">
      <select id="fSrc">
        <option value="all" ${vocabFilter.src==="all"?"selected":""}>Tất cả nguồn</option>
        <option value="hsk" ${vocabFilter.src==="hsk"?"selected":""}>HSK có sẵn</option>
        <option value="mywords" ${vocabFilter.src==="mywords"?"selected":""}>Thư viện của tôi</option>
      </select>
      <select id="fLevel"><option value="">Tất cả cấp độ</option>
        ${levels.map(l=>`<option value="${esc(l)}" ${vocabFilter.level===l?"selected":""}>${esc(l)}</option>`).join("")}</select>
      <select id="fTopic"><option value="">Tất cả chủ đề</option>
        ${topics.map(t=>`<option value="${esc(t)}" ${vocabFilter.topic===t?"selected":""}>${esc(t)}</option>`).join("")}</select>
      <select id="fSort">
        <option value="" ${vocabFilter.sort===""?"selected":""}>Sắp xếp mặc định</option>
        <option value="studyAsc" ${vocabFilter.sort==="studyAsc"?"selected":""}>Ít học nhất → nhiều</option>
        <option value="studyDesc" ${vocabFilter.sort==="studyDesc"?"selected":""}>Học nhiều nhất → ít</option>
        <option value="playAsc" ${vocabFilter.sort==="playAsc"?"selected":""}>Nghe ít nhất → nhiều</option>
        <option value="playDesc" ${vocabFilter.sort==="playDesc"?"selected":""}>Nghe nhiều nhất → ít</option>
      </select>
      <label class="chip ${vocabFilter.onlyNew?'active':''}" id="fNew">Chưa thuộc</label>
      <button class="btn sm primary" id="vPlayAll">▶ Đọc lần lượt</button>
      <span class="count-pill" id="vCount"></span>
    </div>
    <div class="cards-grid" id="vGrid"></div>`;
  $("#fSrc").onchange = e=>{vocabFilter.src=e.target.value; RENDER.vocab();};
  $("#fLevel").onchange = e=>{vocabFilter.level=e.target.value; drawVocab();};
  $("#fTopic").onchange = e=>{vocabFilter.topic=e.target.value; drawVocab();};
  $("#fSort").onchange = e=>{vocabFilter.sort=e.target.value; drawVocab();};
  $("#fNew").onclick = e=>{vocabFilter.onlyNew=!vocabFilter.onlyNew; e.target.classList.toggle("active",vocabFilter.onlyNew); drawVocab();};
  $("#vPlayAll").onclick = ()=>{ const l=filteredVocab(); if(!l.length){toast("Không có từ");return;} Player.start(l.slice(0,200).map(v=>({han:v.han,sub:v.vi,vi:v.vi})),{pauseMs:1000}); };
  drawVocab();
};
function filteredVocab(){
  const q = vocabFilter.q.trim().toLowerCase();
  const pool = vocabFilter.src==="mywords" ? progress.myWords : (vocabFilter.src==="hsk"?D.vocab:allVocab());
  let list = pool.filter(v=>{
    if(vocabFilter.level && v.level!==vocabFilter.level) return false;
    if(vocabFilter.topic && v.topic!==vocabFilter.topic) return false;
    if(vocabFilter.onlyNew && progress.learned[v.han]) return false;
    if(q){ return (v.han+(v.pinyin||"")+(v.vi||"")).toLowerCase().includes(q); }
    return true;
  });
  const s=vocabFilter.sort;
  if(s==="studyAsc") list.sort((a,b)=>sc(a.han)-sc(b.han));
  else if(s==="studyDesc") list.sort((a,b)=>sc(b.han)-sc(a.han));
  else if(s==="playAsc") list.sort((a,b)=>pc(a.han)-pc(b.han));
  else if(s==="playDesc") list.sort((a,b)=>pc(b.han)-pc(a.han));
  return list;
}
function drawVocab(){
  const list = filteredVocab();
  $("#vCount") && ($("#vCount").textContent = `${list.length} từ`);
  const g = $("#vGrid"); if(!g) return;
  g.innerHTML = list.slice(0,600).map((v,i)=>vcardHTML(v)).join("") ||
    `<p class="sub">Không tìm thấy từ phù hợp.</p>`;
  bindVcards(g, list);
  if(list.length>600){ g.insertAdjacentHTML("beforeend",
    `<p class="sub" style="grid-column:1/-1">Hiển thị 600/${list.length} từ — dùng bộ lọc để thu hẹp.</p>`); }
}
function vcardHTML(v){
  const n=pc(v.han), st=sc(v.han);
  return `<div class="vcard ${progress.learned[v.han]?'learned':''}" data-han="${esc(v.han)}">
    <span class="lvl">${esc(v.level||"")}${n?` · 🔊×${n}`:""}${st?` · 📖×${st}`:""}</span>
    <div class="han">${esc(v.han)}</div>
    <div class="pin">${esc(v.pinyin)}</div>
    <div class="amboi" title="Âm bồi (phát âm gần đúng)">🗣️ ${esc(amBoiForHan(v.han))}</div>
    <div class="vi">${esc(v.vi)}</div>
    ${v.topic?`<div class="topic">${esc(v.topic)}</div>`:""}
    <div class="card-actions">
      <button class="mini" data-act="speak">🔊</button>
      <button class="mini" data-act="yg">🌐</button>
      <button class="mini" data-act="learn">${progress.learned[v.han]?'✓ Thuộc':'+ Thuộc'}</button>
    </div>
  </div>`;
}
function bindVcards(container, list){
  $$(".vcard", container).forEach(card=>{
    const han = card.dataset.han;
    const v = list.find(x=>x.han===han) || D.vocab.find(x=>x.han===han);
    card.onclick = e=>{
      const act = e.target.dataset.act;
      if(act==="speak"){ e.stopPropagation(); speak(han); return; }
      if(act==="yg"){ e.stopPropagation(); openYouglish(han); return; }
      if(act==="learn"){ e.stopPropagation(); toggleLearned(han); card.replaceWith(elFromHTML(vcardHTML(v))); bindVcards(container,list); return; }
      openDetail(v);
    };
  });
}
function elFromHTML(html){ const t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstChild; }
function toggleLearned(han){
  if(progress.learned[han]) delete progress.learned[han]; else progress.learned[han]=true;
  save();
}

/* ---------- Detail modal ---------- */
function openDetail(v){
  $("#modalCard").innerHTML = `
    <button class="close-x" onclick="closeModal()">×</button>
    <div class="detail-han">${esc(v.han)}</div>
    <div class="detail-pin">${esc(v.pinyin)}</div>
    <div style="color:var(--warn);font-size:17px;margin-top:2px">🗣️ Âm bồi: ${esc(amBoiForHan(v.han))}</div>
    <div class="detail-vi">${esc(v.vi)}</div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn sm primary" onclick="speak('${esc(v.han)}')">🔊 Nghe (Trung)</button>
      <button class="btn sm" onclick="speakAmboi('${esc(v.han)}')">🇻🇳 Đọc âm bồi</button>
      <button class="btn sm" onclick="toggleLearned('${esc(v.han)}');toast('Đã cập nhật')">✓ Đánh dấu thuộc</button>
      <button class="btn sm" id="dtSave" style="border-color:var(--warn)">${isSaved(v.han)?'⭐ Đã lưu':'☆ Lưu từ'}</button>
      <button class="btn sm" style="border-color:var(--brand)" onclick="openMemoryGuide('${esc(v.han)}')">💡 Cách nhớ</button>
      <a class="btn sm" href="${youglish(v.han)}" target="_blank" rel="noopener">🌐 Youglish</a>
      <span class="chip">${esc(v.level)}</span>
    </div>
    <div class="detail-row"><div class="lab">🧩 Chiết tự từng chữ</div>
      ${charBreakdownHTML(v.han)}</div>
    ${v.breakdown?`<div class="detail-row"><div class="lab">📖 Giải nghĩa chi tiết (chiết tự nâng cao)</div>
      <div class="breakdown">${esc(v.breakdown)}</div></div>`:""}
    ${v.example?`<div class="detail-row"><div class="lab">💡 Câu ví dụ</div>
      <div class="example-box"><div class="eh">${esc(v.example)} <span class="audio-btn" onclick="speak('${esc(v.example)}')">🔊</span></div>
      <div class="ep">${esc(v.examplePinyin)}</div></div></div>`:""}
    ${v.topic?`<div class="detail-row"><div class="lab">📂 Chủ đề</div>${esc(v.topic)}</div>`:""}
    ${v.dateAdded?`<div class="detail-row"><div class="lab">📅 Ngày thêm</div>${esc(v.dateAdded)}</div>`:""}
  `;
  $("#modal").classList.remove("hidden");
  if($("#dtSave")) $("#dtSave").onclick=()=>{ const on=toggleSaved(v.han,{pinyin:v.pinyin,vi:v.vi}); $("#dtSave").textContent=on?'⭐ Đã lưu':'☆ Lưu từ'; toast(on?'Đã lưu từ':'Đã bỏ lưu'); };
}
function closeModal(){ $("#modal").classList.add("hidden"); }
$("#modal").onclick = e=>{ if(e.target.id==="modal") closeModal(); };
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

/* ---------- Flashcard ---------- */
let flashDeck = [], flashIdx = 0, flashShown = false;
RENDER.flash = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">Flashcard</h2>
    <p class="sub">Nhấn vào thẻ để lật. Đánh giá để hệ thống ưu tiên ôn từ bạn chưa nhớ.</p>
    <div class="toolbar center-narrow" style="justify-content:center">
      <select id="deckLevel"><option value="">Mọi cấp độ</option>
        ${[...new Set(D.vocab.map(v=>v.level))].sort().map(l=>`<option>${esc(l)}</option>`).join("")}</select>
      <select id="deckMode">
        <option value="new">Ưu tiên từ chưa thuộc</option>
        <option value="all">Tất cả (xáo trộn)</option>
        <option value="learned">Chỉ từ đã thuộc</option>
      </select>
      <button class="btn primary" id="startDeck">Bắt đầu</button>
    </div>
    <div class="progress-bar"><i id="flashProg"></i></div>
    <div id="flashArea"></div>`;
  $("#startDeck").onclick = buildDeck;
  buildDeck();
};
function buildDeck(){
  const lvl = $("#deckLevel").value, mode = $("#deckMode").value;
  let pool = D.vocab.filter(v=>!lvl||v.level===lvl);
  if(mode==="new") pool = pool.filter(v=>!progress.learned[v.han]);
  if(mode==="learned") pool = pool.filter(v=>progress.learned[v.han]);
  flashDeck = shuffle(pool).slice(0,50); flashIdx=0; flashShown=false;
  if(!flashDeck.length){ $("#flashArea").innerHTML=`<p class="sub" style="text-align:center">Không có từ nào phù hợp.</p>`; return; }
  drawFlash();
}
function drawFlash(){
  const v = flashDeck[flashIdx];
  $("#flashProg").style.width = ((flashIdx)/flashDeck.length*100)+"%";
  $("#flashArea").innerHTML = `
    <div class="flash-wrap">
      <div class="flash" id="flashCard">
        <div class="fhan">${esc(v.han)}</div>
        <div id="flashBack" class="${flashShown?'':'hidden'}">
          <div class="fpin">${esc(v.pinyin)}</div>
          <div style="color:var(--warn);font-size:18px">🗣️ ${esc(amBoiForHan(v.han))}</div>
          <div class="fvi">${esc(v.vi)}</div>
        </div>
        <div class="hint">${flashShown?'Bạn có nhớ từ này không?':'Nhấn để xem đáp án'} · Thẻ ${flashIdx+1}/${flashDeck.length}</div>
      </div>
      <div class="flash-controls">
        <button class="btn" onclick="speak('${esc(v.han)}')">🔊 Nghe</button>
        ${flashShown?`
          <button class="btn" id="fAgain">😕 Chưa nhớ</button>
          <button class="btn primary" id="fGood">😀 Đã nhớ</button>`:
          `<button class="btn primary" id="fFlip">Lật thẻ</button>`}
      </div>
    </div>`;
  $("#flashCard").onclick = ()=>{ if(!flashShown){flashShown=true; drawFlash();} };
  if($("#fFlip")) $("#fFlip").onclick=()=>{flashShown=true; drawFlash();};
  if($("#fGood")) $("#fGood").onclick=()=>{ progress.learned[v.han]=true; save(); nextFlash(); };
  if($("#fAgain")) $("#fAgain").onclick=()=>{ flashDeck.push(v); nextFlash(); };
}
function nextFlash(){
  flashIdx++; flashShown=false;
  if(flashIdx>=flashDeck.length){
    $("#flashProg").style.width="100%";
    $("#flashArea").innerHTML=`<div class="flash-wrap"><div class="panel" style="text-align:center">
      <h3>🎉 Hoàn thành bộ thẻ!</h3><p class="sub">Đã thuộc: ${Object.keys(progress.learned).length} từ</p>
      <button class="btn primary" onclick="RENDER.flash()">Học bộ mới</button></div></div>`;
    return;
  }
  drawFlash();
}

/* ---------- Writing practice ---------- */
let writeItem=null;
RENDER.write = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">Luyện viết</h2>
    <p class="sub">Nhìn nghĩa &amp; pinyin, tự viết/gõ hán tự rồi kiểm tra.</p>
    <div class="center-narrow">
      <div class="toolbar" style="justify-content:center">
        <select id="wLevel"><option value="">Mọi cấp độ</option>
          ${[...new Set(D.vocab.map(v=>v.level))].sort().map(l=>`<option>${esc(l)}</option>`).join("")}</select>
        <button class="btn primary" id="wNext">Từ mới</button>
      </div>
      <div id="wArea"></div>
    </div>`;
  $("#wNext").onclick = nextWrite;
  nextWrite();
};
function nextWrite(){
  const lvl = $("#wLevel").value;
  const pool = D.vocab.filter(v=>(!lvl||v.level===lvl) && v.han);
  writeItem = pool[Math.floor(Math.random()*pool.length)];
  $("#wArea").innerHTML = `
    <div class="panel" style="text-align:center">
      <div class="detail-vi" style="font-size:22px">${esc(writeItem.vi)}</div>
      <div class="detail-pin" style="font-size:20px">${esc(writeItem.pinyin)} · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(writeItem.han))}</span></div>
      <input class="big-input" id="wInput" placeholder="Viết hán tự..." autocomplete="off">
      <div class="toolbar" style="justify-content:center;margin-top:14px">
        <button class="btn primary" id="wCheck">Kiểm tra</button>
        <button class="btn" id="wReveal">Xem đáp án</button>
        <button class="btn" onclick="speak('${esc(writeItem.han)}')">🔊</button>
      </div>
      <div id="wResult" style="margin-top:12px;font-size:16px"></div>
    </div>`;
  const inp = $("#wInput"); inp.focus();
  const check = ()=>{
    const ok = inp.value.trim()===writeItem.han;
    $("#wResult").innerHTML = ok
      ? `<span style="color:var(--ok);font-weight:700">✓ Chính xác!</span> ${esc(writeItem.han)}`
      : `<span style="color:var(--brand);font-weight:700">✗ Chưa đúng.</span> Đáp án: <span class="han-cell">${esc(writeItem.han)}</span>`;
    if(ok){ progress.learned[writeItem.han]=true; save(); }
  };
  $("#wCheck").onclick = check;
  inp.onkeydown = e=>{ if(e.key==="Enter") check(); };
  $("#wReveal").onclick = ()=>{ $("#wResult").innerHTML = `Đáp án: <span class="han-cell">${esc(writeItem.han)}</span>`; };
}

/* ---------- Quiz ---------- */
let quizItem=null;
RENDER.quiz = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">Kiểm tra trắc nghiệm</h2>
    <p class="sub">Chọn nghĩa tiếng Việt đúng cho hán tự. Điểm: <b id="qScore">${progress.quizStats.correct}/${progress.quizStats.total}</b></p>
    <div class="center-narrow"><div id="qArea"></div></div>`;
  nextQuiz();
};
function nextQuiz(){
  const pool = D.vocab.filter(v=>v.vi);
  quizItem = pool[Math.floor(Math.random()*pool.length)];
  const opts = shuffle([quizItem, ...shuffle(pool.filter(v=>v.vi!==quizItem.vi)).slice(0,3)]);
  $("#qArea").innerHTML = `
    <div class="panel" style="text-align:center">
      <div class="quiz-q">Hán tự này nghĩa là gì?</div>
      <div class="quiz-han">${esc(quizItem.han)}</div>
      <div class="quiz-q">${esc(quizItem.pinyin)} · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(quizItem.han))}</span> <span class="audio-btn" onclick="speak('${esc(quizItem.han)}')">🔊</span></div>
      <div style="margin-top:14px">${opts.map(o=>`<button class="opt" data-vi="${esc(o.vi)}">${esc(o.vi)}</button>`).join("")}</div>
    </div>`;
  $$(".opt").forEach(b=>b.onclick=()=>{
    const correct = b.dataset.vi===quizItem.vi;
    $$(".opt").forEach(x=>{ x.disabled=true;
      if(x.dataset.vi===quizItem.vi) x.classList.add("correct");
      else if(x===b) x.classList.add("wrong"); });
    progress.quizStats.total++; bumpStudy(quizItem.han); if(correct){progress.quizStats.correct++; progress.learned[quizItem.han]=true;}
    save(); $("#qScore").textContent = `${progress.quizStats.correct}/${progress.quizStats.total}`;
    setTimeout(nextQuiz, 900);
  });
}

/* ---------- Thi thử (timed exam) ---------- */
let examState=null, examTimer=null;
RENDER.exam = () => {
  if(examState && examState.running){ drawExam(); return; }
  $("#view").innerHTML=`
    <h2 class="section-h">🎯 Thi thử</h2>
    <p class="sub">Bài thi trắc nghiệm tính giờ. Chọn nghĩa đúng cho hán tự. Kỷ lục của bạn: <b>${progress.examBest||0}%</b></p>
    <div class="center-narrow">
      <div class="panel">
        <div class="toolbar" style="justify-content:center">
          <select id="exN"><option>10</option><option selected>20</option><option>30</option><option>50</option></select>
          <select id="exSec"><option value="10">10 giây/câu</option><option value="15" selected>15 giây/câu</option><option value="20">20 giây/câu</option><option value="0">Không giới hạn</option></select>
          <select id="exSrc"><option value="all">Tất cả từ</option><option value="hsk">HSK có sẵn</option><option value="mywords">Thư viện của tôi</option></select>
          <button class="btn primary" id="exStart">Bắt đầu thi</button>
        </div>
        <p class="sub" style="text-align:center;margin-top:8px">Hết giờ sẽ tự nộp. Sau khi thi có thể xem lại các câu sai.</p>
      </div>
    </div>`;
  $("#exStart").onclick=startExam;
};
function startExam(){
  const n=parseInt($("#exN").value)||20, sec=parseInt($("#exSec").value), src=$("#exSrc").value;
  const pool=(src==="mywords"?progress.myWords:src==="hsk"?D.vocab:allVocab()).filter(v=>v.vi&&v.han);
  if(pool.length<4){ toast("Không đủ từ để thi"); return; }
  const qs=shuffle(pool).slice(0,Math.min(n,pool.length)).map(q=>{
    const opts=shuffle([q, ...shuffle(pool.filter(v=>v.vi!==q.vi)).slice(0,3)]);
    return {q, opts, answer:null};
  });
  examState={qs, idx:0, running:true, secPer:sec, timeLeft: sec? sec*qs.length : 0, startTs:Date.now()};
  if(sec){ clearInterval(examTimer); examTimer=setInterval(examTick,1000); }
  drawExam();
}
function examTick(){
  if(!examState||!examState.running) return;
  examState.timeLeft--;
  const el=$("#exTime"); if(el) el.textContent=fmtTime(examState.timeLeft);
  if(examState.timeLeft<=0){ finishExam(); }
}
function fmtTime(s){ s=Math.max(0,s); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
function drawExam(){
  const st=examState, cur=st.qs[st.idx];
  const answered=st.qs.filter(x=>x.answer!=null).length;
  $("#view").innerHTML=`
    <h2 class="section-h">🎯 Thi thử</h2>
    <div class="center-narrow">
      <div class="toolbar" style="justify-content:space-between;align-items:center">
        <span class="chip">Câu ${st.idx+1}/${st.qs.length}</span>
        ${st.secPer?`<span class="chip" id="exTimeWrap" style="background:var(--brand);color:#fff">⏱ <b id="exTime">${fmtTime(st.timeLeft)}</b></span>`:`<span class="chip">Không giới hạn</span>`}
        <span class="sub">${answered}/${st.qs.length} đã trả lời</span>
      </div>
      <div class="progress-bar"><i style="width:${(st.idx)/st.qs.length*100}%"></i></div>
      <div class="panel" style="text-align:center">
        <div class="quiz-q">Hán tự này nghĩa là gì?</div>
        <div class="quiz-han">${esc(cur.q.han)}</div>
        <div class="quiz-q">${esc(cur.q.pinyin)} · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(cur.q.han))}</span> <span class="audio-btn" onclick="speak('${esc(cur.q.han)}')">🔊</span></div>
        <div style="margin-top:14px">${cur.opts.map(o=>`<button class="opt ${cur.answer===o.vi?'chosen':''}" data-vi="${esc(o.vi)}">${esc(o.vi)}</button>`).join("")}</div>
      </div>
      <div class="toolbar" style="justify-content:space-between">
        <button class="btn" id="exPrev" ${st.idx===0?'disabled':''}>‹ Câu trước</button>
        ${st.idx===st.qs.length-1?`<button class="btn primary" id="exSubmit">Nộp bài ✓</button>`:`<button class="btn primary" id="exNext">Câu sau ›</button>`}
        <button class="btn" id="exQuit" style="border-color:var(--brand)">Thoát</button>
      </div>
    </div>`;
  $$(".opt").forEach(b=>b.onclick=()=>{ cur.answer=b.dataset.vi; bumpStudy(cur.q.han);
    if(st.idx<st.qs.length-1){ st.idx++; drawExam(); } else drawExam(); });
  if($("#exNext")) $("#exNext").onclick=()=>{ st.idx=Math.min(st.qs.length-1,st.idx+1); drawExam(); };
  if($("#exPrev")) $("#exPrev").onclick=()=>{ st.idx=Math.max(0,st.idx-1); drawExam(); };
  if($("#exSubmit")) $("#exSubmit").onclick=finishExam;
  $("#exQuit").onclick=()=>{ if(confirm("Thoát bài thi? Kết quả sẽ không được lưu.")){ clearInterval(examTimer); examState=null; RENDER.exam(); } };
}
function finishExam(){
  clearInterval(examTimer);
  const st=examState; if(!st) return; st.running=false;
  const correct=st.qs.filter(x=>x.answer===x.q.vi).length;
  const pct=Math.round(correct/st.qs.length*100);
  const timeUsed=Math.round((Date.now()-st.startTs)/1000);
  if(pct>progress.examBest){ progress.examBest=pct; }
  save();
  const wrong=st.qs.filter(x=>x.answer!==x.q.vi);
  $("#view").innerHTML=`
    <h2 class="section-h">🎯 Kết quả thi thử</h2>
    <div class="center-narrow">
      <div class="panel" style="text-align:center">
        <div style="font-size:52px;font-weight:800;color:${pct>=80?'var(--ok)':pct>=50?'var(--warn)':'var(--brand)'}">${pct}%</div>
        <div class="sub">Đúng ${correct}/${st.qs.length} câu · thời gian ${fmtTime(timeUsed)} · kỷ lục ${progress.examBest}%</div>
        <div class="toolbar" style="justify-content:center;margin-top:12px">
          <button class="btn primary" id="exAgain">Thi lại</button>
          ${wrong.length?`<button class="btn" id="exReviewPlay">🔊 Nghe lại từ sai</button>`:""}
        </div>
      </div>
      ${wrong.length?`<div class="panel">
        <h3>❌ ${wrong.length} câu sai — xem lại</h3>
        <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>Hán tự</th><th>Pinyin/Âm bồi</th><th>Đáp án đúng</th><th>Bạn chọn</th><th></th></tr></thead><tbody>
        ${wrong.map(x=>`<tr>
          <td class="han-cell">${esc(x.q.han)}</td>
          <td>${pinAmbHTML(x.q.pinyin, x.q.han)}</td>
          <td style="color:var(--ok)">${esc(x.q.vi)}</td>
          <td style="color:var(--brand)">${esc(x.answer||"(bỏ trống)")}</td>
          <td><button class="mini" onclick="speak('${esc(x.q.han)}')">🔊</button></td>
        </tr>`).join("")}
        </tbody></table></div>
      </div>`:`<div class="panel" style="text-align:center"><h3>🎉 Hoàn hảo! Không có câu sai.</h3></div>`}
    </div>`;
  $("#exAgain").onclick=()=>{ examState=null; RENDER.exam(); };
  if($("#exReviewPlay")) $("#exReviewPlay").onclick=()=>Player.start(wrong.map(x=>({han:x.q.han,sub:x.q.vi,vi:x.q.vi})),{pauseMs:1100});
  examState=null;
}

/* ---------- Phrases ---------- */
let phraseTopic="";
RENDER.phrases = () => {
  const topics = [...new Set(D.phrases.map(p=>p.topic).filter(Boolean))];
  $("#view").innerHTML = `
    <h2 class="section-h">Khẩu ngữ thông dụng</h2>
    <p class="sub">Câu nói cửa miệng của người Trung theo tình huống.</p>
    <div class="chips" id="pChips">
      <span class="chip ${phraseTopic===''?'active':''}" data-t="">Tất cả</span>
      ${topics.map(t=>`<span class="chip ${phraseTopic===t?'active':''}" data-t="${esc(t)}">${esc(t)}</span>`).join("")}
    </div>
    <div class="play-all-row">
      <button class="btn primary" id="pPlayAll">▶ Đọc tất cả (trên xuống)</button>
      <span class="sub">Nghe tuần tự rảnh tay — tiện luyện nghe/nói khi lái xe.</span>
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>Chủ đề</th><th>Hán tự</th><th>Pinyin / Âm bồi</th><th>Nghĩa</th><th>Cách dùng</th><th></th>
    </tr></thead><tbody id="pBody"></tbody></table></div>`;
  $$("#pChips .chip").forEach(c=>c.onclick=()=>{phraseTopic=c.dataset.t; RENDER.phrases();});
  const list = D.phrases.filter(p=>!phraseTopic||p.topic===phraseTopic);
  $("#pBody").innerHTML = list.map(p=>`<tr>
    <td>${esc(p.topic)}</td>
    <td class="han-cell">${esc(p.han)}</td>
    <td>${pinAmbHTML(p.pinyin, p.han)}</td>
    <td>${esc(p.vi)}</td>
    <td style="color:var(--muted)">${esc(p.usage)}</td>
    <td style="white-space:nowrap"><button class="mini" onclick="speak('${esc(p.han)}')">🔊</button>
      <button class="mini" onclick="openYouglish('${esc(p.han)}')">🌐</button></td>
  </tr>`).join("");
  $("#pPlayAll").onclick=()=>Player.start(
    list.map(p=>({han:p.han, sub:p.vi, vi:p.vi})),
    {label:"Khẩu ngữ", pauseMs:1100, onItem:it=>{}});
};

/* ---------- Business ---------- */
RENDER.biz = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">Từ vựng Thương mại</h2>
    <p class="sub">Thuật ngữ kinh doanh · có kèm tiếng Anh và số bài.</p>
    <div class="toolbar"><input class="txt" id="bizQ" placeholder="Tìm từ..."><span class="count-pill" id="bizCount"></span></div>
    <div class="play-all-row">
      <button class="btn primary" id="bizPlayAll">▶ Đọc tất cả (trên xuống)</button>
      <span class="sub">Nghe tuần tự rảnh tay — tiện luyện nghe/nói khi lái xe.</span>
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>#</th><th>Hán tự</th><th>Pinyin / Âm bồi</th><th>Loại</th><th>English</th><th>Tiếng Việt</th><th>Bài</th><th></th>
    </tr></thead><tbody id="bizBody"></tbody></table></div>`;
  let curList=[];
  const draw = ()=>{
    const q=($("#bizQ").value||"").toLowerCase();
    const list = D.business.filter(b=>!q||(b.han+b.pinyin+b.en+b.vi).toLowerCase().includes(q));
    curList=list;
    $("#bizCount").textContent=`${list.length} từ`;
    $("#bizBody").innerHTML = list.map(b=>`<tr>
      <td>${esc(b.stt)}</td><td class="han-cell">${esc(b.han)}</td><td>${pinAmbHTML(b.pinyin, b.han)}</td>
      <td style="color:var(--muted)">${esc(b.pos)}</td><td>${esc(b.en)}</td><td>${esc(b.vi)}</td>
      <td>${esc(b.lesson)}</td><td style="white-space:nowrap"><button class="mini" onclick="speak('${esc(b.han)}')">🔊</button>
      <button class="mini" onclick="openYouglish('${esc(b.han)}')">🌐</button></td>
    </tr>`).join("");
  };
  $("#bizQ").oninput = draw; draw();
  $("#bizPlayAll").onclick=()=>Player.start(
    curList.map(b=>({han:b.han, sub:b.vi||b.en, vi:b.vi||b.en})),
    {label:"Thương mại", pauseMs:1000});
};

/* ---------- Source sentences ---------- */
let sentSource="";
RENDER.sents = () => {
  const sources = [...new Set(D.sentences.map(s=>s.source).filter(Boolean))];
  $("#view").innerHTML = `
    <h2 class="section-h">Câu nguồn (NLM)</h2>
    <p class="sub">Kho ${D.sentences.length} câu mẫu trích từ các tài liệu PDF gốc.</p>
    <div class="toolbar">
      <select id="sSource"><option value="">Tất cả nguồn</option>
        ${sources.map(s=>`<option ${sentSource===s?'selected':''}>${esc(s)}</option>`).join("")}</select>
      <input class="txt" id="sQ" placeholder="Tìm trong câu...">
      <span class="count-pill" id="sCount"></span>
    </div>
    <div class="play-all-row">
      <button class="btn primary" id="sPlayAll">▶ Đọc tất cả (trên xuống)</button>
      <span class="sub">Nghe tuần tự rảnh tay khi lái xe (tối đa 100 câu đầu).</span>
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>Nguồn</th><th>Hán tự</th><th>Pinyin &amp; Nghĩa</th><th></th>
    </tr></thead><tbody id="sBody"></tbody></table></div>`;
  let curList=[];
  const draw=()=>{
    const src=$("#sSource").value, q=($("#sQ").value||"").toLowerCase();
    let list = D.sentences.filter(s=>(!src||s.source===src) && (!q||(s.han+s.meaning).toLowerCase().includes(q)));
    curList=list;
    $("#sCount").textContent=`${list.length} câu`;
    $("#sBody").innerHTML = list.slice(0,400).map(s=>`<tr>
      <td style="color:var(--muted);font-size:12px">${esc(s.source)}</td>
      <td class="han-cell" style="font-size:17px">${esc(s.han)}
        <div class="pin-cell" style="font-size:12.5px;font-weight:400">${esc(toPinyin(s.han))}</div>
        <div class="amboi-line">🗣️ ${esc(amBoiForHan(s.han))}</div></td>
      <td>${esc(s.meaning)}</td>
      <td style="white-space:nowrap"><button class="mini" onclick="speak('${esc(s.han)}')">🔊</button>
        <button class="mini" onclick="openYouglish('${esc(s.han)}')">🌐</button></td>
    </tr>`).join("") + (list.length>400?`<tr><td colspan="4" class="sub">Hiển thị 400/${list.length} câu — lọc thêm để xem.</td></tr>`:"");
  };
  $("#sSource").onchange=e=>{sentSource=e.target.value;draw();};
  $("#sQ").oninput=draw; draw();
  $("#sPlayAll").onclick=()=>Player.start(
    curList.slice(0,100).map(s=>({han:s.han, sub:s.meaning, vi:s.meaning})),
    {label:"Câu nguồn", pauseMs:1300});
};

/* ---------- Subtitle → Pinyin tool ---------- */
function toPinyin(text){
  let out="";
  for(const ch of text){ out += (D.charPinyin[ch] ? D.charPinyin[ch] : ch); if(D.charPinyin[ch]) out+=" "; }
  return out.trim();
}
function isWord(w){ return D.seg[w] || D.gloss[w]; }
function segment(line){
  // forward maximum matching against jieba dict (D.seg) + user gloss
  const maxLen=4; const tokens=[];
  let i=0;
  while(i<line.length){
    const ch=line[i];
    if(!D.charPinyin[ch]){ // non-hanzi: group run
      let j=i; while(j<line.length && !D.charPinyin[line[j]]) j++;
      const t=line.slice(i,j).trim(); if(t) tokens.push({w:line.slice(i,j),other:true}); i=j; continue;
    }
    let matched=null;
    for(let L=Math.min(maxLen,line.length-i); L>=2; L--){
      const cand=line.slice(i,i+L);
      if(isWord(cand)){ matched=cand; break; }
    }
    if(matched){ tokens.push({w:matched}); i+=matched.length; }
    else { tokens.push({w:ch}); i++; }
  }
  return tokens;
}
RENDER.subtitle = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">Phụ đề → Pinyin &amp; Nghĩa</h2>
    <p class="sub">Dán chữ Hán (mỗi dòng 1 câu). App tự tách từ, gắn pinyin và nghĩa Việt có trong kho từ của bạn.</p>
    <div class="panel">
      <textarea class="ta" id="subIn" placeholder="Ví dụ:&#10;今天天气很好。&#10;你们常去哪吃午饭？"></textarea>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn primary" id="subGo">▶ Xử lý</button>
        <button class="btn" id="subSample">Dán câu mẫu</button>
        <button class="btn" id="subClear">Xóa</button>
        <a class="btn" id="subGT" target="_blank" rel="noopener">🌐 Dịch cả đoạn (Google)</a>
      </div>
    </div>
    <div id="subOut"></div>
    <p class="sub">💡 Pinyin lấy offline từ từ điển ~42.000 chữ. Nghĩa Việt hiển thị khi từ có trong kho; với câu hoàn chỉnh, dùng nút Google Translate.</p>`;
  const sample="今天天气很好。\n你们常去哪吃午饭？\n这个价格合理吗？";
  $("#subSample").onclick=()=>{ $("#subIn").value=sample; };
  $("#subClear").onclick=()=>{ $("#subIn").value=""; $("#subOut").innerHTML=""; };
  const run=()=>{
    const text=$("#subIn").value.trim();
    $("#subGT").href = "https://translate.google.com/?sl=zh-CN&tl=vi&op=translate&text="+encodeURIComponent(text);
    if(!text){ $("#subOut").innerHTML=""; return; }
    const lines=text.split(/\n+/).filter(Boolean);
    $("#subOut").innerHTML = `<div class="panel">` + lines.map(line=>{
      const toks=segment(line);
      const anno=toks.map(t=>{
        if(t.other) return `<span class="tok" style="background:transparent;border:none"><span class="th">${esc(t.w)}</span></span>`;
        const g=D.gloss[t.w];
        const pin = g?g.p:toPinyin(t.w);
        const vi = g?g.v:"";
        return `<span class="tok ${g?'known':''}" onclick="speak('${esc(t.w)}')" title="Nhấn để nghe">
          <span class="tp">${esc(pin)}</span><span class="th">${esc(t.w)}</span>
          <span class="tp" style="color:var(--warn)">${esc(amBoiForHan(t.w))}</span>
          ${vi?`<span class="tv">${esc(vi)}</span>`:""}</span>`;
      }).join("");
      return `<div class="sent-line">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
          <button class="mini" onclick="speak('${esc(line)}')">🔊</button>
          <span class="pin-cell">${esc(toPinyin(line))}</span>
        </div>
        <div class="anno">${anno}</div>
      </div>`;
    }).join("") + `</div>`;
  };
  $("#subGo").onclick=run;
};

/* ---------- Listening practice ---------- */
let listenMode="word", listenItem=null;
RENDER.listen = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">🎧 Luyện nghe</h2>
    <p class="sub">Nghe trước — hiểu sau. Có chế độ nghe liên tục rảnh tay, ghép câu chuyện, và kiểm tra viết/nói.</p>
    <div class="chips">
      <span class="chip ${listenMode==='word'?'active':''}" data-m="word">🔤 Nghe → chọn nghĩa</span>
      <span class="chip ${listenMode==='char'?'active':''}" data-m="char">🀄 Nghe → chọn hán tự</span>
      <span class="chip ${listenMode==='sentence'?'active':''}" data-m="sentence">📄 Nghe câu → đáp án</span>
      <span class="chip ${listenMode==='continuous'?'active':''}" data-m="continuous">🔁 Nghe liên tục</span>
      <span class="chip ${listenMode==='story'?'active':''}" data-m="story">📖 Câu chuyện</span>
      <span class="chip ${listenMode==='write'?'active':''}" data-m="write">✍️ Nghe → viết</span>
      <span class="chip ${listenMode==='speak'?'active':''}" data-m="speak">🎤 Nghe → nói lại</span>
    </div>
    <p class="sub">Điểm nghe: <b id="lScore">${progress.listenStats.correct}/${progress.listenStats.total}</b></p>
    <div class="center-narrow"><div id="lArea"></div></div>`;
  $$(".chip[data-m]").forEach(c=>c.onclick=()=>{listenMode=c.dataset.m; RENDER.listen();});
  ({sentence:nextListenSentence, continuous:listenContinuous, story:listenStory,
    write:nextListenWrite, speak:nextListenSpeak}[listenMode] || nextListenWord)();
};

/* nghe liên tục (playlist rảnh tay) */
function listenContinuous(){
  const levels=[...new Set(D.vocab.map(v=>v.level))].sort();
  const topics=[...new Set(D.vocab.map(v=>v.topic).filter(Boolean))];
  $("#lArea").innerHTML=`
    <div class="panel">
      <div class="quiz-q" style="margin-bottom:10px">🔁 Nghe liên tục — phát lần lượt, rảnh tay (hợp khi lái xe)</div>
      <div class="toolbar">
        <select id="lcType"><option value="vocab">Từ vựng</option><option value="phrase">Khẩu ngữ</option><option value="sentence">Câu nguồn</option><option value="mywords">Từ tôi tự thêm</option></select>
        <select id="lcLevel"><option value="">Mọi cấp độ</option>${levels.map(l=>`<option>${esc(l)}</option>`).join("")}</select>
        <select id="lcTopic"><option value="">Mọi chủ đề</option>${topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
        <select id="lcSort"><option value="freqAsc">Nghe ít nhất trước</option><option value="freqDesc">Nghe nhiều nhất trước</option><option value="shuffle">Xáo trộn</option></select>
        <label class="sub">Số lượng <input class="txt" id="lcN" type="number" value="20" min="5" max="200" style="width:66px"></label>
        <label class="sub">Nghỉ (giây) <input class="txt" id="lcGap" type="number" value="1.2" min="0.3" max="5" step="0.1" style="width:66px"></label>
        <button class="btn primary" id="lcStart">▶ Phát</button>
      </div>
      <p class="sub">Ưu tiên "nghe ít nhất" để cân bằng ôn tập. Bật 🔁 trên thanh phát để lặp cả danh sách.</p>
      <div id="lcList" style="margin-top:8px"></div>
    </div>`;
  $("#lcStart").onclick=()=>{
    const type=$("#lcType").value, lvl=$("#lcLevel").value, top=$("#lcTopic").value, sort=$("#lcSort").value;
    const n=parseInt($("#lcN").value)||20, gap=Math.round((parseFloat($("#lcGap").value)||1.2)*1000);
    let items=[];
    if(type==="vocab") items=allVocab().filter(v=>(!lvl||v.level===lvl)&&(!top||v.topic===top)).map(v=>({han:v.han,sub:v.pinyin+" · "+v.vi,vi:v.vi}));
    else if(type==="mywords") items=progress.myWords.map(v=>({han:v.han,sub:v.vi,vi:v.vi}));
    else if(type==="phrase") items=D.phrases.map(p=>({han:p.han,sub:p.vi,vi:p.vi}));
    else items=D.sentences.map(s=>({han:s.han,sub:s.meaning,vi:s.meaning}));
    if(sort==="freqAsc") items.sort((a,b)=>pc(a.han)-pc(b.han));
    else if(sort==="freqDesc") items.sort((a,b)=>pc(b.han)-pc(a.han));
    else items=shuffle(items);
    items=items.slice(0,n);
    if(!items.length){ toast("Không có mục nào phù hợp"); return; }
    $("#lcList").innerHTML=items.map((it,i)=>`<div class="sent-line" id="lc-${i}">
      <span class="han-cell">${esc(it.han)}</span> · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(it.han))}</span> · <span class="sub">${esc(it.sub)}</span></div>`).join("");
    Player.start(items,{pauseMs:gap, onItem:(it,i)=>{
      $$(".sent-line",$("#lcList")).forEach(el=>el.style.background="");
      const el=$("#lc-"+i); if(el){ el.style.background="var(--panel2)"; el.scrollIntoView({block:"center",behavior:"smooth"}); }
    }});
  };
}

/* ghép câu chuyện từ ví dụ của nhóm từ (offline) + nghe liên tục */
function listenStory(){
  const topics=[...new Set(D.vocab.map(v=>v.topic).filter(Boolean))];
  $("#lArea").innerHTML=`
    <div class="panel">
      <div class="quiz-q" style="margin-bottom:10px">📖 Câu chuyện — ghép các câu ví dụ của một nhóm từ thành đoạn để nghe &amp; đọc</div>
      <div class="toolbar">
        <select id="stTopic">${topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
        <label class="sub">Số câu <input class="txt" id="stN" type="number" value="8" min="3" max="20" style="width:60px"></label>
        <button class="btn primary" id="stGen">Ghép câu ví dụ</button>
        <button class="btn" id="stAI">✨ Tạo truyện bằng AI (ChatGPT)</button>
      </div>
      <p class="sub">Ghép từ câu ví dụ có sẵn (offline), hoặc dùng ChatGPT tạo truyện mạch lạc (cần API key ở ⚙️ Cài đặt).</p>
      <div id="stOut" style="margin-top:10px"></div>
    </div>`;
  const gen=()=>{
    const top=$("#stTopic").value, n=parseInt($("#stN").value)||8;
    const pool=D.vocab.filter(v=>v.topic===top && v.example);
    const picks=shuffle(pool).slice(0,n);
    if(!picks.length){ $("#stOut").innerHTML=`<p class="sub">Chủ đề này chưa có câu ví dụ.</p>`; return; }
    const items=picks.map(v=>({han:v.example, sub:(v.examplePinyin||"").split("\n").slice(1).join(" ")}));
    $("#stOut").innerHTML=`
      <div class="play-all-row"><button class="btn primary" id="stPlay">▶ Nghe cả đoạn</button>
        <span class="sub">Chủ đề: ${esc(top)} · ${picks.length} câu</span></div>
      ${picks.map((v,i)=>`<div class="sent-line" id="st-${i}">
        <div><span class="han-cell">${esc(v.example)}</span> <button class="mini" onclick="speak('${esc(v.example)}')">🔊</button></div>
        <div class="ep">${esc(v.examplePinyin)}</div>
        <div class="amboi-line">🗣️ ${esc(amBoiForHan(v.example))}</div>
      </div>`).join("")}`;
    $("#stPlay").onclick=()=>Player.start(items,{pauseMs:1300, onItem:(it,i)=>{
      $$(".sent-line",$("#stOut")).forEach(el=>el.style.background=""); const el=$("#st-"+i);
      if(el){el.style.background="var(--panel2)"; el.scrollIntoView({block:"center",behavior:"smooth"});}
    }});
    // stash for AI prompt
    listenStory._words=picks.map(v=>v.han+"("+v.vi+")").join("、");
  };
  $("#stGen").onclick=gen;
  $("#stAI").onclick=async ()=>{
    const words=listenStory._words||"";
    if(!words){ toast("Chọn chủ đề trước"); return; }
    if(!(progress.settings.openaiKey||"").trim()){
      const prompt=`Hãy viết một câu chuyện ngắn tiếng Trung (HSK sơ cấp) dùng các từ sau: ${words}. Sau đó cho pinyin và bản dịch tiếng Việt từng câu.`;
      navigator.clipboard?.writeText(prompt).then(()=>toast("Chưa có API key — đã copy lời nhắc, dán vào ChatGPT"),()=>{});
      window.open("https://chat.openai.com/","_blank"); return;
    }
    $("#stOut").innerHTML=`<p class="sub">✨ Đang tạo truyện bằng ChatGPT…</p>`;
    try{
      const text=await aiStory(words);
      renderAIStory(text);
    }catch(e){
      $("#stOut").innerHTML=`<p class="sub" style="color:var(--brand)">Lỗi gọi API: ${esc(e.message)}. Kiểm tra API key ở ⚙️ Cài đặt.</p>`;
    }
  };
  gen();
}
function renderAIStory(text){
  // parse 3-line blocks: 汉字 / 拼音 / Việt
  const lines=text.split(/\n/).map(l=>l.trim()).filter(Boolean);
  const items=[]; let cur={};
  lines.forEach(l=>{
    const m=l.match(/^(汉字|拼音|Việt|Viet|Pinyin|Hán tự)\s*[:：]\s*(.*)$/i);
    if(m){ const k=m[1].toLowerCase(); const val=m[2];
      if(/汉字|hán/.test(k)){ if(cur.han) {items.push(cur); cur={};} cur.han=val; }
      else if(/拼音|pinyin/.test(k)) cur.pin=val;
      else cur.vi=val;
    } else if(/[一-鿿]/.test(l)){ if(cur.han){items.push(cur);cur={};} cur.han=l; }
  });
  if(cur.han) items.push(cur);
  if(!items.length){ $("#stOut").innerHTML=`<div class="panel">${esc(text)}</div>`; return; }
  const playItems=items.map(it=>({han:it.han, sub:it.vi||"", vi:it.vi||""}));
  $("#stOut").innerHTML=`
    <div class="play-all-row"><button class="btn primary" id="stPlay">▶ Nghe cả truyện</button>
      <span class="sub">✨ Truyện do ChatGPT tạo · ${items.length} câu</span></div>
    ${items.map((it,i)=>`<div class="sent-line" id="st-${i}">
      <div><span class="han-cell">${esc(it.han)}</span> <button class="mini" onclick="speak('${esc(it.han)}')">🔊</button></div>
      <div class="ep">${esc(it.pin||toPinyin(it.han))}</div>
      <div class="amboi-line">🗣️ ${esc(amBoiForHan(it.han))}</div>
      ${it.vi?`<div style="margin-top:2px">${esc(it.vi)}</div>`:""}
    </div>`).join("")}`;
  $("#stPlay").onclick=()=>Player.start(playItems,{pauseMs:1300, onItem:(it,i)=>{
    $$(".sent-line",$("#stOut")).forEach(el=>el.style.background=""); const el=$("#st-"+i);
    if(el){el.style.background="var(--panel2)"; el.scrollIntoView({block:"center",behavior:"smooth"});}
  }});
}

/* nghe rồi viết hán tự */
function nextListenWrite(){
  const pool=allVocab().filter(v=>v.han&&v.vi);
  const v=pool[Math.floor(Math.random()*pool.length)];
  $("#lArea").innerHTML=`
    <div class="panel" style="text-align:center">
      <div class="quiz-q">✍️ Nghe rồi viết lại hán tự</div>
      <div style="font-size:56px;margin:8px 0;cursor:pointer" id="lPlay">🔊</div>
      <div class="toolbar" style="justify-content:center"><button class="btn sm" id="lReplay">▶ Nghe lại</button><button class="btn sm" id="lSlow">🐢 Chậm</button></div>
      <input class="big-input" id="lwInput" placeholder="Viết hán tự nghe được..." autocomplete="off" style="margin-top:12px">
      <div class="toolbar" style="justify-content:center;margin-top:10px">
        <button class="btn primary" id="lwCheck">Kiểm tra</button>
        <button class="btn" id="lwNext">➡ Từ khác</button>
      </div>
      <div id="lwResult" style="margin-top:10px;font-size:16px"></div>
    </div>`;
  const play=(r)=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(v.han);u.lang="zh-CN";if(zhVoice)u.voice=zhVoice;u.rate=r;speechSynthesis.speak(u);};
  play(0.85);
  $("#lPlay").onclick=()=>play(0.85);$("#lReplay").onclick=()=>play(0.85);$("#lSlow").onclick=()=>play(0.5);
  $("#lwNext").onclick=nextListenWrite;
  const inp=$("#lwInput"); inp.focus();
  const check=()=>{
    const ok=inp.value.trim()===v.han;
    progress.listenStats.total++; bumpDaily("listen"); bumpStudy(v.han); if(ok){progress.listenStats.correct++; srsInit(v.han); progress.learned[v.han]=true;} save();
    $("#lScore").textContent=`${progress.listenStats.correct}/${progress.listenStats.total}`;
    $("#lwResult").innerHTML= ok
      ? `<span style="color:var(--ok);font-weight:700">✓ Chính xác!</span> <span class="han-cell">${esc(v.han)}</span> · ${esc(v.pinyin)} · <span style="color:var(--warn)">🗣️${esc(amBoiForHan(v.han))}</span> · ${esc(v.vi)}`
      : `<span style="color:var(--brand);font-weight:700">✗ Chưa đúng.</span> Đáp án: <span class="han-cell">${esc(v.han)}</span> · ${esc(v.pinyin)} · ${esc(v.vi)}`;
    if(ok) setTimeout(nextListenWrite,1400);
  };
  $("#lwCheck").onclick=check; inp.onkeydown=e=>{if(e.key==="Enter")check();};
}

/* nghe rồi nói lại (micro) */
function nextListenSpeak(){
  const pool=allVocab().filter(v=>v.han&&v.vi);
  const v=pool[Math.floor(Math.random()*pool.length)];
  $("#lArea").innerHTML=`
    <div class="panel" style="text-align:center">
      <div class="quiz-q">🎤 Nghe rồi nói lại cho đúng</div>
      <div style="font-size:52px;margin:8px 0;cursor:pointer" id="lPlay">🔊</div>
      <div class="toolbar" style="justify-content:center"><button class="btn sm" id="lReplay">▶ Nghe lại</button><button class="btn sm" id="lSlow">🐢 Chậm</button>
        <button class="btn sm" id="lReveal2">👁 Hiện chữ</button><button class="btn sm" id="lsNext">➡ Từ khác</button></div>
      <div id="lsHan" class="hidden" style="margin-top:10px"><span class="han-cell" style="font-size:30px">${esc(v.han)}</span> · ${esc(v.pinyin)} · <span style="color:var(--warn)">🗣️${esc(amBoiForHan(v.han))}</span> · ${esc(v.vi)}</div>
      <div id="lsMic" style="margin-top:14px"></div>
    </div>`;
  const play=(r)=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(v.han);u.lang="zh-CN";if(zhVoice)u.voice=zhVoice;u.rate=r;speechSynthesis.speak(u);};
  play(0.85);
  $("#lPlay").onclick=()=>play(0.85);$("#lReplay").onclick=()=>play(0.85);$("#lSlow").onclick=()=>play(0.5);
  $("#lReveal2").onclick=()=>$("#lsHan").classList.toggle("hidden");
  $("#lsNext").onclick=nextListenSpeak;
  speakTestWidget("#lsMic", v.han, ok=>{ progress.listenStats.total++; bumpDaily("listen"); bumpStudy(v.han); if(ok){progress.listenStats.correct++;srsInit(v.han);progress.learned[v.han]=true;} save(); $("#lScore").textContent=`${progress.listenStats.correct}/${progress.listenStats.total}`; });
}
function nextListenWord(){
  const pool=allVocab().filter(v=>v.vi&&v.han);
  listenItem=pool[Math.floor(Math.random()*pool.length)];
  const byMeaning = listenMode==="word";
  const distract=shuffle(pool.filter(v=>(byMeaning?v.vi!==listenItem.vi:v.han!==listenItem.han))).slice(0,3);
  const opts=shuffle([listenItem,...distract]);
  $("#lArea").innerHTML=`
    <div class="panel" style="text-align:center">
      <div class="quiz-q">🎧 Nghe và chọn ${byMeaning?'nghĩa đúng':'hán tự đúng'}</div>
      <div style="font-size:64px;margin:10px 0;cursor:pointer" id="lPlay" title="Nghe lại">🔊</div>
      <div class="toolbar" style="justify-content:center;margin-bottom:6px">
        <button class="btn sm" id="lReplay">▶ Nghe lại</button>
        <button class="btn sm" id="lSlow">🐢 Chậm</button>
      </div>
      <div>${opts.map(o=>`<button class="opt" data-key="${esc(byMeaning?o.vi:o.han)}">${byMeaning?esc(o.vi):`<span class="han-cell">${esc(o.han)}</span>`}</button>`).join("")}</div>
    </div>`;
  const play=(rate)=>{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(listenItem.han); u.lang="zh-CN"; if(zhVoice)u.voice=zhVoice; u.rate=rate; speechSynthesis.speak(u); };
  play(0.85);
  $("#lPlay").onclick=()=>play(0.85); $("#lReplay").onclick=()=>play(0.85); $("#lSlow").onclick=()=>play(0.5);
  const key = byMeaning?listenItem.vi:listenItem.han;
  $$(".opt").forEach(b=>b.onclick=()=>{
    const ok=b.dataset.key===key;
    $$(".opt").forEach(x=>{x.disabled=true;
      if(x.dataset.key===key)x.classList.add("correct"); else if(x===b)x.classList.add("wrong");});
    progress.listenStats.total++; bumpDaily("listen"); bumpStudy(listenItem.han); if(ok){progress.listenStats.correct++; srsInit(listenItem.han); progress.learned[listenItem.han]=true;}
    save(); $("#lScore").textContent=`${progress.listenStats.correct}/${progress.listenStats.total}`;
    // reveal
    b.insertAdjacentHTML("afterend",`<div class="sub" style="margin-top:8px"><span class="han-cell">${esc(listenItem.han)}</span> · <span class="pin-cell">${esc(listenItem.pinyin)}</span> · <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(listenItem.han))}</span> · ${esc(listenItem.vi)} <button class="mini" onclick="openYouglish('${esc(listenItem.han)}')">🌐</button></div>`);
    setTimeout(nextListenWord,1300);
  });
}
function nextListenSentence(){
  const s=D.sentences[Math.floor(Math.random()*D.sentences.length)];
  $("#lArea").innerHTML=`
    <div class="panel" style="text-align:center">
      <div class="quiz-q">🎧 Nghe câu — cố nghe hiểu rồi hiện đáp án</div>
      <div style="font-size:56px;margin:10px 0;cursor:pointer" id="lPlay">🔊</div>
      <div class="toolbar" style="justify-content:center">
        <button class="btn sm" id="lReplay">▶ Nghe lại</button>
        <button class="btn sm" id="lSlow">🐢 Chậm</button>
        <button class="btn primary sm" id="lShow">👁 Hiện đáp án</button>
        <button class="btn sm" id="lNext">➡ Câu khác</button>
      </div>
      <div id="lReveal" style="margin-top:14px"></div>
    </div>`;
  const play=(rate)=>{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(s.han); u.lang="zh-CN"; if(zhVoice)u.voice=zhVoice; u.rate=rate; speechSynthesis.speak(u); };
  play(0.85);
  $("#lPlay").onclick=()=>play(0.85); $("#lReplay").onclick=()=>play(0.85); $("#lSlow").onclick=()=>play(0.5);
  $("#lNext").onclick=nextListenSentence;
  $("#lShow").onclick=()=>{ $("#lReveal").innerHTML=`
    <div class="example-box"><div class="eh">${esc(s.han)}</div>
    <div class="ep">${esc(toPinyin(s.han))}</div>
    <div style="margin-top:6px">${esc(s.meaning)}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:6px">Nguồn: ${esc(s.source)}</div></div>`;
  };
}

/* ---------- Thêm nguồn từ vựng (đa nguồn → room tạm → thư viện) ---------- */
const FUNCTION_WORDS = new Set("的了是我你他她它们这那个不在有和也就都要会吗呢吧啊一之与及等着过被把让给对从向往还又再吧嘛哦呀哈嗯么怎什么么样们儿".split(""));
function ytId(url){
  const m = (url||"").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m?m[1]:null;
}
// dynamic loaders (online only)
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("Không tải được "+src)); document.head.appendChild(s); }); }
async function loadPdfJs(){
  if(window.pdfjsLib) return window.pdfjsLib;
  const lib=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.mjs");
  lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs";
  window.pdfjsLib=lib; return lib;
}
async function loadTesseract(){ if(window.Tesseract) return window.Tesseract; await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"); return window.Tesseract; }

let srcTab="text", staging=null;   // staging = {source, items:[{han,freq,pinyin,vi,status,checked}], filters}
RENDER.video = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">➕ Thêm nguồn từ vựng</h2>
    <p class="sub">Nạp từ nhiều nguồn → app đưa vào <b>Room tạm</b> để lọc trùng & lọc cơ bản → bạn xác nhận đưa vào <b>Thư viện keyword</b>.</p>

    <div class="chips" id="srcTabs">
      <span class="chip ${srcTab==='text'?'active':''}" data-s="text">📝 Đoạn text</span>
      <span class="chip ${srcTab==='youtube'?'active':''}" data-s="youtube">▶️ YouTube</span>
      <span class="chip ${srcTab==='reel'?'active':''}" data-s="reel">📱 Reel Facebook</span>
      <span class="chip ${srcTab==='pdf'?'active':''}" data-s="pdf">📄 File PDF</span>
      <span class="chip ${srcTab==='image'?'active':''}" data-s="image">🖼️ Hình ảnh (OCR)</span>
    </div>

    <div class="panel" id="srcInput"></div>

    <div class="panel">
      <div class="toolbar">
        <label class="sub">🔢 Số từ tối đa <input class="txt" id="vMax" type="number" value="40" min="1" max="300" style="width:70px"></label>
        <label class="sub">✂️ Độ dài tối thiểu <input class="txt" id="vMin" type="number" value="2" min="1" max="4" style="width:60px"></label>
        <label class="chip active" id="vFunc">🚫 Bỏ hư từ</label>
        <span class="sub">Các bộ lọc áp dụng khi trích. Trùng với thư viện sẽ tự đánh dấu bỏ qua.</span>
      </div>
    </div>

    <div id="srcStaging"></div>

    <div class="panel">
      <h3>📦 Các Room đã lưu (${progress.rooms.length})</h3>
      <div id="vRooms"></div>
    </div>`;
  window._removeFunc = true;
  $("#vFunc").onclick=e=>{window._removeFunc=!window._removeFunc; e.target.classList.toggle("active",window._removeFunc);};
  $$("#srcTabs .chip").forEach(c=>c.onclick=()=>{srcTab=c.dataset.s; RENDER.video();});
  drawSourceInput();
  renderStaging();
  drawRooms();
};
function srcOpts(){ return {maxN:parseInt($("#vMax").value)||40, minLen:parseInt($("#vMin").value)||2, removeFunc:window._removeFunc}; }
function drawSourceInput(){
  const box=$("#srcInput"); if(!box) return;
  if(srcTab==="text"){
    box.innerHTML=`<h3>📝 Dán đoạn văn bản tiếng Trung</h3>
      <textarea class="ta" id="sIn" placeholder="Dán đoạn chữ Hán bất kỳ..."></textarea>
      <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="sGo">▶ Trích từ → Room tạm</button></div>`;
    $("#sGo").onclick=()=>stageFromText($("#sIn").value, "text");
  }
  else if(srcTab==="youtube"){
    box.innerHTML=`<h3>▶️ YouTube</h3>
      <div class="toolbar"><input class="txt" id="ytUrl" style="flex:1;min-width:220px" placeholder="🔗 Dán link YouTube..."><button class="btn" id="ytLoad">Xem</button><button class="btn" id="ytSaveLink">📎 Lưu vào Tài liệu</button></div>
      <div id="ytPlayer" style="margin-top:10px"></div>
      <details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">📄 Cách lấy phụ đề (bấm xem)</summary>
        <div style="line-height:1.7;margin-top:6px">1) Trên YouTube (máy tính): dưới video → <b>...→ Hiển thị bản chép lời</b> → chọn &amp; copy chữ Hán.<br>
        2) Hoặc dùng <a href="https://downsub.com" target="_blank" rel="noopener">downsub.com</a>.<br>
        3) Hoặc chạy script <code>HA_video.py "&lt;link&gt;"</code> đã có sẵn trong thư mục.<br>Sau đó dán phụ đề vào ô dưới.</div></details>
      <textarea class="ta" id="sIn" style="margin-top:10px" placeholder="Dán phụ đề chữ Hán vào đây..."></textarea>
      <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="sGo">▶ Trích từ → Room tạm</button></div>`;
    $("#ytLoad").onclick=()=>{ const id=ytId($("#ytUrl").value); if(!id){toast("Link không hợp lệ");return;}
      $("#ytPlayer").innerHTML=`<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden"><iframe src="https://www.youtube.com/embed/${id}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allowfullscreen allow="autoplay;encrypted-media;picture-in-picture"></iframe></div>`; };
    $("#ytSaveLink").onclick=()=>saveQuickLink($("#ytUrl").value, "Video học");
    $("#sGo").onclick=()=>stageFromText($("#sIn").value, "youtube");
  }
  else if(srcTab==="reel"){
    box.innerHTML=`<h3>📱 Reel / Video Facebook</h3>
      <div class="toolbar"><input class="txt" id="fbUrl" style="flex:1;min-width:220px" placeholder="🔗 Dán link reel/video Facebook (công khai)..."><button class="btn" id="fbLoad">Xem thử</button><button class="btn" id="fbSaveLink">📎 Lưu vào Tài liệu</button></div>
      <div id="fbPlayer" style="margin-top:10px"></div>
      <p class="sub" style="margin-top:8px">⚠️ Facebook không cho lấy phụ đề tự động. Hãy bật phụ đề khi xem reel, gõ/chép lại lời thoại chữ Hán rồi dán vào ô dưới (hoặc dùng caption bài viết).</p>
      <textarea class="ta" id="sIn" placeholder="Dán/gõ lời thoại hoặc caption chữ Hán..."></textarea>
      <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="sGo">▶ Trích từ → Room tạm</button></div>`;
    $("#fbLoad").onclick=()=>{ const u=$("#fbUrl").value.trim(); if(!/facebook\.com|fb\.watch/.test(u)){toast("Link Facebook không hợp lệ");return;}
      $("#fbPlayer").innerHTML=`<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false&width=560" style="width:100%;max-width:560px;height:315px;border:0;overflow:hidden" scrolling="no" allowfullscreen allow="autoplay;encrypted-media;picture-in-picture"></iframe><p class="sub">Nếu không hiện, reel để ở chế độ riêng tư hoặc FB chặn nhúng — bạn vẫn có thể gõ lời thoại vào ô dưới.</p>`; };
    $("#fbSaveLink").onclick=()=>saveQuickLink($("#fbUrl").value, "Video học");
    $("#sGo").onclick=()=>stageFromText($("#sIn").value, "reel");
  }
  else if(srcTab==="pdf"){
    box.innerHTML=`<h3>📄 File PDF (đọc chữ Hán từ PDF dạng text)</h3>
      <input type="file" id="pdfFile" accept="application/pdf">
      <div id="pdfStatus" class="sub" style="margin-top:8px"></div>
      <p class="sub">⚠️ Chỉ đọc được PDF có <b>lớp chữ</b> (text). PDF scan/ảnh cần OCR — dùng tab 🖼️ Hình ảnh hoặc script Python. Cần kết nối mạng để tải bộ đọc PDF lần đầu.</p>`;
    $("#pdfFile").onchange=async e=>{
      const f=e.target.files[0]; if(!f) return;
      $("#pdfStatus").textContent="Đang đọc PDF…";
      try{
        const lib=await loadPdfJs();
        const buf=await f.arrayBuffer();
        const pdf=await lib.getDocument({data:buf}).promise;
        let text="";
        for(let p=1;p<=pdf.numPages;p++){ const page=await pdf.getPage(p); const c=await page.getTextContent(); text+=c.items.map(i=>i.str).join("")+"\n"; }
        $("#pdfStatus").textContent=`Đã đọc ${pdf.numPages} trang. Đang trích từ…`;
        stageFromText(text, "pdf:"+f.name);
      }catch(err){ $("#pdfStatus").innerHTML=`<span style="color:var(--brand)">Lỗi: ${esc(err.message)}. Nếu offline, hãy kết nối mạng; nếu PDF là ảnh scan, dùng OCR.</span>`; }
    };
  }
  else if(srcTab==="image"){
    box.innerHTML=`<h3>🖼️ Hình ảnh (OCR nhận chữ Hán)</h3>
      <input type="file" id="imgFile" accept="image/*">
      <div id="imgPrev" style="margin-top:10px"></div>
      <div id="imgStatus" class="sub" style="margin-top:8px"></div>
      <p class="sub">⚠️ OCR tải bộ nhận dạng tiếng Trung (~vài MB) lần đầu — cần mạng, có thể mất 10–30 giây. Ảnh rõ nét cho kết quả tốt hơn.</p>`;
    $("#imgFile").onchange=async e=>{
      const f=e.target.files[0]; if(!f) return;
      const url=URL.createObjectURL(f);
      $("#imgPrev").innerHTML=`<img src="${url}" style="max-width:100%;max-height:260px;border-radius:10px">`;
      $("#imgStatus").textContent="Đang tải OCR & nhận dạng…";
      try{
        const T=await loadTesseract();
        const {data}=await T.recognize(f, "chi_sim", {logger:m=>{ if(m.status==="recognizing text") $("#imgStatus").textContent=`Nhận dạng… ${Math.round(m.progress*100)}%`; }});
        $("#imgStatus").textContent="Xong OCR. Đang trích từ…";
        stageFromText(data.text||"", "image:"+f.name);
      }catch(err){ $("#imgStatus").innerHTML=`<span style="color:var(--brand)">Lỗi OCR: ${esc(err.message)}. Cần kết nối mạng.</span>`; }
    };
  }
}
function stageFromText(text, source){
  text=(text||"").trim();
  if(!text){ toast("Chưa có nội dung"); return; }
  const {maxN,minLen,removeFunc}=srcOpts();
  const freq=new Map();
  text.split(/\n+/).forEach(line=>segment(line).forEach(t=>{
    if(t.other) return; const w=t.w;
    if(removeFunc && w.length===1 && FUNCTION_WORDS.has(w)) return;
    if([...w].length<minLen) return;
    if(![...w].every(ch=>D.charPinyin[ch])) return;
    freq.set(w,(freq.get(w)||0)+1);
  }));
  const all=[...freq.entries()].sort((a,b)=>b[1]-a[1]);
  const newOnes=all.filter(([w])=>!inLibrary(w)).slice(0,maxN);
  const dupCount=all.length-all.filter(([w])=>!inLibrary(w)).length;
  staging={source, dupCount, items:newOnes.map(([w,f])=>{ const g=D.gloss[w];
    return {han:w, freq:f, pinyin:g?g.p:toPinyin(w), vi:g?g.v:"", checked:true}; })};
  renderStaging();
  $("#srcStaging").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderStaging(){
  const box=$("#srcStaging"); if(!box) return;
  if(!staging || !staging.items.length){ box.innerHTML= staging?`<div class="panel"><p class="sub">Không tìm thấy từ mới (mọi từ đã có trong thư viện hoặc bị lọc). Đã bỏ qua ${staging.dupCount||0} từ trùng.</p></div>`:""; return; }
  const chk=staging.items.filter(i=>i.checked).length;
  box.innerHTML=`<div class="panel" style="border:2px solid var(--brand)">
    <h3>🧪 Room tạm — kiểm duyệt trước khi vào thư viện</h3>
    <p class="sub">Nguồn: <b>${esc(staging.source)}</b> · ${staging.items.length} từ mới · đã tự bỏ ${staging.dupCount||0} từ trùng thư viện. Bỏ chọn từ không muốn giữ.</p>
    <div class="toolbar">
      <button class="btn sm" id="stgAll">Chọn tất cả</button>
      <button class="btn sm" id="stgNone">Bỏ chọn</button>
      <button class="btn sm" id="stgGoogle">🌐 Tra nghĩa (Google)</button>
      <button class="btn sm" id="stgTrans">✨ Dịch bằng AI</button>
      <span class="count-pill" id="stgCount">${chk} được chọn · ${staging.items.filter(i=>!i.vi).length} thiếu nghĩa</span>
    </div>
    <div class="table-wrap" style="box-shadow:none;max-height:50vh"><table><thead><tr>
      <th></th><th>Tần suất</th><th>Hán tự</th><th>Pinyin</th><th>Âm bồi</th><th>Loại từ</th><th>Nghĩa tiếng Việt</th><th>Nghe</th>
    </tr></thead><tbody id="stgBody">
      ${staging.items.map((it,i)=>`<tr>
        <td><input type="checkbox" class="stgChk" data-i="${i}" ${it.checked?"checked":""}></td>
        <td><b>${it.freq}</b></td>
        <td class="han-cell">${esc(it.han)}${it.example?`<div class="sub" style="font-size:10px">vd: ${esc(it.example)}</div>`:""}</td>
        <td class="pin-cell">${esc(it.pinyin)}</td>
        <td style="color:var(--warn)">${esc(amBoiForHan(it.han))}</td>
        <td class="sub" style="font-size:11px">${esc(it.pos||"")}</td>
        <td><input class="txt stgVi" data-i="${i}" value="${esc(it.vi||"")}" placeholder="nhập nghĩa..." style="font-size:12.5px;padding:4px 6px;width:100%"></td>
        <td style="white-space:nowrap"><button class="mini stgListen" data-i="${i}" title="Nghe Trung + Việt">🔊🇻🇳</button>
          <button class="mini" onclick="openYouglish('${esc(it.han)}')">🌐</button>
          <button class="mini stgMem" data-i="${i}" title="Cách nhớ">💡</button></td>
      </tr>`).join("")}
    </tbody></table></div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn primary" id="stgConfirm">✅ Xác nhận đưa vào thư viện</button>
      <button class="btn" id="stgRoom">📦 Lưu thành Room</button>
      <button class="btn" id="stgPlay">▶ Nghe thử (Trung + Việt)</button>
      <button class="btn" id="stgClear" style="border-color:var(--brand)">🗑 Bỏ Room tạm</button>
    </div>
  </div>`;
  const upd=()=>{ $("#stgCount").textContent=`${staging.items.filter(i=>i.checked).length} được chọn · ${staging.items.filter(i=>!i.vi).length} thiếu nghĩa`; };
  $$(".stgChk").forEach(c=>c.onchange=()=>{ staging.items[+c.dataset.i].checked=c.checked; upd(); });
  $$(".stgVi").forEach(inp=>inp.oninput=()=>{ staging.items[+inp.dataset.i].vi=inp.value; upd(); });
  $$(".stgListen").forEach(b=>b.onclick=()=>{ const it=staging.items[+b.dataset.i]; speakBilingual(it.han, it.vi); });
  $$(".stgMem").forEach(b=>b.onclick=()=>{ const it=staging.items[+b.dataset.i]; openMemoryGuide(it.han,{pinyin:it.pinyin,vi:it.vi}); });
  $("#stgAll").onclick=()=>{ staging.items.forEach(i=>i.checked=true); renderStaging(); };
  $("#stgNone").onclick=()=>{ staging.items.forEach(i=>i.checked=false); renderStaging(); };
  $("#stgTrans").onclick=translateStaging;
  $("#stgGoogle").onclick=googleTranslateStaging;
  $("#stgPlay").onclick=()=>Player.start(staging.items.filter(i=>i.checked).map(i=>({han:i.han,sub:i.vi||i.pinyin,vi:i.vi})),{pauseMs:1100, bilingual:true});
  $("#stgConfirm").onclick=()=>{
    const chosen=staging.items.filter(i=>i.checked); let n=0;
    chosen.forEach(i=>{ if(addMyWord({han:i.han,pinyin:i.pinyin,vi:i.vi||i.pinyin,pos:i.pos||"",example:i.example||"",source:staging.source})) n++; });
    toast(`Đã đưa ${n} từ vào Thư viện keyword`); staging=null; renderStaging();
    const b=[...document.querySelectorAll('.nav-item')].find(x=>x.dataset.page==='library'); // refresh badge later
  };
  $("#stgRoom").onclick=()=>{
    const chosen=staging.items.filter(i=>i.checked); if(!chosen.length){toast("Chưa chọn từ nào");return;}
    const name=prompt("Đặt tên Room:", staging.source);
    if(!name) return;
    progress.rooms.push({name, date:new Date().toISOString().slice(0,10), words:chosen.map(i=>({han:i.han,pinyin:i.pinyin,vi:i.vi}))});
    save(); toast("Đã lưu Room “"+name+"”"); drawRooms();
  };
  $("#stgClear").onclick=()=>{ staging=null; renderStaging(); };
}
async function googleTranslateStaging(){
  if(!staging) return;
  const missing=staging.items.filter(i=>!i.vi);
  if(!missing.length){ toast("Mọi từ đã có nghĩa"); return; }
  const btn=$("#stgGoogle"); if(btn){btn.disabled=true;}
  let done=0;
  for(const it of missing){
    if(btn) btn.textContent=`🌐 Đang tra… ${++done}/${missing.length}`;
    try{ const vi=await translateVi(it.han); if(vi) it.vi=vi; }catch(e){}
  }
  toast(`Đã tra ${missing.filter(i=>i.vi).length} nghĩa qua Google/MyMemory`); renderStaging();
}
async function translateStaging(){
  if(!staging) return;
  const missing=staging.items.filter(i=>!i.vi);
  if(!missing.length){ toast("Mọi từ đã có nghĩa"); return; }
  if(!(progress.settings.openaiKey||"").trim()){ toast("Cần nhập OpenAI API key ở ⚙️ Cài đặt để dịch tự động"); go("settings"); return; }
  const btn=$("#stgTrans"); if(btn){btn.textContent="✨ Đang dịch…"; btn.disabled=true;}
  try{
    const list=missing.map(i=>i.han).join("\n");
    const prompt=`Với mỗi từ tiếng Trung dưới đây, cho biết loại từ và nghĩa tiếng Việt ngắn gọn, kèm 1 câu ví dụ ngắn (chữ Hán). Trả về mỗi từ đúng 1 dòng dạng "汉字 = loại_từ | nghĩa | ví_dụ_hán", không thêm gì khác. Loại từ dùng: danh từ/động từ/tính từ/trạng từ/lượng từ/đại từ/liên từ/giới từ/trợ từ.\n${list}`;
    const out=await openaiChat([{role:"user",content:prompt}],{max_tokens:1200,temperature:0.3});
    const map={};
    out.split(/\n/).forEach(l=>{ const m=l.match(/^\s*([一-鿿]+)\s*[=:：]\s*(.+)$/); if(!m) return;
      const parts=m[2].split("|").map(x=>x.trim());
      map[m[1]]={pos:parts[0]||"", vi:parts[1]||parts[0]||"", ex:parts[2]||""}; });
    let n=0; staging.items.forEach(it=>{ const g=map[it.han]; if(g){ if(!it.vi){it.vi=g.vi;n++;} it.pos=g.pos; it.example=g.ex; } });
    toast(`Đã dịch ${n} từ (kèm loại từ + ví dụ)`); renderStaging();
  }catch(e){ toast("Lỗi dịch: "+e.message); if(btn){btn.textContent="✨ Dịch nghĩa còn thiếu (AI)"; btn.disabled=false;} }
}
function drawRooms(){
  const box=$("#vRooms"); if(!box) return;
  if(!progress.rooms.length){ box.innerHTML=`<p class="sub">Chưa có Room nào.</p>`; return; }
  box.innerHTML=progress.rooms.map((r,i)=>`
    <div class="sent-line" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <b>📦 ${esc(r.name)}</b> <span class="sub">${r.words.length} từ · ${esc(r.date)}</span>
      <span style="margin-left:auto"></span>
      <button class="btn sm" data-room-play="${i}">▶ Nghe</button>
      <button class="btn sm" data-room-add="${i}">➕ Vào thư viện</button>
      <button class="btn sm" data-room-del="${i}" style="border-color:var(--brand)">🗑</button>
    </div>`).join("");
  $$("[data-room-play]").forEach(b=>b.onclick=()=>Player.start(progress.rooms[+b.dataset.roomPlay].words.map(w=>({han:w.han,sub:w.vi,vi:w.vi})),{pauseMs:1100}));
  $$("[data-room-add]").forEach(b=>b.onclick=()=>{ let n=0; progress.rooms[+b.dataset.roomAdd].words.forEach(w=>{ if(addMyWord({han:w.han,pinyin:w.pinyin,vi:w.vi||w.pinyin,source:"room"})) n++; }); toast(`Đã thêm ${n} từ vào thư viện`); });
  $$("[data-room-del]").forEach(b=>b.onclick=()=>{ if(confirm("Xóa Room này?")){ progress.rooms.splice(+b.dataset.roomDel,1); save(); RENDER.video(); } });
}

/* ---------- Thư viện keyword ---------- */
let libTab="lib";
RENDER.library = () => {
  const savedList=Object.values(progress.saved);
  const tabs=`<div class="chips">
      <span class="chip ${libTab==='lib'?'active':''}" data-lt="lib">📇 Thư viện keyword (${progress.myWords.length})</span>
      <span class="chip ${libTab==='saved'?'active':''}" data-lt="saved">⭐ Từ đã lưu (${savedList.length})</span>
    </div>`;
  if(libTab==="saved"){ renderSavedLib(tabs, savedList); return; }
  const lib=progress.myWords;
  $("#view").innerHTML=`
    <h2 class="section-h">📇 Thư viện keyword</h2>
    ${tabs}
    <p class="sub">Kho từ bạn tự thu thập từ các nguồn. Đã lọc trùng tự động. Từ đây được đưa vào ôn tập ghi nhớ.</p>
    <div class="stat-grid">
      <div class="stat"><div class="n">${lib.length}</div><div class="l">Tổng keyword</div></div>
      <div class="stat"><div class="n">${lib.filter(w=>progress.learned[w.han]).length}</div><div class="l">Đã thuộc</div></div>
      <div class="stat"><div class="n">${new Set(lib.map(w=>w.source)).size}</div><div class="l">Nguồn khác nhau</div></div>
    </div>
    <div class="toolbar">
      <input class="txt" id="libQ" placeholder="Tìm trong thư viện..." style="flex:1;min-width:200px">
      <button class="btn" id="libPlay">▶ Nghe tất cả</button>
      <button class="btn" id="libExport">⬇ Xuất CSV</button>
    </div>
    <div class="table-wrap"><table><thead><tr>
      <th>Hán tự</th><th>Pinyin / Âm bồi</th><th>Nghĩa</th><th>Nguồn</th><th>Ngày</th><th></th>
    </tr></thead><tbody id="libBody"></tbody></table></div>`;
  const draw=()=>{
    const q=($("#libQ").value||"").toLowerCase();
    const list=progress.myWords.filter(w=>!q||(w.han+w.pinyin+(w.vi||"")).toLowerCase().includes(q));
    $("#libBody").innerHTML= list.length? list.map((w,i)=>`<tr>
      <td class="han-cell">${esc(w.han)}</td>
      <td>${pinAmbHTML(w.pinyin, w.han)}</td>
      <td>${esc(w.vi||"")}</td>
      <td class="sub" style="font-size:12px">${esc(w.source||"")}</td>
      <td class="sub" style="font-size:12px">${esc(w.date||"")}</td>
      <td style="white-space:nowrap"><button class="mini" onclick="speak('${esc(w.han)}')">🔊</button>
        <button class="mini" onclick="openMemoryGuide('${esc(w.han)}')" title="Cách nhớ">💡</button>
        <button class="mini" onclick="openYouglish('${esc(w.han)}')">🌐</button>
        <button class="mini" data-del="${esc(w.han)}" style="border-color:var(--brand)">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="6" class="sub">Chưa có keyword nào. Vào ➕ Thêm nguồn để thu thập.</td></tr>`;
    $$("[data-del]").forEach(b=>b.onclick=()=>{ const h=b.dataset.del; progress.myWords=progress.myWords.filter(x=>x.han!==h); save(); draw(); });
  };
  $("#libQ").oninput=draw;
  $("#libPlay").onclick=()=>{ if(!progress.myWords.length){toast("Thư viện trống");return;} Player.start(progress.myWords.map(w=>({han:w.han,sub:w.vi||w.pinyin,vi:w.vi})),{pauseMs:1100}); };
  $("#libExport").onclick=()=>{
    const rows=[["han","pinyin","amboi","vi","source","date"],...progress.myWords.map(w=>[w.han,w.pinyin,amBoiForHan(w.han),w.vi||"",w.source||"",w.date||""])];
    const csv=rows.map(r=>r.map(c=>`"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv"})); a.download="thu-vien-keyword.csv"; a.click();
  };
  draw();
  $$("[data-lt]").forEach(c=>c.onclick=()=>{ libTab=c.dataset.lt; RENDER.library(); });
};
function renderSavedLib(tabs, savedList){
  $("#view").innerHTML=`
    <h2 class="section-h">⭐ Từ đã lưu</h2>
    ${tabs}
    <p class="sub">Các từ bạn đã bấm ⭐ Lưu (từ bất kỳ, kể cả HSK) — kèm cách nhớ đã lưu. Truy cập nhanh để ôn.</p>
    <div class="toolbar">
      <input class="txt" id="svQ" placeholder="Tìm từ đã lưu..." style="flex:1;min-width:200px">
      <button class="btn" id="svPlay">▶ Nghe tất cả</button>
    </div>
    <div id="svList"></div>`;
  const draw=()=>{
    const q=($("#svQ").value||"").toLowerCase();
    const list=savedList.filter(w=>!q||(w.han+(w.pinyin||"")+(w.vi||"")+(w.mnemonic||"")).toLowerCase().includes(q));
    $("#svList").innerHTML= list.length? list.map(w=>`
      <div class="panel" style="padding:14px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span class="han-cell" style="font-size:28px">${esc(w.han)}</span>
          <div>${pinAmbHTML(w.pinyin||toPinyin(w.han), w.han)}<div class="vi">${esc(w.vi||"")}</div></div>
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="mini" onclick="speak('${esc(w.han)}')">🔊</button>
            <button class="mini" onclick="openMemoryGuide('${esc(w.han)}')" title="Cách nhớ">💡</button>
            <button class="mini" data-unsave="${esc(w.han)}" style="border-color:var(--brand)" title="Bỏ lưu">🗑</button>
          </div>
        </div>
        ${w.mnemonic?`<div class="mnemonic" style="margin-top:10px">${mnFormat(w.mnemonic)}</div>`:`<div class="sub" style="margin-top:6px">Chưa có cách nhớ — bấm 💡 để tạo &amp; lưu.</div>`}
      </div>`).join("") : `<p class="sub">Chưa có từ nào được lưu. Bấm ☆ Lưu từ ở chi tiết từ hoặc trong 💡 Cách nhớ.</p>`;
    $$("[data-unsave]").forEach(b=>b.onclick=()=>{ delete progress.saved[b.dataset.unsave]; save(); RENDER.library(); });
  };
  $("#svQ").oninput=draw;
  $("#svPlay").onclick=()=>{ if(!savedList.length){toast("Chưa có từ đã lưu");return;} Player.start(savedList.map(w=>({han:w.han,sub:w.vi,vi:w.vi})),{pauseMs:1100}); };
  draw();
  $$("[data-lt]").forEach(c=>c.onclick=()=>{ libTab=c.dataset.lt; RENDER.library(); });
}

/* ---------- Tài liệu / Link nhanh ---------- */
function linkType(url){
  const u=(url||"").toLowerCase();
  if(/youtube\.com|youtu\.be/.test(u)) return {t:"youtube",ico:"▶️",name:"YouTube"};
  if(/drive\.google\.com|docs\.google\.com|sheets\.google\.com/.test(u)) return {t:"drive",ico:"📁",name:"Google Drive"};
  if(/facebook\.com|fb\.watch/.test(u)) return {t:"facebook",ico:"📱",name:"Facebook"};
  if(/tiktok\.com|douyin/.test(u)) return {t:"tiktok",ico:"🎵",name:"TikTok/Douyin"};
  if(/\.pdf($|\?)/.test(u)) return {t:"pdf",ico:"📄",name:"PDF"};
  if(/bilibili\.com/.test(u)) return {t:"bili",ico:"📺",name:"Bilibili"};
  return {t:"web",ico:"🔗",name:"Trang web"};
}
let linkFilter="", linkTag="";
function saveQuickLink(url, tag){
  url=(url||"").trim(); if(!url){ toast("Chưa có URL"); return; }
  let u=url; if(!/^https?:\/\//i.test(u)) u="https://"+u;
  if(progress.links.some(l=>l.url===u)){ toast("Link đã có trong Tài liệu"); return; }
  const ty=linkType(u);
  progress.links.unshift({title:ty.name+" · "+u.replace(/^https?:\/\//,'').slice(0,40), url:u, type:ty.t, note:"", tag:tag||"", date:todayStr()});
  save(); toast("📎 Đã lưu vào Tài liệu");
}
RENDER.links = () => {
  $("#view").innerHTML=`
    <h2 class="section-h">📎 Tài liệu / Link nhanh</h2>
    <p class="sub">Lưu link video, Google Drive, tài liệu... để mở nhanh khi cần. Tự nhận diện loại link. Dữ liệu lưu trên máy bạn.</p>
    <div class="panel">
      <h3>➕ Thêm link mới</h3>
      <div class="toolbar">
        <input class="txt" id="lkUrl" style="flex:2;min-width:220px" placeholder="Dán URL (YouTube, Google Drive, PDF, web...)">
        <input class="txt" id="lkTitle" style="flex:1;min-width:150px" placeholder="Tiêu đề (tùy chọn)">
        <input class="txt" id="lkTag" style="width:130px" placeholder="Nhãn (vd: Ngữ pháp)">
        <button class="btn primary" id="lkAdd">Lưu</button>
      </div>
      <input class="txt" id="lkNote" style="width:100%;margin-top:8px" placeholder="Ghi chú (tùy chọn)">
    </div>
    <div class="panel">
      <div class="toolbar">
        <input class="txt" id="lkSearch" style="flex:1;min-width:180px" placeholder="🔎 Tìm trong tài liệu...">
        <select id="lkTagFilter"></select>
        <span class="count-pill" id="lkCount"></span>
      </div>
      <div id="lkList" style="margin-top:8px"></div>
    </div>`;
  const add=()=>{
    const url=($("#lkUrl").value||"").trim();
    if(!url){ toast("Dán URL trước"); return; }
    let u=url; if(!/^https?:\/\//i.test(u)) u="https://"+u;
    const ty=linkType(u);
    const title=($("#lkTitle").value||"").trim() || ty.name+" · "+u.replace(/^https?:\/\//,'').slice(0,40);
    progress.links.unshift({title, url:u, type:ty.t, note:($("#lkNote").value||"").trim(), tag:($("#lkTag").value||"").trim(), date:todayStr()});
    save(); toast("Đã lưu link"); $("#lkUrl").value="";$("#lkTitle").value="";$("#lkNote").value="";$("#lkTag").value="";
    draw();
  };
  $("#lkAdd").onclick=add;
  $("#lkUrl").onkeydown=e=>{ if(e.key==="Enter") add(); };
  $("#lkSearch").oninput=()=>{linkFilter=$("#lkSearch").value;draw();};
  const draw=()=>{
    const tags=[...new Set(progress.links.map(l=>l.tag).filter(Boolean))];
    const sel=$("#lkTagFilter");
    if(sel) sel.innerHTML=`<option value="">Tất cả nhãn</option>`+tags.map(t=>`<option ${linkTag===t?"selected":""}>${esc(t)}</option>`).join("");
    if(sel) sel.onchange=e=>{linkTag=e.target.value;draw();};
    const q=(linkFilter||"").toLowerCase();
    const list=progress.links.filter(l=>(!linkTag||l.tag===linkTag) && (!q||(l.title+l.url+(l.note||"")+(l.tag||"")).toLowerCase().includes(q)));
    $("#lkCount").textContent=`${list.length} link`;
    $("#lkList").innerHTML = list.length ? list.map((l)=>{
      const gi=progress.links.indexOf(l); const ty=linkType(l.url);
      return `<div class="link-row">
        <span class="link-ico">${ty.ico}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis">${esc(l.title)}</div>
          <div class="sub" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</div>
          ${l.note?`<div class="sub" style="font-size:12px">📝 ${esc(l.note)}</div>`:""}
          <div style="margin-top:2px">${l.tag?`<span class="chip" style="font-size:11px;padding:2px 8px">${esc(l.tag)}</span> `:""}<span class="sub" style="font-size:11px">${esc(l.date||"")}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <a class="btn sm primary" href="${esc(l.url)}" target="_blank" rel="noopener">Mở ↗</a>
          <button class="mini" data-copy="${gi}" title="Copy link">📋</button>
          <button class="mini" data-del="${gi}" style="border-color:var(--brand)" title="Xóa">🗑</button>
        </div>
      </div>`;
    }).join("") : `<p class="sub">Chưa có link nào. Thêm link ở trên để truy cập nhanh sau này.</p>`;
    $$("[data-del]",$("#lkList")).forEach(b=>b.onclick=()=>{ if(confirm("Xóa link này?")){ progress.links.splice(+b.dataset.del,1); save(); draw(); } });
    $$("[data-copy]",$("#lkList")).forEach(b=>b.onclick=()=>{ navigator.clipboard?.writeText(progress.links[+b.dataset.copy].url).then(()=>toast("Đã copy link"),()=>{}); });
  };
  draw();
};

/* ---------- Cài đặt ---------- */
RENDER.settings = () => {
  const s=progress.settings;
  const viVoices=allVoices.filter(v=>/^vi/i.test(v.lang));
  $("#view").innerHTML=`
    <h2 class="section-h">⚙️ Cài đặt</h2>
    <div class="panel">
      <h3>⏰ Nhắc ôn tập hằng ngày</h3>
      <p class="sub">Bật để app nhắc bạn ôn vào giờ cố định (khi app đang mở). Sẽ nhắc bù nếu mở app sau giờ đó.</p>
      <div class="toolbar">
        <label class="chip ${s.reminderOn?'active':''}" id="setRemOn">${s.reminderOn?'🔔 Đang bật':'🔕 Đang tắt'}</label>
        <label class="sub">Giờ nhắc <input class="txt" id="setRemTime" type="time" value="${esc(s.reminderTime||'08:00')}" style="width:120px"></label>
        <button class="btn" id="setRemPerm">Cho phép thông báo</button>
        <button class="btn" id="setRemTest">Thử nhắc ngay</button>
      </div>
      <div id="setRemStatus" class="sub" style="margin-top:6px"></div>
    </div>
    <div class="panel">
      <h3>✨ ChatGPT API (tạo truyện bằng AI)</h3>
      <p class="sub">Nhập API key OpenAI của bạn để dùng tính năng tạo truyện. Key <b>chỉ lưu trên máy bạn</b> (localStorage), gọi thẳng tới OpenAI, không gửi đi đâu khác. Lấy key tại <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>.</p>
      <div class="toolbar">
        <input class="txt" id="setKey" type="password" style="flex:1;min-width:240px" placeholder="sk-..." value="${esc(s.openaiKey||"")}">
        <select id="setModel">
          ${["gpt-4o-mini","gpt-4o","gpt-4.1-mini"].map(m=>`<option ${s.model===m?"selected":""}>${m}</option>`).join("")}
        </select>
        <button class="btn primary" id="setSaveKey">Lưu</button>
        <button class="btn" id="setTest">Kiểm tra</button>
      </div>
      <div id="setKeyStatus" class="sub" style="margin-top:8px"></div>
    </div>
    <div class="panel">
      <h3>🇻🇳 Giọng đọc tiếng Việt (đọc âm bồi)</h3>
      <p class="sub">Chọn giọng tiếng Việt để nghe âm bồi phát âm theo tiếng Việt. Nếu danh sách trống, hãy cài gói giọng "Tiếng Việt" trong hệ điều hành.</p>
      <div class="toolbar">
        <select id="setVoice"><option value="">(Tự động)</option>
          ${viVoices.map(v=>`<option ${s.viVoiceName===v.name?"selected":""}>${esc(v.name)}</option>`).join("")}</select>
        <button class="btn" id="setTestVoice">🔊 Nghe thử: nỉ hảo</button>
      </div>
      <div class="sub" style="margin-top:6px">Đã phát hiện ${viVoices.length} giọng tiếng Việt · ${allVoices.filter(v=>/zh/i.test(v.lang)).length} giọng tiếng Trung.</div>
    </div>
    <div class="panel">
      <h3>🔄 Đồng bộ giữa máy tính &amp; điện thoại</h3>
      <p class="sub">Tiến độ lưu riêng trên mỗi thiết bị (localStorage). Để chuyển sang thiết bị khác: <b>Sao lưu</b> ở thiết bị cũ → gửi file <code>hsk-backup.json</code> (Zalo/Drive/email) → mở app ở thiết bị mới → <b>Khôi phục</b> file đó.</p>
      <div class="toolbar">
        <button class="btn primary" id="setExport">⬇ Sao lưu toàn bộ (JSON)</button>
        <label class="btn" style="cursor:pointer">⬆ Khôi phục<input type="file" id="setImport" accept="application/json" hidden></label>
      </div>
      <p class="sub" style="margin-top:8px">💡 Sao lưu định kỳ để không mất tiến độ nếu xóa dữ liệu trình duyệt. (App tĩnh không có server nên chưa tự đồng bộ thời gian thực.)</p>
    </div>`;
  const remStatus=()=>{ const p=('Notification' in window)?Notification.permission:'unsupported';
    $("#setRemStatus").textContent = p==='granted'?'✓ Thông báo đã được cho phép.':p==='denied'?'✗ Thông báo bị chặn — bật lại trong cài đặt trình duyệt.':'Chưa cấp quyền thông báo (sẽ hiện nhắc dạng banner trong app).'; };
  remStatus();
  $("#setRemOn").onclick=e=>{ s.reminderOn=!s.reminderOn; save(); e.target.classList.toggle('active',s.reminderOn); e.target.textContent=s.reminderOn?'🔔 Đang bật':'🔕 Đang tắt'; if(s.reminderOn&&'Notification'in window&&Notification.permission==='default') Notification.requestPermission().then(remStatus); };
  $("#setRemTime").onchange=e=>{ s.reminderTime=e.target.value||'08:00'; s.reminderLast=''; save(); toast('Đã đặt giờ nhắc '+s.reminderTime); };
  $("#setRemPerm").onclick=()=>{ if('Notification'in window) Notification.requestPermission().then(remStatus); else toast('Trình duyệt không hỗ trợ thông báo'); };
  $("#setRemTest").onclick=()=>{ notify('⏰ Nhắc ôn tiếng Trung', 'Đây là thông báo thử — bạn có '+(srsCounts().due+sentCounts().due)+' mục cần ôn.'); };
  $("#setSaveKey").onclick=()=>{ s.openaiKey=$("#setKey").value.trim(); s.model=$("#setModel").value; save(); toast("Đã lưu"); };
  $("#setTest").onclick=async()=>{ s.openaiKey=$("#setKey").value.trim(); s.model=$("#setModel").value; save();
    $("#setKeyStatus").textContent="Đang kiểm tra…";
    try{ const r=await openaiChat([{role:"user",content:"Trả lời đúng 1 từ: OK"}],{max_tokens:5}); $("#setKeyStatus").innerHTML=`<span style="color:var(--ok)">✓ Kết nối OK: ${esc(r.slice(0,20))}</span>`; }
    catch(e){ $("#setKeyStatus").innerHTML=`<span style="color:var(--brand)">✗ ${esc(e.message)}</span>`; } };
  $("#setVoice").onchange=e=>{ s.viVoiceName=e.target.value; save(); pickVoice(); };
  $("#setTestVoice").onclick=()=>{ pickVoice(); speakAmboi("你好"); };
  $("#setExport").onclick=()=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(progress,null,2)],{type:"application/json"})); a.download="hsk-backup.json"; a.click(); };
  $("#setImport").onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ const d=JSON.parse(r.result); if(confirm("Khôi phục sẽ ghi đè tiến độ hiện tại. Tiếp tục?")){ progress=Object.assign(progress,d); save(); toast("Đã khôi phục"); RENDER.settings(); } }catch(err){ toast("File không hợp lệ"); } };
    r.readAsText(f); };
};

/* ---------- Chiết tự (Hanzi breakdown) ---------- */
RENDER.hanzi = () => {
  $("#view").innerHTML = `
    <h2 class="section-h">🧩 Chiết tự — hiểu &amp; nhớ mặt chữ</h2>
    <p class="sub">Phân tích từng chữ Hán: pinyin · âm bồi · âm Hán-Việt · nghĩa gốc. Hiểu cấu tạo giúp nhớ lâu mặt chữ.</p>
    <div class="panel">
      <div class="toolbar">
        <input class="txt" id="hzIn" style="flex:1;min-width:220px" placeholder="Nhập chữ hoặc từ Hán (vd: 好, 学生, 谢谢)...">
        <button class="btn primary" id="hzGo">Phân tích</button>
      </div>
      <div id="hzOut" style="margin-top:8px"></div>
    </div>
    <div class="panel">
      <h3>Duyệt kho chữ (${Object.keys(D.chars).length} chữ có chiết tự)</h3>
      <div class="toolbar"><input class="txt" id="hzFilter" placeholder="Lọc theo âm Hán-Việt hoặc nghĩa..."></div>
      <div class="cards-grid" id="hzGrid"></div>
    </div>`;
  const analyze=()=>{
    const t=($("#hzIn").value||"").trim();
    if(!t){ $("#hzOut").innerHTML=""; return; }
    const words=t.split(/\s+/).filter(Boolean);
    $("#hzOut").innerHTML = words.map(w=>`
      <div style="margin-top:10px">
        <div style="display:flex;gap:10px;align-items:center">
          <span class="han-cell" style="font-size:26px">${esc(w)}</span>
          <span class="pin-cell">${esc(toPinyin(w))}</span>
          <span style="color:var(--warn)">🗣️ ${esc(amBoiForHan(w))}</span>
          <button class="mini" onclick="speak('${esc(w)}')">🔊</button>
          <button class="mini" onclick="openYouglish('${esc(w)}')">🌐</button>
          <button class="btn sm" style="border-color:var(--brand)" onclick="openMemoryGuide('${esc(w)}')">💡 Cách nhớ</button>
        </div>
        ${charBreakdownHTML(w) || '<div class="sub">Không có chữ Hán để phân tích.</div>'}
      </div>`).join("");
  };
  $("#hzGo").onclick=analyze; $("#hzIn").onkeydown=e=>{if(e.key==="Enter")analyze();};
  const entries=Object.entries(D.chars);
  const drawGrid=()=>{
    const q=($("#hzFilter").value||"").toLowerCase();
    const list=entries.filter(([ch,i])=>!q||(i.hv+" "+i.g).toLowerCase().includes(q)).slice(0,300);
    $("#hzGrid").innerHTML=list.map(([ch,i])=>`
      <div class="vcard" onclick="document.querySelector('#hzIn').value='${esc(ch)}';document.querySelector('#hzGo').click();window.scrollTo(0,0)">
        <div class="han">${esc(ch)}</div>
        <div class="pin">${esc(D.charPinyin[ch]||'')} · <span style="color:var(--warn)">${esc(amBoiSyllable(D.charPinyin[ch]||''))}</span></div>
        <div class="vi"><b>${esc(i.hv)}</b></div>
        <div class="topic">${esc(i.g)}</div>
      </div>`).join("") + (entries.length>300&&!q?`<p class="sub" style="grid-column:1/-1">Hiển thị 300/${entries.length} chữ — dùng ô lọc để tìm.</p>`:"");
  };
  $("#hzFilter").oninput=drawGrid; drawGrid();
};

/* ---------- Ôn câu ví dụ (SRS trên câu) ---------- */
let sentQueue=[], sentShown=false, sentDone=0;
RENDER.sentsrs = () => {
  const c=sentCounts();
  $("#view").innerHTML=`
    <h2 class="section-h">📖 Ôn câu ví dụ</h2>
    <p class="sub">Lặp lại ngắt quãng trên cả câu (câu nguồn + câu ví dụ). Nghe → hiểu → tự chấm.</p>
    <div class="stat-grid">
      <div class="stat"><div class="n" style="color:var(--warn)">${c.due}</div><div class="l">Câu đến hạn</div></div>
      <div class="stat"><div class="n" style="color:var(--accent)">${c.newc}</div><div class="l">Câu mới</div></div>
      <div class="stat"><div class="n">${c.learning}</div><div class="l">Đang học</div></div>
      <div class="stat"><div class="n" style="color:var(--ok)">${c.mature}</div><div class="l">Nhớ lâu</div></div>
    </div>
    <div class="toolbar center-narrow" style="justify-content:center">
      <label class="sub">Số câu mới/phiên <input class="txt" id="ssNew" type="number" value="10" min="0" max="50" style="width:66px"></label>
      <button class="btn primary" id="ssStart">Bắt đầu ôn câu</button>
    </div>
    <div class="progress-bar"><i id="ssProg"></i></div>
    <div id="ssArea"><p class="sub" style="text-align:center">Nhấn Bắt đầu để vào phiên.</p></div>`;
  const startSent=()=>{
    if(dailySentList && dailySentList.length){
      const items=dailySentList.map(s=>({han:s.han, meaning:s.meaning, src:s.source||"Câu hôm nay"}));
      items.forEach(x=>sentInit(x.han));
      sentQueue=items.slice(); dailySentList=null; sentShown=false; sentDone=0; drawSent(); return;
    }
    const nNew=parseInt($("#ssNew").value)||0, now=today0(), pool=sentencePool();
    let due=pool.filter(x=>{const s=progress.sentSrs[x.han];return s&&s.due<=now;});
    let news=pool.filter(x=>!progress.sentSrs[x.han]).slice(0,nNew);
    news.forEach(x=>sentInit(x.han));
    sentQueue=shuffle(due.concat(news)).slice(0,60); sentShown=false; sentDone=0;
    if(!sentQueue.length){ $("#ssArea").innerHTML=`<div class="panel" style="text-align:center"><h3>🎉 Không còn câu cần ôn!</h3></div>`; return; }
    drawSent();
  };
  $("#ssStart").onclick=startSent;
  if(dailySentList && dailySentList.length) startSent();
};
function drawSent(){
  if(!sentQueue.length){ $("#ssProg").style.width="100%";
    $("#ssArea").innerHTML=`<div class="panel" style="text-align:center"><h3>✅ Xong phiên!</h3><p class="sub">Đã ôn ${sentDone} câu.</p><button class="btn primary" onclick="RENDER.sentsrs()">Về trang ôn câu</button></div>`; return; }
  const x=sentQueue[0], total=sentDone+sentQueue.length;
  $("#ssProg").style.width=(sentDone/total*100)+"%";
  $("#ssArea").innerHTML=`
    <div class="center-narrow">
      <div class="panel" style="text-align:center">
        <div class="quiz-q">🎧 Nghe câu — hiểu rồi lật xem đáp án · còn ${sentQueue.length} câu</div>
        <div class="detail-han" style="font-size:34px;margin:10px 0">${esc(x.han)}</div>
        <div id="ssBack" class="${sentShown?'':'hidden'}">
          <div class="pin-cell">${esc(toPinyin(x.han))}</div>
          <div class="amboi-line" style="justify-content:center">🗣️ ${esc(amBoiForHan(x.han))}</div>
          <div style="margin-top:6px">${esc(x.meaning||"")}</div>
          <div class="sub" style="font-size:11px">Nguồn: ${esc(x.src||"")}</div>
          <div class="lab" style="margin-top:10px">💡 Bấm 1 từ để xem cách nhớ (trong ngữ cảnh câu)</div>
          <div class="anno" style="justify-content:center" id="ssWords"></div>
        </div>
        <div class="flash-controls" style="margin-top:12px">
          <button class="btn" onclick="speak('${esc(x.han)}')">🔊 Nghe</button>
          <button class="btn" onclick="speakBilingual('${esc(x.han)}', ${JSON.stringify(x.meaning||"").replace(/</g,'\\u003c')})">🇻🇳 Trung+Việt</button>
          ${sentShown?`<button class="btn" style="border-color:var(--brand)" data-g="0">Quên</button>
            <button class="btn" data-g="3">Khó</button>
            <button class="btn primary" data-g="4">Nhớ</button>
            <button class="btn" style="border-color:var(--ok)" data-g="5">Dễ</button>`
            :`<button class="btn primary" id="ssFlip">Lật</button>`}
        </div>
      </div>
    </div>`;
  speak(x.han);
  if($("#ssFlip")) $("#ssFlip").onclick=()=>{sentShown=true; drawSent();};
  if(sentShown && $("#ssWords")){
    const toks=segment(x.han).filter(t=>!t.other);
    $("#ssWords").innerHTML=toks.map((t,i)=>`<span class="tok" data-w="${i}" style="cursor:pointer">
      <span class="tp">${esc((D.gloss[t.w]?D.gloss[t.w].p:toPinyin(t.w)))}</span>
      <span class="th">${esc(t.w)}</span></span>`).join("");
    $$("#ssWords .tok").forEach(el=>el.onclick=()=>{ const w=toks[+el.dataset.w].w; openMemoryGuide(w,{sentence:x.han}); });
  }
  $$("[data-g]").forEach(b=>b.onclick=()=>{ const g=parseInt(b.dataset.g); sentReview(x.han,g); sentQueue.shift(); if(g<3)sentQueue.push(x); else sentDone++; sentShown=false; drawSent(); });
}

/* ---------- Bộ thủ (radicals) ---------- */
// Xếp hạng độ phổ biến (số chữ Hán mang bộ, mức gặp trong thực tế) — #1 = phổ biến nhất
const RAD_RANK_ORDER = "口 氵 木 亻 扌 艹 讠 纟 女 忄 月 日 土 钅 虫 目 石 王 犭 阝 辶 宀 火 禾 竹 贝 广 立 车 页 疒 门 走 足 力 刂 大 小 山 田 米 衤 饣 彳 耳 又 心 灬 金 言 人 水 手 刀 衣 食 糸 示 礻 犬 玉 见 贝 车 门 马 鸟 鱼 雨 冫 亠 冖 勹 匚 卩 厂 廴 弓 戈 户 攵 斤 方 欠 殳 毛 气 爪 父 片 牙 牛 瓦 甘 用 皮 皿 矛 矢 穴 缶 网 羊 羽 老 而 耒 舌 舟 色 血 行 角 谷 豆 豕 赤 身 辛 辰 酉 里 隹 青 非 面 革 音 首 香 骨 高 鬼 麦 麻 黄 黑 鼎 鼓 鼠 鼻 齿".split(/\s+/);
const RAD_RANK = {}; RAD_RANK_ORDER.forEach((r,i)=>{ if(RAD_RANK[r]==null) RAD_RANK[r]=i+1; });
function radRank(r){ return RAD_RANK[r]||9999; }
function radRankClass(rk){ return rk<=10?"rad-hot":rk<=30?"rad-warm":rk<=60?"rad-mild":""; }
RENDER.radicals = () => {
  $("#view").innerHTML=`
    <h2 class="section-h">🌿 Bộ thủ &amp; cấu tạo chữ</h2>
    <p class="sub">Bộ thủ là "gốc nghĩa" của chữ Hán. Danh sách <b>xếp theo độ phổ biến (#1 = hay gặp nhất)</b>; bộ càng nóng càng nổi bật. Nhấn 1 bộ để phân tích chi tiết + chữ liên quan.</p>
    <div class="panel">
      <div class="toolbar">
        <input class="txt" id="radIn" style="flex:1;min-width:200px" placeholder="Tra 1 chữ để tìm bộ thủ liên quan (vd 你, 河, 妈)...">
        <button class="btn primary" id="radGo">Tra</button>
      </div>
      <div id="radOut" style="margin-top:8px"></div>
    </div>
    <div class="panel">
      <h3>214 bộ thủ Khang Hy — xếp theo độ phổ biến</h3>
      <div class="chips" style="margin-bottom:10px">
        <span class="chip rad-hot" style="cursor:default">🔥 Top 1–10</span>
        <span class="chip rad-warm" style="cursor:default">Top 11–30</span>
        <span class="chip rad-mild" style="cursor:default">Top 31–60</span>
        <span class="chip" style="cursor:default">Còn lại (theo thứ tự Khang Hy)</span>
      </div>
      <div class="cards-grid" id="radGrid"></div>
    </div>`;
  const analyze=()=>{
    const t=($("#radIn").value||"").trim(); if(!t){ $("#radOut").innerHTML=""; return; }
    const ch=[...t][0];
    const found=Object.keys(RADICALS).filter(r=> r!==ch && (ch.includes(r) || (RADICALS[r].ex||"").split(/\s+/).includes(ch)));
    const info=D.chars[ch];
    $("#radOut").innerHTML=`
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span class="han-cell" style="font-size:34px">${esc(ch)}</span>
        <span class="pin-cell">${esc(D.charPinyin[ch]||"")}</span>
        <span style="color:var(--warn)">🗣️ ${esc(amBoiSyllable(D.charPinyin[ch]||""))}</span>
        ${info?`<span><b>${esc(info.hv)}</b> · ${esc(info.g)}</span>`:""}
        <button class="mini" onclick="speak('${esc(ch)}')">🔊</button>
      </div>
      <div style="margin-top:8px"><b>Bộ thủ nhận diện:</b> ${found.length?found.sort((a,b)=>radRank(a)-radRank(b)).map(r=>`<span class="chip rad-chip ${radRankClass(radRank(r))}" data-r="${esc(r)}">${radRank(r)<9999?'#'+radRank(r)+' ':''}${esc(r)} · ${esc(RADICALS[r].hv)} (${esc(RADICALS[r].m)})</span>`).join(" "):'<span class="sub">Không khớp bộ thủ nào trong danh sách (chữ có thể là bộ thủ độc lập).</span>'}</div>
      ${charBreakdownHTML(ch)}`;
    $$(".rad-chip",$("#radOut")).forEach(c=>c.onclick=()=>showRadical(c.dataset.r));
  };
  $("#radGo").onclick=analyze; $("#radIn").onkeydown=e=>{if(e.key==="Enter")analyze();};
  const ordered=Object.entries(RADICALS).sort((a,b)=>radRank(a[0])-radRank(b[0]));
  let kangxiNo=0;
  $("#radGrid").innerHTML=ordered.map(([r,i])=>{
    const rk=radRank(r); const cls=radRankClass(rk); kangxiNo++;
    const badge = rk<9999
      ? `<span class="rad-rank ${cls}">#${rk}${rk<=10?' 🔥':''}</span>`
      : `<span class="rad-rank" style="background:var(--chip);color:var(--muted)">Khang Hy</span>`;
    return `<div class="vcard rad-card ${cls}" data-r="${esc(r)}">
      ${badge}
      <div class="han">${esc(r)}</div>
      <div class="vi"><b>${esc(i.hv)}</b></div>
      <div class="topic">${esc(i.m)}</div>
    </div>`;
  }).join("");
  $$(".rad-card").forEach(c=>c.onclick=()=>showRadical(c.dataset.r));
};
function showRadical(r){
  const info=RADICALS[r];
  const rk=radRank(r);
  const rkText = rk<=10?"🔥 Rất phổ biến (top 10)" : rk<=30?"Phổ biến (top 30)" : rk<=60?"Khá gặp (top 60)" : rk<9999?("Hạng #"+rk) : "Ít gặp (theo thứ tự Khang Hy)";
  const py=D.charPinyin[r]||"";
  // chữ ví dụ mang bộ này (danh sách curated), phân tích chi tiết
  const exChars=(info.ex||"").split(/\s+/).filter(Boolean);
  const cardFor=(ch)=>{ const w=findWord(ch)||{han:ch}; const ci=D.chars[ch];
    return `<div class="vcard" onclick="openMemoryGuide('${esc(ch)}')" title="Bấm xem chiết tự/cách nhớ">
      <div class="han" style="font-size:26px">${esc(ch)}</div>
      <div class="pin">${esc(D.charPinyin[ch]||"")} · <span style="color:var(--warn)">${esc(amBoiSyllable(D.charPinyin[ch]||""))}</span></div>
      <div class="vi">${esc((ci&&ci.hv?ci.hv+" — ":"")+(w.vi||(ci&&ci.g)||""))}</div></div>`; };
  const words=allVocab().filter(v=>v.han.length>1 && [...v.han].some(c=>exChars.includes(c))).slice(0,40);
  $("#modalCard").innerHTML=`
    <button class="close-x" onclick="closeModal()">×</button>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div class="detail-han">${esc(r)}</div>
      <div>
        <div class="detail-pin">${esc(info.hv)}${py?` · ${esc(py)}`:""}</div>
        <div style="font-size:17px">Nghĩa gốc: <b>${esc(info.m)}</b></div>
        <div style="margin-top:4px"><span class="rad-rank ${radRankClass(rk)}">${rk<9999?'#'+rk:'Khang Hy'}</span> <span class="sub">${rkText}</span></div>
      </div>
    </div>
    <div class="detail-row"><div class="lab">📖 Phân tích</div>
      <div class="sub">Chữ nào mang bộ <b>${esc(r)}</b> thường liên quan đến <b>“${esc(info.m)}”</b>. Khi gặp chữ lạ có bộ này, hãy đoán nghĩa theo hướng đó rồi kiểm chứng. Bấm mỗi chữ bên dưới để xem chiết tự &amp; cách nhớ.</div>
    </div>
    ${exChars.length?`<div class="detail-row"><div class="lab">🀄 Chữ mang bộ ${esc(r)} (${exChars.length}) — bấm để phân tích</div>
      <div class="cards-grid">${exChars.map(cardFor).join("")}</div></div>`:`<div class="detail-row"><div class="sub">Chưa có danh sách chữ ví dụ sẵn cho bộ này.</div></div>`}
    ${words.length?`<div class="detail-row"><div class="lab">🔗 Từ liên quan trong kho (${words.length})</div>
      <div class="cards-grid">${words.map(v=>`<div class="vcard" onclick="openMemoryGuide('${esc(v.han)}')">
        <div class="han" style="font-size:24px">${esc(v.han)}</div><div class="pin">${esc(v.pinyin||toPinyin(v.han))} · <span style="color:var(--warn)">${esc(amBoiForHan(v.han))}</span></div>
        <div class="vi">${esc(v.vi||"")}</div></div>`).join("")}</div></div>`:""}`;
  $("#modal").classList.remove("hidden");
}

/* biểu đồ cột 14 ngày (ôn tập · từ mới · ôn câu) */
function chart14HTML(){
  const days=[]; for(let i=13;i>=0;i--){ const d=new Date(Date.now()-i*DAY_MS); days.push(d.toISOString().slice(0,10)); }
  const data=days.map(d=>progress.history[d]||{reviews:0,newLearned:0,sent:0});
  const max=Math.max(1, ...data.map(h=>Math.max(h.reviews,h.newLearned,h.sent)));
  const H=110, W=Math.max(320, days.length*40);
  let bars="";
  data.forEach((h,i)=>{
    const x=i*(W/days.length)+6, bw=(W/days.length)/4;
    const b=(v,off,col)=>`<rect x="${(x+off).toFixed(1)}" y="${(H-v/max*H).toFixed(1)}" width="${bw.toFixed(1)}" height="${(v/max*H).toFixed(1)}" fill="${col}" rx="1.5"/>`;
    bars+=b(h.reviews,0,"var(--brand)")+b(h.newLearned,bw+1,"var(--accent)")+b(h.sent,2*bw+2,"var(--ok)");
    if(i%2===0) bars+=`<text x="${(x+bw).toFixed(1)}" y="${H+12}" font-size="8" fill="var(--muted)" text-anchor="middle">${days[i].slice(5)}</text>`;
  });
  const total=data.reduce((a,h)=>({r:a.r+h.reviews,n:a.n+h.newLearned,s:a.s+h.sent}),{r:0,n:0,s:0});
  return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H+18}" width="100%" style="min-width:${W}px;max-width:640px">${bars}</svg></div>
    <div class="chips" style="margin-top:8px">
      <span class="chip" style="background:var(--brand);color:#fff">■ Ôn tập: ${total.r}</span>
      <span class="chip" style="background:var(--accent);color:#fff">■ Từ mới: ${total.n}</span>
      <span class="chip" style="background:var(--ok);color:#fff">■ Ôn câu: ${total.s}</span>
    </div>`;
}

/* ---------- Stats ---------- */
RENDER.stats = () => {
  const byLevel={}, byTopic={};
  D.vocab.forEach(v=>{byLevel[v.level]=(byLevel[v.level]||0)+1; if(v.topic)byTopic[v.topic]=(byTopic[v.topic]||0)+1;});
  const learned=Object.keys(progress.learned).length;
  const bar=(obj)=>{
    const max=Math.max(...Object.values(obj));
    return Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
      <div style="margin:8px 0">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(k)}</span><b>${v}</b></div>
        <div style="height:10px;background:var(--chip);border-radius:8px;overflow:hidden">
          <i style="display:block;height:100%;width:${v/max*100}%;background:var(--brand)"></i></div>
      </div>`).join("");
  };
  $("#view").innerHTML = `
    <h2 class="section-h">Thống kê</h2>
    <div class="stat-grid">
      <div class="stat"><div class="n">${learned}</div><div class="l">Từ đã thuộc</div></div>
      <div class="stat"><div class="n">${(learned/allVocab().length*100).toFixed(1)}%</div><div class="l">Tiến độ</div></div>
      <div class="stat"><div class="n">${srsCounts().mature}</div><div class="l">Nhớ lâu (SRS)</div></div>
      <div class="stat"><div class="n">${progress.quizStats.correct}/${progress.quizStats.total||0}</div><div class="l">Điểm kiểm tra</div></div>
      <div class="stat"><div class="n">${progress.listenStats.correct}/${progress.listenStats.total||0}</div><div class="l">Điểm luyện nghe</div></div>
      <div class="stat"><div class="n">${progress.myWords.length}</div><div class="l">Từ tự thêm 🎬</div></div>
    </div>
    <div class="panel"><h3>📊 Tiến độ 14 ngày</h3>${chart14HTML()}</div>
    <div class="panel"><h3>Từ vựng theo cấp độ</h3>${bar(byLevel)}</div>
    <div class="panel"><h3>Từ vựng theo chủ đề</h3>${bar(byTopic)}</div>
    <div class="panel"><h3>Nguồn tài liệu (số câu/mục trích xuất)</h3>
      <div class="table-wrap" style="box-shadow:none"><table><thead><tr><th>#</th><th>Nguồn</th><th>Số câu/mục</th><th>Ghi chú</th></tr></thead>
      <tbody>${D.stats.map(s=>`<tr><td>${esc(s.stt)}</td><td>${esc(s.source)}</td><td><b>${esc(s.count)}</b></td><td style="color:var(--muted)">${esc(s.note)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <div class="panel"><h3>Quản lý dữ liệu</h3>
      <div class="toolbar">
        <button class="btn" id="expBtn">⬇ Xuất tiến độ (JSON)</button>
        <button class="btn" id="resetBtn">🗑 Đặt lại tiến độ</button>
      </div></div>`;
  $("#expBtn").onclick=()=>{
    const blob=new Blob([JSON.stringify(progress,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="tien-do-hsk.json"; a.click();
  };
  $("#resetBtn").onclick=()=>{ if(confirm("Xóa toàn bộ tiến độ học (kể cả từ tự thêm & Room)? Cài đặt (API key, giọng) được giữ lại.")){ const keep=progress.settings; progress={learned:{},srs:{},quizStats:{correct:0,total:0},listenStats:{correct:0,total:0},myWords:[],rooms:[],settings:keep,daily:{date:"",reviews:0,listens:0,newLearned:0},streak:{count:0,best:0,lastDate:""},goal:{reviews:20,newWords:10},playCount:{},studyCount:{},history:{},sentSrs:{},dailyList:{date:"",words:[],sents:[]},links:[],examBest:0,saved:{}}; save(); RENDER.stats(); toast("Đã đặt lại"); } };
};

/* ---------- Utils ---------- */
function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

/* ---------- Global search ---------- */
$("#globalSearch").addEventListener("input", e=>{
  const q=e.target.value;
  vocabFilter.q=q;
  if(q && current!=="vocab"){ go("vocab"); $("#globalSearch").focus(); }
  else if(current==="vocab") drawVocab();
});

/* ---------- Theme ---------- */
function initTheme(){
  const saved=localStorage.getItem("hsk_theme");
  if(saved) document.documentElement.setAttribute("data-theme",saved);
  else if(matchMedia("(prefers-color-scheme:dark)").matches) document.documentElement.setAttribute("data-theme","dark");
}
$("#themeBtn").onclick=()=>{
  const cur=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",cur); localStorage.setItem("hsk_theme",cur);
};
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");

/* ---------- Boot ---------- */
initTheme();
buildNav();
go(location.hash.slice(1) && PAGES.some(p=>p.id===location.hash.slice(1)) ? location.hash.slice(1) : "home");
window.closeModal=closeModal; window.speak=speak; window.toggleLearned=toggleLearned; window.toast=toast; window.RENDER=RENDER; window.openYouglish=openYouglish;
setTimeout(checkReminder, 4000);           // nhắc bù khi mở app sau giờ
setInterval(checkReminder, 60000);         // kiểm tra mỗi phút
