/* =========================================================================
   Plataforma · Benfica Independente
   Gestão da app (HTML/JS puro, sem dependências, instalável como PWA).

   Onde fica cada coisa:
   - benfica-independente-dados (público): o que a app lê — destaques, anúncios,
     publicações, notícias, avisos, versão e a lista de administradores (só nomes
     de utilizador do GitHub, nada de emails).
   - benfica-independente-gestao (privado, opcional): o que não pode ser público —
     contactos e valores dos anunciantes e números da monetização.

   Regra das duas aprovações: tudo o que se cria, altera ou apaga fica pendente
   até dois administradores diferentes aprovarem. A app só mostra o que está
   "publicado"; uma alteração pendente a algo já publicado não muda a app.
   ========================================================================= */
'use strict';

/* ----------------------------- Constantes ----------------------------- */
const CHAVE_CONFIG = 'bi.plataforma.v2';
const PREFIXO_LOCAL = 'bi.local.';
const DONO_PADRAO = 'JoaoRebola';
const REPO_PADRAO = 'benfica-independente-dados';
const REPO_PRIVADO_PADRAO = 'benfica-independente-gestao';
const RAMO_PADRAO = 'main';
const PASTA = 'data/';
const APROVACOES = 2;

/** Ficheiros públicos (a app lê-os). */
const FICHEIROS = {
  noticias: 'noticias.json',
  destaques: 'destaques.json',
  anuncios: 'anuncios.json',
  publicacoes: 'publicacoes.json',
  notificacoes: 'notificacoes.json',
  versao: 'versao.json',
  admins: 'admins.json',
  videos: 'videos.json',
  status: 'status.json'
};
/** Ficheiros privados (só a plataforma os lê). */
const PRIVADOS = {
  anunciantes: 'anunciantes.json',
  monetizacao: 'monetizacao.json'
};

/** Ecrãs da app onde se pode pôr uma publicação (iguais aos da app). */
const POSICOES = [
  ['inicio', 'Início'],
  ['artigos', 'Artigos'],
  ['podcasts', 'Podcasts'],
  ['videos', 'Vídeos'],
  ['benfica', 'Benfica'],
  ['jogos', 'Agenda e resultados'],
  ['sempre', 'Em todos estes ecrãs']
];

/* ------------------------------- Estado ------------------------------- */
let CFG = {
  token: '', login: '', nome: '',
  owner: DONO_PADRAO, repo: REPO_PADRAO, repoPrivado: REPO_PRIVADO_PADRAO, branch: RAMO_PADRAO,
  modo: 'github'
};
const DADOS = {};
const SHAS = {};
let PRIVADO_OK = null;   // null = ainda não sei; true/false depois de tentar
let RUNS = null;         // últimas execuções do robô (GitHub Actions)
let ECRAS = [];
let ECRAS_ATIVO = 'painel';

/* ------------------------------- Utilitários ------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function b64enc(s) { return btoa(unescape(encodeURIComponent(s))); }
function b64dec(s) { return decodeURIComponent(escape(atob(String(s).replace(/\s/g, '')))); }
function agoraISO() { return new Date().toISOString(); }
function dataCurta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function dataDia(txt) {
  if (!txt) return '';
  const [a, m, d] = String(txt).slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : String(txt);
}
function idNovo() { return 'bi-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function urlSegura(u) { return /^https:\/\//i.test(String(u || '').trim()); }
function carregar(mostrar) { $('#carregando').classList.toggle('escondido', !mostrar); }

let avisoTemporizador = null;
function aviso(texto, mau) {
  const caixa = $('#aviso');
  caixa.textContent = texto;
  caixa.classList.toggle('mau', !!mau);
  caixa.classList.remove('escondido');
  clearTimeout(avisoTemporizador);
  avisoTemporizador = setTimeout(() => caixa.classList.add('escondido'), 6000);
}

/* --------------------------- Acesso ao GitHub --------------------------- */
function cabecalhos(json) {
  const h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (CFG.token) h['Authorization'] = 'Bearer ' + CFG.token;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
function urlConteudo(repo, nome) {
  return `https://api.github.com/repos/${CFG.owner}/${repo}/contents/${PASTA}${nome}`;
}

/** Lê um ficheiro JSON. Devolve null se não existir. */
async function lerFicheiro(repo, nome) {
  if (CFG.modo === 'local') {
    const bruto = localStorage.getItem(PREFIXO_LOCAL + repo + '/' + nome);
    return bruto ? JSON.parse(bruto) : null;
  }
  const r = await fetch(`${urlConteudo(repo, nome)}?ref=${encodeURIComponent(CFG.branch)}&t=${Date.now()}`,
    { headers: cabecalhos(), cache: 'no-store' });
  if (r.status === 404) { delete SHAS[repo + '/' + nome]; return null; }
  if (!r.ok) throw new Error('GitHub ' + r.status + (r.status === 401 ? ' — chave inválida ou expirada.' : ''));
  const j = await r.json();
  SHAS[repo + '/' + nome] = j.sha;
  const texto = j.content ? b64dec(j.content) : '';
  return texto ? JSON.parse(texto) : null;
}

/** Escreve (cria ou substitui) um ficheiro JSON. */
async function escreverFicheiro(repo, nome, valor, mensagem) {
  const texto = JSON.stringify(valor, null, 2) + '\n';
  if (CFG.modo === 'local') { localStorage.setItem(PREFIXO_LOCAL + repo + '/' + nome, texto); return; }
  const chave = repo + '/' + nome;
  const corpo = { message: mensagem || `Plataforma: atualiza ${nome}`, content: b64enc(texto), branch: CFG.branch };
  if (SHAS[chave]) corpo.sha = SHAS[chave];
  const r = await fetch(urlConteudo(repo, nome), { method: 'PUT', headers: cabecalhos(true), body: JSON.stringify(corpo) });
  if (r.status === 409 || r.status === 422) {
    const e = new Error('conflito'); e.conflito = true; throw e;
  }
  if (!r.ok) {
    const detalhe = await r.text();
    throw new Error('Não foi possível gravar ' + nome + ' (GitHub ' + r.status + '). ' + detalhe.slice(0, 160));
  }
  const j = await r.json();
  SHAS[chave] = j.content && j.content.sha;
}

/* Valor por omissão de cada ficheiro. */
function vazio(nome) {
  switch (nome) {
    case 'admins': return { donos: [], admins: [] };
    case 'versao': return { versao: '', codigo: 0, notas: '', apk: '', obrigatoria: false, atualizado: '' };
    case 'monetizacao': return { atualizado: '', receitaTotal: 0, impressoes: 0, cliques: 0, anuncios: [] };
    case 'videos': case 'status': case 'anunciantes': return {};
    default: return [];
  }
}
function ler(nome) { return DADOS[nome] != null ? DADOS[nome] : (DADOS[nome] = vazio(nome)); }
function repoDe(nome) { return PRIVADOS[nome] ? CFG.repoPrivado : CFG.repo; }
function ficheiroDe(nome) { return PRIVADOS[nome] || FICHEIROS[nome]; }

/**
 * Altera um ficheiro de forma segura: volta a ler a versão mais recente do GitHub,
 * aplica a alteração e grava. Se outra pessoa gravou ao mesmo tempo, tenta outra vez.
 * `alterar(valor)` recebe o conteúdo atual e devolve false para cancelar.
 */
async function alterarFicheiro(nome, alterar, mensagem) {
  if (PRIVADOS[nome] && CFG.modo !== 'local' && PRIVADO_OK === false) {
    aviso('Falta o repositório privado "' + CFG.repoPrivado + '" (ver Definições).', true);
    return false;
  }
  carregar(true);
  try {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      let valor = await lerFicheiro(repoDe(nome), ficheiroDe(nome));
      if (valor == null) valor = vazio(nome);
      if (alterar(valor) === false) { DADOS[nome] = valor; return false; }
      try {
        await escreverFicheiro(repoDe(nome), ficheiroDe(nome), valor, mensagem);
        DADOS[nome] = valor;
        return true;
      } catch (e) {
        if (!e.conflito) throw e;
      }
    }
    throw new Error('Outra pessoa está a alterar o mesmo ao mesmo tempo. Tenta outra vez daqui a pouco.');
  } catch (e) {
    aviso(e.message, true);
    return false;
  } finally {
    carregar(false);
  }
}

/* ---------------------------- Quem sou eu ---------------------------- */
function admins() { const a = ler('admins'); return { donos: a.donos || [], admins: a.admins || [] }; }
function souDono() { return CFG.modo === 'local' || admins().donos.includes(CFG.login); }
function souAdmin() { const a = admins(); return CFG.modo === 'local' || a.donos.includes(CFG.login) || a.admins.includes(CFG.login); }
function totalAdmins() { const a = admins(); return new Set([...a.donos, ...a.admins]).size; }

