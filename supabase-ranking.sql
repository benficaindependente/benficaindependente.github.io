-- =====================================================================
-- Benfica Independente — ranking de prognósticos da época (com contas de email).
-- Corre depois de supabase-novidades.sql, supabase-acesso.sql e supabase-mvp.sql. Pode correr-se mais de uma vez.
--
-- O que se guarda (o mínimo): o nome e/ou alcunha de cada adepto e, para cada jogo, só o resultado que previu.
-- O email fica no sistema de contas do Supabase (nunca nestas tabelas). Sem comentários, sem localização, sem mais nada.
-- Regra: 3 pontos por cada resultado exato. A época vai de 1 de julho a 30 de junho.
-- =====================================================================

-- ------------------------------ Tabelas ------------------------------
create table if not exists public.perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome    text not null default '',
  alcunha text not null default '',
  mostrar text not null default 'alcunha' check (mostrar in ('nome', 'alcunha')),
  criado  timestamptz not null default now()
);
create unique index if not exists perfis_alcunha_unica on public.perfis (lower(alcunha)) where alcunha <> '';
-- A pessoa escolhe se a sua participação na app (sondagens, MVP, quiz, acessos) fica associada à conta.
alter table public.perfis add column if not exists participacao boolean not null default true;
-- De onde a pessoa nos vê (opcional, escrito por ela).
alter table public.perfis add column if not exists localidade text not null default '';
alter table public.perfis add column if not exists pais text not null default '';
-- Data de nascimento (opcional): dá a idade para os números e o parabéns no dia de anos.
alter table public.perfis add column if not exists nascimento date;

-- Participações associadas à conta (só contas com participacao = true). Cada sondagem, MVP ou pergunta conta uma vez.
create table if not exists public.participacao_conta (
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo    text not null check (tipo in ('sondagem', 'mvp', 'quiz')),
  ref     text not null,                -- id da sondagem, do jogo ou da pergunta
  certa   boolean,                      -- só no quiz: acertou?
  dia     date not null default (now() at time zone 'Europe/Lisbon')::date,
  quando  timestamptz not null default now(),
  primary key (user_id, tipo, ref)
);
-- Dias em que a pessoa abriu a app e quantas vezes.
create table if not exists public.acessos_conta (
  user_id   uuid not null references auth.users (id) on delete cascade,
  dia       date not null,
  aberturas integer not null default 1,
  primary key (user_id, dia)
);
alter table public.participacao_conta enable row level security;
alter table public.acessos_conta enable row level security;
revoke all on public.participacao_conta, public.acessos_conta from anon, authenticated;

-- Resultado oficial de cada jogo, guardado para sempre (os outros dados desaparecem ao fim de uns dias).
create table if not exists public.ranking_jogos (
  jogo    text primary key,
  titulo  text not null default '',
  data    timestamptz not null default now(),
  golos_b smallint not null,
  golos_r smallint not null
);

-- O prognóstico de cada adepto (conta) para cada jogo: só o resultado.
create table if not exists public.ranking_prognosticos (
  user_id uuid not null references auth.users (id) on delete cascade,
  jogo    text not null,
  titulo  text not null default '',
  golos_b smallint not null,
  golos_r smallint not null,
  quando  timestamptz not null default now(),
  primary key (user_id, jogo)
);

alter table public.perfis enable row level security;                 -- sem políticas: só as funções abaixo lhes mexem
alter table public.ranking_jogos enable row level security;
alter table public.ranking_prognosticos enable row level security;
revoke all on public.perfis, public.ranking_jogos, public.ranking_prognosticos from anon, authenticated;

-- Cada resultado oficial que chega a jogos_real passa também para o histórico permanente.
create or replace function public.bi_jogos_real_para_ranking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into ranking_jogos (jogo, titulo, data, golos_b, golos_r)
  values (new.jogo, left(coalesce(new.titulo, ''), 120), coalesce(new.fechado, now()), new.golos_b, new.golos_r)
  on conflict (jogo) do update set golos_b = excluded.golos_b, golos_r = excluded.golos_r, titulo = excluded.titulo;
  return new;
