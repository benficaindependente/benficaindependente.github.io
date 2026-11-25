-- =====================================================================
-- Benfica Independente — Participantes: dispositivos, utilizadores e horas de maior movimento.
-- Corre depois de supabase-estatisticas.sql e supabase-ranking.sql. Pode correr-se mais de uma vez.
--
-- A app avisa quando é aberta (no máximo uma vez de 30 em 30 minutos). Guarda-se só:
--  • o número aleatório da instalação (não é o telemóvel nem a pessoa), o dia da 1.ª e da última vez e a versão da app;
--  • quantas aberturas houve em cada hora de cada dia.
-- Nada disto identifica ninguém. Só as contas (com consentimento) têm a participação associada ao nome.
-- =====================================================================

create table if not exists public.dispositivos (
  id        text primary key,
  primeiro  date not null,
  ultimo    date not null,
  aberturas integer not null default 1,
  versao    text not null default ''
);
-- Fuso horário do telemóvel (ex.: Europe/Zurich): dá uma estimativa do país sem pedir nada à pessoa.
alter table public.dispositivos add column if not exists fuso text not null default '';
create table if not exists public.dispositivos_dia (
  dia date not null,
  dispositivo text not null,
  primary key (dia, dispositivo)
);
create table if not exists public.acessos_hora (
  dia date not null,
  hora smallint not null check (hora between 0 and 23),
  aberturas integer not null default 0,
  primary key (dia, hora)
);
-- Aberturas por hora e por fuso horário (para cruzar horas com países).
create table if not exists public.acessos_fuso_hora (
  dia date not null,
  hora smallint not null check (hora between 0 and 23),
  fuso text not null,
  aberturas integer not null default 0,
  primary key (dia, hora, fuso)
);
alter table public.acessos_fuso_hora enable row level security;
alter table public.dispositivos enable row level security;
alter table public.dispositivos_dia enable row level security;
alter table public.acessos_hora enable row level security;
revoke all on public.dispositivos, public.dispositivos_dia, public.acessos_hora, public.acessos_fuso_hora from anon, authenticated;

-- A app avisa que foi aberta.
drop function if exists public.bi_abrir(text, text, text);
create or replace function public.bi_abrir(p_dispositivo text, p_versao text default '', p_fuso text default '') returns json
language plpgsql security definer set search_path = public as $$
declare agora timestamp := now() at time zone 'Europe/Lisbon'; d date := agora::date; h smallint := extract(hour from agora)::smallint;
  fz text := left(coalesce(nullif(trim(p_fuso), ''), 'desconhecido'), 40);
begin
  if coalesce(length(p_dispositivo), 0) between 8 and 64 then
    insert into dispositivos (id, primeiro, ultimo, aberturas, versao, fuso) values (p_dispositivo, d, d, 1, left(coalesce(p_versao, ''), 20), fz)
    on conflict (id) do update set ultimo = d, aberturas = dispositivos.aberturas + 1, versao = excluded.versao, fuso = excluded.fuso;
    insert into dispositivos_dia (dia, dispositivo) values (d, p_dispositivo) on conflict do nothing;
  end if;
  insert into acessos_hora (dia, hora, aberturas) values (d, h, 1)
  on conflict (dia, hora) do update set aberturas = acessos_hora.aberturas + 1;
  insert into acessos_fuso_hora (dia, hora, fuso, aberturas) values (d, h, fz, 1)
  on conflict (dia, hora, fuso) do update set aberturas = acessos_fuso_hora.aberturas + 1;
  if random() < 0.01 then
    delete from dispositivos_dia where dia < d - 400;
    delete from acessos_hora where dia < d - 800;
    delete from acessos_fuso_hora where dia < d - 800;
  end if;
  return json_build_object('ok', true);
end $$;

-- Aberturas por hora do dia (24 valores) entre dois dias.
create or replace function public.bi_horas_arr(a date, b date) returns json
language sql stable security definer set search_path = public as $$
  select json_agg(coalesce(s.ab, 0) order by h)
  from generate_series(0, 23) h
  left join (select hora, sum(aberturas) ab from acessos_hora where dia between a and b group by hora) s on s.hora = h;
$$;

