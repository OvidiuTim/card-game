/* ============================================================
   Covorul de cărți — prototip mecanic
   ------------------------------------------------------------
   REGULI
   - fiecare carte are 4 margini (u=sus, r=dreapta, d=jos, l=stânga),
     fiecare cu o suită sau null
   - LEGĂTURĂ: marginea ta din direcția X are aceeași suită cu
     SUITA vecinului din direcția X  ->  primești valoarea lui
   - după legături se aplică efectele, de la stânga la dreapta
   - rând încheiat = damage în inamic; rândul rămâne pe covor
   ============================================================ */

const H = '♥', D = '♦', C = '♣', S = '♠';
const RED = [H, D];

const CONFIG = {
  latime: 4,        // sloturi pe rând
  mana: 5,          // cărți în mână
  copii: 3,         // câte copii din fiecare carte în pachet
  viataInamic: 500
};

/* ---------- cele 10 cărți de test ---------- */
const DEFS = [
  { id:'goblin',  nume:'Goblin rătăcitor',  v:5,  s:D, lbl:'5', e:{u:D,   r:D,   d:null,l:null}, fx:'—' },
  { id:'unicorn', nume:'Unicorn',           v:10, s:H, lbl:'10',e:{u:D,   r:H,   d:H,   l:D},    fx:'×2 pt. fiecare legătură roșie' },
  { id:'centaur', nume:'Centaur explorator',v:3,  s:C, lbl:'3', e:{u:S,   r:C,   d:null,l:C},    fx:'+3 fiecărei cărți legate' },
  { id:'loki',    nume:'Loki',              v:7,  s:S, lbl:'7', e:{u:D,   r:H,   d:C,   l:S},    fx:'fură 1/2 din cel mai mare vecin legat' },
  { id:'phoenix', nume:'Phoenix',           v:14, s:C, lbl:'A', e:{u:null,r:C,   d:C,   l:null}, fx:'×3 dacă nu are nicio legătură' },
  { id:'gaia',    nume:'Gaia',              v:12, s:D, lbl:'D', e:{u:D,   r:H,   d:null,l:H},    fx:'+2 pt. fiecare carte de pe rândul de sus' },
  { id:'cerber',  nume:'Cerber',            v:9,  s:C, lbl:'9', e:{u:C,   r:C,   d:null,l:C},    fx:'+6 pt. fiecare legătură' },
  { id:'lebede',  nume:'Pereche de lebede', v:2,  s:H, lbl:'2', e:{u:null,r:H,   d:null,l:H},    fx:'dublează cărțile legate' },
  { id:'odin',    nume:'Odin',              v:13, s:S, lbl:'R', e:{u:S,   r:null,d:S,   l:D},    fx:'copiază scorul celui mai mare vecin legat' },
  { id:'pegasus', nume:'Pegasus',           v:6,  s:C, lbl:'6', e:{u:C,   r:D,   d:H,   l:null}, fx:'+50% la totalul rândului' }
];

