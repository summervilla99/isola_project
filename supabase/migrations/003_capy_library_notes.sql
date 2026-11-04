-- Public guestbook for the shared capybara library. No direct table access.
create table if not exists public.capy_library_notes (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 12),
  body text not null check (char_length(body) between 1 and 180),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists capy_library_notes_recent
  on public.capy_library_notes (created_at desc);
create index if not exists capy_library_notes_visitor_recent
  on public.capy_library_notes (visitor_id, created_at desc);

alter table public.capy_library_notes enable row level security;
revoke all on public.capy_library_notes from anon, authenticated;

create or replace function public.capy_library_notes_list()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(n) - 'visitor_id' order by n.created_at desc), '[]'::jsonb)
  from (
    select id, visitor_id, nickname, body, created_at
    from public.capy_library_notes
    where not hidden
    order by created_at desc
    limit 60
  ) n;
$$;

create or replace function public.capy_library_note_post(
  p_visitor_id uuid,
  p_nickname text,
  p_body text
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  clean_name text := btrim(regexp_replace(coalesce(p_nickname, ''), '[[:space:]]+', ' ', 'g'));
  clean_body text := btrim(coalesce(p_body, ''));
  new_id bigint;
begin
  if p_visitor_id is null
     or char_length(clean_name) not between 1 and 12
     or char_length(clean_body) not between 1 and 180 then
    raise exception '이름 또는 노트 길이를 확인해 주세요.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_visitor_id::text, 0));
  if exists (
    select 1 from public.capy_library_notes
    where visitor_id = p_visitor_id and created_at > now() - interval '45 seconds'
  ) or (
    select count(*) from public.capy_library_notes
    where visitor_id = p_visitor_id and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception '노트는 잠시 쉬었다 다시 남겨 주세요.' using errcode = 'P0001';
  end if;

  insert into public.capy_library_notes (visitor_id, nickname, body)
  values (p_visitor_id, clean_name, clean_body)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.capy_library_notes_list(),
  public.capy_library_note_post(uuid, text, text) from public;
grant execute on function public.capy_library_notes_list(),
  public.capy_library_note_post(uuid, text, text) to anon, authenticated;
