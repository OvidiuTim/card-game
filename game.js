/* ============================================================
   Card Carpet — prototip mecanic (v5)
   ------------------------------------------------------------
   - cărțile NU au efecte (zona de jos e rezervată pentru ele)
   - numărul din stânga-sus ESTE puterea curentă a cărții
   - fiecare carte are 4 margini (u/r/d/l), fiecare cu o suită sau null

   CONEXIUNI — se verifică DUPĂ FIECARE CARTE JUCATĂ, pe tot rândul:
     · se fotografiază puterile de la începutul verificării
     · orice pereche vecină încă neplătită în care marginea lui A
       are suita lui B  ->  A primește puterea (din fotografie) a lui B
     · o pereche plătește o singură dată; puterea câștigată rămâne
   Așa, o carte împinsă de o inserare care ajunge lângă / sub un
   vecin potrivit își încasează punctele la următoarea verificare.
   ============================================================ */

const H = '♥', D = '♦', C = '♣', S = '♠';
const RED = [H, D];

const CONFIG = {
  latime: 6,        // maxim cărți pe rând
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

/* ---------- stare ---------- */
let deck, hand, board, sel, ehp, dmgRand, gata, ordine, animTimer, istoric;

const $ = id => document.getElementById(id);
const randCurent = () => board[board.length - 1];

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
  sel = null; ehp = CONFIG.viataInamic; dmgRand = []; gata = false; ordine = 0; istoric = [];
  trage();
  $('log').innerHTML = '';
  render();
}

/* ============================================================
   CONEXIUNI
   ============================================================ */
function vecin(r, i, dir){
  const dd = { u:[-1,0], d:[1,0], l:[0,-1], r:[0,1] }[dir];
  const row = board[r + dd[0]];
  if(!row) return null;
  const c = row[i + dd[1]];
  return c ? { cell: c, r: r + dd[0] } : null;
}

/* verifică TOT rândul curent și plătește orice conexiune nouă */
function conecteaza(){
  const r = board.length - 1;
  const foto = new Map();
  board.forEach(row => row.forEach(c => foto.set(c, c.score)));

  const rezumat = [];
  board[r].forEach((c, i) => {
    ['u','d','l','r'].forEach(dir => {
      const v = vecin(r, i, dir);
      if(!v) return;
      const N = v.cell;
      if(c.def.e[dir] !== N.def.s) return;     // marginea nu se potrivește cu suita vecinului
      const cheie = dir + ':' + N.uid;
      if(c.platit.has(cheie)) return;          // perechea asta a plătit deja
      c.platit.add(cheie);
      const p = foto.get(N);
      c.score += p;
      c.lit[dir] = true;
      rezumat.push(c.def.nume + ' +' + p + ' from ' + N.def.nume);
    });
  });
  return rezumat;
}

/* ============================================================
   RANDARE
   ============================================================ */
function suita(s, lit){
  if(!s) return '';
  return '<span class="' + (RED.includes(s) ? 'red' : 'blk') + (lit ? ' lit' : '') + '">' + s + '</span>';
}

function cardHtml(c, cls, attr){
  const def = c.def, e = def.e, lit = c.lit || {};
  return '<div class="card ' + (cls||'') + '" ' + (attr||'') + '>'
    + (e.u ? '<span class="e u' + (lit.u?' lit':'') + '">' + suita(e.u, lit.u) + '</span>' : '')
    + (e.d ? '<span class="e d' + (lit.d?' lit':'') + '">' + suita(e.d, lit.d) + '</span>' : '')
    + (e.l ? '<span class="e l' + (lit.l?' lit':'') + '">' + suita(e.l, lit.l) + '</span>' : '')
    + (e.r ? '<span class="e r' + (lit.r?' lit':'') + '">' + suita(e.r, lit.r) + '</span>' : '')
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
  $('ehp').textContent = Math.max(0, ehp) + ' / ' + CONFIG.viataInamic;
  $('ehpfill').style.width = Math.max(0, ehp / CONFIG.viataInamic * 100) + '%';

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
    if(!row.length) h += '<span class="rowsum" style="margin-left:0">play your first card…</span>';
    if(dmgRand[r] != null) h += '<div class="rowdmg">→ ' + dmgRand[r] + ' dmg</div>';
    else if(curent && row.length) h += '<div class="rowsum">total <b id="rowsum">0</b></div>';
    return '<div class="row">' + h + '</div>';
  }).join('');
  $('mat').scrollTop = $('mat').scrollHeight;

  $('hand').innerHTML = hand.map((d, i) =>
    cardHtml({ def: d, shown: d.v, lit: {} }, 'hand' + (sel === i ? ' sel' : ''), 'data-hand="' + i + '"')
  ).join('');

  $('handlbl').innerHTML = sel == null
    ? 'Your hand — click a card (or keys 1–' + CONFIG.mana + ')'
    : 'Selected: <b>' + hand[sel].nume + '</b> — click a gap in the bottom row (gaps between cards work too)';

  $('status').innerHTML = 'deck: ' + deck.length + ' · row ' + board.length
    + ' · ' + randCurent().length + '/' + CONFIG.latime;
  $('btnEnd').disabled = gata || !randCurent().length;
  $('btnUndo').disabled = gata || !istoric.length;
  updateTotal();
}

