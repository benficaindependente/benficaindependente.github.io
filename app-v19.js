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
/* FASE DE TESTES: basta 1 administrador para publicar (quem cria publica logo).
   PRODUÇÃO: mudar para 2 (e, no Supabase, `bi_modo_teste()` para false — ver supabase-novidades.sql). */
const APROVACOES = 1;
const TESTE = APROVACOES < 2;
const OUTRO_ADMIN = TESTE ? 'é <b>publicado logo</b> (fase de testes: basta um administrador)' : 'só aparece na app depois de <b>outro administrador</b> aprovar';
const AVISO_ENVIADO = TESTE ? 'Publicado.' : 'Enviado. Falta a aprovação de outro administrador.';

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
  const hora = String(txt).length >= 16 && String(txt)[10] === 'T' ? ' às ' + String(txt).slice(11, 16) : '';
  return d && m && a ? `${d}/${m}/${a}${hora}` : String(txt);
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
/**
 * Pedido ao GitHub. Quem entrou com email não tem chave do GitHub: o pedido passa pelo Supabase
 * (função bi_gh), que grava com a chave guardada lá. Só aceita `method` e `body`.
 */
async function ghFetch(url, init) {
  init = init || {};
  if (CFG.modo !== 'email') {
    return fetch(url, Object.assign({ headers: cabecalhos(!!init.body) }, init));
  }
  const u = new URL(url);
  const j = await rpcAdmin('bi_gh', { p_metodo: init.method || 'GET', p_caminho: u.pathname.slice(1) + u.search, p_corpo: init.body || null });
  const semCorpo = [101, 204, 205, 304].includes(j.status);
  return new Response(semCorpo ? null : j.corpo, { status: j.status });
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
  const r = await ghFetch(`${urlConteudo(repo, nome)}?ref=${encodeURIComponent(CFG.branch)}&t=${Date.now()}`, { cache: 'no-store' });
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
  const r = await ghFetch(urlConteudo(repo, nome), { method: 'PUT', body: JSON.stringify(corpo) });
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
let EMAILS = null;   // administradores por email (quem entrou com email)
function admins() {
  if (CFG.modo === 'email' && EMAILS) return { donos: EMAILS.filter(e => e.dono).map(e => e.nome), admins: EMAILS.filter(e => !e.dono).map(e => e.nome) };
  const a = ler('admins'); return { donos: a.donos || [], admins: a.admins || [] }; }
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

function sair() { localStorage.removeItem(CHAVE_CONFIG); location.href = location.pathname; }

/* ------------------- Entrada com email e palavra-passe (Supabase) ------------------- */
async function authPedido(caminho, corpo, metodo, token) {
  const h = { 'apikey': SUPABASE_CHAVE, 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await fetch(SUPABASE_URL + '/auth/v1' + caminho, { method: metodo || 'POST', headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch (e) { /* ignora */ }
  if (!r.ok) throw new Error(erroAuth(j, r.status));
  return j;
}
function erroAuth(j, estado) {
  const m = String((j && (j.msg || j.error_description || j.message || j.error)) || '');
  if (/invalid login|invalid_credentials/i.test(m)) return 'Email ou palavra-passe errados. Se ainda não criaste a palavra-passe, usa "Primeiro acesso".';
  if (/not confirmed/i.test(m)) return 'Ainda não confirmaste o email: abre a mensagem que te enviámos e carrega na ligação.';
  if (/rate limit|over_email|too many/i.test(m) || estado === 429) return 'Foram pedidos emails a mais. Espera um pouco (até uma hora) e tenta outra vez.';
  if (/password/i.test(m) && /(least|short|weak|characters)/i.test(m)) return 'A palavra-passe tem de ter pelo menos 8 caracteres.';
  return m || ('Erro ' + estado);
}
function urlDeRetorno() { return location.origin + location.pathname; }
function guardarSessaoEmail(j, email) {
  CFG = Object.assign(CFG, { token: j.access_token, refresh: j.refresh_token, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000, email: email || CFG.email, modo: 'email' });
  guardarConfig();
}
async function renovarSessao() {
  if (CFG.modo !== 'email' || Date.now() < (CFG.expira || 0) - 60000) return;
  const j = await authPedido('/token?grant_type=refresh_token', { refresh_token: CFG.refresh });
  guardarSessaoEmail(j, CFG.email);
}
/** Depois de ter sessão: confirma na lista de administradores e abre a plataforma. */
async function concluirEntradaEmail() {
  let eu;
  try { eu = await rpcAdmin('bi_admin_eu'); }
  catch (e) { CFG = Object.assign(CFG, { token: '', refresh: '', modo: 'github', login: '' }); guardarConfig(); throw e; }
  if (!eu) throw new Error('Este email não está na lista de administradores.');
  CFG = Object.assign(CFG, { login: eu.nome, nome: eu.nome, email: eu.email });
  guardarConfig();
  await abrirApp();
}
async function entrarComEmail() {
  const email = $('#entrar-email').value.trim().toLowerCase(), palavra = $('#entrar-palavra').value;
  if (!email || !palavra) { mostraErroEntrada('Escreve o email e a palavra-passe.'); return; }
  mostraErroEntrada('');
  carregar(true);
  try {
    const j = await authPedido('/token?grant_type=password', { email, password: palavra });
    guardarSessaoEmail(j, email);
    await concluirEntradaEmail();
  } catch (e) { mostraErroEntrada(e.message || 'Não foi possível entrar.'); } finally { carregar(false); }
}
/** Entrar com a conta Google: o Google confirma o email; a lista de administradores (Supabase) decide quem pode. */
function entrarComGoogle() {
  location.href = SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(urlDeRetorno());
}
async function primeiroAcesso() {
  const v = await formulario('Primeiro acesso', [
    { nome: 'email', etiqueta: 'O teu email (o que o dono convidou)', tipo: 'email' },
    { nome: 'palavra', etiqueta: 'Escolhe a tua palavra-passe (8 ou mais caracteres)', tipo: 'password' },
    { nome: 'palavra2', etiqueta: 'Repete a palavra-passe', tipo: 'password' }
  ], { email: ($('#entrar-email').value || '').trim() }, {
    textoGuardar: 'Criar',
    nota: 'Vamos enviar-te um email para confirmar que é mesmo o teu. Abre-o e carrega na ligação; depois entras aqui com o email e a palavra-passe.',
    validar: x => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email || '')) return 'Escreve um email válido.';
      if ((x.palavra || '').length < 8) return 'A palavra-passe tem de ter pelo menos 8 caracteres.';
      if (x.palavra !== x.palavra2) return 'As duas palavras-passe não são iguais.';
      return '';
    }
  });
  if (!v) return;
  const email = v.email.trim().toLowerCase();
  carregar(true);
  try {
    if (!(await rpc('bi_convite_existe', { p_email: email }))) throw new Error('Este email ainda não foi convidado. Pede ao dono para o acrescentar em Administradores.');
    await authPedido('/signup?redirect_to=' + encodeURIComponent(urlDeRetorno()), { email, password: v.palavra });
    await perguntar('Confirma o teu email', `<p>Enviámos uma mensagem para <b>${esc(email)}</b>. Abre-a e carrega na ligação para confirmar.</p>
      <p class="suave">Se já tinhas criado a palavra-passe, não chega mensagem nenhuma: entra normalmente ou usa "Esqueci-me da palavra-passe". Vê também a pasta de spam.</p>`, 'Percebi', 'Fechar');
  } catch (e) { mostraErroEntrada(e.message); } finally { carregar(false); }
}
async function esqueciPalavra() {
  const email = ($('#entrar-email').value || '').trim().toLowerCase();
  if (!email) { mostraErroEntrada('Escreve primeiro o teu email, em cima.'); return; }
  carregar(true);
  try {
    await authPedido('/recover?redirect_to=' + encodeURIComponent(urlDeRetorno()), { email });
    mostraErroEntrada('');
    await perguntar('Verifica o teu email', `<p>Se <b>${esc(email)}</b> estiver na lista, enviámos uma mensagem com uma ligação para escolheres uma palavra-passe nova.</p>`, 'Percebi', 'Fechar');
  } catch (e) { mostraErroEntrada(e.message); } finally { carregar(false); }
}
/** Ao abrir a página a partir da ligação do email (confirmação ou recuperação). */
async function tratarLigacaoEmail() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (!h.get('access_token') && !h.get('error')) return false;
  history.replaceState(null, '', location.pathname);
  if (h.get('error')) { mostraErroEntrada('A ligação do email já não é válida (expirou ou já foi usada). Pede outra em "Esqueci-me da palavra-passe".'); return true; }
  const j = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') };
  try {
    if (h.get('type') === 'recovery') {
      const v = await formulario('Nova palavra-passe', [
        { nome: 'palavra', etiqueta: 'Escolhe a palavra-passe nova (8 ou mais caracteres)', tipo: 'password' },
        { nome: 'palavra2', etiqueta: 'Repete', tipo: 'password' }
      ], {}, { textoGuardar: 'Guardar', validar: x => (x.palavra || '').length < 8 ? 'Pelo menos 8 caracteres.' : x.palavra !== x.palavra2 ? 'As duas não são iguais.' : '' });
      if (!v) return true;
      carregar(true);
      await authPedido('/user', { password: v.palavra }, 'PUT', j.access_token);
      aviso('Palavra-passe guardada.');
    }
    guardarSessaoEmail(j, '');
    carregar(true);
    await concluirEntradaEmail();
  } catch (e) { mostraErroEntrada(e.message); } finally { carregar(false); }
  return true;
}

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
  if (chave === 'votacoes') return SOND_POR_APROVAR || '';
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

/** Pergunta de confirmação bonita. Devolve Promise<boolean>. */
function perguntar(titulo, html, textoSim, textoNao) {
  return new Promise(resolve => {
    const fundo = document.createElement('div');
    fundo.className = 'fundo-modal';
    fundo.style.zIndex = 120;
    fundo.innerHTML = `<div class="modal" style="max-width:440px">
      <header><h3>${esc(titulo)}</h3></header>
      <div class="modal-corpo">${html}</div>
      <div class="modal-pe">
        <button class="botao" data-nao>${esc(textoNao || 'Voltar')}</button>
        <button class="botao principal" data-sim>${esc(textoSim || 'Confirmar')}</button>
      </div></div>`;
    document.body.appendChild(fundo);
    const fechar = r => { fundo.remove(); resolve(r); };
    $('[data-nao]', fundo).addEventListener('click', () => fechar(false));
    $('[data-sim]', fundo).addEventListener('click', () => fechar(true));
  });
}

