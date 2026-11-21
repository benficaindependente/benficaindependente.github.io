/* =========================================================================
   Plataforma · Participação dos adeptos
   - Prognósticos (resultado + nome + comentário) e "Quem vai jogar?" (os 11):
     quantas pessoas acertaram e quem foi (nomes e comentários só para administradores).
     Os dados dos adeptos desaparecem sozinhos ao fim de 5 dias.
   - Perguntas ao programa: ler, marcar as escolhidas e apagar.
   - Quiz: as perguntas criadas pelo agente (só para ler).
   Carregado antes do app.js.
   ========================================================================= */
'use strict';

function janelaPart(titulo, html, largura) {
  return new Promise(resolve => {
    const fundo = document.createElement('div');
    fundo.className = 'fundo-modal';
    fundo.style.zIndex = 115;
    fundo.innerHTML = `<div class="modal" style="max-width:${largura || 560}px">
      <header><h3>${esc(titulo)}</h3></header>
      <div class="modal-corpo">${html}</div>
      <div class="modal-pe"><button class="botao principal" data-fechar>Fechar</button></div></div>`;
    document.body.appendChild(fundo);
    $('[data-fechar]', fundo).addEventListener('click', () => { fundo.remove(); resolve(); });
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

async function verOnzes(j) {
  let lista;
  try { carregar(true); lista = await rpcAdmin('bi_admin_onzes', { p_jogo: j.jogo }); }
  catch (e) { aviso(e.message, true); return; } finally { carregar(false); }
  const fechado = !!j.resultado;
  const melhor = fechado ? Math.max(0, ...lista.map(x => x.acertos || 0)) : 0;
  await janelaPart('Quem vai jogar? · ' + (j.titulo || j.jogo),
    `<p class="suave"><b>${lista.length}</b> onzes${fechado ? ` · o melhor acertou <b>${melhor}</b> de 11` : ' · o jogo ainda não foi fechado'}.</p>
     ${lista.length ? lista.map(x => `<div class="sondagem">
        <div class="linha-acoes" style="justify-content:space-between"><b>${esc(x.nome)}</b>${fechado ? `<span class="pilula ${x.acertos >= 10 ? 'ok' : ''}">${x.acertos} de 11</span>` : ''}</div>
        ${x.comentario ? `<div class="mini">“${esc(x.comentario)}”</div>` : ''}
        <div class="mini">${(x.jogadores || []).map(esc).join(' · ')}</div></div>`).join('')
       : '<p class="suave">Ainda ninguém enviou.</p>'}`, 640);
}

async function lerQuizPublico() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${DONO_PADRAO}/${REPO_PADRAO}/main/data/quiz.json?t=${Date.now()}`);
    return r.ok ? await r.json() : [];
  } catch (e) { return []; }
}

function ecraParticipacao(alvo) {
  if (CFG.modo === 'local' || !CFG.token) {
    alvo.innerHTML = cartao('Participação dos adeptos', '<p class="suave">Só funciona ao entrar com a conta GitHub (não no modo de teste).</p>');
    return;
  }
  alvo.innerHTML = cartao('Participação dos adeptos', '<p class="suave">A carregar…</p>');
  (async () => {
    let jogos, perguntas, quiz;
    try {
      carregar(true);
      [jogos, perguntas, quiz] = await Promise.all([rpcAdmin('bi_admin_participacao'), rpcAdmin('bi_admin_perguntas'), lerQuizPublico()]);
    } catch (e) {
      alvo.innerHTML = cartao('Participação dos adeptos', `<p class="erro">${esc(e.message)}</p><p class="suave">Se é a primeira vez, falta correr o ficheiro supabase-novidades.sql no Supabase.</p>`);
      return;
    } finally { carregar(false); }

    let html = cartao('Prognósticos e "Quem vai jogar?"', `<p class="suave">Os adeptos escrevem só o nome (a app não tem contas). Quando sai o onze inicial recebem uma notificação para dar o prognóstico; no dia antes ou no dia do jogo são convidados a adivinhar o onze. Quando o jogo acaba, o resultado e o onze oficial entram <b>automaticamente</b> (vêm do robô) e aqui aparece logo quantos acertaram e quem foi. Tudo desaparece ao fim de 5 dias. Durante o jogo não há convites.</p>
      ${jogos.length ? jogos.map((j, i) => `<div class="sondagem">
        <div class="linha-acoes" style="justify-content:space-between"><b>${esc(j.titulo || j.jogo)}</b>
          ${j.resultado ? `<span class="pilula ok">Fechado · ${j.resultado.golos_b}-${j.resultado.golos_r}</span>` : '<span class="pilula espera">Aberto</span>'}</div>
        ${j.resultado ? '' : '<div class="mini">O resultado e o onze oficial entram sozinhos assim que o jogo acaba (até meia hora depois).</div>'}
        <div class="mini">${numero(j.progs)} prognósticos · ${numero(j.onzes)} onzes · último ${esc(dataCurta(j.ultimo))}</div>
        <div class="linha-acoes">
          <button class="botao pequeno" data-prog="${i}">📊 Ver prognósticos</button>
          <button class="botao pequeno" data-onze="${i}">📋 Ver onzes</button>
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

    const ultimas = (quiz || []).slice(-6).reverse();
    html += cartao('Quiz do BI (criado pelo agente)', `<p class="suave">O agente escreve uma pergunta à terça e outra à sexta, como um benfiquista fanático e conhecedor, sobre a história gloriosa e os grandes jogadores. Não precisa de aprovação. Aqui podes ver o que saiu; se alguma estiver errada, diz-me e eu corrijo.</p>
      ${ultimas.length ? ultimas.map(q => `<div class="sondagem"><b>${esc(q.pergunta)}</b>
        <div class="mini">${esc(dataCurta(new Date(q.quando).toISOString()))}</div>
        <ol type="A" class="mini">${q.opcoes.map((o, i) => `<li${i === q.certa ? ' style="font-weight:700;color:#2e7d32"' : ''}>${esc(o)}${i === q.certa ? ' ✓' : ''}</li>`).join('')}</ol>
        <div class="mini">${esc(q.explicacao)}</div></div>`).join('') : '<p class="suave">Ainda não saiu nenhuma pergunta: a primeira aparece na próxima execução do robô.</p>'}`);
    alvo.innerHTML = html;

    $$('[data-prog]', alvo).forEach(b => b.addEventListener('click', () => verPrognosticos(jogos[b.dataset.prog])));
    $$('[data-onze]', alvo).forEach(b => b.addEventListener('click', () => verOnzes(jogos[b.dataset.onze])));
    $$('[data-pe]', alvo).forEach(b => b.addEventListener('click', async () => {
      const [id, estado] = b.dataset.pe.split('|');
      if (estado === 'apagar' && !confirm('Apagar esta pergunta?')) return;
      try { carregar(true); await rpcAdmin('bi_admin_pergunta_estado', { p_id: Number(id), p_estado: estado }); }
      catch (e) { aviso(e.message, true); } finally { carregar(false); }
      redesenhar();
    }));
  })();
}
