/* Plataforma · BI Estúdio — Participantes: dispositivos, utilizadores, horas de maior movimento e impacto.
   Carregado antes de app.js (as funções só usam o que está em app.js quando são chamadas). */
'use strict';

/* ---------------------------- Dados (com exemplo no modo de teste) ---------------------------- */
let PART_CACHE = null;

function exemploParticipantes() {
  const hoje = diaISO(new Date());
  let s = 11;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const perfil = [1, .6, .4, .3, .25, .3, .5, .9, 1.4, 1.5, 1.6, 1.7, 2.2, 2.0, 1.6, 1.5, 1.6, 1.8, 2.1, 2.6, 3.2, 3.6, 3.0, 1.8];
  const diario = [], horas = { hoje: [], ontem: [], semana: Array(24).fill(0), mes: Array(24).fill(0), ano: Array(24).fill(0) }, dh = [];
  for (let g = 119; g >= 0; g--) {
    const d = new Date(); d.setDate(d.getDate() - g);
    const dow = (d.getDay() + 6) % 7 + 1;
    const fator = (dow >= 6 ? 1.25 : 1) * (0.8 + rnd() * 0.5) * (1 + (120 - g) / 400);
    const hs = perfil.map(p => Math.round(p * 9 * fator * (0.7 + rnd() * 0.6)));
    const total = hs.reduce((a, b) => a + b, 0);
    diario.push({ dia: diaISO(d), aberturas: total, dispositivos: Math.round(total * 0.55) });
    hs.forEach((n, h) => {
      if (g === 0) horas.hoje[h] = n; if (g === 1) horas.ontem[h] = n;
      if (g < 7) horas.semana[h] += n; if (g < 30) horas.mes[h] += n; horas.ano[h] += n;
      if (g < 90) { const x = dh.find(y => y.dow === dow && y.hora === h); if (x) x.n += n; else dh.push({ dow, hora: h, n }); }
    });
  }
  // Origem de exemplo: cada fuso tem o seu "horário nobre" deslocado.
  const fusosEx = [['Europe/Lisbon', 1100, 0], ['Europe/Zurich', 210, 1], ['Europe/Paris', 190, 1], ['Europe/London', 90, 0], ['America/Sao_Paulo', 70, -4],
    ['Africa/Luanda', 55, 1], ['America/New_York', 40, -5], ['Europe/Luxembourg', 38, 1], ['Atlantic/Azores', 25, -1], ['Africa/Maputo', 14, 2]];
  const horasFusoDesl = [];
  fusosEx.forEach(([fuso, total, desl]) => perfil.forEach((_, h) => horasFusoDesl.push({ fuso, hora: h, n: Math.round(perfil[((h - desl) % 24 + 24) % 24] * total * 0.9 * (0.9 + rnd() * 0.2)) })));
  const evolucao = [];
  for (let g = 179; g >= 0; g--) {
    const d = new Date(); d.setDate(d.getDate() - g);
    evolucao.push({ dia: diaISO(d), novos: Math.round(6 + rnd() * 10 + (180 - g) / 25), contas: rnd() < 0.55 ? Math.round(rnd() * 2 + 1) : 0, participacoes: Math.round(20 + rnd() * 40 + (180 - g) / 3) });
  }
  return {
    hoje, exemplo: true, evolucao, dispositivos_total: 1840, ativos_7d: 910, ativos_30d: 1320, novos_hoje: 9, novos_7d: 74, novos_30d: 260,
    contas: 118, contas_com_participacao: 104, versoes: [{ versao: '1.9.2', n: 880 }, { versao: '1.9.0', n: 330 }, { versao: '1.8.4', n: 110 }],
    diario, horas, dia_hora: dh,
    fusos: fusosEx.map(([fuso, total]) => ({ fuso, total, ativos_30d: Math.round(total * 0.72) })), horas_fuso: horasFusoDesl,
    paises_contas: [{ pais: 'Portugal', n: 71, localidades: 14 }, { pais: 'Suíça', n: 19, localidades: 4 }, { pais: 'França', n: 13, localidades: 5 }, { pais: 'Reino Unido', n: 6, localidades: 3 }, { pais: 'Não indicado', n: 9, localidades: 0 }],
    localidades_contas: [{ pais: 'Portugal', localidade: 'Leiria', n: 12 }, { pais: 'Portugal', localidade: 'Lisboa', n: 11 }, { pais: 'Suíça', localidade: 'Genebra', n: 9 },
      { pais: 'Portugal', localidade: 'Porto', n: 8 }, { pais: 'França', localidade: 'Paris', n: 7 }, { pais: 'Suíça', localidade: 'Lausanne', n: 6 }]
  };
}

async function lerParticipantes(forcar) {
  if (!forcar && PART_CACHE && Date.now() - PART_CACHE.em < 60000) return PART_CACHE.d;
  const d = CFG.modo === 'local' || !CFG.token ? exemploParticipantes() : await rpcAdmin('bi_admin_participantes');
  PART_CACHE = { d, em: Date.now() };
  return d;
}

