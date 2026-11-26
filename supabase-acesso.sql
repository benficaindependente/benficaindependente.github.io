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
-- Benfica Independente — entrada na plataforma com EMAIL e palavra-passe (sem GitHub).
-- Corre depois de supabase-novidades.sql. Pode correr-se mais de uma vez.
--
-- Como funciona:
--  • O dono acrescenta o email de cada administrador (na plataforma, em "Administradores").
--  • Na primeira vez, a pessoa carrega em "Primeiro acesso", escreve o email e escolhe a palavra-passe;
--    o Supabase envia um email para confirmar que o email é mesmo dela.
--  • Se se esquecer: "Esqueci-me da palavra-passe" envia um email para escolher outra.
--  • As gravações no GitHub (notícias, destaques, etc.) passam por aqui: a chave do GitHub fica guardada
--    no Supabase (tabela "segredos"), nunca no telemóvel nem no computador de cada administrador.
-- =====================================================================

-- ------------------------- Administradores por email -------------------------
create table if not exists public.admins_email (
  email text primary key,
  nome text not null,
  dono boolean not null default false,
  criado timestamptz not null default now(),
  convidado_por text
);
alter table public.admins_email enable row level security;   -- sem políticas: só as funções abaixo lhe mexem

-- Chave do GitHub (só para gravar nos repositórios do BI). É o dono quem a coloca, uma vez (ver o fim).
create table if not exists public.segredos (chave text primary key, valor text not null);
alter table public.segredos enable row level security;

-- ------------------------- Quem é? (agora também por email) -------------------------
-- bi_quem (quem é administrador) saiu deste ficheiro para não repor uma versão antiga:
-- está em supabase-correcoes-2026-11-26.sql.

-- Quem sou eu (nome, email e se sou dono).
create or replace function public.bi_admin_eu(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); em text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  return (select json_build_object('nome', nome, 'email', email, 'dono', dono) from admins_email where email = em);
end $$;

-- Antes de criar a palavra-passe: este email foi convidado? (só diz sim ou não)
create or replace function public.bi_convite_existe(p_email text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from admins_email where email = lower(trim(p_email)));
$$;

create or replace function public.bi_admin_email_lista(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object('email', email, 'nome', nome, 'dono', dono, 'criado', criado) order by dono desc, nome), '[]'::json) from admins_email);
end $$;

create or replace function public.bi_admin_email_adicionar(p_gh text, p_email text, p_nome text, p_dono boolean) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); em text := lower(trim(p_email));
begin
  if not exists (select 1 from admins_email where nome = l and dono) then raise exception 'Só um dono pode mudar esta lista.'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email inválido.'; end if;
  if coalesce(length(trim(p_nome)), 0) < 2 then raise exception 'Escreve o nome da pessoa.'; end if;
  if exists (select 1 from admins_email where nome = trim(p_nome) and email <> em) then raise exception 'Já existe alguém com esse nome.'; end if;
  insert into admins_email (email, nome, dono, convidado_por) values (em, left(trim(p_nome), 40), coalesce(p_dono, false), l)
  on conflict (email) do update set nome = excluded.nome, dono = excluded.dono;
  insert into atividade (quem, acao, detalhe) values (l, 'Acrescentou administrador', left(trim(p_nome), 80));
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_email_remover(p_gh text, p_email text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); em text := lower(trim(p_email)); n text;
begin
  if not exists (select 1 from admins_email where nome = l and dono) then raise exception 'Só um dono pode mudar esta lista.'; end if;
  select nome into n from admins_email where email = em;
  if n = l then raise exception 'Não te podes remover a ti próprio.'; end if;
  delete from admins_email where email = em;
  insert into atividade (quem, acao, detalhe) values (l, 'Removeu administrador', left(coalesce(n, em), 80));
  return json_build_object('ok', true);
end $$;

-- ------------------------- Gravar no GitHub em nome dos administradores -------------------------
-- A plataforma já não precisa da chave de cada pessoa: pede aqui, e o Supabase grava com a chave guardada.
-- Só deixa mexer nos dois repositórios do BI, só para ler (GET) e gravar (PUT).
create or replace function public.bi_gh(p_gh text, p_metodo text, p_caminho text, p_corpo text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare l text := bi_quem(p_gh); tok text; r extensions.http_response; m text := upper(coalesce(p_metodo, 'GET'));
begin
  if m not in ('GET', 'PUT') then raise exception 'Pedido não permitido.'; end if;
  if p_caminho !~ '^repos/(benficaindependente|JoaoRebola)/(benfica-independente-dados|benfica-independente-gestao)(/|\?|$)' or p_caminho like '%..%' then
    raise exception 'Pedido não permitido.';
  end if;
  select valor into tok from segredos where chave = 'github';
  if tok is null then raise exception 'Falta guardar a chave do GitHub no Supabase (ver o fim de supabase-acesso.sql).'; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  r := extensions.http((
    m, 'https://api.github.com/' || p_caminho,
    array[extensions.http_header('Authorization', 'Bearer ' || tok),
          extensions.http_header('Accept', 'application/vnd.github+json'),
          extensions.http_header('X-GitHub-Api-Version', '2022-11-28'),
          extensions.http_header('User-Agent', 'benfica-independente-plataforma')],
    case when m = 'PUT' then 'application/json' end, case when m = 'PUT' then p_corpo end)::extensions.http_request);
  return json_build_object('status', r.status, 'corpo', r.content);
end $$;

-- ------------------------- Permissões -------------------------
revoke execute on function public.bi_admin_eu(text), public.bi_convite_existe(text),
  public.bi_admin_email_lista(text), public.bi_admin_email_adicionar(text, text, text, boolean),
  public.bi_admin_email_remover(text, text), public.bi_gh(text, text, text, text) from public;
grant execute on function public.bi_admin_eu(text), public.bi_convite_existe(text),
  public.bi_admin_email_lista(text), public.bi_admin_email_adicionar(text, text, text, boolean),
  public.bi_admin_email_remover(text, text), public.bi_gh(text, text, text, text) to anon, authenticated;

-- =====================================================================
-- DEPOIS DE CORRER ISTO (uma vez, feito pelo dono):
-- 1) O primeiro dono (troca pelo teu email e nome):
--      insert into public.admins_email (email, nome, dono) values ('o-teu-email@exemplo.com', 'O Teu Nome', true)
--      on conflict (email) do nothing;
-- 2) A chave do GitHub (cria em github.com → Settings → Developer settings → Fine-grained tokens, só para
--    os repositórios benfica-independente-dados e benfica-independente-gestao, com Contents: Read and write
--    e Actions: Read-only). Cola-a tu mesmo aqui; ninguém mais a vê:
--      insert into public.segredos (chave, valor) values ('github', 'COLA_AQUI_A_CHAVE')
--      on conflict (chave) do update set valor = excluded.valor;
-- =====================================================================
