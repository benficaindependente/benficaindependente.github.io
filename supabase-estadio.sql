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
-- Benfica Independente — "Fui ao estádio": os jogos que cada pessoa (com conta) foi ver.
-- Corre depois de supabase-ranking.sql. Pode correr-se mais de uma vez.
--
-- Cada pessoa marca (com um visto) os jogos a que foi. Guarda-se só o jogo (data, adversário, competição, resultado,
-- casa ou fora) ligado à conta. A conta e tudo isto apagam-se quando a pessoa quiser.
-- Categorias: 'principal' (futebol, equipa principal), 'jovens_feminino' (camadas jovens e futebol feminino) e 'modalidades'.
-- =====================================================================

create table if not exists public.idas_estadio (
  user_id    uuid not null references auth.users (id) on delete cascade,
  jogo       text not null,                       -- identificador do jogo (igual para todos os que marcam o mesmo jogo)
  categoria  text not null check (categoria in ('principal', 'jovens_feminino', 'modalidades')),
  data       date not null,
  casa       boolean,                             -- true = em casa, false = fora, null = não se sabe
  competicao text not null default '',
  tipo       text not null default 'outra' check (tipo in ('liga', 'taca', 'uefa', 'outra')),
  adversario text not null default '',
  golos_b    smallint,                            -- golos do Benfica (se se souber)
  golos_r    smallint,                            -- golos do adversário
  modalidade text not null default '',
  estrangeiro boolean not null default false,     -- jogo fora de Portugal
  quando     timestamptz not null default now(),
  primary key (user_id, jogo)
);
alter table public.idas_estadio add column if not exists estrangeiro boolean not null default false;
alter table public.idas_estadio enable row level security;

-- A que prova pertence um jogo, pelo nome da competição (serve para os rankings por prova).
create or replace function public.bi_prova(p_competicao text) returns text
language sql immutable as $$
  select case
    when t ~ 'campeoes|champions' then 'uefa'
    when t ~ 'europa|conference|conferencia|uefa' then 'uefa'
    when t ~ 'supertaca' then 'supertaca'
    when t ~ 'taca da liga|league cup|allianz' then 'taca_liga'
    when t ~ 'taca de portugal|taca portugal' then 'taca_portugal'
    when t ~ 'liga|campeonato|primeira' then 'liga'
    else 'outra' end
  from (select translate(lower(coalesce(p_competicao, '')), 'çãõáéíóúâêôà', 'caoaeiouaeoa') t) x
$$;
revoke all on public.idas_estadio from anon, authenticated;

-- Marca (ou atualiza) um jogo a que a pessoa foi.
create or replace function public.bi_ida_marcar(
  p_jogo text, p_categoria text, p_data date, p_casa boolean, p_competicao text, p_tipo text,
  p_adversario text, p_gb int, p_gr int, p_modalidade text, p_estrangeiro boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from perfis where user_id = uid) then raise exception 'Entra na tua conta.'; end if;
  if coalesce(length(p_jogo), 0) not between 3 and 120 then raise exception 'Jogo inválido.'; end if;
  if p_categoria not in ('principal', 'jovens_feminino', 'modalidades') then raise exception 'Categoria inválida.'; end if;
  if p_data is null or p_data > current_date + 1 or p_data < date '1904-01-01' then raise exception 'Data inválida.'; end if;
  if p_gb is not null and p_gb not between 0 and 300 then p_gb := null; end if;
  if p_gr is not null and p_gr not between 0 and 300 then p_gr := null; end if;
  if p_gb is null or p_gr is null then p_gb := null; p_gr := null; end if;
  insert into idas_estadio (user_id, jogo, categoria, data, casa, competicao, tipo, adversario, golos_b, golos_r, modalidade, estrangeiro)
  values (uid, p_jogo, p_categoria, p_data, p_casa, left(coalesce(p_competicao, ''), 80),
          case when p_tipo in ('liga', 'taca', 'uefa') then p_tipo else 'outra' end,
          left(coalesce(p_adversario, ''), 80), p_gb, p_gr, left(coalesce(p_modalidade, ''), 40), coalesce(p_estrangeiro, false))
  on conflict (user_id, jogo) do update set categoria = excluded.categoria, data = excluded.data, casa = excluded.casa, competicao = excluded.competicao,
    tipo = excluded.tipo, adversario = excluded.adversario, golos_b = excluded.golos_b, golos_r = excluded.golos_r, modalidade = excluded.modalidade,
    estrangeiro = excluded.estrangeiro;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_ida_remover(p_jogo text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Entra na tua conta.'; end if;
  delete from idas_estadio where user_id = uid and jogo = p_jogo;
  return json_build_object('ok', true);
end $$;

-- Os jogos a que eu fui (as estatísticas calculam-se na app).
create or replace function public.bi_minhas_idas() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('jogo', jogo, 'categoria', categoria, 'data', data, 'casa', casa, 'competicao', competicao, 'tipo', tipo,
            'adversario', adversario, 'gb', golos_b, 'gr', golos_r, 'modalidade', modalidade, 'estrangeiro', estrangeiro) order by data desc, quando desc)
          from idas_estadio where user_id = uid), '[]'::json);
