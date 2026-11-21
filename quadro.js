/* Plataforma · Benfica Independente — quadro tático em direto e sondagens com fotos.
   Carregado antes de app.js (as funções só usam o que está em app.js quando são chamadas). */
'use strict';

/* =============================== Relvado (SVG) =============================== */
const RL = 105, RW = 68;   // medidas oficiais do relvado (metros)

/** Linhas do campo, em metros (x ao comprimento, y à largura). */
function relvadoSvg() {
  const ln = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const rect = (x1, y1, x2, y2) => `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="none"/>`;
  const arco = (cx, cy, r, a1, a2) => {
    const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    return `<path d="M${x1} ${y1} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}" fill="none"/>`;
  };
  let faixas = '';
  for (let i = 0; i < 12; i += 2) faixas += `<rect x="${i * RL / 12}" y="0" width="${RL / 12}" height="${RW}" fill="#338a38"/>`;
  return `<rect x="-3" y="-3" width="${RL + 6}" height="${RW + 6}" fill="#2e7d32"/>${faixas}
    <g stroke="rgba(255,255,255,.92)" stroke-width=".22">
      ${rect(0, 0, RL, RW)}${ln(RL / 2, 0, RL / 2, RW)}<circle cx="${RL / 2}" cy="${RW / 2}" r="9.15" fill="none"/>
      ${rect(0, RW / 2 - 20.16, 16.5, RW / 2 + 20.16)}${rect(RL, RW / 2 - 20.16, RL - 16.5, RW / 2 + 20.16)}
      ${rect(0, RW / 2 - 9.16, 5.5, RW / 2 + 9.16)}${rect(RL, RW / 2 - 9.16, RL - 5.5, RW / 2 + 9.16)}
      ${rect(0, RW / 2 - 3.66, -2, RW / 2 + 3.66)}${rect(RL, RW / 2 - 3.66, RL + 2, RW / 2 + 3.66)}
      ${arco(11, RW / 2, 9.15, -53.13, 53.13)}${arco(RL - 11, RW / 2, 9.15, 126.87, 233.13)}
      ${arco(0, 0, 1, 0, 90)}${arco(0, RW, 1, 270, 360)}${arco(RL, 0, 1, 90, 180)}${arco(RL, RW, 1, 180, 270)}
    </g>
    <g fill="rgba(255,255,255,.92)"><circle cx="${RL / 2}" cy="${RW / 2}" r=".35"/><circle cx="11" cy="${RW / 2}" r=".35"/><circle cx="${RL - 11}" cy="${RW / 2}" r=".35"/></g>`;
}