end $$;
drop trigger if exists jogos_real_ranking on public.jogos_real;
create trigger jogos_real_ranking after insert or update of golos_b, golos_r on public.jogos_real
  for each row execute function public.bi_jogos_real_para_ranking();
-- Os que já lá estão
insert into public.ranking_jogos (jogo, titulo, data, golos_b, golos_r)
  select jogo, left(coalesce(titulo, ''), 120), coalesce(fechado, now()), golos_b, golos_r from public.jogos_real
  on conflict (jogo) do nothing;

-- ------------------------------ Defesa extra no acesso à plataforma ------------------------------
-- Só conta como administrador quem tem o email CONFIRMADO. (Os adeptos também têm conta, mas não estão na lista.)
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
  r := extensions.http_get('https://raw.githubusercontent.com/JoaoRebola/benfica-independente-dados/main/data/admins.json');
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

-- ------------------------------ Prognóstico: também conta para o ranking ------------------------------
create or replace function public.bi_prognostico_enviar(
  p_jogo text, p_titulo text, p_dispositivo text, p_nome text, p_gb int, p_gr int, p_comentario text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
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
  -- Com conta: o resultado fica guardado para o ranking da época (só o resultado, sem comentário).
  if uid is not null and exists (select 1 from perfis where user_id = uid) then
    insert into ranking_prognosticos (user_id, jogo, titulo, golos_b, golos_r)
    values (uid, left(p_jogo, 40), left(coalesce(p_titulo, ''), 120), p_gb, p_gr)
    on conflict (user_id, jogo) do update set golos_b = excluded.golos_b, golos_r = excluded.golos_r, quando = now();
  end if;
  return json_build_object('ok', true);
end $$;

-- ------------------------------ Perfil (nome, alcunha e consentimento) ------------------------------
create or replace function public.bi_perfil_obter() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return (select json_build_object('nome', nome, 'alcunha', alcunha, 'mostrar', mostrar, 'participacao', participacao, 'localidade', localidade, 'pais', pais, 'nascimento', coalesce(to_char(nascimento, 'YYYY-MM-DD'), '')) from perfis where user_id = uid);
end $$;

drop function if exists public.bi_perfil_guardar(text, text, text);
drop function if exists public.bi_perfil_guardar(text, text, text, boolean, text, text);
create or replace function public.bi_perfil_guardar(p_nome text, p_alcunha text, p_mostrar text, p_participacao boolean default true, p_localidade text default '', p_pais text default '', p_nascimento text default '') returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n text := trim(coalesce(p_nome, '')); a text := trim(coalesce(p_alcunha, '')); m text := p_mostrar; part boolean := coalesce(p_participacao, true); loc text := left(trim(coalesce(p_localidade, '')), 60); pa text := left(trim(coalesce(p_pais, '')), 60); nasc date;
begin
  if coalesce(trim(p_nascimento), '') <> '' then
    begin nasc := trim(p_nascimento)::date; exception when others then raise exception 'Data de nascimento inválida.'; end;
    if nasc > current_date - interval '5 years' or nasc < current_date - interval '110 years' then raise exception 'Data de nascimento inválida.'; end if;
  end if;
  if uid is null then raise exception 'Entra na tua conta.'; end if;
  if length(n) = 0 and length(a) = 0 then raise exception 'Escreve o teu nome ou uma alcunha.'; end if;
  if length(n) > 30 or length(a) > 30 then raise exception 'No máximo 30 letras.'; end if;
  if m is null or m not in ('nome', 'alcunha') then m := case when a <> '' then 'alcunha' else 'nome' end; end if;
  if m = 'alcunha' and a = '' then raise exception 'Escolheste mostrar a alcunha, mas ainda não escreveste nenhuma.'; end if;
  if m = 'nome' and n = '' then raise exception 'Escolheste mostrar o nome, mas ainda não o escreveste.'; end if;
  if a <> '' and exists (select 1 from perfis where lower(alcunha) = lower(a) and user_id <> uid) then raise exception 'Essa alcunha já está a ser usada. Escolhe outra.'; end if;
  insert into perfis (user_id, nome, alcunha, mostrar, participacao, localidade, pais, nascimento) values (uid, n, a, m, part, loc, pa, nasc)
  on conflict (user_id) do update set nome = excluded.nome, alcunha = excluded.alcunha, mostrar = excluded.mostrar, participacao = excluded.participacao,
    localidade = excluded.localidade, pais = excluded.pais, nascimento = excluded.nascimento;
  -- Quem desliga a associação da participação fica sem esse histórico (os prognósticos do ranking mantêm-se).
  if not part then
    delete from participacao_conta where user_id = uid;
    delete from acessos_conta where user_id = uid;
  end if;
  return json_build_object('ok', true);
end $$;

-- ------------------------------ Participação associada à conta ------------------------------
-- A app avisa quando a pessoa (com conta e com a opção ligada) vota numa sondagem, no MVP ou responde ao quiz.
create or replace function public.bi_part_registar(p_tipo text, p_ref text, p_certa boolean default null) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_tipo not in ('sondagem', 'mvp', 'quiz') or coalesce(length(p_ref), 0) not between 1 and 40 then return json_build_object('ok', false); end if;
  if not exists (select 1 from perfis where user_id = uid and participacao) then return json_build_object('ok', false); end if;
  insert into participacao_conta (user_id, tipo, ref, certa) values (uid, p_tipo, p_ref, case when p_tipo = 'quiz' then p_certa end)
  on conflict (user_id, tipo, ref) do nothing;
  return json_build_object('ok', true);
end $$;

-- A app avisa quando a abre (no máximo uma vez de 30 em 30 minutos).
create or replace function public.bi_acesso_registar() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); hoje date := (now() at time zone 'Europe/Lisbon')::date;
begin
  if uid is null or not exists (select 1 from perfis where user_id = uid and participacao) then return json_build_object('ok', false); end if;
  insert into acessos_conta (user_id, dia, aberturas) values (uid, hoje, 1)
  on conflict (user_id, dia) do update set aberturas = acessos_conta.aberturas + 1;
  return json_build_object('ok', true);