-- Para a plataforma: números gerais, série diária e horas de maior movimento.
create or replace function public.bi_admin_participantes(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); hoje date := (now() at time zone 'Europe/Lisbon')::date;
begin
  return json_build_object(
    'hoje', hoje,
    'dispositivos_total', (select count(*) from dispositivos),
    'ativos_7d', (select count(*) from dispositivos where ultimo >= hoje - 6),
    'ativos_30d', (select count(*) from dispositivos where ultimo >= hoje - 29),
    'novos_hoje', (select count(*) from dispositivos where primeiro = hoje),
    'novos_7d', (select count(*) from dispositivos where primeiro >= hoje - 6),
    'novos_30d', (select count(*) from dispositivos where primeiro >= hoje - 29),
    'contas', (select count(*) from perfis),
    'contas_com_participacao', (select count(*) from perfis where participacao),
    'versoes', coalesce((select json_agg(json_build_object('versao', v, 'n', n) order by n desc)
                         from (select coalesce(nullif(versao, ''), '?') v, count(*) n from dispositivos where ultimo >= hoje - 29 group by 1) q), '[]'::json),
    'diario', coalesce((select json_agg(json_build_object('dia', d.dia, 'aberturas', coalesce(a.ab, 0), 'dispositivos', coalesce(x.n, 0)) order by d.dia)
        from (select hoje - g as dia from generate_series(0, 119) g) d
        left join (select dia, sum(aberturas) ab from acessos_hora group by dia) a on a.dia = d.dia
        left join (select dia, count(*) n from dispositivos_dia group by dia) x on x.dia = d.dia), '[]'::json),
    'horas', json_build_object(
      'hoje', bi_horas_arr(hoje, hoje), 'ontem', bi_horas_arr(hoje - 1, hoje - 1), 'semana', bi_horas_arr(hoje - 6, hoje),
      'mes', bi_horas_arr(hoje - 29, hoje), 'ano', bi_horas_arr(hoje - 364, hoje)),
    'fusos', coalesce((select json_agg(json_build_object('fuso', fuso, 'total', total, 'ativos_30d', ativos) order by total desc)
        from (select fuso, count(*) total, count(*) filter (where ultimo >= hoje - 29) ativos from dispositivos where fuso <> '' group by fuso) f), '[]'::json),
    'horas_fuso', coalesce((select json_agg(json_build_object('fuso', fuso, 'hora', hora, 'n', n))
        from (select fuso, hora, sum(aberturas) n from acessos_fuso_hora where dia >= hoje - 89 group by 1, 2) hf), '[]'::json),
    'paises_contas', coalesce((select json_agg(json_build_object('pais', pais, 'n', n, 'localidades', loc) order by n desc)
        from (select coalesce(nullif(trim(pais), ''), 'Não indicado') pais, count(*) n, count(distinct nullif(lower(trim(localidade)), '')) loc from perfis group by 1) p), '[]'::json),
    'localidades_contas', coalesce((select json_agg(json_build_object('pais', pais, 'localidade', loc, 'n', n) order by n desc)
        from (select coalesce(nullif(trim(pais), ''), 'Não indicado') pais, trim(localidade) loc, count(*) n from perfis where trim(localidade) <> '' group by 1, 2 order by 3 desc limit 60) l), '[]'::json),
    'evolucao', coalesce((select json_agg(json_build_object('dia', d.dia, 'novos', coalesce(n.c, 0), 'contas', coalesce(c.c, 0), 'participacoes', coalesce(p.c, 0) + coalesce(r.c, 0)) order by d.dia)
        from (select hoje - g as dia from generate_series(0, 179) g) d
        left join (select primeiro dia, count(*) c from dispositivos group by 1) n on n.dia = d.dia
        left join (select (criado at time zone 'Europe/Lisbon')::date dia, count(*) c from perfis group by 1) c on c.dia = d.dia
        left join (select dia, count(*) c from participacao_conta group by 1) p on p.dia = d.dia
        left join (select (quando at time zone 'Europe/Lisbon')::date dia, count(*) c from ranking_prognosticos group by 1) r on r.dia = d.dia), '[]'::json),
    'dia_hora', coalesce((select json_agg(json_build_object('dow', dow, 'hora', hora, 'n', n))
        from (select extract(isodow from dia)::int dow, hora, sum(aberturas) n from acessos_hora where dia >= hoje - 89 group by 1, 2) m), '[]'::json)
  );
end $$;

-- Aberturas por dia e por hora entre duas datas (para o calendário da plataforma).
create or replace function public.bi_admin_acessos_periodo(p_gh text, p_de date, p_ate date) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 120 then raise exception 'Período inválido.'; end if;
  return coalesce((select json_agg(json_build_object('dia', dia, 'hora', hora, 'n', aberturas) order by dia, hora) from acessos_hora where dia between p_de and p_ate), '[]'::json);
end $$;

revoke execute on function public.bi_abrir(text, text, text), public.bi_horas_arr(date, date), public.bi_admin_participantes(text), public.bi_admin_acessos_periodo(text, date, date) from public;
grant execute on function public.bi_abrir(text, text, text), public.bi_admin_participantes(text), public.bi_admin_acessos_periodo(text, date, date) to anon, authenticated;