/* ------------------------- Fotos: reduzir e carregar ------------------------- */
// A foto é reduzida no próprio computador/telemóvel (tamanho e qualidade) antes de
// ser enviada, para a app carregar depressa e gastar poucos dados.
function lerImagem(ficheiro) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(ficheiro);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir essa imagem. Usa JPG, PNG ou WebP.')); };
    img.src = url;
  });
}
function canvasParaBlob(canvas, tipo, qualidade) {
  return new Promise(ok => canvas.toBlob(b => ok(b), tipo, qualidade));
}
async function reduzirImagem(ficheiro, maxLado) {
  const img = await lerImagem(ficheiro);
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * escala));
  const h = Math.max(1, Math.round(img.naturalHeight * escala));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  // WebP é o mais leve; se o navegador não souber, usa JPEG. Baixa a qualidade até ficar leve.
  let tipo = 'image/webp';
  let blob = await canvasParaBlob(canvas, tipo, 0.82);
  if (!blob || blob.type !== 'image/webp') { tipo = 'image/jpeg'; blob = await canvasParaBlob(canvas, tipo, 0.82); }
  for (const q of [0.72, 0.62, 0.52]) {
    if (blob.size <= 220 * 1024) break;
    blob = await canvasParaBlob(canvas, tipo, q);
  }
  return { blob, tipo, w, h, antes: ficheiro.size };
}
function blobBase64(blob) {
  return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
}
async function enviarImagem(ficheiro, maxLado) {
  const red = await reduzirImagem(ficheiro, maxLado || 1280);
  const base64 = await blobBase64(red.blob);
  const resumo = `Foto reduzida de ${Math.round(red.antes / 1024)} KB para ${Math.round(red.blob.size / 1024)} KB (${red.w}×${red.h}).`;
  if (CFG.modo === 'local') return { url: `data:${red.tipo};base64,${base64}`, resumo };
  const ext = red.tipo === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `data/imagens/${new Date().toISOString().slice(0, 7)}/${idNovo()}.${ext}`;
  const r = await ghFetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${caminho}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `Plataforma (${CFG.login}): foto`, content: base64, branch: CFG.branch })
  });
  if (!r.ok) throw new Error('Não foi possível guardar a foto (GitHub ' + r.status + ').');
  return { url: `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/${caminho}`, resumo };
}
function imagemValida(u) { return urlSegura(u) || (CFG.modo === 'local' && /^data:image\//.test(String(u || ''))); }

/** Formulário em modal. Devolve Promise com os valores, ou null se cancelar.
 *  opcoes: textoGuardar, nota, previsualizar(valores) → html, confirmar(valores) → {titulo, html} */
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
        ${opcoes.previsualizar ? '<button class="botao" data-previsualizar>👁 Pré-visualizar</button>' : ''}
        <button class="botao principal" data-guardar>${esc(opcoes.textoGuardar || 'Guardar')}</button>
      </div>
    </div>`;
    document.body.appendChild(fundo);
    if (opcoes.aoAbrir) opcoes.aoAbrir(fundo);
    const recolher = () => {
      const saida = {};
      for (const c of campos) {
        const el = $(`[name="${c.nome}"]`, fundo);
        if (!el) continue;
        if (c.tipo === 'checkbox' && c.varios) saida[c.nome] = $$(`[name="${c.nome}"]:checked`, fundo).map(x => x.value);
        else if (c.tipo === 'checkbox') saida[c.nome] = el.checked;
        else if (c.tipo === 'number') saida[c.nome] = el.value === '' ? 0 : Number(el.value);
        else saida[c.nome] = el.value.trim();
      }
      return saida;
    };
    // Campos que só aparecem para certos tipos (ex.: evento) ou quando uma caixa está marcada.
    const aplicarVisiveis = () => {
      const v = recolher();
      $$('[data-so]', fundo).forEach(el => {
        const [campo, lista] = el.dataset.so.split(':');
        const ok = lista.split(',').some(x => String(v[campo]) === x);
        el.style.display = ok ? '' : 'none';
      });
    };
    fundo.addEventListener('change', aplicarVisiveis);
    aplicarVisiveis();
    // Escolher foto: reduz e carrega logo.
    $$('input[type="file"][data-para]', fundo).forEach(inp => inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const destino = $(`[name="${inp.dataset.para}"]`, fundo);
      const info = $(`[data-info="${inp.dataset.para}"]`, fundo);
      try {
        carregar(true);
        info.textContent = 'A reduzir e a carregar a foto…';
        const r = await enviarImagem(f, Number(inp.dataset.max) || 1280);
        destino.value = r.url;
        info.textContent = r.resumo;
        const mini = $(`[data-mini="${inp.dataset.para}"]`, fundo);
        mini.src = r.url; mini.style.display = '';
      } catch (e) {
        info.textContent = '';
        aviso(e.message, true);
      } finally {
        carregar(false);
        inp.value = '';
      }
    }));
    $$('[data-limpar-imagem]', fundo).forEach(b => b.addEventListener('click', () => {
      const n = b.dataset.limparImagem;
      $(`[name="${n}"]`, fundo).value = '';
      const mini = $(`[data-mini="${n}"]`, fundo); mini.removeAttribute('src'); mini.style.display = 'none';
      $(`[data-info="${n}"]`, fundo).textContent = '';
    }));
    const fechar = r => { fundo.remove(); resolve(r); };
    $('[data-cancelar]', fundo).addEventListener('click', () => fechar(null));
    const bPrev = $('[data-previsualizar]', fundo);
    if (bPrev) bPrev.addEventListener('click', () => mostrarPrevisualizacao(opcoes.previsualizar(recolher())));
    $('[data-guardar]', fundo).addEventListener('click', async () => {
      const saida = recolher();
      if (opcoes.validar) { const erro = opcoes.validar(saida); if (erro) { aviso(erro, true); return; } }
      if (opcoes.confirmar) {
        const c = opcoes.confirmar(saida);
        const prev = opcoes.previsualizar ? `<div class="prev-pequena">${opcoes.previsualizar(saida)}</div>` : '';
        if (!await perguntar(c.titulo, c.html + prev, c.sim, 'Voltar a editar')) return;
      }
      fechar(saida);
    });
  });
}

/** Janela com o telemóvel a mostrar como vai ficar na app. */
function mostrarPrevisualizacao(html) {
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal';
  fundo.style.zIndex = 110;
  fundo.innerHTML = `<div class="modal" style="max-width:420px">
    <header><h3>Assim fica na app</h3></header>
    <div class="modal-corpo" style="display:flex;flex-direction:column;align-items:center">${html}</div>
    <div class="modal-pe"><button class="botao principal" data-fechar>Fechar</button></div></div>`;
  document.body.appendChild(fundo);
  $('[data-fechar]', fundo).addEventListener('click', () => fundo.remove());
  fundo.addEventListener('click', e => { if (e.target === fundo) fundo.remove(); });
}

function campoHtml(c, valor) {
  const v = valor != null ? valor : (c.valor != null ? c.valor : '');
  const nome = esc(c.nome);
  const so = c.so ? ` data-so="${esc(c.so)}"` : '';
  if (c.tipo === 'jogadores') return `<div class="campo"${so}><span class="rotulo">${esc(c.etiqueta)}</span><div data-jogadores></div></div>`;
  if (c.tipo === 'titulo') return `<h4 class="separador"${so}>${esc(c.etiqueta)}</h4>${c.ajuda ? `<p class="suave"${so}>${esc(c.ajuda)}</p>` : ''}`;
  if (c.tipo === 'checkbox' && c.varios) {
    const marcados = Array.isArray(v) ? v : [];
    return `<div class="campo"${so}><span class="rotulo">${esc(c.etiqueta)}</span>
      <div class="grupo-caixas">${(c.opcoes || []).map(o =>
        `<label><input type="checkbox" name="${nome}" value="${esc(o[0])}" ${marcados.includes(o[0]) ? 'checked' : ''}> ${esc(o[1])}</label>`).join('')}</div></div>`;
  }
  if (c.tipo === 'checkbox') {
    return `<div class="campo"${so}><span class="rotulo">${esc(c.etiqueta)}</span>
      <div class="grupo-caixas"><label><input type="checkbox" name="${nome}" ${v ? 'checked' : ''}> ${esc(c.ajuda || 'Sim')}</label></div></div>`;
  }
  if (c.tipo === 'imagem') {
    const tem = imagemValida(v);
    return `<div class="campo campo-imagem"${so}><span class="rotulo">${esc(c.etiqueta)}</span>
      <div class="imagem-linha">
        <img data-mini="${nome}" class="miniatura grande" ${tem ? `src="${esc(v)}"` : 'style="display:none"'} alt="">
        <div style="flex:1">
          <label class="botao pequeno principal" style="display:inline-block;cursor:pointer">📷 Escolher foto
            <input type="file" accept="image/*" data-para="${nome}" data-max="${c.maxLado || 1280}" style="display:none"></label>
          <button type="button" class="botao pequeno" data-limpar-imagem="${nome}">Tirar foto</button>
          <div class="suave" data-info="${nome}" style="margin-top:6px">${esc(c.ajuda || 'A foto é reduzida automaticamente antes de ser carregada.')}</div>
          <details style="margin-top:6px"><summary class="suave">ou colar o endereço de uma imagem</summary>
            <input type="url" name="${nome}" value="${esc(v)}" placeholder="https://..."></details>
        </div>
      </div></div>`;
  }
  let controlo;
  if (c.tipo === 'textarea') controlo = `<textarea name="${nome}" placeholder="${esc(c.dica || '')}">${esc(v)}</textarea>`;
  else if (c.tipo === 'select') controlo = `<select name="${nome}">${(c.opcoes || []).map(o =>
    `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  else controlo = `<input type="${esc(c.tipo || 'text')}" name="${nome}" value="${esc(v)}" placeholder="${esc(c.dica || '')}"${c.min != null ? ` min="${c.min}"` : ''}${c.max != null ? ` max="${c.max}"` : ''}${c.passo != null ? ` step="${c.passo}"` : ''}>`;
  return `<label${so}>${esc(c.etiqueta)}${controlo}${c.ajuda ? `<span class="suave">${esc(c.ajuda)}</span>` : ''}</label>`;
}

/* ---------------------- Pré-visualização (telemóvel) ---------------------- */
function telemovel(conteudo, legenda) {
  return `<div class="telemovel"><div class="tm-ecra">
    <div class="tm-barra"><span>9:41</span><span>●●● ▮</span></div>
    <div class="tm-topo"><b>Benfica Independente</b></div>
    <div class="tm-conteudo">${conteudo}</div>
  </div></div>${legenda ? `<p class="suave" style="text-align:center;margin-top:8px">${legenda}</p>` : ''}`;
}
function tmImagem(u, classe) { return imagemValida(u) ? `<img class="${classe || 'tm-foto'}" src="${esc(u)}" alt="">` : ''; }
function tmBotao(t) { return t ? `<span class="tm-botao">${esc(t)}</span>` : ''; }
function tmTexto(t) { return esc(t || '').replace(/\n/g, '<br>'); }

/* ===================== Conteúdos com aprovação de 2 administradores ===================== */
const DATAS = [
  { nome: 'de', etiqueta: 'Começa em (opcional)', tipo: 'date' },
  { nome: 'ate', etiqueta: 'Termina em (opcional)', tipo: 'date' }
];
const ATIVO = { nome: 'ativo', etiqueta: 'Ativo', tipo: 'checkbox', ajuda: 'Mostrar na app', valor: true };
const FOTO_AJUDA = 'Escolhe uma foto do computador ou do telemóvel: é reduzida automaticamente.';

/** Publicidade paga: dados privados (guardados no Supabase, nunca vão para a app). */
const PAGO = [
  { nome: '_pub', etiqueta: 'Publicidade paga (privado)', tipo: 'titulo', ajuda: 'Estes dados nunca aparecem na app: servem para a Monetização e os relatórios para o anunciante.' },
  { nome: 'pago', etiqueta: 'É publicidade paga?', tipo: 'checkbox', ajuda: 'Sim, um anunciante paga por isto' },
  { nome: 'anunciante', etiqueta: 'Anunciante (empresa)', tipo: 'text', so: 'pago:true' },
  { nome: 'contacto', etiqueta: 'Contacto do anunciante', tipo: 'text', dica: 'Nome, telefone ou email', so: 'pago:true' },
  { nome: 'modelo', etiqueta: 'Como paga', tipo: 'select', so: 'pago:true', valor: 'fixo', opcoes: [
    ['fixo', 'Valor fixo pela campanha toda'],
    ['cpm', 'Por cada 1000 visualizações (CPM)'],
    ['cpc', 'Por cada clique (CPC)'],
    ['cpa', 'Por cada venda ou inscrição (CPA)']] },
  { nome: 'preco', etiqueta: 'Preço em €', tipo: 'number', min: 0, passo: 0.01, so: 'pago:true',
    ajuda: 'Valor fixo: o total da campanha. CPM: € por cada 1000 visualizações. CPC: € por clique. CPA: € por venda/inscrição.' },
  { nome: 'orcamento', etiqueta: 'Máximo a cobrar em € (opcional)', tipo: 'number', min: 0, passo: 0.01, so: 'pago:true',
    ajuda: 'Quando o valor ganho chega aqui, a plataforma avisa para desligar a campanha.' },
  { nome: 'conversoes', etiqueta: 'Vendas/inscrições conseguidas', tipo: 'number', min: 0, so: 'pago:true',
    ajuda: 'O anunciante diz-nos quantas vendas ou inscrições vieram da app (vê no site dele pelas visitas marcadas "benficaindependente").' },
  { nome: 'notas', etiqueta: 'Notas internas', tipo: 'textarea', so: 'pago:true' }
];

const TIPOS = {
  noticias: {
    nome: 'Notícias', singular: 'notícia', icone: '📰',
    descricao: 'Notícias escritas pelo Benfica Independente. Aparecem no topo do separador <b>Artigos</b> da app.',
    titulo: x => x.titulo, resumo: x => x.resumo || x.texto,
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'resumo', etiqueta: 'Resumo (aparece na lista)', tipo: 'textarea' },
      { nome: 'texto', etiqueta: 'Texto completo (abre ao tocar)', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Foto (opcional)', tipo: 'imagem', maxLado: 1280, ajuda: FOTO_AJUDA },
      { nome: 'link', etiqueta: 'Ligação (opcional)', tipo: 'url', dica: 'https://...' },
      { nome: 'assinatura', etiqueta: 'Assinatura', tipo: 'text', dica: 'Ex.: Redação BI' },
      ATIVO
    ],
    valido: v => v.titulo ? '' : 'A notícia precisa de um título.',
    previsualizar: v => telemovel(
      `<div class="tm-seccao">Artigos</div>
       <div class="tm-cartao">${tmImagem(v.imagem)}<div class="tm-p"><div class="tm-etiqueta">NOTÍCIA BI</div>
         <b>${esc(v.titulo || 'Título da notícia')}</b><div class="tm-suave">${tmTexto(v.resumo)}</div>
         <div class="tm-mini">${esc(v.assinatura || 'Redação BI')}</div></div></div>
       <div class="tm-seccao">Ao tocar</div><div class="tm-p tm-suave">${tmTexto(v.texto || v.resumo)}</div>`,
      'No topo do separador Artigos')
  },
  destaques: {
    nome: 'Destaques', singular: 'destaque', icone: '★',
    descricao: 'Cartão grande no topo do <b>Início</b>: substitui o "Quem somos" entre as datas escolhidas (eventos e atividades).',
    titulo: x => x.titulo, resumo: x => x.texto,
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'texto', etiqueta: 'Texto (2 ou 3 linhas)', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Foto (opcional — sem foto ficam as fotos do estádio)', tipo: 'imagem', maxLado: 1280, ajuda: FOTO_AJUDA },
      { nome: 'link', etiqueta: 'Ligação do botão (opcional)', tipo: 'url', dica: 'https://...' },
      { nome: 'botao', etiqueta: 'Texto do botão', tipo: 'text', dica: 'Saber mais' },
      ...DATAS, ATIVO
    ],
    privados: PAGO,
    valido: v => v.titulo ? '' : 'O destaque precisa de um título.',
    previsualizar: v => telemovel(
      `<div class="tm-destaque">${imagemValida(v.imagem) ? tmImagem(v.imagem, 'tm-foto169') : '<div class="tm-foto169 tm-estadio">fotos do estádio</div>'}
        <div class="tm-p"><b class="tm-grande">${esc(v.titulo || 'Título do destaque')}</b>
        <div class="tm-suave-claro">${tmTexto(v.texto)}</div>${v.link ? tmBotao(v.botao || 'Saber mais') : ''}</div></div>
       <div class="tm-cartao tm-p tm-patreon">Apoia o Benfica Independente · Patreon ›</div>`,
      'No topo do Início' + (v.de || v.ate ? ` (${v.de ? dataDia(v.de) : 'já'} → ${v.ate ? dataDia(v.ate) : 'sem fim'})` : ''))
  },
  anuncios: {
    nome: 'Anúncios', singular: 'anúncio', icone: '💰',
    descricao: 'Publicidade na barra por cima do menu da app, em todos os ecrãs. Alterna com o Patreon de 5 em 5 segundos.',
    titulo: x => x.texto, resumo: x => x.link,
    campos: [
      { nome: 'texto', etiqueta: 'Texto do anúncio (curto)', tipo: 'text', dica: 'Ex.: Restaurante O Águia — 10% para sócios' },
      { nome: 'imagem', etiqueta: 'Logótipo (opcional)', tipo: 'imagem', maxLado: 300, ajuda: 'Logótipo quadrado. É reduzido automaticamente.' },
      { nome: 'link', etiqueta: 'Para onde leva ao tocar', tipo: 'url', dica: 'https://...' },
      { nome: 'peso', etiqueta: 'Frequência (1 a 5)', tipo: 'number', valor: 1, min: 1, max: 5, ajuda: '1 = normal, 2 = aparece o dobro das vezes' },
      ...DATAS, ATIVO
    ],
    privados: PAGO,
    valido: v => !v.texto ? 'O anúncio precisa de um texto.' : (v.link && !urlSegura(v.link) ? 'A ligação tem de começar por https://' : ''),
    previsualizar: v => telemovel(
      `<div class="tm-p tm-suave">(conteúdo do ecrã)</div><div style="flex:1"></div>
       <div class="tm-anuncio">${tmImagem(v.imagem, 'tm-logo')}<span>${esc(v.texto || 'Texto do anúncio')}</span><em>PUBLICIDADE</em></div>
       <div class="tm-menu"><span>Início</span><span>Artigos</span><span>Podcasts</span><span>Vídeos</span><span>Benfica</span></div>`,
      'Na barra por cima do menu, em todos os ecrãs')
  },
  publicacoes: {
    nome: 'Publicações', singular: 'publicação', icone: '🖼',
    descricao: 'Foto e/ou texto em cartão, no ecrã da app que escolheres.',
    titulo: x => x.titulo || '(sem título)', resumo: x => (x.posicoes || []).map(rotuloPosicao).join(', ') + ' · ' + (x.texto || ''),
    campos: [
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'texto', etiqueta: 'Texto', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Foto (opcional)', tipo: 'imagem', maxLado: 1080, ajuda: FOTO_AJUDA },
      { nome: 'link', etiqueta: 'Ligação do botão (opcional)', tipo: 'url', dica: 'https://...' },
      { nome: 'botao', etiqueta: 'Texto do botão', tipo: 'text', dica: 'Saber mais' },
      { nome: 'posicoes', etiqueta: 'Onde aparece na app', tipo: 'checkbox', varios: true, opcoes: POSICOES },
      ...DATAS, ATIVO
    ],
    privados: PAGO,
    valido: v => !(v.titulo || v.texto) ? 'Precisa de título ou texto.' : (!(v.posicoes || []).length ? 'Escolhe pelo menos um ecrã.' : ''),
    previsualizar: v => telemovel(
      `<div class="tm-seccao">${esc((v.posicoes || []).map(rotuloPosicao).join(' · ') || 'Ecrã escolhido')}</div>
       <div class="tm-cartao">${tmImagem(v.imagem)}<div class="tm-p"><b>${esc(v.titulo || '')}</b>
         <div class="tm-suave">${tmTexto(v.texto)}</div>${v.link ? tmBotao(v.botao || 'Saber mais') : ''}</div></div>`,
      'Aparece em: ' + esc((v.posicoes || []).map(rotuloPosicao).join(', ') || '—'))
  },
  notificacoes: {
    nome: 'Avisos', singular: 'aviso', icone: '🔔',
    descricao: 'Chega como <b>notificação</b> ao telemóvel e fica num cartão no Início. Pode ser uma mensagem, uma <b>publicidade</b> (imagem com legenda) ou um <b>evento</b> com ligação para participar.',
    titulo: x => x.titulo, resumo: x => ({ publicidade: 'Publicidade · ', evento: 'Evento · ' }[x.tipo] || '') + (x.texto || ''),
    campos: [
      { nome: 'tipo', etiqueta: 'Que tipo de aviso?', tipo: 'select', valor: 'mensagem', opcoes: [
        ['mensagem', 'Mensagem simples'],
        ['publicidade', 'Publicidade — abre uma imagem com legenda'],
        ['evento', 'Evento — com ligação para participar']] },
      { nome: 'titulo', etiqueta: 'Título', tipo: 'text' },
      { nome: 'texto', etiqueta: 'Texto da notificação (curto)', tipo: 'textarea' },
      { nome: 'imagem', etiqueta: 'Imagem', tipo: 'imagem', maxLado: 1080, ajuda: FOTO_AJUDA, so: 'tipo:publicidade,evento' },
      { nome: 'legenda', etiqueta: 'Legenda / descrição (aparece ao abrir)', tipo: 'textarea', so: 'tipo:publicidade,evento' },
      { nome: 'quando', etiqueta: 'Data e hora do evento', tipo: 'datetime-local', so: 'tipo:evento' },
      { nome: 'local', etiqueta: 'Local do evento', tipo: 'text', dica: 'Ex.: Casa do Benfica de Leiria', so: 'tipo:evento' },
      { nome: 'link', etiqueta: 'Ligação (site, inscrição, compra)', tipo: 'url', dica: 'https://...', so: 'tipo:publicidade,evento' },
      { nome: 'botao', etiqueta: 'Texto do botão', tipo: 'text', dica: 'Saber mais · Inscrever-me · Comprar', so: 'tipo:publicidade,evento' },
      { nome: 'notificar', etiqueta: 'Notificação', tipo: 'checkbox', ajuda: 'Enviar notificação para os telemóveis', valor: true },
      { nome: 'de', etiqueta: 'Enviar no dia e hora (opcional)', tipo: 'datetime-local',
        dica: 'Vazio = sai logo que for aprovado. Com dia e hora, a notificação chega nessa altura (com a app atualizada).' },
      { nome: 'ate', etiqueta: 'Termina em (opcional)', tipo: 'date' },
      ATIVO
    ],
    privados: PAGO,
    valido: v => !v.titulo ? 'O aviso precisa de um título.'
      : (v.tipo !== 'mensagem' && v.link && !urlSegura(v.link) ? 'A ligação tem de começar por https://' : ''),
    previsualizar: v => {
      const evento = v.tipo === 'evento';
      const quando = v.quando ? new Date(v.quando).toLocaleString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
      const notif = v.notificar !== false ? `<div class="tm-notif"><b>🔴 Benfica Independente</b><div><b>${esc(v.titulo || 'Título')}</b></div><div class="tm-suave">${esc(v.texto || '')}</div></div>` : '<div class="tm-mini" style="padding:8px">(sem notificação: só o cartão no Início)</div>';
      const ecra = v.tipo === 'mensagem'
        ? `<div class="tm-cartao tm-p"><b>🔔 ${esc(v.titulo || '')}</b><div class="tm-suave">${tmTexto(v.texto)}</div></div>`
        : `<div class="tm-seccao">Ao tocar abre</div><div class="tm-cartao">${tmImagem(v.imagem)}
            <div class="tm-p">${v.tipo === 'publicidade' ? '<div class="tm-etiqueta">PUBLICIDADE</div>' : '<div class="tm-etiqueta">EVENTO</div>'}
            <b class="tm-grande">${esc(v.titulo || '')}</b>
            ${evento && (quando || v.local) ? `<div class="tm-mini">📅 ${esc(quando)}${v.local ? '<br>📍 ' + esc(v.local) : ''}</div>` : ''}
            <div class="tm-suave">${tmTexto(v.legenda || v.texto)}</div>${v.link ? tmBotao(v.botao || (evento ? 'Inscrever-me' : 'Saber mais')) : ''}</div></div>`;
      return telemovel(notif + ecra, 'Notificação no telemóvel e cartão no Início');
    }
  }
};

function rotuloPosicao(chave) { const p = POSICOES.find(x => x[0] === chave); return p ? p[1] : chave; }

/* Dados privados de publicidade (por id), guardados no Supabase. */
let PRIV = {};
async function carregarPrivados() {
  if (CFG.modo === 'local') { try { PRIV = JSON.parse(localStorage.getItem(PREFIXO_LOCAL + 'privados') || '{}'); } catch (e) { PRIV = {}; } return; }
  try { PRIV = await rpcAdmin('bi_admin_anunciantes') || {}; } catch (e) { PRIV = {}; }
}
async function guardarPrivados(id, dados) {
  PRIV[id] = dados;
  if (CFG.modo === 'local') { localStorage.setItem(PREFIXO_LOCAL + 'privados', JSON.stringify(PRIV)); return; }
  await rpcAdmin('bi_admin_anunciante', { p_peca: id, p_dados: dados });
}

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

async function editarConteudo(tipo, id, modelo) {
  const T = TIPOS[tipo];
  const atual = id ? (ler(tipo) || []).find(x => x.id === id) : null;
  // Se já há uma alteração pendente, parte dela. Um modelo pronto preenche o formulário.
  const base = atual ? Object.assign({}, atual, atual.proposta && atual.proposta.campos ? atual.proposta.campos : {}) : Object.assign({ ativo: true }, modelo || {});
  const privAtuais = atual ? (PRIV[atual.id] || {}) : {};
  const campos = T.campos.concat(T.privados || []);
  const publicado = atual && atual.estado === 'publicado';
  const v = await formulario(atual ? `Editar ${T.singular}` : `Novo ${T.singular}`, campos, Object.assign({}, base, privAtuais), {
    textoGuardar: 'Publicar',
    nota: publicado ? 'Enquanto a alteração não for aprovada, a app continua a mostrar a versão atual.' : '',
    previsualizar: T.previsualizar,
    validar: x => T.valido(x)
      || (x.link && !urlSegura(x.link) ? 'As ligações têm de começar por https://' : '')
      || (x.imagem && !imagemValida(x.imagem) ? 'A imagem tem de ser uma foto escolhida ou um endereço https://' : ''),
    confirmar: () => ({
      titulo: 'Enviar para publicação?',
      html: `<p>${publicado ? 'A alteração' : `O ${T.singular}`} ${TESTE ? '' : 'vai para <b>aprovação</b>: '}${OUTRO_ADMIN}.</p>
             <p class="suave">Confirma na imagem abaixo se está tudo bem.</p>`,
      sim: 'Sim, enviar'
    })
  });
  if (!v) return;
  const novos = soCampos(tipo, v);
  const novoId = atual ? atual.id : idNovo();
  const ok = await alterarFicheiro(tipo, lista => {
    const x = lista.find(i => i.id === novoId);
    if (!x) {
      if (atual) { aviso('Este item já não existe (alguém apagou).', true); return false; }
      lista.unshift(Object.assign({ id: novoId, estado: TESTE ? 'publicado' : 'aprovacao', autor: CFG.login, criado: agoraISO(), aprovacoes: [CFG.login] }, TESTE ? { publicado: agoraISO() } : {}, novos));
    } else if (x.estado !== 'publicado') {
      Object.assign(x, novos, { aprovacoes: [CFG.login] }, TESTE ? { estado: 'publicado', publicado: agoraISO() } : {});   // mudou o texto: aprovações recomeçam
    } else if (TESTE) {
      Object.assign(x, novos, { alterado: agoraISO() });
    } else {
      x.proposta = { campos: novos, autor: CFG.login, criado: agoraISO(), aprovacoes: [CFG.login] };
    }
  }, `Plataforma (${CFG.login}): ${atual ? 'altera' : 'cria'} ${T.singular}${tituloCommit(T.titulo(novos))}`);
  if (ok && T.privados) {
    const priv = {};
    T.privados.filter(c => c.tipo !== 'titulo').forEach(c => { priv[c.nome] = v[c.nome]; });
    try { await guardarPrivados(novoId, priv); }
    catch (e) { aviso('Enviado, mas os dados da publicidade paga não foram guardados: ' + e.message, true); }
  }
  if (ok) { aviso(AVISO_ENVIADO); redesenhar(); }
}

/** Antes da aprovação que publica: mostra como fica e pede confirmação. */
async function confirmarAprovacao(tipo, id) {
  const T = TIPOS[tipo];
  const x = (ler(tipo) || []).find(e => e.id === id);
  const p = x && pendente(x);
  if (!p) return true;
  const n = new Set([...(p.aprovacoes || []), CFG.login]).size;
  if (n < APROVACOES) return true;
  let html;
  if (x.estado !== 'publicado') html = `Com a tua aprovação fica <b>publicado na app</b>${tipo === 'notificacoes' && x.notificar !== false ? ' e segue a <b>notificação</b> para os telemóveis' : ''}.`;
  else if (p.apagar) html = 'Com a tua aprovação é <b>apagado da app</b>.';
  else html = 'Com a tua aprovação a <b>alteração passa para a app</b>.';
  const valores = x.estado === 'publicado' && p.campos ? Object.assign({}, x, p.campos) : x;
  const prev = T.previsualizar && !p.apagar ? `<div class="prev-pequena">${T.previsualizar(valores)}</div>` : '';
  return perguntar('Aprovar e publicar?', `<p>${html}</p>${prev}`, 'Sim, publicar', 'Cancelar');
}

/** Título curto para a mensagem do registo (aparece no Registo de atividade). */
function tituloCommit(t) { return t ? ` «${String(t).replace(/\s+/g, ' ').slice(0, 60)}»` : ''; }

async function apagarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  const x = (ler(tipo) || []).find(i => i.id === id);
  if (!x) return;
  const publicado = x.estado === 'publicado';
  if (!confirm(publicado && TESTE ? `Apagar este ${T.singular}? Sai logo da app.` : publicado ? `Pedir para apagar este ${T.singular}? Fica na app até outro administrador aprovar.`
    : `Apagar este ${T.singular}? Ainda não estava na app.`)) return;
  const ok = await alterarFicheiro(tipo, lista => {
    const i = lista.findIndex(e => e.id === id);
    if (i < 0) return false;
    if (lista[i].estado !== 'publicado' || TESTE) lista.splice(i, 1);
    else lista[i].proposta = { apagar: true, autor: CFG.login, criado: agoraISO(), aprovacoes: [CFG.login] };
  }, `Plataforma (${CFG.login}): ${publicado ? 'pede para apagar' : 'apaga'} ${T.singular}${tituloCommit(T.titulo(x))}`);
  if (ok) { aviso(publicado && !TESTE ? 'Pedido enviado. Falta a aprovação de outro administrador.' : 'Apagado.'); redesenhar(); }
}

async function aprovarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  const antes = (ler(tipo) || []).find(i => i.id === id);
  if (!await confirmarAprovacao(tipo, id)) return;
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
  }, `Plataforma (${CFG.login}): aprova ${T.singular}${tituloCommit(antes && T.titulo(antes))}`);
  if (ok) { aviso(resultado); redesenhar(); }
}

async function rejeitarConteudo(tipo, id) {
  const T = TIPOS[tipo];
  const antes = (ler(tipo) || []).find(i => i.id === id);
  if (!confirm('Rejeitar? O pedido é retirado (o que já está na app fica igual).')) return;
  const ok = await alterarFicheiro(tipo, lista => {
    const i = lista.findIndex(e => e.id === id);
    if (i < 0) return false;
    if (lista[i].estado !== 'publicado') lista.splice(i, 1);
    else delete lista[i].proposta;
  }, `Plataforma (${CFG.login}): rejeita ${T.singular}${tituloCommit(antes && T.titulo(antes))}`);
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
    const fmt = val => c.tipo === 'imagem' ? (val ? '(foto)' : '') : Array.isArray(val) ? val.map(rotuloPosicao).join(', ') : (typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : (val == null ? '' : String(val)));
    const mudou = x.estado === 'publicado' && novo && fmt(antes) !== fmt(depois);
    return `<tr><th>${esc(c.etiqueta)}</th>
      ${x.estado === 'publicado' ? `<td class="mini">${esc(fmt(antes))}</td>` : ''}
      <td${mudou ? ' style="color:#ffd75e"' : ''}>${novo ? esc(fmt(depois)) : '<i>(apagar)</i>'}</td></tr>`;
  }).join('');
  formulario(`Ver ${T.singular}`, [], {}, {
    textoGuardar: 'Fechar',
    previsualizar: T.previsualizar && novo ? () => T.previsualizar(Object.assign({}, x, novo)) : null,
    nota: `<table class="tabela">${x.estado === 'publicado' ? '<tr><th></th><th>Agora na app</th><th>Proposto</th></tr>' : ''}${linhas}</table>`
  });
}

/* ------------------------------ Estatísticas ------------------------------ */
// Visualizações e cliques que a app conta (Supabase). No modo de teste mostra exemplos.
const TIPOS_PUB = ['anuncios', 'destaques', 'publicacoes', 'notificacoes'];

function pecasPublicidade() {
  const lista = [];
  TIPOS_PUB.forEach(t => (ler(t) || []).forEach(x => lista.push({ id: x.id, tipo: t, nome: TIPOS[t].titulo(x) || '(sem título)', item: x })));
  lista.push({ id: 'patreon', tipo: 'patreon', nome: 'Patreon (barra por cima do menu)', item: { estado: 'publicado' } });
  return lista;
}

function diaISO(d) { return d.toISOString().slice(0, 10); }
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return diaISO(d); }

function exemploEstatisticas(dias) {
  const linhas = [];
  const pecas = pecasPublicidade().filter(p => p.item.estado === 'publicado');
  pecas.forEach((p, i) => {
    let s = 7 + i * 13;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let d = Math.min(dias, 60) - 1; d >= 0; d--) {
      const imp = Math.round((p.tipo === 'patreon' ? 900 : 300 + i * 80) * (0.6 + rnd() * 0.8));
      linhas.push({ peca: p.id, dia: diasAtras(d), impressoes: imp, cliques: Math.round(imp * (0.008 + rnd() * 0.02)), alcance: Math.round(imp * 0.45) });
    }
  });
  return linhas;
}

const EST = {};   // dias → linhas
/** Contagens do uso da app (aberturas, separadores, programas) — não são publicidade. */
const USO_APP = /^(app|sep|prog):/;
const EST_TODAS = {};
async function lerTodasEstatisticas(dias) {
  if (EST_TODAS[dias]) return EST_TODAS[dias];
  const linhas = await rpcAdmin('bi_admin_estatisticas', { p_de: dias ? diasAtras(dias - 1) : null });
  return (EST_TODAS[dias] = linhas || []);
}
async function lerEstatisticas(dias) {
  if (EST[dias]) return EST[dias];
  if (CFG.modo === 'local') return exemploEstatisticas(dias);
  const linhas = await lerTodasEstatisticas(dias);
  return (EST[dias] = linhas.filter(l => !USO_APP.test(l.peca)));
}

function somar(linhas, id) {
  const s = { imp: 0, cli: 0, alc: 0 };
  linhas.forEach(l => { if (!id || l.peca === id) { s.imp += l.impressoes; s.cli += l.cliques; s.alc += l.alcance || 0; } });
  return s;
}

/** Quanto rendeu uma peça paga, segundo o modelo do contrato. */
function receitaDe(priv, s) {
  if (!priv || !priv.pago) return 0;
  const preco = Number(priv.preco || 0);
  let r = 0;
  if (priv.modelo === 'cpm') r = s.imp / 1000 * preco;
  else if (priv.modelo === 'cpc') r = s.cli * preco;
  else if (priv.modelo === 'cpa') r = Number(priv.conversoes || 0) * preco;
  else r = preco;
  const max = Number(priv.orcamento || 0);
  return max > 0 ? Math.min(r, max) : r;
}

function euros(n) { return (Number(n) || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); }
function numero(n) { return (Number(n) || 0).toLocaleString('pt-PT'); }
function pct(a, b) { return b ? (100 * a / b).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) + ' %' : '—'; }
function diasAte(data) { return data ? Math.ceil((new Date(data + 'T23:59:59').getTime() - Date.now()) / 86400e3) : null; }

/** Gráfico simples de barras: visualizações (vermelho) e cliques (branco) por dia. */
function grafico(linhas, dias) {
  const porDia = {};
  for (let d = dias - 1; d >= 0; d--) porDia[diasAtras(d)] = { imp: 0, cli: 0 };
  linhas.forEach(l => { const k = String(l.dia).slice(0, 10); if (porDia[k]) { porDia[k].imp += l.impressoes; porDia[k].cli += l.cliques; } });
  const ks = Object.keys(porDia);
  const max = Math.max(1, ...ks.map(k => porDia[k].imp));
  const W = 640, H = 160, bw = W / ks.length;
  const barras = ks.map((k, i) => {
    const h = porDia[k].imp / max * (H - 20), hc = Math.min(h, porDia[k].cli / max * (H - 20) * 10);
    return `<g><title>${dataDia(k)}: ${numero(porDia[k].imp)} visualizações, ${numero(porDia[k].cli)} cliques</title>
      <rect x="${i * bw + 1}" y="${H - h}" width="${Math.max(1, bw - 2)}" height="${h}" fill="#d40000" opacity=".85"/>
      <rect x="${i * bw + bw * 0.3}" y="${H - hc}" width="${Math.max(1, bw * 0.4)}" height="${hc}" fill="#fff" opacity=".8"/></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H + 18}" style="width:100%;height:auto;display:block">${barras}
    <text x="0" y="${H + 14}" fill="#9aa3af" font-size="11">${dataDia(ks[0])}</text>
    <text x="${W}" y="${H + 14}" fill="#9aa3af" font-size="11" text-anchor="end">${dataDia(ks[ks.length - 1])}</text></svg>
    <p class="suave" style="margin:6px 0 0"><span style="color:#d40000">■</span> visualizações &nbsp; <span style="color:#fff">■</span> cliques (escala ×10)</p>`;
}

/* ------------------------------ Painel e alertas ------------------------------ */
function alertas() {
  const lista = [];
  if (CFG.modo !== 'local') {
    const status = ler('status') || {};
    if (status.atualizado) {
      const horas = (Date.now() - new Date(status.atualizado).getTime()) / 3600e3;
      if (horas > 12) lista.push({ mau: true, texto: `O robô não atualiza os dados há ${Math.round(horas)} horas.` });
    } else {
      lista.push({ mau: true, texto: 'Não consegui ler o estado do robô (status.json).' });
    }
    if (status.agente && status.agente.ativo === false) lista.push({ mau: true, texto: 'O agente de IA (Gemini) não está a responder — confirma a chave GEMINI_API_KEY nos Secrets do repositório.' });
    if (status.robo && status.robo.chat && status.robo.chat.ok === false) lista.push({ mau: true, texto: 'O chat da app (Supabase) não respondeu na última verificação do robô.' });
    if (RUNS && RUNS.length) {
      const falhas = RUNS.filter(r => r.conclusion === 'failure');
      if (RUNS[0].conclusion === 'failure') lista.push({ mau: true, texto: `A última execução do robô falhou (${dataCurta(RUNS[0].created_at)}).`, link: RUNS[0].html_url });
      else if (falhas.length >= 3) lista.push({ mau: true, texto: `O robô falhou ${falhas.length} das últimas ${RUNS.length} vezes.`, link: falhas[0].html_url });
    }
    if (RUNS === false) lista.push({ mau: false, texto: 'Para ver as falhas do robô, a tua chave precisa da permissão "Actions: Read-only".' });
    if (totalAdmins() < APROVACOES) lista.push({ mau: true, texto: `Só há ${totalAdmins()} administrador(es): são precisos ${APROVACOES} para publicar.` });
  }
  if (MSG_NOVAS) lista.push({ mau: true, texto: `${MSG_NOVAS} mensagem(ns) de adeptos por responder.`, ecra: 'mensagens' });
  TIPOS_PUB.concat(['noticias']).forEach(t => (ler(t) || []).forEach(x => {
    if (x.estado !== 'publicado' || x.ativo === false) return;
    const d = diasAte(x.ate);
    if (d != null && d >= 0 && d <= 3) lista.push({ mau: false, texto: `${TIPOS[t].singular[0].toUpperCase() + TIPOS[t].singular.slice(1)} "${TIPOS[t].titulo(x)}" termina ${d === 0 ? 'hoje' : `daqui a ${d} dia(s)`}.`, ecra: t });
  }));
  (ALERTAS_DINHEIRO || []).forEach(a => lista.push(a));
  return lista;
}
let ALERTAS_DINHEIRO = [];

function ecraPainel(alvo) {
  const pendMim = Object.keys(TIPOS).reduce((n, t) => n + porAprovarPorMim(t), 0);
  const noAr = t => (ler(t) || []).filter(x => x.estado === 'publicado' && x.ativo !== false);
  const totalNoAr = Object.keys(TIPOS).reduce((n, t) => n + noAr(t).length, 0);
  const status = ler('status') || {};
  const robo = status.robo || {};
  const al = alertas();
  const ir = (ecra, texto, classe) => `<button class="botao ${classe || ''}" data-ir="${ecra}">${texto}</button>`;

  // Tudo o que espera aprovação (de qualquer pessoa).
  const porAprovar = [];
  Object.keys(TIPOS).forEach(t => (ler(t) || []).forEach(x => {
    const p = pendente(x);
    if (p && x.estado !== 'rejeitado') porAprovar.push({ t, x, p });
  }));

  let html = `<div class="grelha">
    ${azulejo(pendMim, 'À espera da tua aprovação')}
    ${azulejo(MSG_NOVAS, 'Mensagens por responder')}
    ${azulejo(totalNoAr, 'Conteúdos na app agora')}
    <div class="azulejo" data-est="imp"><div class="num">…</div><div class="rot">Visualizações (7 dias)</div></div>
    <div class="azulejo" data-est="cli"><div class="num">…</div><div class="rot">Cliques (7 dias)</div></div>
    <div class="azulejo" data-est="rec"><div class="num">…</div><div class="rot">Receita de publicidade (30 dias)</div></div>
  </div><div style="height:16px"></div>`;

  html += cartao('Atalhos', `<div class="atalhos">
    <button class="botao principal" data-criar="destaques">★ Novo destaque</button>
    <button class="botao" data-criar="notificacoes">🔔 Novo aviso</button>
    <button class="botao" data-criar="publicacoes">🖼 Nova publicação</button>
    <button class="botao" data-criar="anuncios">💰 Novo anúncio</button>
    <button class="botao" data-criar="noticias">📰 Nova notícia</button>
    ${ir('mensagens', '✉ Mensagens')} ${ir('monetizacao', '📊 Monetização')}</div>`);

  html += cartao('Alertas', al.length
    ? `<ul style="margin:0;padding-left:1.1em">${al.map(a => `<li style="margin-bottom:6px;${a.mau ? 'color:#ff8b8b' : ''}">${esc(a.texto)}
        ${a.link ? ` <a href="${esc(a.link)}" target="_blank" rel="noopener">ver</a>` : ''}${a.ecra ? ` <a href="#" data-ir="${a.ecra}">abrir</a>` : ''}</li>`).join('')}</ul>`
    : '<p><span class="pilula ok">Tudo a funcionar</span></p>',
    '<button class="botao pequeno" data-atualizar>Atualizar</button>');

  html += cartao(`Por aprovar (${porAprovar.length})`, porAprovar.length
    ? `<table class="tabela">${porAprovar.map(({ t, x, p }) => `<tr>
        <td>${TIPOS[t].icone} <b>${esc(TIPOS[t].titulo(x) || '')}</b><div class="mini">${esc(TIPOS[t].nome)} · ${x.estado === 'publicado' ? (p.apagar ? 'pedido para apagar' : 'alteração') : 'novo'} · por ${esc(p.autor || x.autor || '—')}</div></td>
        <td><span class="pilula espera">${(p.aprovacoes || []).length}/${APROVACOES}</span></td>
        <td class="direita">${precisaDeMim(x) ? `<button class="botao pequeno principal" data-ir="${t}">Ver e aprovar</button>` : '<span class="mini">Espera por outro administrador</span>'}</td></tr>`).join('')}</table>`
    : '<p class="suave">Nada à espera de aprovação.</p>');

  const agora = [];
  Object.keys(TIPOS).forEach(t => noAr(t).forEach(x => agora.push({ t, x })));
  html += cartao('Na app agora', agora.length
    ? `<table class="tabela">${agora.map(({ t, x }) => {
        const d = diasAte(x.ate);
        return `<tr><td>${TIPOS[t].icone} ${esc(TIPOS[t].titulo(x) || '')}<div class="mini">${esc(TIPOS[t].nome)}</div></td>
          <td class="mini">${x.ate ? (d < 0 ? 'terminou' : d === 0 ? 'termina hoje' : `termina em ${d} dia(s) (${dataDia(x.ate)})`) : 'sem data de fim'}</td></tr>`;
      }).join('')}</table>`
    : '<p class="suave">Ainda não há conteúdos da plataforma na app.</p>');

  html += cartao('Últimos 30 dias (publicidade e destaques)', '<div data-grafico><p class="suave">A carregar…</p></div>');

  html += cartao('Robô, chat e agente', `<table class="tabela">
    <tr><th>Última recolha de dados</th><td>${status.atualizado ? esc(dataCurta(status.atualizado)) : '<span class="suave">Sem informação</span>'}</td></tr>
    <tr><th>Podcasts ligados ao vídeo</th><td>${robo.podcasts_total ? `${numero(robo.podcasts_com_video)} de ${numero(robo.podcasts_total)}` : '<span class="suave">Sem informação</span>'}</td></tr>
    <tr><th>Chat da app</th><td>${robo.chat ? (robo.chat.ok ? `<span class="pilula ok">A funcionar</span> <span class="mini">${numero(robo.chat.conversas)} conversas</span>` : '<span class="pilula mau">Com problemas</span>') : '<span class="suave">Sem informação</span>'}</td></tr>
    <tr><th>Agente de IA</th><td>${status.agente ? (status.agente.ativo ? '<span class="pilula ok">Ativo</span>' : '<span class="pilula mau">Inativo</span>') : '<span class="suave">Sem informação</span>'}</td></tr>
    ${RUNS && RUNS.length ? `<tr><th>Últimas execuções</th><td>${RUNS.slice(0, 8).map(r =>
      `<span class="pilula ${r.conclusion === 'success' ? 'ok' : r.conclusion === 'failure' ? 'mau' : 'espera'}" title="${esc(dataCurta(r.created_at))}">${r.conclusion === 'success' ? '✓' : r.conclusion === 'failure' ? '✗' : '…'}</span>`).join(' ')}</td></tr>` : ''}
    <tr><th>Sessão</th><td>${esc(CFG.nome)} (${esc(CFG.login)}) · ${souDono() ? 'Dono' : 'Administrador'}${CFG.modo === 'local' ? ' · <span class="pilula espera">modo de teste</span>' : ''}</td></tr>
  </table>`);
  alvo.innerHTML = html;
  $('[data-atualizar]', alvo).addEventListener('click', async () => { Object.keys(EST).forEach(k => delete EST[k]); Object.keys(EST_TODAS).forEach(k => delete EST_TODAS[k]); await contarMensagensNovas(); recarregar(Object.keys(FICHEIROS)); });
  $$('[data-ir]', alvo).forEach(b => b.addEventListener('click', e => { e.preventDefault(); irPara(b.dataset.ir); }));
  $$('[data-criar]', alvo).forEach(b => b.addEventListener('click', () => { irPara(b.dataset.criar); editarConteudo(b.dataset.criar, null); }));

  // Números das estatísticas (chegam um pouco depois).
  (async () => {
    try {
      const l30 = await lerEstatisticas(30);
      const desde7 = diasAtras(6);
      const l7 = l30.filter(l => String(l.dia).slice(0, 10) >= desde7);
      const s7 = somar(l7);
      const rec = pecasPublicidade().reduce((n, p) => n + receitaDe(PRIV[p.id], somar(l30, p.id)), 0);
      const pon = (k, v) => { const e = $(`[data-est="${k}"] .num`, alvo); if (e) e.textContent = v; };
      pon('imp', numero(s7.imp)); pon('cli', numero(s7.cli)); pon('rec', euros(rec));
      const g = $('[data-grafico]', alvo);
      if (g) g.innerHTML = grafico(l30, 30) + (CFG.modo === 'local' ? '<p class="suave">Modo de teste: números de exemplo.</p>' : '');
    } catch (e) {
      const g = $('[data-grafico]', alvo); if (g) g.innerHTML = `<p class="suave">Sem estatísticas: ${esc(e.message)}</p>`;
    }
  })();
}

function irPara(ecra) {
  ECRAS_ATIVO = ecra;
  CONVERSA_ABERTA = null;
  redesenhar();
  window.scrollTo(0, 0);
}

/* ---------------------------- Monetização ---------------------------- */
const MODELOS = { fixo: 'Valor fixo', cpm: 'CPM (por 1000 vis.)', cpc: 'CPC (por clique)', cpa: 'CPA (por venda)' };
let MON_DIAS = 30;

async function calcularAlertasDinheiro() {
  ALERTAS_DINHEIRO = [];
  try {
    const l = await lerEstatisticas(365);
    pecasPublicidade().forEach(p => {
      const pr = PRIV[p.id];
      if (!pr || !pr.pago || !Number(pr.orcamento) || p.item.ativo === false) return;
      if (receitaDe(Object.assign({}, pr, { orcamento: 0 }), somar(l, p.id)) >= Number(pr.orcamento))
        ALERTAS_DINHEIRO.push({ mau: true, texto: `"${p.nome}" já chegou ao valor máximo combinado (${euros(pr.orcamento)}). Desliga a campanha ou combina mais com o anunciante.`, ecra: p.tipo });
    });
  } catch (e) { /* sem estatísticas */ }
}

async function lerReceitas() {
  if (CFG.modo === 'local') { try { return JSON.parse(localStorage.getItem(PREFIXO_LOCAL + 'receitas') || '[]'); } catch (e) { return []; } }
  return await rpcAdmin('bi_admin_receitas') || [];
}

/** Os números de uma peça no período. */
function metricas(p, linhas) {
  const s = somar(linhas, p.id);
  const pr = PRIV[p.id] || {};
  const rec = receitaDe(pr, s);
  const conv = Number(pr.conversoes || 0);
  return {
    s, pr, rec, conv,
    ctr: pct(s.cli, s.imp),
    cpm: s.imp ? euros(rec / s.imp * 1000) : '—',
    cpc: s.cli ? euros(rec / s.cli) : '—',
    cpv: s.imp ? euros(rec / s.imp) : '—',
    cpa: conv ? euros(rec / conv) : '—',
    taxaConv: pct(conv, s.cli)
  };
}

function ecraMonetizacao(alvo) {
  alvo.innerHTML = cartao('Monetização', '<p class="suave">A carregar…</p>');
  (async () => {
    let linhas, receitas;
    try {
      carregar(true);
      [linhas, receitas] = await Promise.all([lerEstatisticas(MON_DIAS), lerReceitas(), carregarPrivados()]);
    } catch (e) {
      alvo.innerHTML = cartao('Monetização', `<p class="erro">${esc(e.message)}</p>`);
      return;
    } finally { carregar(false); }

    const desde = MON_DIAS ? diasAtras(MON_DIAS - 1).slice(0, 7) : '0000-00';
    const outras = receitas.filter(r => String(r.mes).slice(0, 7) >= desde);
    const totalOutras = outras.reduce((n, r) => n + Number(r.valor || 0), 0);
    const pecas = pecasPublicidade().filter(p => p.item.estado === 'publicado' || PRIV[p.id]);
    const ms = pecas.map(p => Object.assign({ p }, metricas(p, linhas)));
    const pagas = ms.filter(m => m.pr.pago);
    const recPub = pagas.reduce((n, m) => n + m.rec, 0);
    const tot = somar(linhas);
    const recTotal = recPub + totalOutras;
    const periodo = MON_DIAS ? `últimos ${MON_DIAS} dias` : 'desde sempre';

    let html = cartao('Resumo — ' + periodo, `
      <div style="margin-bottom:12px">${[7, 30, 90, 365, 0].map(d => `<button class="botao pequeno ${d === MON_DIAS ? 'principal' : ''}" data-dias="${d}">${d ? d + ' dias' : 'Sempre'}</button>`).join(' ')}</div>
      <div class="grelha">
        ${azulejo(euros(recTotal), 'Receita total')}
        ${azulejo(euros(recPub), 'Publicidade vendida pelo BI')}
        ${azulejo(euros(totalOutras), 'Outras receitas (AdMob, patrocínios…)')}
        ${azulejo(numero(tot.imp), 'Visualizações')}
        ${azulejo(numero(tot.alc), 'Pessoas alcançadas (soma diária)')}
        ${azulejo(numero(tot.cli), 'Cliques')}
        ${azulejo(pct(tot.cli, tot.imp), 'CTR — taxa de cliques')}
        ${azulejo(tot.imp ? euros(recTotal / tot.imp * 1000) : '—', 'RPM — receita por 1000 visualizações')}
        ${azulejo(pagas.filter(m => m.p.item.ativo !== false && m.p.item.estado === 'publicado').length, 'Campanhas pagas ativas')}
      </div>
      ${CFG.modo === 'local' ? '<p class="suave" style="margin-top:10px">Modo de teste: as visualizações e cliques são números de exemplo.</p>' : ''}`);

    html += cartao('Visualizações e cliques por dia', grafico(linhas, MON_DIAS || 90));

    html += cartao('Campanhas e peças', `<p class="suave">Para cada anúncio, destaque, publicação ou aviso: quantas vezes foi visto e tocado. Nas pagas, quanto rendeu segundo o contrato. Toca em <b>Preço</b> para dizer como o anunciante paga.</p>
      <div class="tabela-rolar"><table class="tabela tabela-numeros">
      <tr><th>Peça</th><th>Contrato</th><th class="direita">Vis.</th><th class="direita">Pessoas</th><th class="direita">Cliques</th><th class="direita">CTR</th>
        <th class="direita">Vendas</th><th class="direita">Receita</th><th class="direita">CPM</th><th class="direita">CPC</th><th class="direita">CPA</th><th></th></tr>
      ${ms.map(m => `<tr>
        <td><b>${esc(m.p.nome)}</b><div class="mini">${m.p.tipo === 'patreon' ? 'Patreon' : esc(TIPOS[m.p.tipo].nome)}${m.pr.anunciante ? ' · ' + esc(m.pr.anunciante) : ''}${m.p.item.ativo === false ? ' · desligado' : ''}</div></td>
        <td class="mini">${m.pr.pago ? `${esc(MODELOS[m.pr.modelo] || 'Valor fixo')}<br>${euros(m.pr.preco)}${Number(m.pr.orcamento) ? ' · máx. ' + euros(m.pr.orcamento) : ''}` : (m.p.tipo === 'patreon' ? '—' : 'Não pago')}</td>
        <td class="direita">${numero(m.s.imp)}</td><td class="direita">${numero(m.s.alc)}</td><td class="direita">${numero(m.s.cli)}</td><td class="direita">${m.ctr}</td>
        <td class="direita">${m.pr.pago ? numero(m.conv) : '—'}</td>
        <td class="direita"><b>${m.pr.pago ? euros(m.rec) : '—'}</b></td>
        <td class="direita">${m.pr.pago ? m.cpm : '—'}</td><td class="direita">${m.pr.pago ? m.cpc : '—'}</td><td class="direita">${m.pr.pago ? m.cpa : '—'}</td>
        <td class="direita"><div class="linha-acoes">${m.p.tipo !== 'patreon' ? `<button class="botao pequeno" data-preco="${esc(m.p.id)}">Preço</button>` : ''}
          <button class="botao pequeno" data-relatorio="${esc(m.p.id)}">Relatório</button></div></td></tr>`).join('') || '<tr><td colspan="12"><p class="suave">Ainda não há peças publicadas.</p></td></tr>'}
      </table></div>`,
      '<button class="botao pequeno" data-csv>⬇ Exportar (Excel)</button>');

    html += cartao('Outras receitas', `<p class="suave">Dinheiro que não é contado pela app: AdMob, patrocínios de programas, eventos… Fica guardado por mês.</p>
      <table class="tabela"><tr><th>Mês</th><th>Origem</th><th class="direita">Valor</th><th>Notas</th><th></th></tr>
      ${receitas.map(r => `<tr><td>${esc(String(r.mes).slice(0, 7))}</td><td>${esc(r.origem)}</td><td class="direita">${euros(r.valor)}</td><td class="mini">${esc(r.notas || '')}</td>
        <td class="direita"><button class="botao pequeno perigo" data-apagar-receita="${esc(r.id)}">Apagar</button></td></tr>`).join('') || '<tr><td colspan="5"><p class="suave">Nenhuma.</p></td></tr>'}
      </table>`, '<button class="botao pequeno principal" data-receita>+ Acrescentar receita</button>');

    html += cartao('O que quer dizer cada número', `<table class="tabela glossario">
      <tr><th>Visualizações</th><td>Quantas vezes a peça apareceu no ecrã (o mesmo telemóvel só conta uma vez em cada 30 segundos).</td></tr>
      <tr><th>Pessoas</th><td>Quantos telemóveis diferentes a viram em cada dia (somado). Não identifica ninguém.</td></tr>
      <tr><th>Cliques</th><td>Quantas vezes tocaram na peça para abrir a ligação.</td></tr>
      <tr><th>CTR</th><td>Taxa de cliques: cliques ÷ visualizações. 1 % já é bom para publicidade.</td></tr>
      <tr><th>Vendas (conversões)</th><td>Compras ou inscrições que vieram da app. Só o anunciante sabe: as ligações levam a marca <b>utm_source=benficaindependente</b>, que ele vê no Google Analytics dele. Escreve aqui o número que ele te disser.</td></tr>
      <tr><th>CPM</th><td>Custo por 1000 visualizações: quanto o anunciante paga por cada 1000 vezes que o anúncio aparece.</td></tr>
      <tr><th>CPC</th><td>Custo por clique: quanto paga por cada toque no anúncio.</td></tr>
      <tr><th>CPV</th><td>Custo por visualização (CPM ÷ 1000). Útil para comparar com vídeos e redes sociais.</td></tr>
      <tr><th>CPA</th><td>Custo por aquisição: quanto paga por cada venda ou inscrição.</td></tr>
      <tr><th>RPM</th><td>Receita por 1000 visualizações de toda a app: diz quanto vale o espaço publicitário do BI. Usa-o para fazer preços.</td></tr>
      <tr><th>Valor máximo</th><td>Nos contratos por CPM/CPC/CPA, o máximo a cobrar. Quando se chega lá, aparece um alerta no Painel.</td></tr>
    </table>`);

    html += cartao('E o AdMob (Google)?', `<p class="suave">A ideia do BI é vender o espaço diretamente às empresas — fica tudo aqui, com estes números. O AdMob é a publicidade automática da Google: paga muito menos por visualização, mostra anúncios que o BI não escolhe e os números ficam na conta AdMob. Se um dia o usarem, basta pôr aqui por mês o valor que a Google pagar, em <b>Outras receitas</b>.</p>`);

    alvo.innerHTML = html;
    $$('[data-dias]', alvo).forEach(b => b.addEventListener('click', () => { MON_DIAS = Number(b.dataset.dias); ecraMonetizacao(alvo); }));
    $$('[data-preco]', alvo).forEach(b => b.addEventListener('click', async () => {
      const p = pecas.find(x => x.id === b.dataset.preco);
      const v = await formulario('Contrato — ' + p.nome, PAGO, Object.assign({ modelo: 'fixo' }, PRIV[p.id] || {}), { textoGuardar: 'Guardar' });
      if (!v) return;
      try { carregar(true); const d = {}; PAGO.filter(c => c.tipo !== 'titulo').forEach(c => { d[c.nome] = v[c.nome]; }); await guardarPrivados(p.id, d); aviso('Guardado.'); await calcularAlertasDinheiro(); ecraMonetizacao(alvo); }
      catch (e) { aviso(e.message, true); } finally { carregar(false); }
    }));
    $$('[data-relatorio]', alvo).forEach(b => b.addEventListener('click', () => {
      const m = ms.find(x => x.p.id === b.dataset.relatorio);
      relatorio(m, linhas.filter(l => l.peca === m.p.id), periodo);
    }));
    $('[data-csv]', alvo).addEventListener('click', () => {
      const cab = ['Peça', 'Tipo', 'Anunciante', 'Modelo', 'Preço €', 'Visualizações', 'Pessoas', 'Cliques', 'CTR', 'Vendas', 'Receita €'];
      const lin = ms.map(m => [m.p.nome, m.p.tipo, m.pr.anunciante || '', m.pr.pago ? (MODELOS[m.pr.modelo] || '') : '', m.pr.preco || '', m.s.imp, m.s.alc, m.s.cli, m.ctr, m.conv || '', m.pr.pago ? m.rec.toFixed(2) : '']);
      descarregarCsv(`monetizacao-${diaISO(new Date())}.csv`, [cab].concat(lin));
    });
    $('[data-receita]', alvo).addEventListener('click', async () => {
      const v = await formulario('Outra receita', [
        { nome: 'mes', etiqueta: 'Mês', tipo: 'month', valor: new Date().toISOString().slice(0, 7) },
        { nome: 'origem', etiqueta: 'De onde veio', tipo: 'text', dica: 'Ex.: AdMob, Patrocínio do programa X' },
        { nome: 'valor', etiqueta: 'Valor em €', tipo: 'number', min: 0, passo: 0.01 },
        { nome: 'notas', etiqueta: 'Notas', tipo: 'textarea' }
      ], {}, { textoGuardar: 'Guardar' });
      if (!v || !v.origem || !v.mes) return;
      try {
        carregar(true);
        if (CFG.modo === 'local') {
          const l = await lerReceitas(); l.unshift({ id: Date.now(), mes: v.mes + '-01', origem: v.origem, valor: v.valor, notas: v.notas });
          localStorage.setItem(PREFIXO_LOCAL + 'receitas', JSON.stringify(l));
        } else await rpcAdmin('bi_admin_receita', { p_mes: v.mes + '-01', p_origem: v.origem, p_valor: v.valor, p_notas: v.notas });
        aviso('Guardado.'); ecraMonetizacao(alvo);
      } catch (e) { aviso(e.message, true); } finally { carregar(false); }
    });
    $$('[data-apagar-receita]', alvo).forEach(b => b.addEventListener('click', async () => {
      if (!await perguntar('Apagar receita?', '<p>Esta receita deixa de contar nos totais.</p>', 'Apagar', 'Cancelar')) return;
      try {
        carregar(true);
        if (CFG.modo === 'local') {
          const l = (await lerReceitas()).filter(r => String(r.id) !== b.dataset.apagarReceita);
          localStorage.setItem(PREFIXO_LOCAL + 'receitas', JSON.stringify(l));
        } else await rpcAdmin('bi_admin_receita_apagar', { p_id: Number(b.dataset.apagarReceita) });
        ecraMonetizacao(alvo);
      } catch (e) { aviso(e.message, true); } finally { carregar(false); }
    }));
  })();
}

function descarregarCsv(nome, linhas) {
  const csv = '﻿' + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome;
  a.click();
}

/** Relatório para enviar ao anunciante (abre numa janela; dá para imprimir ou guardar em PDF). */
function relatorio(m, linhas, periodo) {
  const dias = linhas.slice().sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
  const w = window.open('', '_blank');
  if (!w) { aviso('O navegador bloqueou a janela do relatório. Permite janelas para esta página.', true); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>Relatório — ${esc(m.p.nome)}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:760px;margin:30px auto;color:#222;padding:0 16px}h1{color:#c00;margin-bottom:0}
    table{border-collapse:collapse;width:100%;margin:14px 0}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f6f6f6}
    .g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.c{border:1px solid #ddd;border-radius:8px;padding:10px}.c b{font-size:1.4em;display:block}
    .s{color:#666;font-size:.9em}@media print{button{display:none}}</style></head><body>
    <button onclick="print()">Imprimir / guardar em PDF</button>
    <h1>Benfica Independente</h1><p class="s">Relatório de publicidade · ${esc(periodo)} · gerado em ${new Date().toLocaleDateString('pt-PT')}</p>
    <h2>${esc(m.p.nome)}</h2>${m.pr.anunciante ? `<p>Anunciante: <b>${esc(m.pr.anunciante)}</b></p>` : ''}
    <div class="g">
      <div class="c"><b>${numero(m.s.imp)}</b>visualizações</div>
      <div class="c"><b>${numero(m.s.alc)}</b>pessoas (soma diária)</div>
      <div class="c"><b>${numero(m.s.cli)}</b>cliques</div>
      <div class="c"><b>${m.ctr}</b>taxa de cliques (CTR)</div>
      ${m.pr.pago ? `<div class="c"><b>${numero(m.conv)}</b>vendas/inscrições</div><div class="c"><b>${euros(m.rec)}</b>valor (${esc(MODELOS[m.pr.modelo] || 'fixo')})</div>` : ''}
    </div>
    ${m.pr.pago ? `<p class="s">CPM ${m.cpm} · CPC ${m.cpc} · CPV ${m.cpv} · CPA ${m.cpa}</p>` : ''}
    <table><tr><th>Dia</th><th>Visualizações</th><th>Pessoas</th><th>Cliques</th></tr>
    ${dias.map(l => `<tr><td>${dataDia(l.dia)}</td><td>${numero(l.impressoes)}</td><td>${numero(l.alcance)}</td><td>${numero(l.cliques)}</td></tr>`).join('') || '<tr><td colspan="4">Sem dados neste período.</td></tr>'}</table>
    <p class="s">Os cliques levam a marca utm_source=benficaindependente, utm_medium=app, utm_campaign=${esc(m.p.id)} — no Google Analytics do anunciante dá para ver as visitas e compras que vieram da app.</p>
    </body></html>`);
  w.document.close();
}

/* ---------------------------- Administradores ---------------------------- */
function ecraAdminsEmail(alvo) {
  const lista = EMAILS || [];
  alvo.innerHTML = cartao('Quem pode gerir a app',
    `<p class="suave">Cada pessoa entra com o seu <b>email</b> e uma palavra-passe só dela. Para acrescentar alguém, escreve o nome e o email. Essa pessoa abre a plataforma, carrega em <b>Primeiro acesso</b>, escolhe a palavra-passe e confirma o email (chega-lhe uma mensagem). Se se esquecer, usa <b>Esqueci-me da palavra-passe</b>.</p>
     <table class="tabela"><tr><th>Nome</th><th>Email</th><th>Papel</th><th></th></tr>
     ${lista.map(p => `<tr><td><b>${esc(p.nome)}</b></td><td>${esc(p.email)}</td>
       <td>${p.dono ? '<span class="pilula ok">Dono</span>' : '<span class="pilula">Administrador</span>'}</td>
       <td class="direita">${souDono() && p.nome !== CFG.login ? `<button class="botao pequeno perigo" data-remover-email="${esc(p.email)}">Remover</button>` : ''}</td></tr>`).join('')}
     </table>
     ${souDono() ? '' : '<p class="suave">Só um dono pode mudar esta lista.</p>'}
     <p class="suave"><b>Donos</b> gerem tudo, incluindo esta lista. <b>Administradores</b> criam e publicam conteúdos.</p>`,
    souDono() ? '<button class="botao pequeno principal" data-convidar>＋ Convidar</button>' : '');
  const conv = $('[data-convidar]', alvo);
  if (conv) conv.addEventListener('click', async () => {
    const v = await formulario('Convidar administrador', [
      { nome: 'nome', etiqueta: 'Nome', tipo: 'text', dica: 'Como aparece na plataforma' },
      { nome: 'email', etiqueta: 'Email', tipo: 'email' },
      { nome: 'dono', etiqueta: 'Dono', tipo: 'checkbox', ajuda: 'Também pode convidar e remover pessoas' }
    ], {}, { textoGuardar: 'Convidar', validar: x => !x.nome || x.nome.trim().length < 2 ? 'Escreve o nome.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email || '') ? 'Email inválido.' : '' });
    if (!v) return;
    try { carregar(true); await rpcAdmin('bi_admin_email_adicionar', { p_email: v.email, p_nome: v.nome, p_dono: !!v.dono }); EMAILS = await rpcAdmin('bi_admin_email_lista'); aviso('Convidado. Diz-lhe para carregar em "Primeiro acesso" na plataforma.'); }
    catch (e) { aviso(e.message, true); } finally { carregar(false); }
    redesenhar();
  });
  $$('[data-remover-email]', alvo).forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remover esta pessoa? Deixa de poder entrar.')) return;
    try { carregar(true); await rpcAdmin('bi_admin_email_remover', { p_email: b.dataset.removerEmail }); EMAILS = await rpcAdmin('bi_admin_email_lista'); aviso('Removido.'); }
    catch (e) { aviso(e.message, true); } finally { carregar(false); }
    redesenhar();
  }));
}