/* ---------------------------- Gráficos pequenos ---------------------------- */
function barrasHoras(vals, destaque) {
  const W = 640, H = 150, bw = W / 24, max = Math.max(1, ...vals);
  const top = new Set(vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter(x => x[0] > 0).map(x => x[1]));
  const barras = vals.map((v, i) => {
    const h = v / max * (H - 18);
    return `<g><title>${String(i).padStart(2, '0')}h: ${numero(v)} aberturas</title>
      <rect x="${i * bw + 2}" y="${H - h}" width="${bw - 4}" height="${Math.max(h, 0)}" rx="3" fill="${top.has(i) ? '#ff3b4f' : '#7a2a35'}"/>
      ${i % 3 === 0 ? `<text x="${i * bw + bw / 2}" y="${H + 13}" fill="#9aa4b2" font-size="11" text-anchor="middle">${i}h</text>` : ''}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto;display:block">${barras}</svg>`;
}

function serieDiaria(diario, dias) {
  const l = diario.slice(-dias), W = 640, H = 160, bw = W / l.length;
  const max = Math.max(1, ...l.map(x => x.aberturas));
  const barras = l.map((x, i) => {
    const h = x.aberturas / max * (H - 18);
    return `<rect x="${i * bw + 1}" y="${H - h}" width="${Math.max(1, bw - 2)}" height="${h}" rx="2" fill="#d4202f" opacity=".85"><title>${dataDia(x.dia)}: ${numero(x.aberturas)} aberturas · ${numero(x.dispositivos)} dispositivos</title></rect>`;
  }).join('');
  const pts = l.map((x, i) => `${(i * bw + bw / 2).toFixed(1)},${(H - x.dispositivos / max * (H - 18)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto;display:block">${barras}
    <polyline points="${pts}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" opacity=".9"/>
    <text x="0" y="${H + 14}" fill="#9aa4b2" font-size="11">${dataDia(l[0].dia)}</text>
    <text x="${W}" y="${H + 14}" fill="#9aa4b2" font-size="11" text-anchor="end">${dataDia(l[l.length - 1].dia)}</text></svg>
    <p class="suave" style="margin:6px 0 0"><span style="color:#d4202f">■</span> aberturas da app &nbsp; <span style="color:#fff">━</span> dispositivos diferentes</p>`;
}

function mapaCalor(dh) {
  const m = Array.from({ length: 7 }, () => Array(24).fill(0));
  dh.forEach(x => { m[x.dow - 1][x.hora] = Number(x.n); });
  const max = Math.max(1, ...m.flat()), dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return `<div class="calor"><div class="calor-linha calor-cab"><span></span>${Array.from({ length: 24 }, (_, h) => `<span>${h % 3 === 0 ? h : ''}</span>`).join('')}</div>
    ${m.map((linha, d) => `<div class="calor-linha"><span class="calor-dia">${dias[d]}</span>${linha.map((v, h) =>
      `<i title="${dias[d]} ${h}h: ${numero(v)} aberturas" style="background:rgba(229,23,46,${(0.07 + 0.93 * v / max).toFixed(2)})"></i>`).join('')}</div>`).join('')}</div>`;
}

const intervaloHora = h => `${String(h).padStart(2, '0')}h–${String((h + 1) % 24).padStart(2, '0')}h`;

/* ---------------------------- Página: Participantes ---------------------------- */
/* A área "Participantes" tem 4 páginas (mais o "Uso da app"), cada uma com 2 ou 3 abas por dentro:
     Resumo            → números e evolução
     Acessos           → calendário (dia e hora), horas de maior movimento e impacto das publicações
     Origem e idades   → de onde vêm, idades e aniversários
     Rankings          → prognósticos da época, quem mais participa e rankings à medida */
const ecraAdeptosResumo = alvo => comAbas(alvo, 'a_resumo', [
  { id: 'numeros', nome: 'Números', icone: 'users', desenhar: abaGeral },
  { id: 'evolucao', nome: 'Evolução', icone: 'chart', desenhar: abaEvolucao }
]);
const ecraAdeptosQuando = alvo => comAbas(alvo, 'a_quando', [
  { id: 'calendario', nome: 'Calendário (dia e hora)', icone: 'calendar', desenhar: abaCalendario },
  { id: 'horas', nome: 'Horas de maior movimento', icone: 'live', desenhar: abaHoras },
  { id: 'impacto', nome: 'Impacto das publicações', icone: 'chart', desenhar: abaImpacto }
]);
const ecraAdeptosQuem = alvo => comAbas(alvo, 'a_quem', [
  { id: 'origem', nome: 'De onde nos veem', icone: 'contact', desenhar: abaOrigem },
  { id: 'idades', nome: 'Idades e aniversários', icone: 'users', desenhar: abaIdades }
]);
const ecraAdeptosRankings = alvo => comAbas(alvo, 'a_rank', [
  { id: 'prognosticos', nome: 'Prognósticos da época', icone: 'star', desenhar: ecraRankingAdmin },
  { id: 'participam', nome: 'Quem mais participa', icone: 'chat', desenhar: ecraAtivos },
  { id: 'construir', nome: 'Construir rankings', icone: 'sliders', desenhar: abaRankings }
]);

let PART_DIAS = 30;
async function abaGeral(alvo) {
  alvo.innerHTML = cartao('Visão geral', '<p class="suave">A carregar…</p>');
  let d;
  try { carregar(true); d = await lerParticipantes(); }
  catch (e) { alvo.innerHTML = cartao('Visão geral', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-participantes.sql no Supabase.</p>`); return; }
  finally { carregar(false); }
  const diario = d.diario || [], hojeLinha = diario[diario.length - 1] || { aberturas: 0, dispositivos: 0 };
  const ult30 = diario.slice(-30), media = ult30.length ? Math.round(ult30.reduce((n, x) => n + x.aberturas, 0) / ult30.length) : 0;
  const vers = d.versoes || [], totV = vers.reduce((n, x) => n + Number(x.n), 0);
  alvo.innerHTML = (d.exemplo ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('Quantos somos', `<p class="suave">Contamos cada instalação da app pelo número aleatório que ela cria (não identifica a pessoa). Não dá para saber quem desinstalou: por isso falamos dos dispositivos que <b>já abriram</b> a app e dos que a abriram <b>recentemente</b>.</p>
      <div class="grelha">
        ${azulejo(numero(d.dispositivos_total), 'Dispositivos que já abriram a app')}
        ${azulejo(numero(d.ativos_30d), 'Ativos nos últimos 30 dias')}
        ${azulejo(numero(d.ativos_7d), 'Ativos nos últimos 7 dias')}
        ${azulejo(numero(d.novos_hoje), 'Novos hoje')}
        ${azulejo(numero(d.novos_7d), 'Novos em 7 dias')}
        ${azulejo(numero(d.novos_30d), 'Novos em 30 dias')}
        ${azulejo(numero(d.contas), 'Utilizadores registados')}
        ${azulejo(numero(d.contas_com_participacao), 'Com participação associada')}
        ${azulejo(pct(d.contas, d.ativos_30d), 'Contas / dispositivos ativos (30 dias)')}
      </div>`) +
    cartao('Acessos à app', `<div style="margin-bottom:12px">${[30, 60, 120].map(n => `<button class="botao pequeno ${n === PART_DIAS ? 'principal' : ''}" data-dias-part="${n}">${n} dias</button>`).join(' ')}</div>
      <div class="grelha" style="margin-bottom:14px">
        ${azulejo(numero(hojeLinha.aberturas), 'Aberturas hoje')}
        ${azulejo(numero(hojeLinha.dispositivos), 'Dispositivos hoje')}
        ${azulejo(numero(media), 'Média diária (30 dias)')}
      </div>${diario.length ? serieDiaria(diario, PART_DIAS) : '<p class="suave">Ainda sem dados.</p>'}
      <p class="suave" style="margin-top:8px">Uma "abertura" conta quando alguém abre a app, no máximo uma vez de 30 em 30 minutos por dispositivo.</p>`) +
    cartao('Versões da app (ativos nos últimos 30 dias)', vers.length ? `<table class="tabela"><tr><th>Versão</th><th class="direita">Dispositivos</th><th></th></tr>
      ${vers.map(v => `<tr><td><b>${esc(v.versao)}</b></td><td class="direita">${numero(v.n)}</td><td style="width:45%"><div class="objetivo-barra" style="margin:0"><i style="width:${Math.round(100 * v.n / Math.max(1, totV))}%"></i></div></td></tr>`).join('')}</table>
      <p class="suave" style="margin-top:8px">Serve para saber quantas pessoas já têm a versão mais recente.</p>` : '<p class="suave">Ainda sem dados (a medição começa com a versão nova da app).</p>');
  $$('[data-dias-part]', alvo).forEach(b => b.addEventListener('click', () => { PART_DIAS = Number(b.dataset.diasPart); abaGeral(alvo); }));
}

let HORAS_PERIODO = 'semana';
const NOMES_HORAS = { hoje: 'Hoje', ontem: 'Ontem', semana: 'Últimos 7 dias', mes: 'Últimos 30 dias', ano: 'Últimos 12 meses' };
async function abaHoras(alvo) {
  alvo.innerHTML = cartao('Horas de maior movimento', '<p class="suave">A carregar…</p>');
  let d;
  try { carregar(true); d = await lerParticipantes(); }
  catch (e) { alvo.innerHTML = cartao('Horas de maior movimento', `<p class="erro">${esc(e.message)}</p>`); return; }
  finally { carregar(false); }
  const vals = ((d.horas || {})[HORAS_PERIODO] || Array(24).fill(0)).map(Number);
  const total = vals.reduce((a, b) => a + b, 0);
  const rank = vals.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v).slice(0, 5).filter(x => x.v > 0);
  const medalha = ['🥇', '🥈', '🥉', '4.º', '5.º'];
  alvo.innerHTML = (d.exemplo ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('Horas de maior movimento — ' + NOMES_HORAS[HORAS_PERIODO], `
      <p class="suave">A que horas as pessoas mais abrem a app (hora de Portugal). É a melhor altura para publicar, enviar avisos ou lançar um quiz.</p>
      <div style="margin:10px 0 14px">${Object.keys(NOMES_HORAS).map(k => `<button class="botao pequeno ${k === HORAS_PERIODO ? 'principal' : ''}" data-horas="${k}">${esc(NOMES_HORAS[k])}</button>`).join(' ')}</div>
      ${total ? barrasHoras(vals) : '<p class="suave">Ainda sem aberturas neste período.</p>'}`) +
    (rank.length ? cartao('Ranking das horas', `<div class="linha-tempo">${rank.map((x, i) => `<div class="evento" style="grid-template-columns:44px 1fr auto;cursor:default">
        <span class="evento-hora">${medalha[i]}</span><span class="evento-txt"><b>${intervaloHora(x.h)}</b><span>${numero(x.v)} aberturas</span></span>
        <b>${Math.round(100 * x.v / total)} %</b></div>`).join('')}</div>
      <p style="margin:12px 0 0">💡 <b>Melhor altura para avisos:</b> ${intervaloHora(rank[0].h)}.</p>`) : '') +
    cartao('Que dia da semana e a que hora (últimos 90 dias)', `${mapaCalor(d.dia_hora || [])}<p class="suave" style="margin-top:8px">Quanto mais vermelho, mais aberturas.</p>`);
  $$('[data-horas]', alvo).forEach(b => b.addEventListener('click', () => { HORAS_PERIODO = b.dataset.horas; abaHoras(alvo); }));
}

let IMPACTO_DIAS = 30;
async function abaImpacto(alvo) {
  alvo.innerHTML = cartao('Impacto', '<p class="suave">A carregar…</p>');
  let d, linhas, quiz = [], envios = {};
  try {
    carregar(true);
    [d, linhas] = await Promise.all([lerParticipantes(), CFG.modo === 'local' ? Promise.resolve(exemploEstatisticas(IMPACTO_DIAS)) : lerTodasEstatisticas(IMPACTO_DIAS)]);
    if (CFG.modo !== 'local') { try { [quiz, envios] = await Promise.all([lerQuizPublico(), lerQuizEnvio().then(x => (x && x.envios) || {})]); } catch (e) { /* sem quiz */ } }
  } catch (e) { alvo.innerHTML = cartao('Impacto', `<p class="erro">${esc(e.message)}</p>`); return; }
  finally { carregar(false); }
  linhas = linhas.filter(l => !USO_APP.test(l.peca));
  const nomes = {}, tipos = {};
  Object.keys(TIPOS).forEach(t => (ler(t) || []).forEach(x => { nomes[x.id] = TIPOS[t].titulo(x) || '(sem título)'; tipos[x.id] = { notificacoes: 'Aviso', destaques: 'Destaque', anuncios: 'Anúncio', publicacoes: 'Publicação', noticias: 'Notícia' }[t] || t; }));
  nomes.patreon = 'Patreon (barra por cima do menu)'; tipos.patreon = 'Patreon';
  (quiz || []).forEach(q => { nomes['quiz:' + q.id] = q.pergunta; tipos['quiz:' + q.id] = 'Quiz'; });
  const pecas = [...new Set(linhas.map(l => l.peca))].map(id => {
    const s = somar(linhas, id), quizP = id.startsWith('quiz:'), diretoP = id.startsWith('direto:');
    return { id, s, nome: nomes[id] || (diretoP ? 'Direto ' + id.slice(7) : id), tipo: tipos[id] || (diretoP ? 'Direto' : quizP ? 'Quiz' : 'Outro'), quiz: quizP, direto: diretoP };
  }).sort((a, b) => b.s.imp - a.s.imp);

  // Efeito nas aberturas: dia do evento contra a média dos 7 dias anteriores.
  const ab = {}; (d.diario || []).forEach(x => { ab[String(x.dia).slice(0, 10)] = Number(x.aberturas); });
  const efeito = dia => {
    const base = []; for (let i = 1; i <= 7; i++) { const t = new Date(dia + 'T12:00:00'); t.setDate(t.getDate() - i); const v = ab[diaISO(t)]; if (v != null) base.push(v); }
    if (base.length < 3 || ab[dia] == null) return null;
    const media = base.reduce((a, b) => a + b, 0) / base.length;
    return media ? Math.round(100 * (ab[dia] - media) / media) : null;
  };
  const eventos = [];
  const dia10 = v => (v ? String(v).slice(0, 10) : '');
  [['notificacoes', 'Aviso'], ['noticias', 'Notícia'], ['destaques', 'Destaque'], ['publicacoes', 'Publicação'], ['anuncios', 'Anúncio']].forEach(([t, nome]) =>
    (ler(t) || []).filter(x => x.estado === 'publicado' && x.ativo !== false).forEach(x => {
      const dia = dia10(x.de) || dia10(x.criado);
      if (dia && ab[dia] != null) eventos.push({ dia, tipo: nome, texto: TIPOS[t].titulo(x) || '(sem título)' });
    }));
  Object.entries(envios).forEach(([id, q]) => { const dia = dia10(q), p = (quiz || []).find(x => String(x.id) === String(id)); if (p && ab[dia] != null && new Date(q) < new Date()) eventos.push({ dia, tipo: 'Quiz', texto: p.pergunta }); });
  pecas.filter(p => p.direto).forEach(p => { const primeiro = linhas.filter(l => l.peca === p.id).map(l => String(l.dia).slice(0, 10)).sort()[0]; if (primeiro && ab[primeiro] != null) eventos.push({ dia: primeiro, tipo: 'Direto', texto: p.nome }); });
  eventos.sort((a, b) => b.dia.localeCompare(a.dia));
  const chip = p => p == null ? '<span class="pilula">—</span>' : `<span class="pilula ${p >= 15 ? 'ok' : p <= -15 ? 'mau' : ''}">${p > 0 ? '+' : ''}${p} %</span>`;

  alvo.innerHTML = (d.exemplo ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('O que foi visto e tocado', `<p class="suave">Quantas vezes cada peça foi vista, por quantas pessoas e quantas vezes foi tocada (ou, no quiz, respondida). Os anúncios, destaques e avisos já eram medidos; o quiz e os diretos passam a ser medidos com a versão nova da app.</p>
      <div style="margin:10px 0 14px">${[7, 30, 90].map(n => `<button class="botao pequeno ${n === IMPACTO_DIAS ? 'principal' : ''}" data-impacto="${n}">${n} dias</button>`).join(' ')}</div>
      <div class="tabela-rolar"><table class="tabela tabela-numeros"><tr><th>Peça</th><th>Tipo</th><th class="direita">Visualizações</th><th class="direita">Pessoas</th><th class="direita">${'Cliques / respostas'}</th><th class="direita">Taxa</th></tr>
      ${pecas.map(p => `<tr><td><b>${esc(String(p.nome).slice(0, 90))}</b></td><td><span class="pilula">${esc(p.tipo)}</span></td><td class="direita">${numero(p.s.imp)}</td><td class="direita">${numero(p.s.alc)}</td>
        <td class="direita">${numero(p.s.cli)}</td><td class="direita">${pct(p.s.cli, p.s.imp)}</td></tr>`).join('') || '<tr><td colspan="6"><p class="suave">Ainda não há peças medidas neste período.</p></td></tr>'}
      </table></div>`) +
    cartao('Efeito nos acessos à app', `<p class="suave">Compara as aberturas da app no dia de cada aviso, notícia, destaque, quiz ou direto com a média dos 7 dias anteriores. Um valor alto ajuda a perceber o que mexe com as pessoas, mas não prova a causa: um jogo nesse dia também faz subir.</p>
      ${eventos.length ? `<div class="linha-tempo">${eventos.slice(0, 40).map(e => `<div class="evento" style="grid-template-columns:78px 1fr auto;cursor:default">
        <span class="evento-hora" style="font-size:.8rem">${esc(dataDia(e.dia))}</span><span class="evento-txt"><b>${esc(String(e.texto).slice(0, 90))}</b><span>${esc(e.tipo)} · ${numero(ab[e.dia])} aberturas nesse dia</span></span>${chip(efeito(e.dia))}</div>`).join('')}</div>`
        : '<p class="suave">Ainda não há eventos com dados suficientes (a medição começa com a versão nova da app).</p>'}`);
  $$('[data-impacto]', alvo).forEach(b => b.addEventListener('click', () => { IMPACTO_DIAS = Number(b.dataset.impacto); abaImpacto(alvo); }));
}

/* ---------------------------- Idades e aniversários ---------------------------- */
function exemploIdades() {
  const hoje = new Date();
  const dia = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); return diaISO(d); };
  return {
    exemplo: true, com_data: 96, sem_data: 22, idade_media: 41.3, mais_novo: 14, mais_velho: 79,
    faixas: [
      { faixa: 'Menos de 18', contas: 4, participacoes: 31, jogos: 22, acertos: 4, quiz: 18, quiz_certas: 9, dias_ativos: 60 },
      { faixa: '18 a 24', contas: 11, participacoes: 120, jogos: 88, acertos: 12, quiz: 61, quiz_certas: 33, dias_ativos: 190 },
      { faixa: '25 a 34', contas: 22, participacoes: 310, jogos: 205, acertos: 31, quiz: 140, quiz_certas: 84, dias_ativos: 410 },
      { faixa: '35 a 44', contas: 27, participacoes: 402, jogos: 260, acertos: 41, quiz: 190, quiz_certas: 120, dias_ativos: 520 },
      { faixa: '45 a 54', contas: 19, participacoes: 266, jogos: 170, acertos: 30, quiz: 120, quiz_certas: 80, dias_ativos: 330 },
      { faixa: '55 a 64', contas: 9, participacoes: 98, jogos: 60, acertos: 11, quiz: 50, quiz_certas: 36, dias_ativos: 140 },
      { faixa: '65 ou mais', contas: 4, participacoes: 44, jogos: 25, acertos: 6, quiz: 22, quiz_certas: 17, dias_ativos: 70 }],
    aniversarios: [{ nome: 'Zé do Mocho', dia: dia(0), idade: 46, dias_ate: 0 }, { nome: 'Rita', dia: dia(3), idade: 31, dias_ate: 3 },
      { nome: 'Aguia75', dia: dia(12), idade: 28, dias_ate: 12 }, { nome: 'Manel', dia: dia(26), idade: 63, dias_ate: 26 }]
  };
}

async function abaIdades(alvo) {
  alvo.innerHTML = cartao('Idades e aniversários', '<p class="suave">A carregar…</p>');
  let d;
  try { carregar(true); d = CFG.modo === 'local' || !CFG.token ? exemploIdades() : await rpcAdmin('bi_admin_idades'); }
  catch (e) { alvo.innerHTML = cartao('Idades e aniversários', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-ranking.sql no Supabase.</p>`); return; }
  finally { carregar(false); }
  const faixas = d.faixas || [], totalContas = faixas.reduce((n, f) => n + Number(f.contas), 0) || 1;
  const hoje = (d.aniversarios || []).filter(a => a.dias_ate === 0), proximos = (d.aniversarios || []).filter(a => a.dias_ate > 0);
  alvo.innerHTML = (d.exemplo ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('Quantos anos têm os nossos adeptos', `<p class="suave">Só entram as contas que escreveram a data de nascimento (é opcional). As participações e acertos são desta época.</p>
      <div class="grelha">
        ${azulejo(numero(d.com_data), 'Contas com data de nascimento')}
        ${azulejo(numero(d.sem_data), 'Contas sem data')}
        ${azulejo(d.idade_media != null ? String(d.idade_media).replace('.', ',') : '—', 'Idade média')}
        ${azulejo(d.mais_novo != null ? numero(d.mais_novo) : '—', 'Mais novo (anos)')}
        ${azulejo(d.mais_velho != null ? numero(d.mais_velho) : '—', 'Mais velho (anos)')}
      </div>`) +
    cartao('Tabela por idade', `<div class="tabela-rolar"><table class="tabela tabela-numeros">
      <tr><th>Idade</th><th class="direita">Contas</th><th class="direita">% das contas</th><th class="direita">Participações / conta</th><th class="direita">Prognósticos certos</th><th class="direita">Quiz certo</th><th class="direita">Dias ativos / conta</th></tr>
      ${faixas.map(f => `<tr><td><b>${esc(f.faixa)}</b></td><td class="direita">${numero(f.contas)}</td><td class="direita">${pct(f.contas, totalContas)}</td>
        <td class="direita">${(f.participacoes / Math.max(1, f.contas)).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}</td>
        <td class="direita">${pct(f.acertos, f.jogos)} <span class="mini">(${numero(f.acertos)}/${numero(f.jogos)})</span></td>
        <td class="direita">${pct(f.quiz_certas, f.quiz)} <span class="mini">(${numero(f.quiz_certas)}/${numero(f.quiz)})</span></td>
        <td class="direita">${(f.dias_ativos / Math.max(1, f.contas)).toLocaleString('pt-PT', { maximumFractionDigits: 1 })}</td></tr>`).join('')
        || '<tr><td colspan="7"><p class="suave">Ainda ninguém escreveu a data de nascimento.</p></td></tr>'}
    </table></div>`) +
    cartao('Aniversários', `${hoje.length ? `<p style="margin:0 0 12px">🎂 <b>Faz anos hoje:</b> ${hoje.map(a => `${esc(a.nome)} (${a.idade} anos)`).join(', ')}.</p>` : ''}
      <p class="suave">Quem tem conta e escreveu a data recebe sozinho, <b>às 00h01 do dia de anos</b>, uma mensagem de parabéns da equipa do Benfica Independente (sem som, para não acordar ninguém). Aqui vês quem faz anos nos próximos 30 dias, se quiseres juntar uma publicação ou um aviso.</p>
      <div class="tabela-rolar"><table class="tabela"><tr><th>Dia</th><th>Aparece como</th><th class="direita">Idade que faz</th><th class="direita">Faltam</th></tr>
      ${(d.aniversarios || []).map(a => `<tr><td>${esc(dataDia(a.dia))}</td><td><b>${esc(a.nome)}</b></td><td class="direita">${numero(a.idade)}</td><td class="direita">${a.dias_ate === 0 ? '<span class="pilula ok">Hoje 🎂</span>' : a.dias_ate + (a.dias_ate === 1 ? ' dia' : ' dias')}</td></tr>`).join('')
        || '<tr><td colspan="4"><p class="suave">Ninguém faz anos nos próximos 30 dias.</p></td></tr>'}</table></div>`) +
    cartao('A mensagem que cada pessoa recebe', `<div class="mensagem" style="margin:0"><div class="mensagem-topo"><strong>🎂 Parabéns, João!</strong><span class="quando">00h01</span></div>
      <div>Hoje o dia é todo teu e, aqui no Benfica Independente, ninguém se esquece! Fazes 35 anos e ficamos mesmo contentes por te termos desse lado. Um abraço grande de toda a nossa equipa, e que venham muitas alegrias vermelhas. 🦅❤️</div></div>
      <p class="suave" style="margin-top:10px">Há quatro textos diferentes, que se alternam de ano para ano, sempre com o nome e a idade da pessoa. A mensagem fica guardada no telemóvel: não passa por nenhum servidor.</p>`);
}

/* ---------------------------- Evolução: gráficos ao longo do tempo ---------------------------- */
function linhaSvg(vals, rot, cor) {
  const W = 640, H = 150, n = vals.length, max = Math.max(1, ...vals), min = Math.min(...vals, 0);
  const x = i => (n === 1 ? W / 2 : i * (W - 8) / (n - 1) + 4), y = v => H - 8 - (v - min) / Math.max(1, max - min) * (H - 24);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const hover = vals.map((v, i) => `<rect x="${(x(i) - (W / n) / 2).toFixed(1)}" y="0" width="${(W / n).toFixed(1)}" height="${H}" fill="transparent"><title>${esc(rot[i])}: ${numero(Math.round(v * 10) / 10)}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto;display:block">
    <polygon points="${x(0)},${H - 8} ${pts} ${x(n - 1)},${H - 8}" fill="${cor}" opacity=".16"/>
    <polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${hover}
    <text x="0" y="${H + 14}" fill="#9aa4b2" font-size="11">${esc(rot[0])}</text><text x="${W}" y="${H + 14}" fill="#9aa4b2" font-size="11" text-anchor="end">${esc(rot[n - 1])}</text>
    <text x="${W}" y="12" fill="#9aa4b2" font-size="11" text-anchor="end">máx. ${numero(Math.round(max))}</text></svg>`;
}
function barrasSvg(vals, rot, cor) {
  const W = 640, H = 150, n = vals.length, max = Math.max(1, ...vals), bw = W / n;
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto;display:block">${vals.map((v, i) => { const h = v / max * (H - 16); return `<rect x="${(i * bw + 2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${cor}"><title>${esc(rot[i])}: ${numero(v)}</title></rect>`; }).join('')}
    <text x="0" y="${H + 14}" fill="#9aa4b2" font-size="11">${esc(rot[0])}</text><text x="${W}" y="${H + 14}" fill="#9aa4b2" font-size="11" text-anchor="end">${esc(rot[n - 1])}</text>
    <text x="${W}" y="12" fill="#9aa4b2" font-size="11" text-anchor="end">máx. ${numero(max)}</text></svg>`;
}
const acumular = (novos, totalHoje) => { const ini = totalHoje - novos.reduce((a, b) => a + b, 0); let s = ini; return novos.map(v => (s += v)); };
const porSemanas = (vals, dias) => { const out = [], r = []; for (let i = vals.length; i > 0; i -= 7) { const f = Math.max(0, i - 7); out.unshift(vals.slice(f, i).reduce((a, b) => a + b, 0)); r.unshift(dataDia(dias[f])); } return { v: out, r }; };
const variacao = (vals) => { if (vals.length < 2) return ''; const m = Math.floor(vals.length / 2), a = vals.slice(0, m).reduce((x, y) => x + y, 0), b = vals.slice(m).reduce((x, y) => x + y, 0); return a ? `${b >= a ? '+' : ''}${Math.round(100 * (b - a) / a)} % face à primeira metade do período` : ''; };

let EVO_DIAS = 90;
async function abaEvolucao(alvo) {
  alvo.innerHTML = cartao('Evolução', '<p class="suave">A carregar…</p>');
  let d;
  try { carregar(true); d = await lerParticipantes(); }
  catch (e) { alvo.innerHTML = cartao('Evolução', `<p class="erro">${esc(e.message)}</p>`); return; }
  finally { carregar(false); }
  const evo = (d.evolucao || []).slice(-EVO_DIAS), diario = (d.diario || []).slice(-EVO_DIAS);
  const dias = evo.map(x => x.dia), rot = dias.map(dataDia);
  const ab = diario.map(x => x.aberturas), ma7 = ab.map((_, i) => { const j = ab.slice(Math.max(0, i - 6), i + 1); return j.reduce((a, b) => a + b, 0) / j.length; });
  const todos = d.evolucao || [], idx = todos.length - evo.length;
  const dispAcum = acumular(todos.map(x => Number(x.novos)), Number(d.dispositivos_total)).slice(idx);
  const contasAcum = acumular(todos.map(x => Number(x.contas)), Number(d.contas)).slice(idx);
  const novosSem = porSemanas(evo.map(x => Number(x.novos)), dias), partSem = porSemanas(evo.map(x => Number(x.participacoes)), dias);
  const bloco = (titulo, sub, graf, nota) => cartao(titulo, `<p class="suave" style="margin-top:0">${sub}</p>${graf}${nota ? `<p class="suave" style="margin:8px 0 0">${nota}</p>` : ''}`);
  alvo.innerHTML = (d.exemplo ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    `<div style="margin-bottom:14px">${[30, 90, 180].map(n => `<button class="botao pequeno ${n === EVO_DIAS ? 'principal' : ''}" data-evo="${n}">${n} dias</button>`).join(' ')}</div>` +
    bloco('Aberturas da app por dia', 'A linha é a média dos últimos 7 dias, que tira o ruído de cada dia.', ab.length ? linhaSvg(ma7, diario.map(x => dataDia(x.dia)), '#ff3b4f') : '<p class="suave">Sem dados.</p>', variacao(ab)) +
    bloco('Dispositivos que já abriram a app', 'Total acumulado: só sobe (não sabemos quem desinstalou).', dispAcum.length ? linhaSvg(dispAcum, rot, '#4c8dff') : '<p class="suave">Sem dados.</p>', `${numero(dispAcum[dispAcum.length - 1] - dispAcum[0])} novos neste período.`) +
    bloco('Novos dispositivos por semana', 'Quantas instalações novas chegam em cada semana.', novosSem.v.length ? barrasSvg(novosSem.v, novosSem.r, '#d4202f') : '<p class="suave">Sem dados.</p>', variacao(novosSem.v)) +
    bloco('Contas registadas', 'Total acumulado de utilizadores com conta.', contasAcum.length ? linhaSvg(contasAcum, rot, '#2fbf71') : '<p class="suave">Sem dados.</p>', `${numero(contasAcum[contasAcum.length - 1] - contasAcum[0])} contas novas neste período.`) +
    bloco('Participações por semana', 'Votos nas sondagens e no MVP, respostas ao quiz e prognósticos de quem tem conta.', partSem.v.length ? barrasSvg(partSem.v, partSem.r, '#f0b429') : '<p class="suave">Sem dados.</p>', variacao(partSem.v));
  $$('[data-evo]', alvo).forEach(b => b.addEventListener('click', () => { EVO_DIAS = Number(b.dataset.evo); abaEvolucao(alvo); }));
}

/* ---------------------------- Calendário: clica num dia e vê as aberturas hora a hora ---------------------------- */
let CAL_MES = null, CAL_DIA = null;
const ACESSOS_CACHE = {};
async function lerAcessosPeriodo(de, ate) {
  const chave = de + '|' + ate;
  if (ACESSOS_CACHE[chave] && Date.now() - ACESSOS_CACHE[chave].em < 60000) return ACESSOS_CACHE[chave].v;
  let linhas;
  if (CFG.modo === 'local' || !CFG.token) {
    const perfil = [1, .6, .4, .3, .25, .3, .5, .9, 1.4, 1.5, 1.6, 1.7, 2.2, 2.0, 1.6, 1.5, 1.6, 1.8, 2.1, 2.6, 3.2, 3.6, 3.0, 1.8];
    linhas = []; let s = 5; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let t = new Date(de + 'T12:00:00'); diaISO(t) <= ate; t.setDate(t.getDate() + 1)) {
      const pico = rnd() < 0.12 ? 1 + Math.floor(rnd() * 12) : 0, hp = 9 + Math.floor(rnd() * 12);
      perfil.forEach((p, h) => linhas.push({ dia: diaISO(t), hora: h, n: Math.round(p * 9 * (0.7 + rnd() * 0.6) * (h === hp && pico ? 1 + pico / 3 : 1)) }));
    }
  } else linhas = await rpcAdmin('bi_admin_acessos_periodo', { p_de: de, p_ate: ate });
  const mapa = {}; linhas.forEach(x => { const k = String(x.dia).slice(0, 10); (mapa[k] = mapa[k] || Array(24).fill(0))[x.hora] = Number(x.n); });
  ACESSOS_CACHE[chave] = { v: mapa, em: Date.now() };
  return mapa;
}
/** Tudo o que foi publicado, enviado ou lançado, com dia e (quando se sabe) hora. */
function eventosComHora(quizEnvios, quiz) {
  const ev = [], lis = iso => { const s = new Date(iso); if (isNaN(s)) return null; const t = s.toLocaleString('sv-SE', { timeZone: 'Europe/Lisbon' }); return { dia: t.slice(0, 10), hora: Number(t.slice(11, 13)) }; };
  const nomes = { notificacoes: 'Aviso', noticias: 'Notícia', destaques: 'Destaque', publicacoes: 'Publicação', anuncios: 'Anúncio' };
  Object.keys(nomes).forEach(t => (ler(t) || []).filter(x => x.estado === 'publicado' && x.ativo !== false).forEach(x => {
    const texto = TIPOS[t].titulo(x) || '(sem título)';
    if (x.de && String(x.de).includes('T')) { const q = lis(x.de); if (q) ev.push(Object.assign({ tipo: nomes[t], texto }, q)); }
    else if (x.de) ev.push({ tipo: nomes[t], texto, dia: String(x.de).slice(0, 10), hora: null });
    else if (x.criado) { const q = lis(x.criado); if (q) ev.push(Object.assign({ tipo: nomes[t], texto }, q)); }
  }));
  Object.entries(quizEnvios || {}).forEach(([id, q]) => { const p = (quiz || []).find(x => String(x.id) === String(id)), z = lis(q); if (p && z) ev.push(Object.assign({ tipo: 'Quiz', texto: p.pergunta }, z)); });
  return ev;
}
const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

async function abaCalendario(alvo) {
  alvo.innerHTML = cartao('Calendário', '<p class="suave">A carregar…</p>');
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  if (!CAL_MES) CAL_MES = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12);
  if (!CAL_DIA) CAL_DIA = diaISO(hoje);
  const ini = new Date(CAL_MES), fimMes = new Date(CAL_MES.getFullYear(), CAL_MES.getMonth() + 1, 0, 12);
  const de = new Date(ini); de.setDate(de.getDate() - 28);
  let mapa, quiz = [], envios = {};
  try {
    carregar(true); mapa = await lerAcessosPeriodo(diaISO(de), diaISO(fimMes > hoje ? hoje : fimMes));
    if (CFG.modo !== 'local' && CFG.token) { try { [quiz, envios] = await Promise.all([lerQuizPublico(), lerQuizEnvio().then(x => (x && x.envios) || {})]); } catch (e) { /* sem quiz */ } }
  } catch (e) { alvo.innerHTML = cartao('Calendário', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-participantes.sql no Supabase.</p>`); return; }
  finally { carregar(false); }
  const eventos = eventosComHora(envios, quiz), temEv = {}; eventos.forEach(e => { temEv[e.dia] = true; });
  const total = k => (mapa[k] || []).reduce((a, b) => a + b, 0);
  const diasMes = []; for (let t = new Date(ini); t <= fimMes; t.setDate(t.getDate() + 1)) diasMes.push(diaISO(t));
  const max = Math.max(1, ...diasMes.map(total));
  const offset = (ini.getDay() + 6) % 7;
  const celulas = Array(offset).fill('<i class="cal-vazio"></i>').concat(diasMes.map(k => {
    const v = total(k), futuro = new Date(k + 'T12:00:00') > hoje;
    return `<button class="cal-dia ${k === CAL_DIA ? 'sel' : ''} ${futuro ? 'futuro' : ''}" data-cal="${k}" ${futuro ? 'disabled' : ''} style="--calor:${futuro ? 0 : (0.06 + 0.84 * v / max).toFixed(2)}">
      <span class="cal-num">${Number(k.slice(8))}</span><span class="cal-v">${futuro || !v ? '' : numero(v)}</span>${temEv[k] ? '<span class="cal-ponto" title="Houve publicações ou avisos"></span>' : ''}</button>`;
  }));
  // O dia escolhido, hora a hora, contra a média dos mesmos dias da semana anteriores
  const sel = mapa[CAL_DIA] || Array(24).fill(0), tSel = sel.reduce((a, b) => a + b, 0);
  const dSel = new Date(CAL_DIA + 'T12:00:00'), base = Array(24).fill(0), prev = [];
  for (let i = 1; i <= 4; i++) { const t = new Date(dSel); t.setDate(t.getDate() - 7 * i); const k = diaISO(t); if (mapa[k] && total(k)) prev.push(mapa[k]); }
  prev.forEach(a => a.forEach((v, h) => { base[h] += v / prev.length; }));
  const baseTot = base.reduce((a, b) => a + b, 0), evDia = eventos.filter(e => e.dia === CAL_DIA).sort((a, b) => (a.hora ?? -1) - (b.hora ?? -1));
  const dif = baseTot ? Math.round(100 * (tSel - baseTot) / baseTot) : null;
  const pico = sel.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v)[0];
  const W = 640, H = 170, bw = W / 24, mx = Math.max(1, ...sel, ...base);
  const svg = `<svg viewBox="0 0 ${W} ${H + 36}" style="width:100%;height:auto;display:block">
    ${sel.map((v, h) => { const a = v / mx * (H - 18); return `<rect x="${h * bw + 2}" y="${H - a}" width="${bw - 4}" height="${a}" rx="3" fill="${v > base[h] * 1.4 && v > 5 ? '#ff3b4f' : '#7a2a35'}"><title>${String(h).padStart(2, '0')}h: ${numero(v)} aberturas${base[h] ? ` (média habitual ${numero(Math.round(base[h]))})` : ''}</title></rect>`; }).join('')}
    ${prev.length ? `<polyline points="${base.map((v, h) => `${(h * bw + bw / 2).toFixed(1)},${(H - v / mx * (H - 18)).toFixed(1)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="2" opacity=".85" stroke-dasharray="5 4"/>` : ''}
    ${evDia.filter(e => e.hora != null).map(e => `<g><title>${String(e.hora).padStart(2, '0')}h · ${esc(e.tipo)}: ${esc(e.texto)}</title><circle cx="${e.hora * bw + bw / 2}" cy="${H + 10}" r="6" fill="#f0b429"/></g>`).join('')}
    ${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<text x="${h * bw + bw / 2}" y="${H + 30}" fill="#9aa4b2" font-size="11" text-anchor="middle">${h}h</text>`).join('')}</svg>`;
  const mesTxt = CAL_MES.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }), mes = mesTxt[0].toUpperCase() + mesTxt.slice(1);
  alvo.innerHTML = (CFG.modo === 'local' ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('Calendário de acessos', `<p class="suave">Cada dia mostra quantas vezes a app foi aberta (quanto mais vermelho, mais acessos). O ponto amarelo marca os dias em que houve uma publicação, aviso ou quiz. <b>Clica num dia</b> para o ver hora a hora.</p>
      <div class="cal-topo"><button class="botao pequeno" data-mes="-1">‹</button><b>${esc(mes)}</b><button class="botao pequeno" data-mes="1">›</button><button class="botao pequeno fantasma" data-mes="0">Hoje</button></div>
      <div class="cal-grelha">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(x => `<span class="cal-cab">${x}</span>`).join('')}${celulas.join('')}</div>`) +
    cartao(`${NOMES_DIA[dSel.getDay()][0].toUpperCase() + NOMES_DIA[dSel.getDay()].slice(1)}, ${dataDia(CAL_DIA)}`, `
      <div class="grelha" style="margin-bottom:14px">
        ${azulejo(numero(tSel), 'Aberturas neste dia')}
        ${azulejo(dif == null ? '—' : (dif > 0 ? '+' : '') + dif + ' %', `Face à média das últimas ${prev.length || 0} ${NOMES_DIA[dSel.getDay()]}s`)}
        ${azulejo(tSel && pico ? intervaloHora(pico.h) : '—', 'Hora de maior movimento')}
      </div>${tSel ? svg : '<p class="suave">Sem aberturas registadas neste dia.</p>'}
      ${prev.length ? '<p class="suave" style="margin:6px 0 0"><span style="color:#ff3b4f">■</span> hora acima do habitual &nbsp; <span style="color:#fff">┅</span> média das mesmas horas nas semanas anteriores &nbsp; <span style="color:#f0b429">●</span> publicação / aviso / quiz</p>' : ''}
      ${evDia.length ? `<h3 class="seccao-titulo">O que saiu neste dia</h3><div class="linha-tempo">${evDia.map(e => `<div class="evento" style="grid-template-columns:70px 1fr;cursor:default"><span class="evento-hora">${e.hora == null ? 'dia todo' : String(e.hora).padStart(2, '0') + 'h'}</span><span class="evento-txt"><b>${esc(String(e.texto).slice(0, 100))}</b><span>${esc(e.tipo)}${e.hora != null && sel[e.hora] ? ` · ${numero(sel[e.hora])} aberturas nessa hora` : ''}</span></span></div>`).join('')}</div>` : '<p class="suave" style="margin-top:12px">Nada publicado neste dia.</p>'}`);
  $$('[data-cal]', alvo).forEach(b => b.addEventListener('click', () => { CAL_DIA = b.dataset.cal; abaCalendario(alvo); }));
  $$('[data-mes]', alvo).forEach(b => b.addEventListener('click', () => {
    const n = Number(b.dataset.mes);
    CAL_MES = n === 0 ? new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12) : new Date(CAL_MES.getFullYear(), CAL_MES.getMonth() + n, 1, 12);
    if (n === 0) CAL_DIA = diaISO(hoje); else CAL_DIA = diaISO(new Date(CAL_MES.getFullYear(), CAL_MES.getMonth(), 1, 12));
    abaCalendario(alvo);
  }));
}

/* ---------------------------- Construir rankings: cruza as medidas como quiseres ---------------------------- */
const MEDIDAS = [
  ['participacoes', 'Participações'], ['sondagens', 'Sondagens'], ['mvp', 'MVP'], ['quiz_respostas', 'Quiz respondido'], ['quiz_certas', 'Quiz certo'],
  ['prognosticos', 'Prognósticos dados'], ['acertos_prog', 'Prognósticos certos'], ['dias_ativos', 'Dias ativos'], ['aberturas', 'Aberturas']];
const faixaDe = i => i == null ? 'Sem data' : i < 18 ? 'Menos de 18' : i < 25 ? '18 a 24' : i < 35 ? '25 a 34' : i < 45 ? '35 a 44' : i < 55 ? '45 a 54' : i < 65 ? '55 a 64' : '65 ou mais';
const PREDEFINICOES = {
  participativos: { nome: 'Mais participativos', ordem: 'participacoes', pesos: {} },
  quiz: { nome: 'Melhores no quiz', ordem: 'quiz_certas', pesos: {} },
  fieis: { nome: 'Mais fiéis (dias ativos)', ordem: 'dias_ativos', pesos: {} },
  prognosticos: { nome: 'Melhores prognosticadores', ordem: 'acertos_prog', pesos: {} },
  equilibrado: { nome: 'Pontuação equilibrada', ordem: 'pontuacao', pesos: { sondagens: 1, mvp: 1, quiz_respostas: 1, quiz_certas: 2, prognosticos: 1, acertos_prog: 3, dias_ativos: 0.5 } }
};
let RK = { periodo: 'epoca', pais: '', faixa: '', agrupar: 'pessoa', ordem: 'participacoes', pesos: {}, top: 25, media: false };

async function abaRankings(alvo) {
  alvo.innerHTML = cartao('Construir rankings', '<p class="suave">A carregar…</p>');
  let lista;
  try {
    carregar(true);
    if (CFG.modo === 'local' || !CFG.token) {
      let s = 3; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const paises = ['Portugal', 'Portugal', 'Portugal', 'Suíça', 'França', 'Reino Unido'];
      lista = Array.from({ length: 40 }, (_, i) => { const p = Math.floor(rnd() * 20), q = Math.floor(rnd() * 15), pr = Math.floor(rnd() * 12);
        return { nome: ['Zé do Mocho', 'Rita', 'Aguia75', 'Manel', 'Joana', 'Tó', 'Luís', 'Sofia'][i % 8] + (i > 7 ? ' ' + i : ''), nome_real: '', alcunha: '', associada: true, pais: paises[Math.floor(rnd() * paises.length)], localidade: ['Leiria', 'Lisboa', 'Genebra', 'Paris', 'Porto', 'Londres'][Math.floor(rnd() * 6)],
          idade: 16 + Math.floor(rnd() * 60), sondagens: p, mvp: Math.floor(rnd() * 8), quiz_respostas: q, quiz_certas: Math.floor(q * rnd()), prognosticos: pr, acertos_prog: Math.floor(pr * rnd() * 0.5),
          dias_ativos: Math.floor(rnd() * 90), aberturas: Math.floor(rnd() * 250), participacoes: 0 }; });
      lista.forEach(x => { x.participacoes = x.sondagens + x.mvp + x.quiz_respostas + x.prognosticos; });
    } else lista = ((await rpcAdmin('bi_admin_participacao_conta', { p_periodo: RK.periodo })).lista || []).filter(x => x.associada !== false);
  } catch (e) { alvo.innerHTML = cartao('Construir rankings', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-ranking.sql no Supabase.</p>`); return; }
  finally { carregar(false); }

  const paises = [...new Set(lista.map(x => x.pais).filter(Boolean))].sort(), faixas = ['Menos de 18', '18 a 24', '25 a 34', '35 a 44', '45 a 54', '55 a 64', '65 ou mais', 'Sem data'];
  let f = lista.filter(x => (!RK.pais || x.pais === RK.pais) && (!RK.faixa || faixaDe(x.idade) === RK.faixa));
  const chaveG = x => RK.agrupar === 'pais' ? (x.pais || 'Não indicado') : RK.agrupar === 'localidade' ? ((x.localidade || 'Não indicada') + (x.pais ? ' (' + x.pais + ')' : '')) : RK.agrupar === 'faixa' ? faixaDe(x.idade) : null;
  let linhas;
  if (RK.agrupar === 'pessoa') linhas = f.map(x => Object.assign({ rotulo: x.nome, extra: [x.localidade, x.pais].filter(Boolean).join(', '), contas: 1 }, ...MEDIDAS.map(([k]) => ({ [k]: Number(x[k] || 0) }))));
  else {
    const g = {};
    f.forEach(x => { const k = chaveG(x); const o = g[k] = g[k] || Object.assign({ rotulo: k, extra: '', contas: 0 }, ...MEDIDAS.map(([m]) => ({ [m]: 0 }))); o.contas++; MEDIDAS.forEach(([m]) => { o[m] += Number(x[m] || 0); }); });
    linhas = Object.values(g);
    if (RK.media) linhas.forEach(o => MEDIDAS.forEach(([m]) => { o[m] = Math.round(10 * o[m] / Math.max(1, o.contas)) / 10; }));
  }
  const pesos = RK.pesos || {}, temPesos = Object.values(pesos).some(v => Number(v));
  linhas.forEach(o => { o.pontuacao = Math.round(10 * MEDIDAS.reduce((n, [k]) => n + Number(pesos[k] || 0) * o[k], 0)) / 10; });
  const ordem = RK.ordem === 'pontuacao' && !temPesos ? 'participacoes' : RK.ordem;
  linhas.sort((a, b) => (b[ordem] - a[ordem]) || (b.participacoes - a.participacoes) || String(a.rotulo).localeCompare(b.rotulo));
  const mostrar = RK.top ? linhas.slice(0, RK.top) : linhas;
  const opts = (lst, atual) => lst.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(atual) ? 'selected' : ''}>${esc(n)}</option>`).join('');
  alvo.innerHTML = (CFG.modo === 'local' ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('Construir um ranking', `<p class="suave">Escolhe a quem queres olhar, como agrupar e por que medida ordenar. Podes também dar <b>pesos</b> a cada medida para criar a tua própria pontuação (por exemplo, valer 3 pontos cada prognóstico certo).</p>
      <div style="margin:4px 0 12px">${Object.keys(PREDEFINICOES).map(k => `<button class="botao pequeno" data-pre="${k}">${esc(PREDEFINICOES[k].nome)}</button>`).join(' ')}</div>
      <div class="rk-form formulario">
        <label>Período<select data-rk="periodo">${opts([['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['epoca', 'Esta época'], ['tudo', 'Desde sempre']], RK.periodo)}</select></label>
        <label>Agrupar por<select data-rk="agrupar">${opts([['pessoa', 'Cada pessoa'], ['pais', 'País'], ['localidade', 'Localidade'], ['faixa', 'Faixa etária']], RK.agrupar)}</select></label>
        <label>Só do país<select data-rk="pais">${opts([['', 'Todos']].concat(paises.map(p => [p, p])), RK.pais)}</select></label>
        <label>Só da idade<select data-rk="faixa">${opts([['', 'Todas']].concat(faixas.map(p => [p, p])), RK.faixa)}</select></label>
        <label>Ordenar por<select data-rk="ordem">${opts(MEDIDAS.concat([['pontuacao', 'A minha pontuação (pesos)']]), RK.ordem)}</select></label>
        <label>Mostrar<select data-rk="top">${opts([[10, 'Os 10 primeiros'], [25, 'Os 25 primeiros'], [50, 'Os 50 primeiros'], [0, 'Todos']], RK.top)}</select></label>
      </div>
      ${RK.agrupar !== 'pessoa' ? `<label class="rk-caixa"><input type="checkbox" data-rk-media ${RK.media ? 'checked' : ''}> Mostrar a média por conta (em vez do total do grupo)</label>` : ''}
      <details class="ajuda" ${temPesos ? 'open' : ''}><summary>A minha pontuação: pesos de cada medida</summary>
        <div class="rk-pesos">${MEDIDAS.map(([k, n]) => `<label>${esc(n)}<input type="number" step="0.5" min="0" data-peso="${k}" value="${pesos[k] ?? ''}" placeholder="0"></label>`).join('')}</div>
        <p class="suave" style="margin:8px 0 0">Pontuação = soma de (peso × valor) de cada medida. Deixa em branco o que não queres contar.</p></details>`,
      '<button class="botao pequeno" data-rk-csv>⬇ Exportar (Excel)</button>') +
    cartao(`Resultado · ${numero(linhas.length)} ${RK.agrupar === 'pessoa' ? 'pessoas' : 'grupos'}${RK.pais ? ' · ' + esc(RK.pais) : ''}${RK.faixa ? ' · ' + esc(RK.faixa) : ''}`, `<div class="tabela-rolar"><table class="tabela tabela-numeros">
      <tr><th>#</th><th>${{ pessoa: 'Pessoa', pais: 'País', localidade: 'Localidade', faixa: 'Idade' }[RK.agrupar]}</th>${RK.agrupar !== 'pessoa' ? '<th class="direita">Contas</th>' : ''}${temPesos ? `<th class="direita ${ordem === 'pontuacao' ? 'rk-ord' : ''}">Pontuação</th>` : ''}${MEDIDAS.map(([k, n]) => `<th class="direita ${ordem === k ? 'rk-ord' : ''}">${esc(n)}</th>`).join('')}</tr>
      ${mostrar.map((o, i) => `<tr><td><b>${i + 1}</b></td><td><b>${esc(o.rotulo)}</b>${o.extra ? `<div class="mini">${esc(o.extra)}</div>` : ''}</td>${RK.agrupar !== 'pessoa' ? `<td class="direita">${numero(o.contas)}</td>` : ''}${temPesos ? `<td class="direita"><b>${numero(o.pontuacao)}</b></td>` : ''}${MEDIDAS.map(([k]) => `<td class="direita ${ordem === k ? 'rk-ord' : ''}">${numero(o[k])}</td>`).join('')}</tr>`).join('')
        || `<tr><td colspan="14"><p class="suave">Nada com estes filtros.</p></td></tr>`}</table></div>`);
  $$('[data-rk]', alvo).forEach(s => s.addEventListener('change', () => { const k = s.dataset.rk; RK[k] = k === 'top' ? Number(s.value) : s.value; abaRankings(alvo); }));
  const cm = $('[data-rk-media]', alvo); if (cm) cm.addEventListener('change', () => { RK.media = cm.checked; abaRankings(alvo); });
  $$('[data-peso]', alvo).forEach(i => i.addEventListener('change', () => { RK.pesos = Object.assign({}, RK.pesos, { [i.dataset.peso]: i.value === '' ? 0 : Number(i.value) }); if (RK.ordem !== 'pontuacao' && Object.values(RK.pesos).some(v => v)) RK.ordem = 'pontuacao'; abaRankings(alvo); }));
  $$('[data-pre]', alvo).forEach(b => b.addEventListener('click', () => { const p = PREDEFINICOES[b.dataset.pre]; RK.ordem = p.ordem; RK.pesos = Object.assign({}, p.pesos); abaRankings(alvo); }));
  const csv = $('[data-rk-csv]', alvo);
  if (csv) csv.addEventListener('click', () => descarregarCsv(`ranking-${RK.agrupar}-${diaISO(new Date())}.csv`,
    [['#', 'Nome', 'Contas', 'Pontuação'].concat(MEDIDAS.map(m => m[1]))].concat(linhas.map((o, i) => [i + 1, o.rotulo, o.contas, o.pontuacao].concat(MEDIDAS.map(([k]) => o[k]))))));
}

/* ---------------------------- De onde nos veem: países, localidades e horas por país ---------------------------- */
/** Fuso horário do telemóvel → país (estimativa: quem viaja ou usa outro fuso conta onde o telemóvel está). */
const FUSO_PAIS = (() => {
  const m = {};
  const pais = (nome, ...fusos) => fusos.forEach(f => { m[f] = nome; });
  pais('Portugal', 'Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira');
  pais('Suíça', 'Europe/Zurich'); pais('França', 'Europe/Paris'); pais('Luxemburgo', 'Europe/Luxembourg'); pais('Alemanha', 'Europe/Berlin', 'Europe/Busingen');
  pais('Reino Unido', 'Europe/London'); pais('Espanha', 'Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta'); pais('Bélgica', 'Europe/Brussels');
  pais('Países Baixos', 'Europe/Amsterdam'); pais('Irlanda', 'Europe/Dublin'); pais('Itália', 'Europe/Rome'); pais('Áustria', 'Europe/Vienna');
  pais('Andorra', 'Europe/Andorra'); pais('Mónaco', 'Europe/Monaco'); pais('Liechtenstein', 'Europe/Vaduz'); pais('Suécia', 'Europe/Stockholm');
  pais('Noruega', 'Europe/Oslo'); pais('Dinamarca', 'Europe/Copenhagen'); pais('Finlândia', 'Europe/Helsinki'); pais('Polónia', 'Europe/Warsaw');
  pais('Chéquia', 'Europe/Prague'); pais('Grécia', 'Europe/Athens'); pais('Roménia', 'Europe/Bucharest'); pais('Ucrânia', 'Europe/Kiev', 'Europe/Kyiv');
  pais('Rússia', 'Europe/Moscow'); pais('Turquia', 'Europe/Istanbul'); pais('Hungria', 'Europe/Budapest'); pais('Bulgária', 'Europe/Sofia');
  pais('Croácia', 'Europe/Zagreb'); pais('Sérvia', 'Europe/Belgrade'); pais('Malta', 'Europe/Malta'); pais('Islândia', 'Atlantic/Reykjavik');
  pais('Angola', 'Africa/Luanda'); pais('Moçambique', 'Africa/Maputo'); pais('Cabo Verde', 'Atlantic/Cape_Verde'); pais('Guiné-Bissau', 'Africa/Bissau');
  pais('São Tomé e Príncipe', 'Africa/Sao_Tome'); pais('África do Sul', 'Africa/Johannesburg'); pais('Marrocos', 'Africa/Casablanca'); pais('Nigéria', 'Africa/Lagos');
  pais('Egito', 'Africa/Cairo'); pais('Argélia', 'Africa/Algiers'); pais('Tunísia', 'Africa/Tunis'); pais('Quénia', 'Africa/Nairobi'); pais('Senegal', 'Africa/Dakar');
  pais('Namíbia', 'Africa/Windhoek'); pais('Costa do Marfim', 'Africa/Abidjan'); pais('Gana', 'Africa/Accra');
  pais('Timor-Leste', 'Asia/Dili'); pais('Macau', 'Asia/Macau'); pais('Hong Kong', 'Asia/Hong_Kong'); pais('Emirados Árabes Unidos', 'Asia/Dubai');
  pais('Catar', 'Asia/Qatar'); pais('Arábia Saudita', 'Asia/Riyadh'); pais('Japão', 'Asia/Tokyo'); pais('China', 'Asia/Shanghai'); pais('Singapura', 'Asia/Singapore');
  pais('Índia', 'Asia/Kolkata', 'Asia/Calcutta'); pais('Israel', 'Asia/Jerusalem', 'Asia/Tel_Aviv'); pais('Tailândia', 'Asia/Bangkok'); pais('Indonésia', 'Asia/Jakarta');
  pais('Coreia do Sul', 'Asia/Seoul'); pais('Filipinas', 'Asia/Manila'); pais('Koweit', 'Asia/Kuwait'); pais('Barém', 'Asia/Bahrain');
  pais('Brasil', 'America/Sao_Paulo', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Manaus', 'America/Belem', 'America/Cuiaba',
    'America/Campo_Grande', 'America/Rio_Branco', 'America/Noronha', 'America/Maceio', 'America/Araguaina', 'America/Porto_Velho', 'America/Boa_Vista');
  pais('Estados Unidos', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
    'America/Detroit', 'America/Indiana/Indianapolis', 'Pacific/Honolulu', 'America/Boise');
  pais('Canadá', 'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns', 'America/Montreal');
  pais('México', 'America/Mexico_City', 'America/Cancun', 'America/Tijuana'); pais('Argentina', 'America/Argentina/Buenos_Aires', 'America/Buenos_Aires');
  pais('Venezuela', 'America/Caracas'); pais('Colômbia', 'America/Bogota'); pais('Peru', 'America/Lima'); pais('Chile', 'America/Santiago');
  pais('Uruguai', 'America/Montevideo'); pais('Panamá', 'America/Panama'); pais('Austrália', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Brisbane', 'Australia/Adelaide');
  pais('Nova Zelândia', 'Pacific/Auckland');
  return m;
})();
const paisDoFuso = f => FUSO_PAIS[f] || (!f || f === 'desconhecido' || /^(UTC|GMT|Etc\/)/.test(f) ? 'Não identificado' : 'Outro (' + f + ')');
const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let ORIGEM_PAIS = '';
async function abaOrigem(alvo) {
  alvo.innerHTML = cartao('De onde nos veem', '<p class="suave">A carregar…</p>');
  let d, contas = [];
  try {
    carregar(true); d = await lerParticipantes();
    if (CFG.modo !== 'local' && CFG.token) { try { contas = (await rpcAdmin('bi_admin_participacao_conta', { p_periodo: 'tudo' })).lista || []; } catch (e) { /* sem contas */ } }
  } catch (e) { alvo.innerHTML = cartao('De onde nos veem', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr os ficheiros supabase-ranking.sql e supabase-participantes.sql no Supabase.</p>`); return; }
  finally { carregar(false); }

  // Países estimados pelo fuso horário do telemóvel (todos os dispositivos)
  const porPais = {};
  (d.fusos || []).forEach(f => { const p = paisDoFuso(f.fuso); const x = porPais[p] = porPais[p] || { pais: p, total: 0, ativos: 0, fusos: [] }; x.total += Number(f.total); x.ativos += Number(f.ativos_30d); x.fusos.push(f.fuso); });
  const paises = Object.values(porPais).sort((a, b) => b.total - a.total);
  const totalDisp = paises.reduce((n, p) => n + p.total, 0) || 1;
  const identificados = paises.filter(p => p.pais !== 'Não identificado' && !p.pais.startsWith('Outro'));
  // Países escritos pelas contas
  const declarados = (d.paises_contas || []).filter(p => p.pais !== 'Não indicado');
  const nDeclarados = {}; declarados.forEach(p => { nDeclarados[semAcento(p.pais)] = p.n; });
  const contasDe = nome => nDeclarados[semAcento(nome)] || 0;
  if (!ORIGEM_PAIS || !porPais[ORIGEM_PAIS]) ORIGEM_PAIS = (identificados[0] || paises[0] || {}).pais || '';
  const sel = porPais[ORIGEM_PAIS];
  const fusosSel = new Set(sel ? sel.fusos : []);
  const horas = Array(24).fill(0);
  (d.horas_fuso || []).filter(x => fusosSel.has(x.fuso)).forEach(x => { horas[x.hora] += Number(x.n); });
  const totH = horas.reduce((a, b) => a + b, 0);
  const rank = horas.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v).slice(0, 3).filter(x => x.v > 0);
  const contasPais = contas.filter(c => semAcento(c.pais) === semAcento(ORIGEM_PAIS)).sort((a, b) => b.participacoes - a.participacoes);

  alvo.innerHTML = (d.exemplo ? '<p class="aviso mau" style="margin:0 0 14px">Modo de teste: os números são de exemplo.</p>' : '') +
    cartao('Em quantos países estamos', `<p class="suave">O país é uma <b>estimativa</b> feita pelo fuso horário do telemóvel (por exemplo, "Europe/Zurich" = Suíça), por isso conta todos os dispositivos, mesmo sem conta. Quem viaja pode contar no país onde está. As contas registadas dizem de onde nos veem, por escrito.</p>
      <div class="grelha">
        ${azulejo(numero(identificados.length), 'Países (estimados, todos os dispositivos)')}
        ${azulejo(numero(declarados.length), 'Países indicados pelas contas')}
        ${azulejo(identificados[0] ? esc(identificados[0].pais) : '—', 'País com mais dispositivos')}
        ${azulejo(pct(totalDisp - (porPais['Portugal'] || { total: 0 }).total, totalDisp), 'Fora de Portugal')}
      </div>`) +
    cartao('Ranking de países', `<div class="tabela-rolar"><table class="tabela tabela-numeros">
      <tr><th>#</th><th>País</th><th class="direita">Dispositivos</th><th class="direita">Ativos (30 dias)</th><th class="direita">% do total</th><th class="direita">Contas que o indicam</th></tr>
      ${paises.map((p, i) => `<tr><td>${i + 1}</td><td><b>${esc(p.pais)}</b></td><td class="direita">${numero(p.total)}</td><td class="direita">${numero(p.ativos)}</td>
        <td class="direita">${pct(p.total, totalDisp)}</td><td class="direita">${contasDe(p.pais) ? numero(contasDe(p.pais)) : '—'}</td></tr>`).join('') || '<tr><td colspan="6"><p class="suave">Ainda sem dados (a medição começa com a versão nova da app).</p></td></tr>'}
      </table></div>`) +
    cartao('Cruzar: horas de acesso por país', `<p class="suave">Escolhe um país e vê a que horas os seus utilizadores mais abrem a app (últimos 90 dias, <b>hora de Portugal</b>).</p>
      <label class="formulario" style="display:block;max-width:320px"><select data-pais style="width:100%">${paises.filter(p => p.pais !== 'Não identificado').map(p => `<option value="${esc(p.pais)}" ${p.pais === ORIGEM_PAIS ? 'selected' : ''}>${esc(p.pais)} (${numero(p.total)})</option>`).join('')}</select></label>
      <div style="margin-top:14px">${totH ? barrasHoras(horas) : '<p class="suave">Ainda sem aberturas deste país.</p>'}</div>
      ${rank.length ? `<p style="margin:10px 0 0">💡 <b>${esc(ORIGEM_PAIS)}</b>: mais movimento às ${rank.map(x => `<b>${intervaloHora(x.h)}</b>`).join(', ')} (hora de Portugal).</p>` : ''}`) +
    cartao('Localidades das contas', `<div class="tabela-rolar"><table class="tabela tabela-numeros"><tr><th>#</th><th>Localidade</th><th>País</th><th class="direita">Contas</th></tr>
      ${(d.localidades_contas || []).slice(0, 25).map((l, i) => `<tr><td>${i + 1}</td><td><b>${esc(l.localidade)}</b></td><td>${esc(l.pais)}</td><td class="direita">${numero(l.n)}</td></tr>`).join('')
        || '<tr><td colspan="4"><p class="suave">Ainda ninguém indicou a localidade.</p></td></tr>'}</table></div>`) +
    (contasPais.length ? cartao('Quem participa mais — ' + ORIGEM_PAIS, `<div class="tabela-rolar"><table class="tabela tabela-numeros">
      <tr><th>Aparece como</th><th>Localidade</th><th class="direita">Participações</th><th class="direita">Dias ativos</th><th class="direita">Aberturas</th></tr>
      ${contasPais.slice(0, 15).map(c => `<tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.localidade || '—')}</td><td class="direita">${numero(c.participacoes)}</td><td class="direita">${numero(c.dias_ativos)}</td><td class="direita">${numero(c.aberturas)}</td></tr>`).join('')}</table></div>`) : '');
  const s = $('[data-pais]', alvo);
  if (s) s.addEventListener('change', () => { ORIGEM_PAIS = s.value; abaOrigem(alvo); });
}