/* ---------- efecte ----------
   c   = cartea curentă  (c.score, c.links, c.r, c.c)
   api = { log(text), mult(x) }   mult() înmulțește TOTALUL rândului
   notă: efectele care modifică alte cărți lovesc doar cărți din rândul curent
*/
const EFFECTS = {
  unicorn(c, api){
    const n = c.links.filter(l => RED.includes(l.cell.def.s)).length;
    if(!n) return;
    const m = Math.pow(2, n), b = c.score;
    c.score = b * m;
    api.log('Unicorn: ' + n + ' legături roșii → ' + b + ' ×' + m + ' = ' + c.score);
  },
  centaur(c, api){
    const t = c.links.filter(l => l.cell.r === c.r);
    t.forEach(l => l.cell.score += 3);
    if(t.length) api.log('Centaur: +3 la ' + t.length + ' cărți legate');
  },
  loki(c, api){
    const t = c.links.filter(l => l.cell.r === c.r).sort((a,b) => b.cell.score - a.cell.score)[0];
    if(!t) return;
    const h = Math.floor(t.cell.score / 2);
    t.cell.score -= h; c.score += h;
    api.log('Loki: fură ' + h + ' de la ' + t.cell.def.nume);
  },
  phoenix(c, api){
    if(c.links.length) return;
    const b = c.score; c.score = b * 3;
    api.log('Phoenix: singur → ' + b + ' ×3 = ' + c.score);
  },
  gaia(c, api){
    const n = (board[c.r - 1] || []).filter(Boolean).length;
    if(!n) return;
    c.score += 2 * n;
    api.log('Gaia: +' + (2*n) + ' (' + n + ' cărți pe rândul de sus)');
  },
  cerber(c, api){
    if(!c.links.length) return;
    c.score += 6 * c.links.length;
    api.log('Cerber: +' + (6*c.links.length) + ' (' + c.links.length + ' legături)');
  },
  lebede(c, api){
    const t = c.links.filter(l => l.cell.r === c.r);
    t.forEach(l => l.cell.score *= 2);
    if(t.length) api.log('Lebede: dublează ' + t.length + ' cărți legate');
  },
  odin(c, api){
    const t = c.links.slice().sort((a,b) => b.cell.score - a.cell.score)[0];
    if(t && t.cell.score > c.score){
      api.log('Odin: copiază ' + t.cell.score + ' de la ' + t.cell.def.nume);
      c.score = t.cell.score;
    }
  },
  pegasus(c, api){
    api.mult(1.5);
    api.log('Pegasus: ×1.5 la totalul rândului');
  }
};

/* ---------- stare ---------- */
let deck, hand, board, sel, ehp, dmgRand, gata;

const $ = id => document.getElementById(id);

