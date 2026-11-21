-- =====================================================================
-- Benfica Independente — sondagens com fotos e quadro tático em direto.
-- Corre depois de supabase-sondagens.sql. Pode correr-se mais de uma vez.
-- =====================================================================

-- ------------------------- Sondagens com fotos -------------------------
-- Uma foto por resposta (até 4 jogadores). Sem fotos = sondagem normal.
-- Com fotos: o resultado fica 1 dia no Início (as outras ficam 2 dias).
alter table public.sondagens add column if not exists fotos jsonb;

create or replace function public.bi_sondagens(p_dispositivo text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'opcoes', s.opcoes, 'fotos', s.fotos,
      'aberta', not s.fechada and (s.fecha is null or s.fecha > now()),
      'fecha', s.fecha,
      'votos', (select coalesce(json_agg(n order by o), '[]'::json) from (
                 select o, (select count(*) from sondagem_votos v where v.sondagem = s.id and v.opcao = o) n
                 from generate_series(0, jsonb_array_length(s.opcoes) - 1) o) x),
      'meu', (select v.opcao from sondagem_votos v where v.sondagem = s.id and v.dispositivo = p_dispositivo)
    ) order by s.criada desc), '[]'::json)
  from sondagens s
  where s.aprovada_por is not null
    and (s.fecha is null or s.fecha > now() - case when s.fotos is null then interval '48 hours' else interval '24 hours' end);
$$;

create or replace function public.bi_sondagens_historico(p_dispositivo text) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'opcoes', s.opcoes, 'fotos', s.fotos, 'aberta', false, 'fecha', s.fecha,
      'votos', (select coalesce(json_agg(n order by o), '[]'::json) from (
                 select o, (select count(*) from sondagem_votos v where v.sondagem = s.id and v.opcao = o) n
                 from generate_series(0, jsonb_array_length(s.opcoes) - 1) o) x),
      'meu', (select v.opcao from sondagem_votos v where v.sondagem = s.id and v.dispositivo = p_dispositivo)
    ) order by s.fecha desc), '[]'::json)
  from sondagens s
  where s.aprovada_por is not null and s.fecha is not null
    and s.fecha <= now() - case when s.fotos is null then interval '48 hours' else interval '24 hours' end;
$$;

create or replace function public.bi_admin_sondagens(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select coalesce(json_agg(json_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'opcoes', s.opcoes, 'fotos', s.fotos, 'fecha', s.fecha, 'criada', s.criada,
      'criada_por', s.criada_por, 'aprovada_por', s.aprovada_por, 'fechada', s.fechada,
      'votos', (select coalesce(json_agg(n order by o), '[]'::json) from (
                 select o, (select count(*) from sondagem_votos v where v.sondagem = s.id and v.opcao = o) n
                 from generate_series(0, jsonb_array_length(s.opcoes) - 1) o) x)
    ) order by s.criada desc), '[]'::json) from sondagens s);
end $$;

create or replace function public.bi_admin_sondagem_fotos_criar(p_gh text, p_pergunta text, p_opcoes json, p_fotos json, p_fecha timestamptz) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); n int := json_array_length(p_opcoes); f text;
begin
  if coalesce(length(trim(p_pergunta)), 0) < 3 or n < 2 or n > 4 then
    raise exception 'A sondagem com fotos precisa de pergunta e de 2 a 4 jogadores.';
  end if;
  if json_array_length(p_fotos) <> n then raise exception 'Falta a foto de algum jogador.'; end if;
  for f in select value from json_array_elements_text(p_fotos) loop
    if f <> '' and f !~ '^https://' then raise exception 'Foto inválida.'; end if;
  end loop;
  if p_fecha is null or p_fecha <= now() then
    raise exception 'Escolhe o dia e a hora em que a sondagem termina (no futuro).';
  end if;
  insert into sondagens (pergunta, opcoes, fotos, fecha, criada_por)
  values (left(trim(p_pergunta), 200), p_opcoes::jsonb, p_fotos::jsonb, p_fecha, l);
  insert into atividade (quem, acao, detalhe) values (l, 'Criou sondagem com fotos', left(p_pergunta, 200));
  return json_build_object('ok', true);
end $$;

-- --------------------------- Quadro tático ---------------------------
-- Um só quadro. O administrador mexe nele na plataforma e a app vê as mudanças em
-- poucos segundos (só quando está "na app"). Não precisa de aprovação: é em direto.
create table if not exists public.quadro (
  id         int primary key default 1 check (id = 1),
  estado     jsonb not null default '{"pontos": [], "linhas": []}'::jsonb,
  visivel    boolean not null default false,
  titulo     text not null default '',
  versao     bigint not null default 0,
  atualizado timestamptz not null default now(),
  por        text not null default ''
);
insert into public.quadro (id) values (1) on conflict (id) do nothing;
alter table public.quadro enable row level security;
revoke all on public.quadro from anon, authenticated;

-- Para a app: se a versão for a mesma que já tem, responde só a versão (poupa dados).
create or replace function public.bi_quadro(p_versao bigint) returns json
language sql security definer set search_path = public as $$
  select case when q.versao = p_versao then json_build_object('versao', q.versao)
         else json_build_object('versao', q.versao, 'visivel', q.visivel, 'titulo', q.titulo,
                                'estado', case when q.visivel then q.estado else '{"pontos": [], "linhas": []}'::jsonb end) end
  from quadro q where q.id = 1;
$$;

create or replace function public.bi_admin_quadro(p_gh text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh);
begin
  return (select json_build_object('versao', versao, 'visivel', visivel, 'titulo', titulo, 'estado', estado,
                                   'atualizado', atualizado, 'por', por) from quadro where id = 1);
end $$;

create or replace function public.bi_admin_quadro_guardar(p_gh text, p_estado json, p_visivel boolean, p_titulo text) returns json
language plpgsql security definer set search_path = public as $$
declare l text := bi_quem(p_gh); antes boolean; v bigint;
begin
  if p_estado is null or length(p_estado::text) > 20000 then raise exception 'Quadro demasiado grande.'; end if;
  if json_array_length(coalesce(p_estado -> 'pontos', '[]'::json)) > 22 then raise exception 'No máximo 22 jogadores.'; end if;
  select visivel into antes from quadro where id = 1;
  update quadro set estado = p_estado::jsonb, visivel = coalesce(p_visivel, false), titulo = left(coalesce(p_titulo, ''), 80),
         versao = versao + 1, atualizado = now(), por = l
   where id = 1 returning versao into v;
  if antes is distinct from coalesce(p_visivel, false) then
    insert into atividade (quem, acao, detalhe)
    values (l, case when p_visivel then 'Pôs o quadro tático na app' else 'Tirou o quadro tático da app' end, left(coalesce(p_titulo, ''), 200));
  end if;
  return json_build_object('ok', true, 'versao', v);
end $$;

revoke execute on function public.bi_admin_sondagem_fotos_criar(text, text, json, json, timestamptz),
  public.bi_quadro(bigint), public.bi_admin_quadro(text), public.bi_admin_quadro_guardar(text, json, boolean, text) from public;
grant execute on function public.bi_admin_sondagem_fotos_criar(text, text, json, json, timestamptz),
  public.bi_quadro(bigint), public.bi_admin_quadro(text), public.bi_admin_quadro_guardar(text, json, boolean, text) to anon, authenticated;
