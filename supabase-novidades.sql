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
-- Benfica Independente — participação dos adeptos:
--   • prognósticos do jogo (resultado + nome + comentário)
--   • perguntas ao programa
--   • modo de testes: basta 1 administrador para publicar
-- Corre depois de supabase-quadro-e-fotos.sql. Pode correr-se mais de uma vez.
-- (O quiz não precisa de tabelas: o robô cria as perguntas e a app guarda as respostas no telemóvel.)
-- =====================================================================

-- ------------------------- Fase de testes / produção -------------------------
-- TESTES: true  → uma sondagem criada por um administrador fica logo aprovada.
-- PRODUÇÃO: mudar para false (duas aprovações outra vez) e, na plataforma (app.js), APROVACOES = 2.
create or replace function public.bi_modo_teste() returns boolean
language sql immutable as $$ select true $$;

create or replace function public.sondagens_auto_aprovar() returns trigger
language plpgsql as $$
begin
  if public.bi_modo_teste() and new.aprovada_por is null then new.aprovada_por := new.criada_por; end if;
  return new;
end $$;
drop trigger if exists sondagens_auto_aprovar on public.sondagens;
create trigger sondagens_auto_aprovar before insert on public.sondagens
  for each row execute function public.sondagens_auto_aprovar();
-- As que já estavam à espera passam também (só em testes).
update public.sondagens set aprovada_por = criada_por where aprovada_por is null and public.bi_modo_teste();

-- ------------------------- Tabelas -------------------------
create table if not exists public.prognosticos (
  jogo text not null, titulo text not null default '', dispositivo text not null,
  nome text not null, golos_b smallint not null, golos_r smallint not null, comentario text not null default '',
  quando timestamptz not null default now(),
  primary key (jogo, dispositivo)
);
-- O que aconteceu de verdade (preenchido por um administrador): serve para contar quem acertou.
create table if not exists public.jogos_real (
  jogo text primary key, titulo text not null default '',
  golos_b smallint not null, golos_r smallint not null, onze jsonb not null default '[]',
  fechado timestamptz not null default now(), por text
);
create table if not exists public.perguntas_programa (
  id bigserial primary key, dispositivo text not null, nome text not null, texto text not null,
  estado text not null default 'nova',          -- nova | escolhida | lida
  quando timestamptz not null default now()
);
alter table public.prognosticos enable row level security;
alter table public.jogos_real enable row level security;
alter table public.perguntas_programa enable row level security;

-- Os dados dos adeptos desaparecem passados 5 dias (perguntas: 30 dias).
create or replace function public.bi_limpar_participacao() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from prognosticos where quando < now() - interval '5 days';
  delete from jogos_real where fechado < now() - interval '10 days';
  delete from perguntas_programa where quando < now() - interval '30 days';
  perform bi_sincronizar_jogos();
end $$;

-- Resultado e onze inicial REAIS: o robô escreve-os em data/jogos_reais.json assim que o jogo acaba
-- (os nomes já vêm convertidos para os do plantel). Aqui lê-se esse ficheiro de 5 em 5 minutos, no máximo.
create table if not exists public.participacao_sync (id int primary key default 1, ultima timestamptz not null default 'epoch');
insert into public.participacao_sync (id) values (1) on conflict do nothing;
alter table public.participacao_sync enable row level security;

create or replace function public.bi_sincronizar_jogos() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r extensions.http_response; j json;
begin
  if (select ultima from participacao_sync where id = 1) > now() - interval '5 minutes' then return; end if;
  update participacao_sync set ultima = now() where id = 1;
  begin
    r := extensions.http_get('https://raw.githubusercontent.com/benficaindependente/benfica-independente-dados/main/data/jogos_reais.json');
    if r.status <> 200 then return; end if;
    for j in select * from json_array_elements(r.content::json) loop
      insert into jogos_real (jogo, titulo, golos_b, golos_r, onze, por)
      values (left(j->>'jogo', 40), left(coalesce(j->>'titulo', ''), 120), (j->>'golos_b')::int, (j->>'golos_r')::int, coalesce((j->'onze')::jsonb, '[]'), 'automático')
      on conflict (jogo) do update set titulo = excluded.titulo, golos_b = excluded.golos_b, golos_r = excluded.golos_r, onze = excluded.onze
        where jogos_real.por = 'automático';
    end loop;
  exception when others then
    null;  -- sem ficheiro ou formato estranho: tenta outra vez dentro de 5 minutos
  end;
