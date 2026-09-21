/* ============================================================
   Card Carpet — prototip mecanic (v6)
   ------------------------------------------------------------
   MODEL
   - covorul = mai multe rânduri de cărți; numărul de rânduri va
     depinde mai încolo de progres (CONFIG.randuriMax)
   - nu se "încasează" nimic pe rând: TOTALUL COVORULUI e viu și
     se recalculează mereu, iar viața inamicului = viață - total
   - numărul din stânga-sus ESTE puterea curentă a cărții

   CONEXIUNI — după FIECARE carte jucată se verifică TOT COVORUL:
     · se fotografiază puterile de la începutul verificării
     · orice pereche vecină încă neplătită în care marginea lui A
       are suita lui B  ->  A primește puterea (din fotografie) a lui B
     · o pereche plătește o singură dată; puterea câștigată rămâne
   Merge în toate direcțiile: sus, jos, stânga, dreapta — deci și o
   carte pusă pe rândul nou hrănește cartea de deasupra ei.
   ============================================================ */

const H = '♥', D = '♦', C = '♣', S = '♠';

const CONFIG = {
  latime: 6,        // maxim cărți pe rând
  randuriMax: 0,    // 0 = nelimitat (mai încolo: cât covor a deblocat jucătorul)
  mana: 5,          // cărți în mână
  copii: 2,         // copii din fiecare carte în pachet
  viataInamic: 300,
  pasAnim: 70       // ms per punct, cât de repede urcă numerele
};

/* ---------- cele 12 cărți: 2/3/4 × cele 4 suite, zero efecte ---------- */
const DEFS = [
  { id:'lebede',  nume:'Pair of Swans',    v:2, s:H, e:{u:null,r:H,   d:null,l:H}    },
  { id:'nimfa',   nume:'Nymph',            v:3, s:H, e:{u:H,   r:C,   d:null,l:D}    },
  { id:'sirena',  nume:'Sleeping Siren',   v:4, s:H, e:{u:D,   r:H,   d:null,l:S}    },

  { id:'spiridus',nume:'Sprite',           v:2, s:D, e:{u:H,   r:D,   d:C,   l:S}    },
  { id:'gnom',    nume:'Gnome',            v:3, s:D, e:{u:D,   r:D,   d:null,l:D}    },
  { id:'dragon',  nume:'Guardian Dragon',  v:4, s:D, e:{u:D,   r:H,   d:null,l:D}    },

  { id:'ianus',   nume:'Janus',            v:2, s:C, e:{u:null,r:C,   d:null,l:C}    },
  { id:'centaur', nume:'Centaur Scout',    v:3, s:C, e:{u:S,   r:C,   d:null,l:C}    },
  { id:'faun',    nume:'Faun',             v:4, s:C, e:{u:C,   r:H,   d:null,l:H}    },

  { id:'sfinx',   nume:'Sphinx',           v:2, s:S, e:{u:C,   r:C,   d:null,l:S}    },
  { id:'harpyie', nume:'Harpy',            v:3, s:S, e:{u:D,   r:S,   d:null,l:H}    },
  { id:'hypnos',  nume:'Hypnos',           v:4, s:S, e:{u:S,   r:D,   d:null,l:C}    }
];

const CLASA_SUITA = { [H]:'s-h', [D]:'s-d', [C]:'s-c', [S]:'s-s' };

/* ---------- stare ---------- */
let deck, hand, board, sel, gata, ordine, animTimer, istoric;

const $ = id => document.getElementById(id);
const randCurent = () => board[board.length - 1];
const toateCartile = () => board.flat();
const totalCovor = () => toateCartile().reduce((s, c) => s + c.score, 0);
const totalAfisat = () => toateCartile().reduce((s, c) => s + (c.shown || 0), 0);