function updateTotal(){
  const t = randCurent().reduce((s, c) => s + (c.shown || 0), 0);
  $('rowtotal').textContent = t;
  const rs = $('rowsum');
  if(rs) rs.textContent = t;
}

/* ---------- animația numerelor: 3-4-5-6 ---------- */
function anim(){
  clearTimeout(animTimer);
  const r = board.length - 1;
  const step = () => {
    let changed = false;
    board[r].forEach((c, i) => {
      if(c.shown === c.score) return;
      const dir = c.shown < c.score ? 1 : -1;
      c.shown += dir;
      changed = true;
      const el = document.querySelector('[data-cell="' + r + ':' + i + '"] .val');
      if(el){ el.textContent = c.shown; el.className = 'val ' + (dir > 0 ? 'up' : 'down'); }
    });
    updateTotal();
    if(changed) animTimer = setTimeout(step, CONFIG.pasAnim);
    else document.querySelectorAll('.val.up,.val.down').forEach(e => e.className = 'val');
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
    row: randCurent().map(c => ({
      def:c.def, score:c.score, shown:c.shown, uid:c.uid, ord:c.ord,
      lit:Object.assign({}, c.lit), platit:new Set(c.platit)
    })),
    hand: hand.slice()
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
    def: def, shown: def.v, score: def.v, uid: uid, ord: uid,
    lit: {}, platit: new Set(), nou: true
  });
  hand.splice(sel, 1);
  sel = null;

  const rezumat = conecteaza();
  render();
  anim();
  if(rezumat.length) logEntry(def.v + def.s + ' ' + def.nume + ' played', '· ' + rezumat.join('\n· '));
}

function undo(){
  if(gata || !istoric.length) return;
  const f = istoric.pop();
  board[board.length - 1] = f.row;
  hand = f.hand;
  sel = null;
  render();
  anim();
}

function lovesteCuRandul(){
  const r = board.length - 1;
  const row = board[r];
  if(gata || !row.length) return;

  clearTimeout(animTimer);
  row.forEach(c => c.shown = c.score);

  const dmg = row.reduce((s, c) => s + c.score, 0);
  dmgRand[r] = dmg;
  ehp -= dmg;

  logEntry('ROW ' + (r+1) + ' → ' + dmg + ' dmg',
    row.map(c => '· ' + c.def.nume + ' (' + c.def.v + c.def.s + ') = ' + c.score).join('\n'));

  if(ehp <= 0){
    gata = true;
    logEntry('★ ENEMY DEFEATED in ' + (r+1) + ' rows ★', '', 'win');
    render();
    return;
  }
  board.push([]);
  istoric = [];
  trage();
  render();
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
$('btnEnd').addEventListener('click', lovesteCuRandul);
$('btnUndo').addEventListener('click', undo);
$('btnReset').addEventListener('click', reset);
document.addEventListener('keydown', e => {
  if(e.key >= '1' && e.key <= '9') selecteaza(+e.key - 1);
  if(e.key === 'Escape'){ sel = null; render(); }
  if(e.key === 'Enter') lovesteCuRandul();
  if(e.key === 'Backspace'){ e.preventDefault(); undo(); }
});

reset();
