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
-- Benfica Independente — sondagens, "Homem do jogo" e registo de atividade.
-- Corre depois de supabase.sql (precisa de bi_quem).
--
-- Sondagens: criadas na plataforma; como tudo o resto, só aparecem na app
-- depois de aprovadas por um segundo administrador.
-- Homem do jogo: automático. No fim de cada jogo da equipa principal a app
-- mostra os jogadores que jogaram e cada telemóvel vota uma vez.
-- O "dispositivo" é o número aleatório da instalação (não identifica ninguém).
-- =====================================================================

create table if not exists public.sondagens (
  id           bigint generated always as identity primary key,
  pergunta     text not null,
  opcoes       jsonb not null,                -- ["Sim", "Não", ...]
  fecha        timestamptz,                   -- data e hora de fim (obrigatória na plataforma)
  criada       timestamptz not null default now(),
  criada_por   text not null default '',
  aprovada_por text,
  fechada      boolean not null default false
);

create table if not exists public.sondagem_votos (
  sondagem    bigint not null references public.sondagens(id) on delete cascade,
  dispositivo text not null,
  opcao       int not null,
  quando      timestamptz not null default now(),
  primary key (sondagem, dispositivo)
);

create table if not exists public.hdj_votos (
  jogo        text not null,                  -- id do jogo (ESPN)
  titulo      text not null default '',       -- "Benfica 2-0 Braga"
  dispositivo text not null,
  jogador     text not null,
  quando      timestamptz not null default now(),
  primary key (jogo, dispositivo)
);

create table if not exists public.atividade (
  id      bigint generated always as identity primary key,
  quando  timestamptz not null default now(),
  quem    text not null,
  acao    text not null,
  detalhe text not null default ''
);

alter table public.sondagens      enable row level security;
alter table public.sondagem_votos enable row level security;
alter table public.hdj_votos      enable row level security;
alter table public.atividade      enable row level security;
revoke all on public.sondagens, public.sondagem_votos, public.hdj_votos, public.atividade from anon, authenticated;

-- ------------------------------ Para a app ------------------------------

-- Sondagens aprovadas para o Início: abertas e as que terminaram há menos de 48 horas (resultado).
create or replace function public.bi_sondagens(p_dispositivo text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'opcoes', s.opcoes,
      'aberta', not s.fechada and (s.fecha is null or s.fecha > now()),
      'fecha', s.fecha,
      'votos', (select coalesce(json_agg(n order by o), '[]'::json) from (
                 select o, (select count(*) from sondagem_votos v where v.sondagem = s.id and v.opcao = o) n
                 from generate_series(0, jsonb_array_length(s.opcoes) - 1) o) x),
      'meu', (select v.opcao from sondagem_votos v where v.sondagem = s.id and v.dispositivo = p_dispositivo)
    ) order by s.criada desc), '[]'::json)
  from sondagens s
  where s.aprovada_por is not null
    and (s.fecha is null or s.fecha > now() - interval '48 hours');
$$;

create or replace function public.bi_votar(p_sondagem bigint, p_dispositivo text, p_opcao int) returns json
language plpgsql security definer set search_path = public as $$
declare s sondagens;
begin
  if coalesce(length(p_dispositivo), 0) not between 8 and 64 then return json_build_object('ok', false); end if;
  select * into s from sondagens where id = p_sondagem and aprovada_por is not null;
  if s.id is null or s.fechada or (s.fecha is not null and s.fecha <= now())
     or p_opcao < 0 or p_opcao >= jsonb_array_length(s.opcoes) then
    return json_build_object('ok', false);
  end if;
  insert into sondagem_votos (sondagem, dispositivo, opcao) values (p_sondagem, p_dispositivo, p_opcao)
  on conflict (sondagem, dispositivo) do nothing;
  return json_build_object('ok', true);
end $$;

-- Homem do jogo: vota (uma vez por jogo) e devolve a contagem.
create or replace function public.bi_hdj_votar(p_jogo text, p_titulo text, p_dispositivo text, p_jogador text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(length(p_dispositivo), 0) between 8 and 64 and coalesce(length(p_jogo), 0) between 1 and 40
     and coalesce(length(p_jogador), 0) between 2 and 60 then
    insert into hdj_votos (jogo, titulo, dispositivo, jogador)
    values (p_jogo, left(coalesce(p_titulo, ''), 120), p_dispositivo, p_jogador)
    on conflict (jogo, dispositivo) do nothing;
  end if;
  return bi_hdj(p_jogo, p_dispositivo);
end $$;

create or replace function public.bi_hdj(p_jogo text, p_dispositivo text) returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'total', (select count(*) from hdj_votos where jogo = p_jogo),
    'meu', (select jogador from hdj_votos where jogo = p_jogo and dispositivo = p_dispositivo),
    'votos', (select coalesce(json_agg(json_build_object('jogador', jogador, 'n', n) order by n desc, jogador), '[]'::json)
              from (select jogador, count(*) n from hdj_votos where jogo = p_jogo group by jogador) x));
$$;


-- Histórico (menu ⋮ da app): sondagens que já saíram do Início (terminaram há mais de 48 horas).
create or replace function public.bi_sondagens_historico(p_dispositivo text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'opcoes', s.opcoes, 'aberta', false, 'fecha', s.fecha,
      'votos', (select coalesce(json_agg(n order by o), '[]'::json) from (
                 select o, (select count(*) from sondagem_votos v where v.sondagem = s.id and v.opcao = o) n
                 from generate_series(0, jsonb_array_length(s.opcoes) - 1) o) x),
      'meu', (select v.opcao from sondagem_votos v where v.sondagem = s.id and v.dispositivo = p_dispositivo)
    ) order by s.fecha desc), '[]'::json)
  from sondagens s
  where s.aprovada_por is not null and s.fecha is not null and s.fecha <= now() - interval '48 hours';
