-- =====================================================================
-- Benfica Independente — chat e formulário de contacto (Supabase)
-- Pode correr-se mais do que uma vez (não apaga mensagens).
--
-- Segurança:
--  * As tabelas estão fechadas (RLS ligado e sem regras): ninguém lê nem
--    escreve diretamente com a chave pública.
--  * A app só usa as funções bi_*: cada conversa tem um código secreto
--    (token) que só o telemóvel de quem a abriu conhece.
--  * A plataforma usa as funções bi_admin_*: recebem a chave GitHub do
--    gestor, confirmam no GitHub quem é e se está em data/admins.json.
-- =====================================================================

create extension if not exists http with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gestores (
  login     text primary key,
  nome      text not null,
  funcao    text not null default '',
  email     text not null default '',
  ativo     boolean not null default true,
  ordem     int not null default 0
);

create table if not exists public.conversas (
  id          uuid primary key default gen_random_uuid(),
  token       uuid not null default gen_random_uuid(),
  criado      timestamptz not null default now(),
  atualizado  timestamptz not null default now(),
  tipo        text not null check (tipo in ('chat', 'formulario')),
  nome        text not null default '',
  contacto    text not null default '',
  assunto     text not null default '',
  para        text[] not null default '{}',
  estado      text not null default 'nova' check (estado in ('nova', 'respondida', 'fechada'))
);

create table if not exists public.mensagens (
  id          bigint generated always as identity primary key,
  conversa    uuid not null references public.conversas(id) on delete cascade,
  criado      timestamptz not null default now(),
  autor       text not null check (autor in ('adepto', 'gestor', 'assistente')),
  autor_nome  text not null default '',
  texto       text not null check (length(texto) between 1 and 4000)
);
create index if not exists mensagens_conversa on public.mensagens (conversa, id);

-- Cache de quem já foi confirmado no GitHub (só o resumo da chave, nunca a chave).
create table if not exists public.sessoes_admin (
  chave  text primary key,
  login  text not null,
  ate    timestamptz not null
);

alter table public.gestores      enable row level security;
alter table public.conversas     enable row level security;
alter table public.mensagens     enable row level security;
alter table public.sessoes_admin enable row level security;
revoke all on public.gestores, public.conversas, public.mensagens, public.sessoes_admin from anon, authenticated;

-- ------------------------------------------------------------- app (público)

-- Usado pelo robô uma vez por dia: confirma que o chat está a funcionar.
create or replace function public.bi_ping() returns json
language sql security definer set search_path = public as $$
  select json_build_object('ok', true, 'conversas', (select count(*) from conversas));
$$;

-- Gestores que o adepto pode escolher (sem emails).
create or replace function public.bi_gestores() returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('login', login, 'nome', nome, 'funcao', funcao) order by ordem, nome), '[]'::json)
  from gestores where ativo;
$$;

create or replace function public.bi_abrir(p_tipo text, p_texto text, p_nome text default '', p_contacto text default '',
                                           p_assunto text default '', p_para text[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare c conversas;
begin
  if p_tipo not in ('chat', 'formulario') then raise exception 'tipo inválido'; end if;
  if coalesce(length(trim(p_texto)), 0) = 0 then raise exception 'mensagem vazia'; end if;
  -- Travão contra abusos: no máximo 300 conversas novas por hora no total.
  if (select count(*) from conversas where criado > now() - interval '1 hour') >= 300 then
    raise exception 'demasiadas mensagens, tenta mais tarde';
  end if;
  insert into conversas (tipo, nome, contacto, assunto, para)
  values (p_tipo, left(coalesce(p_nome, ''), 80), left(coalesce(p_contacto, ''), 120), left(coalesce(p_assunto, ''), 80),
          coalesce(p_para[1:10], '{}'))
  returning * into c;
  insert into mensagens (conversa, autor, autor_nome, texto) values (c.id, 'adepto', c.nome, left(trim(p_texto), 4000));
  return json_build_object('id', c.id, 'token', c.token);
end $$;

create or replace function public.bi_enviar(p_id uuid, p_token uuid, p_texto text, p_autor text default 'adepto')
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_autor not in ('adepto', 'assistente') then raise exception 'autor inválido'; end if;
  if not exists (select 1 from conversas where id = p_id and token = p_token) then raise exception 'conversa não encontrada'; end if;
  if coalesce(length(trim(p_texto)), 0) = 0 then raise exception 'mensagem vazia'; end if;
  if (select count(*) from mensagens where conversa = p_id) >= 300 then raise exception 'conversa demasiado longa'; end if;
  insert into mensagens (conversa, autor, texto) values (p_id, p_autor, left(trim(p_texto), 4000));
  update conversas set atualizado = now(), estado = case when p_autor = 'adepto' then 'nova' else estado end where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_para(p_id uuid, p_token uuid, p_para text[])
returns json language plpgsql security definer set search_path = public as $$
begin
  update conversas set para = coalesce(p_para[1:10], '{}'), atualizado = now() where id = p_id and token = p_token;
  if not found then raise exception 'conversa não encontrada'; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_ler(p_id uuid, p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from conversas where id = p_id and token = p_token) then raise exception 'conversa não encontrada'; end if;
  return (select coalesce(json_agg(json_build_object('id', id, 'autor', autor, 'nome', autor_nome, 'texto', texto, 'criado', criado) order by id), '[]'::json)
          from mensagens where conversa = p_id);
end $$;

-- ------------------------------------------------------- plataforma (gestores)

-- Confirma no GitHub quem é o dono da chave e se é administrador da plataforma.
create or replace function public.bi_quem(p_gh text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text := encode(extensions.digest(coalesce(p_gh, ''), 'sha256'), 'hex');
  l text; r extensions.http_response; a json;
begin
  if coalesce(length(p_gh), 0) < 20 then raise exception 'sem acesso'; end if;
  select login into l from sessoes_admin where chave = k and ate > now();
  if l is not null then return l; end if;
  r := extensions.http((
    'GET', 'https://api.github.com/user',
    array[extensions.http_header('Authorization', 'Bearer ' || p_gh), extensions.http_header('User-Agent', 'benfica-independente-plataforma')],
    null, null)::extensions.http_request);
  if r.status <> 200 then raise exception 'sem acesso'; end if;
  l := (r.content::json) ->> 'login';
  r := extensions.http_get('https://raw.githubusercontent.com/JoaoRebola/benfica-independente-dados/main/data/admins.json');
  if r.status = 404 then
    a := '{"donos": ["JoaoRebola"], "admins": []}'::json;  -- ainda sem lista: só o dono do repositório
  elsif r.status <> 200 then
    raise exception 'sem acesso';
  else
    a := r.content::json;
  end if;
  if not exists (
    select 1 from json_array_elements_text(coalesce(a -> 'donos', '[]'::json)) x where lower(x) = lower(l)
    union all
    select 1 from json_array_elements_text(coalesce(a -> 'admins', '[]'::json)) x where lower(x) = lower(l)
  ) then raise exception 'sem acesso'; end if;
  delete from sessoes_admin where ate < now();
  insert into sessoes_admin values (k, l, now() + interval '15 minutes')
  on conflict (chave) do update set login = excluded.login, ate = excluded.ate;
  return l;
end $$;

create or replace function public.bi_admin_conversas(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(x order by x.atualizado desc), '[]'::json) from (
    select c.id, c.tipo, c.nome, c.contacto, c.assunto, c.para, c.estado, c.criado, c.atualizado,
           (select count(*) from mensagens m where m.conversa = c.id) as total,
           (select m.texto from mensagens m where m.conversa = c.id and m.autor = 'adepto' order by m.id desc limit 1) as ultima
    from conversas c order by c.atualizado desc limit 300) x);
end $$;

create or replace function public.bi_admin_mensagens(p_gh text, p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object('id', id, 'autor', autor, 'nome', autor_nome, 'texto', texto, 'criado', criado) order by id), '[]'::json)
          from mensagens where conversa = p_id);
