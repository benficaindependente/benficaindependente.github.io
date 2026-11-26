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
-- Benfica Independente — "Um Benfiquista vai à Casa do Benfica": as casas onde cada pessoa (com conta) já esteve.
-- Corre depois de supabase-ranking.sql. Pode correr-se mais de uma vez.
--
-- Cada pessoa marca as Casas do Benfica que já visitou. Guarda-se só o identificador da casa (e o nome, a cidade e o país,
-- para os rankings) ligado à conta. Apaga-se com a conta.
-- =====================================================================

create table if not exists public.casas_visitadas (
  user_id     uuid not null references auth.users (id) on delete cascade,
  casa        text not null,                      -- identificador da casa (data/casas.json)
  nome        text not null default '',
  cidade      text not null default '',
  pais        text not null default '',
  estrangeiro boolean not null default false,
  estrelas    smallint check (estrelas between 1 and 5),   -- a nota que a pessoa deu à casa (opcional)
  quando      timestamptz not null default now(),
  primary key (user_id, casa)
);
alter table public.casas_visitadas add column if not exists estrelas smallint check (estrelas between 1 and 5);
alter table public.casas_visitadas enable row level security;
revoke all on public.casas_visitadas from anon, authenticated;

create or replace function public.bi_casa_marcar(p_casa text, p_nome text default '', p_cidade text default '', p_pais text default '', p_estrangeiro boolean default false, p_estrelas int default null) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from perfis where user_id = uid) then raise exception 'Entra na tua conta.'; end if;
  if coalesce(length(p_casa), 0) not between 2 and 80 then raise exception 'Casa inválida.'; end if;
  insert into casas_visitadas (user_id, casa, nome, cidade, pais, estrangeiro, estrelas)
  values (uid, p_casa, left(coalesce(p_nome, ''), 100), left(coalesce(p_cidade, ''), 80), left(coalesce(p_pais, ''), 60), coalesce(p_estrangeiro, false),
          case when p_estrelas between 1 and 5 then p_estrelas end)
  on conflict (user_id, casa) do update set nome = excluded.nome, cidade = excluded.cidade, pais = excluded.pais, estrangeiro = excluded.estrangeiro,
    estrelas = coalesce(excluded.estrelas, casas_visitadas.estrelas);
  return json_build_object('ok', true);
end $$;

-- Dar (ou mudar) as estrelas de uma casa já visitada. 0 tira a nota.
create or replace function public.bi_casa_estrelas(p_casa text, p_estrelas int) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Entra na tua conta.'; end if;
  update casas_visitadas set estrelas = case when p_estrelas between 1 and 5 then p_estrelas end where user_id = uid and casa = p_casa;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_casa_remover(p_casa text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Entra na tua conta.'; end if;
  delete from casas_visitadas where user_id = uid and casa = p_casa;
  return json_build_object('ok', true);
end $$;

-- As casas onde eu já estive.
create or replace function public.bi_minhas_casas() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('casa', casa, 'estrelas', estrelas) order by quando desc) from casas_visitadas where user_id = uid), '[]'::json);
end $$;

-- Quantas pessoas já estiveram em cada casa e a média das estrelas (anónimo): serve para a "casa mais visitada" e a "melhor classificada".
create or replace function public.bi_casas_contagem() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_object_agg(casa, json_build_object('n', n, 'media', media, 'votos', votos)), '{}'::json)
  from (select casa, count(*) n, round(avg(estrelas)::numeric, 1) media, count(estrelas) votos from casas_visitadas group by casa) x
$$;

-- Ranking de quem visitou mais casas (os 10 primeiros e o meu lugar).
create or replace function public.bi_ranking_casas(p_limite int default 10) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  return (
    with t as (
      select cv.user_id, count(*) total, count(*) filter (where not cv.estrangeiro) pt, count(*) filter (where cv.estrangeiro) ext
      from casas_visitadas cv join perfis pf on pf.user_id = cv.user_id group by cv.user_id
    ), cl as (
      select t.*, rank() over (order by t.total desc, t.ext desc) pos from t
    ), nomes as (
      select cl.*, coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome
      from cl join perfis pf on pf.user_id = cl.user_id
    )
    select json_build_object(
      'participantes', (select count(*) from nomes),
      'lista', coalesce((select json_agg(json_build_object('pos', pos, 'nome', nome, 'total', total, 'pt', pt, 'ext', ext, 'eu', coalesce(user_id = uid, false)) order by pos, nome)
                         from (select * from nomes order by pos, nome limit greatest(1, least(coalesce(p_limite, 10), 10))) x), '[]'::json),
      'meu', (select json_build_object('pos', pos, 'nome', nome, 'total', total, 'pt', pt, 'ext', ext) from nomes where user_id = uid)
    )
  );
end $$;

-- Para a plataforma: quem visitou mais casas e quais são as casas mais visitadas (só contas com a participação associada).
create or replace function public.bi_admin_casas(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return json_build_object(
    'lista', coalesce((select json_agg(x order by x.total desc, x.estrangeiro desc, x.nome) from (
      select pf.user_id, pf.nome as nome_real, pf.alcunha, pf.pais, pf.localidade,
        coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome,
        count(*) total,
        count(*) filter (where not cv.estrangeiro) portugal,
        count(*) filter (where cv.estrangeiro) estrangeiro
      from perfis pf join casas_visitadas cv on cv.user_id = pf.user_id
      where pf.participacao
      group by pf.user_id, pf.nome, pf.alcunha, pf.pais, pf.localidade, pf.mostrar) x), '[]'::json),
    'casas', coalesce((select json_agg(c order by c.n desc, c.nome) from (
      select cv.casa, max(cv.nome) nome, max(cv.cidade) cidade, max(cv.pais) pais, bool_or(cv.estrangeiro) estrangeiro, count(*) n,
        round(avg(cv.estrelas)::numeric, 1) media, count(cv.estrelas) votos
      from casas_visitadas cv join perfis pf on pf.user_id = cv.user_id and pf.participacao
      group by cv.casa order by count(*) desc, max(cv.nome) limit 30) c), '[]'::json)
  );
end $$;

revoke execute on function public.bi_casa_marcar(text, text, text, text, boolean, int), public.bi_casa_estrelas(text, int), public.bi_casa_remover(text), public.bi_minhas_casas(),
  public.bi_casas_contagem(), public.bi_ranking_casas(int), public.bi_admin_casas(text) from public;
grant execute on function public.bi_casa_marcar(text, text, text, text, boolean, int), public.bi_casa_estrelas(text, int), public.bi_casa_remover(text), public.bi_minhas_casas(),
  public.bi_casas_contagem(), public.bi_ranking_casas(int), public.bi_admin_casas(text) to anon, authenticated;
