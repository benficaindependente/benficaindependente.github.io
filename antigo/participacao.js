/* =========================================================================
   Plataforma · Participação dos adeptos
   - Prognósticos (resultado + nome + comentário):
     quantas pessoas acertaram e quem foi (nomes e comentários só para administradores).
     Os dados dos adeptos desaparecem sozinhos ao fim de 5 dias.
   - Perguntas ao programa: ler, marcar as escolhidas e apagar.
   - Quiz: as perguntas criadas pelo agente e quando cada uma sai
     (enviar agora, planear uma data, ou envio automático X vezes por semana).
   Carregado antes do app.js.
   ========================================================================= */
'use strict';

function janelaPart(titulo, html, largura) {
  return new Promise(resolve => {
    const fundo = document.createElement('div');
    fundo.className = 'fundo-modal';
    fundo.style.zIndex = 115;
    fundo.innerHTML = `<div class="modal" style="max-width:${largura || 560}px">
      <header><h3>${esc(titulo)}</h3><button class="modal-x" data-fechar-x title="Fechar">✕</button></header>
      <div class="modal-corpo">${html}</div>
      <div class="modal-pe"><button class="botao principal" data-fechar>Fechar</button></div></div>`;
    document.body.appendChild(fundo);
    $('[data-fechar]', fundo).addEventListener('click', () => { fundo.remove(); resolve(); });
    $('[data-fechar-x]', fundo).addEventListener('click', () => { fundo.remove(); resolve(); });
  });
}

function pilulaAcerto(ok) {
  return ok === true ? '<span class="pilula ok">Acertou</span>' : ok === false ? '<span class="pilula">Falhou</span>' : '';
}

async function verPrognosticos(j) {
  let lista;
  try { carregar(true); lista = await rpcAdmin('bi_admin_prognosticos', { p_jogo: j.jogo }); }
  catch (e) { aviso(e.message, true); return; } finally { carregar(false); }
  const acertaram = lista.filter(x => x.acertou).length;
  await janelaPart('Prognósticos · ' + (j.titulo || j.jogo),
    `<p class="suave"><b>${lista.length}</b> prognósticos${j.resultado ? ` · acertaram <b>${acertaram}</b> (resultado ${j.resultado.golos_b}-${j.resultado.golos_r} a favor do Benfica)` : ' · o jogo ainda não foi fechado'}.</p>
     ${lista.length ? `<table class="tabela"><tr><th>Nome</th><th>Prognóstico</th><th></th></tr>${lista.map(x => `<tr>
        <td><b>${esc(x.nome)}</b>${x.comentario ? `<div class="mini">${esc(x.comentario)}</div>` : ''}</td>
        <td>Benfica ${x.golos_b} - ${x.golos_r} adversário</td><td>${pilulaAcerto(x.acertou)}</td></tr>`).join('')}</table>`
       : '<p class="suave">Ainda ninguém enviou.</p>'}`);
}

