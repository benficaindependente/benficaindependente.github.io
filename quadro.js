/* Plataforma · Benfica Independente — quadro tático em direto e sondagens com fotos.
   Carregado antes de app.js (as funções só usam o que está em app.js quando são chamadas). */
'use strict';

/* =============================== Relvado (SVG) =============================== */
const RL = 105, RW = 68;   // medidas oficiais do relvado (metros)

/** Linhas do campo, em metros (x ao comprimento, y à largura). */
function relvadoSvg() {
  const ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const rect = (x1, y1, x2, y2, rx) => `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="none"${rx ? ` rx="${rx}"` : ''}/>`;
  const arco = (cx, cy, r, a1, a2) => {
    const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    return `<path d="M${x1} ${y1} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}" fill="none"/>`;
  };
  let faixas = '';
  for (let i = 0; i < 14; i += 2) faixas += `<rect x="${i * RL / 14}" y="0" width="${RL / 14}" height="${RW}" fill="rgba(255,255,255,.038)"/>`;
  // Redes das balizas (linhas finas).
  const rede = (x0, s) => {
    let g = '';
    for (let i = 1; i <= 3; i++) g += `<line x1="${x0 + s * i * .8}" y1="${RW / 2 - 3.66}" x2="${x0 + s * i * .8}" y2="${RW / 2 + 3.66}"/>`;
    for (let j = 1; j <= 5; j++) {
      const yy = RW / 2 - 3.66 + j * 7.32 / 6;
      g += `<line x1="${x0}" y1="${yy}" x2="${x0 + s * 2.4}" y2="${yy}"/>`;
    }
    return g;
  };
  return `<defs>
      <linearGradient id="relva" x1="0" y1="0" x2=".9" y2="1">
        <stop offset="0" stop-color="#3a8f47"/><stop offset=".5" stop-color="#2f7c3a"/><stop offset="1" stop-color="#25662f"/>
      </linearGradient>
      <radialGradient id="luzRelva" cx="50%" cy="42%" r="72%">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".12"/><stop offset="1" stop-color="#00110a" stop-opacity=".22"/>
      </radialGradient>
      <filter id="sombraLinha" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy=".14" stdDeviation=".14" flood-color="#001b08" flood-opacity=".55"/>
      </filter>
    </defs>
    <rect x="-3" y="-3" width="${RL + 6}" height="${RW + 6}" rx="3.2" fill="#0b1710"/>
    <rect x="0" y="0" width="${RL}" height="${RW}" rx="1.8" fill="url(#relva)"/>
    ${faixas}
    <rect x="0" y="0" width="${RL}" height="${RW}" rx="1.8" fill="url(#luzRelva)"/>
    <g stroke="rgba(255,255,255,.92)" stroke-width=".2" fill="none" stroke-linecap="round" filter="url(#sombraLinha)">
      ${rect(0, 0, RL, RW, 1.8)}
      ${ln(RL / 2, 0, RL / 2, RW)}
      <circle cx="${RL / 2}" cy="${RW / 2}" r="9.15"/>
      ${rect(0, RW / 2 - 20.16, 16.5, RW / 2 + 20.16)}${rect(RL, RW / 2 - 20.16, RL - 16.5, RW / 2 + 20.16)}
      ${rect(0, RW / 2 - 9.16, 5.5, RW / 2 + 9.16)}${rect(RL, RW / 2 - 9.16, RL - 5.5, RW / 2 + 9.16)}
      ${rect(0, RW / 2 - 3.66, -2, RW / 2 + 3.66)}${rect(RL, RW / 2 - 3.66, RL + 2, RW / 2 + 3.66)}
      ${arco(11, RW / 2, 9.15, -53.13, 53.13)}${arco(RL - 11, RW / 2, 9.15, 126.87, 233.13)}
      ${arco(0, 0, 1, 0, 90)}${arco(0, RW, 1, 270, 360)}${arco(RL, 0, 1, 90, 180)}${arco(RL, RW, 1, 180, 270)}
      <g stroke-width=".11" opacity=".8">${rede(0, -1)}${rede(RL, 1)}</g>
    </g>
    <g fill="rgba(255,255,255,.92)"><circle cx="${RL / 2}" cy="${RW / 2}" r=".38"/><circle cx="11" cy="${RW / 2}" r=".38"/><circle cx="${RL - 11}" cy="${RW / 2}" r=".38"/></g>`;
}

/** Desenho completo (relvado + riscos + jogadores) para o editor e para as pré-visualizações. */
/** Cores dos jogadores. Sem cor escolhida: encarnado (Benfica), branco (adversário) e o guarda-redes de amarelo. */
const CORES_Q = { vermelho: '#e0121f', branco: '#f4f6f8', amarelo: '#ffd400', laranja: '#ff7a00', preto: '#1b1b1b', rosa: '#ff5fa2' };
const CORES_CLARAS_Q = new Set(['branco', 'amarelo', 'rosa']);
/** O que se escreve debaixo do jogador: o apelido, para os nomes não se pisarem. */
function etiquetaJogador(nome) {
  const n = String(nome || '').trim();
  if (n.length <= 9 || !n.includes(' ')) return n;
  const ult = n.split(/\s+/).pop();
  return ult.length >= 3 ? ult : n;
}
function corJogador(p) {
  if (p.cor && CORES_Q[p.cor]) return { fundo: CORES_Q[p.cor], claro: CORES_CLARAS_Q.has(p.cor), especial: true };
  const guarda = !p.cor && (p.c === 'b' ? p.x > 0.91 : p.x < 0.09);
  if (guarda) return { fundo: CORES_Q.amarelo, claro: true, especial: true };
  return p.c === 'b' ? { fundo: CORES_Q.branco, claro: true } : { fundo: CORES_Q.vermelho, claro: false };
}

let QUADRO_IDS = 0;
function quadroSvg(estado, extra) {
  const e = estado || { pontos: [], linhas: [] };
  const n = ++QUADRO_IDS;
  const linhas = (e.linhas || []).map((l, i) =>
    `<line data-linha="${i}" x1="${l.x1 * RL}" y1="${l.y1 * RW}" x2="${l.x2 * RL}" y2="${l.y2 * RW}" stroke="#111" stroke-width=".55" stroke-linecap="round" ${l.t === 'seta' ? 'marker-end="url(#ponta)"' : ''}/>`).join('');
  const pontos = (e.pontos || []).map((p, i) => {
    const k = corJogador(p);
    const v = !k.claro;
    const R = 3.3;
    const x = Math.round(p.x * RL * 1000) / 1000;
    const y = Math.round(p.y * RW * 1000) / 1000;
    const foto = /^https:\/\//i.test(String(p.foto || '')) ? p.foto : '';
    const clip = `qc${n}_${i}`;
    const cx = Math.round((x - R) * 1000) / 1000, cy = Math.round((y - R) * 1000) / 1000;
    const circulo = foto
      ? `<defs><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${R}"/></clipPath></defs>
         <image href="${esc(foto)}" xlink:href="${esc(foto)}" x="${cx}" y="${cy}" width="${R * 2}" height="${R * 2}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="${x}" cy="${y}" r="${R}" fill="${k.fundo}"/>`;
    const nome = etiquetaJogador(p.nome);
    const larg = Math.min(15, Math.max(3.6, nome.length * 0.78 + 1.6));
    const pill = nome
      ? `<rect x="${Math.round((x - larg / 2) * 100) / 100}" y="${Math.round((y + R + 0.25) * 100) / 100}" width="${Math.round(larg * 100) / 100}" height="2.7" rx="1.35" fill="rgba(3,10,6,.78)"/>
         <text x="${x}" y="${Math.round((y + R + 2.3) * 100) / 100}" text-anchor="middle" font-size="1.5" font-weight="700" font-family="Arial, sans-serif" fill="#ffffff">${esc(nome)}</text>`
      : '';
    return `<g data-ponto="${i}" class="q-ponto">
      <circle cx="${x}" cy="${y}" r="${R * 2.1}" fill="#fff" fill-opacity="0"/>
      <ellipse cx="${x}" cy="${Math.round((y + R * 0.8) * 100) / 100}" rx="${R * 0.95}" ry="${R * 0.5}" fill="rgba(0,0,0,.35)"/>
      ${circulo}
      <circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${foto && k.especial ? k.fundo : (v ? 'rgba(255,255,255,.98)' : 'rgba(8,14,10,.9)')}" stroke-width="${foto && k.especial ? '.95' : '.5'}"/>
      ${p.n && !foto ? `<text x="${x}" y="${y + .68}" text-anchor="middle" font-size="3.1" font-weight="800" fill="${v ? '#fff' : '#141414'}" font-family="Arial, sans-serif">${esc(p.n)}</text>` : ''}
      ${pill}</g>`;
  }).join('');
  let bola = '';
  if (e.bola && typeof e.bola.x === 'number') {
    const bx = Math.round(e.bola.x * RL * 1000) / 1000, by = Math.round(e.bola.y * RW * 1000) / 1000;
    bola = `<g data-bola="1" class="q-bola"><circle cx="${bx}" cy="${by}" r="3.4" fill="#fff" fill-opacity="0"/>
      <ellipse cx="${bx}" cy="${Math.round((by + 1.0) * 100) / 100}" rx="1.2" ry=".55" fill="rgba(0,0,0,.4)"/>
      <circle cx="${bx}" cy="${by}" r="1.3" fill="#fff" stroke="#111" stroke-width=".24"/>
      <polygon points="${bx},${by - .6} ${bx + .57},${by - .18} ${bx + .35},${by + .5} ${bx - .35},${by + .5} ${bx - .57},${by - .18}" fill="#111"/></g>`;
  }
  return `<svg class="quadro-svg" viewBox="-3 -3 ${RL + 6} ${RW + 6}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs><marker id="ponta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#111"/></marker></defs>
    ${relvadoSvg()}<g>${linhas}</g><g>${pontos}</g>${bola}${extra || ''}</svg>`;
}

/** Nomes dos suplentes que entraram, em texto (por fora do relvado). */
function bancosHtml(bancos) {
  if (!bancos) return '';
  const b = bancos.b || [], v = bancos.v || [];
  if (!v.length && !b.length) return '';
  const linha = (lista, cor) => lista.length
    ? `<div class="q-banco"><i style="background:${cor}"></i>${lista.map(esc).join(' · ')}</div>` : '';
  return `<div class="q-bancos">${linha(v, '#e21227')}${linha(b, '#fff')}</div>`;
}

/** "2026-11-08T20:30Z" → "8/11". */
function dataCurtaJogo(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' });
}

/** Mini lista lateral com os últimos 10 jogos; tocar num jogo põe lá o onze das duas equipas. */
function listaJogosHtml() {
  const lista = ULTIMOS.lista;
  if (!lista) return ULTIMOS.falhou ? '<p class="suave mini">Sem lista de jogos (ESPN indisponível).</p>' : '<p class="suave mini">A carregar os jogos…</p>';
  if (!lista.length) return '<p class="suave mini">Sem lista de jogos (ESPN indisponível).</p>';
  const ativo = (QUADRO.estado.jogo && String(QUADRO.estado.jogo.id)) || '';
  return lista.map(j => `<button class="q-jogo ${String(j.id) === ativo ? 'ativo' : ''}" data-jogo="${esc(j.id)}" title="${esc(j.nome)}">
      <span class="q-jogo-data">${esc(dataCurtaJogo(j.data))}</span>
      <span class="q-jogo-nome">${j.casa ? 'vs' : 'em'} ${esc(j.adversario)}</span>
      <span class="q-jogo-res">${esc(j.golosN)}-${esc(j.golosA)}</span>
    </button>`).join('');
}

/* ------------------------------ Linha do tempo (substituições e expulsões) ------------------------------ */
// O quadro guarda o onze inicial e a lista de acontecimentos do jogo. Carregar num
// acontecimento põe o campo como estava nesse minuto — nas duas equipas ao mesmo tempo.

/** XI inicial guardado no quadro (nos quadros antigos, o próprio desenho). */
function pontosIniciais(estado) {
  const e = estado || {};
  if (e.inicial && (((e.inicial.v || []).length) || ((e.inicial.b || []).length))) {
    return JSON.parse(JSON.stringify([...(e.inicial.v || []), ...(e.inicial.b || [])]));
  }
  return JSON.parse(JSON.stringify(e.pontos || []));
}

function mesmoNome(a, b) { return semAcentos(a) === semAcentos(b); }

function acharSuplente(estado, equipa, nome) {
  const lista = ((estado.suplentes || {})[equipa]) || [];
  return lista.find(s => mesmoNome(s.nome, nome)) || null;
}

/** Campo como estava até um minuto (inclusive). [min] null = minuto 0 (onze inicial). */
function aplicarTempo(estado, min) {
  const pontos = pontosIniciais(estado);
  if (min == null) return pontos;
  const eventos = (estado.eventos || []).filter(e => Number(e.min) <= Number(min));
  for (const ev of eventos) {
    const i = pontos.findIndex(p => p.c === ev.equipa && mesmoNome(p.nome, ev.sai));
    if (i < 0) continue;
    if (ev.tipo === 'vermelho') { pontos.splice(i, 1); continue; }
    const s = acharSuplente(estado, ev.equipa, ev.entra);
    pontos[i] = {
      ...pontos[i],
      nome: (s && s.nome) || ev.entra,
      n: (s && s.n) || pontos[i].n || '',
      foto: (s && s.foto) || ''
    };
  }
  return pontos;
}

let QUADRO_TEMPO = null;    // null = automático (fechado em ecrã inteiro, aberto fora)
let FORA_TEMPO = null;      // fecha a lista ao tocar fora
let PAINEL_QUADRO = null;   // 'taticas' = lista de táticas aberta

/** Lista de táticas para escolher (abre por cima do campo, com ✕). */
function painelTaticas() {
  const linha = (lado, titulo) => `<div class="q-painel-linha"><b>${titulo}</b>${
    Object.keys(FORMACOES).map(f => `<button class="botao pequeno" data-form="${lado}:${f}">${f}</button>`).join('')}</div>`;
  return `<div class="q-painel">
    <div class="q-painel-topo"><b>🎯 Táticas</b><button class="q-painel-x" data-painel-x title="Fechar">✕</button></div>
    ${linha('v', '🔴 Benfica')}${linha('b', '⚪ Adversário')}
  </div>`;
}

/** Botões do tempo: uma barra com 1 substituição e, ao carregar, a lista completa. */
function htmlTempo(estado, cheio) {
  const evs = (estado.eventos || []).slice().sort((a, b) => Number(a.min) - Number(b.min));
  if (!evs.length) {
    return `<div class="q-tempo"><div class="q-tempo-vazio">
      <b>Substituições e expulsões</b>
      <span class="suave">Ainda não há um jogo carregado neste quadro. Toca em <b>⚽ Benfica + adversário</b> (aqui em baixo) ou escolhe um jogo na lista ao lado — as substituições e expulsões aparecem aqui, por minuto.</span>
    </div></div>`;
  }
  const aberto = QUADRO_TEMPO == null ? !cheio : !!QUADRO_TEMPO;
  const equipaB = ((estado.suplentes || {}).equipaB) || 'Adversário';
  const momento = estado.momento == null ? null : Number(estado.momento);
  const bloco = (lado, titulo) => {
    let n = 0;
    const linhas = evs.filter(e => e.equipa === lado).map(e => {
      const ativo = momento != null && Number(e.min) === momento;
      const vermelho = e.tipo === 'vermelho';
      const rotulo = vermelho ? `Expulsão · ${e.sai}` : `Sub ${++n} · ${e.entra} (sai ${e.sai})`;
      return `<button class="q-ev ${ativo ? 'ativo' : ''} ${vermelho ? 'q-ev-vermelho' : ''}" data-min="${esc(e.min)}">
        <span class="q-ev-min">${vermelho ? '🟥 ' : ''}${esc(e.min)}'</span>
        <span class="q-ev-txt">${esc(rotulo)}</span></button>`;
    }).join('');
    return `<div class="q-tempo-lado"><b>${esc(titulo)}</b>${linhas || '<span class="suave mini">Sem substituições.</span>'}</div>`;
  };
  const primeiro = evs[0];
  const resumo = primeiro
    ? `${primeiro.min}' · ${primeiro.tipo === 'vermelho' ? '🟥 ' + primeiro.sai : 'Sub 1 · ' + primeiro.entra + ' (sai ' + primeiro.sai + ')'}`
    : '';
  return `<div class="q-tempo ${aberto ? 'aberto' : ''}">
    <div class="q-tempo-barra">
      <button class="q-tempo-toggle" data-tempo-toggle>
        <span>📋 Substituições <b>${evs.length}</b></span>
        <span class="q-tempo-seta">${aberto ? '▴' : '▾'}</span>
      </button>
      <button class="q-ev q-ev-zero ${momento == null ? 'ativo' : ''}" data-min="0">⏱ Min. 0</button>
      ${aberto
        ? '<button class="q-tempo-fechar" data-tempo-fechar title="Fechar a lista">✕</button>'
        : `<span class="q-tempo-resumo">${esc(resumo)}</span>`}
    </div>
    <div class="q-tempo-corpo">
      <div class="q-tempo-listas">${bloco('v', 'Benfica')}${bloco('b', equipaB)}</div>
    </div>
  </div>`;
}

