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
-- Benfica Independente — assistente de IA (Gemini grátis)
-- Pode correr-se mais do que uma vez.
--
-- Quem fala com o Gemini é a função "bi-assistente" do Supabase (pasta
-- Plataforma/assistente). A chave do Gemini fica nos segredos do Supabase,
-- nunca dentro da app nem da plataforma.
--
-- Estas funções só servem de travão (limites diários para não gastar os
-- pedidos grátis) e para a função ler a conversa de forma segura.
-- =====================================================================

create table if not exists public.ia_uso (
  dia   date not null default current_date,
  quem  text not null,
  n     int  not null default 0,
  primary key (dia, quem)
);
alter table public.ia_uso enable row level security;
revoke all on public.ia_uso from anon, authenticated;

-- Conta um pedido; devolve false se já passou o limite do dia.
create or replace function public.bi_ia_contar(p_quem text, p_limite int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into ia_uso (dia, quem, n) values (current_date, p_quem, 1)
  on conflict (dia, quem) do update set n = ia_uso.n + 1
  returning n into v;
  delete from ia_uso where dia < current_date - 60;
  return v <= p_limite;
end $$;
revoke all on function public.bi_ia_contar(text, int) from public, anon, authenticated;

-- Adepto: confirma a conversa (código secreto), aplica os limites e devolve
-- as últimas mensagens e os gestores, para o assistente responder.
create or replace function public.bi_ia_conversa(p_id uuid, p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from conversas where id = p_id and token = p_token) then raise exception 'conversa não encontrada'; end if;
  -- No máximo 25 respostas da IA por conversa por dia e 1000 no total por dia.
  if not bi_ia_contar('c:' || p_id::text, 25) or not bi_ia_contar('*adeptos', 1000) then
    return json_build_object('limite', true);
  end if;
  return json_build_object(
    'mensagens', (select coalesce(json_agg(json_build_object('autor', autor, 'nome', autor_nome, 'texto', texto) order by id), '[]'::json)
                  from (select * from mensagens where conversa = p_id order by id desc limit 20) m),
    'gestores', (select coalesce(json_agg(json_build_object('nome', nome, 'funcao', funcao) order by ordem, nome), '[]'::json)
                 from gestores where ativo));
end $$;

-- Gestor: confirma no GitHub que é administrador e aplica o limite (150 por dia cada).
create or replace function public.bi_ia_gestor(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  if not bi_ia_contar('g:' || lower(l), 150) or not bi_ia_contar('*gestores', 600) then
    return json_build_object('limite', true);
  end if;
  return json_build_object('login', l);
end $$;

-- Para o painel da plataforma: quantos pedidos se fizeram hoje.
create or replace function public.bi_admin_ia_uso(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return json_build_object(
    'adeptos', coalesce((select n from ia_uso where dia = current_date and quem = '*adeptos'), 0),
    'gestores', coalesce((select n from ia_uso where dia = current_date and quem = '*gestores'), 0));
end $$;