/* ---------------------------- Sessão / entrada ---------------------------- */
function guardarConfig() { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(CFG)); }
function lerConfig() {
  try { const b = localStorage.getItem(CHAVE_CONFIG); if (b) CFG = Object.assign(CFG, JSON.parse(b)); } catch (e) { /* ignora */ }
}
function mostraErroEntrada(texto) { $('#entrar-erro').textContent = texto || ''; }

async function confirmarChave(token) {
  const r = await fetch('https://api.github.com/user', { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' } });
  if (r.status === 401) throw new Error('Chave inválida ou expirada. Cria uma nova no GitHub.');
  if (!r.ok) throw new Error('GitHub respondeu ' + r.status + '.');
  return r.json();
}

async function entrarComGitHub() {
  const token = $('#entrar-token').value.trim();
  if (!token) { mostraErroEntrada('Cola a tua chave de acesso (GitHub).'); return; }
  mostraErroEntrada('');
  carregar(true);
  try {
    const u = await confirmarChave(token);
    CFG = Object.assign(CFG, { token, login: u.login, nome: u.name || u.login, modo: 'github' });
    guardarConfig();
    await abrirApp();
  } catch (e) {
    mostraErroEntrada(e.message || 'Não foi possível entrar.');
  } finally {
    carregar(false);
  }
}

async function entrarLocal() {
  CFG = Object.assign(CFG, { token: '', login: 'teste', nome: 'Modo de teste', modo: 'local' });
  guardarConfig();
  await abrirApp();
}

function sair() { localStorage.removeItem(CHAVE_CONFIG); location.reload(); }

/* ------------------------------ Estrutura da UI ------------------------------ */
function montaMenu() {
  $('#menu').innerHTML = ECRAS.filter(e => !e.soDono || souDono()).map(e => {
    const conta = marcaDoMenu(e.chave);
    return `<a data-ecra="${e.chave}" class="${e.chave === ECRAS_ATIVO ? 'ativo' : ''}">
      <span class="icone">${e.icone}</span><span>${esc(e.nome)}</span>
      ${conta ? `<span class="marca">${conta}</span>` : ''}
    </a>`;
  }).join('');
  $$('#menu a').forEach(a => a.addEventListener('click', () => {
    ECRAS_ATIVO = a.dataset.ecra;
    CONVERSA_ABERTA = null;
    $('.barra').classList.remove('aberta');
    montaMenu();
    desenharEcra();
  }));
}

/** Quantas coisas neste ecrã esperam pela minha aprovação. */
function porAprovarPorMim(tipo) {
  return (ler(tipo) || []).filter(x => precisaDeMim(x)).length;
}
function marcaDoMenu(chave) {
  if (TIPOS[chave]) return porAprovarPorMim(chave) || '';
  if (chave === 'painel') return alertas().filter(a => a.mau).length || '';
  if (chave === 'mensagens') return MSG_NOVAS || '';
  return '';
}

function desenharEcra() {
  const ecra = ECRAS.find(e => e.chave === ECRAS_ATIVO) || ECRAS[0];
  $('#titulo-ecra').textContent = ecra.nome;
  const alvo = document.createElement('div');
  alvo.id = 'ecra';
  alvo.className = 'ecra';
  $('#ecra').replaceWith(alvo);
  try {
    if (!souAdmin() && ecra.chave !== 'definicoes') {
      alvo.innerHTML = cartao('Sem acesso',
        `<p>A tua conta GitHub <b>${esc(CFG.login)}</b> ainda não está na lista de administradores.</p>
         <p class="suave">Pede ao dono (${esc(CFG.owner)}) para te acrescentar em <b>Administradores</b>.</p>`);
      return;
    }
    ecra.desenhar(alvo);
  } catch (e) {
    alvo.innerHTML = cartao('', `<p class="erro">Erro ao desenhar o ecrã: ${esc(e.message)}</p>`);
  }
}
function redesenhar() { montaMenu(); desenharEcra(); }

/* --------------------------- Componentes --------------------------- */
function cartao(titulo, corpoHtml, acoesHtml) {
  return `<section class="cartao">
    ${titulo || acoesHtml ? `<header><h3>${esc(titulo || '')}</h3><div class="acoes">${acoesHtml || ''}</div></header>` : ''}
    <div class="cartao-corpo">${corpoHtml}</div>
  </section>`;
}
function azulejo(numero, rotulo) {
  return `<div class="azulejo"><div class="num">${esc(numero)}</div><div class="rot">${esc(rotulo)}</div></div>`;
}

/** Formulário em modal. Devolve Promise com os valores, ou null se cancelar. */
function formulario(titulo, campos, valores, opcoes) {
  opcoes = opcoes || {};
  valores = valores || {};
  return new Promise(resolve => {
    const fundo = document.createElement('div');
    fundo.className = 'fundo-modal';
    fundo.innerHTML = `<div class="modal">
      <header><h3>${esc(titulo)}</h3></header>
      <div class="modal-corpo formulario">${opcoes.nota ? `<p class="suave">${opcoes.nota}</p>` : ''}${campos.map(c => campoHtml(c, valores[c.nome])).join('')}</div>
      <div class="modal-pe">
        <button class="botao" data-cancelar>Cancelar</button>
        <button class="botao principal" data-guardar>${esc(opcoes.textoGuardar || 'Guardar')}</button>
      </div>
    </div>`;
    document.body.appendChild(fundo);
    const fechar = r => { fundo.remove(); resolve(r); };
    $('[data-cancelar]', fundo).addEventListener('click', () => fechar(null));
    $('[data-guardar]', fundo).addEventListener('click', () => {
      const saida = {};
      for (const c of campos) {
        const el = $(`[name="${c.nome}"]`, fundo);
        if (c.tipo === 'checkbox' && c.varios) saida[c.nome] = $$(`[name="${c.nome}"]:checked`, fundo).map(x => x.value);
        else if (c.tipo === 'checkbox') saida[c.nome] = el.checked;
        else if (c.tipo === 'number') saida[c.nome] = el.value === '' ? 0 : Number(el.value);
        else saida[c.nome] = el.value.trim();
      }
      fechar(saida);
    });
  });
}
function campoHtml(c, valor) {
  const v = valor != null ? valor : (c.valor != null ? c.valor : '');
  const nome = esc(c.nome);
  if (c.tipo === 'checkbox' && c.varios) {
    const marcados = Array.isArray(v) ? v : [];
    return `<div class="campo"><span class="rotulo">${esc(c.etiqueta)}</span>
      <div class="grupo-caixas">${(c.opcoes || []).map(o =>
        `<label><input type="checkbox" name="${nome}" value="${esc(o[0])}" ${marcados.includes(o[0]) ? 'checked' : ''}> ${esc(o[1])}</label>`).join('')}</div></div>`;
  }
  if (c.tipo === 'checkbox') {
    return `<div class="campo"><span class="rotulo">${esc(c.etiqueta)}</span>
      <div class="grupo-caixas"><label><input type="checkbox" name="${nome}" ${v ? 'checked' : ''}> ${esc(c.ajuda || 'Sim')}</label></div></div>`;
  }
  let controlo;
  if (c.tipo === 'textarea') controlo = `<textarea name="${nome}" placeholder="${esc(c.dica || '')}">${esc(v)}</textarea>`;
  else if (c.tipo === 'select') controlo = `<select name="${nome}">${(c.opcoes || []).map(o =>
    `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  else controlo = `<input type="${esc(c.tipo || 'text')}" name="${nome}" value="${esc(v)}" placeholder="${esc(c.dica || '')}"${c.min != null ? ` min="${c.min}"` : ''}${c.max != null ? ` max="${c.max}"` : ''}>`;
  return `<label>${esc(c.etiqueta)}${controlo}${c.ajuda ? `<span class="suave">${esc(c.ajuda)}</span>` : ''}</label>`;
}

/* ===================== Conteúdos com aprovação de 2 administradores ===================== */
const DATAS = [
  { nome: 'de', etiqueta: 'Começa em (opcional)', tipo: 'date' },
  { nome: 'ate', etiqueta: 'Termina em (opcional)', tipo: 'date' }
];
const ATIVO = { nome: 'ativo', etiqueta: 'Ativo', tipo: 'checkbox', ajuda: 'Mostrar na app', valor: true };
const IMAGEM_AJUDA = 'Endereço https:// de uma imagem já publicada na internet (ex.: do site ou do Instagram do BI).';

const TIPOS = {
  noticias: {
    nome: 'Notícias', singular: 'notícia', icone: '📰',
    descricao: 'Notícias escritas pelo Benfica Independente. Aparecem no topo do separador <b>Artigos</b> da app.',
    titulo: x => x.titulo, resumo: x => x.resumo || x.texto,
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'resumo', etiqueta: 'Resumo (aparece na lista)', tipo: 'textarea' },
      { nome: 'texto', etiqueta: 'Texto completo (abre ao tocar)', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Imagem (opcional)', tipo: 'url', dica: 'https://...', ajuda: IMAGEM_AJUDA },
      { nome: 'link', etiqueta: 'Ligação (opcional)', tipo: 'url', dica: 'https://...' },
      { nome: 'assinatura', etiqueta: 'Assinatura', tipo: 'text', dica: 'Ex.: Redação BI' },
      ATIVO
    ],
    valido: v => v.titulo ? '' : 'A notícia precisa de um título.'
  },
  destaques: {
    nome: 'Destaques', singular: 'destaque', icone: '★',
    descricao: 'Cartão grande no topo do <b>Início</b>: substitui o "Quem somos" entre as datas escolhidas (eventos e atividades).',
    titulo: x => x.titulo, resumo: x => x.texto,
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'texto', etiqueta: 'Texto (2 ou 3 linhas)', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Foto (opcional — sem foto ficam as fotos do estádio)', tipo: 'url', dica: 'https://...', ajuda: IMAGEM_AJUDA },
      { nome: 'link', etiqueta: 'Ligação do botão (opcional)', tipo: 'url', dica: 'https://...' },
      { nome: 'botao', etiqueta: 'Texto do botão', tipo: 'text', dica: 'Saber mais' },
      ...DATAS, ATIVO
    ],
    valido: v => v.titulo ? '' : 'O destaque precisa de um título.'
  },
  anuncios: {
    nome: 'Anúncios', singular: 'anúncio', icone: '💰',
    descricao: 'Publicidade paga na barra por cima do menu da app. Alterna com o Patreon de 5 em 5 segundos.',
    titulo: x => x.texto, resumo: x => x.link,
    campos: [
      { nome: 'texto', etiqueta: 'Texto do anúncio (curto)', tipo: 'text', dica: 'Ex.: Restaurante O Águia — 10% para sócios' },
      { nome: 'imagem', etiqueta: 'Logótipo (opcional)', tipo: 'url', dica: 'https://...', ajuda: IMAGEM_AJUDA },
      { nome: 'link', etiqueta: 'Para onde leva ao tocar', tipo: 'url', dica: 'https://...' },
      { nome: 'peso', etiqueta: 'Frequência (1 a 5)', tipo: 'number', valor: 1, min: 1, max: 5, ajuda: '1 = normal, 2 = aparece o dobro das vezes' },
      ...DATAS, ATIVO
    ],
    privados: [
      { nome: 'contacto', etiqueta: 'Contacto do anunciante (privado)', tipo: 'text' },
      { nome: 'valor', etiqueta: 'Valor pago em € (privado)', tipo: 'number', valor: 0 },
      { nome: 'notas', etiqueta: 'Notas internas (privado)', tipo: 'textarea' }
    ],
    valido: v => !v.texto ? 'O anúncio precisa de um texto.' : (v.link && !urlSegura(v.link) ? 'A ligação tem de começar por https://' : '')
  },
  publicacoes: {
    nome: 'Publicações', singular: 'publicação', icone: '🖼',
    descricao: 'Foto e/ou texto em cartão, no ecrã da app que escolheres.',
    titulo: x => x.titulo || '(sem título)', resumo: x => (x.posicoes || []).map(rotuloPosicao).join(', ') + ' · ' + (x.texto || ''),
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'texto', etiqueta: 'Texto', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Foto (opcional)', tipo: 'url', dica: 'https://...', ajuda: IMAGEM_AJUDA },
      { nome: 'link', etiqueta: 'Ligação do botão (opcional)', tipo: 'url', dica: 'https://...' },
      { nome: 'botao', etiqueta: 'Texto do botão', tipo: 'text', dica: 'Saber mais' },
      { nome: 'posicoes', etiqueta: 'Onde aparece na app', tipo: 'checkbox', varios: true, opcoes: POSICOES },
      ...DATAS, ATIVO
    ],
    valido: v => !(v.titulo || v.texto) ? 'Precisa de título ou texto.' : (!(v.posicoes || []).length ? 'Escolhe pelo menos um ecrã.' : '')
  },
  notificacoes: {
    nome: 'Avisos', singular: 'aviso', icone: '🔔',
    descricao: 'Mensagem para todos: quando é aprovada, chega como notificação ao telemóvel (nas horas seguintes) e aparece num cartão no Início até cada pessoa o fechar.',
    titulo: x => x.titulo, resumo: x => x.texto,
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'texto', etiqueta: 'Mensagem', tipo: 'textarea' },
      ATIVO
    ],
    valido: v => v.titulo ? '' : 'O aviso precisa de um título.'
  }
};