end $$;

-- ------------------------------ Ranking ------------------------------
create or replace function public.bi_epoca_inicio() returns timestamptz
language sql stable as $$
  select make_timestamptz(
    case when extract(month from now() at time zone 'Europe/Lisbon') >= 7 then extract(year from now() at time zone 'Europe/Lisbon')::int
         else extract(year from now() at time zone 'Europe/Lisbon')::int - 1 end, 7, 1, 0, 0, 0, 'Europe/Lisbon');
$$;

-- Classificação da época (público) + a minha posição e o meu histórico (se tiver sessão iniciada).
-- Quem tem conta vê só os 10 primeiros e o seu próprio lugar (nunca mais do que isso).
create or replace function public.bi_ranking(p_limite int default 10) returns json
language plpgsql security definer set search_path = public as $$
declare ini timestamptz := bi_epoca_inicio(); uid uuid := auth.uid();
begin
  return (
    with pt as (
      select rp.user_id, count(*) jogos, count(*) filter (where rj.golos_b = rp.golos_b and rj.golos_r = rp.golos_r) acertos
      from ranking_prognosticos rp join ranking_jogos rj on rj.jogo = rp.jogo
      where rj.data >= ini group by rp.user_id
    ), cl as (
      select pt.user_id, pt.jogos, pt.acertos, pt.acertos * 3 pontos, rank() over (order by pt.acertos desc, pt.jogos asc) pos from pt
    ), nomes as (
      select cl.*, coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome
      from cl join perfis pf on pf.user_id = cl.user_id
    )
    select json_build_object(
      'epoca', extract(year from ini)::int,
      'participantes', (select count(*) from nomes),
      'lista', coalesce((select json_agg(json_build_object('pos', pos, 'nome', nome, 'pontos', pontos, 'acertos', acertos, 'jogos', jogos, 'eu', coalesce(user_id = uid, false)) order by pos, nome)
                         from (select * from nomes order by pos, nome limit greatest(1, least(coalesce(p_limite, 10), 10))) t), '[]'::json),
      'meu', (select json_build_object('pos', pos, 'nome', nome, 'pontos', pontos, 'acertos', acertos, 'jogos', jogos) from nomes where user_id = uid),
      'historico', case when uid is null then '[]'::json else coalesce((
        select json_agg(json_build_object('titulo', rp.titulo, 'prog_b', rp.golos_b, 'prog_r', rp.golos_r, 'real_b', rj.golos_b, 'real_r', rj.golos_r,
          'pontos', case when rj.jogo is null then null when rj.golos_b = rp.golos_b and rj.golos_r = rp.golos_r then 3 else 0 end) order by coalesce(rj.data, rp.quando) desc)
        from ranking_prognosticos rp left join ranking_jogos rj on rj.jogo = rp.jogo
        where rp.user_id = uid and coalesce(rj.data, rp.quando) >= ini), '[]'::json) end
    )
  );
