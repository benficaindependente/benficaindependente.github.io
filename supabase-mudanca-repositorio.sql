-- =====================================================================
-- Benfica Independente — o repositório dos dados passou para a organização "benficaindependente".
-- Cola isto no SQL Editor do Supabase e carrega em Run (só estas duas funções mudam).
-- Depois: cria a chave nova do GitHub (ver o fim deste ficheiro) e guarda-a no Supabase.
-- =====================================================================

create or replace function public.bi_quem(p_gh text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  k text := encode(extensions.digest(coalesce(p_gh, ''), 'sha256'), 'hex');
  l text; r extensions.http_response; a json;
begin
  if em <> '' then
    if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then raise exception 'sem acesso'; end if;
    select nome into l from admins_email where email = em;
    if l is null then raise exception 'sem acesso'; end if;
    return l;
  end if;
  if coalesce(length(p_gh), 0) < 20 then raise exception 'sem acesso'; end if;
  select login into l from sessoes_admin where chave = k and ate > now();
  if l is not null then return l; end if;
  r := extensions.http((
    'GET', 'https://api.github.com/user',
    array[extensions.http_header('Authorization', 'Bearer ' || p_gh), extensions.http_header('User-Agent', 'benfica-independente-plataforma')],
    null, null)::extensions.http_request);
  if r.status <> 200 then raise exception 'sem acesso'; end if;
  l := (r.content::json) ->> 'login';
  r := extensions.http_get('https://raw.githubusercontent.com/benficaindependente/benfica-independente-dados/main/data/admins.json');
  if r.status = 404 then
    a := '{"donos": ["JoaoRebola"], "admins": []}'::json;
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

-- A chave do GitHub tem de ser NOVA, feita na organização (a antiga era do repositório que mudou de dono):
--   github.com -> Settings -> Developer settings -> Fine-grained tokens -> Generate new token
--   Resource owner: benficaindependente | Repository access: benfica-independente-dados (e benfica-independente-gestao, se existir)
--   Permissions: Contents = Read and write, Actions = Read-only.
-- Depois cola-a aqui (substitui a antiga):
--   insert into public.segredos (chave, valor) values ('github', 'COLA_AQUI_A_CHAVE')
--   on conflict (chave) do update set valor = excluded.valor;