function rotuloPosicao(chave) { const p = POSICOES.find(x => x[0] === chave); return p ? p[1] : chave; }

/** Algo deste item espera aprovação (o item novo ou uma alteração)? */
function pendente(x) { return x.estado !== 'publicado' ? x : (x.proposta || null); }
function precisaDeMim(x) {
  const p = pendente(x);
  return p && x.estado !== 'rejeitado' && !(p.aprovacoes || []).includes(CFG.login);
}

function estadoHtml(x) {
  const p = x.proposta;
  let h;
  if (x.estado === 'publicado') h = x.ativo === false ? '<span class="pilula">Publicado (desligado)</span>' : '<span class="pilula ok">Publicado na app</span>';
  else h = `<span class="pilula espera">Por aprovar ${(x.aprovacoes || []).length}/${APROVACOES}</span>`;
  if (p) h += `<div style="margin-top:4px"><span class="pilula espera">${p.apagar ? 'Pedido para apagar' : 'Alteração por aprovar'} ${(p.aprovacoes || []).length}/${APROVACOES}</span></div>`;
  const quem = pendente(x) ? (pendente(x).aprovacoes || []) : [];
  if (quem.length) h += `<div class="mini">Aprovado por: ${quem.map(esc).join(', ')}</div>`;
  return h;
}

function ecraConteudo(tipo) {
  return alvo => {
    const T = TIPOS[tipo];
    const lista = ler(tipo) || [];
    const linhas = lista.map(x => {
      const p = pendente(x);
      const imagem = (p && !p.apagar && p.campos ? p.campos.imagem : null) || x.imagem;
      return `<tr>
        <td>${urlSegura(imagem) ? `<img class="miniatura" src="${esc(imagem)}" alt="">` : ''}</td>
        <td><b>${esc(T.titulo(x) || '')}</b><div class="mini">${esc(String(T.resumo(x) || '').slice(0, 110))}</div>
          ${x.de || x.ate ? `<div class="mini">${esc(x.de ? dataDia(x.de) : '…')} → ${esc(x.ate ? dataDia(x.ate) : 'sem fim')}</div>` : ''}
          <div class="mini">Criado por ${esc(x.autor || '—')} · ${esc(dataCurta(x.criado))}</div></td>
        <td>${estadoHtml(x)}</td>
        <td class="direita"><div class="linha-acoes">
          ${precisaDeMim(x) ? `<button class="botao pequeno principal" data-aprovar="${esc(x.id)}">Aprovar</button>` : ''}
          ${p ? `<button class="botao pequeno" data-ver="${esc(x.id)}">Ver</button><button class="botao pequeno perigo" data-rejeitar="${esc(x.id)}">Rejeitar</button>` : ''}
          ${!(p && p.apagar) ? `<button class="botao pequeno" data-editar="${esc(x.id)}">Editar</button>` : ''}
          ${!(p && p.apagar) ? `<button class="botao pequeno perigo" data-apagar="${esc(x.id)}">Apagar</button>` : ''}
        </div></td>
      </tr>`;
    }).join('');
    const poucos = CFG.modo !== 'local' && totalAdmins() < APROVACOES
      ? `<p class="aviso mau" style="margin:0 0 12px">Só há ${totalAdmins()} administrador(es). São precisos ${APROVACOES} para publicar — acrescenta outro em <b>Administradores</b>.</p>` : '';
    alvo.innerHTML = cartao(T.nome,
      `<p class="suave">${T.descricao}</p>
       <p class="suave">Tudo o que crias, alteras ou apagas só chega à app depois de <b>${APROVACOES} administradores diferentes</b> aprovarem (quem cria já conta como uma aprovação).</p>
       ${poucos}
       <div class="tabela-rolar"><table class="tabela">
        <tr><th></th><th>${esc(T.singular[0].toUpperCase() + T.singular.slice(1))}</th><th>Estado</th><th class="direita">Ações</th></tr>
        ${linhas || `<tr><td colspan="4"><p class="suave">Ainda não há nada aqui.</p></td></tr>`}
       </table></div>`,
      `<button class="botao pequeno" data-atualizar>Atualizar</button>
       <button class="botao pequeno principal" data-novo>Novo</button>`);

    alvo.addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-novo')) editarConteudo(tipo, null);
      else if (b.hasAttribute('data-atualizar')) recarregar([tipo]);
      else if (b.dataset.editar) editarConteudo(tipo, b.dataset.editar);
      else if (b.dataset.apagar) apagarConteudo(tipo, b.dataset.apagar);
      else if (b.dataset.aprovar) aprovarConteudo(tipo, b.dataset.aprovar);
      else if (b.dataset.rejeitar) rejeitarConteudo(tipo, b.dataset.rejeitar);
      else if (b.dataset.ver) verPendente(tipo, b.dataset.ver);
    });
  };
}