end $$;

-- Apagar a conta e tudo o que lhe diz respeito (a pessoa pode fazê-lo quando quiser).
create or replace function public.bi_conta_apagar() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Entra na tua conta.'; end if;
  delete from auth.users where id = uid;     -- apaga também o perfil e os prognósticos (em cascata)
  return json_build_object('ok', true);
end $$;

-- ------------------------------ Para a plataforma ------------------------------
create or replace function public.bi_admin_ranking(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); ini timestamptz := bi_epoca_inicio();
begin
  return json_build_object(
    'epoca', extract(year from ini)::int,
    'jogos', coalesce((select json_agg(json_build_object('jogo', jogo, 'titulo', titulo, 'golos_b', golos_b, 'golos_r', golos_r, 'data', data,
        'prognosticos', (select count(*) from ranking_prognosticos rp where rp.jogo = rj.jogo),
        'acertos', (select count(*) from ranking_prognosticos rp where rp.jogo = rj.jogo and rp.golos_b = rj.golos_b and rp.golos_r = rj.golos_r)) order by data desc)
      from (select * from ranking_jogos where data >= ini order by data desc limit 40) rj), '[]'::json),
    'lista', coalesce((
      select json_agg(x order by x.acertos desc, x.jogos asc, x.nome) from (
        select pf.user_id, pf.nome as nome_real, pf.alcunha, pf.mostrar,
          coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome,
          count(rp.jogo) filter (where rj.jogo is not null) jogos,
          count(*) filter (where rj.golos_b = rp.golos_b and rj.golos_r = rp.golos_r) acertos,
          count(*) filter (where rj.golos_b = rp.golos_b and rj.golos_r = rp.golos_r) * 3 pontos,
          pf.criado
        from perfis pf left join ranking_prognosticos rp on rp.user_id = pf.user_id
          left join ranking_jogos rj on rj.jogo = rp.jogo and rj.data >= ini
        group by pf.user_id, pf.nome, pf.alcunha, pf.mostrar, pf.criado) x), '[]'::json));
end $$;

create or replace function public.bi_admin_ranking_remover(p_gh text, p_user uuid) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); n text;
begin
  select coalesce(nullif(alcunha, ''), nome) into n from perfis where user_id = p_user;
  delete from ranking_prognosticos where user_id = p_user;
  delete from perfis where user_id = p_user;
  insert into atividade (quem, acao, detalhe) values (l, 'Tirou um participante do ranking', left(coalesce(n, ''), 80));
  return json_build_object('ok', true);