end $$;

-- ------------------------- Funções da app -------------------------
create or replace function public.bi_prognostico_enviar(
  p_jogo text, p_titulo text, p_dispositivo text, p_nome text, p_gb int, p_gr int, p_comentario text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(length(trim(p_nome)), 0) < 2 then raise exception 'Escreve o teu nome.'; end if;
  if p_gb is null or p_gr is null or p_gb not between 0 and 20 or p_gr not between 0 and 20 then raise exception 'Resultado inválido.'; end if;
  if coalesce(length(p_dispositivo), 0) < 8 or coalesce(length(p_jogo), 0) < 1 then raise exception 'Pedido inválido.'; end if;
  if exists (select 1 from jogos_real where jogo = p_jogo) then raise exception 'Este jogo já terminou.'; end if;
  perform bi_limpar_participacao();
  insert into prognosticos (jogo, titulo, dispositivo, nome, golos_b, golos_r, comentario)
  values (left(p_jogo, 40), left(coalesce(p_titulo, ''), 120), left(p_dispositivo, 80), left(trim(p_nome), 40), p_gb, p_gr, left(coalesce(trim(p_comentario), ''), 280))
  on conflict (jogo, dispositivo) do update set nome = excluded.nome, golos_b = excluded.golos_b, golos_r = excluded.golos_r,
    comentario = excluded.comentario, quando = now();
  return json_build_object('ok', true);
end $$;

-- O meu prognóstico (e, depois do jogo, se acertei e quantos acertaram).
create or replace function public.bi_prognostico_meu(p_jogo text, p_dispositivo text) returns json
language plpgsql security definer set search_path = public as $$
declare m prognosticos; r jogos_real; tot int; ac int;
begin
  perform bi_sincronizar_jogos();
  select * into m from prognosticos where jogo = p_jogo and dispositivo = p_dispositivo;
  select * into r from jogos_real where jogo = p_jogo;
  select count(*) into tot from prognosticos where jogo = p_jogo;
  if r.jogo is not null then
    select count(*) into ac from prognosticos where jogo = p_jogo and golos_b = r.golos_b and golos_r = r.golos_r;
  end if;
  return json_build_object('enviado', m.jogo is not null, 'nome', m.nome, 'golos_b', m.golos_b, 'golos_r', m.golos_r,
    'comentario', m.comentario, 'fechado', r.jogo is not null, 'real_b', r.golos_b, 'real_r', r.golos_r,
    'acertou', case when r.jogo is not null and m.jogo is not null then (m.golos_b = r.golos_b and m.golos_r = r.golos_r) end,
    'total', tot, 'total_acertaram', ac);
end $$;

create or replace function public.bi_pergunta_enviar(p_dispositivo text, p_nome text, p_texto text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(length(trim(p_nome)), 0) < 2 then raise exception 'Escreve o teu nome.'; end if;
  if coalesce(length(trim(p_texto)), 0) < 5 then raise exception 'Escreve a pergunta ou sugestão.'; end if;
  if coalesce(length(p_dispositivo), 0) < 8 then raise exception 'Pedido inválido.'; end if;
  if (select count(*) from perguntas_programa where dispositivo = p_dispositivo and quando > now() - interval '1 day') >= 3 then
    raise exception 'Já enviaste 3 hoje. Volta amanhã!';
  end if;
  perform bi_limpar_participacao();
  insert into perguntas_programa (dispositivo, nome, texto) values (left(p_dispositivo, 80), left(trim(p_nome), 40), left(trim(p_texto), 400));
  return json_build_object('ok', true);
end $$;

-- ------------------------- Funções da plataforma (administradores) -------------------------
-- Um jogo de cada vez: quantos prognósticos e, se já fechado, quantos acertaram.
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

create or replace function public.bi_admin_prognosticos(p_gh text, p_jogo text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); r jogos_real;
begin
  select * into r from jogos_real where jogo = p_jogo;
  return (select coalesce(json_agg(json_build_object('nome', nome, 'golos_b', golos_b, 'golos_r', golos_r, 'comentario', comentario,
      'quando', quando, 'acertou', case when r.jogo is not null then (golos_b = r.golos_b and golos_r = r.golos_r) end)
      order by (r.jogo is not null and golos_b = r.golos_b and golos_r = r.golos_r) desc, quando), '[]'::json)
    from prognosticos where jogo = p_jogo);
end $$;

create or replace function public.bi_admin_jogo_fechar(p_gh text, p_jogo text, p_titulo text, p_gb int, p_gr int, p_onze json) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  if p_gb is null or p_gr is null or p_gb < 0 or p_gr < 0 then raise exception 'Resultado inválido.'; end if;
  insert into jogos_real (jogo, titulo, golos_b, golos_r, onze, por) values (p_jogo, left(coalesce(p_titulo, ''), 120), p_gb, p_gr, coalesce(p_onze::jsonb, '[]'), l)
  on conflict (jogo) do update set golos_b = excluded.golos_b, golos_r = excluded.golos_r, onze = excluded.onze, fechado = now(), por = l;
  insert into atividade (quem, acao, detalhe) values (l, 'Fechou prognósticos', left(coalesce(p_titulo, p_jogo), 200));
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_perguntas(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  perform bi_limpar_participacao();
  return (select coalesce(json_agg(json_build_object('id', id, 'nome', nome, 'texto', texto, 'estado', estado, 'quando', quando)
    order by (estado = 'nova') desc, quando desc), '[]'::json) from perguntas_programa);
end $$;

create or replace function public.bi_admin_pergunta_estado(p_gh text, p_id bigint, p_estado text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  if p_estado = 'apagar' then delete from perguntas_programa where id = p_id;
  elsif p_estado in ('nova', 'escolhida', 'lida') then update perguntas_programa set estado = p_estado where id = p_id;
  else raise exception 'Estado inválido.'; end if;
  return json_build_object('ok', true);
end $$;

-- ------------------------- Permissões -------------------------
revoke execute on function public.bi_prognostico_enviar(text, text, text, text, int, int, text),
  public.bi_prognostico_meu(text, text), public.bi_pergunta_enviar(text, text, text),
  public.bi_admin_participacao(text), public.bi_admin_prognosticos(text, text),
  public.bi_admin_jogo_fechar(text, text, text, int, int, json), public.bi_admin_perguntas(text),
  public.bi_admin_pergunta_estado(text, bigint, text), public.bi_limpar_participacao(), public.bi_sincronizar_jogos() from public, anon, authenticated;
revoke execute on function public.bi_prognostico_enviar(text, text, text, text, int, int, text),
  public.bi_prognostico_meu(text, text), public.bi_pergunta_enviar(text, text, text),
  public.bi_admin_participacao(text), public.bi_admin_prognosticos(text, text),
  public.bi_admin_jogo_fechar(text, text, text, int, int, json), public.bi_admin_perguntas(text),
  public.bi_admin_pergunta_estado(text, bigint, text) from public;
grant execute on function public.bi_prognostico_enviar(text, text, text, text, int, int, text),
  public.bi_prognostico_meu(text, text), public.bi_pergunta_enviar(text, text, text),
  public.bi_admin_participacao(text), public.bi_admin_prognosticos(text, text),
  public.bi_admin_jogo_fechar(text, text, text, int, int, json), public.bi_admin_perguntas(text),
  public.bi_admin_pergunta_estado(text, bigint, text) to anon, authenticated;