function soCampos(tipo, v) {
  const o = {};
  TIPOS[tipo].campos.forEach(c => { o[c.nome] = v[c.nome]; });
  return o;
}

async function editarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  const atual = id ? (ler(tipo) || []).find(x => x.id === id) : null;
  // Se já há uma alteração pendente, parte dela.
  const base = atual ? Object.assign({}, atual, atual.proposta && atual.proposta.campos ? atual.proposta.campos : {}) : { ativo: true };
  let privadosAtuais = {};
  if (T.privados && atual) privadosAtuais = (ler('anunciantes') || {})[atual.id] || {};
  const campos = T.campos.concat(T.privados && PRIVADO_OK !== false ? T.privados : []);
  const v = await formulario(atual ? `Editar ${T.singular}` : `Novo ${T.singular}`, campos, Object.assign({}, base, privadosAtuais), {
    textoGuardar: 'Enviar para aprovação',
    nota: atual && atual.estado === 'publicado' ? 'Enquanto a alteração não for aprovada, a app continua a mostrar a versão atual.' : ''
  });
  if (!v) return;
  const erro = T.valido(v) || ['imagem', 'link'].filter(k => v[k] && !urlSegura(v[k])).map(() => 'As ligações e imagens têm de começar por https://')[0];
  if (erro) { aviso(erro, true); return; }
  const novos = soCampos(tipo, v);
  const novoId = atual ? atual.id : idNovo();
  const ok = await alterarFicheiro(tipo, lista => {
    const x = lista.find(i => i.id === novoId);
    if (!x) {
      if (atual) { aviso('Este item já não existe (alguém apagou).', true); return false; }
      lista.unshift(Object.assign({ id: novoId, estado: 'aprovacao', autor: CFG.login, criado: agoraISO(), aprovacoes: [CFG.login] }, novos));
    } else if (x.estado !== 'publicado') {
      Object.assign(x, novos, { aprovacoes: [CFG.login] });   // mudou o texto: aprovações recomeçam
    } else {
      x.proposta = { campos: novos, autor: CFG.login, criado: agoraISO(), aprovacoes: [CFG.login] };
    }
  }, `Plataforma (${CFG.login}): ${atual ? 'altera' : 'cria'} ${T.singular}`);
  if (ok && T.privados && PRIVADO_OK) {
    const priv = {}; T.privados.forEach(c => { priv[c.nome] = v[c.nome]; });
    await alterarFicheiro('anunciantes', m => { m[novoId] = priv; }, `Plataforma (${CFG.login}): dados do anunciante`);
  }
  if (ok) { aviso('Enviado. Falta a aprovação de outro administrador.'); redesenhar(); }
}

async function apagarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  const x = (ler(tipo) || []).find(i => i.id === id);
  if (!x) return;
  const publicado = x.estado === 'publicado';
  if (!confirm(publicado ? `Pedir para apagar este ${T.singular}? Fica na app até outro administrador aprovar.`
    : `Apagar este ${T.singular}? Ainda não estava na app.`)) return;
  const ok = await alterarFicheiro(tipo, lista => {
    const i = lista.findIndex(e => e.id === id);
    if (i < 0) return false;
    if (lista[i].estado !== 'publicado') lista.splice(i, 1);
    else lista[i].proposta = { apagar: true, autor: CFG.login, criado: agoraISO(), aprovacoes: [CFG.login] };
  }, `Plataforma (${CFG.login}): ${publicado ? 'pede para apagar' : 'apaga'} ${T.singular}`);
  if (ok) { aviso(publicado ? 'Pedido enviado. Falta a aprovação de outro administrador.' : 'Apagado.'); redesenhar(); }
}

async function aprovarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  let resultado = '';
  const ok = await alterarFicheiro(tipo, lista => {
    const i = lista.findIndex(e => e.id === id);
    if (i < 0) return false;
    const x = lista[i];
    const p = pendente(x);
    if (!p) return false;
    p.aprovacoes = Array.from(new Set([...(p.aprovacoes || []), CFG.login]));
    if (p.aprovacoes.length < APROVACOES) { resultado = `Aprovação registada (${p.aprovacoes.length}/${APROVACOES}).`; return; }
    if (x.estado !== 'publicado') {
      x.estado = 'publicado'; x.publicado = agoraISO();
      resultado = 'Aprovado por dois administradores: já está na app (pode demorar uns minutos a aparecer).';
    } else if (p.apagar) {
      lista.splice(i, 1);
      resultado = 'Apagado da app.';
    } else {
      Object.assign(x, p.campos); delete x.proposta; x.alterado = agoraISO();
      resultado = 'Alteração aprovada: a app já mostra a nova versão.';
    }
  }, `Plataforma (${CFG.login}): aprova ${T.singular}`);
  if (ok) { aviso(resultado); redesenhar(); }
}

async function rejeitarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  if (!confirm('Rejeitar? O pedido é retirado (o que já está na app fica igual).')) return;
  const ok = await alterarFicheiro(tipo, lista => {
    const i = lista.findIndex(e => e.id === id);
    if (i < 0) return false;
    if (lista[i].estado !== 'publicado') lista.splice(i, 1);
    else delete lista[i].proposta;
  }, `Plataforma (${CFG.login}): rejeita ${T.singular}`);
  if (ok) { aviso('Rejeitado.'); redesenhar(); }
}

function verPendente(tipo, id) {
  const T = TIPOS[tipo];
  const x = (ler(tipo) || []).find(i => i.id === id);
  if (!x) return;
  const p = pendente(x);
  const novo = x.estado === 'publicado' ? (p.apagar ? null : p.campos) : soCampos(tipo, x);
  const linhas = T.campos.map(c => {
    const antes = x.estado === 'publicado' ? x[c.nome] : undefined;
    const depois = novo ? novo[c.nome] : undefined;
    const fmt = val => Array.isArray(val) ? val.map(rotuloPosicao).join(', ') : (typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : (val == null ? '' : String(val)));
    const mudou = x.estado === 'publicado' && novo && fmt(antes) !== fmt(depois);
    return `<tr><th>${esc(c.etiqueta)}</th>
      ${x.estado === 'publicado' ? `<td class="mini">${esc(fmt(antes))}</td>` : ''}
      <td${mudou ? ' style="color:#ffd75e"' : ''}>${novo ? esc(fmt(depois)) : '<i>(apagar)</i>'}</td></tr>`;
  }).join('');
  formulario(`Ver ${T.singular}`, [], {}, {
    textoGuardar: 'Fechar',
    nota: `<table class="tabela">${x.estado === 'publicado' ? '<tr><th></th><th>Agora na app</th><th>Proposto</th></tr>' : ''}${linhas}</table>`
  });
}