end $$;

create or replace function public.bi_admin_participacao_conta(p_gh text, p_periodo text default 'epoca') returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); ini timestamptz := bi_epoca_inicio(); de timestamptz;
begin
  de := case p_periodo when '7d' then now() - interval '7 days' when '30d' then now() - interval '30 days' when 'tudo' then '2000-01-01'::timestamptz else ini end;
  return json_build_object(
    'periodo', coalesce(p_periodo, 'epoca'), 'desde', de,
    'lista', coalesce((select json_agg(x order by x.participacoes desc, x.dias_ativos desc, x.nome) from (
      select pf.user_id, pf.nome as nome_real, pf.alcunha, pf.participacao as associada, pf.localidade, pf.pais, pf.nascimento,
        case when pf.nascimento is null then null else extract(year from age(pf.nascimento))::int end idade,
        coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome,
        (select count(*) from participacao_conta c where c.user_id = pf.user_id and c.tipo = 'sondagem' and c.quando >= de) sondagens,
        (select count(*) from participacao_conta c where c.user_id = pf.user_id and c.tipo = 'mvp' and c.quando >= de) mvp,
        (select count(*) from participacao_conta c where c.user_id = pf.user_id and c.tipo = 'quiz' and c.quando >= de) quiz_respostas,
        (select count(*) from participacao_conta c where c.user_id = pf.user_id and c.tipo = 'quiz' and c.certa and c.quando >= de) quiz_certas,
        (select count(*) from ranking_prognosticos r where r.user_id = pf.user_id and r.quando >= de) prognosticos,
        (select count(*) from ranking_prognosticos r join ranking_jogos j on j.jogo = r.jogo
          where r.user_id = pf.user_id and j.data >= de and j.golos_b = r.golos_b and j.golos_r = r.golos_r) acertos_prog,
        (select count(*) from idas_estadio i where i.user_id = pf.user_id and i.categoria = 'principal' and i.data >= (de at time zone 'Europe/Lisbon')::date) idas_principal,
        (select count(*) from idas_estadio i where i.user_id = pf.user_id and i.categoria = 'jovens_feminino' and i.data >= (de at time zone 'Europe/Lisbon')::date) idas_jovens,
        (select count(*) from idas_estadio i where i.user_id = pf.user_id and i.categoria = 'modalidades' and i.data >= (de at time zone 'Europe/Lisbon')::date) idas_modalidades,
        (select count(*) from acessos_conta a where a.user_id = pf.user_id and a.dia >= (de at time zone 'Europe/Lisbon')::date) dias_ativos,
        coalesce((select sum(a.aberturas) from acessos_conta a where a.user_id = pf.user_id and a.dia >= (de at time zone 'Europe/Lisbon')::date), 0) aberturas,
        (select max(a.dia) from acessos_conta a where a.user_id = pf.user_id) ultimo_acesso,
        (select count(*) from participacao_conta c where c.user_id = pf.user_id and c.quando >= de)
          + (select count(*) from ranking_prognosticos r where r.user_id = pf.user_id and r.quando >= de) participacoes,
        pf.criado
      from perfis pf) x), '[]'::json));
end $$;