async function lerQuizPublico() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${DONO_PADRAO}/${REPO_PADRAO}/main/data/quiz.json?t=${Date.now()}`);
    return r.ok ? await r.json() : [];
  } catch (e) { return []; }
}

/* ------------------------- Quiz: quando é que sai ------------------------- */
const FICHEIRO_QUIZ_ENVIO = 'quiz_envio.json';
const QUIZ_ENVIO_PADRAO = { modo: 'auto', porSemana: 2, hora: '10:00', inicio: '', envios: {}, atualizado: '', por: '' };

async function lerQuizEnvio() {
  try {
    const v = await lerFicheiro(CFG.repo, FICHEIRO_QUIZ_ENVIO);
    return Object.assign({}, QUIZ_ENVIO_PADRAO, v || {});
  } catch (e) {
    return Object.assign({}, QUIZ_ENVIO_PADRAO);
  }
}

/** Grava a agenda do quiz (data/quiz_envio.json), que é o que a app lê. */
async function guardarQuizEnvio(alteracao, mensagem) {
  carregar(true);
  try {
    const atual = await lerQuizEnvio();
    const novo = Object.assign({}, atual, alteracao);
    novo.atualizado = agoraISO();
    novo.por = CFG.login || CFG.nome || '';
    await escreverFicheiro(CFG.repo, FICHEIRO_QUIZ_ENVIO, novo, mensagem || 'Plataforma: envio do quiz');
    aviso('Guardado.');
    return novo;
  } catch (e) {
    aviso(e.message, true);
    return null;
  } finally {
    carregar(false);
  }
}

/** Próximos momentos do envio automático: X por semana, sempre à hora marcada, a contar de uma data. */
function slotsQuiz(cfg, quantos) {
  const porSemana = Math.min(7, Math.max(1, Number(cfg.porSemana) || 1));
  const [h, m] = String(cfg.hora || '10:00').split(':');
  const hora = Math.min(23, Math.max(0, Number(h) || 0));
  const minuto = Math.min(59, Math.max(0, Number(m) || 0));
  let base = cfg.inicio ? new Date(cfg.inicio) : new Date();
  if (isNaN(base.getTime())) base = new Date();
  const dia0 = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const passoDias = 7 / porSemana;
  const agora = Date.now();
  const out = [];
  for (let n = 0; out.length < quantos && n < 500; n++) {
    const dia = new Date(dia0);
    dia.setDate(dia0.getDate() + Math.round(n * passoDias));
    dia.setHours(hora, minuto, 0, 0);
    if (dia.getTime() > agora) out.push(dia);
  }
  return out;
}

/**
 * No automático, as perguntas ainda por enviar ficam nos próximos momentos livres.
 * Só entram as perguntas criadas depois da última vez que a agenda foi gravada:
 * as que já saíram antes disso mantêm a data que têm (não desaparecem da app).
 */
function agendaQuiz(cfg, perguntas) {
  const envios = Object.assign({}, cfg.envios || {});
  if (cfg.modo === 'manual') return envios;
  const corte = cfg.atualizado ? new Date(cfg.atualizado).getTime() : Date.now();
  const livres = (perguntas || [])
    .filter(q => q && q.id && !envios[q.id] && Number(q.quando) > corte)
    .sort((a, b) => Number(a.quando) - Number(b.quando));
  const momentos = slotsQuiz(cfg, livres.length);
  livres.forEach((q, i) => { if (momentos[i]) envios[q.id] = momentos[i].toISOString(); });
  return envios;
}

/** Data no formato dos campos "datetime-local" (hora local). */
function paraCampoData(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function cartaoQuiz(perguntas, cfg) {
  const modo = cfg.modo === 'manual' ? 'manual' : 'auto';
  const proximo = slotsQuiz(cfg, 1)[0];
  const lista = (perguntas || []).slice().sort((a, b) => Number(b.quando) - Number(a.quando)).slice(0, 15);
  const blocos = lista.map(q => {
    const iso = (cfg.envios || {})[q.id];
    const saiu = !!iso && new Date(iso).getTime() <= Date.now();
    const estado = iso
      ? `<span class="pilula ${saiu ? 'ok' : 'espera'}">${saiu ? 'Já saiu' : 'Sai'} · ${esc(dataCurta(iso))}</span>`
      : '<span class="pilula espera">Por enviar</span>';
    return `<div class="sondagem">
      <div class="linha-acoes" style="justify-content:space-between"><b>${esc(q.pergunta)}</b>${estado}</div>
      <ol type="A" class="mini">${(q.opcoes || []).map((o, i) => `<li${i === q.certa ? ' style="font-weight:700;color:#2e7d32"' : ''}>${esc(o)}${i === q.certa ? ' ✓' : ''}</li>`).join('')}</ol>
      <div class="mini">${esc(q.explicacao || '')}</div>
      <div class="linha-acoes">
        ${saiu ? '' : `<button class="botao pequeno principal" data-quiz-agora="${esc(q.id)}">Enviar agora</button>`}
        <button class="botao pequeno" data-quiz-planear="${esc(q.id)}">Planear data</button>
        ${iso && !saiu ? `<button class="botao pequeno perigo" data-quiz-cancelar="${esc(q.id)}">Cancelar envio</button>` : ''}
      </div></div>`;
  }).join('');

  return cartao('Quiz do BI (criado pelo agente)', `<p class="suave">O agente escreve as perguntas sobre a história gloriosa do Benfica, como um benfiquista fanático e conhecedor. Aqui decides <b>quando cada uma sai</b> na app: agora, numa data à escolha, ou automaticamente. Quem receber pode responder ou fechar com o X.</p>
    <div class="sondagem">
      <div class="linha-acoes" style="justify-content:space-between"><b>Quando sai</b>
        <span class="pilula ${modo === 'auto' ? 'ok' : ''}">${modo === 'auto' ? 'Automático' : 'Só quando eu mandar'}</span></div>
      <div class="mini">${modo === 'auto'
        ? `Sai <b>${Number(cfg.porSemana) || 2}</b> ${Number(cfg.porSemana) === 1 ? 'vez' : 'vezes'} por semana, às <b>${esc(cfg.hora || '10:00')}</b>. Próximo envio: <b>${esc(dataCurta(proximo.toISOString()))}</b>.`
        : 'Nada sai sozinho: só sai o que tiver data marcada em baixo. Podes “Enviar agora” ou “Planear data”.'}</div>
      <div class="linha-acoes">
        <button class="botao pequeno ${modo === 'auto' ? 'principal' : ''}" data-quiz-modo="auto">Automático</button>
        <button class="botao pequeno ${modo === 'manual' ? 'principal' : ''}" data-quiz-modo="manual">Só quando eu mandar</button>
        <button class="botao pequeno" data-quiz-horario="1">Mudar o horário</button>
      </div>
      <div class="mini">Mesmo no automático podes adiantar uma pergunta com “Enviar agora”.</div>
    </div>
    ${blocos || '<p class="suave">Ainda não há perguntas: a próxima execução do robô cria-as.</p>'}`);
}

function ecraParticipacao(alvo) {
  if (CFG.modo === 'local' || !CFG.token) {
    alvo.innerHTML = cartao('Participação dos adeptos', '<p class="suave">Só funciona ao entrar com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  alvo.innerHTML = cartao('Participação dos adeptos', '<p class="suave">A carregar…</p>');
  (async () => {
    let jogos, perguntas, quiz, envioQuiz;
    try {
      carregar(true);
      [jogos, perguntas, quiz, envioQuiz] = await Promise.all([
        rpcAdmin('bi_admin_participacao'), rpcAdmin('bi_admin_perguntas'), lerQuizPublico(), lerQuizEnvio()
      ]);
    } catch (e) {
      alvo.innerHTML = cartao('Participação dos adeptos', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-novidades.sql no Supabase.</p>`);
      return;
    } finally { carregar(false); }

    // No envio automático, as perguntas que o robô criar depois ficam logo com data — sem
    // ninguém ter de voltar a mexer aqui. Na primeira vez cria a agenda (a partir de agora),
    // para que as perguntas seguintes não saiam a qualquer hora.
    if (envioQuiz.modo !== 'manual') {
      const agenda = agendaQuiz(envioQuiz, quiz);
      const antes = envioQuiz.envios || {};
      const mudou = Object.keys(agenda).length !== Object.keys(antes).length ||
        Object.keys(agenda).some(id => agenda[id] !== antes[id]);
      if (mudou || !envioQuiz.atualizado) {
        const guardado = await guardarQuizEnvio({ envios: agenda }, 'Plataforma: agenda do quiz');
        if (guardado) envioQuiz = guardado;
      }
    }

    let html = cartao('Prognósticos', `<p class="suave">Os adeptos escrevem só o nome (a app não tem contas). Quando sai o onze inicial recebem uma notificação para dar o prognóstico. Quando o jogo acaba, o resultado oficial entra <b>automaticamente</b> (vem do robô) e aqui aparece logo quantos acertaram e quem foi. Tudo desaparece ao fim de 5 dias. Durante o jogo não há convites.</p>
      ${jogos.length ? jogos.map((j, i) => `<div class="sondagem">
        <div class="linha-acoes" style="justify-content:space-between"><b>${esc(j.titulo || j.jogo)}</b>
          ${j.resultado ? `<span class="pilula ok">Fechado · ${j.resultado.golos_b}-${j.resultado.golos_r}</span>` : '<span class="pilula espera">Aberto</span>'}</div>
        ${j.resultado ? '' : '<div class="mini">O resultado oficial entra sozinho assim que o jogo acaba (até meia hora depois).</div>'}
        <div class="mini">${numero(j.progs)} prognósticos · último ${esc(dataCurta(j.ultimo))}</div>
        <div class="linha-acoes">
          <button class="botao pequeno" data-prog="${i}">📊 Ver prognósticos</button>
        </div></div>`).join('') : '<p class="suave">Ainda não há participações (ou já desapareceram).</p>'}`);

    const novas = perguntas.filter(p => p.estado === 'nova').length;
    html += cartao('Perguntas ao programa', `<p class="suave">Perguntas e sugestões dos adeptos para o próximo direto. Marca as que vais usar (ficam no topo) e apaga o que não serve. Desaparecem sozinhas ao fim de 30 dias. <b>${novas}</b> por ler.</p>
      ${perguntas.length ? perguntas.map(p => `<div class="sondagem">
        <div class="linha-acoes" style="justify-content:space-between"><b>${esc(p.nome)}</b>
          <span class="pilula ${p.estado === 'escolhida' ? 'ok' : p.estado === 'nova' ? 'espera' : ''}">${p.estado === 'escolhida' ? 'Escolhida' : p.estado === 'lida' ? 'Lida' : 'Nova'}</span></div>
        <div>${esc(p.texto)}</div><div class="mini">${esc(dataCurta(p.quando))}</div>
        <div class="linha-acoes">
          <button class="botao pequeno ${p.estado === 'escolhida' ? '' : 'principal'}" data-pe="${p.id}|${p.estado === 'escolhida' ? 'lida' : 'escolhida'}">${p.estado === 'escolhida' ? 'Tirar das escolhidas' : '⭐ Escolher para o direto'}</button>
          ${p.estado === 'nova' ? `<button class="botao pequeno" data-pe="${p.id}|lida">Marcar como lida</button>` : ''}
          <button class="botao pequeno perigo" data-pe="${p.id}|apagar">Apagar</button>
        </div></div>`).join('') : '<p class="suave">Ainda não há perguntas.</p>'}`);

    html += cartaoQuiz(quiz, envioQuiz);
    alvo.innerHTML = html;

    // Quiz: modo, horário do envio automático e data de cada pergunta.
    $$('[data-quiz-modo]', alvo).forEach(b => b.addEventListener('click', async () => {
      const modo = b.dataset.quizModo;
      const alteracao = { modo };
      if (modo === 'auto') alteracao.envios = agendaQuiz(envioQuiz, quiz);
      if (await guardarQuizEnvio(alteracao, 'Plataforma: modo do quiz')) redesenhar();
    }));
    $$('[data-quiz-horario]', alvo).forEach(b => b.addEventListener('click', async () => {
      const v = await formulario('Envio automático do quiz', [
        { nome: 'porSemana', etiqueta: 'Quantas vezes por semana', tipo: 'number', dica: '1 a 7', valor: envioQuiz.porSemana || 2 },
        { nome: 'hora', etiqueta: 'A que horas sai', tipo: 'time', valor: envioQuiz.hora || '10:00' },
        { nome: 'inicio', etiqueta: 'A contar de (opcional)', tipo: 'datetime-local', dica: 'Vazio = começa no próximo horário.' }
      ], {}, {
        textoGuardar: 'Guardar',
        nota: 'As perguntas que já saíram não mudam; as que faltam ficam nas próximas datas.'
      });
      if (!v) return;
      const cfg = Object.assign({}, envioQuiz, {
        modo: 'auto', porSemana: Number(v.porSemana) || 1, hora: v.hora || '10:00', inicio: v.inicio || ''
      });
      cfg.envios = agendaQuiz(cfg, quiz);
      const ok = await guardarQuizEnvio(
        { modo: 'auto', porSemana: cfg.porSemana, hora: cfg.hora, inicio: cfg.inicio, envios: cfg.envios },
        'Plataforma: horário do quiz'
      );
      if (ok) redesenhar();
    }));
    $$('[data-quiz-agora]', alvo).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Enviar esta pergunta já para os telemóveis?')) return;
      const envios = Object.assign({}, envioQuiz.envios);
      envios[b.dataset.quizAgora] = agoraISO();
      if (await guardarQuizEnvio({ envios }, 'Plataforma: enviar o quiz agora')) redesenhar();
    }));
    $$('[data-quiz-planear]', alvo).forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.quizPlanear;
      const atual = (envioQuiz.envios || {})[id];
      const v = await formulario('Quando sai esta pergunta?', [
        { nome: 'quando', etiqueta: 'Dia e hora', tipo: 'datetime-local' }
      ], { quando: atual ? paraCampoData(new Date(atual).getTime()) : paraCampoData(Date.now() + 3600 * 1000) }, {
        textoGuardar: 'Guardar', nota: 'Nesse dia e hora a pergunta aparece no Início (e é enviada a notificação).'
      });
      if (!v || !v.quando) return;
      const envios = Object.assign({}, envioQuiz.envios);
      envios[id] = new Date(v.quando).toISOString();
      if (await guardarQuizEnvio({ envios }, 'Plataforma: data do quiz')) redesenhar();
    }));
    $$('[data-quiz-cancelar]', alvo).forEach(b => b.addEventListener('click', async () => {
      const envios = Object.assign({}, envioQuiz.envios);
      delete envios[b.dataset.quizCancelar];
      if (await guardarQuizEnvio({ envios }, 'Plataforma: cancelar envio do quiz')) redesenhar();
    }));

    $$('[data-prog]', alvo).forEach(b => b.addEventListener('click', () => verPrognosticos(jogos[b.dataset.prog])));
    $$('[data-pe]', alvo).forEach(b => b.addEventListener('click', async () => {
      const [id, estado] = b.dataset.pe.split('|');
      if (estado === 'apagar' && !confirm('Apagar esta pergunta?')) return;
      try { carregar(true); await rpcAdmin('bi_admin_pergunta_estado', { p_id: Number(id), p_estado: estado }); }
      catch (e) { aviso(e.message, true); } finally { carregar(false); }
      redesenhar();
    }));
  })();
}