/** Como aparece no Início da app (para a pré-visualização antes de pôr na app). */
function prevQuadro(estado, titulo) {
  return telemovel(`<div class="tm-cartao tm-p"><div class="tm-etiqueta">● QUADRO TÁTICO · AO VIVO</div>
      ${titulo ? `<b class="tm-grande">${esc(titulo)}</b>` : ''}
      <div style="margin-top:8px;border-radius:8px;overflow:hidden">${quadroSvg(estado)}</div>
      ${bancosHtml(estado && estado.bancos)}
      <div class="tm-mini">Em direto. Toca para ver em ecrã inteiro.</div></div>`,
    'No topo do Início, no lugar do "Quem somos". Mexe ao mesmo tempo que aqui (1 a 2 segundos).');
}

/* =============================== Editor do quadro =============================== */
/** Formações por linhas: [quantos jogadores, posição ao comprimento (0 = a própria baliza)].
 *  Dentro de cada linha, os jogadores espalham-se pela largura e os dos extremos ficam sempre nas alas. */
const FORMACOES_LINHAS = {
  '4-3-3':   [[1, .04, [.5]], [4, .21, [.12, .38, .62, .88]], [3, .34, [.3, .5, .7]], [3, .43, [.14, .5, .86]]],
  '4-4-2':   [[1, .04, [.5]], [4, .21, [.12, .38, .62, .88]], [4, .35, [.1, .38, .62, .9]], [2, .43, [.4, .6]]],
  '4-2-3-1': [[1, .04, [.5]], [4, .21, [.12, .38, .62, .88]], [2, .31, [.4, .6]], [3, .40, [.15, .5, .85]], [1, .44, [.5]]],
  '4-1-4-1': [[1, .04, [.5]], [4, .21, [.12, .38, .62, .88]], [1, .29, [.5]], [4, .38, [.1, .38, .62, .9]], [1, .44, [.5]]],
  '3-5-2':   [[1, .04, [.5]], [3, .20, [.25, .5, .75]], [5, .34, [.08, .3, .5, .7, .92]], [2, .43, [.4, .6]]],
  '3-4-3':   [[1, .04, [.5]], [3, .20, [.25, .5, .75]], [4, .34, [.1, .38, .62, .9]], [3, .43, [.15, .5, .85]]],
  '5-3-2':   [[1, .04, [.5]], [5, .21, [.08, .29, .5, .71, .92]], [3, .35, [.3, .5, .7]], [2, .43, [.4, .6]]]
};
/** Posições a que cada linha chega, de 0 a 1 na largura (os extremos ficam junto às linhas laterais). */
function larguraLinha(n) {
  if (n === 1) return [.5];
  if (n === 2) return [.36, .64];
  if (n === 3) return [.2, .5, .8];
  if (n === 4) return [.1, .37, .63, .9];
  if (n === 5) return [.08, .29, .5, .71, .92];
  return Array.from({ length: n }, (_, i) => .1 + (.8 * i) / (n - 1));
}
/** Compatível com o resto do código: lista [x, y] de cada lugar, linha a linha. */
const FORMACOES = {};
Object.keys(FORMACOES_LINHAS).forEach(f => {
  FORMACOES[f] = FORMACOES_LINHAS[f].flatMap(([n, x, ys]) => (ys || larguraLinha(n)).map(y => [x, y]));
});


const CSS_BANCA = `
.qb{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:10px;height:calc(100vh - 150px);min-height:460px}
.qb.sem-painel{grid-template-columns:minmax(0,1fr)}
.qb.sem-painel .qb-painel{display:none}
.qb *{box-sizing:border-box}
.qb-campo-col{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
.qb-topo{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.qb-pill{flex:0 0 auto;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:800;background:#1d232b;border:1px solid #2b333d;color:#c8d0da}
.qb-pill.ok{background:rgba(226,18,39,.2);border-color:#e21227;color:#ffd5d9}
.qb-titulo{flex:1;min-width:0;background:#12161c;border:1px solid #2b333d;border-radius:10px;color:#e8edf3;padding:9px 12px;font:inherit;font-size:14px}
.qb .botao{white-space:normal;line-height:1.15;text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:.4em}
.qb-ferr{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:58px;padding:6px 2px;border-radius:12px;background:#1d232b;border:1px solid #2b333d;color:#dfe5ec;font:inherit;font-size:12px;font-weight:700;line-height:1.1;cursor:pointer;text-align:center}
.qb-ferr .qb-ic{font-size:20px;line-height:1}
.qb-ferr.ativa{background:#e21227;border-color:#ff6070;color:#fff;box-shadow:0 2px 10px rgba(226,18,39,.4)}
.qb-ferr:active{transform:scale(.97)}
.qb-aba{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.1}
.qb-aba .qb-ic{font-size:17px;line-height:1}
.qb-cores{display:flex;flex-wrap:wrap;gap:8px}
.qb-cor{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.35);cursor:pointer;padding:0;color:#fff;font-size:16px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.qb-cor.padrao{background:#2b333d}
.qb-cor.ativa{border-color:#fff;box-shadow:0 0 0 3px rgba(226,18,39,.65)}
.qb-minutos{flex:0 0 auto;background:#12161c;border:1px solid #2b333d;border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.qb-minutos.vazio{font-size:12.5px;color:#9aa4b2}
.qb-min-linha{display:flex;align-items:center;gap:10px}
.qb-min-linha>b{flex:0 0 auto;font-size:12px;color:#9aa4b2;text-transform:uppercase;letter-spacing:.05em}
.qb-slider{flex:1;min-width:80px;accent-color:#e21227;height:26px}
.qb-min-val{flex:0 0 auto;min-width:44px;text-align:center;font-weight:800;font-size:15px;background:#e21227;color:#fff;border-radius:8px;padding:3px 8px}
.qb-min-evs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.qb-ev{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:0 11px;border-radius:10px;border:1px solid #2b333d;background:#1d232b;color:#e8edf3;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.qb-ev b{color:#ffb3b3}
.qb-ev.ativo{background:#e21227;border-color:#ff6070;color:#fff}.qb-ev.ativo b{color:#fff}
.qb-ev.verm{border-color:#7a1e26}
.qb.palco{grid-template-columns:minmax(0,1fr) 148px}
.qb.palco.fs{position:fixed;inset:0;z-index:95;height:100vh!important;height:100dvh!important;min-height:0;padding:8px 10px;background:#0b0d11;gap:8px}
.qb.palco .qb-topo{gap:6px;flex-wrap:nowrap}
.qb.palco .qb-titulo{min-width:70px;padding:8px 10px}
.qb.palco .qb-topo .botao{min-height:44px;padding:0 12px;flex:0 0 auto}
.qb.palco .qb-abre{flex-direction:column;gap:1px;padding:0 10px;font-size:11px}
.qb.palco .qb-abre .qb-ic{font-size:17px;line-height:1}
.qb.palco .qb-abre.ativo{background:#e21227;border-color:#ff6070;color:#fff}
.qb-trilho{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:minmax(0,1fr);gap:8px;min-height:0;align-content:stretch}
.qb-trilho .qb-ferr{min-height:0;height:100%;border-radius:14px;font-size:12.5px}
.qb-trilho .qb-ferr .qb-ic{font-size:24px}
.qb-cores.trilho{grid-column:1/3;gap:6px}
.qb-cores.trilho .qb-cor{width:38px;height:38px}
.qb.palco .qb-minutos{padding:6px 10px;gap:4px}
.qb.palco .qb-min-evs{flex-wrap:wrap;overflow:visible;max-height:84px;overflow-y:hidden}
.qb.palco .qb-ev{min-height:34px;font-size:12px}
.qb.palco .qb-momentos{flex-wrap:wrap;overflow:visible}
.qb-fundo{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:14px}
.qb-folha{width:min(720px,100%);max-height:calc(100dvh - 28px);background:#12161c;border:1px solid #3a4452;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden}
.qb-folha-topo{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #2b333d;font-size:16px}
.qb-folha-corpo{padding:14px;display:flex;flex-direction:column;gap:14px;overflow:auto}
.qb-grelha.q4{grid-template-columns:repeat(4,minmax(0,1fr))}
.qb-grelha.q3{grid-template-columns:repeat(3,minmax(0,1fr))}
.qb-folha .qb-grelha .botao{min-height:48px;font-size:.95rem}
.qb-jogos2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.qb-jogo-btn{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;border-radius:12px;border:1px solid #2b333d;background:#1d232b;color:#e8edf3;font:inherit;font-size:13.5px;cursor:pointer;text-align:left}
.qb-jogo-btn b{color:#9aa4b2;font-weight:700}.qb-jogo-btn i{margin-left:auto;font-style:normal;font-weight:800;color:#ffb3b3}
.qb-jogo-btn.ativo{background:#e21227;border-color:#ff6070;color:#fff}.qb-jogo-btn.ativo b,.qb-jogo-btn.ativo i{color:#fff}
@media (max-width:1100px){.qb.palco .qb-abre .tx{display:none}.qb.palco .qb-abre{padding:0 12px}.qb.palco{grid-template-columns:minmax(0,1fr) 128px}}
.qb-topo .botao{padding:.4em .7em;min-height:36px}
.qb .q-campo{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0;max-width:none;margin:0}
.qb .q-campo svg{width:100%;height:100%;max-height:100%;touch-action:none;-webkit-user-select:none;user-select:none}
.qb-momentos{display:flex;align-items:center;gap:8px;overflow-x:auto;flex:0 0 auto;padding:2px 0 4px}
.qb-momentos>b{flex:0 0 auto;font-size:12px;color:#9aa4b2;text-transform:uppercase;letter-spacing:.05em}
.qb-mom-btn{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px 0 8px;border-radius:12px;border:1px solid #3a4452;background:#1d232b;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.qb-mom-btn i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#e21227;font-size:13px}
.qb-mom-btn:active{transform:scale(.97);background:#2a3340}
.qb-mom-vazio{font-size:12.5px;color:#7d8794}
.qb-painel{display:flex;flex-direction:column;min-height:0;background:#12161c;border:1px solid #2b333d;border-radius:14px;overflow:hidden}
.qb-abas{display:flex;flex:0 0 auto;border-bottom:1px solid #2b333d}
.qb-aba{flex:1;padding:9px 2px;background:transparent;border:0;border-bottom:3px solid transparent;color:#9aa4b2;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.qb-aba.ativa{color:#fff;border-bottom-color:#e21227;background:rgba(255,255,255,.03)}
.qb-corpo{flex:1;min-height:0;overflow:auto;padding:9px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}
.qb-sec>b{display:block;font-size:11px;color:#9aa4b2;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px}
.qb-grelha{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.qb-grelha.dois{grid-template-columns:repeat(2,minmax(0,1fr))}
.qb-grelha .botao{width:100%;min-height:34px;padding:.2em .1em;font-size:.78rem}
.qb-linha{display:flex;gap:8px;align-items:center}
.qb-input{flex:1;min-width:0;background:#0f1115;border:1px solid #2b333d;border-radius:10px;color:#e8edf3;padding:11px 12px;font:inherit;font-size:14px;width:100%}
.qb-mom{display:flex;gap:6px;margin-bottom:6px}
.qb-mom .botao:first-child{flex:1;text-align:left}
.qb-ajuda{font-size:12.5px;line-height:1.45;margin:0}
.qb-grande{width:100%;min-height:52px;font-size:1rem!important;font-weight:800!important}
.qb .q-jogos{display:flex;flex-direction:column;gap:6px;max-height:none}
.qb .q-tempo{margin:0}
@media (max-width:1180px){.qb{grid-template-columns:minmax(0,1fr) 262px}.qb-pill{display:none}.qb-titulo{min-width:80px}.qb-aba{font-size:12px}}
.qb-pill.gravar{display:inline-flex;background:#e21227;border-color:#ff6070;color:#fff;animation:qbpisca 1s infinite}
@keyframes qbpisca{50%{opacity:.55}}
.qb-jog-btn{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid #1f6f3d;background:#12301f;color:#d6ffe6;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.qb-jog-btn.tocar{background:#1f8f4d;color:#fff}
.qb-jog-btn.rep{padding:0 12px;margin-left:-6px}
@media (max-width:860px),(orientation:portrait) and (max-width:1100px){
 .qb{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 40%}
 .qb-corpo{padding:10px}
 .qb-grelha{grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (pointer:coarse){
 .qb .botao{min-height:44px;font-size:.9rem}
 .qb-grelha .botao{min-height:44px;font-size:.8rem}
 .qb-aba{padding:13px 2px;font-size:13px}
 .qb-mom-btn,.qb-jog-btn{min-height:50px;font-size:15px}
 .qb-titulo,.qb-input{font-size:16px}
}`;