/* ------------------------------ Painel e alertas ------------------------------ */
function alertas() {
  const lista = [];
  if (CFG.modo === 'local') return lista;
  const status = ler('status') || {};
  if (status.atualizado) {
    const horas = (Date.now() - new Date(status.atualizado).getTime()) / 3600e3;
    if (horas > 12) lista.push({ mau: true, texto: `O robô não atualiza os dados há ${Math.round(horas)} horas.` });
  } else {
    lista.push({ mau: true, texto: 'Não consegui ler o estado do robô (status.json).' });
  }
  if (status.agente && status.agente.ativo === false) lista.push({ mau: true, texto: 'O agente de IA (Gemini) não está a responder — confirma a chave GEMINI_API_KEY nos Secrets do repositório.' });
  if (RUNS && RUNS.length) {
    const falhas = RUNS.filter(r => r.conclusion === 'failure');
    if (RUNS[0].conclusion === 'failure') lista.push({ mau: true, texto: `A última execução do robô falhou (${dataCurta(RUNS[0].created_at)}).`, link: RUNS[0].html_url });
    else if (falhas.length >= 3) lista.push({ mau: true, texto: `O robô falhou ${falhas.length} das últimas ${RUNS.length} vezes.`, link: falhas[0].html_url });
  }
  if (RUNS === false) lista.push({ mau: false, texto: 'Para ver as falhas do robô, a tua chave precisa da permissão "Actions: Read-only".' });
  if (totalAdmins() < APROVACOES) lista.push({ mau: true, texto: `Só há ${totalAdmins()} administrador(es): são precisos ${APROVACOES} para publicar.` });
  if (PRIVADO_OK === false) lista.push({ mau: false, texto: `O repositório privado "${CFG.repoPrivado}" não existe ou a chave não tem acesso: contactos dos anunciantes e monetização ficam desligados.` });
  return lista;
}

function ecraPainel(alvo) {
  const pend = Object.keys(TIPOS).reduce((n, t) => n + porAprovarPorMim(t), 0);
  const noAr = t => (ler(t) || []).filter(x => x.estado === 'publicado' && x.ativo !== false).length;
  const status = ler('status') || {};
  const al = alertas();
  let html = `<div class="grelha">
    ${azulejo(pend, 'À espera da tua aprovação')}
    ${azulejo(noAr('destaques'), 'Destaques na app')}
    ${azulejo(noAr('anuncios'), 'Anúncios na app')}
    ${azulejo(noAr('publicacoes'), 'Publicações na app')}
    ${azulejo(noAr('noticias'), 'Notícias na app')}
  </div><div style="height:16px"></div>`;
  html += cartao('Alertas', al.length
    ? `<ul style="margin:0;padding-left:1.1em">${al.map(a => `<li style="margin-bottom:6px;${a.mau ? 'color:#ff8b8b' : ''}">${esc(a.texto)}${a.link ? ` <a href="${esc(a.link)}" target="_blank" rel="noopener">ver</a>` : ''}</li>`).join('')}</ul>`
    : '<p><span class="pilula ok">Tudo a funcionar</span></p>',
    '<button class="botao pequeno" data-atualizar>Atualizar</button>');
  html += cartao('Robô e agente', `<table class="tabela">
    <tr><th>Última recolha de dados</th><td>${status.atualizado ? esc(dataCurta(status.atualizado)) : '<span class="suave">Sem informação</span>'}</td></tr>
    <tr><th>Agente de IA</th><td>${status.agente ? (status.agente.ativo ? '<span class="pilula ok">Ativo</span>' : '<span class="pilula mau">Inativo</span>') : '<span class="suave">Sem informação</span>'}</td></tr>
    ${RUNS && RUNS.length ? `<tr><th>Últimas execuções</th><td>${RUNS.slice(0, 8).map(r =>
      `<span class="pilula ${r.conclusion === 'success' ? 'ok' : r.conclusion === 'failure' ? 'mau' : 'espera'}" title="${esc(dataCurta(r.created_at))}">${r.conclusion === 'success' ? '✓' : r.conclusion === 'failure' ? '✗' : '…'}</span>`).join(' ')}</td></tr>` : ''}
    <tr><th>Sessão</th><td>${esc(CFG.nome)} (${esc(CFG.login)}) · ${souDono() ? 'Dono' : 'Administrador'}</td></tr>
  </table>`);
  alvo.innerHTML = html;
  $('[data-atualizar]', alvo).addEventListener('click', () => recarregar(Object.keys(FICHEIROS)));
}

/* --------------------------- Vídeos (programa de cada vídeo) --------------------------- */
function ecraVideos(alvo) {
  const mapa = ler('videos') || {};
  const linhas = Object.entries(mapa).map(([vid, nome]) => `<tr>
    <td class="mini"><a href="https://www.youtube.com/watch?v=${encodeURIComponent(vid)}" target="_blank" rel="noopener">${esc(vid)}</a></td>
    <td><input class="entrada-programa" data-id="${esc(vid)}" value="${esc(nome)}" style="width:100%"></td>
  </tr>`).join('');
  alvo.innerHTML = cartao('Programa de cada vídeo',
    `<p class="suave">O agente arruma sozinho os vídeos novos do canal em programas. Aqui podes corrigir à mão — o robô respeita as tuas correções. (Esta lista não precisa de aprovação: só organiza os vídeos.)</p>
     <div class="tabela-rolar"><table class="tabela">
      <tr><th>Vídeo</th><th>Programa</th></tr>
      ${linhas || `<tr><td colspan="2"><p class="suave">Ainda não há vídeos arrumados pelo agente.</p></td></tr>`}
     </table></div>`,
    `<button class="botao pequeno principal" data-guardar>Guardar correções</button>`);
  $('[data-guardar]', alvo).addEventListener('click', async () => {
    const novos = {};
    $$('.entrada-programa', alvo).forEach(i => { novos[i.dataset.id] = i.value.trim() || 'Outros vídeos'; });
    if (await alterarFicheiro('videos', m => { Object.assign(m, novos); }, `Plataforma (${CFG.login}): corrige programas dos vídeos`)) aviso('Gravado.');
  });
}

/* ---------------------------- Monetização (privado) ---------------------------- */
function semPrivado(alvo, titulo) {
  alvo.innerHTML = cartao(titulo,
    `<p>Estes dados são privados e não podem ficar no repositório público que a app lê.</p>
     <ol class="suave">
      <li>No GitHub cria um repositório <b>privado</b> chamado <b>${esc(CFG.repoPrivado)}</b> na conta ${esc(CFG.owner)} (pode ficar vazio).</li>
      <li>Na chave de acesso de cada administrador, junta este repositório (Contents: Read and write).</li>
      <li>Sai e volta a entrar na plataforma.</li>
     </ol>`);
}

function ecraMonetizacao(alvo) {
  if (CFG.modo !== 'local' && PRIVADO_OK === false) { semPrivado(alvo, 'Monetização'); return; }
  const m = ler('monetizacao');
  const anunciantes = ler('anunciantes') || {};
  const anuncios = ler('anuncios') || [];
  const pago = anuncios.reduce((s, a) => s + Number((anunciantes[a.id] || {}).valor || 0), 0);
  const ctr = m.impressoes ? (100 * (m.cliques || 0) / m.impressoes) : 0;
  alvo.innerHTML = cartao('Resumo', `<div class="grelha">
      ${azulejo(pago.toFixed(2) + ' €', 'Pago pelos anunciantes')}
      ${azulejo(Number(m.receitaTotal || 0).toFixed(2) + ' €', 'Outras receitas (AdMob, etc.)')}
      ${azulejo(Number(m.impressoes || 0), 'Impressões')}
      ${azulejo(ctr.toFixed(2) + ' %', 'Taxa de cliques')}
    </div><p class="suave" style="margin-top:12px">Guardado no repositório privado. ${m.atualizado ? 'Atualizado: ' + esc(dataCurta(m.atualizado)) : ''}</p>`,
    '<button class="botao pequeno principal" data-totais>Editar números</button>');
  alvo.insertAdjacentHTML('beforeend', cartao('Anunciantes', `<div class="tabela-rolar"><table class="tabela">
      <tr><th>Anúncio</th><th>Contacto</th><th class="direita">Valor</th><th>Estado</th></tr>
      ${anuncios.map(a => { const p = anunciantes[a.id] || {}; return `<tr><td><b>${esc(a.texto)}</b></td><td class="mini">${esc(p.contacto || '—')}</td>
        <td class="direita">${esc(Number(p.valor || 0).toFixed(2))} €</td><td>${estadoHtml(a)}</td></tr>`; }).join('') || '<tr><td colspan="4"><p class="suave">Sem anúncios.</p></td></tr>'}
    </table></div>`));
  $('[data-totais]', alvo).addEventListener('click', async () => {
    const v = await formulario('Números da publicidade', [
      { nome: 'receitaTotal', etiqueta: 'Outras receitas (€)', tipo: 'number' },
      { nome: 'impressoes', etiqueta: 'Impressões', tipo: 'number' },
      { nome: 'cliques', etiqueta: 'Cliques', tipo: 'number' }
    ], m);
    if (!v) return;
    if (await alterarFicheiro('monetizacao', x => { Object.assign(x, v, { atualizado: agoraISO() }); }, 'Plataforma: monetização')) { aviso('Gravado.'); redesenhar(); }
  });
}