function ecraAdmins(alvo) {
  if (CFG.modo === 'email') return ecraAdminsEmail(alvo);
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
    ], v, {
      textoGuardar: 'Publicar',
      previsualizar: prevVersao,
      confirmar: x => ({
        titulo: 'Publicar a versão ' + (x.versao || '') + '?',
        html: '<p>Os telemóveis com uma versão mais antiga passam a ver este aviso para atualizar.</p><p class="suave">Confirma na imagem abaixo se está tudo bem.</p>',
        sim: 'Sim, publicar'
      })
    });
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
      <tr><th>Modo</th><td>${CFG.modo === 'local' ? 'Teste (sem internet — nada chega à app)' : CFG.modo === 'email' ? 'Email ' + esc(CFG.email || '') : 'GitHub'}</td></tr>
    </table>`, '<button class="botao pequeno perigo" data-sair>Sair</button>');
  alvo.insertAdjacentHTML('beforeend', cartao('Repositórios',
    `<div class="formulario linha-dupla">
      <label>Dono (conta GitHub)<input id="cfg-owner" value="${esc(CFG.owner)}"></label>
      <label>Ramo<input id="cfg-branch" value="${esc(CFG.branch)}"></label>
      <label>Repositório público (a app lê)<input id="cfg-repo" value="${esc(CFG.repo)}"></label>
    </div>
    <p class="suave">Não mudes nada se não tiveres a certeza. Mensagens, preços dos anunciantes e estatísticas ficam no Supabase do BI.</p>`,
    '<button class="botao pequeno principal" data-guardar>Guardar</button>'));
  alvo.insertAdjacentHTML('beforeend', cartao('Instalar no telemóvel',
    `<p class="suave">Abre a plataforma no Chrome do telemóvel, menu ⋮ → <b>Adicionar ao ecrã principal</b> (no iPhone: Safari → Partilhar → <b>Adicionar ao ecrã principal</b>). Fica como uma app, sem Play Store nem App Store.</p>`));
  $('[data-sair]', alvo).addEventListener('click', sair);
  $('[data-guardar]', alvo).addEventListener('click', async () => {
    CFG.owner = $('#cfg-owner', alvo).value.trim() || DONO_PADRAO;
    CFG.repo = $('#cfg-repo', alvo).value.trim() || REPO_PADRAO;
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
  const cab = { 'apikey': SUPABASE_CHAVE, 'Content-Type': 'application/json' };
  if (CFG.modo === 'email' && CFG.token) { await renovarSessao(); cab['Authorization'] = 'Bearer ' + CFG.token; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: cab,
    body: JSON.stringify(args || {})
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch (e) { /* ignora */ }
  if (!r.ok) {
    const m = (j && j.message) || ('Supabase ' + r.status);
    if (m === 'sem acesso') throw new Error(CFG.modo === 'local' || !CFG.token
      ? 'Estás no modo de teste: nada é enviado para a app. Para publicar a sério, sai (Definições › Sair) e entra com a conta GitHub.'
      : CFG.modo === 'email' ? 'O teu email não está na lista de administradores.' : 'A tua conta GitHub não está na lista de administradores.');
    throw new Error(m);
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
      const opcoesGestor = login => ({
        textoGuardar: 'Publicar',
        previsualizar: x => prevGestor(Object.assign({ login }, x), lista),
        confirmar: () => ({ titulo: 'Gravar este gestor?', html: '<p>A lista muda logo no chat e no formulário de contacto da app.</p>', sim: 'Sim, gravar' })
      });
      const guardar = async (login, v) => {
        try {
          carregar(true);
          await rpcAdmin('bi_admin_gestor', { p_login: login, p_nome: v.nome, p_funcao: v.funcao, p_email: v.email, p_ativo: v.ativo, p_ordem: v.ordem });
          aviso('Guardado.'); ecraGestores(alvo);
        } catch (e) { aviso(e.message, true); } finally { carregar(false); }
      };
      $('[data-novo]', alvo).addEventListener('click', async () => {
        const v = await formulario('Novo gestor', CAMPOS, { ordem: lista.length + 1, ativo: true }, opcoesGestor());
        if (!v || !v.nome) return;
        const login = v.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
        guardar(login, v);
      });
      $$('[data-editar]', alvo).forEach(b => b.addEventListener('click', async () => {
        const g = lista.find(x => x.login === b.dataset.editar);
        const v = await formulario('Editar ' + g.nome, CAMPOS, g, opcoesGestor(g.login));
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
/* ============================ Ajuda com IA (assistente) ============================ */

const URL_ASSISTENTE = `${SUPABASE_URL}/functions/v1/bi-assistente`;
const AJUDA = [];   // conversa desta sessão: { eu: true|false, texto }
let AJUDA_OCUPADO = false;
const AJUDA_SUGESTOES = [
  'Como publico um destaque para um evento?',
  'Como funcionam as duas aprovações?',
  'Como ponho um anúncio pago e vejo quanto rendeu?',
  'Escreve-me um aviso para um jantar de adeptos'
];

function ecraAjuda(alvo) {
  if (CFG.modo === 'local' || !CFG.token) {
    alvo.innerHTML = cartao('Ajuda (IA)', '<p class="suave">O assistente só funciona quando se entra com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  const bolhas = AJUDA.map(m => `
    <div class="mensagem" style="${m.eu ? '' : 'border-left:3px solid var(--vermelho)'}">
      <div class="mensagem-topo"><strong>${m.eu ? 'Eu' : 'Assistente'}</strong></div>
      <div>${esc(m.texto).replace(/\n/g, '<br>')}</div>
    </div>`).join('');
  alvo.innerHTML = cartao('Ajuda (IA)',
    `<p class="suave">Pergunta como se faz alguma coisa na plataforma ou na app, ou pede ajuda para escrever um texto. As respostas são geradas por IA (Gemini, grátis): confirma antes de publicar.</p>
     ${AJUDA.length ? '' : `<div style="margin:10px 0">${AJUDA_SUGESTOES.map(s => `<button class="botao pequeno" data-sugestao="${esc(s)}" style="margin:0 6px 6px 0">${esc(s)}</button>`).join('')}</div>`}
     <div class="lista" id="ajuda-lista">${bolhas}${AJUDA_OCUPADO ? '<p class="suave">O assistente está a escrever…</p>' : ''}</div>
     <div class="formulario" style="margin-top:14px">
       <label>A tua pergunta<textarea id="ajuda-texto" placeholder="Escreve aqui…" ${AJUDA_OCUPADO ? 'disabled' : ''}></textarea></label>
       <button class="botao principal" data-perguntar ${AJUDA_OCUPADO ? 'disabled' : ''}>Perguntar</button>
       ${AJUDA.length ? '<button class="botao" data-limpar>Nova conversa</button>' : ''}
     </div>`);
  const caixa = $('#ajuda-texto', alvo);
  const enviar = t => perguntarAjuda(alvo, t);
  $('[data-perguntar]', alvo).addEventListener('click', () => enviar(caixa.value));
  caixa.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(caixa.value); });
  $$('[data-sugestao]', alvo).forEach(b => b.addEventListener('click', () => enviar(b.dataset.sugestao)));
  const limpar = $('[data-limpar]', alvo);
  if (limpar) limpar.addEventListener('click', () => { AJUDA.length = 0; ecraAjuda(alvo); });
  if (!AJUDA_OCUPADO) caixa.focus();
}

async function perguntarAjuda(alvo, texto) {
  texto = (texto || '').trim();
  if (!texto || AJUDA_OCUPADO) return;
  AJUDA.push({ eu: true, texto });
  AJUDA_OCUPADO = true;
  ecraAjuda(alvo);
  try {
    const r = await fetch(URL_ASSISTENTE, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_CHAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'gestor', gh: CFG.token, mensagens: AJUDA })
    });
    const j = await r.json().catch(() => ({}));
    if (j.limite) AJUDA.push({ eu: false, texto: 'Hoje já se fizeram muitas perguntas (o limite grátis do dia acabou). Tenta amanhã.' });
    else if (j.texto) AJUDA.push({ eu: false, texto: j.texto });
    else if (r.status === 403) AJUDA.push({ eu: false, texto: 'A tua conta GitHub não está na lista de administradores.' });
    else AJUDA.push({ eu: false, texto: 'O assistente não está disponível agora. Tenta daqui a pouco.' + (j.erro ? ` (${j.erro})` : '') });
  } catch (e) {
    AJUDA.push({ eu: false, texto: 'Sem ligação ao assistente. Confirma a internet e tenta outra vez.' });
  } finally {
    AJUDA_OCUPADO = false;
  }
  if (ECRAS_ATIVO === 'ajuda') ecraAjuda(alvo);
}


/* --------------------------- Entrada simples: "O que queres fazer?" --------------------------- */
const PATREON_LINK = 'https://www.patreon.com/c/slbindependente/home';
const MODELOS_PRONTOS = [
  { nome: '🍽 Jantar de adeptos', tipo: 'notificacoes', v: { tipo: 'evento', titulo: 'Jantar de adeptos do Benfica Independente',
      texto: 'Junta-te a nós! Lugares limitados — inscreve-te já.', legenda: 'Um jantar entre benfiquistas, com os autores do BI. Traz amigos!\n\nPreço: … € por pessoa.',
      botao: 'Inscrever-me', local: '', notificar: true } },
  { nome: '🎙 Novo episódio', tipo: 'notificacoes', v: { tipo: 'mensagem', titulo: 'Novo episódio no ar! 🎙️',
      texto: 'Já podes ouvir o episódio desta semana na app — até com o ecrã desligado.', notificar: true } },
  { nome: '🔴 Hoje há direto', tipo: 'notificacoes', v: { tipo: 'mensagem', titulo: 'Hoje há direto 🔴',
      texto: 'Logo à noite estamos em direto. Ouve na app, nos phones ou no carro.', notificar: true } },
  { nome: '🤝 Parceiro novo', tipo: 'publicacoes', v: { titulo: 'Novo parceiro do BI',
      texto: 'Damos as boas-vindas a … Obrigado por apoiarem a voz independente do universo encarnado.', botao: 'Saber mais', posicoes: ['inicio'] } },
  { nome: '❤ Apoia no Patreon', tipo: 'destaques', v: { titulo: 'Apoia o Benfica Independente',
      texto: 'Com o teu apoio no Patreon continuamos livres e independentes.', botao: 'Apoiar', link: PATREON_LINK } },
  { nome: '📰 Comunicado do BI', tipo: 'noticias', v: { titulo: 'Comunicado do Benfica Independente', resumo: '', texto: '' } }
];

function ecraInicio(alvo) {
  const pendMim = Object.keys(TIPOS).reduce((n, t) => n + porAprovarPorMim(t), 0) + (SOND_POR_APROVAR || 0);
  const botao = (acao, icone, texto, sub, classe) => `<button class="botao grande ${classe || ''}" ${acao}>
      <span class="grande-icone">${icone}</span><span><b>${esc(texto)}</b>${sub ? `<span class="grande-sub">${sub}</span>` : ''}</span></button>`;
  let html = cartao('O que queres fazer?', `<div class="grandes">
    ${botao('data-criar="notificacoes"', '🔔', 'Enviar um aviso', 'Notificação para os telemóveis — já ou num dia e hora', 'principal')}
    ${botao('data-ir="aprovar"', '✅', 'Aprovar o que está pendente', pendMim ? `<b>${pendMim}</b> à tua espera` : 'Nada à tua espera')}
    ${botao('data-ir="mensagens"', '✉', 'Responder a mensagens', MSG_NOVAS ? `<b>${MSG_NOVAS}</b> por responder` : 'Sem mensagens novas')}
    ${botao('data-criar="noticias"', '📰', 'Escrever uma notícia', 'Aparece em Artigos › Notícias do BI')}
    ${botao('data-criar="publicacoes"', '🖼', 'Pôr uma foto e texto na app', 'Escolhes em que ecrãs aparece')}
    ${botao('data-criar="destaques"', '★', 'Mudar o destaque do Início', 'O cartão grande do topo')}
    ${botao('data-criar="anuncios"', '💰', 'Novo anúncio pago', 'Na barra por cima do menu')}
    ${botao('data-ir="votacoes" data-nova-sondagem', '🗳', 'Criar uma sondagem', 'Os adeptos votam na app')}
    ${botao('data-ir="votacoes" data-nova-fotos', '📸', 'Sondagem com fotos', 'Até 4 jogadores, com foto e nome')}
    ${botao('data-ir="quadro"', '📋', 'Quadro tático em direto', 'Mexe nos jogadores e a app vê na hora')}
    ${botao('data-ir="estatisticas"', '📈', 'Ver como a app está a ser usada', 'Aberturas, separadores e programas')}
    ${botao('data-ir="ajuda"', '✦', 'Pedir ajuda à IA', 'Explica como fazer qualquer coisa')}
  </div>`);
  html += cartao('Modelos prontos', `<p class="suave">Começa a partir de um texto já escrito — só tens de mudar o que quiseres antes de enviar.</p>
    <div class="atalhos">${MODELOS_PRONTOS.map((m, i) => `<button class="botao" data-modelo="${i}">${esc(m.nome)}</button>`).join('')}</div>`);
  alvo.innerHTML = html;
  $$('[data-criar]', alvo).forEach(b => b.addEventListener('click', () => { irPara(b.dataset.criar); editarConteudo(b.dataset.criar, null); }));
  $$('[data-modelo]', alvo).forEach(b => b.addEventListener('click', () => {
    const m = MODELOS_PRONTOS[Number(b.dataset.modelo)];
    irPara(m.tipo); editarConteudo(m.tipo, null, JSON.parse(JSON.stringify(m.v)));
  }));
  $$('[data-ir]', alvo).forEach(b => b.addEventListener('click', () => {
    const destino = b.dataset.ir === 'aprovar' ? 'painel' : b.dataset.ir;
    irPara(destino);
    if (b.hasAttribute('data-nova-sondagem')) novaSondagem();
    if (b.hasAttribute('data-nova-fotos')) novaSondagemFotos();
  }));
}

/* --------------------------- Sondagens e Homem do jogo --------------------------- */
let SOND_POR_APROVAR = 0;

async function contarSondagensPorAprovar() {
  if (CFG.modo === 'local' || !CFG.token) { SOND_POR_APROVAR = 0; return; }
  try {
    const l = await rpcAdmin('bi_admin_sondagens');
    SOND_POR_APROVAR = l.filter(s => !s.aprovada_por && s.criada_por !== CFG.login && !s.fechada).length;
  } catch (e) { SOND_POR_APROVAR = 0; }
}

function barrasVotos(opcoes, votos) {
  const total = votos.reduce((a, b) => a + b, 0);
  return opcoes.map((o, i) => {
    const n = votos[i] || 0, p = total ? Math.round(n / total * 100) : 0;
    return `<div class="voto-linha"><div class="voto-barra" style="width:${p}%"></div><span>${esc(o)}</span><b>${p}% <span class="mini">(${numero(n)})</span></b></div>`;
  }).join('') + `<div class="mini">${numero(total)} ${total === 1 ? 'voto' : 'votos'}</div>`;
}

/** Data como a app a mostra: "18 nov às 21h30". */
function fimTexto(d) {
  const x = new Date(d);
  if (isNaN(x)) return '';
  const mes = x.toLocaleString('pt-PT', { month: 'short' }).replace('.', '');
  return `${x.getDate()} ${mes} às ${String(x.getHours()).padStart(2, '0')}h${String(x.getMinutes()).padStart(2, '0')}`;
}

/** Como a sondagem aparece no Início da app: aberta (para votar) e depois com o resultado. */
function prevSondagem(pergunta, opcoes, fecha, votos) {
  opcoes = opcoes.length ? opcoes : ['Resposta 1', 'Resposta 2'];
  votos = votos || opcoes.map(() => 0);
  const total = votos.reduce((a, b) => a + b, 0);
  const venc = total ? votos.indexOf(Math.max(...votos)) : -1;
  const fim = fecha ? fimTexto(fecha) : '';
  const cartaoTopo = `<div class="tm-cartao tm-p"><div class="tm-etiqueta">SONDAGEM DO BI · VOTA</div>
      <b class="tm-grande">${esc(pergunta || 'A tua pergunta')}</b>
      ${opcoes.map(o => `<span class="tm-opcao">${esc(o)}</span>`).join('')}
      <div class="tm-mini">Vê os resultados depois de votares.${fim ? ` Termina a ${esc(fim)}.` : ''}</div></div>`;
  const cartaoRes = `<div class="tm-cartao tm-p"><div class="tm-etiqueta">RESULTADO DA SONDAGEM</div>
      <b class="tm-grande">${esc(pergunta || 'A tua pergunta')}</b>
      ${opcoes.map((o, i) => { const pc = total ? Math.round((votos[i] || 0) / total * 100) : 0;
        return `<div class="tm-res"><i style="width:${pc}%"></i><span>${i === venc ? '🏆 ' : ''}${esc(o)}</span><b>${pc}%</b></div>`; }).join('')}
      <div class="tm-mini">${numero(total)} ${total === 1 ? 'voto' : 'votos'} · votação terminada</div></div>`;
  return telemovel(`<div class="tm-seccao">Início — enquanto está aberta</div>${cartaoTopo}
      <div class="tm-mini" style="text-align:center">(a foto do BI e o "Feito por benfiquistas" ficam escondidos)</div>`,
      'No topo do Início, no lugar da foto do BI' + (fim ? ` — até ${esc(fim)}` : ''))
    + telemovel(`<div class="tm-cartao tm-p tm-suave" style="text-align:center">Feito por benfiquistas</div>
      <div class="tm-seccao">Depois de terminar (48 horas)</div>${cartaoRes}`,
      'Resultado por baixo do "Feito por benfiquistas"; depois vai para o Histórico de sondagens (menu ⋮)');
}

/** Lê as respostas escritas no formulário (uma por linha, no máximo 80 letras cada). */
function opcoesSondagem(texto) {
  return String(texto || '').split('\n').map(t => t.trim()).filter(Boolean).map(t => t.slice(0, 80));
}

/** Janela "Aprovar e publicar?" da versão da app, com o aviso que aparece nos telemóveis. */
function prevVersao(v) {
  return telemovel(`<div style="flex:1"></div>
    <div class="tm-dialogo"><div class="tm-etiqueta">${v.obrigatoria ? 'ATUALIZAÇÃO IMPORTANTE' : 'HÁ UMA VERSÃO NOVA DA APP'}</div>
      <div class="tm-suave-claro">${tmTexto(v.notas || '(sem texto do que mudou)')}</div>
      ${tmBotao('Descarregar versão ' + (v.versao || '?'))}</div><div style="flex:1"></div>`,
    'Aparece nos telemóveis Android com uma versão mais antiga do que ' + esc(v.versao || '?'));
}

/** Como a lista de gestores aparece no chat e no formulário de contacto da app. */
function prevGestor(v, lista) {
  const outros = (lista || []).filter(g => g.ativo && g.nome !== v.nome && g.login !== v.login);
  const todos = (v.ativo ? [{ nome: v.nome, funcao: v.funcao, ordem: v.ordem, novo: true }] : []).concat(outros)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return telemovel(`<div class="tm-seccao">Chat da app</div>
    <div class="tm-notif">Tem algum em especial com quem gostava de falar?</div>
    ${todos.map(g => `<div class="tm-cartao tm-p" style="${g.novo ? 'outline:2px solid #d40000' : ''}"><b>${esc(g.nome || 'Nome')}</b>
      <div class="tm-mini" style="margin-top:2px">${esc(g.funcao || '')}</div></div>`).join('')}
    <span class="tm-opcao">Qualquer um</span>`,
    v.ativo ? 'O contorno encarnado é o que estás a gravar. O email nunca aparece na app.' : 'Desligado: não aparece na app.');
}

async function novaSondagem() {
  const v = await formulario('Nova sondagem', [
    { nome: 'pergunta', etiqueta: 'Pergunta', tipo: 'text', dica: 'Ex.: Quem deve ser o titular na baliza?' },
    { nome: 'opcoes', etiqueta: 'Respostas (uma por linha, de 2 a 6)', tipo: 'textarea', dica: 'Sim\nNão' },
    { nome: 'fecha', etiqueta: 'Termina no dia e hora', tipo: 'datetime-local' }
  ], {}, {
    textoGuardar: 'Enviar para aprovação',
    previsualizar: x => prevSondagem(x.pergunta, opcoesSondagem(x.opcoes), x.fecha),
    confirmar: () => ({
      titulo: 'Enviar a sondagem para aprovação?',
      html: `<p>A sondagem ${TESTE ? '' : 'vai para <b>aprovação</b>: '}${OUTRO_ADMIN}.</p>
             <p class="suave">Confirma nas imagens abaixo se está tudo bem.${CFG.modo === 'local' ? ' <b>Modo de teste:</b> nada vai ser enviado.' : ''}</p>`,
      sim: 'Sim, enviar'
    }),
    nota: (CFG.modo === 'local' ? '<b>Modo de teste:</b> podes experimentar e pré-visualizar, mas a sondagem não é enviada. Para publicar a sério entra com a conta GitHub.<br><br>' : '') + 'Só aparece na app depois de outro administrador aprovar. Enquanto está aberta fica no topo do Início, no lugar da foto do BI; quando termina, o resultado fica 48 horas por baixo do "Feito por benfiquistas" e depois vai para o "Histórico de sondagens" no menu ⋮. Cada telemóvel vota uma vez.',
    validar: x => {
      const o = String(x.opcoes || '').split('\n').map(t => t.trim()).filter(Boolean);
      if (!x.pergunta || x.pergunta.trim().length < 3) return 'Escreve a pergunta.';
      if (o.length < 2 || o.length > 6) return 'Põe entre 2 e 6 respostas, uma por linha.';
      if (!x.fecha || new Date(x.fecha) <= new Date()) return 'Escolhe o dia e a hora em que termina (no futuro).';
      return '';
    }
  });
  if (!v) return;
  const opcoes = opcoesSondagem(v.opcoes);
  if (CFG.modo === 'local' || !CFG.token) {
    aviso('Modo de teste: a sondagem NÃO foi enviada. Para a publicar, sai e entra com a conta GitHub.', true);
    return;
  }
  try {
    carregar(true);
    await rpcAdmin('bi_admin_sondagem_criar', { p_pergunta: v.pergunta, p_opcoes: opcoes, p_fecha: v.fecha ? new Date(v.fecha).toISOString() : null });
    aviso(TESTE ? 'Sondagem publicada.' : 'Sondagem enviada. Falta a aprovação de outro administrador.');
  } catch (e) { aviso(e.message, true); } finally { carregar(false); }
  if (ECRAS_ATIVO === 'votacoes') redesenhar();
}

function ecraVotacoes(alvo) {
  if (CFG.modo === 'local') {
    alvo.innerHTML = cartao('Sondagens e Homem do jogo', `<p class="aviso mau">Estás no <b>modo de teste</b>: as sondagens não são enviadas para a app.
      Para publicar a sério, sai (Definições › Sair) e entra com a conta GitHub.</p>
      <p class="suave">Podes na mesma experimentar o formulário e ver como a sondagem fica na app.</p>`,
      '<button class="botao pequeno principal" data-nova>＋ Experimentar uma sondagem</button> <button class="botao pequeno principal" data-nova-fotos>📸 Experimentar com fotos</button>');
    $('[data-nova]', alvo).addEventListener('click', novaSondagem);
    $('[data-nova-fotos]', alvo).addEventListener('click', novaSondagemFotos);
    return;
  }
  alvo.innerHTML = cartao('Sondagens', '<p class="suave">A carregar…</p>');
  (async () => {
    let sond, hdj;
    try {
      carregar(true);
      [sond, hdj] = await Promise.all([rpcAdmin('bi_admin_sondagens'), rpcAdmin('bi_admin_hdj')]);
    } catch (e) {
      alvo.innerHTML = cartao('Sondagens', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-sondagens.sql no Supabase.</p>`);
      return;
    } finally { carregar(false); }
    SOND_POR_APROVAR = sond.filter(s => !s.aprovada_por && s.criada_por !== CFG.login && !s.fechada).length;
    montaMenu();
    // Onde está cada sondagem na app.
    const estado = s => {
      if (!s.aprovada_por) return '<span class="pilula espera">À espera de aprovação</span>';
      const fim = s.fecha ? new Date(s.fecha).getTime() : 0, agora = Date.now();
      if (!s.fechada && fim > agora) return '<span class="pilula ok">Aberta · no topo do Início</span>';
      const horas = s.fotos ? 24 : 48;
      if (fim && agora < fim + horas * 3600e3) return `<span class="pilula ok">Terminada · resultado no Início até ${esc(dataCurta(new Date(fim + horas * 3600e3).toISOString()))}</span>`;
      return '<span class="pilula">No histórico (menu ⋮ da app)</span>';
    };
    let html = cartao('Sondagens', `<p class="suave">Enquanto está aberta, a sondagem aparece no topo do Início da app, no lugar da foto do BI (várias ficam empilhadas). Quando termina, o resultado fica 48 horas por baixo do "Feito por benfiquistas" e depois passa para o "Histórico de sondagens" (menu ⋮ da app). Um voto por telemóvel.</p>
      ${sond.length ? sond.map(s => `<div class="sondagem">
        <div class="linha-acoes" style="justify-content:space-between"><b>${esc(s.pergunta)}</b> ${estado(s)}</div>
        <div class="mini">Criada por ${esc(s.criada_por)} · ${esc(dataCurta(s.criada))}${s.aprovada_por ? ` · aprovada por ${esc(s.aprovada_por)}` : ''}${s.fecha ? ` · fecha ${esc(dataCurta(s.fecha))}` : ''}</div>
        ${s.fotos ? `<div class="linha-acoes">${s.opcoes.map((o, i) => fotoRedonda(s.fotos[i], o, 38)).join('')}</div>` : ''}
        ${barrasVotos(s.opcoes, s.votos)}
        <div class="linha-acoes">
          <button class="botao pequeno" data-ver-s="${s.id}">👁 Ver como fica na app</button>
          ${!s.aprovada_por && s.criada_por !== CFG.login ? `<button class="botao pequeno principal" data-aprovar-s="${s.id}">Aprovar</button>` : ''}
          ${!s.aprovada_por && s.criada_por === CFG.login ? '<span class="mini">Espera por outro administrador</span>' : ''}
          ${s.aprovada_por && !s.fechada ? `<button class="botao pequeno" data-fechar-s="${s.id}">Fechar votação</button>` : ''}
          <button class="botao pequeno perigo" data-apagar-s="${s.id}">Apagar</button>
        </div></div>`).join('') : '<p class="suave">Ainda não há sondagens.</p>'}`,
      '<button class="botao pequeno principal" data-nova>＋ Nova sondagem</button> <button class="botao pequeno principal" data-nova-fotos>📸 Com fotos</button>');
    // Estado da votação de cada jogo: aberta (24 horas a contar do fim do jogo) ou terminada por um administrador.
    const hdjAberta = j => !j.fechado && j.aberto && Date.now() < new Date(j.aberto).getTime() + 24 * 3600e3;
    const hdjEstado = j => j.fechado
      ? `<span class="pilula">Terminada ${esc(dataCurta(j.fechado))}${j.por ? ' por ' + esc(j.por) : ''}</span>`
      : hdjAberta(j) ? '<span class="pilula ok">Aberta · a decorrer na app</span>' : '<span class="pilula">Terminada (24 horas)</span>';
    html += cartao('Homem do jogo (MVP)', `<p class="suave">Automático: quando o jogo da equipa principal acaba, a votação abre na app (no Início e no ecrã do jogo) e fecha sozinha ao fim de 24 horas. Se estás a fazer o direto, podes <b>terminá-la já</b> com o botão abaixo: a app deixa de aceitar votos e mostra logo o pódio com os 3 mais votados, com percentagem e número de votos. O resultado fica 1 hora no Início e depois só na ficha do jogo.</p>
      ${hdj.length ? hdj.map(j => `<div class="sondagem">
          <div class="linha-acoes" style="justify-content:space-between"><b>${esc(j.titulo || j.jogo)}</b> ${hdjEstado(j)}</div>
          <div class="mini">${numero(j.total)} ${j.total == 1 ? 'votante' : 'votantes'}${j.ultimo ? ` · último registo ${esc(dataCurta(j.ultimo))}` : ''}</div>
          ${barrasVotos((j.votos || []).map((t, i) => (['🥇 ', '🥈 ', '🥉 '][i] || '') + t.jogador), (j.votos || []).map(t => t.n))}
          ${hdjAberta(j) ? `<div class="linha-acoes"><button class="botao pequeno principal" data-fechar-hdj="${esc(j.jogo)}" data-titulo="${esc(j.titulo || j.jogo)}">🏁 Terminar votação agora</button></div>` : ''}</div>`).join('')
        : '<p class="suave">Ainda não houve votações. O jogo aparece aqui assim que acabar e a votação abrir na app.</p>'}`);
    alvo.innerHTML = html;
    $('[data-nova]', alvo).addEventListener('click', novaSondagem);
    $('[data-nova-fotos]', alvo).addEventListener('click', novaSondagemFotos);
    const prevDe = x => x.fotos ? prevSondagemFotos(x.pergunta, (x.opcoes || []).map((o, i) => ({ nome: o, foto: x.fotos[i] || '' })), x.fecha, x.votos)
      : prevSondagem(x.pergunta, x.opcoes || [], x.fecha, x.votos);
    const acao = async (fn, id, ok) => {
      try { carregar(true); await rpcAdmin(fn, { p_id: Number(id) }); aviso(ok); } catch (e) { aviso(e.message, true); } finally { carregar(false); }
      redesenhar();
    };
    const sondPorId = id => sond.find(x => String(x.id) === String(id));
    $$('[data-ver-s]', alvo).forEach(b => b.addEventListener('click', () => {
      const x = sondPorId(b.dataset.verS);
      mostrarPrevisualizacao(prevDe(x));
    }));
    $$('[data-aprovar-s]', alvo).forEach(b => b.addEventListener('click', async () => {
      const x = sondPorId(b.dataset.aprovarS);
      const ok = await perguntar('Aprovar e publicar?',
        `<p>Com a tua aprovação a sondagem <b>aparece logo no topo do Início</b> da app${x.fecha ? ` e fica aberta até <b>${esc(fimTexto(x.fecha))}</b>` : ''}.</p>
         <div class="prev-pequena">${prevDe(x)}</div>`, 'Sim, publicar', 'Cancelar');
      if (ok) acao('bi_admin_sondagem_aprovar', b.dataset.aprovarS, 'Aprovada: já está na app.');
    }));
    $$('[data-fechar-hdj]', alvo).forEach(b => b.addEventListener('click', async () => {
      const ok = await perguntar('Terminar a votação?',
        `<p>A votação do Homem do jogo <b>${esc(b.dataset.titulo)}</b> fecha <b>já</b>. A app deixa de aceitar votos e passa a mostrar o pódio com o resultado. Não dá para a reabrir.</p>`,
        'Sim, terminar', 'Cancelar');
      if (!ok) return;
      try { carregar(true); await rpcAdmin('bi_admin_hdj_fechar', { p_jogo: b.dataset.fecharHdj }); aviso('Votação terminada. A app mostra o resultado em menos de um minuto.'); }
      catch (e) { aviso(e.message, true); } finally { carregar(false); }
      redesenhar();
    }));
    $$('[data-fechar-s]', alvo).forEach(b => b.addEventListener('click', () => {
      if (confirm('Fechar a votação? Os resultados continuam visíveis na app durante uns dias.')) acao('bi_admin_sondagem_fechar', b.dataset.fecharS, 'Votação fechada.');
    }));
    $$('[data-apagar-s]', alvo).forEach(b => b.addEventListener('click', () => {
      if (confirm('Apagar esta sondagem e os votos? Não dá para desfazer.')) acao('bi_admin_sondagem_apagar', b.dataset.apagarS, 'Apagada.');
    }));
  })();
}