const CSS_FOCO = `
.q-tempo-barra{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.q-tempo-toggle{display:inline-flex;align-items:center;gap:8px;background:#1d232b;border:1px solid #2b333d;color:#e8edf3;border-radius:10px;padding:7px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.q-tempo-toggle b{background:rgba(226,18,39,.18);color:#ffb3b3;border-radius:6px;padding:0 6px}
.q-tempo-seta{color:#9aa4b2;font-size:11px}
.q-tempo-resumo{flex:1;min-width:0;font-size:12px;color:#9aa4b2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.q-tempo-fechar{background:#2a1215;border:1px solid #5a1e25;color:#ffb3b3;border-radius:8px;padding:6px 10px;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;margin-left:auto}
.q-tempo-corpo{display:none;margin-top:8px}
.q-tempo.aberto .q-tempo-corpo{display:block}
.cartao.q-cheio{position:fixed!important;inset:0!important;z-index:90;margin:0!important;border:0!important;border-radius:0!important;background:#0f1115!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;height:100vh!important;height:100dvh!important;padding:0!important}
.cartao.q-cheio>header{display:none!important}
.cartao.q-cheio .cartao-corpo{flex:1!important;min-height:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;padding:4px 6px!important}
.cartao.q-cheio .q-estado,.cartao.q-cheio .q-lateral,.cartao.q-cheio .linha-acoes,.cartao.q-cheio label,.cartao.q-cheio [data-guardado],.cartao.q-cheio .q-principal>p.suave,.cartao.q-cheio .cartao-corpo>.aviso{display:none!important}
.cartao.q-cheio .q-barra{padding:2px!important;gap:3px!important;margin:0!important}
.cartao.q-cheio .q-barra .botao{padding:.25em .5em!important;font-size:.72rem!important;min-height:28px!important;border-radius:8px!important}
.cartao.q-cheio .q-layout{flex:1!important;min-height:0!important;display:block!important;margin:0!important}
.cartao.q-cheio .q-principal{display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;gap:4px!important}
.cartao.q-cheio .q-campo{flex:1!important;min-height:0!important;max-width:none!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important}
.cartao.q-cheio .q-campo svg{width:100%!important;height:100%!important}
.cartao.q-cheio .q-rodape{flex:0 0 auto!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px!important}
.cartao.q-cheio .q-acoes-fixas{margin:0!important;gap:4px!important}
.cartao.q-cheio .q-acoes-fixas .botao{padding:.25em .55em!important;font-size:.72rem!important;min-height:28px!important;border-radius:8px!important}
.cartao.q-cheio [data-limpar="linhas"]{display:none!important}
.cartao.q-cheio .q-rodape .q-tempo{flex:1 1 300px!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important;max-height:none!important;overflow:visible!important}
.cartao.q-cheio .q-rodape .q-tempo.aberto{position:fixed!important;left:8px!important;right:8px!important;bottom:52px!important;z-index:96!important;max-height:58vh!important;overflow:auto!important;margin:0!important;padding:8px!important;background:#12161c!important;border:1px solid #2b333d!important;border-radius:12px!important;box-shadow:0 -12px 30px rgba(0,0,0,.5)!important}
.cartao.q-cheio .q-tempo-listas{display:grid!important;grid-template-columns:1fr!important;gap:6px!important}
.cartao.q-cheio .q-tempo-corpo{display:none}
.cartao.q-cheio .q-tempo.aberto .q-tempo-corpo{display:block}
.cartao.q-cheio .q-ev{padding:5px 8px!important;font-size:.8rem!important}
.cartao.q-cheio .q-tempo-toggle{padding:6px 10px!important;font-size:.8rem!important}
.cartao.q-cheio .q-tempo-vazio{padding:6px 10px!important}
.cartao.q-cheio .q-tempo-vazio .suave{display:none!important}
.cartao.q-cheio .q-publicar{background:linear-gradient(180deg,#e21227,#b30d1e)!important;color:#fff!important;border:0!important;font-weight:800!important;box-shadow:0 2px 10px rgba(226,18,39,.45)!important}
.q-menus{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.q-menus .botao{padding:.25em .5em!important;font-size:.9rem!important;min-height:28px!important;border-radius:8px!important}
.q-painel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:97;width:min(92vw,420px);max-height:80vh;overflow:auto;background:#12161c;border:1px solid #2b333d;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);padding:10px}
.q-painel-topo{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.q-painel-topo b{font-size:14px}
.q-painel-x{background:#2a1215;border:1px solid #5a1e25;color:#ffb3b3;border-radius:8px;padding:4px 10px;font:inherit;font-weight:700;cursor:pointer}
.q-painel-linha{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
.q-painel-linha b{flex:1 1 100%;font-size:12px;color:#9aa4b2;text-transform:uppercase;letter-spacing:.05em}
@media (max-height:520px){
 .cartao.q-cheio .q-tempo-resumo{display:none!important}
 .cartao.q-cheio .cartao-corpo{padding:3px 4px!important;gap:3px!important}
}`;

/** Regras do modo campo injetadas pelo JS: funcionam mesmo com o CSS em cache. */
function estiloFoco() {
  if (document.getElementById('bi-estilo-foco')) return;
  const s = document.createElement('style');
  s.id = 'bi-estilo-foco';
  s.textContent = CSS_FOCO + CSS_BANCA;
  document.head.appendChild(s);
}


/* ------------------------------ Momentos guardados por jogo ------------------------------ */
// Preparam-se antes do direto (no PC) e aplicam-se num toque durante o direto (no tablet).
// Ficam num ficheiro à parte (quadro_momentos.json): não pesam nos envios para a app.
const FICHEIRO_MOMENTOS = 'quadro_momentos.json';
let QUADRO_MOM = { jogos: {} };
let QUADRO_MOM_TIMER = null;
let QUADRO_REFAZER = [];
let QUADRO_TECLA = null;
let QUADRO_AJUSTE = null;

function chaveMomentos(jogo) { return semAcentos(String(jogo || '')).toLowerCase().trim() || 'livre'; }
function momentosDoJogo(jogo) { const j = (QUADRO_MOM.jogos || {})[chaveMomentos(jogo)]; return (j && j.lista) || []; }

async function lerMomentos() {
  try {
    const v = await lerFicheiro(CFG.repo, FICHEIRO_MOMENTOS);
    QUADRO_MOM = (v && typeof v === 'object' && v.jogos) ? v : { jogos: {} };
  } catch (e) { QUADRO_MOM = QUADRO_MOM && QUADRO_MOM.jogos ? QUADRO_MOM : { jogos: {} }; }
}

function guardarMomentos() {
  clearTimeout(QUADRO_MOM_TIMER);
  QUADRO_MOM_TIMER = setTimeout(async () => {
    const gravar = () => escreverFicheiro(CFG.repo, FICHEIRO_MOMENTOS, QUADRO_MOM, 'Plataforma: momentos do quadro tático');
    try { await gravar(); } catch (e) {
      if (e.conflito) {
        try { await lerFicheiro(CFG.repo, FICHEIRO_MOMENTOS); await gravar(); return; } catch (e2) { e = e2; }
      }
      aviso('Não foi possível guardar os momentos: ' + e.message, true);
    }
  }, 500);
}


/* ------------------------------ Jogadas: gravar o movimento e pôr em play/loop ------------------------------ */
let QUADRO_PALCO = null;   // null = automático (ecrãs táteis), true/false = escolha da pessoa
let QUADRO_FS = null;      // ecrã inteiro (só no modo tablet); null = automático nos ecrãs táteis
let QUADRO_SEM_PAINEL = false;   // campo em largura total (menu escondido)
let QUADRO_GRAV = null;   // { base, amostras, t0, nome } enquanto se grava
let QUADRO_PLAY = null;   // { j, raf, t } enquanto uma jogada passa

function jogadasDoJogo(jogo) { const j = (QUADRO_MOM.jogos || {})[chaveMomentos(jogo)]; return (j && j.jogadas) || []; }

function pararJogada() {
  if (!QUADRO_PLAY) return;
  cancelAnimationFrame(QUADRO_PLAY.raf);
  clearTimeout(QUADRO_PLAY.t);
  QUADRO_PLAY = null;
  // A app deixa de passar a jogada e fica com o campo como está aqui.
  if (QUADRO && QUADRO.estado.jogada) { QUADRO.estado.jogada = null; guardarQuadro(); }
}

function tocarJogada(j, loop, alvo) {
  pararJogada();
  const q = QUADRO;
  const clone = o => JSON.parse(JSON.stringify(o));
  const porIdx = new Map();
  for (const [t, i, x, y] of j.amostras) { if (!porIdx.has(i)) porIdx.set(i, []); porIdx.get(i).push([t, x, y]); }
  const base = () => { q.estado.pontos = clone(j.base.pontos || []); q.estado.linhas = clone(j.base.linhas || []); q.estado.bola = j.base.bola ? clone(j.base.bola) : null; };
  const desenhar = () => {
    const svg = document.querySelector('.qb .q-campo svg'); if (!svg) return;
    const tmp = document.createElement('div'); tmp.innerHTML = quadroSvg(q.estado);
    svg.innerHTML = tmp.firstElementChild.innerHTML;
  };
  const duracao = (j.dur || 0) + 500;
  let t0 = null;
  const passo = ts => {
    if (!QUADRO_PLAY || QUADRO_PLAY.j !== j) return;
    if (t0 == null) t0 = ts;
    const T = ts - t0;
    porIdx.forEach((seq, i) => {
      if (T < seq[0][0]) return;
      let k = 0; while (k < seq.length - 1 && seq[k + 1][0] <= T) k++;
      let x = seq[k][1], y = seq[k][2];
      if (k < seq.length - 1) {
        const a = seq[k], b = seq[k + 1], f = (T - a[0]) / Math.max(1, b[0] - a[0]);
        x = a[1] + (b[1] - a[1]) * f; y = a[2] + (b[2] - a[2]) * f;
      }
      if (i === -1) q.estado.bola = { x, y };
      else if (q.estado.pontos[i]) { q.estado.pontos[i].x = x; q.estado.pontos[i].y = y; }
    });
    desenhar();                  // (a app passa a jogada sozinha, com movimento suave: só recebe o início e o fim)
    if (T >= duracao) {
      if (loop) {
        QUADRO_PLAY.t = setTimeout(() => {
          if (!QUADRO_PLAY || QUADRO_PLAY.j !== j) return;
          base(); desenhar(); t0 = null; QUADRO_PLAY.raf = requestAnimationFrame(passo);
        }, 800);
        return;
      }
      pararJogada(); desenharEditorQuadro(alvo); return;
    }
    QUADRO_PLAY.raf = requestAnimationFrame(passo);
  };
  QUADRO_HIST.push(JSON.stringify(q.estado));
  base();
  // Manda a jogada à app uma só vez (movimentos gravados); ela encarrega-se de a passar, em loop se for caso disso.
  q.estado.jogada = {
    id: j.id, nome: j.nome, loop: !!loop, dur: j.dur || 0, inicio: Date.now(),
    base: { pontos: (j.base.pontos || []).map(p => [p.x, p.y]), bola: j.base.bola || null },
    amostras: j.amostras
  };
  guardarQuadro();
  QUADRO_PLAY = { j, raf: 0, t: null, loop };
  QUADRO_PLAY.raf = requestAnimationFrame(passo);
  desenharEditorQuadro(alvo);
}

let QUADRO = null;          // { estado, visivel, titulo, versao }
let QUADRO_HIST = [];       // para desfazer
let QUADRO_TIMER = null;
let QUADRO_SUGERIDO = null; // onze mais recente, quando o quadro está com um jogo anterior
let QUADRO_CHEIO = false;   // editor em ecrã inteiro (melhor no tablet)