/* ---------------------------- Administradores ---------------------------- */
function ecraAdmins(alvo) {
  const a = admins();
  const grupo = (titulo, lista, tipo, descricao) => `<tr><th style="width:170px">${esc(titulo)}<div class="mini" style="font-weight:400;text-transform:none">${esc(descricao)}</div></th>
    <td>${lista.length ? lista.map(e => `<span class="pilula info" style="margin:0 6px 6px 0">${esc(e)}
      ${souDono() ? `<button class="botao pequeno perigo" data-remover="${esc(tipo)}|${esc(e)}" style="padding:0 5px;margin-left:5px">×</button>` : ''}</span>`).join('') : '<span class="suave">Ninguém.</span>'}
    ${souDono() ? `<button class="botao pequeno" data-adicionar="${esc(tipo)}">+ Adicionar</button>` : ''}</td></tr>`;
  alvo.innerHTML = cartao('Quem pode gerir a app',
    `<p class="suave">Cada pessoa entra com a sua conta GitHub (nome de utilizador, sem emails). Para poder gravar, tem também de ser convidada como colaboradora do repositório <b>${esc(CFG.repo)}</b> no GitHub (Settings → Collaborators).</p>
     <table class="tabela">
      ${grupo('Donos', a.donos, 'donos', 'Gerem tudo, incluindo quem é administrador. Também aprovam conteúdos.')}
      ${grupo('Administradores', a.admins, 'admins', 'Criam e aprovam conteúdos.')}
     </table>
     ${souDono() ? '' : '<p class="suave">Só um dono pode mudar esta lista.</p>'}`);
  alvo.addEventListener('click', async ev => {
    const b = ev.target.closest('button');
    if (!b || !souDono()) return;
    if (b.dataset.adicionar) {
      const v = await formulario('Adicionar pessoa', [{ nome: 'login', etiqueta: 'Nome de utilizador no GitHub', tipo: 'text', dica: 'Ex.: JoaoRebola' }]);
      const login = v && v.login.replace(/^@/, '').trim();
      if (!login) return;
      if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) { aviso('Nome de utilizador do GitHub inválido.', true); return; }
      if (await alterarFicheiro('admins', x => {
        x.donos = x.donos || []; x.admins = x.admins || [];
        if (!x[b.dataset.adicionar].includes(login)) x[b.dataset.adicionar].push(login);
      }, `Plataforma (${CFG.login}): acrescenta ${login}`)) { aviso('Acrescentado. Não te esqueças de o convidar no GitHub.'); redesenhar(); }
    } else if (b.dataset.remover) {
      const [tipo, login] = b.dataset.remover.split('|');
      if (tipo === 'donos' && login === CFG.login && admins().donos.length === 1) { aviso('És o único dono: não te podes remover.', true); return; }
      if (!confirm(`Remover ${login}?`)) return;
      if (await alterarFicheiro('admins', x => { x[tipo] = (x[tipo] || []).filter(e => e !== login); }, `Plataforma (${CFG.login}): remove ${login}`)) { aviso('Removido.'); redesenhar(); }
    }
  });
}

/* ------------------------------ Versões ------------------------------ */
function ecraVersoes(alvo) {
  const v = ler('versao');
  alvo.innerHTML = cartao('Versão da app (Android)',
    `<p class="suave">Quando pões aqui uma versão com número interno maior do que a instalada, a app mostra no Início um cartão "Há uma versão nova" com a ligação para descarregar.</p>
     <table class="tabela">
      <tr><th style="width:190px">Versão</th><td>${esc(v.versao || '—')}</td></tr>
      <tr><th>Número interno</th><td>${esc(v.codigo || '—')}</td></tr>
      <tr><th>Ficheiro (APK)</th><td>${urlSegura(v.apk) ? `<a href="${esc(v.apk)}" target="_blank" rel="noopener">${esc(v.apk)}</a>` : '<span class="suave">Sem ligação</span>'}</td></tr>
      <tr><th>Importante</th><td>${v.obrigatoria ? '<span class="pilula mau">Sim</span>' : '<span class="pilula ok">Não</span>'}</td></tr>
      <tr><th>O que mudou</th><td>${esc(v.notas || '').replace(/\n/g, '<br>') || '<span class="suave">—</span>'}</td></tr>
      <tr><th>Atualizado</th><td class="mini">${esc(dataCurta(v.atualizado))} ${v.por ? '· ' + esc(v.por) : ''}</td></tr>
     </table>
     <p class="suave" style="margin-top:12px">iPhone: ainda não há versão (precisa de um Mac e de conta Apple Developer).</p>`,
    souDono() ? '<button class="botao pequeno principal" data-editar>Editar</button>' : '');
  const b = $('[data-editar]', alvo);
  if (b) b.addEventListener('click', async () => {
    const novo = await formulario('Versão da app', [
      { nome: 'versao', etiqueta: 'Versão', tipo: 'text', dica: 'Ex.: 1.1.0' },
      { nome: 'codigo', etiqueta: 'Número interno (tem de subir em cada versão)', tipo: 'number', min: 1 },
      { nome: 'apk', etiqueta: 'Ligação para descarregar o APK', tipo: 'url', dica: 'https://...' },
      { nome: 'notas', etiqueta: 'O que mudou', tipo: 'textarea' },
      { nome: 'obrigatoria', etiqueta: 'Importante', tipo: 'checkbox', ajuda: 'Mostrar como atualização importante' }
    ], v);
    if (!novo) return;
    if (novo.apk && !urlSegura(novo.apk)) { aviso('A ligação tem de começar por https://', true); return; }
    if (await alterarFicheiro('versao', x => { Object.assign(x, novo, { atualizado: agoraISO(), por: CFG.login }); }, `Plataforma (${CFG.login}): versão ${novo.versao}`)) { aviso('Versão gravada.'); redesenhar(); }
  });
}

/* ------------------------------ Definições ------------------------------ */
function ecraDefinicoes(alvo) {
  alvo.innerHTML = cartao('Sessão', `<table class="tabela">
      <tr><th style="width:170px">Conta</th><td>${esc(CFG.nome)} (${esc(CFG.login)})</td></tr>
      <tr><th>Papel</th><td>${souDono() ? 'Dono' : souAdmin() ? 'Administrador' : 'Sem acesso'}</td></tr>
      <tr><th>Modo</th><td>${CFG.modo === 'local' ? 'Teste (sem internet — nada chega à app)' : 'GitHub'}</td></tr>
    </table>`, '<button class="botao pequeno perigo" data-sair>Sair</button>');
  alvo.insertAdjacentHTML('beforeend', cartao('Repositórios',
    `<div class="formulario linha-dupla">
      <label>Dono (conta GitHub)<input id="cfg-owner" value="${esc(CFG.owner)}"></label>
      <label>Ramo<input id="cfg-branch" value="${esc(CFG.branch)}"></label>
      <label>Repositório público (a app lê)<input id="cfg-repo" value="${esc(CFG.repo)}"></label>
      <label>Repositório privado (gestão)<input id="cfg-privado" value="${esc(CFG.repoPrivado)}"></label>
    </div>
    <p class="suave">Repositório privado: ${PRIVADO_OK ? '<span class="pilula ok">Ligado</span>' : '<span class="pilula">Não encontrado</span>'}. Não mudes nada se não tiveres a certeza.</p>`,
    '<button class="botao pequeno principal" data-guardar>Guardar</button>'));
  alvo.insertAdjacentHTML('beforeend', cartao('Instalar no telemóvel',
    `<p class="suave">Abre a plataforma no Chrome do telemóvel, menu ⋮ → <b>Adicionar ao ecrã principal</b> (no iPhone: Safari → Partilhar → <b>Adicionar ao ecrã principal</b>). Fica como uma app, sem Play Store nem App Store.</p>`));
  $('[data-sair]', alvo).addEventListener('click', sair);
  $('[data-guardar]', alvo).addEventListener('click', async () => {
    CFG.owner = $('#cfg-owner', alvo).value.trim() || DONO_PADRAO;
    CFG.repo = $('#cfg-repo', alvo).value.trim() || REPO_PADRAO;
    CFG.repoPrivado = $('#cfg-privado', alvo).value.trim() || REPO_PRIVADO_PADRAO;
    CFG.branch = $('#cfg-branch', alvo).value.trim() || RAMO_PADRAO;
    Object.keys(SHAS).forEach(k => delete SHAS[k]);
    guardarConfig();
    await carregarDados();
    aviso('Guardado.');
    redesenhar();
  });
}