function pachetNou(){
  const d = [];
  DEFS.forEach(def => { for(let i=0;i<CONFIG.copii;i++) d.push(def); });
  for(let i=d.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function trage(){
  while(hand.length < CONFIG.mana){
    if(!deck.length) deck = pachetNou();
    hand.push(deck.pop());
  }
}
function reset(){
  clearTimeout(animTimer);
  deck = pachetNou(); hand = []; board = [[]];
  sel = null; gata = false; ordine = 0; istoric = [];
  trage();
  $('log').innerHTML = '';
  render();
}

/* ============================================================
   CONEXIUNI — se verifică tot covorul
   ============================================================ */
function vecin(r, i, dir){
  const dd = { u:[-1,0], d:[1,0], l:[0,-1], r:[0,1] }[dir];
  const row = board[r + dd[0]];
  if(!row) return null;
  return row[i + dd[1]] || null;
}

function conecteaza(){
  const foto = new Map();
  toateCartile().forEach(c => foto.set(c, c.score));

  const rezumat = [];
  board.forEach((row, r) => row.forEach((c, i) => {
    ['u','d','l','r'].forEach(dir => {
      const N = vecin(r, i, dir);
      if(!N) return;
      if(c.def.e[dir] !== N.def.s) return;      // marginea nu se potrivește cu suita vecinului
      const cheie = dir + ':' + N.uid;
      if(c.platit.has(cheie)) return;           // perechea asta a plătit deja
      c.platit.add(cheie);
      const p = foto.get(N);
      c.score += p;
      c.lit[dir] = true;
      rezumat.push(c.def.nume + ' +' + p + ' from ' + N.def.nume);
    });
  }));
  return rezumat;
}

/* ============================================================
   RANDARE
   ============================================================ */
function suita(s){
  return s ? '<span class="' + CLASA_SUITA[s] + '">' + s + '</span>' : '';
}

function cardHtml(c, cls, attr){
  const def = c.def, e = def.e, lit = c.lit || {};
  return '<div class="card ' + (cls||'') + '" ' + (attr||'') + '>'
    + (e.u ? '<span class="e u' + (lit.u?' lit':'') + '">' + suita(e.u) + '</span>' : '')
    + (e.d ? '<span class="e d' + (lit.d?' lit':'') + '">' + suita(e.d) + '</span>' : '')
    + (e.l ? '<span class="e l' + (lit.l?' lit':'') + '">' + suita(e.l) + '</span>' : '')
    + (e.r ? '<span class="e r' + (lit.r?' lit':'') + '">' + suita(e.r) + '</span>' : '')
    + '<div class="val">' + (c.shown != null ? c.shown : def.v) + '</div>'
    + '<div class="sui">' + suita(def.s) + '</div>'
    + '<div class="nume">' + def.nume + '</div>'
    + '<div class="fxzone"></div>'
    + '</div>';
}

function gapHtml(activ, i){
  return '<div class="gap' + (activ ? ' on' : '') + '"' + (activ ? ' data-gap="' + i + '"' : '') + '></div>';
}

function render(){
  const total = totalAfisat();
  const ramas = Math.max(0, CONFIG.viataInamic - total);
  $('ehp').textContent = ramas + ' / ' + CONFIG.viataInamic;
  $('ehpfill').style.width = (ramas / CONFIG.viataInamic * 100) + '%';

  const ultim = board.length - 1;
  $('mat').innerHTML = board.map((row, r) => {
    const curent = (r === ultim && !gata);
    const potInsera = curent && sel != null && row.length < CONFIG.latime;
    let h = '<div class="rowlbl">row ' + (r+1) + '</div>';
    row.forEach((c, i) => {
      h += gapHtml(potInsera, i);
      h += cardHtml(c, (c.nou ? 'nou' : ''), 'data-cell="' + r + ':' + i + '"');
      c.nou = false;
    });
    h += gapHtml(potInsera, row.length);
    if(!row.length) h += '<span class="rowsum" style="margin-left:0">play a card…</span>';
    else h += '<div class="rowsum">row <b data-rowsum="' + r + '">0</b></div>';
    return '<div class="row">' + h + '</div>';
  }).join('');
  $('mat').scrollTop = $('mat').scrollHeight;

  $('hand').innerHTML = hand.map((d, i) =>
    cardHtml({ def: d, shown: d.v, lit: {} }, 'hand' + (sel === i ? ' sel' : ''), 'data-hand="' + i + '"')
  ).join('');

  $('handlbl').innerHTML = sel == null
    ? 'Your hand — click a card (or keys 1–' + CONFIG.mana + ')'
    : 'Selected: <b>' + hand[sel].nume + '</b> — click a gap in the bottom row (gaps between cards work too)';

  $('status').innerHTML = 'deck: ' + deck.length + ' · rows: ' + board.length
    + (CONFIG.randuriMax ? '/' + CONFIG.randuriMax : '')
    + ' · ' + randCurent().length + '/' + CONFIG.latime;

  const randPlin = CONFIG.randuriMax && board.length >= CONFIG.randuriMax;
  $('btnEnd').disabled = gata || !randCurent().length || randPlin;
  $('btnUndo').disabled = !istoric.length;
  updateTotal();
}

function updateTotal(){
  const total = totalAfisat();
  $('rowtotal').textContent = total;
  const ramas = Math.max(0, CONFIG.viataInamic - total);
  $('ehp').textContent = ramas + ' / ' + CONFIG.viataInamic;
  $('ehpfill').style.width = (ramas / CONFIG.viataInamic * 100) + '%';
  board.forEach((row, r) => {
    const el = document.querySelector('[data-rowsum="' + r + '"]');
    if(el) el.textContent = row.reduce((s, c) => s + (c.shown || 0), 0);
  });
}

/* ---------- animația numerelor: 3-4-5-6 ---------- */
function anim(){
  clearTimeout(animTimer);
  const step = () => {
    let changed = false;
    board.forEach((row, r) => row.forEach((c, i) => {
      if(c.shown === c.score) return;
      const dir = c.shown < c.score ? 1 : -1;
      c.shown += dir;
      changed = true;
      const el = document.querySelector('[data-cell="' + r + ':' + i + '"] .val');
      if(el){ el.textContent = c.shown; el.className = 'val ' + (dir > 0 ? 'up' : 'down'); }
    }));
    updateTotal();
    if(changed) animTimer = setTimeout(step, CONFIG.pasAnim);
    else {
      document.querySelectorAll('.val.up,.val.down').forEach(e => e.className = 'val');
      verificaVictoria();
    }
  };
  step();
}

function logEntry(head, det, cls){
  const div = document.createElement('div');
  div.className = 'entry';
  div.innerHTML = '<div class="head ' + (cls||'') + '">' + head + '</div>'
    + (det ? '<div class="det">' + det + '</div>' : '');
  $('log').prepend(div);
}

function verificaVictoria(){
  if(gata) return;
  if(totalCovor() >= CONFIG.viataInamic){
    gata = true;
    logEntry('★ ENEMY DEFEATED — carpet total ' + totalCovor() + ' ★', '', 'win');
    render();
  }
}

/* ============================================================
   JOC
   ============================================================ */
function selecteaza(i){
  if(gata || i < 0 || i >= hand.length) return;
  sel = (sel === i) ? null : i;
  render();
}

function fotografie(){
  return {
    board: board.map(row => row.map(c => ({
      def:c.def, score:c.score, shown:c.shown, uid:c.uid,
      lit:Object.assign({}, c.lit), platit:new Set(c.platit)
    }))),
    hand: hand.slice(),
    gata: gata
  };
}

function insereaza(i){
  if(gata || sel == null) return;
  const row = randCurent();
  if(row.length >= CONFIG.latime) return;

  istoric.push(fotografie());

  const def = hand[sel];
  const uid = ++ordine;
  row.splice(i, 0, {
    def: def, shown: def.v, score: def.v, uid: uid,
    lit: {}, platit: new Set(), nou: true
  });
  hand.splice(sel, 1);
  sel = null;

  const rezumat = conecteaza();
  render();
  anim();
  logEntry(def.v + def.s + ' ' + def.nume + ' played',
           rezumat.length ? '· ' + rezumat.join('\n· ') : '· no links');
}

function undo(){
  if(!istoric.length) return;
  const f = istoric.pop();
  board = f.board;
  hand = f.hand;
  gata = f.gata;
  sel = null;
  render();
  anim();
}

/* „Build row" = închide rândul curent și începe unul nou pe covor.
   Nu se calculează damage aici — totalul covorului e viu tot timpul. */
function randNou(){
  if(gata || !randCurent().length) return;
  if(CONFIG.randuriMax && board.length >= CONFIG.randuriMax) return;
  istoric.push(fotografie());
  board.push([]);
  trage();
  render();
  logEntry('Row ' + (board.length - 1) + ' closed — carpet total ' + totalCovor(), '');
}

/* ---------- evenimente (delegate) ---------- */
$('hand').addEventListener('click', e => {
  const el = e.target.closest('[data-hand]');
  if(el) selecteaza(+el.dataset.hand);
});
$('mat').addEventListener('click', e => {
  const el = e.target.closest('[data-gap]');
  if(el) insereaza(+el.dataset.gap);
});
$('btnEnd').addEventListener('click', randNou);
$('btnUndo').addEventListener('click', undo);
$('btnReset').addEventListener('click', reset);
document.addEventListener('keydown', e => {
  if(e.key >= '1' && e.key <= '9') selecteaza(+e.key - 1);
  if(e.key === 'Escape'){ sel = null; render(); }
  if(e.key === 'Enter') randNou();
  if(e.key === 'Backspace'){ e.preventDefault(); undo(); }
});

reset();
