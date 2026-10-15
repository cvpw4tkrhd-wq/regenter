'use strict';
/* Sveriges regenter – appen.
   All text och alla uppgifter ligger i data/. Den här filen innehåller bara logiken. */
(() => {
const NOW = new Date().getFullYear();
const KEY = 'svenska-regenter-v1';
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CROWN = '<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path fill="currentColor" d="M136 342 108 192l84 70 64-116 64 116 84-70-28 150z"/><rect fill="currentColor" x="132" y="356" width="248" height="46" rx="10"/><circle fill="currentColor" cx="108" cy="178" r="22"/><circle fill="currentColor" cx="256" cy="130" r="24"/><circle fill="currentColor" cx="404" cy="178" r="22"/></svg>';
const TRE_KRONOR = '<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><defs><g id="kr3"><path d="M136 342 108 192l84 70 64-116 64 116 84-70-28 150z"/><rect x="132" y="356" width="248" height="46" rx="10"/><circle cx="108" cy="178" r="22"/><circle cx="256" cy="130" r="24"/><circle cx="404" cy="178" r="22"/></g></defs><g fill="currentColor"><use href="#kr3" transform="translate(153 175) scale(.5) translate(-256 -254)"/><use href="#kr3" transform="translate(359 175) scale(.5) translate(-256 -254)"/><use href="#kr3" transform="translate(256 345) scale(.5) translate(-256 -254)"/></g></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/></svg>';
const PAL = {
  'säker': { t: 'Säker', c: 'saker', d: 'Väl belagd i samtida eller nära samtida källor.' },
  'osäker': { t: 'Osäker', c: 'osaker', d: 'Källorna är få, sena eller motsägelsefulla, och uppgifterna är omstridda.' },
  'legendarisk': { t: 'Legendarisk', c: 'legend', d: 'Känd främst genom sagor och sena traditioner.' }
};

/* ---------- Lagrat läge (läst, bokmärken, läsposition) ---------- */
const defState = () => ({ lasta: {}, bokmarken: [], pos: {}, senast: null, storlek: 1 });
let S;
try { S = Object.assign(defState(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = defState(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* privat läge */ } };
const isRead = id => !!S.lasta[id];
const findBm = (id, sek) => S.bokmarken.find(b => b.id === id && b.sek === sek);
document.documentElement.style.setProperty('--lasstorlek', S.storlek);

/* ---------- Data ---------- */
const D = { hus: {}, epoker: [], R: [], byId: {}, H: [], hById: {}, O: [], oById: {}, REL: {}, M: [], F: [] };
async function getJSON(p) { const r = await fetch(p); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }
const start = r => r.perioder[0][0];
const slut = r => { const p = r.perioder[r.perioder.length - 1]; return p[1] ?? NOW; };
const reignYears = r => (r.osakerLangd ? 0 : r.perioder.reduce((s, [a, b]) => s + ((b ?? NOW) - a), 0));
const isMon = r => r.titel !== 'Riksföreståndare';
const eraFor = y => D.epoker.find(e => y >= e.fran && y < e.till) || D.epoker[D.epoker.length - 1];
const reignText = r => r.regeringstext ? r.regeringstext : r.perioder.map(([a, b]) => `${r.ca ? 'ca ' : ''}${a}–${b == null ? '' : b}`).join(' och ');
const lifeText = r => {
  const f = r.fodd ? `${r.foddCa ? 'ca ' : ''}${r.fodd}` : '?';
  const d = r.levande ? '' : (r.dod ? `${r.dodCa ? 'ca ' : ''}${r.dod}` : '?');
  return `${f}–${d}`;
};
const words = r => (r.berattelse || []).reduce((s, x) => s + x.text.split(/\s+/).length, 0);
const readMins = r => Math.max(1, Math.round(words(r) / 190));
const pages = r => Math.max(1, Math.round(words(r) / 450));
const accession = r => start(r);
const ageAtAcc = r => (r.fodd ? accession(r) - r.fodd : null);
const ageAtDeath = r => (r.fodd && r.dod ? r.dod - r.fodd : null);

async function load() {
  const idx = await getJSON('data/index.json');
  idx.hus.forEach(h => { D.hus[h.id] = h; });
  D.epoker = idx.epoker;
  const files = await Promise.all(idx.filer.map(f => getJSON('data/regenter/' + f)));
  let n = 0;
  files.forEach(f => f.regenter.forEach(r => { r._ord = n++; D.R.push(r); }));
  D.R.sort((a, b) => start(a) - start(b) || a._ord - b._ord);
  D.R.forEach(r => { D.byId[r.id] = r; if (!D.hus[r.hus]) D.hus[r.hus] = { id: r.hus, namn: r.hus, farg: '#777' }; });
  const [hd, od] = await Promise.all([
    getJSON('data/handelser.json').catch(() => ({ handelser: [] })),
    getJSON('data/ordlista.json').catch(() => ({ ord: [] }))
  ]);
  D.H = hd.handelser.sort((a, b) => a.ar - b.ar); D.H.forEach(h => { D.hById[h.id] = h; });
  D.O = od.ord.sort((a, b) => a.term.localeCompare(b.term, 'sv')); D.O.forEach(o => { D.oById[o.id] = o; });
  derive();
}
function derive() {
  D.M = D.R.filter(isMon); D.F = D.R.filter(r => !isMon(r));
  const norm = x => (typeof x === 'string' ? { id: x } : x);
  const add = (id, kind, item) => {
    const rec = D.REL[id] || (D.REL[id] = { foralder: [], make: [], barn: [], relaterade: [] });
    const key = item.id || item.namn;
    if (!rec[kind].some(x => (x.id || x.namn) === key)) rec[kind].push(item);
  };
  D.R.forEach(r => {
    (r.foralder || []).map(norm).forEach(p => { add(r.id, 'foralder', p); if (p.id && D.byId[p.id]) add(p.id, 'barn', { id: r.id }); });
    (r.barn || []).map(norm).forEach(c => { add(r.id, 'barn', c); if (c.id && D.byId[c.id]) add(c.id, 'foralder', { id: r.id }); });
    (r.make || []).map(norm).forEach(m => { add(r.id, 'make', m); if (m.id && D.byId[m.id]) add(m.id, 'make', { id: r.id }); });
    (r.relaterade || []).forEach(x => { add(r.id, 'relaterade', x); if (D.byId[x.id] && x.omvand) add(x.id, 'relaterade', { id: r.id, relation: x.omvand }); });
  });
  D.R.forEach(r => {
    r._s = [r.namn, r.titel, D.hus[r.hus].namn, r.ingress, (r.berattelse || []).map(s => s.rubrik + ' ' + s.text).join(' ')].join(' ').toLowerCase();
  });
}
const rel = id => D.REL[id] || { foralder: [], make: [], barn: [], relaterade: [] };
function neighbours(r) {
  const line = isMon(r) ? D.M : D.F; const i = line.indexOf(r);
  return { fore: r.foregangare ? D.byId[r.foregangare] : line[i - 1], efter: r.efterfoljare ? D.byId[r.efterfoljare] : line[i + 1] };
}

/* ---------- Små byggstenar ---------- */
const hcol = r => D.hus[r.hus].farg;
const palBadge = r => { const p = PAL[r.palitlighet || 'osäker']; return `<span class="pal pal-${p.c}" title="${esc(p.d)}">${p.t}</span>`; };
function fmt(text) {
  return esc(text).replace(/\[\[(?:(h|o):)?([^|\]]+)\|([^\]]+)\]\]/g, (m, k, id, t) => {
    if (!k) return D.byId[id] ? `<a class="xl" href="#/regent/${id}">${t}</a>` : t;
    if (k === 'h') return D.hById[id] ? `<a class="xl xh" href="#/handelse/${id}">${t}</a>` : t;
    return D.oById[id] ? `<abbr class="xo" tabindex="0" title="${esc(D.oById[id].forklaring)}">${t}</abbr>` : t;
  });
}
function persList(items) {
  if (!items || !items.length) return '<span class="mut">Saknas ännu</span>';
  return items.map(x => {
    if (x.id && D.byId[x.id]) return `<a class="pl" href="#/regent/${x.id}">${esc(D.byId[x.id].namn)}</a>${x.relation ? ` <span class="mut">(${esc(x.relation)})</span>` : ''}`;
    return `<span>${esc(x.namn || x.id)}${x.anm ? ` <span class="mut">(${esc(x.anm)})</span>` : ''}</span>`;
  }).join(', ');
}
function portrait(r, big) {
  const p = r.portratt;
  const src = p ? (p.url || `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.fil)}?width=${big ? 720 : 240}`) : '';
  const cap = p
    ? `${esc(p.beskrivning || 'Porträtt')}. ${p.kredit ? esc(p.kredit) + '. ' : ''}${p.licens ? 'Licens: ' + esc(p.licens) + '. ' : ''}${p.kalla ? `<a href="${esc(p.kalla)}" target="_blank" rel="noopener">Källa</a>` : ''}`
    : 'Porträtt saknas. Kronan visas tills en fri bild har granskats.';
  return `<figure class="port" style="--c:${hcol(r)}"><div class="port-ram"><span class="port-krona">${CROWN}</span>${p ? `<img src="${esc(src)}" alt="Porträtt av ${esc(r.namn)}" decoding="async" referrerpolicy="no-referrer">` : ''}</div>${big ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
}
function toast(msg, label, fn) {
  const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button type="button">${esc(label)}</button>` : ''}`;
  if (label) $('button', t).onclick = () => { t.classList.remove('visa'); fn && fn(); };
  t.classList.add('visa'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('visa'), label ? 7000 : 3200);
}
document.addEventListener('error', e => { if (e.target.tagName === 'IMG' && e.target.closest('.port-ram')) e.target.remove(); }, true);

/* ---------- Router ---------- */
const app = $('#app');
let post = null;
const routes = [
  [/^$/, pHem], [/^tidslinje$/, pTidslinje], [/^regent\/([^/]+)$/, pRegent], [/^slakttrad(?:\/([^/]+))?$/, pSlakt],
  [/^handelser$/, pHandelser], [/^handelse\/([^/]+)$/, pHandelse], [/^jamfor$/, pJamfor], [/^statistik$/, pStat],
  [/^quiz$/, pQuiz], [/^ordlista$/, pOrd], [/^bokmarken$/, pBokm], [/^sok$/, pSok], [/^mer$/, pMer], [/^om$/, pOm]
];
function route() {
  stopSpeech();
  window.removeEventListener('scroll', onScroll); $('#lasstreck').style.width = '0';
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?'); const P = new URLSearchParams(qs || '');
  const clean = decodeURIComponent(path).replace(/\/$/, '');
  let hit = null;
  for (const [re, fn] of routes) { const m = clean.match(re); if (m) { hit = [fn, m.slice(1)]; break; } }
  post = null; document.title = 'Sveriges regenter';
  app.innerHTML = hit ? hit[0](...hit[1], P) : `<div class="sida"><h1>Sidan finns inte</h1><p><a href="#/">Till startsidan</a></p></div>`;
  const seg = clean.split('/')[0];
  const map = { regent: 'tidslinje', handelse: 'handelser' };
  let key = map[seg] ?? seg; if (!['', 'tidslinje', 'slakttrad', 'handelser', 'mer'].includes(key)) key = 'mer';
  $$('.nav a').forEach(a => { a.dataset.nav === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  if (post) post(P);
}
window.addEventListener('hashchange', route);

/* ---------- Hem ---------- */
function band() {
  const MIN = 950, MAX = NOW + 5, span = MAX - MIN;
  let h = '<div class="bandram"><div class="bandyta" role="list" aria-label="Alla regenters regeringstider på en tidsaxel">';
  D.R.forEach(r => r.perioder.forEach(([a, b]) => {
    const e = b ?? NOW;
    h += `<a role="listitem" data-id="${r.id}" class="bb${isMon(r) ? '' : ' rf'}${isRead(r.id) ? ' last' : ''}" style="left:${(a - MIN) / span * 100}%;width:${Math.max((e - a) / span * 100, .3)}%;--c:${hcol(r)}" href="#/regent/${r.id}" title="${esc(r.namn)} ${esc(reignText(r))}"></a>`;
  }));
  for (let y = 1000; y <= 2000; y += 100) h += `<span class="tick" style="left:${(y - MIN) / span * 100}%">${y}</span>`;
  return h + '</div></div>';
}
function counts() { return { done: D.R.filter(r => isRead(r.id)).length, tot: D.R.length }; }
function pHem() {
  const { done, tot } = counts();
  const sen = S.senast && D.byId[S.senast.id];
  const first = D.R[0];
  const usedHus = Object.keys(D.hus).filter(id => D.R.some(r => r.hus === id));
  const legend = usedHus.map(id => {
    const rs = D.R.filter(r => r.hus === id), n = rs.filter(r => isRead(r.id)).length;
    return `<li><a href="#/tidslinje?hus=${id}"><i class="prick" style="--c:${D.hus[id].farg}"></i>${esc(D.hus[id].namn)} <b data-hus-count="${id}">${n}/${rs.length}</b></a></li>`;
  }).join('');
  let forts;
  if (sen && !isRead(sen.id)) {
    const f = (S.pos[sen.id] || {}).f || 0;
    forts = `<h2>Fortsätt läsa</h2><p><strong>${esc(sen.namn)}</strong>${f > .02 ? `, du har läst ${Math.round(f * 100)} %` : ''}</p><p><a class="knapp" href="#/regent/${sen.id}">${f > .02 ? 'Fortsätt där du slutade' : 'Läs berättelsen'}</a></p>`;
  } else {
    const nxt = D.R.find(r => !isRead(r.id));
    forts = nxt ? `<h2>${done ? 'Nästa att läsa' : 'Börja från början'}</h2><p><strong>${esc(nxt.namn)}</strong> ${esc(reignText(nxt))}</p><p><a class="knapp" href="#/regent/${nxt.id}">Läs berättelsen</a></p>` : `<h2>Allt läst</h2><p>Du har läst om alla regenter.</p>`;
  }
  const bm = S.bokmarken.slice(0, 3).map(b => { const r = D.byId[b.id]; return r ? `<li><a href="#/regent/${r.id}${b.sek >= 0 ? '?sek=' + b.sek : ''}">${esc(r.namn)}</a> <span class="mut">${esc(b.etikett || '')}</span></li>` : ''; }).join('');
  const d = new Date(), mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const idag = [];
  D.H.filter(h => h.datum === mmdd).forEach(h => idag.push(`<li><a href="#/handelse/${h.id}">${esc(h.namn)}</a> <span class="mut">${h.ar}</span></li>`));
  D.R.forEach(r => { if ((r.foddDatum || '').slice(5) === mmdd) idag.push(`<li><a href="#/regent/${r.id}">${esc(r.namn)}</a> <span class="mut">föddes ${r.foddDatum.slice(0, 4)}</span></li>`); if ((r.dodDatum || '').slice(5) === mmdd) idag.push(`<li><a href="#/regent/${r.id}">${esc(r.namn)}</a> <span class="mut">dog ${r.dodDatum.slice(0, 4)}</span></li>`); });
  const mer = [
    ['#/tidslinje', 'Tidslinje', 'Alla regenter i tidsordning, med händelser och epoker.'],
    ['#/slakttrad', 'Släktträd', 'Föräldrar, makar och barn. Klicka dig vidare mellan släkterna.'],
    ['#/handelser', 'Händelser', 'Slag, fredsavtal och statskupper, kopplade till regenterna.'],
    ['#/jamfor', 'Jämför två regenter', 'Regeringstid, ålder och efterträdare sida vid sida.'],
    ['#/statistik', 'Rekord och statistik', 'Längsta regeringstid, yngsta tronföljare och mer.'],
    ['#/quiz', 'Quiz', 'Frågor på svenska om regenter och årtal.'],
    ['#/ordlista', 'Ordlista', 'Riksföreståndare, interregnum och andra ord.'],
    ['#/bokmarken', 'Bokmärken', 'Platser du har sparat i berättelserna.']
  ].map(([h, t, s]) => `<li><a href="${h}"><strong>${t}</strong><span>${s}</span></a></li>`).join('');
  return `
  <section class="hero" aria-labelledby="h1">
    <div class="hero-in">
      <div class="hero-vbar"></div><div class="hero-hbar"></div>
      <div class="hero-krona" aria-hidden="true">${TRE_KRONOR}</div>
      <div class="hero-top"><h1 id="h1">Sveriges regenter</h1></div>
      <div class="hero-bot"><p>Tusen år av kungar och drottningar, och en berättelse om var och en.</p></div>
    </div>
  </section>
  <div class="sida">
    <section class="avd" style="margin-top:0">
      <div class="rubrikrad"><h2>Tusenårsbandet</h2><p class="mut" id="framsteg">${done} av ${tot} regenter lästa</p></div>
      ${band()}
      <p class="bandtext">Varje block är en regents regeringstid. De smalare blocken på den nedre raden <i></i> är riksföreståndare, som styrde riket utan att vara kung. De ligger på en egen rad eftersom deras tid ofta överlappar kungarnas, till exempel Sten Sture den äldre 1470–1497 under Karl Knutsson, Kristian I och Hans. Luckorna visar tider utan kung.</p>
      <ul class="legend">${legend}</ul>
    </section>
    <div class="rader">
      <section class="ruta">${forts}</section>
      <section class="ruta"><h2>Bokmärken</h2>${bm ? `<ul>${bm}</ul><p><a href="#/bokmarken">Alla bokmärken</a></p>` : '<p class="mut">Inga bokmärken ännu. Tryck på bokmärket vid en rubrik i en berättelse.</p>'}</section>
      <section class="ruta"><h2>Idag i historien</h2>${idag.length ? `<ul>${idag.join('')}</ul>` : '<p class="mut">Inga händelser i databasen för dagens datum.</p>'}</section>
    </div>
    <section class="avd"><h2>Utforska</h2><ul class="utforska">${mer}</ul></section>
  </div>`;
}

/* ---------- Tidslinje ---------- */
const TL = { hus: new Set(), handelser: true, visa: 'alla' };
function tlHTML() {
  let items = D.R.filter(r => (!TL.hus.size || TL.hus.has(r.hus)) && (TL.visa === 'alla' || (TL.visa === 'lasta') === isRead(r.id))).map(r => ({ y: start(r), t: 0, r }));
  if (TL.handelser) {
    const ids = new Set(items.map(i => i.r.id));
    D.H.forEach(h => { if ((!TL.hus.size && TL.visa === 'alla') || (h.regenter || []).some(x => ids.has(x))) items.push({ y: h.ar, t: 1, h }); });
  }
  items.sort((a, b) => a.y - b.y || a.t - b.t);
  if (!items.length) return '<li class="mut">Inga regenter matchar filtret.</li>';
  let out = '', last = null;
  items.forEach(i => {
    const e = eraFor(i.y);
    if (e !== last) { last = e; out += `<li class="era"><h2>${esc(e.namn)}<span class="eraar">${e.fran}–${e.till > 3000 ? '' : e.till}</span></h2><details><summary>Tidens sammanhang</summary><p>${esc(e.text)}</p></details></li>`; }
    if (i.t === 0) {
      const r = i.r;
      out += `<li class="rad${isMon(r) ? '' : ' rf'}${isRead(r.id) ? ' last' : ''}" data-id="${r.id}" style="--c:${hcol(r)}">
        <span class="ar">${r.ca ? 'ca ' : ''}${i.y}</span>
        <a class="kort" href="#/regent/${r.id}"><span class="namn">${esc(r.namn)}</span><span class="under"><span>${esc(r.titel)}</span><span>${esc(D.hus[r.hus].namn)}</span><span>${esc(reignText(r))}</span>${palBadge(r)}${r.berattelse && r.berattelse.length ? `<span>${readMins(r)} min</span>` : ''}</span></a>
        <button type="button" class="kryss" data-act="las" data-las="${r.id}" aria-pressed="${isRead(r.id)}" aria-label="Läst: ${esc(r.namn)}" title="Markera som läst">${CHECK}</button></li>`;
    } else {
      const h = i.h;
      out += `<li class="rad hand" style="--c:var(--text)"><span class="ar">${h.ar}</span><a class="kort" href="#/handelse/${h.id}"><span class="namn">${esc(h.namn)}</span></a><span></span></li>`;
    }
  });
  return out;
}
function pTidslinje(P) {
  if (P && P.get('hus')) TL.hus = new Set([P.get('hus')]);
  const used = Object.keys(D.hus).filter(id => D.R.some(r => r.hus === id));
  post = () => {
    const el = $('#tl-lista');
    $('#tl-hus').addEventListener('click', e => {
      const b = e.target.closest('[data-hus]'); if (!b) return;
      const id = b.dataset.hus; TL.hus.has(id) ? TL.hus.delete(id) : TL.hus.add(id);
      $$('#tl-hus [data-hus]').forEach(x => x.setAttribute('aria-pressed', TL.hus.has(x.dataset.hus)));
      el.innerHTML = tlHTML();
    });
    $('#tl-ev').addEventListener('change', e => { TL.handelser = e.target.checked; el.innerHTML = tlHTML(); });
    $('#tl-visa').addEventListener('change', e => { TL.visa = e.target.value; el.innerHTML = tlHTML(); });
    $('#tl-alla').addEventListener('click', () => { TL.hus.clear(); $$('#tl-hus [data-hus]').forEach(x => x.setAttribute('aria-pressed', 'false')); el.innerHTML = tlHTML(); });
  };
  return `<div class="sida"><div class="sidhuvud"><h1>Tidslinje</h1><p>Alla regenter i tidsordning. Färgen visar ätten. Kryssrutan till höger markerar att du har läst om regenten.</p></div>
  <div class="filter" id="tl-hus" role="group" aria-label="Filtrera på ätt">${used.map(id => `<button type="button" class="chip" data-hus="${id}" aria-pressed="${TL.hus.has(id)}"><i class="prick" style="--c:${D.hus[id].farg}"></i>${esc(D.hus[id].namn)}</button>`).join('')}<button type="button" class="chip" id="tl-alla">Visa alla ätter</button></div>
  <div class="filter"><label class="chip"><input type="checkbox" id="tl-ev" ${TL.handelser ? 'checked' : ''}> Visa händelser</label>
  <label>Visa <select id="tl-visa"><option value="alla" ${TL.visa === 'alla' ? 'selected' : ''}>Alla</option><option value="olasta" ${TL.visa === 'olasta' ? 'selected' : ''}>Olästa</option><option value="lasta" ${TL.visa === 'lasta' ? 'selected' : ''}>Lästa</option></select></label></div>
  <ol class="tl" id="tl-lista">${tlHTML()}</ol></div>`;
}

/* ---------- Regentsida ---------- */
let cur = null, scrollT = 0, nudged = false;
function pRegent(id, P) {
  const r = D.byId[id];
  if (!r) return `<div class="sida"><h1>Regenten finns inte</h1><p><a href="#/tidslinje">Till tidslinjen</a></p></div>`;
  S.senast = { id, ts: Date.now() }; save();
  cur = r; nudged = false;
  const rl = rel(id), nb = neighbours(r), era = eraFor(start(r));
  const idx = D.R.indexOf(r), prev = D.R[idx - 1], next = D.R[idx + 1];
  const evs = D.H.filter(h => (h.regenter || []).includes(id));
  const hasStory = r.berattelse && r.berattelse.length;
  const age = ageAtAcc(r), dage = ageAtDeath(r);
  const sections = hasStory ? r.berattelse.map((s, i) => `<section data-sek="${i}" id="sek-${i}"><h2 data-tal>${esc(s.rubrik)}<button type="button" class="bokm" data-act="bokm" data-id="${id}" data-sek="${i}" aria-pressed="${!!findBm(id, i)}" aria-label="Bokmärk: ${esc(s.rubrik)}" title="Bokmärk här">${FLAG}</button></h2>${s.text.split(/\n\s*\n/).map(p => `<p data-tal>${fmt(p)}</p>`).join('')}</section>`).join('') : '';
  const kallor = (r.kallor || []).map(k => `<li>${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.titel)}</a>` : esc(k.titel)}${k.utgivare ? `, ${esc(k.utgivare)}` : ''} <span class="mut">${k.kontrollerad ? '(kontrollerad)' : '(ska kontrolleras)'}</span></li>`).join('');
  post = P2 => { trackReading(r, P2); };
  return `<article class="regent" style="--c:${hcol(r)}">
  <header class="rhuvud" style="--c:${hcol(r)}"><div class="rhuvud-in">
    ${portrait(r, true)}
    <div>
      <h1>${esc(r.namn)}</h1>
      <p class="titel">${esc(r.titel)}, ${esc(D.hus[r.hus].namn)}</p>
      <p>${palBadge(r)} <span style="margin-left:.4rem;color:#cfdeec">${esc(reignText(r))}</span></p>
      <div class="verktyg">
        <button type="button" class="vk" data-act="las" data-las="${id}" aria-pressed="${isRead(id)}">${CHECK}<span data-lastext>${isRead(id) ? 'Läst' : 'Markera som läst'}</span></button>
        <button type="button" class="vk" data-act="bokm" data-id="${id}" data-sek="-1" aria-pressed="${!!findBm(id, -1)}">${FLAG}Bokmärk</button>
        ${hasStory ? `<button type="button" class="vk" data-act="lyssna" id="lyssnaknapp">Lyssna</button><button type="button" class="vk" data-act="stoppa" id="stoppknapp" hidden>Stopp</button>` : ''}
        <button type="button" class="vk" data-act="storlek" data-d="-1" aria-label="Mindre text">A−</button>
        <button type="button" class="vk" data-act="storlek" data-d="1" aria-label="Större text">A+</button>
      </div>
    </div></div></header>
  <div class="rkropp">
    <div>
      ${r.status !== 'verifierad' ? `<aside class="utkast"><strong>Utkast.</strong> ${hasStory ? 'Texten och uppgifterna är ännu inte kontrollerade mot källorna längst ned.' : 'Grunddata, ännu inte kontrollerad mot källor.'} ${r.anm ? esc(r.anm) : ''}</aside>` : (r.anm ? `<p class="liten">${esc(r.anm)}</p>` : '')}
      ${hasStory ? `<p class="liten">Ungefär ${pages(r)} ${pages(r) === 1 ? 'sida' : 'sidor'}, cirka ${readMins(r)} minuters läsning.</p>
      ${r.berattelse.length > 2 ? `<ul class="innehall" aria-label="Innehåll">${r.berattelse.map((s, i) => `<li><a href="#/regent/${id}?sek=${i}" data-jump="${i}">${esc(s.rubrik)}</a></li>`).join('')}</ul>` : ''}
      <div class="story" id="story">
        ${r.ingress ? `<p class="ingress" data-tal>${fmt(r.ingress)}</p>` : ''}
        ${sections}
      </div>
      ${(r.fakta && r.fakta.length) ? `<aside class="fakta"><h2>Visste du att</h2><ul>${r.fakta.map(f => `<li>${fmt(f)}</li>`).join('')}</ul></aside>` : ''}`
      : `<div class="tom" id="story"><h2>Berättelsen skrivs</h2><p>${esc(r.namn)} har grunddata men ännu ingen berättelse. Berättelserna skrivs ätt för ätt, med källor som kontrolleras innan texten publiceras.</p>${r.ingress ? `<p>${fmt(r.ingress)}</p>` : ''}</div>`}
      <button type="button" class="klar" data-act="las" data-las="${id}" aria-pressed="${isRead(id)}"><span class="ruta-k">${CHECK}</span><span><strong>Jag har läst allt om ${esc(r.namn)}</strong><span class="mut" data-lastext2>${isRead(id) ? 'Markerad som läst' : 'Markera när du är klar'}</span></span></button>
      <div class="kallor"><h2>Källor</h2>${kallor ? `<ol>${kallor}</ol>` : '<p class="mut">Källor läggs in när berättelsen skrivs. Uppgifter ska bara komma från Svenskt biografiskt lexikon, Nationalencyklopedin, kungahuset.se, Riksarkivet och Historiska museet, med Wikipedia som sekundär kontroll.</p>'}</div>
      <nav class="bladdra" aria-label="Föregående och nästa">
        ${prev ? `<a href="#/regent/${prev.id}" style="--c:${hcol(prev)}"><small>Föregående i tidslinjen</small><strong>${esc(prev.namn)}</strong></a>` : '<span></span>'}
        ${next ? `<a href="#/regent/${next.id}" style="--c:${hcol(next)}"><small>Nästa i tidslinjen</small><strong>${esc(next.namn)}</strong></a>` : '<span></span>'}
      </nav>
    </div>
    <aside class="sida-kol">
      <section class="sidoruta"><h2>Fakta</h2><dl>
        <dt>Född</dt><dd>${r.fodd ? `${r.foddCa ? 'ca ' : ''}${r.fodd}` : '<span class="mut">Okänt</span>'}</dd>
        <dt>Död</dt><dd>${r.levande ? '<span class="mut">Lever</span>' : (r.dod ? `${r.dodCa ? 'ca ' : ''}${r.dod}${r.dodsatt ? ` <span class="mut">(${esc(r.dodsatt)})</span>` : ''}` : '<span class="mut">Okänt</span>')}</dd>
        <dt>Regeringstid</dt><dd>${esc(reignText(r))}${reignYears(r) > 0 ? `<span class="mut"> (${r.ca ? 'ca ' : ''}${reignYears(r)} år)</span>` : ''}</dd>
        ${age != null ? `<dt>Ålder vid tillträde</dt><dd>${age} år</dd>` : ''}
        ${dage != null ? `<dt>Ålder vid döden</dt><dd>${dage} år</dd>` : ''}
        <dt>Ätt</dt><dd><a href="#/tidslinje?hus=${r.hus}">${esc(D.hus[r.hus].namn)}</a></dd>
        <dt>Föregångare</dt><dd>${nb.fore ? `<a href="#/regent/${nb.fore.id}">${esc(nb.fore.namn)}</a>` : '<span class="mut">Ingen</span>'}</dd>
        <dt>Efterträdare</dt><dd>${nb.efter ? `<a href="#/regent/${nb.efter.id}">${esc(nb.efter.namn)}</a>` : '<span class="mut">Ingen</span>'}</dd>
        <dt>Föräldrar</dt><dd>${persList(rl.foralder)}</dd>
        <dt>Make/maka</dt><dd>${persList(rl.make)}</dd>
        <dt>Barn</dt><dd>${persList(rl.barn)}</dd>
        ${rl.relaterade.length ? `<dt>Släkt</dt><dd>${persList(rl.relaterade)}</dd>` : ''}
      </dl><p style="margin:.8rem 0 0"><a href="#/slakttrad/${id}">Visa släktträd</a> &nbsp; <a href="#/jamfor?a=${id}">Jämför med annan</a></p></section>
      <section class="sidoruta"><h2>Tidens sammanhang</h2><p><strong>${esc(era.namn)}</strong></p><p>${esc(era.text)}</p></section>
      ${evs.length ? `<section class="sidoruta"><h2>Händelser</h2><div class="chips">${evs.map(h => `<a href="#/handelse/${h.id}">${h.ar} ${esc(h.namn)}</a>`).join('')}</div></section>` : ''}
    </aside>
  </div></article>`;
}
function setReadUI(id) {
  const v = isRead(id);
  $$(`[data-las="${id}"]`).forEach(b => { b.setAttribute('aria-pressed', v); const t = $('[data-lastext]', b); if (t) t.textContent = v ? 'Läst' : 'Markera som läst'; const t2 = $('[data-lastext2]', b); if (t2) t2.textContent = v ? 'Markerad som läst' : 'Markera när du är klar'; });
  $$(`.rad[data-id="${id}"]`).forEach(el => el.classList.toggle('last', v));
  $$(`.bb[data-id="${id}"]`).forEach(el => el.classList.toggle('last', v));
  const { done, tot } = counts(); const f = $('#framsteg'); if (f) f.textContent = `${done} av ${tot} regenter lästa`;
  $$('[data-hus-count]').forEach(el => { const rs = D.R.filter(r => r.hus === el.dataset.husCount); el.textContent = `${rs.filter(r => isRead(r.id)).length}/${rs.length}`; });
}
function trackReading(r, P) {
  const story = $('#story'); if (!story) return;
  const hasStory = r.berattelse && r.berattelse.length;
  const absTop = () => story.getBoundingClientRect().top + window.scrollY;
  const sekParam = P && P.get('sek');
  if (hasStory && sekParam != null && $(`#sek-${sekParam}`)) {
    $(`#sek-${sekParam}`).scrollIntoView({ block: 'start' });
  } else if (hasStory && !isRead(r.id)) {
    const p = S.pos[r.id];
    if (p && p.f > .03 && p.f < .97) {
      window.scrollTo(0, Math.max(0, absTop() + p.f * story.offsetHeight - innerHeight * .3));
      toast('Du fortsätter där du slutade.', 'Börja om', () => { window.scrollTo(0, 0); delete S.pos[r.id]; save(); });
    }
  }
  if (!hasStory) return;
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
function onScroll() {
  if (!cur) return;
  const story = $('#story'); if (!story) return;
  const rect = story.getBoundingClientRect();
  const f = Math.min(1, Math.max(0, (innerHeight * .3 - rect.top) / Math.max(1, rect.height)));
  $('#lasstreck').style.width = (f * 100) + '%';
  clearTimeout(scrollT);
  scrollT = setTimeout(() => {
    if (!cur) return;
    S.pos[cur.id] = { f: Math.round(f * 1000) / 1000, ts: Date.now() }; save();
    if (f > .97 && !isRead(cur.id) && !nudged) { nudged = true; toast('Du har nått slutet.', 'Markera som läst', () => { S.lasta[cur.id] = Date.now(); save(); setReadUI(cur.id); }); }
  }, 350);
}

/* ---------- Lyssna (webbläsarens uppläsning, sv-SE) ---------- */
const SP = { on: false, paused: false, q: [], i: 0 };
function chunk(t) {
  const parts = t.match(/[^.!?]+[.!?]*\s*/g) || [t]; const out = []; let c = '';
  parts.forEach(p => { if ((c + p).length > 200 && c) { out.push(c); c = p; } else c += p; });
  if (c) out.push(c); return out;
}
function speakNext() {
  if (!SP.on) return;
  if (SP.i >= SP.q.length) { stopSpeech(); return; }
  const it = SP.q[SP.i];
  $$('.tal').forEach(e => e.classList.remove('tal')); it.el.classList.add('tal');
  if (it.first) { const b = it.el.getBoundingClientRect(); if (b.top < 80 || b.bottom > innerHeight - 60) it.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  const u = new SpeechSynthesisUtterance(it.text); u.lang = 'sv-SE'; u.rate = .95;
  const v = speechSynthesis.getVoices().find(x => /^sv/i.test(x.lang)); if (v) u.voice = v;
  u.onend = () => { if (SP.on && !SP.paused) { SP.i++; speakNext(); } };
  u.onerror = () => { if (SP.on) { SP.i++; speakNext(); } };
  speechSynthesis.speak(u);
}
function startSpeech() {
  if (!('speechSynthesis' in window)) { toast('Din webbläsare saknar uppläsning.'); return; }
  const els = $$('#story [data-tal]'); if (!els.length) return;
  let from = els.findIndex(e => e.getBoundingClientRect().top >= 60); if (from < 0) from = 0;
  SP.q = []; els.slice(from).forEach(el => chunk(el.textContent).forEach((t, k) => SP.q.push({ el, text: t, first: k === 0 })));
  SP.i = 0; SP.on = true; SP.paused = false; speechSynthesis.cancel(); updSpeechUI(); speakNext();
}
function stopSpeech() {
  if (SP.on || SP.paused) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  SP.on = false; SP.paused = false; $$('.tal').forEach(e => e.classList.remove('tal')); updSpeechUI();
}
function updSpeechUI() {
  const b = $('#lyssnaknapp'), s = $('#stoppknapp'); if (!b) return;
  b.textContent = !SP.on ? 'Lyssna' : SP.paused ? 'Fortsätt' : 'Pausa'; b.setAttribute('aria-pressed', SP.on && !SP.paused);
  s.hidden = !SP.on;
}

/* ---------- Släktträd ---------- */
function nod(x, fokus) {
  if (x.id && D.byId[x.id]) { const r = D.byId[x.id]; return `<a class="nod${fokus ? ' fokus' : ''}" style="--c:${hcol(r)}" href="#/slakttrad/${r.id}"><strong>${esc(r.namn)}</strong><small>${esc(lifeText(r))}</small></a>`; }
  return `<span class="nod ext"><strong>${esc(x.namn || x.id)}</strong><small>${x.anm ? esc(x.anm) : 'ej regent'}</small></span>`;
}
function pSlakt(id) {
  const opts = `<option value="">Välj regent…</option>` + D.R.map(r => `<option value="${r.id}" ${r.id === id ? 'selected' : ''}>${esc(r.namn)} (${esc(reignText(r))})</option>`).join('');
  post = () => { $('#slaktval').addEventListener('change', e => { if (e.target.value) location.hash = '#/slakttrad/' + e.target.value; }); };
  let body;
  if (!id || !D.byId[id]) {
    body = `<p>Välj en regent för att se släktbanden, eller börja med <a href="#/slakttrad/gustav-vasa">Gustav Vasa</a>.</p>`;
  } else {
    const r = D.byId[id], rl = rel(id);
    const gp = []; rl.foralder.forEach(p => { if (p.id) rel(p.id).foralder.forEach(x => { if (!gp.some(y => y.id === x.id)) gp.push(x); }); });
    const gc = []; rl.barn.forEach(c => { if (c.id) rel(c.id).barn.forEach(x => { if (!gc.some(y => y.id === x.id)) gc.push(x); }); });
    const row = (t, a) => a.length ? `<section class="gen"><h2>${t}</h2><div class="nodrad">${a.map(x => nod(x)).join('')}</div></section><div class="band-ner"></div>` : '';
    const none = !rl.foralder.length && !rl.make.length && !rl.barn.length && !rl.relaterade.length;
    body = `<h2 style="margin-top:1.2rem">${esc(r.namn)}</h2>
    ${none ? `<p class="mut">Släktband saknas ännu för ${esc(r.namn)}. De läggs in när berättelsen skrivs.</p>` : ''}
    <div class="trad">${row('Far- och morföräldrar', gp)}${row('Föräldrar', rl.foralder)}
    <section class="gen"><h2>Regenten och familj</h2><div class="nodrad">${nod({ id }, true)}${rl.make.map(x => nod(x)).join('')}</div></section>
    ${rl.barn.length ? `<div class="band-ner"></div><section class="gen"><h2>Barn</h2><div class="nodrad">${rl.barn.map(x => nod(x)).join('')}</div></section>` : ''}
    ${gc.length ? `<div class="band-ner"></div><section class="gen"><h2>Barnbarn</h2><div class="nodrad">${gc.map(x => nod(x)).join('')}</div></section>` : ''}
    ${rl.relaterade.length ? `<section class="gen"><h2>Andra släktskap</h2><div class="nodrad">${rl.relaterade.map(x => nod(x)).join('')}</div></section>` : ''}</div>
    <p style="margin-top:1.4rem"><a class="knapp" href="#/regent/${id}">Läs berättelsen om ${esc(r.namn)}</a></p>
    <p class="liten">Streckade rutor är personer som inte var regenter och därför inte har någon egen sida.</p>`;
  }
  return `<div class="sida"><div class="sidhuvud"><h1>Släktträd</h1><p>Klicka på en person för att flytta fokus dit.</p></div><div class="valj"><select id="slaktval" aria-label="Välj regent">${opts}</select></div>${body}</div>`;
}

/* ---------- Händelser ---------- */
function pHandelser() {
  let last = null, out = '';
  D.H.forEach(h => {
    const e = eraFor(h.ar); if (e !== last) { last = e; out += `<li class="era"><h2>${esc(e.namn)}</h2></li>`; }
    out += `<li class="rad hand" style="--c:var(--text)"><span class="ar">${h.ar}</span><a class="kort" href="#/handelse/${h.id}"><span class="namn">${esc(h.namn)}</span><span class="under">${(h.regenter || []).map(x => D.byId[x] ? esc(D.byId[x].namn) : '').filter(Boolean).join(', ')}</span></a><span></span></li>`;
  });
  return `<div class="sida"><div class="sidhuvud"><h1>Händelser</h1><p>Slag, fredsavtal och politiska omvälvningar som hör ihop med regenterna.</p></div><ol class="tl">${out}</ol></div>`;
}
function pHandelse(id) {
  const h = D.hById[id]; if (!h) return `<div class="sida"><h1>Händelsen finns inte</h1><p><a href="#/handelser">Alla händelser</a></p></div>`;
  return `<div class="sida"><div class="sidhuvud"><h1>${esc(h.namn)}</h1><p>${h.ar}</p></div>
  <p style="max-width:40rem;font-family:var(--serif);font-size:1.15rem;line-height:1.7">${fmt(h.text)}</p>
  <h2 style="margin:1.4rem 0 .5rem;font-size:1.2rem">Regenter i händelsen</h2><div class="chips">${(h.regenter || []).filter(x => D.byId[x]).map(x => `<a href="#/regent/${x}">${esc(D.byId[x].namn)}</a>`).join('')}</div>
  ${h.status !== 'verifierad' ? '<aside class="utkast" style="max-width:40rem"><strong>Utkast.</strong> Beskrivningen ska kontrolleras mot källor.</aside>' : ''}
  <p><a href="#/handelser">Alla händelser</a></p></div>`;
}

/* ---------- Jämför ---------- */
function pJamfor(P) {
  const a = D.byId[P.get('a')], b = D.byId[P.get('b')];
  const opts = sel => `<option value="">Välj…</option>` + D.R.map(r => `<option value="${r.id}" ${sel && r.id === sel.id ? 'selected' : ''}>${esc(r.namn)}</option>`).join('');
  post = () => { const go = () => { const x = $('#ja').value, y = $('#jb').value; location.hash = `#/jamfor?a=${x}&b=${y}`; }; $('#ja').addEventListener('change', go); $('#jb').addEventListener('change', go); };
  const cell = (r, fn) => (r ? fn(r) : '<span class="mut">–</span>');
  const row = (t, fn) => `<tr><th>${t}</th><td>${cell(a, fn)}</td><td>${cell(b, fn)}</td></tr>`;
  const na = r => { const x = neighbours(r); return { f: x.fore, e: x.efter }; };
  const tab = (a && b) ? `<table class="tabell"><thead><tr><th></th><th><a href="#/regent/${a.id}">${esc(a.namn)}</a></th><th><a href="#/regent/${b.id}">${esc(b.namn)}</a></th></tr></thead><tbody>
    ${row('Ätt', r => esc(D.hus[r.hus].namn))}${row('Titel', r => esc(r.titel))}${row('Regeringstid', r => esc(reignText(r)))}
    ${row('År på tronen', r => `${r.ca ? 'ca ' : ''}${reignYears(r)}`)}${row('Född', r => (r.fodd ? (r.foddCa ? 'ca ' : '') + r.fodd : '?'))}${row('Död', r => (r.levande ? 'Lever' : r.dod ? (r.dodCa ? 'ca ' : '') + r.dod : '?'))}
    ${row('Ålder vid tillträde', r => { const v = ageAtAcc(r); return v == null ? '?' : v + ' år'; })}${row('Ålder vid döden', r => { const v = ageAtDeath(r); return v == null ? '?' : v + ' år'; })}
    ${row('Dödssätt', r => esc(r.dodsatt || '?'))}${row('Föregångare', r => { const n = na(r).f; return n ? esc(n.namn) : 'Ingen'; })}${row('Efterträdare', r => { const n = na(r).e; return n ? esc(n.namn) : 'Ingen'; })}
    ${row('Pålitlighet', r => PAL[r.palitlighet || 'osäker'].t)}</tbody></table>
    <p class="liten">Uppgifter som saknas visas med frågetecken. Uppgifterna är utkast tills de har kontrollerats mot källor.</p>` : '<p class="mut">Välj två regenter för att jämföra dem.</p>';
  return `<div class="sida"><div class="sidhuvud"><h1>Jämför två regenter</h1></div><div class="valj"><select id="ja" aria-label="Första regenten">${opts(a)}</select><select id="jb" aria-label="Andra regenten">${opts(b)}</select></div><div style="margin-top:1.2rem;overflow-x:auto">${tab}</div></div>`;
}

/* ---------- Statistik ---------- */
function pStat() {
  const li = (arr, fn) => arr.map(r => `<li><a href="#/regent/${r.id}">${esc(r.namn)}</a> <span>${fn(r)}</span></li>`).join('');
  const mon = D.M;
  const withReign = mon.filter(r => reignYears(r) > 0).sort((a, b) => reignYears(b) - reignYears(a));
  const acc = mon.filter(r => ageAtAcc(r) != null && ageAtAcc(r) >= 0).sort((a, b) => ageAtAcc(a) - ageAtAcc(b));
  const death = D.R.filter(r => ageAtDeath(r) != null).sort((a, b) => ageAtDeath(b) - ageAtDeath(a));
  const stupade = D.R.filter(r => r.dodsatt === 'stupad'), mordade = D.R.filter(r => r.dodsatt === 'mördad');
  const kvinnor = D.R.filter(r => r.kon === 'k');
  const perHus = Object.keys(D.hus).map(id => ({ id, n: D.R.filter(r => r.hus === id).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const maxN = Math.max(...perHus.map(x => x.n), 1);
  const note = `Uppgifterna är utkast och bygger på de regenter som har data inlagd.`;
  return `<div class="sida"><div class="sidhuvud"><h1>Rekord och statistik</h1><p>${note} Årtal markerade med ca är osäkra.</p></div><div class="stat">
  <section class="ruta"><h2>Längsta regeringstider</h2><ol>${li(withReign.slice(0, 5), r => `${r.ca ? 'ca ' : ''}${reignYears(r)} år`)}</ol></section>
  <section class="ruta"><h2>Kortaste regeringstider</h2><ol>${li(withReign.slice(-5).reverse(), r => `${r.ca ? 'ca ' : ''}${reignYears(r)} år`)}</ol></section>
  <section class="ruta"><h2>Yngst vid tillträdet</h2><ol>${acc.length ? li(acc.slice(0, 5), r => ageAtAcc(r) + ' år') : '<li class="mut">Födelseår saknas ännu.</li>'}</ol></section>
  <section class="ruta"><h2>Blev äldst</h2><ol>${death.length ? li(death.slice(0, 5), r => ageAtDeath(r) + ' år') : '<li class="mut">Data saknas ännu.</li>'}</ol></section>
  <section class="ruta"><h2>Stupade i strid</h2><ul>${stupade.length ? li(stupade, r => r.dod) : '<li class="mut">Ingen inlagd ännu.</li>'}</ul></section>
  <section class="ruta"><h2>Mördade</h2><ul>${mordade.length ? li(mordade, r => r.dod) : '<li class="mut">Ingen inlagd ännu.</li>'}</ul></section>
  <section class="ruta"><h2>Drottningar på tronen</h2><ul>${kvinnor.length ? li(kvinnor, r => esc(reignText(r))) : '<li class="mut">Ingen inlagd ännu.</li>'}</ul></section>
  <section class="ruta"><h2>Regenter per ätt</h2>${perHus.map(x => `<div class="sblock"><a href="#/tidslinje?hus=${x.id}">${esc(D.hus[x.id].namn)}</a><i style="--c:${D.hus[x.id].farg};width:${x.n / maxN * 9}rem"></i>${x.n}</div>`).join('')}</section>
  </div></div>`;
}

/* ---------- Quiz ---------- */
let Q = null;
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function makeQuiz() {
  const verified = D.M.filter(r => r.status === 'verifierad' && r.palitlighet !== 'legendarisk');
  const pool = verified.length >= 8 ? verified : D.M.filter(r => r.palitlighet !== 'legendarisk');
  const info = verified.length >= 8 ? '' : 'Frågorna bygger på grunddata som ännu inte är kontrollerad mot källor.';
  const qs = [];
  const pick = (n, ex) => shuf(pool.filter(r => !ex.includes(r))).slice(0, n);
  let tries = 0;
  while (qs.length < 10 && tries++ < 200) {
    const r = shuf(pool)[0], kind = Math.floor(Math.random() * 4);
    if (kind === 0) { const e = neighbours(r).efter; if (!e) continue; const d = pick(3, [r, e]); qs.push({ q: `Vem efterträdde ${r.namn}?`, a: e.namn, o: shuf([e, ...d].map(x => x.namn)) }); }
    else if (kind === 1) { const names = [...new Set(D.M.map(x => D.hus[x.hus].namn))]; const ans = D.hus[r.hus].namn; const d = shuf(names.filter(n => n !== ans)).slice(0, 3); if (d.length < 3) continue; qs.push({ q: `Vilken ätt tillhörde ${r.namn}?`, a: ans, o: shuf([ans, ...d]) }); }
    else if (kind === 2) { const y = start(r), o = new Set([y]); while (o.size < 4) o.add(y + (Math.floor(Math.random() * 12) - 6) * 5 || y + 7); qs.push({ q: `Ungefär vilket år började ${r.namn} regera?`, a: String(y), o: shuf([...o].map(String)) }); }
    else { const [a, b] = r.perioder[0]; if (b == null || b - a < 4) continue; const y = a + 1 + Math.floor(Math.random() * (b - a - 2)); const who = D.M.filter(x => x.perioder.some(([p, q]) => y >= p && y < (q ?? NOW))); if (who.length !== 1) continue; const d = pick(3, [r]); qs.push({ q: `Vem var regent år ${y}?`, a: r.namn, o: shuf([r, ...d].map(x => x.namn)) }); }
    if (qs.length && qs.filter(x => x.q === qs[qs.length - 1].q).length > 1) qs.pop();
  }
  return { qs, i: 0, score: 0, ans: null, info };
}
function pQuiz() {
  if (!Q || Q.i >= Q.qs.length || !Q.qs.length) Q = makeQuiz();
  return `<div class="sida"><div class="sidhuvud"><h1>Quiz</h1></div><div class="quiz" id="quiz">${quizBody()}</div></div>`;
}
function quizBody() {
  if (!Q.qs.length) return '<p class="mut">Det finns inte tillräckligt med data för ett quiz än.</p>';
  if (Q.i >= Q.qs.length) return `<p class="fraga">Du fick ${Q.score} av ${Q.qs.length} rätt.</p><button type="button" class="knapp" data-act="qny">Spela igen</button>`;
  const q = Q.qs[Q.i];
  return `<p class="liten">Fråga ${Q.i + 1} av ${Q.qs.length}</p><p class="fraga">${esc(q.q)}</p>
  <div class="alt">${q.o.map(o => `<button type="button" data-act="qsvar" data-v="${esc(o)}" ${Q.ans != null ? 'disabled' : ''} class="${Q.ans != null ? (o === q.a ? 'ratt' : o === Q.ans ? 'fel' : '') : ''}">${esc(o)}</button>`).join('')}</div>
  ${Q.ans != null ? `<p style="margin-top:1rem">${Q.ans === q.a ? 'Rätt!' : 'Fel. Rätt svar är ' + esc(q.a) + '.'}</p><button type="button" class="knapp" data-act="qnasta">${Q.i + 1 >= Q.qs.length ? 'Visa resultat' : 'Nästa fråga'}</button>` : ''}
  ${Q.info ? `<p class="liten" style="margin-top:1.5rem">${Q.info}</p>` : ''}`;
}

/* ---------- Ordlista, bokmärken, sök, mer, om ---------- */
function pOrd() { return `<div class="sida"><div class="sidhuvud"><h1>Ordlista</h1></div><dl class="ordlista">${D.O.map(o => `<dt id="o-${o.id}">${esc(o.term)}</dt><dd>${esc(o.forklaring)}</dd>`).join('')}</dl></div>`; }
function pBokm() {
  const l = S.bokmarken.filter(b => D.byId[b.id]);
  return `<div class="sida"><div class="sidhuvud"><h1>Bokmärken</h1><p>Platser du har sparat. Tryck på bokmärkesikonen vid en rubrik eller högst upp på en regents sida.</p></div>
  ${l.length ? `<ul class="bokmlista">${l.map(b => { const r = D.byId[b.id]; return `<li style="--c:${hcol(r)}"><a href="#/regent/${r.id}${b.sek >= 0 ? '?sek=' + b.sek : ''}"><strong>${esc(r.namn)}</strong><small>${b.sek >= 0 ? esc(b.etikett || 'Avsnitt ' + (b.sek + 1)) : 'Hela berättelsen'}</small></a><button type="button" class="kryss" data-act="bokm-ta" data-id="${r.id}" data-sek="${b.sek}" aria-label="Ta bort bokmärket" title="Ta bort">×</button></li>`; }).join('')}</ul>` : '<p class="mut">Inga bokmärken ännu.</p>'}</div>`;
}
function pSok(P) {
  const q = (P.get('q') || '').trim(), ql = q.toLowerCase();
  post = () => { $('#sokf').addEventListener('submit', e => { e.preventDefault(); const v = $('#sokq').value.trim(); location.hash = '#/sok?q=' + encodeURIComponent(v); }); if (!q) $('#sokq').focus(); };
  let res = '';
  if (q) {
    const rs = D.R.filter(r => r._s.includes(ql)).sort((a, b) => (b.namn.toLowerCase().includes(ql)) - (a.namn.toLowerCase().includes(ql)));
    const hs = D.H.filter(h => (h.namn + ' ' + h.text).toLowerCase().includes(ql));
    const os = D.O.filter(o => (o.term + ' ' + o.forklaring).toLowerCase().includes(ql));
    const snip = r => { const i = r._s.indexOf(ql); if (i < 0 || r.namn.toLowerCase().includes(ql)) return esc(r.ingress || ''); const s = (r.berattelse || []).map(x => x.text).join(' ').replace(/\[\[(?:[ho]:)?[^|\]]+\|([^\]]+)\]\]/g, '$1'); const j = s.toLowerCase().indexOf(ql); if (j < 0) return esc(r.ingress || ''); return '…' + esc(s.slice(Math.max(0, j - 60), j)) + '<mark>' + esc(s.slice(j, j + q.length)) + '</mark>' + esc(s.slice(j + q.length, j + q.length + 80)) + '…'; };
    res = `<p class="mut">${rs.length + hs.length + os.length} träffar</p><ul class="sokres" style="list-style:none;padding:0">${rs.map(r => `<li><a href="#/regent/${r.id}"><strong>${esc(r.namn)}</strong></a> <span class="mut">${esc(reignText(r))}</span><br><span class="liten">${snip(r)}</span></li>`).join('')}${hs.map(h => `<li><a href="#/handelse/${h.id}"><strong>${esc(h.namn)}</strong></a> <span class="mut">${h.ar}, händelse</span></li>`).join('')}${os.map(o => `<li><a href="#/ordlista"><strong>${esc(o.term)}</strong></a> <span class="mut">ordlista</span><br><span class="liten">${esc(o.forklaring)}</span></li>`).join('')}</ul>`;
  }
  return `<div class="sida"><div class="sidhuvud"><h1>Sök</h1></div><form id="sokf" class="valj" role="search"><input id="sokq" type="search" value="${esc(q)}" placeholder="Namn, händelse eller ord" aria-label="Sökord"><button class="knapp" type="submit">Sök</button></form><div style="margin-top:1rem">${res}</div></div>`;
}
function pMer() {
  const l = [['#/jamfor', 'Jämför två regenter', 'Regeringstid, ålder och efterträdare sida vid sida.'], ['#/statistik', 'Rekord och statistik', 'Längsta regeringstid, yngsta tronföljare och mer.'], ['#/quiz', 'Quiz', 'Frågor på svenska om regenter och årtal.'], ['#/ordlista', 'Ordlista', 'Förklaringar av ord som riksföreståndare och interregnum.'], ['#/bokmarken', 'Bokmärken', 'Platser du har sparat i berättelserna.'], ['#/sok', 'Sök', 'Sök bland regenter, händelser och ord.'], ['#/om', 'Om appen och säkerhetskopia', 'Källor, bilder och hur du flyttar dina framsteg.']];
  return `<div class="sida"><div class="sidhuvud"><h1>Mer</h1></div><ul class="utforska">${l.map(([h, t, s]) => `<li><a href="${h}"><strong>${t}</strong><span>${s}</span></a></li>`).join('')}</ul></div>`;
}
function pOm() {
  const verified = D.R.filter(r => r.status === 'verifierad').length, withStory = D.R.filter(r => r.berattelse && r.berattelse.length).length;
  return `<div class="sida"><div class="sidhuvud"><h1>Om appen</h1></div>
  <div style="max-width:42rem;font-size:1.02rem">
  <p>Appen samlar ${D.R.length} regenter från ${D.R[0].namn} till ${D.R[D.R.length - 1].namn}. Av dem har ${withStory} en berättelse och ${verified} är verifierade mot källor.</p>
  <h2 style="margin:1.4rem 0 .4rem;font-size:1.3rem">Källor och pålitlighet</h2>
  <p>Texterna ska bygga på Svenskt biografiskt lexikon, Nationalencyklopedin, kungahuset.se och Riksarkivet eller Historiska museet. Wikipedia används bara för att kontrollera mot. Varje sida visar sina källor, och sidor som ännu inte kontrollerats är markerade som utkast.</p>
  <p>Varje regent har en pålitlighetsmärkning: ${Object.values(PAL).map(p => `<span class="pal pal-${p.c}">${p.t}</span>`).join(' ')}. ${esc(PAL['säker'].d)} ${esc(PAL['osäker'].d)} ${esc(PAL['legendarisk'].d)}</p>
  <h2 style="margin:1.4rem 0 .4rem;font-size:1.3rem">Bilder</h2>
  <p>Porträtt hämtas från Wikimedia Commons och visas bara när licensen är fri. Namn på upphovsperson, licens och länk visas under bilden. När det inte finns något porträtt visas en krona.</p>
  <h2 style="margin:1.4rem 0 .4rem;font-size:1.3rem">Dina framsteg</h2>
  <p>Vad du har läst, dina bokmärken och var du slutade sparas bara i den här webbläsaren. Spara en kopia om du vill flytta dem till en annan enhet.</p>
  <p><button type="button" class="knapp" data-act="export">Spara säkerhetskopia</button> <label class="knapp ljus" style="cursor:pointer">Läs in säkerhetskopia<input type="file" accept="application/json" id="importfil" hidden></label></p>
  <p><button type="button" class="knapp ljus" data-act="nollstall">Nollställ alla framsteg</button></p></div></div>`;
}

/* ---------- Händelser från klick ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) { const j = e.target.closest('[data-jump]'); if (j) { e.preventDefault(); const el = $('#sek-' + j.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
  const act = t.dataset.act;
  if (act === 'las') { e.preventDefault(); const id = t.dataset.las; if (isRead(id)) delete S.lasta[id]; else { S.lasta[id] = Date.now(); } save(); setReadUI(id); }
  else if (act === 'bokm') {
    const id = t.dataset.id, sek = +t.dataset.sek, ex = findBm(id, sek);
    if (ex) { S.bokmarken = S.bokmarken.filter(b => b !== ex); toast('Bokmärket är borttaget.'); }
    else { const r = D.byId[id]; S.bokmarken.unshift({ id, sek, etikett: sek >= 0 ? r.berattelse[sek].rubrik : '', ts: Date.now() }); toast('Bokmärket är sparat.'); }
    save(); $$(`[data-act="bokm"][data-id="${id}"][data-sek="${sek}"]`).forEach(b => b.setAttribute('aria-pressed', !ex));
  }
  else if (act === 'bokm-ta') { S.bokmarken = S.bokmarken.filter(b => !(b.id === t.dataset.id && b.sek === +t.dataset.sek)); save(); route(); }
  else if (act === 'lyssna') { if (!SP.on) startSpeech(); else if (SP.paused) { SP.paused = false; speechSynthesis.resume(); updSpeechUI(); } else { SP.paused = true; speechSynthesis.pause(); updSpeechUI(); } }
  else if (act === 'stoppa') stopSpeech();
  else if (act === 'storlek') { S.storlek = Math.min(1.6, Math.max(.8, Math.round((S.storlek + .1 * +t.dataset.d) * 10) / 10)); document.documentElement.style.setProperty('--lasstorlek', S.storlek); save(); }
  else if (act === 'qsvar') { if (Q.ans == null) { Q.ans = t.dataset.v; if (Q.ans === Q.qs[Q.i].a) Q.score++; $('#quiz').innerHTML = quizBody(); } }
  else if (act === 'qnasta') { Q.i++; Q.ans = null; $('#quiz').innerHTML = quizBody(); }
  else if (act === 'qny') { Q = makeQuiz(); $('#quiz').innerHTML = quizBody(); }
  else if (act === 'export') { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'regenter-framsteg.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  else if (act === 'nollstall') { if (confirm('Vill du ta bort alla läsmarkeringar, bokmärken och sparade lägen?')) { S = defState(); save(); toast('Alla framsteg är borttagna.'); } }
});
document.addEventListener('change', e => {
  if (e.target.id === 'importfil') {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { const o = JSON.parse(t); S = Object.assign(defState(), o); save(); document.documentElement.style.setProperty('--lasstorlek', S.storlek); toast('Säkerhetskopian är inläst.'); }).catch(() => toast('Filen kunde inte läsas.'));
  }
});
window.addEventListener('pagehide', stopSpeech);

/* ---------- Start ---------- */
load().then(() => { route(); }).catch(err => {
  app.innerHTML = `<div class="sida"><h1>Datan kunde inte laddas</h1><p>${esc(err.message)}. Kontrollera att mappen data/ finns i samma repo som index.html.</p></div>`;
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