-- Idades: quantas contas por faixa etária e como participam; aniversários dos próximos 30 dias.
create or replace function public.bi_admin_idades(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); hoje date := (now() at time zone 'Europe/Lisbon')::date; ini timestamptz := bi_epoca_inicio();
begin
  return (
    with c as (
      select pf.user_id, pf.nascimento, extract(year from age(hoje, pf.nascimento))::int idade,
        coalesce(nullif(case pf.mostrar when 'nome' then pf.nome else pf.alcunha end, ''), nullif(pf.nome, ''), nullif(pf.alcunha, ''), 'Adepto') nome,
        (select count(*) from participacao_conta x where x.user_id = pf.user_id and x.quando >= ini) part,
        (select count(*) from ranking_prognosticos r join ranking_jogos j on j.jogo = r.jogo where r.user_id = pf.user_id and j.data >= ini) jogos,
        (select count(*) from ranking_prognosticos r join ranking_jogos j on j.jogo = r.jogo where r.user_id = pf.user_id and j.data >= ini and j.golos_b = r.golos_b and j.golos_r = r.golos_r) acertos,
        (select count(*) from participacao_conta x where x.user_id = pf.user_id and x.tipo = 'quiz' and x.quando >= ini) quiz,
        (select count(*) from participacao_conta x where x.user_id = pf.user_id and x.tipo = 'quiz' and x.certa and x.quando >= ini) quiz_certas,
        (select count(*) from acessos_conta a where a.user_id = pf.user_id and a.dia >= (ini at time zone 'Europe/Lisbon')::date) dias
      from perfis pf where pf.nascimento is not null
    ), f as (
      select case when idade < 18 then '1|Menos de 18' when idade < 25 then '2|18 a 24' when idade < 35 then '3|25 a 34' when idade < 45 then '4|35 a 44'
                  when idade < 55 then '5|45 a 54' when idade < 65 then '6|55 a 64' else '7|65 ou mais' end faixa, c.* from c
    ), prox as (
      select nome, idade, nascimento,
        case when (nascimento + make_interval(years => idade))::date < hoje then (nascimento + make_interval(years => idade + 1))::date
             else (nascimento + make_interval(years => idade))::date end dia
      from c
    )
    select json_build_object(
      'com_data', (select count(*) from c), 'sem_data', (select count(*) from perfis where nascimento is null),
      'idade_media', (select round(avg(idade)::numeric, 1) from c), 'mais_novo', (select min(idade) from c), 'mais_velho', (select max(idade) from c),
      'faixas', coalesce((select json_agg(json_build_object('faixa', split_part(faixa, '|', 2), 'contas', n, 'participacoes', part, 'jogos', jogos, 'acertos', acertos,
            'quiz', quiz, 'quiz_certas', quiz_certas, 'dias_ativos', dias) order by faixa)
          from (select faixa, count(*) n, sum(part) part, sum(jogos) jogos, sum(acertos) acertos, sum(quiz) quiz, sum(quiz_certas) quiz_certas, sum(dias) dias from f group by faixa) g), '[]'::json),
      'aniversarios', coalesce((select json_agg(json_build_object('nome', nome, 'dia', dia, 'idade', extract(year from dia)::int - extract(year from nascimento)::int, 'dias_ate', dia - hoje) order by dia, nome)
          from prox where dia - hoje <= 30), '[]'::json)
    )
  );
end $$;

-- ------------------------------ Permissões ------------------------------
revoke execute on function public.bi_perfil_obter(), public.bi_perfil_guardar(text, text, text, boolean, text, text, text), public.bi_ranking(int), public.bi_conta_apagar(),
  public.bi_part_registar(text, text, boolean), public.bi_acesso_registar(), public.bi_admin_participacao_conta(text, text), public.bi_admin_idades(text),
  public.bi_admin_ranking(text), public.bi_admin_ranking_remover(text, uuid), public.bi_prognostico_enviar(text, text, text, text, int, int, text),
  public.bi_epoca_inicio(), public.bi_jogos_real_para_ranking() from public;
grant execute on function public.bi_perfil_obter(), public.bi_perfil_guardar(text, text, text, boolean, text, text, text), public.bi_ranking(int), public.bi_conta_apagar(),
  public.bi_part_registar(text, text, boolean), public.bi_acesso_registar(), public.bi_admin_participacao_conta(text, text), public.bi_admin_idades(text),
  public.bi_admin_ranking(text), public.bi_admin_ranking_remover(text, uuid), public.bi_prognostico_enviar(text, text, text, text, int, int, text)
  to anon, authenticated;