function ecraQuadro(alvo) {
  QUADRO_CHEIO = false;   // abre sempre no modo normal; o ecrã inteiro é escolha do utilizador
  QUADRO_TEMPO = null;
  PAINEL_QUADRO = null;
  document.body.classList.toggle('modo-campo', QUADRO_CHEIO);
  alvo.innerHTML = cartao('Quadro tático', '<p class="suave">A carregar…</p>');
  (async () => {
    if (!QUADRO) {
      QUADRO = { estado: { pontos: [], linhas: [] }, visivel: false, titulo: '', versao: 0 };
      if (CFG.modo !== 'local' && CFG.token) {
        try {
          carregar(true);
          const q = await rpcAdmin('bi_admin_quadro');
          if (q) QUADRO = { estado: q.estado || { pontos: [], linhas: [] }, visivel: !!q.visivel, titulo: q.titulo || '', versao: q.versao || 0 };
        } catch (e) {
          alvo.innerHTML = cartao('Quadro tático', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-quadro-e-fotos.sql no Supabase.</p>`);
          return;
        } finally { carregar(false); }
      }
    }
    await lerMomentos();
    await sugerirOnzeAutomatico();
    desenharEditorQuadro(alvo);
  })();
}

/**
 * Modo campo: ecrã inteiro a sério e, no telemóvel/tablet, o ecrã passa para a horizontal.
 * Ao sair, desbloqueia a rotação e volta ao vertical.
 */
function modoCheio(alvo, ligar) {
  QUADRO_CHEIO = !!ligar;
  QUADRO_TEMPO = null;
  document.body.classList.toggle('modo-campo', !!ligar);
  // PRIMEIRO o layout (não espera pelo fullscreen nem pela rotação: havia aparelhos
  // em que essas promessas não respondiam e ficava tudo igual).
  desenharEditorQuadro(alvo);
  if (ligar) {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        const p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => { });
      }
    } catch (e) { /* navegador sem Fullscreen API */ }
    try {
      if (screen.orientation && screen.orientation.lock) {
        const p = screen.orientation.lock('landscape');
        if (p && p.catch) p.catch(() => { });
      }
    } catch (e) { /* iOS ou navegador sem bloqueio de orientação */ }
  } else {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { }
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        const p = document.exitFullscreen();
        if (p && p.catch) p.catch(() => { });
      }
    } catch (e) { }
  }
}

// Se saírem do ecrã inteiro pelo Esc ou pelo botão do sistema, volta ao modo normal.
if (typeof window !== 'undefined' && !window.__quadroFs) {
  window.__quadroFs = true;
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || !QUADRO_CHEIO) return;
    QUADRO_CHEIO = false;
    QUADRO_TEMPO = null;
    document.body.classList.remove('modo-campo');
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { }
    const ecra = document.getElementById('ecra');
    if (ecra && document.querySelector('.cartao.q-cheio')) desenharEditorQuadro(ecra);
  });
}

/**
 * Ao abrir o quadro vai sempre buscar o último onze disponível:
 *  • quadro vazio → preenche logo (sem perguntar);
 *  • quadro com um jogo anterior → oferece a atualização (não estraga o que já foi mexido).
 */
async function sugerirOnzeAutomatico() {
  QUADRO_SUGERIDO = null;
  if (!QUADRO) return;
  try {
    const d = await onzeDoUltimoJogo(false);
    const pontos = QUADRO.estado.pontos || [];
    if (!pontos.length) {
      QUADRO.estado.pontos = d.pontos;
      QUADRO.estado.inicial = d.inicial;
      QUADRO.estado.suplentes = d.suplentes;
      QUADRO.estado.eventos = d.eventos;
      QUADRO.estado.bancos = d.bancos;
      QUADRO.estado.jogo = d.jogo;
      QUADRO.estado.momento = null;
      QUADRO.titulo = d.titulo;
      await guardarQuadro();
      aviso('Quadro preenchido com o último onze: ' + d.jogo.nome + '.');
    } else if (QUADRO.estado.jogo && String(QUADRO.estado.jogo.id) !== d.jogo.id) {
      QUADRO_SUGERIDO = d;
    } else if (!(QUADRO.estado.eventos || []).length && (d.eventos || []).length) {
      // O quadro tem jogadores mas não tem o jogo: junta o onze inicial, o banco e as substituições.
      QUADRO.estado.inicial = d.inicial;
      QUADRO.estado.suplentes = d.suplentes;
      QUADRO.estado.eventos = d.eventos;
      QUADRO.estado.jogo = QUADRO.estado.jogo || d.jogo;
      if (!QUADRO.titulo) QUADRO.titulo = d.titulo;
      await guardarQuadro();
      aviso('Substituições do último jogo carregadas (' + d.eventos.length + ').');
    }
  } catch (e) { /* sem rede ou sem onzes publicados: fica como está */ }
}

const VERSAO_QUADRO = 'v18';

/**
 * Aplica o modo campo com estilos diretos (sem depender do CSS).
 * É o que garante o layout no telemóvel mesmo com o CSS antigo em cache.
 */
function aplicarFocoInline(alvo) {
  const card = $('.cartao', alvo); if (!card) return;
  card.style.cssText = 'position:fixed;inset:0;z-index:90;margin:0;border:0;border-radius:0;background:#0f1115;display:flex;flex-direction:column;overflow:hidden;height:100vh;height:100dvh;padding:0';
  const head = card.querySelector(':scope > header'); if (head) head.style.display = 'none';
  const corpo = $('.cartao-corpo', card);
  if (corpo) { corpo.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;padding:4px 6px'; }
  const esconder = ['.q-estado', '.q-lateral', 'label', '[data-guardado]', '.linha-acoes', '.cartao-corpo > .aviso'];
  esconder.forEach(sel => alvo.querySelectorAll(sel).forEach(e => { e.style.display = 'none'; }));
  alvo.querySelectorAll('.q-principal > p.suave').forEach(e => { e.style.display = 'none'; });
  const barra = $('.q-barra', alvo);
  if (barra) {
    barra.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin:0;padding:2px;flex:0 0 auto';
    barra.querySelectorAll('.botao').forEach(b => { b.style.cssText += ';padding:.25em .5em;font-size:.72rem;min-height:28px;border-radius:8px'; });
  }
  const layout = $('.q-layout', alvo);
  if (layout) layout.style.cssText = 'flex:1;min-height:0;display:block;margin:0';
  const principal = $('.q-principal', alvo);
  if (principal) principal.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;gap:4px';
  const campo = $('.q-campo', alvo);
  if (campo) {
    campo.style.cssText = 'flex:1;min-height:0;max-width:none;display:flex;align-items:center;justify-content:center;padding:0';
    campo.querySelectorAll('svg').forEach(s => { s.style.width = '100%'; s.style.height = '100%'; });
  }
  const rodape = $('.q-rodape', alvo);
  if (rodape) rodape.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex:0 0 auto';
  const acoes = $('.q-acoes-fixas', alvo);
  if (acoes) {
    acoes.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:0';
    acoes.querySelectorAll('.botao').forEach(b => { b.style.cssText += ';padding:.25em .55em;font-size:.72rem;min-height:28px;border-radius:8px'; });
  }
  alvo.querySelectorAll('[data-limpar="linhas"]').forEach(e => { e.style.display = 'none'; });
  alvo.querySelectorAll('.q-publicar').forEach(b => { b.style.background = 'linear-gradient(180deg,#e21227,#b30d1e)'; b.style.color = '#fff'; b.style.border = '0'; b.style.fontWeight = '800'; });
  const tempo = $('.q-tempo', alvo);
  if (tempo) {
    tempo.style.cssText += ';margin:0;padding:0;border:0;flex:1 1 300px;min-width:0;max-height:none;overflow:visible';
    if (tempo.classList.contains('aberto')) {
      tempo.style.position = 'fixed'; tempo.style.left = '8px'; tempo.style.right = '8px'; tempo.style.bottom = '52px';
      tempo.style.zIndex = '96'; tempo.style.maxHeight = '58vh'; tempo.style.overflow = 'auto';
      tempo.style.background = '#12161c'; tempo.style.border = '1px solid #2b333d'; tempo.style.borderRadius = '12px';
      tempo.style.padding = '8px'; tempo.style.boxShadow = '0 -12px 30px rgba(0,0,0,.5)';
    }
    const corpoTempo = $('.q-tempo-corpo', tempo);
    if (corpoTempo) corpoTempo.style.display = tempo.classList.contains('aberto') ? 'block' : 'none';
    const listas = $('.q-tempo-listas', tempo);
    if (listas) listas.style.cssText = 'display:grid;grid-template-columns:1fr;gap:6px';
  }
}

/** Etiqueta pequena com a versão: serve para saber se o telemóvel já apanhou a versão nova. */
function marcaVersao() {
  return; // sem etiquetas na plataforma
}

function desenharEditorQuadro(alvo) {
  estiloFoco();
  marcaVersao();
  const q = QUADRO;
  q.estado.pontos = q.estado.pontos || [];
  q.estado.linhas = q.estado.linhas || [];
  // A bola começa no meio do campo (null = a pessoa tirou-a de propósito).
  if (q.estado.bola === undefined && q.estado.pontos.length) { q.estado.bola = { x: 0.5, y: 0.5 }; guardarQuadroEmBreve(); }
  let ferramenta = alvo.dataset.ferramenta || 'mover';
  const conta = c => q.estado.pontos.filter(p => (p.c === 'b') === (c === 'b')).length;
  const partir = t => { const i = t.indexOf(' '); return i < 0 ? ['', t] : [t.slice(0, i), t.slice(i + 1)]; };
  const botaoF = (f, t) => { const [ic, tx] = partir(t); return `<button class="qb-ferr ${ferramenta === f ? 'ativa' : ''}" data-f="${f}"><span class="qb-ic">${ic}</span><span>${tx}</span></button>`; };
  const aba = alvo.dataset.aba || 'campo';
  const abaB = (id, t) => { const [ic, tx] = partir(t); return `<button class="qb-aba ${aba === id ? 'ativa' : ''}" data-aba="${id}"><span class="qb-ic">${ic}</span><span>${tx}</span></button>`; };
  const jogoPrep = String(q.estado.prep_jogo != null ? q.estado.prep_jogo : ((q.estado.jogo && q.estado.jogo.nome) || ''));
  const momentos = momentosDoJogo(jogoPrep);
  const nomesJogos = Object.keys(QUADRO_MOM.jogos || {}).map(k => QUADRO_MOM.jogos[k].nome).filter(Boolean);
  const botoesMom = momentos.length
    ? momentos.map((m, i) => `<button class="qb-mom-btn" data-mom-abrir="${esc(m.id)}" title="${esc(m.nome)}"><i>${i + 1}</i>${esc(m.nome)}</button>`).join('')
    : '<span class="qb-mom-vazio">Ainda sem momentos para este jogo: guarda-os no separador "Guardar".</span>';
  const eventosJogo = (q.estado.eventos || []).slice().sort((x, y) => Number(x.min) - Number(y.min));
  const minAtual = q.estado.momento == null ? 0 : Number(q.estado.momento);
  const maxMin = Math.max(90, ...eventosJogo.map(e => Number(e.min) || 0));
  const barraMinutos = eventosJogo.length ? `<div class="qb-minutos">
      <div class="qb-min-linha"><b>⏱ Minuto</b><input type="range" class="qb-slider" data-slider-min min="0" max="${maxMin}" step="1" value="${minAtual}">
        <span class="qb-min-val" data-min-val>${minAtual}'</span><button class="botao" data-min="0" title="Voltar ao onze inicial">Início</button></div>
      <div class="qb-min-evs">${eventosJogo.map(e => {
        const vermelho = e.tipo === 'vermelho';
        const lado = e.equipa === 'b' ? '⚪' : '🔴';
        const txt = vermelho ? `${esc(e.sai)}` : `${esc(e.sai)} → ${esc(e.entra)}`;
        return `<button class="qb-ev ${q.estado.momento != null && Number(e.min) === minAtual ? 'ativo' : ''} ${vermelho ? 'verm' : ''}" data-min="${esc(e.min)}" title="${vermelho ? 'Expulsão' : 'Substituição'} aos ${esc(e.min)}'">
          <b>${esc(e.min)}'</b> ${vermelho ? '🟥' : '🔄'} ${lado} ${txt}</button>`; }).join('')}</div></div>`
    : `<div class="qb-minutos vazio">⏱ Para teres as <b>substituições por minuto</b>, escolhe um jogo no separador <b>⚽ Jogo</b>.</div>`;
  const jogadas = jogadasDoJogo(jogoPrep);
  const botoesJog = jogadas.map(j => `<button class="qb-jog-btn ${QUADRO_PLAY && QUADRO_PLAY.j.id === j.id ? 'tocar' : ''}" data-jog-play="${esc(j.id)}" title="${esc(j.nome)}">▶ ${esc(j.nome)}</button><button class="qb-jog-btn rep" data-jog-loop="${esc(j.id)}" title="Repetir sem parar">🔁</button>`).join('');
  const formacoes = c => Object.keys(FORMACOES).map(f => `<button class="botao pequeno" data-form="${c}:${f}">${f}</button>`).join('');
  const tabCampo = `
    <div class="qb-sec"><b>Ferramentas</b><div class="qb-grelha">
      ${botaoF('mover', '✋ Mover')}${botaoF('manual', '🔁 Trocar')}${botaoF('v', '🔴 Pôr')}${botaoF('b', '⚪ Pôr')}
      ${botaoF('bola', '⚽ Bola')}${botaoF('linha', '／ Risco')}${botaoF('seta', '➚ Seta')}${botaoF('cor', '🎨 Cor')}${botaoF('apagar', '🗑 Tirar')}
    </div></div>
    <div class="qb-sec"><b>Cor dos jogadores</b><div class="qb-cores">
      ${Object.keys(CORES_Q).map(c => `<button class="qb-cor ${alvo.dataset.cor === c && ferramenta === 'cor' ? 'ativa' : ''}" data-cor="${c}" title="${c}" style="background:${CORES_Q[c]}"></button>`).join('')}
      <button class="qb-cor padrao ${alvo.dataset.cor === 'padrao' && ferramenta === 'cor' ? 'ativa' : ''}" data-cor="padrao" title="Cor original">↺</button>
    </div><p class="suave mini" style="margin:6px 0 0">Escolhe uma cor e toca nos jogadores para a aplicar. O guarda-redes aparece sempre a amarelo.</p></div>
    <div class="qb-sec"><b>🔴 Formação do Benfica</b><div class="qb-grelha">${formacoes('v')}</div></div>
    <div class="qb-sec"><b>⚪ Formação do adversário</b><div class="qb-grelha">${formacoes('b')}</div></div>
    <div class="qb-sec"><div class="qb-grelha dois">
      <button class="botao pequeno" data-refazer ${QUADRO_REFAZER.length ? '' : 'disabled'}>↷ Refazer</button>
      <button class="botao pequeno" data-limpar="linhas">Tirar riscos e setas</button>
      <button class="botao pequeno perigo" data-limpar="tudo">🧹 Limpar o campo</button>
    </div></div>
    <p class="suave qb-ajuda">Encarnados <b>${conta('v')}/11</b> · Brancos <b>${conta('b')}/11</b>.
      ${ferramenta === 'mover' ? 'Arrasta os jogadores. Para trocar dois de posição usa 🔁 Trocar.' : ''}
      ${ferramenta === 'manual' ? 'Toca num jogador e depois no outro: trocam de posição.' : ''}
      ${ferramenta === 'v' || ferramenta === 'b' ? 'Toca no relvado onde queres pôr o jogador. Se já tens 11, tira um com 🗑 Tirar.' : ''}
      ${ferramenta === 'linha' || ferramenta === 'seta' ? 'Carrega e arrasta no relvado para desenhar.' : ''}
      ${ferramenta === 'cor' ? 'Escolhe a cor e toca no jogador. ↺ volta à cor original.' : ''}
      ${ferramenta === 'bola' ? 'Toca no relvado para pôr a bola (ou arrasta-a). Toca em 🗑 Tirar e na bola para a retirar.' : ''}
      ${ferramenta === 'apagar' ? 'Toca num jogador, bola, risco ou seta para o tirar do campo.' : ''}</p>`;
  const tabJogo = `
    ${QUADRO_SUGERIDO ? `<div class="q-estado">🆕 Já há o onze de <b>${esc(QUADRO_SUGERIDO.jogo.nome)}</b>.
      <button class="botao pequeno principal" data-onze-novo>Atualizar o onze</button></div>` : ''}
    <div class="qb-sec"><b>Do último jogo</b><div class="qb-grelha dois">
      <button class="botao pequeno principal" data-auto="ambos">⚽ Benfica + adversário</button>
      <button class="botao pequeno" data-auto="benfica">🔴 Só o Benfica</button>
      <button class="botao pequeno" data-convocados>📋 Convocados</button>
    </div></div>
    <div class="qb-sec"><b>Últimos 10 jogos</b><div class="q-jogos">${listaJogosHtml()}</div>
      <p class="suave mini">Toca num jogo para pôr no campo o onze das duas equipas e as substituições reais.</p></div>
    <div class="qb-sec"><b>Substituições e expulsões</b>${htmlTempo(q.estado, false)}</div>`;
  const tabGuardar = `
    <div class="qb-sec"><b>Jogo da preparação</b>
      <input class="qb-input" data-prep list="qb-jogos" maxlength="60" value="${esc(jogoPrep)}" placeholder="Ex.: Benfica x Braga">
      <datalist id="qb-jogos">${nomesJogos.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <p class="suave mini">Os momentos ficam ligados a este jogo e aparecem como botões por baixo do campo.</p></div>
    <div class="qb-sec"><b>Guardar o campo como momento</b>
      <div class="qb-linha"><input class="qb-input" data-mom-nome maxlength="30" placeholder="Ex.: Pressão alta">
      <button class="botao principal" data-mom-guardar>💾 Guardar</button></div></div>
    <div class="qb-sec"><b>Momentos deste jogo (${momentos.length})</b>
      ${momentos.length ? momentos.map((m, i) => `<div class="qb-mom"><button class="botao" data-mom-abrir="${esc(m.id)}">${i + 1}. ${esc(m.nome)}</button>
        <button class="botao perigo" data-mom-x="${esc(m.id)}" title="Apagar">✕</button></div>`).join('') : '<p class="suave mini">Ainda nenhum.</p>'}</div>`;
  const tabJogadas = `
    <div class="qb-sec"><b>Gravar uma jogada</b>
      <p class="suave qb-ajuda">Põe os jogadores e a bola no início do lance, carrega em Gravar e arrasta-os como na jogada. Pára e dá-lhe um nome. Depois é só carregar em ▶ (ou 🔁 para repetir) enquanto falas.</p>
      ${QUADRO_GRAV
        ? `<input class="qb-input" data-grav-nome maxlength="30" value="${esc(QUADRO_GRAV.nome || '')}" placeholder="Nome da jogada (ex.: Golo do 2-0)" style="margin:8px 0">
           <button class="botao perigo qb-grande" data-grav-parar>⏹ Parar e guardar (${QUADRO_GRAV.amostras.length} movimentos)</button>`
        : '<button class="botao principal qb-grande" data-grav-ini style="margin-top:8px">⏺ Gravar</button>'}
    </div>
    <div class="qb-sec"><b>Jogadas deste jogo (${jogadas.length})</b>
      ${jogadas.length ? jogadas.map(j => `<div class="qb-mom"><button class="botao" data-jog-play="${esc(j.id)}">▶ ${esc(j.nome)}</button>
        <button class="botao" data-jog-loop="${esc(j.id)}" title="Repetir sem parar">🔁</button>
        <button class="botao perigo" data-jog-x="${esc(j.id)}" title="Apagar">✕</button></div>`).join('') : '<p class="suave mini">Ainda nenhuma.</p>'}
      ${QUADRO_PLAY ? '<button class="botao perigo qb-grande" data-jog-parar>⏹ Parar a jogada</button>' : ''}</div>`;
  const tabApp = `
    <div class="qb-sec">
      <div class="q-estado ${q.visivel ? 'ok' : ''}">${q.visivel
        ? '📡 <b>Na app, em direto.</b> O que mexeres aqui mexe nos telemóveis em 1 a 2 segundos.'
        : '⏸ <b>Não está na app.</b> Prepara à vontade; quando estiver pronto carrega em "Pôr na app".'}</div></div>
    <button class="botao qb-grande ${q.visivel ? 'perigo' : 'principal'}" data-visivel="${q.visivel ? 0 : 1}">${q.visivel ? 'Tirar da app' : '📡 Pôr na app'}</button>
    <button class="botao qb-grande" data-cheio>${document.fullscreenElement ? '✕ Sair do ecrã inteiro' : '⛶ Ecrã inteiro do navegador'}</button>
    <button class="botao qb-grande" data-palco-toggle>${QUADRO_PALCO === false ? '📱 Modo tablet (campo grande)' : '🖥 Modo PC (painel à direita)'}</button>
    <p class="suave qb-ajuda" data-guardado>${q.guardadoTxt || ''}</p>`;
  const corpoAba = aba === 'jogo' ? tabJogo : aba === 'guardar' ? tabGuardar : aba === 'jogadas' ? tabJogadas : aba === 'app' ? tabApp : tabCampo;
  const htmlNormal = `
    ${CFG.modo === 'local' ? '<p class="aviso mau" style="margin:0 0 8px"><b>Modo de teste:</b> podes experimentar, mas nada aparece na app. Para usar a sério entra com a conta GitHub.</p>' : ''}
    <div class="qb ${QUADRO_SEM_PAINEL ? 'sem-painel' : ''}">
      <section class="qb-campo-col">
        <div class="qb-topo">
          <span class="qb-pill ${QUADRO_GRAV ? 'gravar' : q.visivel ? 'ok' : ''}">${QUADRO_GRAV ? '⏺ A gravar' : q.visivel ? '📡 Na app' : '⏸ Fora da app'}</span>
          <input class="qb-titulo" data-titulo maxlength="80" value="${esc(q.titulo)}" placeholder="Título (opcional) — ex.: O onze provável para Braga">
          <button class="botao" data-menu-toggle title="Esconder ou mostrar o menu">${QUADRO_SEM_PAINEL ? '☰ Menu' : '⇥ Esconder menu'}</button>
          <button class="botao" data-desfazer ${QUADRO_HIST.length ? '' : 'disabled'} title="Desfazer (Ctrl+Z)">↶</button>
          <button class="botao" data-refazer ${QUADRO_REFAZER.length ? '' : 'disabled'} title="Refazer (Ctrl+Y)">↷</button>
          <button class="botao ${q.visivel ? 'perigo' : 'principal'}" data-visivel="${q.visivel ? 0 : 1}">${q.visivel ? 'Tirar da app' : '📡 Pôr na app'}</button>
        </div>
        <div class="q-campo">${quadroSvg(q.estado)}</div>
        ${barraMinutos}
        <div class="qb-momentos"><b>Momentos</b>${botoesMom}</div>
        ${jogadas.length ? `<div class="qb-momentos"><b>Jogadas</b>${botoesJog}${QUADRO_PLAY ? '<button class="qb-jog-btn" data-jog-parar>⏹ Parar</button>' : ''}</div>` : ''}
      </section>
      <aside class="qb-painel">
        <nav class="qb-abas">${abaB('campo', '🎯 Campo')}${abaB('jogo', '⚽ Jogo')}${abaB('guardar', '💾 Guardar')}${abaB('jogadas', '🎬 Jogadas')}${abaB('app', '📡 App')}</nav>
        <div class="qb-corpo">${corpoAba}</div>
      </aside>
    </div>`;

  // ------------------------------------------------ modo tablet ("palco"): campo grande, ferramentas em botões, o resto em janelas
  const palco = QUADRO_PALCO == null ? !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) : QUADRO_PALCO;
  const cheio = palco && (QUADRO_FS == null ? !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) : QUADRO_FS);
  const folha = palco ? (alvo.dataset.folha || '') : '';
  const tile = (f, t) => botaoF(f, t);
  const abrirF = (id, t) => { const [ic, tx] = partir(t); return `<button class="botao qb-abre ${folha === id ? 'ativo' : ''}" data-folha="${id}" title="${tx}"><span class="qb-ic">${ic}</span><span class="tx">${tx}</span></button>`; };
  const jogosGrelha = (ULTIMOS.lista || []).slice(0, 10).map(j => `<button class="qb-jogo-btn ${String((q.estado.jogo && q.estado.jogo.id) || '') === String(j.id) ? 'ativo' : ''}" data-jogo="${esc(j.id)}">
      <b>${esc(dataCurtaJogo(j.data))}</b> ${j.casa ? 'vs' : 'em'} ${esc(j.adversario)} <i>${esc(j.golosN)}-${esc(j.golosA)}</i></button>`).join('') || '<span class="suave">A carregar os jogos…</span>';
  const folhas = {
    taticas: ['🎯 Táticas', `<div class="qb-sec"><b>🔴 Benfica</b><div class="qb-grelha q4">${formacoes('v')}</div></div>
      <div class="qb-sec"><b>⚪ Adversário</b><div class="qb-grelha q4">${formacoes('b')}</div></div>`],
    jogo: ['⚽ Jogo', `${QUADRO_SUGERIDO ? `<div class="q-estado">🆕 Já há o onze de <b>${esc(QUADRO_SUGERIDO.jogo.nome)}</b>. <button class="botao pequeno principal" data-onze-novo>Atualizar</button></div>` : ''}
      <div class="qb-grelha q3"><button class="botao principal" data-auto="ambos">⚽ Benfica + adversário</button><button class="botao" data-auto="benfica">🔴 Só o Benfica</button><button class="botao" data-convocados>📋 Convocados</button></div>
      <div class="qb-sec"><b>Últimos jogos</b><div class="qb-jogos2">${jogosGrelha}</div></div>`],
    guardar: ['💾 Guardar', tabGuardar],
    jogadas: ['🎬 Jogadas', tabJogadas],
    app: ['📡 App', tabApp]
  };
  const folhaHtml = folha && folhas[folha] ? `<div class="qb-fundo" data-folha-fundo><div class="qb-folha">
      <div class="qb-folha-topo"><b>${folhas[folha][0]}</b><button class="botao" data-folha-x>✕ Fechar</button></div>
      <div class="qb-folha-corpo">${folhas[folha][1]}</div></div></div>` : '';
  const trilho = `<aside class="qb-trilho">
      ${tile('mover', '✋ Mover')}${tile('manual', '🔁 Trocar')}${tile('v', '🔴 Pôr')}${tile('b', '⚪ Pôr')}${tile('bola', '⚽ Bola')}
      ${tile('linha', '／ Risco')}${tile('seta', '➚ Seta')}${tile('cor', '🎨 Cor')}${tile('apagar', '🗑 Tirar')}
      ${ferramenta === 'cor' ? `<div class="qb-cores trilho">${Object.keys(CORES_Q).map(c => `<button class="qb-cor ${alvo.dataset.cor === c ? 'ativa' : ''}" data-cor="${c}" style="background:${CORES_Q[c]}"></button>`).join('')}<button class="qb-cor padrao ${alvo.dataset.cor === 'padrao' ? 'ativa' : ''}" data-cor="padrao">↺</button></div>` : ''}
    </aside>`;
  const htmlPalco = `
    ${CFG.modo === 'local' ? '<p class="aviso mau" style="margin:0 0 6px"><b>Modo de teste:</b> nada aparece na app.</p>' : ''}
    <div class="qb palco ${cheio ? 'fs' : ''}">
      <section class="qb-campo-col">
        <div class="qb-topo">
          ${cheio ? '<button class="botao" data-fs-sair title="Sair do ecrã inteiro">✕</button>' : ''}
          <span class="qb-pill ${QUADRO_GRAV ? 'gravar' : q.visivel ? 'ok' : ''}">${QUADRO_GRAV ? '⏺ A gravar' : q.visivel ? '📡 Na app' : '⏸ Fora da app'}</span>
          <input class="qb-titulo" data-titulo maxlength="80" value="${esc(q.titulo)}" placeholder="Título (opcional)">
          <button class="botao" data-desfazer ${QUADRO_HIST.length ? '' : 'disabled'} title="Desfazer">↶</button>
          <button class="botao" data-refazer ${QUADRO_REFAZER.length ? '' : 'disabled'} title="Refazer">↷</button>
          ${abrirF('taticas', '🎯 Táticas')}${abrirF('jogo', '⚽ Jogo')}${abrirF('guardar', '💾 Guardar')}${abrirF('jogadas', '🎬 Jogadas')}
          <button class="botao ${q.visivel ? 'perigo' : 'principal'}" data-visivel="${q.visivel ? 0 : 1}">${q.visivel ? 'Tirar da app' : '📡 Pôr na app'}</button>
          ${cheio ? '' : '<button class="botao" data-fs-entrar title="Ecrã inteiro">⛶</button>'}
        </div>
        <div class="q-campo">${quadroSvg(q.estado)}</div>
        ${barraMinutos}
        <div class="qb-momentos"><b>Momentos</b>${botoesMom}</div>
        ${jogadas.length ? `<div class="qb-momentos"><b>Jogadas</b>${botoesJog}${QUADRO_PLAY ? '<button class="qb-jog-btn" data-jog-parar>⏹ Parar</button>' : ''}</div>` : ''}
      </section>
      ${trilho}
    </div>
    ${folhaHtml}`;
  alvo.innerHTML = palco ? htmlPalco : htmlNormal;
  alvo.dataset.ferramenta = ferramenta;
  // Ecrã inteiro: o cartão ocupa a janela toda (relvado maior para trabalhar no tablet).
  document.body.classList.remove('modo-campo');
  const caixa = $('.qb', alvo);
  const ajustar = () => { if (caixa && caixa.isConnected && !caixa.classList.contains('fs')) caixa.style.height = Math.max(460, window.innerHeight - caixa.getBoundingClientRect().top - 46) + 'px'; };
  ajustar();
  if (QUADRO_AJUSTE) window.removeEventListener('resize', QUADRO_AJUSTE);
  QUADRO_AJUSTE = ajustar;
  window.addEventListener('resize', ajustar);
  const svg = $('.q-campo svg', alvo);

  const mudar = (alterar, semHistorico) => {
    if (!semHistorico) { QUADRO_HIST.push(JSON.stringify(q.estado)); if (QUADRO_HIST.length > 60) QUADRO_HIST.shift(); QUADRO_REFAZER.length = 0; }
    alterar();
    guardarQuadroEmBreve();
    desenharEditorQuadro(alvo);
  };
  const ponto = ev => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.min(1.02, Math.max(-0.02, p.x / RL)), y: Math.min(1.03, Math.max(-0.03, p.y / RW)) };
  };
  const r3 = v => Math.round(v * 1000) / 1000;

  $$('[data-f]', alvo).forEach(b => b.addEventListener('click', () => {
    delete alvo.dataset.selecao;
    alvo.dataset.ferramenta = b.dataset.f;
    desenharEditorQuadro(alvo);
  }));
  $('[data-titulo]', alvo).addEventListener('change', ev => { q.titulo = ev.target.value.trim(); guardarQuadroEmBreve(); });
  $$('[data-auto]', alvo).forEach(b => b.addEventListener('click', async () => {
    const d = await preencherComUltimoJogo(b.dataset.auto === 'benfica');
    if (d) aplicarJogo(d);
  }));
  // Mini lista lateral: carrega o onze das duas equipas desse jogo (e as substituições reais).
  $$('[data-jogo]', alvo).forEach(b => b.addEventListener('click', async () => {
    const item = (ULTIMOS.lista || []).find(x => String(x.id) === String(b.dataset.jogo));
    if (!item) return;
    carregar(true);
    try {
      const d = await onzeDoJogo(item, false);
      QUADRO_SUGERIDO = null;
      aplicarJogo(d);
      aviso('Onze de ' + d.jogo.nome + '.');
    } catch (e) {
      aviso(e.message || 'Não foi possível carregar esse jogo.', true);
    } finally { carregar(false); }
  }));
  /** Põe no quadro um jogo carregado: onze inicial, banco, acontecimentos e título. */
  function aplicarJogo(d) {
    mudar(() => {
      q.estado.pontos = d.pontos;
      q.estado.inicial = d.inicial;
      q.estado.suplentes = d.suplentes;
      q.estado.eventos = d.eventos;
      q.estado.bancos = d.bancos;
      q.estado.jogo = d.jogo;
      q.estado.momento = null;
      q.titulo = d.titulo;
    });
  }
  $$('[data-cor]', alvo).forEach(b => b.addEventListener('click', () => {
    alvo.dataset.cor = b.dataset.cor;
    alvo.dataset.ferramenta = 'cor';
    desenharEditorQuadro(alvo);
  }));
  const slider = $('[data-slider-min]', alvo);
  if (slider) {
    slider.addEventListener('input', () => { const v = $('[data-min-val]', alvo); if (v) v.textContent = slider.value + "'"; });
    slider.addEventListener('change', () => {
      const min = Number(slider.value);
      mudar(() => { q.estado.pontos = aplicarTempo(q.estado, min === 0 ? null : min); q.estado.momento = min === 0 ? null : min; });
    });
  }
  $$('[data-folha]', alvo).forEach(b => b.addEventListener('click', () => { alvo.dataset.folha = alvo.dataset.folha === b.dataset.folha ? '' : b.dataset.folha; desenharEditorQuadro(alvo); }));
  $$('[data-folha-x]', alvo).forEach(b => b.addEventListener('click', () => { alvo.dataset.folha = ''; desenharEditorQuadro(alvo); }));
  const fundoFolha = $('[data-folha-fundo]', alvo);
  if (fundoFolha) fundoFolha.addEventListener('click', ev => { if (ev.target === fundoFolha) { alvo.dataset.folha = ''; desenharEditorQuadro(alvo); } });
  const bFsE = $('[data-fs-entrar]', alvo);
  if (bFsE) bFsE.addEventListener('click', () => {
    QUADRO_FS = true;
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { /* sem ecrã inteiro do navegador */ }
    desenharEditorQuadro(alvo);
  });
  const bFsS = $('[data-fs-sair]', alvo);
  if (bFsS) bFsS.addEventListener('click', () => {
    QUADRO_FS = false;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ignora */ }
    desenharEditorQuadro(alvo);
  });
  $$('[data-palco-toggle]', alvo).forEach(b => b.addEventListener('click', () => { const atual = QUADRO_PALCO == null ? !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) : QUADRO_PALCO; QUADRO_PALCO = !atual; QUADRO_FS = QUADRO_PALCO ? QUADRO_FS : false; alvo.dataset.folha = ''; desenharEditorQuadro(alvo); }));
  $$('[data-menu-toggle]', alvo).forEach(b => b.addEventListener('click', () => { QUADRO_SEM_PAINEL = !QUADRO_SEM_PAINEL; desenharEditorQuadro(alvo); }));
  $$('[data-aba]', alvo).forEach(b => b.addEventListener('click', () => { alvo.dataset.aba = b.dataset.aba; desenharEditorQuadro(alvo); }));
  const bCheio = $('[data-cheio]', alvo);
  if (bCheio) bCheio.addEventListener('click', () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
    } catch (e) { /* navegador sem ecrã inteiro */ }
    setTimeout(() => desenharEditorQuadro(alvo), 300);
  });
  const bTempo = $('[data-tempo-toggle]', alvo);
  if (bTempo) bTempo.addEventListener('click', () => {
    const caixa = $('.q-tempo', alvo);
    QUADRO_TEMPO = !(caixa && caixa.classList.contains('aberto'));
    desenharEditorQuadro(alvo);
  });
  const bFechar = $('[data-tempo-fechar]', alvo);
  if (bFechar) bFechar.addEventListener('click', () => { QUADRO_TEMPO = false; desenharEditorQuadro(alvo); });
  const bTat = $('[data-menu-taticas]', alvo);
  if (bTat) bTat.addEventListener('click', () => { PAINEL_QUADRO = 'taticas'; desenharEditorQuadro(alvo); });
  const bTatX = $('[data-painel-x]', alvo);
  if (bTatX) bTatX.addEventListener('click', () => { PAINEL_QUADRO = null; desenharEditorQuadro(alvo); });
  // Tocar fora da lista também a fecha.
  if (FORA_TEMPO) { document.removeEventListener('pointerdown', FORA_TEMPO, true); FORA_TEMPO = null; }
  if (QUADRO_TEMPO === true) {
    FORA_TEMPO = (e) => {
      if (e.target && e.target.closest && e.target.closest('.q-tempo')) return;
      QUADRO_TEMPO = false;
      desenharEditorQuadro(alvo);
    };
    setTimeout(() => document.addEventListener('pointerdown', FORA_TEMPO, true), 0);
  }
  const bOnze = $('[data-onze-novo]', alvo);
  if (bOnze) bOnze.addEventListener('click', () => {
    const d = QUADRO_SUGERIDO;
    if (!d) return;
    QUADRO_SUGERIDO = null;
    aplicarJogo(d);
    aviso('Atualizado para o último onze: ' + d.jogo.nome + '.');
  });
  // Linha do tempo: carregar num momento põe o campo como estava nesse minuto (as duas equipas).
  $$('[data-min]', alvo).forEach(b => b.addEventListener('click', () => {
    const min = Number(b.dataset.min);
    mudar(() => {
      q.estado.pontos = aplicarTempo(q.estado, min === 0 ? null : min);
      q.estado.momento = min === 0 ? null : min;
    });
    aviso(min === 0
      ? 'Campo como no minuto 0 (onze inicial).'
      : `Campo como estava aos ${min}' — substituições e expulsões até esse minuto, nas duas equipas.`);
  }));
  // Convocados que não entraram (só Benfica).
  $$('[data-convocados]', alvo).forEach(bConv => bConv.addEventListener('click', () => {
    const banco = ((q.estado.suplentes || {}).v) || [];
    const usados = (q.estado.eventos || []).filter(e => e.equipa === 'v' && e.tipo === 'sub').map(e => e.entra);
    const restantes = banco.filter(s => !usados.some(u => mesmoNome(u, s.nome)));
    const html = restantes.length
      ? `<div class="q-convocados">${restantes.map(s => `<div class="q-convocado">${fotoRedonda(s.foto, s.nome, 54)}<span>${esc(s.nome)}</span><small>${esc(s.n || '')}</small></div>`).join('')}</div>`
      : '<p class="suave">Não há convocados por entrar (ou o quadro não veio de um jogo).</p>';
    if (typeof janelaPart === 'function') janelaPart('Convocados que não entraram · Benfica', html, 560);
    else document.body.insertAdjacentHTML('beforeend', `<div class="fundo-modal"><div class="modal"><header><h3>Convocados</h3></header><div class="modal-corpo">${html}</div></div></div>`);
  }));
  $$('[data-form]', alvo).forEach(b => b.addEventListener('click', () => {
    const [c, f] = b.dataset.form.split(':');
    PAINEL_QUADRO = null;
    mudar(() => {
      // Muda só as posições: mantém os jogadores (nomes e fotos) e arruma-os por linhas:
      // do guarda-redes para o ataque e, em cada linha, da esquerda para a direita (os extremos ficam nas alas).
      const adv = c === 'b';
      const atuais = q.estado.pontos.filter(p => p.c === c).slice().sort((u, v) => adv ? v.x - u.x : u.x - v.x);
      let i = 0;
      FORMACOES_LINHAS[f].forEach(([n, x, ysDef]) => {
        const grupo = atuais.slice(i, i + n).sort((u, v) => adv ? v.y - u.y : u.y - v.y);
        i += n;
        const ys = (ysDef && grupo.length === n) ? ysDef : larguraLinha(Math.max(1, grupo.length));
        grupo.forEach((p, k) => {
          p.x = r3(adv ? 1 - x : x);
          p.y = r3(adv ? 1 - ys[k] : ys[k]);
        });
      });
    });
  }));
  const desfazer = () => {
    if (!QUADRO_HIST.length) return;
    QUADRO_REFAZER.push(JSON.stringify(q.estado));
    q.estado = JSON.parse(QUADRO_HIST.pop());
    mudar(() => {}, true);
  };
  const refazer = () => {
    if (!QUADRO_REFAZER.length) return;
    QUADRO_HIST.push(JSON.stringify(q.estado));
    q.estado = JSON.parse(QUADRO_REFAZER.pop());
    mudar(() => {}, true);
  };
  $$('[data-desfazer]', alvo).forEach(b => b.addEventListener('click', desfazer));
  $$('[data-refazer]', alvo).forEach(b => b.addEventListener('click', refazer));

  // Momentos guardados por jogo: aplicar num toque (ou nas teclas 1 a 9).
  const abrirMomento = id => {
    const m = momentosDoJogo(jogoPrep).find(x => x.id === id);
    if (!m) return;
    mudar(() => {
      q.estado.pontos = JSON.parse(JSON.stringify(m.pontos || []));
      q.estado.linhas = JSON.parse(JSON.stringify(m.linhas || []));
      q.estado.momento = null;
      if (m.titulo) q.titulo = m.titulo;
    });
    aviso('Momento aplicado: ' + m.nome + '.');
  };
  $$('[data-mom-abrir]', alvo).forEach(b => b.addEventListener('click', () => abrirMomento(b.dataset.momAbrir)));
  $$('[data-mom-x]', alvo).forEach(b => b.addEventListener('click', () => {
    if (!confirm('Apagar este momento?')) return;
    const k = chaveMomentos(jogoPrep), j = QUADRO_MOM.jogos[k];
    if (j) j.lista = j.lista.filter(x => x.id !== b.dataset.momX);
    guardarMomentos();
    desenharEditorQuadro(alvo);
  }));
  const bMomG = $('[data-mom-guardar]', alvo);
  if (bMomG) bMomG.addEventListener('click', () => {
    const nome = ($('[data-mom-nome]', alvo).value || '').trim() || ('Momento ' + (momentos.length + 1));
    const k = chaveMomentos(jogoPrep);
    const j = QUADRO_MOM.jogos[k] || (QUADRO_MOM.jogos[k] = { nome: jogoPrep.trim() || 'Sem jogo', lista: [] });
    j.lista = j.lista || [];
    if (j.lista.length >= 40) { aviso('Já tens 40 momentos neste jogo: apaga alguns.', true); return; }
    j.lista.push({ id: Date.now().toString(36), nome, titulo: q.titulo || '', pontos: JSON.parse(JSON.stringify(q.estado.pontos || [])), linhas: JSON.parse(JSON.stringify(q.estado.linhas || [])), quando: new Date().toISOString() });
    guardarMomentos();
    aviso('Momento "' + nome + '" guardado.');
    desenharEditorQuadro(alvo);
  });
  $$('[data-jog-play]', alvo).forEach(b => b.addEventListener('click', () => {
    const j = jogadasDoJogo(jogoPrep).find(x => x.id === b.dataset.jogPlay);
    if (!j) return;
    if (QUADRO_PLAY && QUADRO_PLAY.j.id === j.id) { pararJogada(); desenharEditorQuadro(alvo); return; }
    tocarJogada(j, false, alvo);
  }));
  $$('[data-jog-loop]', alvo).forEach(b => b.addEventListener('click', () => {
    const j = jogadasDoJogo(jogoPrep).find(x => x.id === b.dataset.jogLoop);
    if (j) tocarJogada(j, true, alvo);
  }));
  $$('[data-jog-parar]', alvo).forEach(b => b.addEventListener('click', () => { pararJogada(); desenharEditorQuadro(alvo); }));
  $$('[data-jog-x]', alvo).forEach(b => b.addEventListener('click', () => {
    if (!confirm('Apagar esta jogada?')) return;
    const j = QUADRO_MOM.jogos[chaveMomentos(jogoPrep)];
    if (j) j.jogadas = (j.jogadas || []).filter(x => x.id !== b.dataset.jogX);
    guardarMomentos();
    desenharEditorQuadro(alvo);
  }));
  const bGravIni = $('[data-grav-ini]', alvo);
  if (bGravIni) bGravIni.addEventListener('click', () => {
    pararJogada();
    QUADRO_GRAV = { base: { pontos: JSON.parse(JSON.stringify(q.estado.pontos || [])), linhas: JSON.parse(JSON.stringify(q.estado.linhas || [])), bola: q.estado.bola ? JSON.parse(JSON.stringify(q.estado.bola)) : null }, amostras: [], t0: null, nome: '' };
    aviso('A gravar: arrasta os jogadores e a bola. Quando acabares, carrega em Parar e guardar.');
    desenharEditorQuadro(alvo);
  });
  const nomeGrav = $('[data-grav-nome]', alvo);
  if (nomeGrav) nomeGrav.addEventListener('input', () => { if (QUADRO_GRAV) QUADRO_GRAV.nome = nomeGrav.value; });
  const bGravParar = $('[data-grav-parar]', alvo);
  if (bGravParar) bGravParar.addEventListener('click', () => {
    const g = QUADRO_GRAV; QUADRO_GRAV = null;
    if (!g || !g.amostras.length) { aviso('Não gravaste nenhum movimento.', true); desenharEditorQuadro(alvo); return; }
    const k = chaveMomentos(jogoPrep);
    const jg = QUADRO_MOM.jogos[k] || (QUADRO_MOM.jogos[k] = { nome: jogoPrep.trim() || 'Sem jogo', lista: [] });
    jg.lista = jg.lista || []; jg.jogadas = jg.jogadas || [];
    if (jg.jogadas.length >= 20) { aviso('Já tens 20 jogadas neste jogo: apaga algumas.', true); desenharEditorQuadro(alvo); return; }
    const nome = (g.nome || '').trim() || ('Jogada ' + (jg.jogadas.length + 1));
    jg.jogadas.push({ id: Date.now().toString(36), nome, base: g.base, amostras: g.amostras, dur: g.amostras[g.amostras.length - 1][0], quando: new Date().toISOString() });
    guardarMomentos();
    // O campo volta ao início do lance, pronto para carregar em ▶.
    q.estado.pontos = JSON.parse(JSON.stringify(g.base.pontos)); q.estado.linhas = JSON.parse(JSON.stringify(g.base.linhas)); q.estado.bola = g.base.bola;
    guardarQuadroEmBreve();
    aviso('Jogada "' + nome + '" guardada.');
    desenharEditorQuadro(alvo);
  });
  const bPrep = $('[data-prep]', alvo);
  if (bPrep) bPrep.addEventListener('change', () => { q.estado.prep_jogo = bPrep.value.trim(); guardarQuadroEmBreve(); desenharEditorQuadro(alvo); });
  if (QUADRO_TECLA) document.removeEventListener('keydown', QUADRO_TECLA);
  QUADRO_TECLA = ev => {
    if (!alvo.isConnected) { document.removeEventListener('keydown', QUADRO_TECLA); return; }
    const t = ev.target && ev.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); desfazer(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); refazer(); return; }
    if (/^[1-9]$/.test(ev.key) && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const m = momentosDoJogo(jogoPrep)[Number(ev.key) - 1];
      if (m) abrirMomento(m.id);
    }
  };
  document.addEventListener('keydown', QUADRO_TECLA);
  $$('[data-limpar]', alvo).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.limpar === 'tudo' && !confirm('Limpar o campo? Saem os jogadores, os riscos e as setas (podes voltar com "Desfazer").')) return;
    mudar(() => {
      if (b.dataset.limpar === 'tudo') {
        q.estado.pontos = [];
        q.estado.bola = null;
        q.estado.bancos = null;
        q.estado.jogo = null;
        q.estado.momento = null;
      }
      q.estado.linhas = [];
    });
  }));
  // Seleção do "Sub. Manual": o primeiro jogador fica marcado.
  const sel = alvo.dataset.selecao;
  if (sel != null && sel !== '') {
    const g = $(`[data-ponto="${sel}"]`, alvo);
    if (g) {
      const circulos = g.querySelectorAll('circle');
      const anel = circulos[circulos.length - 1];
      if (anel) { anel.setAttribute('stroke', '#ffd400'); anel.setAttribute('stroke-width', '.55'); }
    }
  }
  const bVis = $$('[data-visivel]', alvo);
  bVis.forEach(b => b.addEventListener('click', async () => {
    const ligar = b.dataset.visivel === '1';
    // Se o quadro estiver vazio, vai buscar o último onze antes de o pôr na app.
    if (ligar && !(q.estado.pontos || []).length) {
      carregar(true);
      const d = await onzeDoUltimoJogo(false).catch(() => null);
      carregar(false);
      if (d) {
        q.estado.pontos = d.pontos;
        q.estado.bancos = d.bancos;
        q.estado.jogo = d.jogo;
        if (!q.titulo) q.titulo = d.titulo;
      }
    }
    if (ligar && !await perguntar('Pôr o quadro na app?',
      `<p>O quadro passa a aparecer <b>no topo do Início da app, no lugar do "Quem somos"</b>, em direto: a partir daqui, cada jogador que mexeres, risco ou seta que desenhares mexe nos telemóveis em 1 a 2 segundos. Quem quiser pode vê-lo em ecrã inteiro.</p>
       <p class="suave">Confirma no telemóvel abaixo se está tudo bem.${CFG.modo === 'local' ? ' <b>Modo de teste:</b> nada vai aparecer na app.' : ''}</p>
       <div class="prev-pequena">${prevQuadro(q.estado, q.titulo)}</div>`, 'Sim, pôr na app', 'Ainda não')) return;
    if (!ligar && !confirm('Tirar o quadro da app? (o desenho fica guardado aqui)')) return;
    q.visivel = ligar;
    await guardarQuadro();
    desenharEditorQuadro(alvo);
  }));

  // Ratos e dedos no relvado.
  // Enquanto se grava uma jogada, cada movimento fica registado com o seu instante.
  const amostra = (i, x, y) => {
    const g = QUADRO_GRAV; if (!g || g.amostras.length > 6000) return;
    const agora = performance.now();
    if (g.t0 == null) g.t0 = agora;
    const t = Math.round(agora - g.t0), ult = g.amostras[g.amostras.length - 1];
    if (ult && ult[1] === i && t - ult[0] < 20) return;
    g.amostras.push([t, i, Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
  };
  let arrastar = null;   // { i } ponto a mover | { nova: {t,x1,y1,x2,y2} } risco a desenhar
  svg.addEventListener('pointerdown', ev => {
    const g = ev.target.closest('[data-ponto]'), l = ev.target.closest('[data-linha]'), bo = ev.target.closest('[data-bola]');
    const p = ponto(ev);
    if (QUADRO_PLAY) pararJogada();
    if (ferramenta === 'bola') {
      if (bo) { QUADRO_HIST.push(JSON.stringify(q.estado)); arrastar = { bola: true }; svg.setPointerCapture(ev.pointerId); amostra(-1, q.estado.bola.x, q.estado.bola.y); return; }
      // Depois de pôr a bola, passa logo a ✋ Mover: o próximo gesto é arrastar um jogador.
      mudar(() => { q.estado.bola = { x: r3(p.x), y: r3(p.y) }; alvo.dataset.ferramenta = 'mover'; });
      return;
    }
    if (ferramenta === 'cor') {
      if (g) mudar(() => {
        const pt = q.estado.pontos[Number(g.dataset.ponto)]; if (!pt) return;
        const c = alvo.dataset.cor || 'amarelo';
        if (c === 'padrao') delete pt.cor; else pt.cor = c;
      });
      return;
    }
    if (ferramenta === 'apagar') {
      if (bo) mudar(() => { q.estado.bola = null; });
      else if (g) mudar(() => q.estado.pontos.splice(Number(g.dataset.ponto), 1));
      else if (l) mudar(() => q.estado.linhas.splice(Number(l.dataset.linha), 1));
      return;
    }
    if (ferramenta === 'manual') {
      // Troca dois jogadores de posição, mesmo que não tenham entrado na realidade.
      if (!g) { delete alvo.dataset.selecao; desenharEditorQuadro(alvo); return; }
      const i = Number(g.dataset.ponto);
      const escolhido = alvo.dataset.selecao;
      if (escolhido == null || escolhido === '') {
        const jogador = q.estado.pontos[i];
        if (!jogador) return;
        alvo.dataset.selecao = String(i);
        aviso('Escolheste ' + (jogador.nome || 'um jogador') + '. Clica no outro para trocarem de posição.');
        desenharEditorQuadro(alvo);
        return;
      }
      const j = Number(escolhido);
      if (j === i) { delete alvo.dataset.selecao; desenharEditorQuadro(alvo); return; }
      const a = q.estado.pontos[i], b2 = q.estado.pontos[j];
      if (!a || !b2) { delete alvo.dataset.selecao; return; }
      if (a.c !== b2.c) { aviso('Têm de ser dois jogadores da mesma equipa.', true); return; }
      delete alvo.dataset.selecao;
      mudar(() => {
        const tx = a.x, ty = a.y;
        a.x = b2.x; a.y = b2.y;
        b2.x = tx; b2.y = ty;
      });
      aviso('Trocados: ' + (b2.nome || '?') + ' e ' + (a.nome || '?') + '.');
      return;
    }
    if (ferramenta === 'v' || ferramenta === 'b') {
      if (conta(ferramenta) >= 11) { aviso(`Já tens 11 ${ferramenta === 'v' ? 'encarnados' : 'brancos'}.`, true); return; }
      // Depois de pôr o jogador, passa logo a ✋ Mover (o gesto seguinte é arrastar).
      mudar(() => { q.estado.pontos.push({ c: ferramenta, x: r3(p.x), y: r3(p.y), n: '' }); alvo.dataset.ferramenta = 'mover'; });
      return;
    }
    if (ferramenta === 'linha' || ferramenta === 'seta') {
      if (q.estado.linhas.length >= 60) { aviso('Já há muitos riscos: apaga alguns.', true); return; }
      QUADRO_HIST.push(JSON.stringify(q.estado));
      arrastar = { nova: { t: ferramenta, x1: r3(p.x), y1: r3(p.y), x2: r3(p.x), y2: r3(p.y) } };
      q.estado.linhas.push(arrastar.nova);
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    if (bo) {
      QUADRO_HIST.push(JSON.stringify(q.estado));
      arrastar = { bola: true };
      svg.setPointerCapture(ev.pointerId);
      amostra(-1, q.estado.bola.x, q.estado.bola.y);
      return;
    }
    if (g) {
      QUADRO_HIST.push(JSON.stringify(q.estado));
      arrastar = { i: Number(g.dataset.ponto) };
      svg.setPointerCapture(ev.pointerId);
      const pt0 = q.estado.pontos[arrastar.i];
      if (pt0) amostra(arrastar.i, pt0.x, pt0.y);
    }
  });
  svg.addEventListener('pointermove', ev => {
    if (!arrastar) return;
    const p = ponto(ev);
    if (arrastar.nova) { arrastar.nova.x2 = r3(p.x); arrastar.nova.y2 = r3(p.y); }
    else if (arrastar.bola) { q.estado.bola = { x: r3(p.x), y: r3(p.y) }; amostra(-1, r3(p.x), r3(p.y)); }
    else { const pt = q.estado.pontos[arrastar.i]; pt.x = r3(p.x); pt.y = r3(p.y); amostra(arrastar.i, pt.x, pt.y); }
    // Redesenha dentro do mesmo svg (assim continua a seguir o rato/dedo).
    const tmp = document.createElement('div');
    tmp.innerHTML = quadroSvg(q.estado);
    svg.innerHTML = tmp.firstElementChild.innerHTML;
    guardarQuadroEmBreve();
  });
  const largar = () => {
    if (!arrastar) return;
    const n = arrastar.nova;
    if (n && Math.hypot((n.x2 - n.x1) * RL, (n.y2 - n.y1) * RW) < 1.5) { q.estado.linhas.pop(); QUADRO_HIST.pop(); }
    arrastar = null;
    guardarQuadroEmBreve();
    desenharEditorQuadro(alvo);
  };
  svg.addEventListener('pointerup', largar);
  svg.addEventListener('pointercancel', largar);
}

/** Envia no máximo de 300 em 300 ms: enquanto se arrasta, a app vai vendo o jogador a mexer. */
let QUADRO_A_ENVIAR = false, QUADRO_DE_NOVO = false;
function guardarQuadroEmBreve() {
  if (QUADRO_TIMER) return;
  QUADRO_TIMER = setTimeout(() => { QUADRO_TIMER = null; guardarQuadro(); }, 300);
}

async function guardarQuadro() {
  clearTimeout(QUADRO_TIMER); QUADRO_TIMER = null;
  const q = QUADRO;
  if (!q) return;
  // Um envio de cada vez (pela ordem certa); se mudar entretanto, envia outra vez no fim.
  if (QUADRO_A_ENVIAR) { QUADRO_DE_NOVO = true; return; }
  QUADRO_A_ENVIAR = true;
  try { await enviarQuadro(q); } finally {
    QUADRO_A_ENVIAR = false;
    if (QUADRO_DE_NOVO) { QUADRO_DE_NOVO = false; guardarQuadro(); }
  }
}

async function enviarQuadro(q) {
  const info = t => { q.guardadoTxt = t; const el = $('[data-guardado]'); if (el) el.textContent = t; };
  if (CFG.modo === 'local' || !CFG.token) { info('Modo de teste: não é guardado nem aparece na app.'); return; }
  try {
    const r = await rpcAdmin('bi_admin_quadro_guardar', { p_estado: q.estado, p_visivel: q.visivel, p_titulo: q.titulo || '' });
    q.versao = r.versao;
    const h = new Date().toLocaleTimeString('pt-PT');
    info(q.visivel ? `Enviado às ${h} · a app mostra em 1 a 2 segundos.` : `Guardado às ${h} (ainda não está na app).`);
  } catch (e) { info(''); aviso('Não foi possível guardar o quadro: ' + e.message, true); }
}

/* =============================== Sondagens com fotos =============================== */
let JOGADORES = null;

async function lerJogadores() {
  if (JOGADORES) return JOGADORES;
  try { JOGADORES = await (await fetch('jogadores.json', { cache: 'no-cache' })).json(); }
  catch (e) { JOGADORES = []; }
  return JOGADORES;
}

function fotoRedonda(foto, nome, tam) {
  const ini = String(nome || '?').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="foto-redonda" style="width:${tam}px;height:${tam}px">${foto ? `<img src="${esc(foto)}" alt="">` : `<i>${esc(ini)}</i>`}</span>`;
}

/** Como fica na app: aberta (tocar na foto para votar) e depois com o resultado. */
function prevSondagemFotos(pergunta, jog, fecha, votos) {
  jog = jog.length ? jog : [{ nome: 'Jogador 1', foto: '' }, { nome: 'Jogador 2', foto: '' }];
  votos = votos || jog.map(() => 0);
  const total = votos.reduce((a, b) => a + b, 0);
  const venc = total ? votos.indexOf(Math.max(...votos)) : -1;
  const tam = jog.length <= 2 ? 66 : jog.length === 3 ? 56 : 46;
  const fim = fecha ? fimTexto(fecha) : '';
  const grelha = res => `<div class="tm-fotos">${jog.map((j, i) => {
    const pc = total ? Math.round((votos[i] || 0) / total * 100) : 0;
    return `<div class="${res && i === venc ? 'venc' : ''}">${fotoRedonda(j.foto, j.nome, tam)}<span>${res && i === venc ? '🏆 ' : ''}${esc(j.nome)}</span>${res ? `<b>${pc}%</b><i class="tm-barrinha"><em style="width:${pc}%"></em></i>` : ''}</div>`;
  }).join('')}</div>`;
  return telemovel(`<div class="tm-seccao">Início — enquanto está aberta</div>
      <div class="tm-cartao tm-p"><div class="tm-etiqueta">SONDAGEM DO BI · VOTA</div><b class="tm-grande">${esc(pergunta || 'A tua pergunta')}</b>
      ${grelha(false)}<div class="tm-mini">Toca na foto para votar.${fim ? ` Termina a ${esc(fim)}.` : ''}</div></div>`,
      'No topo do Início, no lugar do "Quem somos"' + (fim ? ` — até ${esc(fim)}` : ''))
    + telemovel(`<div class="tm-seccao">Depois de terminar (1 dia)</div>
      <div class="tm-cartao tm-p"><div class="tm-etiqueta">RESULTADO DA SONDAGEM</div><b class="tm-grande">${esc(pergunta || 'A tua pergunta')}</b>
      ${grelha(true)}<div class="tm-mini">${numero(total)} ${total === 1 ? 'voto' : 'votos'} · votação terminada</div></div>`,
      'O resultado fica 1 dia no Início; depois vai para o Histórico de sondagens (menu ⋮)');
}

async function novaSondagemFotos() {
  const lista = await lerJogadores();
  let escolhidos = [];
  const v = await formulario('Nova sondagem com fotos', [
    { nome: 'pergunta', etiqueta: 'Pergunta', tipo: 'text', dica: 'Ex.: Quem foi o melhor em novembro?' },
    { nome: 'jogadores', etiqueta: 'Jogadores (escolhe de 2 a 4)', tipo: 'jogadores' },
    { nome: 'fecha', etiqueta: 'Termina no dia e hora', tipo: 'datetime-local' }
  ], {}, {
    textoGuardar: 'Enviar para aprovação',
    aoAbrir: fundo => montarEscolhaJogadores(fundo, lista, l => { escolhidos = l; }),
    previsualizar: x => prevSondagemFotos(x.pergunta, escolhidos, x.fecha),
    confirmar: () => ({
      titulo: 'Enviar a sondagem para aprovação?',
      html: `<p>A sondagem ${TESTE ? '' : 'vai para <b>aprovação</b>: '}${OUTRO_ADMIN}.</p>
             <p class="suave">Confirma nas imagens abaixo se está tudo bem.${CFG.modo === 'local' ? ' <b>Modo de teste:</b> nada vai ser enviado.' : ''}</p>`,
      sim: 'Sim, enviar'
    }),
    nota: (CFG.modo === 'local' ? '<b>Modo de teste:</b> podes experimentar e pré-visualizar, mas a sondagem não é enviada.<br><br>' : '') +
      'Escolhe até 4 jogadores: na app aparece a foto e o nome de cada um e vota-se tocando na foto. Enquanto está aberta fica no topo do Início, no lugar do "Quem somos"; quando termina, o resultado fica <b>1 dia</b> no Início e depois vai para o "Histórico de sondagens" (menu ⋮). Precisa da aprovação de outro administrador.',
    validar: x => {
      if (!x.pergunta || x.pergunta.trim().length < 3) return 'Escreve a pergunta.';
      if (escolhidos.length < 2 || escolhidos.length > 4) return 'Escolhe entre 2 e 4 jogadores.';
      if (!x.fecha || new Date(x.fecha) <= new Date()) return 'Escolhe o dia e a hora em que termina (no futuro).';
      return '';
    }
  });
  if (!v) return;
  if (CFG.modo === 'local' || !CFG.token) {
    aviso('Modo de teste: a sondagem NÃO foi enviada. Para a publicar, sai e entra com a conta GitHub.', true);
    return;
  }
  try {
    carregar(true);
    await rpcAdmin('bi_admin_sondagem_fotos_criar', {
      p_pergunta: v.pergunta, p_opcoes: escolhidos.map(j => j.nome.slice(0, 80)), p_fotos: escolhidos.map(j => j.foto || ''),
      p_fecha: new Date(v.fecha).toISOString()
    });
    aviso(TESTE ? 'Sondagem publicada.' : 'Sondagem enviada. Falta a aprovação de outro administrador.');
  } catch (e) { aviso(e.message, true); } finally { carregar(false); }
  if (ECRAS_ATIVO === 'votacoes') redesenhar();
}

/** Lista de jogadores com foto para escolher (pesquisa, equipa principal / feminino, e "outro nome"). */
function montarEscolhaJogadores(fundo, lista, aoMudar) {
  const caixa = $('[data-jogadores]', fundo);
  if (!caixa) return;
  let escolhidos = [], equipa = 'Equipa principal', filtro = '';
  const desenhar = () => {
    const vis = lista.filter(j => j.equipa === equipa && (!filtro || j.nome.toLowerCase().includes(filtro)));
    caixa.innerHTML = `
      <div class="jog-escolhidos">${escolhidos.length ? escolhidos.map((j, i) => `<span class="jog-chip">${fotoRedonda(j.foto, j.nome, 26)} ${esc(j.nome)} <button type="button" data-tirar="${i}">✕</button></span>`).join('')
        : '<span class="suave">Ainda nenhum escolhido.</span>'} <b class="mini">${escolhidos.length}/4</b></div>
      <div class="linha-acoes">
        ${['Equipa principal', 'Futebol feminino'].map(e => `<button type="button" class="botao pequeno ${e === equipa ? 'principal' : ''}" data-equipa="${e}">${e}</button>`).join('')}
        <input type="search" data-filtro placeholder="Procurar nome…" value="${esc(filtro)}" style="flex:1;min-width:120px">
      </div>
      <div class="jog-grelha">${vis.map(j => {
        const sel = escolhidos.some(x => x.nome === j.nome && x.foto === j.foto);
        return `<button type="button" class="jog ${sel ? 'sel' : ''}" data-jog="${esc(j.foto)}">${fotoRedonda(j.foto, j.nome, 54)}<span>${esc(j.nome)}</span><small>${esc(j.numero ? '#' + j.numero : '')}</small></button>`;
      }).join('') || '<p class="suave">Nenhum jogador com esse nome.</p>'}</div>
      <div class="linha-acoes"><input type="text" data-outro placeholder="Outro nome (sem foto)" maxlength="60" style="flex:1">
        <button type="button" class="botao pequeno" data-juntar>＋ Juntar</button></div>`;
    $$('[data-jog]', caixa).forEach(b => b.addEventListener('click', () => {
      const j = lista.find(x => x.foto === b.dataset.jog);
      const i = escolhidos.findIndex(x => x.foto === j.foto && x.nome === j.nome);
      if (i >= 0) escolhidos.splice(i, 1);
      else if (escolhidos.length >= 4) { aviso('No máximo 4 jogadores.', true); return; }
      else escolhidos.push({ nome: j.nome, foto: j.foto });
      aoMudar(escolhidos.slice()); desenhar();
    }));
    $$('[data-tirar]', caixa).forEach(b => b.addEventListener('click', () => { escolhidos.splice(Number(b.dataset.tirar), 1); aoMudar(escolhidos.slice()); desenhar(); }));
    $$('[data-equipa]', caixa).forEach(b => b.addEventListener('click', () => { equipa = b.dataset.equipa; desenhar(); }));
    const f = $('[data-filtro]', caixa);
    f.addEventListener('input', () => { filtro = f.value.trim().toLowerCase(); const pos = f.selectionStart; desenhar(); const n = $('[data-filtro]', caixa); n.focus(); n.setSelectionRange(pos, pos); });
    $('[data-juntar]', caixa).addEventListener('click', () => {
      const n = $('[data-outro]', caixa).value.trim();
      if (!n) return;
      if (escolhidos.length >= 4) { aviso('No máximo 4 jogadores.', true); return; }
      escolhidos.push({ nome: n, foto: '' }); aoMudar(escolhidos.slice()); desenhar();
    });
  };
  desenhar();
}

/* ============================ Onze do último jogo (ESPN) ============================ */
// O ESPN tem os onzes de cada jogo com a formação e a posição de cada jogador. Daqui saem
// as bolinhas já colocadas: Benfica à esquerda (encarnado), adversário à direita (branco),
// com o nome por baixo e a foto nos jogadores do Benfica.
const ESPN_SOCCER = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_BENFICA = '1929';

/** "Tomás Araújo" → "tomas araujo" (sem acentos, para comparar nomes). */
function semAcentos(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function nomeCurto(nomeCompleto) {
  const partes = String(nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
  return partes.length <= 1 ? (partes[0] || '') : partes[partes.length - 1];
}

/** G = guarda-redes, D = defesa, M = meio-campo, F = ataque. */
function tipoPosicao(p) {
  const c = String((p && p.position && p.position.abbreviation) || '').toUpperCase();
  if (c === 'G' || c === 'GK') return 'G';
  if (/^(DM|CDM|CM|AM|CAM|LM|RM)/.test(c)) return 'M';      // os médios (incluindo o trinco DM) não são defesas
  if (/^(RB|LB|CB|CD|SW|D|LWB|RWB|FB)/.test(c)) return 'D';
  if (/^(F|ST|CF|W|LW|RW)/.test(c)) return 'F';
  return 'M';
}

/** -1 = lateral esquerda, +1 = lateral direita; os centrais ficam mais perto do meio.
 *  É isto que põe a defesa e o meio pela ordem certa, da esquerda para a direita. */
function ladoPosicao(p) {
  const c = String((p && p.position && p.position.abbreviation) || '').toUpperCase();
  const lados = {
    LB: -1, LWB: -1, LW: -1, LM: -0.8, 'CD-L': -0.6, 'AM-L': -1,
    RB: 1, RWB: 1, RW: 1, RM: 0.8, 'CD-R': 0.6, 'AM-R': 1
  };
  if (c in lados) return lados[c];
  if (/(^|-)L$/.test(c)) return -1;
  if (/(^|-)R$/.test(c)) return 1;
  return 0;
}

/** É um jogador de ala (fica junto à linha lateral)? Os médios centrais (CM-L, CM-R, DM…) NÃO são alas. */
function ehAla(p) {
  const c = String((p && p.position && p.position.abbreviation) || '').toUpperCase();
  return /^(LB|RB|LWB|RWB|LM|RM|LW|RW|AM-L|AM-R)$/.test(c);
}

/** Posições na largura (0 a 1) de uma linha: as alas nas pontas e os restantes por dentro, bem espaçados. */
function largurasLinha(lista) {
  const n = lista.length;
  if (n <= 1) return [.5];
  const alas = lista.map(ehAla);
  const esq = alas[0], dir = alas[n - 1];
  const centrais = n - (esq ? 1 : 0) - (dir ? 1 : 0);
  const miolo = k => k <= 0 ? [] : k === 1 ? [.5] : k === 2 ? [.38, .62] : k === 3 ? [.27, .5, .73] : k === 4 ? [.2, .4, .6, .8] : Array.from({ length: k }, (_, i) => .15 + (.7 * i) / (k - 1));
  return [...(esq ? [.11] : []), ...miolo(centrais), ...(dir ? [.89] : [])];
}

/** Profundidade no campo: 0 guarda-redes, 1 defesa, 2 trinco, 3 meio, 4 médio ofensivo, 5 ataque.
 *  Serve para repartir os médios pelas linhas da formação (ex.: 4-2-3-1 → 2 e 3). */
function profundidadePosicao(p) {
  const c = String((p && p.position && p.position.abbreviation) || '').toUpperCase();
  if (c === 'G' || c === 'GK') return 0;
  if (/^(RB|LB|CB|CD|SW|D|LWB|RWB|FB)/.test(c)) return 1;
  if (/^(DM|CDM|SW)/.test(c)) return 2;
  if (/^(AM|CAM)/.test(c)) return 4;
  if (/^(F|ST|CF|W|LW|RW)/.test(c)) return 5;
  return 3;
}

/** Divide uma lista em partes com os tamanhos pedidos (ex.: [2,3]). */
function dividirLista(lista, partes) {
  const total = partes.reduce((a, b) => a + b, 0) || 1;
  const out = [];
  let i = 0;
  partes.forEach(n => {
    const qtd = Math.round(lista.length * n / total);
    out.push(lista.slice(i, i + qtd));
    i += qtd;
  });
  if (out.length && i < lista.length) out[out.length - 1] = out[out.length - 1].concat(lista.slice(i));
  return out.length ? out : [lista];
}

/** Quantos jogadores em cada linha, segundo a formação que o ESPN indica. */
function linhasDoOnze(time) {
  const roster = (time.roster || []).filter(p => p.starter === true);
  const porTipo = { G: [], D: [], M: [], F: [] };
  roster.forEach(p => porTipo[tipoPosicao(p)].push(p));
  const dita = String(time.formation || '').split('-').map(n => parseInt(n, 10)).filter(n => n > 0 && n <= 6);
  let def = dita.length ? dita[0] : porTipo.D.length;
  let meio = dita.length >= 3 ? dita.slice(1, -1) : (dita.length === 2 ? [dita[1] - porTipo.F.length] : [porTipo.M.length]);
  let ata = dita.length ? dita[dita.length - 1] : porTipo.F.length;
  const somaMeio = meio.reduce((a, b) => a + b, 0);
  // Se a formação não bater certo com o que o ESPN lista, usa as contagens reais.
  if (def !== porTipo.D.length || somaMeio !== porTipo.M.length || ata !== porTipo.F.length || !meio.length) {
    def = porTipo.D.length;
    ata = porTipo.F.length;
    meio = porTipo.M.length ? [porTipo.M.length] : [];
  }
  return { porTipo, meio };
}

/** Coordenadas (0..1) do onze: mesma tática e posições do jogo. */
function coordenadasOnze(time) {
  const { porTipo, meio } = linhasDoOnze(time);
  const filas = [{ x: 0.045, jogadores: porTipo.G }, { x: 0.19, jogadores: porTipo.D }];
  // Os médios entram na formação do mais recuado para o mais adiantado (4-2-3-1 → 2 e 3).
  const medios = porTipo.M.slice().sort((a, b) => profundidadePosicao(a) - profundidadePosicao(b));
  const blocos = dividirLista(medios, meio);
  const xs = blocos.length === 1 ? [0.34] : blocos.length === 2 ? [0.30, 0.405] : [0.28, 0.345, 0.41];
  blocos.forEach((lista, i) => filas.push({ x: xs[Math.min(i, xs.length - 1)], jogadores: lista }));
  if (porTipo.F.length) filas.push({ x: 0.465, jogadores: porTipo.F });
  const out = [];
  filas.forEach(fila => {
    // Da esquerda para a direita: as alas nas pontas e os centrais (CM-L, CD-R…) por dentro.
    const ordemLado = j => ehAla(j) ? Math.sign(ladoPosicao(j) || 1) * 2 : ladoPosicao(j) * 0.5;
    const lista = fila.jogadores.slice().sort((a, b) => ordemLado(a) - ordemLado(b));
    const ys = largurasLinha(lista);
    lista.forEach((j, i) => {
      out.push({ jogador: j, x: fila.x, y: Math.round((ys[i] != null ? ys[i] : .5) * 1000) / 1000 });
    });
  });
  return out;
}

/** Nome do ESPN → jogador do plantel (para a foto). */
function acharJogador(nomeCompleto, lista) {
  const n = semAcentos(nomeCompleto);
  const tokens = n.split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const nome = j => semAcentos(j.nome);
  return lista.find(j => nome(j) === n)
    || lista.find(j => nome(j) === tokens[tokens.length - 1])
    || lista.find(j => nome(j) === tokens[0])
    || lista.find(j => { const p = nome(j).split(' '); return p.length > 1 && p.every(t => tokens.includes(t)); })
    || null;
}

/* ------------------------------ Jogos e onzes (ESPN) ------------------------------ */
// A lista dos últimos jogos alimenta a mini lista lateral; cada jogo tem o onze das duas
// equipas (formação e posições), que se carrega com um toque.
let ULTIMOS = { quando: 0, lista: null };
const RESUMOS = new Map();

/** Últimos 10 jogos terminados do Benfica (data, adversário e resultado). */
async function ultimosJogos() {
  const agora = Date.now();
  if (ULTIMOS.lista && agora - ULTIMOS.quando < 10 * 60_000) return ULTIMOS.lista;
  let cal;
  try {
    const r = await fetch(`${ESPN_SOCCER}/all/teams/${ESPN_BENFICA}/schedule`, { cache: 'no-store' });
    if (!r.ok) throw new Error('O ESPN não respondeu (' + r.status + ').');
    cal = await r.json();
  } catch (e) {
    ULTIMOS = { quando: 0, lista: null, falhou: true };
    throw e;
  }
  const g = c => {
    const s = c.score;
    if (typeof s === 'string' || typeof s === 'number') return String(s);
    if (s && s.displayValue != null) return String(s.displayValue);
    if (s && s.value != null) return String(s.value);
    return '';
  };
  const lista = (cal.events || [])
    .filter(e => e.competitions && e.competitions[0] && e.competitions[0].status && e.competitions[0].status.type && e.competitions[0].status.type.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(e => {
      const cs = (e.competitions && e.competitions[0] && e.competitions[0].competitors) || [];
      const eu = cs.find(c => String((c.team || {}).id) === ESPN_BENFICA) || {};
      const ele = cs.find(c => String((c.team || {}).id) !== ESPN_BENFICA) || {};
      return {
        id: String(e.id), nome: String(e.name || ''), data: String(e.date || ''),
        casa: eu.homeAway === 'home',
        golosN: g(eu), golosA: g(ele),
        adversario: String((ele.team || {}).shortDisplayName || (ele.team || {}).displayName || 'adversário'),
        competicao: String((e.season || {}).displayName || '')
      };
    });
  ULTIMOS = { quando: agora, lista };
  return lista;
}

/** Resumo de um jogo (fica em memória para não repetir pedidos). */
async function resumoDoJogo(id) {
  const chave = String(id);
  if (RESUMOS.has(chave)) return RESUMOS.get(chave);
  const r = await fetch(`${ESPN_SOCCER}/all/summary?event=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('O ESPN não tem o resumo desse jogo (' + r.status + ').');
  const s = await r.json();
  RESUMOS.set(chave, s);
  return s;
}

/** Substituições e expulsões do jogo, com minuto e equipa (as duas equipas). */
function eventosDoJogo(sum, benfica, rival, fotos) {
  const lado = id => String(id) === ESPN_BENFICA ? 'v' : 'b';
  const banco = time => new Set(((time && time.roster) || [])
    .filter(p => p.starter !== true)
    .map(p => semAcentos((p.athlete || {}).displayName)));
  const bancoV = banco(benfica), bancoB = banco(rival);
  const rotulo = (nome, equipa) => {
    const nosso = equipa === 'v' ? acharJogador(nome, fotos) : null;
    return String(nosso ? nosso.nome : nomeCurto(nome)).slice(0, 14);
  };
  const out = [];
  (sum.keyEvents || []).forEach(ev => {
    const tipo = String(((ev.type || {}).text) || '');
    const min = parseInt(String((((ev.clock || {}).displayValue) || '')), 10);
    if (!Number.isFinite(min)) return;
    const nomes = ((ev.participants || []).map(x => ((x.athlete || {}).displayName))).filter(Boolean);
    if (!nomes.length) return;
    const equipa = lado((ev.team || {}).id);
    if (/substitution/i.test(tipo) && nomes.length >= 2) {
      // O ESPN põe primeiro quem entrou, mas confirmamos pelo banco (para nunca trocar os dois).
      const doBanco = equipa === 'v' ? bancoV : bancoB;
      const entra = doBanco.has(semAcentos(nomes[0])) ? nomes[0] : (doBanco.has(semAcentos(nomes[1])) ? nomes[1] : nomes[0]);
      const sai = entra === nomes[0] ? nomes[1] : nomes[0];
      out.push({ tipo: 'sub', min, equipa, sai: rotulo(sai, equipa), entra: rotulo(entra, equipa) });
    } else if (/red card|second yellow/i.test(tipo)) {
      out.push({ tipo: 'vermelho', min, equipa, sai: rotulo(nomes[0], equipa), entra: '' });
    }
  });
  out.sort((a, b) => Number(a.min) - Number(b.min));
  return out;
}

/** Com o resumo do jogo, monta as bolinhas das duas equipas (formação, nomes e fotos). */
async function montarQuadro(sum, jogo, soBenfica) {
  const rosters = sum.rosters || [];
  const benfica = rosters.find(x => String((x.team || {}).id) === ESPN_BENFICA);
  const rival = rosters.find(x => String((x.team || {}).id) !== ESPN_BENFICA) || null;
  if (!benfica || !(benfica.roster || []).some(p => p.starter === true)) {
    throw new Error('Esse jogo ainda não tem onzes publicados.');
  }
  const fotos = await lerJogadores();
  const inicial = { v: [], b: [] };
  const juntar = (time, espelhar) => {
    const lado = espelhar ? 'b' : 'v';
    coordenadasOnze(time).forEach(({ jogador, x, y }) => {
      const nomeC = (jogador.athlete || {}).displayName || '';
      const nosso = espelhar ? null : acharJogador(nomeC, fotos);
      inicial[lado].push({
        c: lado,
        x: espelhar ? Math.round((1 - x) * 1000) / 1000 : x,
        y: espelhar ? Math.round((1 - y) * 1000) / 1000 : y,
        n: String(jogador.jersey || '').slice(0, 3),
        nome: String(nosso ? nosso.nome : nomeCurto(nomeC)).slice(0, 14),
        foto: nosso ? nosso.foto : ''
      });
    });
  };
  juntar(benfica, false);
  const equipaB = soBenfica || !rival ? '' : String(rival.team.shortDisplayName || rival.team.displayName || '');
  if (!soBenfica && rival) juntar(rival, true);

  // Convocados que ficaram no banco: servem para as substituições e para a lista "Convocados".
  const bancoDe = (time, comFoto) => ((time && time.roster) || [])
    .filter(p => p.starter !== true)
    .map(p => {
      const nomeC = (p.athlete || {}).displayName || '';
      const nosso = comFoto ? acharJogador(nomeC, fotos) : null;
      return {
        nome: String(nosso ? nosso.nome : nomeCurto(nomeC)).slice(0, 14),
        foto: nosso ? nosso.foto : '',
        n: String(p.jersey || '').slice(0, 3)
      };
    })
    .filter(s => s.nome);
  const suplentes = { v: bancoDe(benfica, true), b: [], equipaB };
  if (!soBenfica && rival) suplentes.b = bancoDe(rival, false);

  // Linha do tempo do jogo (substituições e expulsões, as duas equipas).
  const eventos = eventosDoJogo(sum, benfica, rival, fotos).filter(e => !soBenfica || e.equipa === 'v');
  const pontos = JSON.parse(JSON.stringify([...inicial.v, ...inicial.b]));

  // Compatibilidade: a app mostra os nomes de quem entrou por baixo do campo.
  const entraram = (time, equipa) => eventos.length
    ? eventos.filter(e => e.equipa === equipa && e.tipo === 'sub').map(e => e.entra)
    : ((time && time.roster) || []).filter(p => p.starter !== true && p.subbedIn === true)
        .map(p => nomeCurto((p.athlete || {}).displayName)).filter(Boolean);
  const bancos = {
    v: entraram(benfica, 'v'),
    b: soBenfica ? [] : entraram(rival, 'b'),
    equipaB
  };

  const comp = (sum.header && sum.header.competitions && sum.header.competitions[0] && sum.header.competitions[0].competitors) || [];
  const eu = comp.find(c => String((c.team || {}).id) === ESPN_BENFICA) || {};
  const ele = comp.find(c => String((c.team || {}).id) !== ESPN_BENFICA) || {};
  const g = c => {
    const s = c.score;
    if (typeof s === 'string' || typeof s === 'number') return String(s);
    if (s && s.displayValue != null) return String(s.displayValue);
    if (s && s.value != null) return String(s.value);
    return '';
  };
  const dataTxt = new Date(jogo.data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  const titulo = `${(eu.team || {}).shortDisplayName || 'Benfica'} ${g(eu)}-${g(ele)} ${(ele.team || {}).shortDisplayName || ''} · ${dataTxt}`
    .replace(/\s+/g, ' ').trim().slice(0, 80);
  const resumo = `<b>${esc(jogo.nome || titulo)}</b> (${esc(dataTxt)}). Formações: ${(benfica.team || {}).displayName} ${esc(benfica.formation || '—')}` +
    (rival ? ` · ${esc(rival.team.displayName)} ${esc(rival.formation || '—')}` : '') +
    `. <b>${pontos.length}</b> jogadores no campo` +
    (eventos.length ? ` e ${eventos.length} acontecimentos (substituições/expulsões)` : '') + '.';
  return {
    pontos, inicial, suplentes, eventos, bancos, titulo, resumo,
    jogo: { id: String(jogo.id), nome: String(jogo.nome || titulo), data: String(jogo.data || '') }
  };
}

/** Onze de um jogo escolhido na lista. */
async function onzeDoJogo(jogo, soBenfica) {
  const sum = await resumoDoJogo(jogo.id);
  return montarQuadro(sum, jogo, soBenfica);
}

/** Último onze disponível: o jogo terminado mais recente que já tenha onzes publicados. */
async function onzeDoUltimoJogo(soBenfica) {
  const lista = await ultimosJogos();
  if (!lista.length) throw new Error('Não encontrei nenhum jogo terminado do Benfica.');
  for (const jogo of lista) {
    try {
      const d = await onzeDoJogo(jogo, soBenfica);
      if (String(jogo.id) !== String(lista[0].id)) {
        d.resumo += ' (O jogo mais recente ainda não tem onzes; usei o anterior.)';
      }
      return d;
    } catch (e) { /* tenta o jogo anterior */ }
  }
  throw new Error('Ainda não há onzes disponíveis (nem neste jogo, nem nos anteriores).');
}

/** Pede confirmação e devolve o quadro preenchido (ou null se o administrador desistir). */
async function preencherComUltimoJogo(soBenfica) {
  carregar(true);
  try {
    const d = await onzeDoUltimoJogo(soBenfica, true);
    const ok = await perguntar('Preencher com o último jogo?',
      `<p>${d.resumo}</p>
       <p class="suave">Fica com a mesma tática e as posições desse jogo. Cada bolinha tem o nome por baixo; nos jogadores do Benfica aparece a foto. Em baixo ficam as substituições e expulsões reais, por minuto. Depois podes arrastar, trocar dois com 🔁 Sub. Manual ou tirar com 🗑 Tirar.</p>
       <div class="prev-pequena">${prevQuadro({ pontos: d.pontos, bancos: d.bancos }, d.titulo)}</div>`,
      'Sim, preencher', 'Cancelar');
    return ok ? d : null;
  } catch (e) {
    aviso(e.message || 'Não foi possível ir buscar o último jogo.', true);
    return null;
  } finally { carregar(false); }
}