end $$;

-- Para a plataforma: quem mais vai ao estádio (só contas com a participação associada).
create or replace function public.bi_admin_idas(p_gh text, p_periodo text default 'epoca') returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); de date;
begin
  de := case p_periodo when '30d' then current_date - 29 when 'tudo' then date '1904-01-01' else (bi_epoca_inicio() at time zone 'Europe/Lisbon')::date end;
  return json_build_object(
    'periodo', coalesce(p_periodo, 'epoca'), 'desde', de,
    'lista', coalesce((select json_agg(x order by x.total desc, x.nome) from (
      select pf.user_id, pf.nome as nome_real, pf.alcunha, pf.pais, pf.localidade,
        coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome,
        count(*) total,
        count(*) filter (where i.categoria = 'principal') principal,
        count(*) filter (where i.categoria = 'jovens_feminino') jovens_feminino,
        count(*) filter (where i.categoria = 'modalidades') modalidades,
        count(*) filter (where i.categoria = 'principal' and i.casa) casa,
        count(*) filter (where i.categoria = 'principal' and i.casa = false) fora,
        count(*) filter (where i.categoria = 'principal' and i.tipo = 'liga') liga,
        count(*) filter (where i.categoria = 'principal' and i.tipo = 'taca') taca,
        count(*) filter (where i.categoria = 'principal' and i.tipo = 'uefa') uefa,
        count(*) filter (where i.categoria = 'principal' and i.golos_b > i.golos_r) vitorias,
        count(*) filter (where i.categoria = 'principal' and i.golos_b = i.golos_r) empates,
        count(*) filter (where i.categoria = 'principal' and i.golos_b < i.golos_r) derrotas,
        count(*) filter (where i.categoria = 'principal' and i.estrangeiro) estrangeiro,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'uefa' and i.casa) uefa_casa,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'uefa' and i.casa = false) uefa_fora,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'liga' and i.casa) liga_casa,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'liga' and i.casa = false) liga_fora,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'taca_portugal' and i.casa) tp_casa,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'taca_portugal' and i.casa = false) tp_fora,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'taca_liga' and i.casa) tl_casa,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'taca_liga' and i.casa = false) tl_fora,
        count(*) filter (where i.categoria = 'principal' and bi_prova(i.competicao) = 'supertaca') supertaca
      from perfis pf join idas_estadio i on i.user_id = pf.user_id
      where pf.participacao and i.data >= de
      group by pf.user_id, pf.nome, pf.alcunha, pf.pais, pf.localidade, pf.mostrar) x), '[]'::json),
    'jogos', coalesce((select json_agg(j order by j.n desc, j.data desc) from (
      select i.jogo, max(i.data) data, max(i.adversario) adversario, max(i.competicao) competicao, max(i.categoria) categoria, max(i.modalidade) modalidade, count(*) n
      from idas_estadio i join perfis pf on pf.user_id = i.user_id and pf.participacao
      where i.data >= de group by i.jogo order by count(*) desc, max(i.data) desc limit 25) j), '[]'::json)
  );
end $$;

revoke execute on function public.bi_ida_marcar(text, text, date, boolean, text, text, text, int, int, text, boolean), public.bi_ida_remover(text),
  public.bi_minhas_idas(), public.bi_admin_idas(text, text) from public;
grant execute on function public.bi_ida_marcar(text, text, date, boolean, text, text, text, int, int, text, boolean), public.bi_ida_remover(text),
  public.bi_minhas_idas(), public.bi_admin_idas(text, text) to anon, authenticated;
