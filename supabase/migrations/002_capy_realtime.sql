-- A private Realtime channel per island. Membership is checked when joining.
create function private.can_join_capy_topic(topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.active()
    and case
      when topic ~ '^capy-island:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (
        select 1 from public.members
        where user_id = auth.uid()
          and island_id = split_part(topic, ':', 2)::uuid
      )
      else false
    end;
$$;

grant execute on function private.can_join_capy_topic(text) to authenticated;

create policy capy_island_realtime_read on realtime.messages
for select to authenticated
using (
  extension in ('presence', 'broadcast')
  and private.can_join_capy_topic((select realtime.topic()))
);

create policy capy_island_realtime_write on realtime.messages
for insert to authenticated
with check (
  extension in ('presence', 'broadcast')
  and private.can_join_capy_topic((select realtime.topic()))
);