function pachetNou(){
  const d = [];
  DEFS.forEach(def => { for(let i=0;i<CONFIG.copii;i++) d.push(def); });
  for(let i=d.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function randGol(){ return new Array(CONFIG.latime).fill(null); }
function trage(){
  while(hand.length < CONFIG.mana){
    if(!deck.length) deck = pachetNou();
    hand.push(deck.pop());
  }
}
function reset(){
  deck = pachetNou(); hand = []; board = [randGol()];
  sel = null; ehp = CONFIG.viataInamic; dmgRand = []; gata = false;
  trage();
  $('log').innerHTML = '';
  $('btnEnd').disabled = false;
  render();
}

/* ---------- randare ---------- */
function suita(s){ return s ? '<span class="' + (RED.includes(s) ? 'red' : 'blk') + '">' + s + '</span>' : ''; }

function cardHtml(def, cls, score, attr){
  const e = def.e;
  return '<div class="card ' + (cls||'') + '" ' + (attr||'') + '>'
    + (e.u ? '<span class="e u">' + suita(e.u) + '</span>' : '')
    + (e.d ? '<span class="e d">' + suita(e.d) + '</span>' : '')
    + (e.l ? '<span class="e l">' + suita(e.l) + '</span>' : '')
    + (e.r ? '<span class="e r">' + suita(e.r) + '</span>' : '')
    + '<div class="val">' + def.lbl + ' ' + suita(def.s) + '</div>'
    + '<div class="nume">' + def.nume + '</div>'
    + '<div class="fx">' + def.fx + '</div>'
    + (score != null ? '<div class="sc">' + score + '</div>' : '')
    + '</div>';
}

function render(){
  $('ehp').textContent = Math.max(0, ehp) + ' / ' + CONFIG.viataInamic;
  $('ehpfill').style.width = Math.max(0, ehp / CONFIG.viataInamic * 100) + '%';

  const ultim = board.length - 1;
  $('mat').innerHTML = board.map((row, r) => {
    let h = '<div class="rowlbl">rând ' + (r+1) + '</div>';
    row.forEach((cell, i) => {
      if(cell){
        h += cardHtml(cell.def, '', cell.score);
      } else if(r === ultim && !gata){
        h += '<div class="slot' + (sel != null ? ' armed' : '') + '" data-slot="' + i + '"></div>';
      } else {
        h += '<div class="slot locked"></div>';
      }
    });
    if(dmgRand[r] != null) h += '<div class="rowdmg">→ ' + dmgRand[r] + ' dmg</div>';
    return '<div class="row">' + h + '</div>';
  }).join('');
  $('mat').scrollTop = $('mat').scrollHeight;

  $('hand').innerHTML = hand.map((d, i) =>
    cardHtml(d, 'hand' + (sel === i ? ' sel' : ''), null, 'data-hand="' + i + '"')
  ).join('');

  $('handlbl').innerHTML = sel == null
    ? 'Mâna ta — click pe o carte (sau tastele 1–' + CONFIG.mana + ')'
    : 'Selectat: <b>' + hand[sel].nume + '</b> — acum click pe un slot din rândul de jos';

  $('status').innerHTML = 'pachet: ' + deck.length + ' · rând ' + board.length;
  $('btnEnd').disabled = gata || !board[ultim].some(Boolean);
}

function logEntry(head, det, cls){
  const div = document.createElement('div');
  div.className = 'entry';
  div.innerHTML = '<div class="head ' + (cls||'') + '">' + head + '</div>'
    + (det ? '<div class="det">' + det + '</div>' : '');
  $('log').prepend(div);
}

/* ---------- joc ---------- */
function selecteaza(i){
  if(gata || i < 0 || i >= hand.length) return;
  sel = (sel === i) ? null : i;
  render();
}

function pune(i){
  if(gata || sel == null) return;
  const r = board.length - 1;
  if(board[r][i]) return;
  board[r][i] = { def: hand[sel], r: r, c: i, score: null, links: [] };
  hand.splice(sel, 1);
  sel = null;
  render();
  if(board[r].every(Boolean)) rezolva();
}

function legaturi(cell){
  const dirs = [['u',-1,0], ['d',1,0], ['l',0,-1], ['r',0,1]];
  const out = [];
  dirs.forEach(([k, dr, dc]) => {
    const vrea = cell.def.e[k];
    if(!vrea) return;
    const row = board[cell.r + dr];
    if(!row) return;
    const n = row[cell.c + dc];
    if(!n) return;
    if(n.def.s === vrea) out.push({ dir: k, cell: n });
  });
  return out;
}

function rezolva(){
  if(gata) return;
  const r = board.length - 1;
  const cells = board[r].filter(Boolean);
  if(!cells.length) return;

  const lines = [];
  const api = { log: s => lines.push('· ' + s), mult: m => mult *= m };
  let mult = 1;

  cells.forEach(c => { c.score = c.def.v; });

  cells.forEach(c => {
    c.links = legaturi(c);
    c.links.forEach(l => c.score += l.cell.def.v);
    if(c.links.length){
      lines.push('· ' + c.def.nume + ': ' + c.def.v + ' + ['
        + c.links.map(l => l.cell.def.lbl + l.cell.def.s).join(' ') + '] = ' + c.score);
    }
  });

  cells.forEach(c => { const f = EFFECTS[c.def.id]; if(f) f(c, api); });

  let sum = 0;
  cells.forEach(c => { c.score = Math.max(0, Math.round(c.score)); sum += c.score; });
  const dmg = Math.floor(sum * mult);

  dmgRand[r] = dmg;
  ehp -= dmg;

  logEntry('RÂND ' + (r+1) + ' → ' + dmg + ' dmg' + (mult !== 1 ? '  (' + sum + ' ×' + mult + ')' : ''),
           lines.join('\n'));

  if(ehp <= 0){
    gata = true;
    logEntry('★ INAMIC ÎNVINS în ' + (r+1) + ' rânduri ★', '', 'win');
    render();
    return;
  }

  board.push(randGol());
  trage();
  render();
}

/* ---------- evenimente (delegate, supraviețuiesc re-randării) ---------- */
$('hand').addEventListener('click', e => {
  const el = e.target.closest('[data-hand]');
  if(el) selecteaza(+el.dataset.hand);
});
$('mat').addEventListener('click', e => {
  const el = e.target.closest('[data-slot]');
  if(el) pune(+el.dataset.slot);
});
$('btnEnd').addEventListener('click', () => rezolva());
$('btnReset').addEventListener('click', () => reset());
document.addEventListener('keydown', e => {
  if(e.key >= '1' && e.key <= '9') selecteaza(+e.key - 1);
  if(e.key === 'Escape'){ sel = null; render(); }
  if(e.key === 'Enter') rezolva();
});

reset();