/** Desenho completo (relvado + riscos + jogadores) para o editor e para as pré-visualizações. */
let QUADRO_IDS = 0;
function quadroSvg(estado, extra) {
  const e = estado || { pontos: [], linhas: [] };
  const n = ++QUADRO_IDS;
  const linhas = (e.linhas || []).map((l, i) =>
    `<line data-linha="${i}" x1="${l.x1 * RL}" y1="${l.y1 * RW}" x2="${l.x2 * RL}" y2="${l.y2 * RW}" stroke="#111" stroke-width=".55" stroke-linecap="round" ${l.t === 'seta' ? 'marker-end="url(#ponta)"' : ''}/>`).join('');
  const pontos = (e.pontos || []).map((p, i) => {
    const v = p.c !== 'b';
    const x = Math.round(p.x * RL * 1000) / 1000, y = Math.round(p.y * RW * 1000) / 1000, R = 1.7;
    const foto = /^https:\/\//i.test(String(p.foto || '')) ? p.foto : '';
    const clip = `qc${n}_${i}`;
    const cx = Math.round((x - R) * 1000) / 1000, cy = Math.round((y - R) * 1000) / 1000;
    const circulo = foto
      ? `<defs><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${R}"/></clipPath></defs>
         <image href="${esc(foto)}" xlink:href="${esc(foto)}" x="${cx}" y="${cy}" width="${R * 2}" height="${R * 2}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="${x}" cy="${y}" r="${R}" fill="${v ? '#e21227' : '#fff'}"/>`;
    return `<g data-ponto="${i}" class="q-ponto"><circle cx="${x}" cy="${y}" r="${R * 2}" fill="#fff" fill-opacity="0"/>
      <circle cx="${x}" cy="${y + .3}" r="${R * 1.08}" fill="rgba(0,0,0,.35)"/>${circulo}
      <circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${v ? '#fff' : '#222'}" stroke-width=".35"/>
      ${p.n && !foto ? `<text x="${x}" y="${y + .62}" text-anchor="middle" font-size="1.75" font-weight="700" fill="${v ? '#fff' : '#141414'}" font-family="Arial">${esc(p.n)}</text>` : ''}
      ${p.nome ? `<text x="${x}" y="${y + R + 1.35}" text-anchor="middle" font-size="1.5" font-weight="700" font-family="Arial"
        fill="#fff" stroke="#0b3d12" stroke-width=".4" paint-order="stroke">${esc(p.nome)}</text>` : ''}</g>`;
  }).join('');
  return `<svg class="quadro-svg" viewBox="-3 -3 ${RL + 6} ${RW + 6}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs><marker id="ponta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#111"/></marker></defs>
    ${relvadoSvg()}<g>${linhas}</g><g>${pontos}</g>${extra || ''}</svg>`;
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
const FORMACOES = {
  '4-3-3': [[.04, .5], [.2, .15], [.18, .38], [.18, .62], [.2, .85], [.33, .5], [.38, .3], [.38, .7], [.45, .15], [.47, .5], [.45, .85]],
  '4-4-2': [[.04, .5], [.2, .15], [.18, .38], [.18, .62], [.2, .85], [.34, .15], [.33, .4], [.33, .6], [.34, .85], [.45, .4], [.45, .6]],
  '4-2-3-1': [[.04, .5], [.2, .15], [.18, .38], [.18, .62], [.2, .85], [.3, .4], [.3, .6], [.38, .18], [.38, .5], [.38, .82], [.46, .5]],
  '3-5-2': [[.04, .5], [.18, .28], [.17, .5], [.18, .72], [.32, .1], [.3, .35], [.3, .65], [.32, .9], [.37, .5], [.45, .4], [.45, .6]]
};

let QUADRO = null;          // { estado, visivel, titulo, versao }
let QUADRO_HIST = [];       // para desfazer
let QUADRO_TIMER = null;
let QUADRO_SUGERIDO = null; // onze mais recente, quando o quadro está com um jogo anterior
let QUADRO_INICIAL = null;  // como estava ao abrir (para "Voltar ao início")
let QUADRO_CHEIO = false;   // editor em ecrã inteiro (melhor no tablet)

function ecraQuadro(alvo) {
  QUADRO_CHEIO = false;
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
    guardarInicio();
    await sugerirOnzeAutomatico();
    desenharEditorQuadro(alvo);  })();
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
      QUADRO.estado.bancos = d.bancos;
      QUADRO.estado.jogo = d.jogo;
      QUADRO.titulo = d.titulo;
      await guardarQuadro();
      guardarInicio();
      aviso('Quadro preenchido com o último onze: ' + d.jogo.nome + '.');
    } else if (QUADRO.estado.jogo && String(QUADRO.estado.jogo.id) !== d.jogo.id) {
      QUADRO_SUGERIDO = d;
    }
  } catch (e) { /* sem rede ou sem onzes publicados: fica como está */ }
}

/** Guarda o estado atual como "início", para o botão "Voltar ao início". */
function guardarInicio() {
  if (!QUADRO) return;
  QUADRO_INICIAL = JSON.stringify({ estado: QUADRO.estado, titulo: QUADRO.titulo || '' });
}