$$;

-- --------------------------- Para a plataforma ---------------------------

create or replace function public.bi_admin_sondagens(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'opcoes', s.opcoes, 'fecha', s.fecha, 'criada', s.criada,
      'criada_por', s.criada_por, 'aprovada_por', s.aprovada_por, 'fechada', s.fechada,
      'votos', (select coalesce(json_agg(n order by o), '[]'::json) from (
                 select o, (select count(*) from sondagem_votos v where v.sondagem = s.id and v.opcao = o) n
                 from generate_series(0, jsonb_array_length(s.opcoes) - 1) o) x)
    ) order by s.criada desc), '[]'::json) from sondagens s);
end $$;

create or replace function public.bi_admin_sondagem_criar(p_gh text, p_pergunta text, p_opcoes json, p_fecha timestamptz) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); n int := json_array_length(p_opcoes);
begin
  if coalesce(length(trim(p_pergunta)), 0) < 3 or n < 2 or n > 6 then
    raise exception 'A sondagem precisa de pergunta e de 2 a 6 respostas.';
  end if;
  if p_fecha is null or p_fecha <= now() then
    raise exception 'Escolhe o dia e a hora em que a sondagem termina (no futuro).';
  end if;
  insert into sondagens (pergunta, opcoes, fecha, criada_por) values (left(trim(p_pergunta), 200), p_opcoes::jsonb, p_fecha, l);
  insert into atividade (quem, acao, detalhe) values (l, 'Criou sondagem', left(p_pergunta, 200));
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_sondagem_aprovar(p_gh text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); s sondagens;
begin
  select * into s from sondagens where id = p_id;
  if s.id is null then raise exception 'Sondagem não encontrada.'; end if;
  if s.criada_por = l then raise exception 'Tem de ser outro administrador a aprovar.'; end if;
  update sondagens set aprovada_por = l where id = p_id;
  insert into atividade (quem, acao, detalhe) values (l, 'Aprovou sondagem', left(s.pergunta, 200));
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_sondagem_fechar(p_gh text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); s sondagens;
begin
  select * into s from sondagens where id = p_id;
  update sondagens set fechada = true, fecha = least(coalesce(fecha, now()), now()) where id = p_id;
  insert into atividade (quem, acao, detalhe) values (l, 'Fechou sondagem', left(coalesce(s.pergunta, ''), 200));
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_sondagem_apagar(p_gh text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); s sondagens;
begin
  select * into s from sondagens where id = p_id;
  delete from sondagens where id = p_id;
  insert into atividade (quem, acao, detalhe) values (l, 'Apagou sondagem', left(coalesce(s.pergunta, ''), 200));
  return json_build_object('ok', true);
end $$;

-- Homem do jogo dos últimos jogos (todos os jogadores votados, do mais para o menos votado).
create or replace function public.bi_admin_hdj(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(j order by j.ultimo desc), '[]'::json) from (
    select jogo, max(titulo) titulo, max(quando) ultimo, count(*) total,
      (select json_agg(json_build_object('jogador', jogador, 'n', n) order by n desc, jogador) from (
         select jogador, count(*) n from hdj_votos h2 where h2.jogo = h.jogo group by jogador) t) votos
    from hdj_votos h group by jogo order by max(quando) desc limit 15) j);
end $$;

-- Registo de atividade (o que se faz no Supabase: sondagens, mensagens, etc.).
create or replace function public.bi_admin_registar(p_gh text, p_acao text, p_detalhe text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  insert into atividade (quem, acao, detalhe) values (l, left(p_acao, 80), left(coalesce(p_detalhe, ''), 300));
  if random() < 0.02 then delete from atividade where quando < now() - interval '400 days'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_atividade(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object('quando', quando, 'quem', quem, 'acao', acao, 'detalhe', detalhe) order by quando desc), '[]'::json)
          from (select * from atividade order by quando desc limit 200) a);
end $$;

revoke execute on function public.bi_sondagens(text), public.bi_sondagens_historico(text), public.bi_votar(bigint, text, int),
  public.bi_hdj_votar(text, text, text, text), public.bi_hdj(text, text),
  public.bi_admin_sondagens(text), public.bi_admin_sondagem_criar(text, text, json, timestamptz),
  public.bi_admin_sondagem_aprovar(text, bigint), public.bi_admin_sondagem_fechar(text, bigint),
  public.bi_admin_sondagem_apagar(text, bigint), public.bi_admin_hdj(text),
  public.bi_admin_registar(text, text, text), public.bi_admin_atividade(text) from public;
grant execute on function public.bi_sondagens(text), public.bi_sondagens_historico(text), public.bi_votar(bigint, text, int),
  public.bi_hdj_votar(text, text, text, text), public.bi_hdj(text, text),
  public.bi_admin_sondagens(text), public.bi_admin_sondagem_criar(text, text, json, timestamptz),
  public.bi_admin_sondagem_aprovar(text, bigint), public.bi_admin_sondagem_fechar(text, bigint),
  public.bi_admin_sondagem_apagar(text, bigint), public.bi_admin_hdj(text),
  public.bi_admin_registar(text, text, text), public.bi_admin_atividade(text) to anon, authenticated;