/* --------------------------- Estatísticas da app (anónimas) --------------------------- */
let USO_DIAS = 30;
function ecraEstatisticasApp(alvo) {
  if (CFG.modo === 'local') {
    alvo.innerHTML = cartao('Estatísticas da app', '<p class="suave">Só funciona ao entrar com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  alvo.innerHTML = cartao('Estatísticas da app', '<p class="suave">A carregar…</p>');
  (async () => {
    let linhas;
    try { carregar(true); linhas = (await lerTodasEstatisticas(USO_DIAS)).filter(l => USO_APP.test(l.peca)); }
    catch (e) { alvo.innerHTML = cartao('Estatísticas da app', `<p class="erro">${esc(e.message)}</p>`); return; }
    finally { carregar(false); }
    const grupo = pref => {
      const m = {};
      linhas.filter(l => l.peca.startsWith(pref)).forEach(l => {
        const k = l.peca.slice(pref.length);
        m[k] = m[k] || { n: 0, pessoas: 0 };
        m[k].n += l.impressoes; m[k].pessoas += l.alcance || 0;
      });
      return Object.entries(m).sort((a, b) => b[1].n - a[1].n);
    };
    const abrir = linhas.filter(l => l.peca === 'app:abrir');
    const totalAberturas = abrir.reduce((n, l) => n + l.impressoes, 0);
    const pessoasDia = abrir.length ? Math.round(abrir.reduce((n, l) => n + (l.alcance || 0), 0) / USO_DIAS) : 0;
    const maxDia = abrir.reduce((m, l) => Math.max(m, l.alcance || 0), 0);
    const tabela = (lista, rot) => lista.length ? `<table class="tabela tabela-numeros"><tr><th>${rot}</th><th class="direita">Vezes</th><th class="direita">Pessoas (soma diária)</th></tr>
      ${lista.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="direita">${numero(v.n)}</td><td class="direita">${numero(v.pessoas)}</td></tr>`).join('')}</table>`
      : '<p class="suave">Ainda sem dados (só conta a partir da versão nova da app).</p>';
    let html = cartao('Resumo', `<div style="margin-bottom:12px">${[7, 30, 90].map(d => `<button class="botao pequeno ${d === USO_DIAS ? 'principal' : ''}" data-uso="${d}">${d} dias</button>`).join(' ')}</div>
      <div class="grelha">
        ${azulejo(numero(totalAberturas), 'Vezes que a app foi aberta')}
        ${azulejo(numero(pessoasDia), 'Pessoas por dia (média)')}
        ${azulejo(numero(maxDia), 'Melhor dia (pessoas)')}
      </div>
      <p class="suave" style="margin-top:10px">Anónimo: cada telemóvel tem um número aleatório só para contar pessoas diferentes. Não se sabe quem é.</p>`);
    html += cartao('Aberturas por dia', grafico(abrir, USO_DIAS));
    html += cartao('Separadores mais vistos', tabela(grupo('sep:'), 'Separador'));
    html += cartao('Programas mais ouvidos', tabela(grupo('prog:').slice(0, 20), 'Programa'));
    alvo.innerHTML = html;
    $$('[data-uso]', alvo).forEach(b => b.addEventListener('click', () => { USO_DIAS = Number(b.dataset.uso); redesenhar(); }));
  })();
}

/* --------------------------- Registo de atividade --------------------------- */
function ecraAtividade(alvo) {
  if (CFG.modo === 'local') {
    alvo.innerHTML = cartao('Registo de atividade', '<p class="suave">Só funciona ao entrar com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  alvo.innerHTML = cartao('Registo de atividade', '<p class="suave">A carregar…</p>');
  (async () => {
    const itens = [];
    let falhas = [];
    try {
      carregar(true);
      const [commits, sb] = await Promise.all([
        ghFetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/commits?per_page=100`)
          .then(r => r.ok ? r.json() : Promise.reject(new Error('GitHub ' + r.status))).catch(e => { falhas.push(e.message); return []; }),
        rpcAdmin('bi_admin_atividade').catch(e => { falhas.push(e.message); return []; })
      ]);
      commits.filter(c => /^Plataforma/.test(c.commit.message)).forEach(c => {
        const m = c.commit.message.split('\n')[0];
        const quem = (m.match(/^Plataforma \(([^)]+)\)/) || [])[1] || (c.author && c.author.login) || c.commit.author.name;
        itens.push({ quando: c.commit.author.date, quem, texto: m.replace(/^Plataforma( \([^)]+\))?:\s*/, '') });
      });
      sb.forEach(a => itens.push({ quando: a.quando, quem: a.quem, texto: a.acao + (a.detalhe ? ` «${a.detalhe}»` : '') }));
    } finally { carregar(false); }
    itens.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    alvo.innerHTML = cartao('Registo de atividade', `<p class="suave">Quem criou, aprovou, alterou ou apagou o quê, e quando (avisos, notícias, publicações, anúncios, destaques, sondagens, administradores e versões).</p>
      ${falhas.length ? `<p class="erro">Parte do registo não carregou: ${esc(falhas.join(' · '))}</p>` : ''}
      ${itens.length ? `<table class="tabela">${itens.slice(0, 150).map(i => `<tr><td class="mini" style="white-space:nowrap">${esc(dataCurta(i.quando))}</td>
        <td><b>${esc(i.quem)}</b></td><td>${esc(i.texto)}</td></tr>`).join('')}</table>` : '<p class="suave">Ainda sem registos.</p>'}`);
  })();
}

