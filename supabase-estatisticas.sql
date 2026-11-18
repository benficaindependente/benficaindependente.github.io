-- =====================================================================
-- Benfica Independente — estatísticas da publicidade e dados privados
-- dos anunciantes (Supabase). Corre depois de supabase.sql.
--
-- A app conta, sem identificar ninguém, quantas vezes cada anúncio,
-- destaque, aviso ou o Patreon foi visto e tocado (por dia). O
-- "dispositivo" é um número aleatório criado na instalação (não é o
-- telemóvel nem a pessoa) e só serve para contar pessoas diferentes.
-- =====================================================================

create table if not exists public.estatisticas (
  peca        text not null,           -- id do anúncio / destaque / aviso, ou 'patreon'
  dia         date not null,
  impressoes  int  not null default 0,
  cliques     int  not null default 0,
  primary key (peca, dia)
);

create table if not exists public.alcance (
  peca         text not null,
  dia          date not null,
  dispositivo  text not null,
  primary key (peca, dia, dispositivo)
);

-- Preço, contacto e conversões de cada anunciante (nunca vão para a app).
create table if not exists public.anunciantes (
  peca        text primary key,
  dados       jsonb not null default '{}',
  atualizado  timestamptz not null default now(),
  por         text not null default ''
);

-- Receitas que não vêm da app (AdMob, patrocínios, etc.), por mês.
create table if not exists public.receitas (
  id      bigint generated always as identity primary key,
  mes     date not null,
  origem  text not null,
  valor   numeric(10, 2) not null default 0,
  notas   text not null default '',
  por     text not null default ''
);

alter table public.estatisticas enable row level security;
alter table public.alcance      enable row level security;
alter table public.anunciantes  enable row level security;
alter table public.receitas     enable row level security;
revoke all on public.estatisticas, public.alcance, public.anunciantes, public.receitas from anon, authenticated;

-- A app envia contagens em lote: [{"p": "id", "v": 3, "c": 1}, ...]
create or replace function public.bi_contar(p_dispositivo text, p_eventos json) returns json
language plpgsql security definer set search_path = public as $$
declare
  e json; p text; v int; c int; n int := 0;
  hoje date := (now() at time zone 'Europe/Lisbon')::date;
begin
  for e in select * from json_array_elements(p_eventos) limit 60 loop
    p := left(coalesce(e ->> 'p', ''), 60);
    v := least(greatest(coalesce((e ->> 'v')::int, 0), 0), 300);
    c := least(greatest(coalesce((e ->> 'c')::int, 0), 0), 30);
    continue when p = '' or (v = 0 and c = 0);
    insert into estatisticas (peca, dia, impressoes, cliques) values (p, hoje, v, c)
    on conflict (peca, dia) do update set impressoes = estatisticas.impressoes + excluded.impressoes,
                                         cliques = estatisticas.cliques + excluded.cliques;
    if coalesce(length(p_dispositivo), 0) between 8 and 64 then
      insert into alcance values (p, hoje, p_dispositivo) on conflict do nothing;
    end if;
    n := n + 1;
  end loop;
  -- De vez em quando limpa o alcance com mais de 100 dias (as contagens ficam).
  if random() < 0.01 then delete from alcance where dia < hoje - 100; end if;
  return json_build_object('ok', true, 'contados', n);
end $$;

create or replace function public.bi_admin_estatisticas(p_gh text, p_de date default null) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object('peca', s.peca, 'dia', s.dia, 'impressoes', s.impressoes,
            'cliques', s.cliques, 'alcance', (select count(*) from alcance a where a.peca = s.peca and a.dia = s.dia)) order by s.dia), '[]'::json)
          from estatisticas s where p_de is null or s.dia >= p_de);
end $$;

create or replace function public.bi_admin_anunciantes(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_object_agg(peca, dados || jsonb_build_object('_atualizado', atualizado, '_por', por)), '{}'::json) from anunciantes);
end $$;

create or replace function public.bi_admin_anunciante(p_gh text, p_peca text, p_dados json) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  insert into anunciantes (peca, dados, atualizado, por) values (p_peca, coalesce(p_dados::jsonb, '{}'), now(), l)
  on conflict (peca) do update set dados = excluded.dados, atualizado = now(), por = l;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_receitas(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object('id', id, 'mes', mes, 'origem', origem, 'valor', valor, 'notas', notas, 'por', por) order by mes desc, id desc), '[]'::json) from receitas);
end $$;

create or replace function public.bi_admin_receita(p_gh text, p_mes date, p_origem text, p_valor numeric, p_notas text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  insert into receitas (mes, origem, valor, notas, por) values (date_trunc('month', p_mes)::date, left(p_origem, 80), coalesce(p_valor, 0), left(coalesce(p_notas, ''), 500), l);
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_receita_apagar(p_gh text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  delete from receitas where id = p_id;
  return json_build_object('ok', true);
end $$;

revoke execute on function public.bi_contar(text, json), public.bi_admin_estatisticas(text, date),
  public.bi_admin_anunciantes(text), public.bi_admin_anunciante(text, text, json),
  public.bi_admin_receitas(text), public.bi_admin_receita(text, date, text, numeric, text),
  public.bi_admin_receita_apagar(text, bigint) from public;
grant execute on function public.bi_contar(text, json), public.bi_admin_estatisticas(text, date),
  public.bi_admin_anunciantes(text), public.bi_admin_anunciante(text, text, json),
  public.bi_admin_receitas(text), public.bi_admin_receita(text, date, text, numeric, text),
  public.bi_admin_receita_apagar(text, bigint) to anon, authenticated;