function desenharEditorQuadro(alvo) {
  const q = QUADRO;
  q.estado.pontos = q.estado.pontos || [];
  q.estado.linhas = q.estado.linhas || [];
  let ferramenta = alvo.dataset.ferramenta || 'mover';
  const conta = c => q.estado.pontos.filter(p => (p.c === 'b') === (c === 'b')).length;
  const botaoF = (f, t) => `<button class="botao pequeno ${ferramenta === f ? 'principal' : ''}" data-f="${f}">${t}</button>`;
  alvo.innerHTML = cartao('Quadro tático', `
    ${CFG.modo === 'local' ? '<p class="aviso mau"><b>Modo de teste:</b> podes experimentar, mas nada aparece na app. Para usar a sério entra com a conta GitHub.</p>' : ''}
    <div class="q-estado ${q.visivel ? 'ok' : ''}">${q.visivel
      ? '📡 <b>Na app, em direto.</b> O que mexeres aqui mexe nos telemóveis em 1 a 2 segundos (no Início, no lugar do "Quem somos").'
      : '⏸ <b>Não está na app.</b> Prepara à vontade; quando estiver pronto carrega em "Pôr na app".'}</div>
    ${QUADRO_SUGERIDO ? `<div class="q-estado">🆕 Já há o onze de <b>${esc(QUADRO_SUGERIDO.jogo.nome)}</b> (o quadro está com um jogo anterior).
      <button class="botao pequeno principal" data-onze-novo>Atualizar o onze</button></div>` : ''}
    <label>Título (opcional)<input type="text" data-titulo maxlength="80" value="${esc(q.titulo)}" placeholder="Ex.: O onze provável para Braga"></label>
    <div class="q-barra">
      ${botaoF('mover', '✋ Mover')}
      ${botaoF('nome', '✏️ Nome')}
      ${botaoF('numero', '🔢 Nº')}
      ${botaoF('v', '🔴 Pôr encarnado')}
      ${botaoF('b', '⚪ Pôr branco')}
      ${botaoF('linha', '／ Risco')}
      ${botaoF('seta', '➚ Seta')}
      ${botaoF('apagar', '🗑 Apagar')}
    </div>
    <div class="q-layout">
      <aside class="q-lateral">
        <b>Últimos 10 jogos</b>
        <div class="q-jogos">${listaJogosHtml()}</div>
        <p class="suave mini">Toca num jogo para pôr no campo o onze do Benfica e do adversário desse jogo.</p>
      </aside>
      <div class="q-principal">
        <div class="q-campo">${quadroSvg(q.estado)}</div>
        ${bancosHtml(q.estado.bancos)}
        <div class="q-acoes-fixas">
          <button class="botao pequeno" data-desfazer ${QUADRO_HIST.length ? '' : 'disabled'}>↶ Desfazer</button>
          <button class="botao pequeno" data-inicio>🏠 Voltar ao início</button>
          <button class="botao pequeno perigo" data-limpar="tudo">🧹 Limpar o campo</button>
          <button class="botao pequeno" data-limpar="linhas">Tirar riscos e setas</button>
          <button class="botao pequeno" data-cheio>${QUADRO_CHEIO ? '✕ Sair do ecrã inteiro' : '⛶ Ecrã inteiro'}</button>
        </div>
        <p class="suave" style="margin:6px 0">
          Encarnados <b>${conta('v')}/11</b> · Brancos <b>${conta('b')}/11</b>.
          ${ferramenta === 'mover' ? 'Arrasta os jogadores. Dois cliques num jogador para lhe pôr um número.' : ''}
          ${ferramenta === 'nome' ? 'Clica num jogador para escrever o nome que aparece por baixo (até 14 letras).' : ''}
      ${ferramenta === 'numero' ? 'Clica num jogador para escrever o número (até 3).' : ''}
          ${ferramenta === 'v' || ferramenta === 'b' ? 'Clica no relvado onde queres pôr o jogador.' : ''}
          ${ferramenta === 'linha' || ferramenta === 'seta' ? 'Carrega e arrasta no relvado para desenhar (preto).' : ''}
          ${ferramenta === 'apagar' ? 'Clica num jogador, risco ou seta para o tirar.' : ''}
        </p>
      </div>
    </div>
    <div class="linha-acoes">
      <span class="suave">Do último jogo:</span>
      <button class="botao pequeno principal" data-auto="ambos">⚽ Benfica + adversário</button>
      <button class="botao pequeno" data-auto="benfica">🔴 Só o Benfica</button>
    </div>
    <div class="linha-acoes">
      <span class="suave">Formações rápidas:</span>
      ${Object.keys(FORMACOES).map(f => `<button class="botao pequeno" data-form="v:${f}">🔴 ${f}</button>`).join('')}
      ${Object.keys(FORMACOES).map(f => `<button class="botao pequeno" data-form="b:${f}">⚪ ${f}</button>`).join('')}
    </div>
    <p class="suave" data-guardado>${q.guardadoTxt || ''}</p>`,
    q.visivel ? '<button class="botao pequeno perigo" data-visivel="0">Tirar da app</button>'
      : '<button class="botao pequeno principal" data-visivel="1">📡 Pôr na app</button>');
  alvo.dataset.ferramenta = ferramenta;
  // Ecrã inteiro: o cartão ocupa a janela toda (relvado maior para trabalhar no tablet).
  const cardEl = $('.cartao', alvo);
  if (QUADRO_CHEIO && cardEl) cardEl.classList.add('q-cheio');
  const svg = $('.q-campo svg', alvo);

  const mudar = (alterar, semHistorico) => {
    if (!semHistorico) { QUADRO_HIST.push(JSON.stringify(q.estado)); if (QUADRO_HIST.length > 60) QUADRO_HIST.shift(); }
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

  $$('[data-f]', alvo).forEach(b => b.addEventListener('click', () => { alvo.dataset.ferramenta = b.dataset.f; desenharEditorQuadro(alvo); }));
  $('[data-titulo]', alvo).addEventListener('change', ev => { q.titulo = ev.target.value.trim(); guardarQuadroEmBreve(); });
  $$('[data-auto]', alvo).forEach(b => b.addEventListener('click', async () => {
    const d = await preencherComUltimoJogo(b.dataset.auto === 'benfica');
    if (d) {
      mudar(() => { q.estado.pontos = d.pontos; q.estado.bancos = d.bancos; q.estado.jogo = d.jogo; q.titulo = d.titulo; });
      guardarInicio();
    }
  }));
  // Mini lista lateral: carrega o onze das duas equipas desse jogo.
  $$('[data-jogo]', alvo).forEach(b => b.addEventListener('click', async () => {
    const item = (ULTIMOS.lista || []).find(x => String(x.id) === String(b.dataset.jogo));
    if (!item) return;
    carregar(true);
    try {
      const d = await onzeDoJogo(item, false);
      QUADRO_SUGERIDO = null;
      mudar(() => { q.estado.pontos = d.pontos; q.estado.bancos = d.bancos; q.estado.jogo = d.jogo; q.titulo = d.titulo; });
      guardarInicio();
      aviso('Onze de ' + d.jogo.nome + '.');
    } catch (e) {
      aviso(e.message || 'Não foi possível carregar esse jogo.', true);
    } finally { carregar(false); }
  }));
  // Voltar ao início: como estava quando se abriu (ou o último onze carregado).
  const bInicio = $('[data-inicio]', alvo);
  if (bInicio) bInicio.addEventListener('click', () => {
    if (!QUADRO_INICIAL) { aviso('Ainda não há um início guardado.', true); return; }
    let s;
    try { s = JSON.parse(QUADRO_INICIAL); } catch (e) { return; }
    QUADRO_HIST.push(JSON.stringify(q.estado));
    q.estado = JSON.parse(JSON.stringify(s.estado));
    q.titulo = s.titulo || '';
    guardarQuadroEmBreve();
    desenharEditorQuadro(alvo);
    aviso('Voltou ao início.');
  });
  const bCheio = $('[data-cheio]', alvo);
  if (bCheio) bCheio.addEventListener('click', () => { QUADRO_CHEIO = !QUADRO_CHEIO; desenharEditorQuadro(alvo); });
  const bOnze = $('[data-onze-novo]', alvo);
  if (bOnze) bOnze.addEventListener('click', () => {
    const d = QUADRO_SUGERIDO;
    if (!d) return;
    QUADRO_SUGERIDO = null;
    mudar(() => { q.estado.pontos = d.pontos; q.estado.bancos = d.bancos; q.estado.jogo = d.jogo; q.titulo = d.titulo; });
    guardarInicio();
    aviso('Atualizado para o último onze: ' + d.jogo.nome + '.');
  });
  $$('[data-form]', alvo).forEach(b => b.addEventListener('click', () => {
    const [c, f] = b.dataset.form.split(':');
    mudar(() => {
      q.estado.pontos = q.estado.pontos.filter(p => (p.c === 'b') !== (c === 'b'));
      q.estado.bancos = null;   // os suplentes do último jogo deixam de fazer sentido
      q.estado.jogo = null;     // e o quadro já não é o onze desse jogo
      // Encarnados atacam para a direita; brancos ao contrário.
      FORMACOES[f].forEach(([x, y]) => q.estado.pontos.push({ c, x: c === 'b' ? r3(1 - x) : x, y: c === 'b' ? r3(1 - y) : y, n: '' }));
    });
  }));
  $('[data-desfazer]', alvo).addEventListener('click', () => {
    if (!QUADRO_HIST.length) return;
    q.estado = JSON.parse(QUADRO_HIST.pop());
    mudar(() => {}, true);
  });
  $$('[data-limpar]', alvo).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.limpar === 'tudo' && !confirm('Limpar o campo? Saem os jogadores, os riscos e as setas (podes sempre voltar com "Desfazer" ou "Voltar ao início").')) return;
    mudar(() => { if (b.dataset.limpar === 'tudo') { q.estado.pontos = []; q.estado.bancos = null; q.estado.jogo = null; } q.estado.linhas = []; });
  }));
  const bVis = $('[data-visivel]', alvo);
  if (bVis) bVis.addEventListener('click', async () => {
    const ligar = bVis.dataset.visivel === '1';
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
  });

  // Ratos e dedos no relvado.
  let arrastar = null;   // { i } ponto a mover | { nova: {t,x1,y1,x2,y2} } risco a desenhar
  svg.addEventListener('pointerdown', ev => {
    const g = ev.target.closest('[data-ponto]'), l = ev.target.closest('[data-linha]');
    const p = ponto(ev);
    if (ferramenta === 'apagar') {
      if (g) mudar(() => q.estado.pontos.splice(Number(g.dataset.ponto), 1));
      else if (l) mudar(() => q.estado.linhas.splice(Number(l.dataset.linha), 1));
      return;
    }
    if (ferramenta === 'nome') {
      if (!g) return;
      const alvoPonto = q.estado.pontos[Number(g.dataset.ponto)];
      const nome = prompt('Nome do jogador (até 14 letras; vazio para tirar):', alvoPonto.nome || '');
      if (nome === null) return;
      mudar(() => { alvoPonto.nome = nome.trim().slice(0, 14); });
      return;
    }
    if (ferramenta === 'numero') {
      if (!g) return;
      const alvoPonto = q.estado.pontos[Number(g.dataset.ponto)];
      const n = prompt('Número do jogador (até 3; vazio para tirar):', alvoPonto.n || '');
      if (n === null) return;
      mudar(() => { alvoPonto.n = n.trim().slice(0, 3); });
      return;
    }
    if (ferramenta === 'v' || ferramenta === 'b') {
      if (conta(ferramenta) >= 11) { aviso(`Já tens 11 ${ferramenta === 'v' ? 'encarnados' : 'brancos'}.`, true); return; }
      mudar(() => q.estado.pontos.push({ c: ferramenta, x: r3(p.x), y: r3(p.y), n: '' }));
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
    if (g) {
      QUADRO_HIST.push(JSON.stringify(q.estado));
      arrastar = { i: Number(g.dataset.ponto) };
      svg.setPointerCapture(ev.pointerId);
    }
  });
  svg.addEventListener('pointermove', ev => {
    if (!arrastar) return;
    const p = ponto(ev);
    if (arrastar.nova) { arrastar.nova.x2 = r3(p.x); arrastar.nova.y2 = r3(p.y); }
    else { const pt = q.estado.pontos[arrastar.i]; pt.x = r3(p.x); pt.y = r3(p.y); }
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
  svg.addEventListener('dblclick', ev => {
    const g = ev.target.closest('[data-ponto]');
    if (!g || ferramenta !== 'mover') return;
    const pt = q.estado.pontos[Number(g.dataset.ponto)];
    const n = prompt('Número ou letras do jogador (até 3; vazio para tirar):', pt.n || '');
    if (n === null) return;
    mudar(() => { pt.n = n.trim().slice(0, 3); });
  });
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
    const lista = fila.jogadores.slice().sort((a, b) => ladoPosicao(a) - ladoPosicao(b));
    lista.forEach((j, i) => {
      const y = lista.length === 1 ? 0.5 : 0.12 + i * (0.76 / (lista.length - 1));
      out.push({ jogador: j, x: fila.x, y: Math.round(y * 1000) / 1000 });
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

/** Com o resumo do jogo, monta as bolinhas das duas equipas (formação, nomes e fotos). */
async function montarQuadro(sum, jogo, soBenfica) {
  const rosters = sum.rosters || [];
  const benfica = rosters.find(x => String((x.team || {}).id) === ESPN_BENFICA);
  const rival = rosters.find(x => String((x.team || {}).id) !== ESPN_BENFICA) || null;
  if (!benfica || !(benfica.roster || []).some(p => p.starter === true)) {
    throw new Error('Esse jogo ainda não tem onzes publicados.');
  }
  const fotos = await lerJogadores();
  const pontos = [];
  const juntar = (time, espelhar) => {
    coordenadasOnze(time).forEach(({ jogador, x, y }) => {
      const nomeC = (jogador.athlete || {}).displayName || '';
      const nosso = espelhar ? null : acharJogador(nomeC, fotos);
      pontos.push({
        c: espelhar ? 'b' : 'v',
        x: espelhar ? Math.round((1 - x) * 1000) / 1000 : x,
        y: espelhar ? Math.round((1 - y) * 1000) / 1000 : y,
        n: String(jogador.jersey || '').slice(0, 3),
        nome: String(nosso ? nosso.nome : nomeCurto(nomeC)).slice(0, 14),
        foto: nosso ? nosso.foto : ''
      });
    });
  };
  juntar(benfica, false);
  if (!soBenfica && rival) juntar(rival, true);

  // Quem entrou do banco (fica por fora do relvado).
  const entraram = t => ((t && t.roster) || [])
    .filter(p => p.starter !== true && p.subbedIn === true)
    .map(p => nomeCurto((p.athlete || {}).displayName)).filter(Boolean);
  const bancos = {
    v: entraram(benfica),
    b: soBenfica ? [] : entraram(rival),
    equipaB: soBenfica || !rival ? '' : String(rival.team.shortDisplayName || rival.team.displayName || '')
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
    (bancos.v.length || bancos.b.length ? ` + ${bancos.v.length + bancos.b.length} que entraram do banco` : '') + '.';
  return {
    pontos, bancos, titulo, resumo,
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
       <p class="suave">Fica com a mesma tática e as posições desse jogo. Cada bolinha tem o nome por baixo; nos jogadores do Benfica aparece a foto. Depois podes arrastar, mudar o nome (✏️ Nome) ou apagar.</p>
       <div class="prev-pequena">${prevQuadro({ pontos: d.pontos, bancos: d.bancos }, d.titulo)}</div>`,
      'Sim, preencher', 'Cancelar');
    return ok ? d : null;
  } catch (e) {
    aviso(e.message || 'Não foi possível ir buscar o último jogo.', true);
    return null;
  } finally { carregar(false); }
}