/* ------------------------ Programas, séries e temas ------------------------
   Os feeds dizem o que existe: rubricas dos vídeos do canal, programas do podcast e
   temas do blogue. Aqui os administradores marcam o que aparece na app. O que fica
   marcado é gravado em data/programas.json, que a app lê. Um programa novo aparece
   nesta lista SEM visto — só entra na app quando alguém o marcar. */

const PROG_TIPOS = [
  { chave: 'youtube', nome: 'Programas YouTube', ajuda: 'Rubricas dos vídeos do canal (Voo Picado, Antevisões, Rescaldos…).' },
  { chave: 'podcasts', nome: 'Podcasts', ajuda: 'Programas do podcast (Rescaldos, Megafone, Modalidades Benfica…).' },
  { chave: 'artigos', nome: 'Artigos', ajuda: 'Separadores do blogue (Crónicas, Benfiquistas, Benficologia…).' }
];
const PROG_FICHEIRO = 'programas.json';
const PROG_FEED_YOUTUBE = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCig3rOWj-2NsbOXRBUaiQqQ';
const PROG_FEED_PODCAST = 'https://anchor.fm/s/12b150a0/podcast/rss';
const PROG_FEED_BLOGUE = 'https://www.benficaindependente.com/blog-feed.xml';
let PROG_ABA = 'youtube';
let PROG_GUARDADO = null;     // nomes já gravados em programas.json
let PROG_ENCONTRADOS = null;  // o que os feeds têm, por tipo
let PROG_ESCOLHAS = null;     // o que está marcado agora