/* ============================ Mensagens (Supabase) ============================ */
// Chat e formulário de contacto da app. Os dados ficam no Supabase do BI; a
// plataforma entra com a chave GitHub de cada gestor (o Supabase confirma no
// GitHub quem é e se está na lista de administradores). Ver supabase.sql.
const SUPABASE_URL = 'https://rpqqucqxgjkisoimstfh.supabase.co';
const SUPABASE_CHAVE = 'sb_publishable_InvgB931-Wc8vFs65WWXxw_KVpMLGhH';
let MSG_NOVAS = 0;
let CONVERSA_ABERTA = null;
let GESTORES_CACHE = [];

async function rpc(fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {})
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch (e) { /* ignora */ }
  if (!r.ok) {
    const m = (j && j.message) || ('Supabase ' + r.status);
    throw new Error(m === 'sem acesso' ? 'A tua conta GitHub não está na lista de administradores.' : m);
  }
  return j;
}
const rpcAdmin = (fn, args) => rpc(fn, Object.assign({ p_gh: CFG.token }, args || {}));

async function contarMensagensNovas() {
  if (CFG.modo === 'local' || !CFG.token) { MSG_NOVAS = 0; return; }
  try {
    const lista = await rpcAdmin('bi_admin_conversas');
    MSG_NOVAS = lista.filter(c => c.estado === 'nova').length;
  } catch (e) { MSG_NOVAS = 0; }
}

function nomeGestor(login) {
  const g = GESTORES_CACHE.find(x => x.login === login);
  return g ? g.nome : login;
}

const ESTADOS_MSG = { nova: ['Por responder', 'espera'], respondida: ['Respondida', 'ok'], fechada: ['Fechada', ''] };

function ecraMensagens(alvo) {
  if (CFG.modo === 'local') {
    alvo.innerHTML = cartao('Mensagens', '<p class="suave">As mensagens só aparecem quando se entra com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  if (CONVERSA_ABERTA) { ecraConversa(alvo, CONVERSA_ABERTA); return; }
  alvo.innerHTML = cartao('Mensagens da app', '<p class="suave">A carregar…</p>');
  (async () => {
    try {
      carregar(true);
      const [lista, gestores] = await Promise.all([rpcAdmin('bi_admin_conversas'), rpcAdmin('bi_admin_gestores')]);
      GESTORES_CACHE = gestores;
      MSG_NOVAS = lista.filter(c => c.estado === 'nova').length;
      montaMenu();
      const filtro = alvo.dataset.filtro || 'abertas';
      const vis = lista.filter(c => filtro === 'todas' || c.estado !== 'fechada');
      alvo.innerHTML = cartao('Mensagens da app',
        `<p class="suave">O que os adeptos escrevem no <b>chat</b> e no <b>formulário de contacto</b> da app. Toca numa mensagem para ler e responder — a resposta aparece na app de quem escreveu.</p>
         <div style="margin:10px 0">
           <button class="botao pequeno ${filtro === 'abertas' ? 'principal' : ''}" data-filtro="abertas">Por tratar</button>
           <button class="botao pequeno ${filtro === 'todas' ? 'principal' : ''}" data-filtro="todas">Todas</button>
           <button class="botao pequeno" data-atualizar>↻ Atualizar</button>
         </div>
         <div class="lista">${vis.length ? vis.map(c => {
           const e = ESTADOS_MSG[c.estado] || [c.estado, ''];
           const para = (c.para || []).map(nomeGestor).join(', ');
           return `<div class="mensagem" data-abrir="${esc(c.id)}" style="cursor:pointer">
             <div class="mensagem-topo">
               <span class="pilula ${e[1]}">${esc(e[0])}</span>
               <strong>${esc(c.nome || 'Adepto')}</strong>
               <span class="pilula info">${c.tipo === 'formulario' ? 'Formulário' : 'Chat'}</span>
               <span class="quando">${esc(dataCurta(c.atualizado))}</span>
             </div>
             ${c.assunto ? `<div class="mini"><b>Assunto:</b> ${esc(c.assunto)}</div>` : ''}
             ${para ? `<div class="mini"><b>Para:</b> ${esc(para)}</div>` : ''}
             <div>${esc((c.ultima || '').slice(0, 220))}</div>
           </div>`;
         }).join('') : '<p class="suave">Não há mensagens por tratar. 🎉</p>'}</div>`);
      $$('[data-filtro]', alvo).forEach(b => b.addEventListener('click', () => { alvo.dataset.filtro = b.dataset.filtro; ecraMensagens(alvo); }));
      $('[data-atualizar]', alvo).addEventListener('click', () => ecraMensagens(alvo));
      $$('[data-abrir]', alvo).forEach(d => d.addEventListener('click', () => {
        CONVERSA_ABERTA = lista.find(c => c.id === d.dataset.abrir);
        ecraMensagens(alvo);
      }));
    } catch (e) {
      alvo.innerHTML = cartao('Mensagens', `<p class="erro">${esc(e.message)}</p>`);
    } finally {
      carregar(false);
    }
  })();
}

function ecraConversa(alvo, c) {
  alvo.innerHTML = cartao('Conversa', '<p class="suave">A carregar…</p>');
  (async () => {
    try {
      carregar(true);
      const msgs = await rpcAdmin('bi_admin_mensagens', { p_id: c.id });
      const quem = { adepto: c.nome || 'Adepto', assistente: 'Assistente automático', gestor: 'BI' };
      alvo.innerHTML = cartao(c.nome || 'Adepto',
        `<table class="tabela" style="margin-bottom:12px">
          <tr><th style="width:150px">Origem</th><td>${c.tipo === 'formulario' ? 'Formulário de contacto' : 'Chat'}</td></tr>
          ${c.assunto ? `<tr><th>Assunto</th><td>${esc(c.assunto)}</td></tr>` : ''}
          <tr><th>Contacto</th><td>${esc(c.contacto || '—')}</td></tr>
          <tr><th>Para</th><td>${esc((c.para || []).map(nomeGestor).join(', ') || 'Qualquer um')}</td></tr>
         </table>
         <div class="lista">${msgs.map(m => `
           <div class="mensagem" style="${m.autor === 'adepto' ? '' : 'border-left:3px solid ' + (m.autor === 'gestor' ? 'var(--vermelho)' : 'var(--linha)')}">
             <div class="mensagem-topo"><strong>${esc(m.autor === 'gestor' ? (m.nome || 'BI') + ' (BI)' : quem[m.autor] || m.autor)}</strong>
               <span class="quando">${esc(dataCurta(m.criado))}</span></div>
             <div ${m.autor === 'assistente' ? 'class="suave"' : ''}>${esc(m.texto).replace(/\n/g, '<br>')}</div>
           </div>`).join('')}</div>
         <div class="formulario" style="margin-top:14px">
           <label>A tua resposta (aparece na app de quem escreveu)<textarea id="resposta" placeholder="Escreve aqui…"></textarea></label>
           <button class="botao principal" data-responder>Enviar resposta</button>
         </div>`,
        `<button class="botao pequeno" data-voltar>← Voltar</button>
         ${c.estado !== 'fechada' ? '<button class="botao pequeno" data-fechar>Marcar como tratada</button>' : '<button class="botao pequeno" data-reabrir>Reabrir</button>'}
         <button class="botao pequeno perigo" data-apagar>Apagar</button>`);
      const voltar = () => { CONVERSA_ABERTA = null; ecraMensagens(alvo); };
      $('[data-voltar]', alvo).addEventListener('click', voltar);
      $('[data-responder]', alvo).addEventListener('click', async () => {
        const texto = $('#resposta', alvo).value.trim();
        if (!texto) { aviso('Escreve a resposta primeiro.', true); return; }
        try { carregar(true); await rpcAdmin('bi_admin_responder', { p_id: c.id, p_texto: texto }); c.estado = 'respondida'; aviso('Resposta enviada.'); ecraConversa(alvo, c); }
        catch (e) { aviso(e.message, true); } finally { carregar(false); }
      });
      const estado = async novo => {
        try { carregar(true); await rpcAdmin('bi_admin_estado', { p_id: c.id, p_estado: novo }); c.estado = novo; aviso('Feito.'); voltar(); }
        catch (e) { aviso(e.message, true); } finally { carregar(false); }
      };
      const f = $('[data-fechar]', alvo); if (f) f.addEventListener('click', () => estado('fechada'));
      const r = $('[data-reabrir]', alvo); if (r) r.addEventListener('click', () => estado('respondida'));
      $('[data-apagar]', alvo).addEventListener('click', async () => {
        if (!confirm('Apagar esta conversa de vez? Não dá para desfazer.')) return;
        try { carregar(true); await rpcAdmin('bi_admin_apagar', { p_id: c.id }); aviso('Apagada.'); voltar(); }
        catch (e) { aviso(e.message, true); } finally { carregar(false); }
      });
    } catch (e) {
      alvo.innerHTML = cartao('Conversa', `<p class="erro">${esc(e.message)}</p>`);
    } finally {
      carregar(false);
    }
  })();
}

/* Gestores que os adeptos podem escolher no chat e no formulário (com o email de cada um). */
function ecraGestores(alvo) {
  if (CFG.modo === 'local') {
    alvo.innerHTML = cartao('Gestores', '<p class="suave">Só funciona quando se entra com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  alvo.innerHTML = cartao('Gestores', '<p class="suave">A carregar…</p>');
  const CAMPOS = [
    { nome: 'nome', etiqueta: 'Nome que aparece na app', tipo: 'text', dica: 'Ex.: Redação' },
    { nome: 'funcao', etiqueta: 'Descrição curta', tipo: 'text', dica: 'Ex.: Artigos e opinião' },
    { nome: 'email', etiqueta: 'Email (para receber avisos — opcional)', tipo: 'email', ajuda: 'Nunca aparece na app. Fica guardado para quando o envio de emails for ligado.' },
    { nome: 'ordem', etiqueta: 'Ordem na lista', tipo: 'number', min: 0 },
    { nome: 'ativo', etiqueta: 'Ativo', tipo: 'checkbox', ajuda: 'Mostrar na app', valor: true }
  ];
  (async () => {
    try {
      carregar(true);
      const lista = await rpcAdmin('bi_admin_gestores');
      GESTORES_CACHE = lista;
      alvo.innerHTML = cartao('Gestores',
        `<p class="suave">São as pessoas ou equipas que os adeptos podem escolher em "Com quem gostava de falar?" e no formulário de contacto. As alterações aparecem logo na app.</p>
         <table class="tabela"><tr><th>Nome</th><th>Descrição</th><th>Email</th><th>Na app</th><th></th></tr>
         ${lista.map(g => `<tr>
           <td><b>${esc(g.nome)}</b></td><td class="mini">${esc(g.funcao)}</td>
           <td class="mini">${esc(g.email || '—')}</td>
           <td>${g.ativo ? '<span class="pilula ok">Sim</span>' : '<span class="pilula">Não</span>'}</td>
           <td class="direita"><button class="botao pequeno" data-editar="${esc(g.login)}">Editar</button>
             <button class="botao pequeno perigo" data-apagar="${esc(g.login)}">Apagar</button></td></tr>`).join('')}
         </table>`,
        '<button class="botao pequeno principal" data-novo>+ Novo gestor</button>');
      const guardar = async (login, v) => {
        try {
          carregar(true);
          await rpcAdmin('bi_admin_gestor', { p_login: login, p_nome: v.nome, p_funcao: v.funcao, p_email: v.email, p_ativo: v.ativo, p_ordem: v.ordem });
          aviso('Guardado.'); ecraGestores(alvo);
        } catch (e) { aviso(e.message, true); } finally { carregar(false); }
      };
      $('[data-novo]', alvo).addEventListener('click', async () => {
        const v = await formulario('Novo gestor', CAMPOS, { ordem: lista.length + 1, ativo: true });
        if (!v || !v.nome) return;
        const login = v.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
        guardar(login, v);
      });
      $$('[data-editar]', alvo).forEach(b => b.addEventListener('click', async () => {
        const g = lista.find(x => x.login === b.dataset.editar);
        const v = await formulario('Editar ' + g.nome, CAMPOS, g);
        if (v && v.nome) guardar(g.login, v);
      }));
      $$('[data-apagar]', alvo).forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Apagar este gestor da lista?')) return;
        try { carregar(true); await rpcAdmin('bi_admin_gestor_apagar', { p_login: b.dataset.apagar }); aviso('Apagado.'); ecraGestores(alvo); }
        catch (e) { aviso(e.message, true); } finally { carregar(false); }
      }));
    } catch (e) {
      alvo.innerHTML = cartao('Gestores', `<p class="erro">${esc(e.message)}</p>`);
    } finally {
      carregar(false);
    }
  })();
}

/* =============================== Arranque =============================== */
ECRAS = [
  { chave: 'painel', nome: 'Painel e alertas', icone: '▦', desenhar: ecraPainel },
  ...Object.keys(TIPOS).map(t => ({ chave: t, nome: TIPOS[t].nome, icone: TIPOS[t].icone, desenhar: ecraConteudo(t) })),
  { chave: 'mensagens', nome: 'Mensagens', icone: '✉', desenhar: ecraMensagens },
  { chave: 'gestores', nome: 'Gestores (contacto)', icone: '☎', desenhar: ecraGestores },
  { chave: 'videos', nome: 'Programas dos vídeos', icone: '▶', desenhar: ecraVideos },
  { chave: 'monetizacao', nome: 'Monetização', icone: '📊', desenhar: ecraMonetizacao },
  { chave: 'admins', nome: 'Administradores', icone: '👤', desenhar: ecraAdmins },
  { chave: 'versoes', nome: 'Versões da app', icone: '⬇', desenhar: ecraVersoes },
  { chave: 'definicoes', nome: 'Definições', icone: '⚙', desenhar: ecraDefinicoes }
];

async function lerSeguro(nome) {
  try {
    const v = await lerFicheiro(repoDe(nome), ficheiroDe(nome));
    DADOS[nome] = v != null ? v : vazio(nome);
    return true;
  } catch (e) {
    DADOS[nome] = vazio(nome);
    return false;
  }
}

async function lerRuns() {
  if (CFG.modo === 'local') { RUNS = null; return; }
  try {
    const r = await fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/actions/runs?per_page=12`, { headers: cabecalhos() });
    RUNS = r.ok ? ((await r.json()).workflow_runs || []).filter(x => x.status === 'completed') : false;
  } catch (e) { RUNS = false; }
}

async function verPrivado() {
  if (CFG.modo === 'local') { PRIVADO_OK = true; return; }
  try {
    const r = await fetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repoPrivado}`, { headers: cabecalhos() });
    PRIVADO_OK = r.ok;
  } catch (e) { PRIVADO_OK = false; }
}

