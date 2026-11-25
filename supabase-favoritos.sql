-- =====================================================================
-- Benfica Independente — Favoritos guardados na conta (seguem a pessoa se mudar de telemóvel).
-- Corre depois de supabase-ranking.sql. Pode correr-se mais de uma vez.
--
-- Guarda só os identificadores dos episódios e artigos que a pessoa marcou como favoritos.
-- Apaga-se com a conta.
-- =====================================================================

create table if not exists public.favoritos_conta (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  episodios  jsonb not null default '[]'::jsonb,
  artigos    jsonb not null default '[]'::jsonb,
  atualizado timestamptz not null default now()
);
alter table public.favoritos_conta enable row level security;
revoke all on public.favoritos_conta from anon, authenticated;

create or replace function public.bi_favoritos_obter() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return json_build_object('episodios', '[]'::json, 'artigos', '[]'::json); end if;
  return coalesce((select json_build_object('episodios', episodios, 'artigos', artigos) from favoritos_conta where user_id = uid),
                  json_build_object('episodios', '[]'::json, 'artigos', '[]'::json));
end $$;

create or replace function public.bi_favoritos_guardar(p_episodios jsonb, p_artigos jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e jsonb := coalesce(p_episodios, '[]'::jsonb); a jsonb := coalesce(p_artigos, '[]'::jsonb);
begin
  if uid is null or not exists (select 1 from perfis where user_id = uid) then raise exception 'Entra na tua conta.'; end if;
  if jsonb_typeof(e) <> 'array' or jsonb_typeof(a) <> 'array' or jsonb_array_length(e) > 2000 or jsonb_array_length(a) > 2000 then raise exception 'Lista inválida.'; end if;
  insert into favoritos_conta (user_id, episodios, artigos, atualizado) values (uid, e, a, now())
  on conflict (user_id) do update set episodios = excluded.episodios, artigos = excluded.artigos, atualizado = now();
  return json_build_object('ok', true);
end $$;

revoke execute on function public.bi_favoritos_obter(), public.bi_favoritos_guardar(jsonb, jsonb) from public;
grant execute on function public.bi_favoritos_obter(), public.bi_favoritos_guardar(jsonb, jsonb) to anon, authenticated;
