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
-- Benfica Independente — "Homem do jogo" (MVP): terminar a votação a qualquer momento.
-- Corre depois de supabase-sondagens.sql e supabase-acesso.sql. Pode correr-se mais de uma vez.
--
--  • A app avisa o Supabase de que o jogo acabou e a votação abriu (bi_hdj_abrir).
--  • Quem está a fazer o direto carrega em "Terminar votação agora" na plataforma: a votação fecha
--    na hora, deixa de aceitar votos e a app mostra logo o resultado (o pódio com os 3 mais votados).
--  • Se ninguém a terminar, fecha sozinha ao fim de 24 horas (isso continua a ser a app a tratar).
-- =====================================================================

create table if not exists public.hdj_estado (
  jogo    text primary key,                  -- id do jogo (ESPN)
  titulo  text not null default '',
  aberto  timestamptz not null default now(),
  fechado timestamptz,                       -- preenchido quando um administrador termina a votação
  por     text
);
alter table public.hdj_estado enable row level security;   -- sem políticas: só as funções abaixo lhe mexem
revoke all on public.hdj_estado from anon, authenticated;

-- A app regista o jogo quando a votação abre (no máximo 6 jogos novos por dia, para não haver abusos).
create or replace function public.bi_hdj_abrir(p_jogo text, p_titulo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(length(p_jogo), 0) between 1 and 40
     and (exists (select 1 from hdj_estado where jogo = p_jogo)
          or (select count(*) from hdj_estado where aberto > now() - interval '1 day') < 6) then
    insert into hdj_estado (jogo, titulo) values (p_jogo, left(coalesce(p_titulo, ''), 120))
    on conflict (jogo) do nothing;
  end if;
  if random() < 0.05 then delete from hdj_estado where aberto < now() - interval '60 days'; end if;
  return json_build_object('ok', true);
end $$;

-- Resultado + se já foi terminada pela plataforma.
create or replace function public.bi_hdj(p_jogo text, p_dispositivo text) returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'total', (select count(*) from hdj_votos where jogo = p_jogo),
    'meu', (select jogador from hdj_votos where jogo = p_jogo and dispositivo = p_dispositivo),
    'fechado', (select fechado from hdj_estado where jogo = p_jogo),
    'votos', (select coalesce(json_agg(json_build_object('jogador', jogador, 'n', n) order by n desc, jogador), '[]'::json)
              from (select jogador, count(*) n from hdj_votos where jogo = p_jogo group by jogador) x));
$$;

-- Votar: depois de terminada, já não conta.
create or replace function public.bi_hdj_votar(p_jogo text, p_titulo text, p_dispositivo text, p_jogador text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(length(p_dispositivo), 0) between 8 and 64 and coalesce(length(p_jogo), 0) between 1 and 40
     and coalesce(length(p_jogador), 0) between 2 and 60
     and not exists (select 1 from hdj_estado where jogo = p_jogo and fechado is not null and fechado <= now()) then
    insert into hdj_votos (jogo, titulo, dispositivo, jogador)
    values (p_jogo, left(coalesce(p_titulo, ''), 120), p_dispositivo, p_jogador)
    on conflict (jogo, dispositivo) do nothing;
  end if;
  return bi_hdj(p_jogo, p_dispositivo);
end $$;

-- Para a plataforma: os últimos jogos (mesmo os que ainda não têm votos), com o estado da votação.
create or replace function public.bi_admin_hdj(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(j order by j.ultimo desc), '[]'::json) from (
    select h.jogo, max(h.titulo) titulo, max(h.quando) ultimo,
      (select count(*) from hdj_votos v where v.jogo = h.jogo) total,
      (select e.fechado from hdj_estado e where e.jogo = h.jogo) fechado,
      (select e.por from hdj_estado e where e.jogo = h.jogo) por,
      (select e.aberto from hdj_estado e where e.jogo = h.jogo) aberto,
      (select json_agg(json_build_object('jogador', jogador, 'n', n) order by n desc, jogador) from (
         select jogador, count(*) n from hdj_votos h2 where h2.jogo = h.jogo group by jogador) t) votos
    from (select jogo, titulo, quando from hdj_votos
          union all select jogo, titulo, aberto from hdj_estado) h
    group by h.jogo order by max(h.quando) desc limit 15) j);
end $$;

-- Terminar a votação já (durante o direto, por exemplo): fecha na hora e a app mostra o resultado.
create or replace function public.bi_admin_hdj_fechar(p_gh text, p_jogo text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); t text;
begin
  if coalesce(length(p_jogo), 0) not between 1 and 40 then raise exception 'Jogo inválido.'; end if;
  select titulo into t from hdj_estado where jogo = p_jogo;
  if t is null then select max(titulo) into t from hdj_votos where jogo = p_jogo; end if;
  insert into hdj_estado (jogo, titulo, fechado, por) values (p_jogo, left(coalesce(t, ''), 120), now(), l)
  on conflict (jogo) do update set fechado = coalesce(hdj_estado.fechado, now()), por = coalesce(hdj_estado.por, l);
  insert into atividade (quem, acao, detalhe) values (l, 'Terminou a votação Homem do jogo', left(coalesce(t, p_jogo), 200));
  return json_build_object('ok', true);
end $$;

revoke execute on function public.bi_hdj_abrir(text, text), public.bi_hdj(text, text),
  public.bi_hdj_votar(text, text, text, text), public.bi_admin_hdj(text), public.bi_admin_hdj_fechar(text, text) from public;
grant execute on function public.bi_hdj_abrir(text, text), public.bi_hdj(text, text),
  public.bi_hdj_votar(text, text, text, text), public.bi_admin_hdj(text), public.bi_admin_hdj_fechar(text, text) to anon, authenticated;