function progPlano(t) {
  return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
function progSegmentos(t) {
  const partes = String(t).split('|').map(s => s.trim()).filter(Boolean);
  if (partes.length > 1) return partes;
  return String(t).split(/\s[-–—]\s|:\s/).map(s => s.trim()).filter(Boolean);
}
const PROG_EP = /^\s*EP(IS[OÓ]DIO)?\.?\s*#?\d+\s*$/i;
const PROG_NAO_PALAVRA = /[^0-9A-ZÀ-ÜÇ#/.]+/;
function progChave(seg) {
  return String(seg).replace(/\([^)]*\)/g, '').toUpperCase()
    .split(PROG_NAO_PALAVRA)
    .filter(w => w && !/\d/.test(w) && !w.startsWith('#'))
    .map(w => w.replace(/^[.#/]+|[.#/]+$/g, ''))
    .filter(Boolean)
    .join(' ');
}
const PROG_NOMES = {
  RESCALDO: 'Rescaldos', ANTEVISÃO: 'Antevisões', REFORÇO: 'Reforços',
  ENTREVISTA: 'Entrevistas', PODCAST: 'Megafone', OUTROS: 'Outros episódios'
};
const PROG_ALIAS = ['MEGAFONE', 'AGUENTA CORAÇÃO'];

function progTitulo(s) {
  const pequenas = ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'A', 'O', 'À'];
  return String(s).toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && pequenas.indexOf(w) >= 0) return w;
    if (w.length <= 3 && pequenas.indexOf(w) < 0 && !/[aeiouáéíóúãõ]/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

/** O mesmo agrupamento que a app faz nos programas do podcast. */
function progClassificarPodcast(titulos) {
  const contagem = {};
  const itens = titulos.map(titulo => {
    let numero = false;
    const chaves = [];
    progSegmentos(titulo).forEach(seg => {
      if (PROG_EP.test(seg)) { numero = true; return; }
      const k = progChave(seg);
      if (!k || (' ' + k + ' ').indexOf(' X ') >= 0) return;
      chaves.push(k);
    });
    Array.from(new Set(chaves)).forEach(k => { contagem[k] = (contagem[k] || 0) + 1; });
    return { titulo, chaves, numero };
  });
  const grandes = Object.keys(contagem).filter(k => contagem[k] >= 8);
  function canonica(k) {
    if (PROG_ALIAS.some(a => k === a || k.indexOf(a + ' ') === 0)) return 'PODCAST';
    const palavras = k.split(' ');
    for (let n = 1; n <= 3; n++) {
      if (n < palavras.length) {
        const prefixo = palavras.slice(0, n).join(' ');
        if (grandes.indexOf(prefixo) >= 0) return prefixo;
      }
    }
    if (k.slice(-1) === 'S' && contagem[k.slice(0, -1)] != null) return k.slice(0, -1);
    return k;
  }
  const canon = itens.map(i => Array.from(new Set(i.chaves.map(canonica))));
  const contCanon = {};
  canon.forEach(ks => ks.forEach(k => { contCanon[k] = (contCanon[k] || 0) + 1; }));
  const votos = {};
  const atribuido = itens.map((item, i) => {
    let melhor = null;
    canon[i].forEach(k => {
      if ((contCanon[k] || 0) < 4) return;
      if (!melhor || contCanon[k] > contCanon[melhor]) melhor = k;
    });
    const chave = melhor || (item.numero ? 'PODCAST' : 'OUTROS');
    if (melhor) {
      const original = progSegmentos(item.titulo)
        .find(s => canonica(progChave(s)) === melhor && progChave(s) === melhor);
      if (original) {
        const nome = original.replace(/\([^)]*\)/g, '').split(/\s+/)
          .filter(w => w && !/\d/.test(w) && !w.startsWith('#'))
          .join(' ').replace(/^[\s\-:.]+|[\s\-:.]+$/g, '');
        votos[melhor] = votos[melhor] || {};
        votos[melhor][nome] = (votos[melhor][nome] || 0) + 1;
      }
    }
    return chave;
  });
  const nomes = {};
  Array.from(new Set(atribuido)).forEach(k => {
    if (PROG_NOMES[k]) { nomes[k] = PROG_NOMES[k]; return; }
    let votado = null;
    const v = votos[k] || {};
    Object.keys(v).forEach(n => { if (!votado || v[n] > v[votado]) votado = n; });
    nomes[k] = votado && /[a-zà-ü]/.test(votado) ? votado : progTitulo(votado || k);
  });
  const cont = {};
  atribuido.forEach(k => { const n = nomes[k]; cont[n] = (cont[n] || 0) + 1; });
  return cont;
}

/** As mesmas regras que a app usa nos programas dos vídeos. */
const PROG_YT = [
  ['Watchalong', ['WATCHALONG', 'WATCH ALONG']],
  ['Voo Picado', ['VOO PICADO']],
  ['Rescaldos', ['RESCALDO']],
  ['Antevisões', ['ANTEVISAO']],
  ['Modalidades Benfica', ['MODALIDADES']],
  ['Viagens em Vermelho', ['VIAGENS EM VERMELHO', 'VIAGENS EUROPEIAS']],
  ['Fórum Benfica', ['FORUM BENFI']],
  ['Análise Tática', ['ANALISE TA']],
  ['BI On Tour', ['BI ON TOUR']],
  ['A História Gloriosa', ['HISTORIA GLORIOSA']],
  ['O Brinco do Baptista', ['BRINCO DO BAPTISTA']],
  ['Bancada Jovem', ['BANCADA JOVEM']],
  ['Nacional 1904', ['NACIONAL 1904']],
  ['Tema Quente', ['TEMA QUENTE']],
  ['Mundo Mundial', ['MUNDO MUNDIAL']],
  ['Eleições', ['ELEICOES']],
  ['Entrevistas', ['ENTREVISTA']]
];
function progClassificarYouTube(titulos) {
  const cont = {};
  titulos.forEach(t => {
    const up = progPlano(t);
    let nome = null;
    PROG_YT.forEach(r => { if (!nome && r[1].some(p => up.indexOf(p) >= 0)) nome = r[0]; });
    if (!nome && /\bEP\.?\s*\d+/.test(up)) nome = 'Megafone';
    if (!nome) nome = 'Outros vídeos';
    cont[nome] = (cont[nome] || 0) + 1;
  });
  return cont;
}

async function progTitulosPodcast() {
  const r = await fetch(PROG_FEED_PODCAST, { cache: 'no-store' });
  if (!r.ok) throw new Error('podcast HTTP ' + r.status);
  const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
  return Array.from(doc.querySelectorAll('item > title')).map(n => (n.textContent || '').trim()).filter(Boolean);
}
async function progFeed(url) {
  const alvo = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url);
  const r = await fetch(alvo, { cache: 'no-store' });
  if (!r.ok) throw new Error('feed HTTP ' + r.status);
  const j = await r.json();
  if (j.status !== 'ok') throw new Error(j.message || 'feed indisponível');
  return j.items || [];
}

async function progCarregar() {
  let guardado = null;
  try { guardado = await lerFicheiro(CFG.repo, PROG_FICHEIRO); } catch (e) { guardado = null; }
  PROG_GUARDADO = { youtube: [], podcasts: [], artigos: [] };
  if (guardado) PROG_TIPOS.forEach(t => {
    if (Array.isArray(guardado[t.chave])) PROG_GUARDADO[t.chave] = guardado[t.chave]
      // Nome antigo do programa do podcast: passou a chamar-se Megafone.
      .map(n => n === 'Podcast Benfica Independente' ? 'Megafone' : n)
      .filter((n, i, arr) => arr.indexOf(n) === i);
  });

  const achados = { youtube: {}, podcasts: {}, artigos: {} };
  try { achados.podcasts = progClassificarPodcast(await progTitulosPodcast()); } catch (e) { /* sem feed */ }
  try { achados.youtube = progClassificarYouTube((await progFeed(PROG_FEED_YOUTUBE)).map(i => i.title)); } catch (e) { /* sem feed */ }
  // O feed do YouTube só traz os últimos vídeos: as rubricas conhecidas ficam sempre
  // na lista (sem contagem), para não desaparecerem da app por não haver vídeos recentes.
  PROG_YT.forEach(r => { if (achados.youtube[r[0]] == null) achados.youtube[r[0]] = 0; });
  ['Outros vídeos', 'Megafone'].forEach(n => { if (achados.youtube[n] == null) achados.youtube[n] = 0; });
  try {
    (await progFeed(PROG_FEED_BLOGUE)).forEach(i => (i.categories || []).forEach(c => {
      achados.artigos[c] = (achados.artigos[c] || 0) + 1;
    }));
  } catch (e) { /* sem feed */ }

  PROG_ENCONTRADOS = {};
  PROG_ESCOLHAS = {};
  PROG_TIPOS.forEach(t => {
    const nomes = Object.keys(achados[t.chave]);
    PROG_GUARDADO[t.chave].forEach(n => { if (nomes.indexOf(n) < 0) nomes.push(n); });
    PROG_ENCONTRADOS[t.chave] = nomes.map(n => ({
      nome: n,
      quantos: achados[t.chave][n] || 0,
      guardado: PROG_GUARDADO[t.chave].indexOf(n) >= 0
    })).sort((a, b) => (b.quantos - a.quantos) || a.nome.localeCompare(b.nome, 'pt'));
    PROG_ESCOLHAS[t.chave] = {};
    PROG_ENCONTRADOS[t.chave].forEach(x => { PROG_ESCOLHAS[t.chave][x.nome] = x.guardado; });
  });
}

function progDesenhar(alvo) {
  const tipo = PROG_TIPOS.find(t => t.chave === PROG_ABA) || PROG_TIPOS[0];
  const lista = PROG_ENCONTRADOS[tipo.chave] || [];
  const marcados = lista.filter(x => PROG_ESCOLHAS[tipo.chave][x.nome]).length;
  const linhas = lista.map(x => `<tr>
    <td style="width:34px"><input type="checkbox" data-prog="${esc(x.nome)}" ${PROG_ESCOLHAS[tipo.chave][x.nome] ? 'checked' : ''}></td>
    <td><b>${esc(x.nome)}</b></td>
    <td class="mini">${x.quantos ? esc(x.quantos + (tipo.chave === 'artigos' ? ' artigo(s)' : ' episódio(s)')) : '<span class="suave">sem novidades recentes</span>'}</td>
    <td>${x.guardado ? '' : '<span class="pilula">novo</span>'}</td>
  </tr>`).join('');
  alvo.innerHTML = cartao('Programas, séries e temas',
    `<p class="suave">${esc(tipo.ajuda)} O que estiver marcado aparece na app; o resto fica de fora.
      Um programa novo aparece aqui <b>sem visto</b> — é só marcá-lo. Se guardares sem nada marcado, a app volta a mostrar tudo.</p>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
       ${PROG_TIPOS.map(t => `<button class="botao pequeno ${t.chave === PROG_ABA ? 'principal' : ''}" data-prog-aba="${t.chave}">${esc(t.nome)}</button>`).join('')}
     </div>
     <p class="suave"><b>${marcados}</b> de ${lista.length} marcados neste separador.</p>
     <div class="tabela-rolar"><table class="tabela">
       <tr><th></th><th>Programa / série / tema</th><th>Na app?</th><th></th></tr>
       ${linhas || `<tr><td colspan="4"><p class="suave">Não encontrei nada neste separador.</p></td></tr>`}
     </table></div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
       <button class="botao pequeno" data-prog-todos="1">Marcar todos</button>
       <button class="botao pequeno" data-prog-todos="0">Desmarcar todos</button>
       <button class="botao pequeno" data-prog-atualizar="1">Voltar a ler os feeds</button>
     </div>`,
    `<button class="botao pequeno principal" data-prog-guardar="1">Guardar</button>`);

  $$('[data-prog-aba]', alvo).forEach(b => b.addEventListener('click', () => {
    PROG_ABA = b.dataset.progAba;
    progDesenhar(alvo);
  }));
  $$('[data-prog]', alvo).forEach(i => i.addEventListener('change', () => {
    PROG_ESCOLHAS[PROG_ABA][i.dataset.prog] = i.checked;
    progDesenhar(alvo);
  }));
  $$('[data-prog-todos]', alvo).forEach(b => b.addEventListener('click', () => {
    const marcar = b.dataset.progTodos === '1';
    (PROG_ENCONTRADOS[PROG_ABA] || []).forEach(x => { PROG_ESCOLHAS[PROG_ABA][x.nome] = marcar; });
    progDesenhar(alvo);
  }));
  $('[data-prog-atualizar]', alvo).addEventListener('click', async () => {
    carregar(true);
    try { await progCarregar(); aviso('Lista atualizada.'); }
    catch (e) { aviso('Não consegui ler os feeds: ' + e.message, true); }
    finally { carregar(false); progDesenhar(alvo); }
  });
  $('[data-prog-guardar]', alvo).addEventListener('click', async () => {
    const corpo = { atualizado: agoraISO(), por: CFG.login || '' };
    PROG_TIPOS.forEach(t => {
      corpo[t.chave] = (PROG_ENCONTRADOS[t.chave] || [])
        .filter(x => PROG_ESCOLHAS[t.chave][x.nome]).map(x => x.nome);
    });
    carregar(true);
    try {
      await escreverFicheiro(CFG.repo, PROG_FICHEIRO, corpo,
        `Plataforma (${CFG.login}): programas e temas que aparecem na app`);
      PROG_GUARDADO = { youtube: corpo.youtube, podcasts: corpo.podcasts, artigos: corpo.artigos };
      aviso('Gravado. A app mostra a lista nova na próxima atualização.');
    } catch (e) {
      aviso(e.message, true);
    } finally {
      carregar(false);
    }
  });
}

async function ecraProgramas(alvo) {
  alvo.innerHTML = cartao('Programas, séries e temas', '<p class="suave">A ler os feeds do canal, do podcast e do blogue…</p>');
  if (!PROG_ENCONTRADOS) {
    carregar(true);
    try { await progCarregar(); }
    catch (e) { aviso('Não consegui ler os feeds: ' + e.message, true); }
    finally { carregar(false); }
  }
  if (!PROG_ENCONTRADOS) { alvo.innerHTML = cartao('Programas, séries e temas', '<p class="suave">Não consegui ler os feeds. Tenta outra vez.</p>'); return; }
  progDesenhar(alvo);
}

ECRAS = [
  { chave: 'inicio', nome: 'O que queres fazer?', icone: '⌂', desenhar: ecraInicio },
  { chave: 'painel', nome: 'Painel e alertas', icone: '▦', desenhar: ecraPainel },
  ...Object.keys(TIPOS).map(t => ({ chave: t, nome: TIPOS[t].nome, icone: TIPOS[t].icone, desenhar: ecraConteudo(t) })),
  { chave: 'mensagens', nome: 'Mensagens', icone: '✉', desenhar: ecraMensagens },
  { chave: 'ajuda', nome: 'Ajuda (IA)', icone: '✦', desenhar: ecraAjuda },
  { chave: 'votacoes', nome: 'Sondagens e Homem do jogo', icone: '🗳', desenhar: ecraVotacoes },
  { chave: 'quadro', nome: 'Quadro tático', icone: '📋', desenhar: ecraQuadro },
  { chave: 'participacao', nome: 'Participação dos adeptos', icone: '🙌', desenhar: ecraParticipacao },
  { chave: 'estatisticas', nome: 'Estatísticas da app', icone: '📈', desenhar: ecraEstatisticasApp },
  { chave: 'atividade', nome: 'Registo de atividade', icone: '🕘', desenhar: ecraAtividade },
  { chave: 'gestores', nome: 'Gestores (contacto)', icone: '☎', desenhar: ecraGestores },
  { chave: 'programas', nome: 'Programas na app', icone: '🎚', desenhar: ecraProgramas },
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
    const r = await ghFetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/actions/runs?per_page=12`);
    RUNS = r.ok ? ((await r.json()).workflow_runs || []).filter(x => x.status === 'completed') : false;
  } catch (e) { RUNS = false; }
}

async function verPrivado() {
  if (CFG.modo === 'local') { PRIVADO_OK = true; return; }
  try {
    const r = await ghFetch(`https://api.github.com/repos/${CFG.owner}/${CFG.repoPrivado}`);
    PRIVADO_OK = r.ok;
  } catch (e) { PRIVADO_OK = false; }
}

async function carregarDados() {
  carregar(true);
  try {
    PRIVADO_OK = true;   // os dados privados passaram para o Supabase
    if (CFG.modo === 'email') { try { EMAILS = await rpcAdmin('bi_admin_email_lista'); } catch (e) { EMAILS = null; } }
    const nomes = Object.keys(FICHEIROS);
    await Promise.all(nomes.map(lerSeguro).concat([lerRuns(), contarMensagensNovas(), carregarPrivados(), contarSondagensPorAprovar()]));
    await calcularAlertasDinheiro();
    // Primeira vez: se ainda não há administradores, o dono do repositório fica como dono da plataforma.
    const a = admins();
    if (CFG.modo === 'github' && !a.donos.length && !a.admins.length && CFG.login.toLowerCase() === CFG.owner.toLowerCase()) {
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
  $('#barra-modo').textContent = CFG.modo === 'local' ? 'teste' : CFG.modo === 'email' ? 'email' : 'github';
  $('#barra-modo').classList.toggle('local', CFG.modo === 'local');
  $('#quem').textContent = CFG.nome || CFG.login;
  ECRAS_ATIVO = 'inicio';
  redesenhar();
}

function pronto() {
  lerConfig();
  $('#entrar-botao').addEventListener('click', entrarComGitHub);
  $('#entrar-email-botao').addEventListener('click', entrarComEmail);
  $('#entrar-primeiro').addEventListener('click', primeiroAcesso);
  $('#entrar-google').addEventListener('click', entrarComGoogle);
  $('#entrar-esqueci').addEventListener('click', esqueciPalavra);
  $('#entrar-palavra').addEventListener('keydown', e => { if (e.key === 'Enter') entrarComEmail(); });
  $('#entrar-local').addEventListener('click', entrarLocal);
  $('#sair').addEventListener('click', sair);
  $('#menu-botao').addEventListener('click', () => $('.barra').classList.toggle('aberta'));
  $('#entrar-token').addEventListener('keydown', e => { if (e.key === 'Enter') entrarComGitHub(); });
  tratarLigacaoEmail().then(tratada => {
    if (!tratada && (CFG.modo === 'local' || CFG.token) && CFG.login) abrirApp().catch(e => mostraErroEntrada(e.message));
  });
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', pronto);

/* Permite instalar como aplicação (PWA). */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('servico-v19.js').catch(() => {}); });
}