async function carregarDados() {
  carregar(true);
  try {
    await verPrivado();
    const nomes = Object.keys(FICHEIROS).concat(PRIVADO_OK ? Object.keys(PRIVADOS) : []);
    await Promise.all(nomes.map(lerSeguro).concat([lerRuns(), contarMensagensNovas()]));
    if (!PRIVADO_OK) Object.keys(PRIVADOS).forEach(n => { DADOS[n] = vazio(n); });
    // Primeira vez: se ainda não há administradores, o dono do repositório fica como dono da plataforma.
    const a = admins();
    if (CFG.modo !== 'local' && !a.donos.length && !a.admins.length && CFG.login.toLowerCase() === CFG.owner.toLowerCase()) {
      await alterarFicheiro('admins', x => { x.donos = [CFG.login]; x.admins = x.admins || []; }, 'Plataforma: primeiro dono');
    }
  } finally {
    carregar(false);
  }
}

async function recarregar(nomes) {
  carregar(true);
  try {
    await Promise.all(nomes.map(lerSeguro).concat(nomes.includes('status') ? [lerRuns()] : []));
  } finally {
    carregar(false);
  }
  redesenhar();
}

async function abrirApp() {
  await carregarDados();
  $('#ecra-entrar').classList.add('escondido');
  $('#app').classList.remove('escondido');
  $('#barra-modo').textContent = CFG.modo === 'local' ? 'teste' : 'github';
  $('#barra-modo').classList.toggle('local', CFG.modo === 'local');
  $('#quem').textContent = CFG.nome || CFG.login;
  ECRAS_ATIVO = 'painel';
  redesenhar();
}

function pronto() {
  lerConfig();
  $('#entrar-botao').addEventListener('click', entrarComGitHub);
  $('#entrar-local').addEventListener('click', entrarLocal);
  $('#sair').addEventListener('click', sair);
  $('#menu-botao').addEventListener('click', () => $('.barra').classList.toggle('aberta'));
  $('#entrar-token').addEventListener('keydown', e => { if (e.key === 'Enter') entrarComGitHub(); });
  if ((CFG.modo === 'local' || CFG.token) && CFG.login) abrirApp().catch(e => mostraErroEntrada(e.message));
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', pronto);

/* Permite instalar como aplicação (PWA). */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('servico.js').catch(() => {}); });
}
