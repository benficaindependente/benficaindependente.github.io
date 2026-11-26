-- #####################################################################
-- JÁ INCLUÍDO — não voltar a correr.
-- Este ficheiro fica só como registo. A versão em vigor das correções está em
-- supabase-correcoes-2026-11-26.sql (esse pode correr-se as vezes que for preciso).
-- O bloco abaixo trava este ficheiro se as correções já tiverem sido aplicadas.
-- #####################################################################
do $$ begin
  if to_regclass('public.casas_oficiais') is not null then
    raise exception 'Este ficheiro é antigo: não voltar a correr. Nada foi alterado.';
  end if;
end $$;

-- =====================================================================
-- Benfica Independente — TIRAR a funcionalidade "Quem vai jogar?" (palpites do onze).
--
-- A app e a plataforma deixaram de a usar: ficou só o prognóstico do resultado.
-- Pode correr-se mais de uma vez. NÃO apaga prognósticos, perguntas, sondagens
-- nem resultados: só os palpites do onze (que já não são recolhidos).
--
-- O que faz, por esta ordem:
--   1) a limpeza automática deixa de falar dos onzes;
--   2) a lista da plataforma deixa de contar onzes;
--   3) apaga as funções e a tabela dos palpites do onze.
--
-- Fica como está o que continua a ser usado:
--   • prognosticos        → prognósticos do resultado
--   • jogos_real          → resultado e onze REAIS (é o que conta quem acertou)
--   • perguntas_programa  → perguntas ao programa
--   • bi_admin_jogo_fechar → fecho manual do jogo (o robô já o faz sozinho)
--
-- IMPORTANTE: depois de correr isto, NÃO voltes a correr uma versão antiga do
-- supabase-novidades.sql (voltaria a criar os onzes). O ficheiro do projeto já
-- foi limpo; este script serve para a base de dados que já está a funcionar.
-- =====================================================================

begin;

-- 1) Limpeza automática (5 dias de prognósticos, 10 de resultados, 30 de perguntas).
create or replace function public.bi_limpar_participacao() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from prognosticos where quando < now() - interval '5 days';
  delete from jogos_real where fechado < now() - interval '10 days';
  delete from perguntas_programa where quando < now() - interval '30 days';
  perform bi_sincronizar_jogos();
end $$;

-- 2) Lista da plataforma: um jogo de cada vez, quantos prognósticos e, se fechado, o resultado.
create or replace function public.bi_admin_participacao(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  perform bi_limpar_participacao();
  return (select coalesce(json_agg(j order by j.ultimo desc), '[]'::json) from (
    select x.jogo, max(x.titulo) titulo, max(x.quando) ultimo, count(*) progs,
      (select row_to_json(r) from (select golos_b, golos_r, onze, fechado from jogos_real where jogo = x.jogo) r) resultado
    from prognosticos x group by x.jogo) j);
end $$;

-- 3) Fora com os palpites do onze.
drop function if exists public.bi_onze_enviar(text, text, text, text, json, text);
drop function if exists public.bi_onze_meu(text, text);
drop function if exists public.bi_admin_onzes(text, text);
drop table if exists public.palpites_onze;

commit;

-- =====================================================================
-- Conferir (opcional): deve dar 0 linhas em baixo.
--   select proname from pg_proc
--    where proname in ('bi_onze_enviar','bi_onze_meu','bi_admin_onzes');
--   select to_regclass('public.palpites_onze');  -- null = tabela apagada
-- =====================================================================