end $$;

create or replace function public.bi_admin_responder(p_gh text, p_id uuid, p_texto text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); n text;
begin
  if coalesce(length(trim(p_texto)), 0) = 0 then raise exception 'mensagem vazia'; end if;
  select nome into n from gestores where login = l;
  insert into mensagens (conversa, autor, autor_nome, texto) values (p_id, 'gestor', coalesce(n, l), left(trim(p_texto), 4000));
  update conversas set estado = 'respondida', atualizado = now() where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_estado(p_gh text, p_id uuid, p_estado text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  update conversas set estado = p_estado where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_apagar(p_gh text, p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  delete from conversas where id = p_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_gestores(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object('login', login, 'nome', nome, 'funcao', funcao, 'email', email, 'ativo', ativo, 'ordem', ordem) order by ordem, nome), '[]'::json) from gestores);
end $$;

create or replace function public.bi_admin_gestor(p_gh text, p_login text, p_nome text, p_funcao text, p_email text, p_ativo boolean, p_ordem int)
returns json language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  if coalesce(trim(p_login), '') = '' or coalesce(trim(p_nome), '') = '' then raise exception 'falta o identificador ou o nome'; end if;
  insert into gestores (login, nome, funcao, email, ativo, ordem)
  values (trim(p_login), trim(p_nome), coalesce(p_funcao, ''), coalesce(p_email, ''), coalesce(p_ativo, true), coalesce(p_ordem, 0))
  on conflict (login) do update set nome = excluded.nome, funcao = excluded.funcao, email = excluded.email, ativo = excluded.ativo, ordem = excluded.ordem;
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_gestor_apagar(p_gh text, p_login text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  delete from gestores where login = p_login;
  return json_build_object('ok', true);
end $$;

-- Só estas funções ficam abertas à chave pública.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.bi_ping(), public.bi_gestores(),
  public.bi_abrir(text, text, text, text, text, text[]), public.bi_enviar(uuid, uuid, text, text),
  public.bi_para(uuid, uuid, text[]), public.bi_ler(uuid, uuid),
  public.bi_admin_conversas(text), public.bi_admin_mensagens(text, uuid), public.bi_admin_responder(text, uuid, text),
  public.bi_admin_estado(text, uuid, text), public.bi_admin_apagar(text, uuid), public.bi_admin_gestores(text),
  public.bi_admin_gestor(text, text, text, text, text, boolean, int), public.bi_admin_gestor_apagar(text, text)
  to anon, authenticated;

-- Gestores iniciais (os mesmos grupos que a app já mostrava). Editáveis na plataforma.
insert into public.gestores (login, nome, funcao, ordem) values
  ('equipa', 'Equipa BI', 'Assuntos gerais', 1),
  ('redacao', 'Redação', 'Artigos e opinião', 2),
  ('videos', 'Vídeos e podcasts', 'Conteúdos e gravações', 3),
  ('publicidade', 'Publicidade', 'Anúncios e patrocínios', 4),
  ('patreon', 'Patreon', 'Apoios e recompensas', 5),
  ('app', 'Aplicação', 'Problemas na app', 6)
on conflict (login) do nothing;
