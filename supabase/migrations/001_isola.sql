-- ISOLA: invitation-only asynchronous islands. All mutations go through authenticated RPCs.
create schema if not exists private;
revoke all on schema private from public;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, name text not null default '새로운 이웃' check(char_length(name) between 1 and 20), bio text not null default '' check(char_length(bio)<=160), identity text not null default '' check(char_length(identity)<=60), avatar jsonb not null default '{"skin":"#efc3a4","hair":"#514139","shirt":"#819e87","style":"bob","body":"round"}');
create table public.islands(id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 1 and 30),owner uuid not null references public.profiles(id));
create table public.members(user_id uuid primary key references public.profiles(id) on delete cascade,island_id uuid not null references public.islands(id) on delete cascade,plot integer not null check(plot between 0 and 7),unique(island_id,plot));
create table public.spaces(id uuid primary key default gen_random_uuid(),owner uuid not null references public.members(user_id) on delete cascade,kind text not null check(kind in ('garden','interior')),visibility text not null default 'private' check(visibility in ('private','island')),draft jsonb not null default '[]',published jsonb not null default '[]',revision integer not null default 0,published_revision integer not null default 0,unique(owner,kind));
create table public.items(id uuid primary key default gen_random_uuid(),owner uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in ('book','film','quote','whisky')),title text not null check(char_length(title) between 1 and 120),creator text not null default '' check(char_length(creator)<=160),note text not null default '' check(char_length(note)<=2000),tags jsonb not null default '[]' check(jsonb_typeof(tags)='array' and jsonb_array_length(tags)<=5),visibility text not null default 'private' check(visibility in ('private','island')),revision integer not null default 0,created timestamptz not null default now());
create table public.comments(id uuid primary key default gen_random_uuid(),author uuid not null references public.profiles(id) on delete cascade,space_id uuid references public.spaces(id) on delete cascade,item_id uuid references public.items(id) on delete cascade,body text not null check(char_length(body) between 1 and 500),hidden boolean not null default false,created timestamptz not null default now(),check(num_nonnulls(space_id,item_id)=1));
create table public.notifications(id uuid primary key default gen_random_uuid(),recipient uuid not null references public.profiles(id) on delete cascade,actor uuid not null references public.profiles(id) on delete cascade,comment_id uuid not null references public.comments(id) on delete cascade,read boolean not null default false,created timestamptz not null default now());
create table public.blocks(blocker uuid not null references public.profiles(id) on delete cascade,blocked uuid not null references public.profiles(id) on delete cascade,primary key(blocker,blocked),check(blocker<>blocked));
create table public.invites(id uuid primary key default gen_random_uuid(),island_id uuid not null references public.islands(id) on delete cascade,token_hash text unique not null,expires timestamptz not null default now()+interval '7 days',max_uses integer not null check(max_uses between 1 and 7),uses integer not null default 0,revoked boolean not null default false);
create table public.reports(id uuid primary key default gen_random_uuid(),reporter uuid not null references public.profiles(id) on delete cascade,target uuid not null,reason text not null check(char_length(reason) between 1 and 1000),created timestamptz not null default now());
create table public.deletion_requests(user_id uuid primary key references public.profiles(id) on delete cascade,created timestamptz not null default now());
create table private.rate_events(user_id uuid not null,action text not null,created timestamptz not null default now());
alter table private.rate_events enable row level security;
create index on public.members(island_id);
create index on public.items(owner,created desc,id);
create index on public.comments(item_id,created);
create index on public.comments(space_id,created);
create index on public.notifications(recipient,created desc);
create index on private.rate_events(user_id,action,created);

create function private.active() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and not exists(select 1 from public.deletion_requests where user_id=auth.uid())$$;
create function private.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.blocks where (blocker=a and blocked=b) or (blocker=b and blocked=a))$$;
create function private.peer(other uuid) returns boolean language sql stable security definer set search_path='' as $$select private.active() and (other=auth.uid() or (not private.blocked(auth.uid(),other) and exists(select 1 from public.members a join public.members b on a.island_id=b.island_id where a.user_id=auth.uid() and b.user_id=other)))$$;
create function private.can_item(target uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.items i where i.id=target and private.peer(i.owner) and (i.owner=auth.uid() or i.visibility='island'))$$;
create function private.can_space(target uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.spaces s where s.id=target and private.peer(s.owner) and (s.owner=auth.uid() or s.visibility='island'))$$;
create function private.can_comment(target uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.comments c where c.id=target and not c.hidden and private.peer(c.author) and (private.can_item(c.item_id) or private.can_space(c.space_id)))$$;
create function private.rate_limit(label text,maximum integer) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||label,0));
 delete from private.rate_events where created<now()-interval '1 day';
 if (select count(*) from private.rate_events where user_id=auth.uid() and action=label and created>now()-interval '1 minute')>=maximum then raise exception '잠시 쉬었다 다시 시도해 주세요.' using errcode='P0001';end if;
 insert into private.rate_events(user_id,action) values(auth.uid(),label);
end$$;

-- Even direct REST table reads are constrained. Layout drafts are never directly selectable.
alter table public.profiles enable row level security;
alter table public.islands enable row level security;
alter table public.members enable row level security;
alter table public.spaces enable row level security;
alter table public.items enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.blocks enable row level security;
alter table public.invites enable row level security;
alter table public.reports enable row level security;
alter table public.deletion_requests enable row level security;
create policy profile_read on public.profiles for select to authenticated using(private.peer(id));
create policy island_read on public.islands for select to authenticated using(private.active() and exists(select 1 from public.members where user_id=auth.uid() and island_id=islands.id));
create policy membership_read on public.members for select to authenticated using(private.peer(user_id));
create policy own_space_read on public.spaces for select to authenticated using(owner=auth.uid() and private.active());
create policy item_read on public.items for select to authenticated using(private.can_item(id));
create policy comment_read on public.comments for select to authenticated using(private.can_comment(id));
create policy notification_read on public.notifications for select to authenticated using(recipient=auth.uid() and private.can_comment(comment_id));
create policy blocks_read on public.blocks for select to authenticated using(blocker=auth.uid() and private.active());
create policy report_read on public.reports for select to authenticated using(reporter=auth.uid() and private.active());
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.islands,public.members,public.spaces,public.items,public.comments,public.notifications,public.blocks,public.reports to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.active(),private.peer(uuid),private.can_item(uuid),private.can_space(uuid),private.can_comment(uuid) to authenticated;

create function private.validate_layout(layout jsonb,size integer,who uuid,publishing boolean) returns void language plpgsql security definer set search_path='' as $$
declare p jsonb; w integer;h integer;x integer;z integer;r integer;xx integer;zz integer;occupied text[]='{}';seen text[]='{}';queue text[];cell text;parts text[];neighbor text;px integer;pz integer;ids text[]='{}';begin
 if jsonb_typeof(layout)<>'array' or jsonb_array_length(layout)>60 then raise exception '소품은 최대 60개까지 놓을 수 있어요.';end if;
 for p in select * from jsonb_array_elements(layout) loop
 if not(p ? 'id' and p ? 'asset' and p ? 'x' and p ? 'z' and p ? 'rotation') or p->>'asset' not in ('chair','table','shelf','plant','lamp','rug','flowers','display') then raise exception '유효하지 않은 소품이에요.';end if;
 if p->>'id'=any(ids) then raise exception '중복 소품 ID예요.';end if;ids=array_append(ids,p->>'id');
 if (p->>'x')!~'^\d+$' or (p->>'z')!~'^\d+$' or (p->>'rotation')!~'^[0-3]$' then raise exception '유효하지 않은 좌표예요.';end if;
 x=(p->>'x')::integer;z=(p->>'z')::integer;r=(p->>'rotation')::integer;
 w=case when p->>'asset' in ('table','rug','shelf') then 2 else 1 end;h=case when p->>'asset' in ('table','rug') then 2 else 1 end;
 if r%2=1 then xx=w;w=h;h=xx;end if;
 for xx in x..x+w-1 loop for zz in z..z+h-1 loop
 if xx<0 or zz<0 or xx>=size or zz>=size then raise exception '공간 밖에 놓을 수 없어요.';end if;
 if xx between size/2-1 and size/2 and zz>=size-2 then raise exception '출입구는 비워 주세요.';end if;
 cell=xx||','||zz;if cell=any(occupied) then raise exception '다른 소품과 겹쳐요.';end if;occupied=array_append(occupied,cell);
 end loop;end loop;
 if p ? 'itemId' and p->>'itemId' is not null then
 if p->>'asset'<>'display' or not exists(select 1 from public.items where id=(p->>'itemId')::uuid and owner=who and (not publishing or visibility='island')) then raise exception '공개한 내 기록만 전시할 수 있어요.';end if;end if;
 end loop;
 queue=array[(size/2)||','||(size-1)];
 while coalesce(array_length(queue,1),0)>0 loop
 cell=queue[1];queue=queue[2:];if cell=any(seen) or cell=any(occupied) then continue;end if;
 seen=array_append(seen,cell);parts=string_to_array(cell,',');px=parts[1]::integer;pz=parts[2]::integer;
 foreach neighbor in array array[(px+1)||','||pz,(px-1)||','||pz,px||','||(pz+1),px||','||(pz-1)] loop
 parts=string_to_array(neighbor,',');if parts[1]::integer>=0 and parts[1]::integer<size and parts[2]::integer>=0 and parts[2]::integer<size and not neighbor=any(seen) and not neighbor=any(occupied) then queue=array_append(queue,neighbor);end if;
 end loop;
 end loop;
 if coalesce(array_length(seen,1),0)<>size*size-coalesce(array_length(occupied,1),0) then raise exception '막힌 공간이 생겨요. 통로를 열어 주세요.';end if;
end$$;

create function public.isola_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid=auth.uid();isl uuid;result jsonb;begin
 if not private.active() then raise exception '로그인이 필요하거나 계정이 비활성 상태예요.' using errcode='42501';end if;
 insert into public.profiles(id) values(me) on conflict do nothing;
 select island_id into isl from public.members where user_id=me;
 select jsonb_build_object('version',1,'me',me,'island',(select jsonb_build_object('id',id,'name',name,'owner',owner) from public.islands where id=isl),
 'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'bio',bio,'identity',identity,'avatar',avatar)) from public.profiles where private.peer(id)),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('user',user_id,'plot',plot) order by plot) from public.members where island_id=isl),'[]'::jsonb),
 'spaces',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'owner',s.owner,'kind',s.kind,'visibility',s.visibility,'draft',case when s.owner=me then s.draft else '[]'::jsonb end,'published',coalesce((select jsonb_agg(p) from jsonb_array_elements(s.published) p where not(p ? 'itemId') or p->>'itemId' is null or private.can_item((p->>'itemId')::uuid)),'[]'::jsonb),'revision',case when s.owner=me then s.revision else 0 end,'publishedRevision',s.published_revision)) from public.spaces s where private.can_space(s.id)),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'owner',i.owner,'kind',i.kind,'title',i.title,'creator',i.creator,'note',i.note,'tags',i.tags,'visibility',i.visibility,'revision',i.revision,'created',i.created) order by i.created desc) from public.items i where private.can_item(i.id)),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'author',c.author,'target',coalesce(c.item_id,c.space_id),'body',c.body,'created',c.created) order by c.created) from public.comments c where private.can_comment(c.id)),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'recipient',n.recipient,'actor',n.actor,'target',coalesce(c.item_id,c.space_id),'read',n.read,'created',n.created) order by n.created desc) from public.notifications n join public.comments c on c.id=n.comment_id where n.recipient=me and private.can_comment(c.id)),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(case when blocker=me then blocked else blocker end) from public.blocks where blocker=me or blocked=me),'[]'::jsonb)) into result;
 return result;
end$$;

create function public.isola_invite() returns text language plpgsql security definer set search_path='' as $$
declare me uuid=auth.uid();isl public.islands;token text;remaining integer;begin
 if not private.active() then raise exception '로그인이 필요해요.' using errcode='42501';end if;
 perform private.rate_limit('invite',5);
 select i.* into isl from public.islands i join public.members m on m.island_id=i.id where m.user_id=me for update of i;
 if isl.owner is distinct from me then raise exception '방장만 초대할 수 있어요.' using errcode='42501';end if;
 select 8-count(*) into remaining from public.members where island_id=isl.id;
 if remaining<=0 then raise exception '섬이 가득 찼어요.';end if;
 token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.invites(island_id,token_hash,max_uses) values(isl.id,encode(sha256(convert_to(token,'UTF8')),'hex'),remaining);
 return token;
end$$;

create function public.isola_mutate(action jsonb) returns void language plpgsql security definer set search_path='' as $$
declare me uuid=auth.uid();op text=action->>'type';target uuid;isl public.islands;inv public.invites;sp public.spaces;it public.items;c public.comments;payload jsonb;target_owner uuid;new_id uuid;slot integer;av jsonb;begin
 if not private.active() then raise exception '로그인이 필요하거나 계정이 비활성 상태예요.' using errcode='42501';end if;
 if pg_column_size(action)>131072 then raise exception '요청이 너무 커요.';end if;
 perform private.rate_limit('mutate',120);
 insert into public.profiles(id) values(me) on conflict do nothing;
 -- Serialize membership operations per user before acquiring island locks.
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 select i.* into isl from public.islands i join public.members m on m.island_id=i.id where m.user_id=me;
 if action ? 'id' then target=(action->>'id')::uuid;end if;
 if op='profile' then
 av=action->'avatar';
 if av is null or av->>'skin' is null or av->>'skin' not in ('#efc3a4','#dba57b','#a97553','#704e3a') or av->>'hair' is null or av->>'hair' not in ('#514139','#8c6650','#d4b77d','#b7828b') or av->>'shirt' is null or av->>'shirt' not in ('#819e87','#cc9684','#a0aaca','#d4ba7e') or av->>'style' is null or av->>'style' not in ('short','bob','bun') or av->>'body' is null or av->>'body' not in ('small','round','tall') then raise exception '유효하지 않은 아바타예요.';end if;
 update public.profiles set name=btrim(action->>'name'),bio=coalesce(action->>'bio',''),identity=coalesce(action->>'identity',''),avatar=av where id=me;
 elsif op='island.create' then
 if isl.id is not null then raise exception '이미 다른 섬에 살고 있어요.';end if;
 insert into public.islands(name,owner) values(btrim(action->>'name'),me) returning id into new_id;
 insert into public.members(user_id,island_id,plot) values(me,new_id,0);
 insert into public.spaces(owner,kind) values(me,'interior'),(me,'garden');
 elsif op='invite.accept' then
 select * into inv from public.invites where token_hash=encode(sha256(convert_to(action->>'token','UTF8')),'hex');
 if inv.id is null then raise exception '유효하지 않은 초대예요.';end if;
 if isl.id=inv.island_id then return;end if;
 if isl.id is not null then raise exception '먼저 현재 섬을 떠나야 해요.';end if;
 perform 1 from public.islands where id=inv.island_id for update;
 select * into inv from public.invites where id=inv.id for update;
 if inv.revoked or inv.expires<=now() or inv.uses>=inv.max_uses then raise exception '만료되었거나 취소된 초대예요.';end if;
 select n into slot from generate_series(0,7) n where not exists(select 1 from public.members where island_id=inv.island_id and plot=n) order by n limit 1;
 if slot is null then raise exception '섬이 가득 찼어요.';end if;
 insert into public.members(user_id,island_id,plot) values(me,inv.island_id,slot);
 insert into public.spaces(owner,kind) values(me,'interior'),(me,'garden');
 update public.invites set uses=uses+1 where id=inv.id;
 elsif op in ('island.rename','invite.revoke','island.transfer','island.remove','island.leave','account.delete') then
 if isl.id is not null then select * into isl from public.islands where id=isl.id for update;end if;
 if op in ('island.rename','invite.revoke','island.transfer','island.remove') and isl.owner is distinct from me then raise exception '방장만 할 수 있어요.' using errcode='42501';end if;
 if op='island.rename' then update public.islands set name=btrim(action->>'name') where id=isl.id;
 elsif op='invite.revoke' then update public.invites set revoked=true where island_id=isl.id;
 elsif op='island.transfer' then
 if target=me or not exists(select 1 from public.members where user_id=target and island_id=isl.id) then raise exception '현재 섬의 다른 멤버에게만 이전할 수 있어요.';end if;
 update public.islands set owner=target where id=isl.id;
 else
 if op='island.remove' then
 if target=me or not exists(select 1 from public.members where user_id=target and island_id=isl.id) then raise exception '내보낼 수 없는 멤버예요.';end if;
 else target=me;end if;
 if isl.owner=target and (select count(*) from public.members where island_id=isl.id)>1 then raise exception '먼저 다른 멤버에게 방장을 이전해 주세요.';end if;
 update public.items set visibility='private',revision=revision+1 where owner=target;
 delete from public.comments where author=target;
 delete from public.members where user_id=target;
 if isl.owner=target then delete from public.islands where id=isl.id;end if;
 if op='account.delete' then insert into public.deletion_requests(user_id) values(me) on conflict do nothing;end if;
 end if;
 elsif op='item.save' then
 payload=action->'item';select * into it from public.items where id=target for update;
 if exists(select 1 from jsonb_array_elements_text(payload->'tags') t where char_length(t)<1 or char_length(t)>20) then raise exception '태그는 1~20자로 입력해 주세요.';end if;
 if it.id is not null then
 if it.owner<>me then raise exception '내 기록만 수정할 수 있어요.' using errcode='42501';end if;
 if it.revision is distinct from (action->>'revision')::integer then raise exception '다른 창에서 바뀌었어요. 새로고침해 주세요.' using errcode='40001';end if;
 update public.items set kind=payload->>'kind',title=btrim(payload->>'title'),creator=coalesce(payload->>'creator',''),note=coalesce(payload->>'note',''),tags=payload->'tags',visibility=payload->>'visibility',revision=revision+1 where id=target;
 else
 if (select count(*) from public.items where owner=me)>=500 then raise exception '기록은 최대 500개까지 저장할 수 있어요.';end if;
 insert into public.items(id,owner,kind,title,creator,note,tags,visibility) values(coalesce(target,gen_random_uuid()),me,payload->>'kind',btrim(payload->>'title'),coalesce(payload->>'creator',''),coalesce(payload->>'note',''),payload->'tags',payload->>'visibility');
 end if;
 elsif op='item.delete' then
 if not exists(select 1 from public.items where id=target and owner=me) then raise exception '내 기록만 삭제할 수 있어요.' using errcode='42501';end if;
 update public.spaces s set draft=coalesce((select jsonb_agg(case when p->>'itemId'=target::text then p-'itemId' else p end) from jsonb_array_elements(s.draft) p),'[]'),published=coalesce((select jsonb_agg(case when p->>'itemId'=target::text then p-'itemId' else p end) from jsonb_array_elements(s.published) p),'[]'),revision=revision+1 where owner=me;
 delete from public.items where id=target;
 elsif op in ('space.save','space.publish','space.visibility') then
 select * into sp from public.spaces where id=target and owner=me for update;
 if sp.id is null then raise exception '내 공간만 수정할 수 있어요.' using errcode='42501';end if;
 if op='space.visibility' then update public.spaces set visibility=action->>'visibility' where id=target;
 else
 if sp.revision is distinct from (action->>'revision')::integer then raise exception '다른 창에서 바뀌었어요. 최신 공간을 불러와 주세요.' using errcode='40001';end if;
 payload=case when op='space.save' then action->'placements' else sp.draft end;
 perform private.validate_layout(payload,case when sp.kind='garden' then 16 else 12 end,me,op='space.publish');
 if op='space.save' then update public.spaces set draft=payload,revision=revision+1 where id=target;
 else update public.spaces set published=payload,published_revision=published_revision+1,visibility='island' where id=target;end if;
 end if;
 elsif op='comment.add' then
 select * into c from public.comments where id=target;
 if c.id is not null then
 if c.author=me and c.body=btrim(action->>'body') and coalesce(c.item_id,c.space_id)=(action->>'target')::uuid then return;end if;
 raise exception '중복 요청의 내용이 달라요.';end if;
 new_id=(action->>'target')::uuid;
 if not(private.can_item(new_id) or private.can_space(new_id)) then raise exception '이곳에 댓글을 남길 수 없어요.' using errcode='42501';end if;
 perform private.rate_limit('comment',10);
 select owner into target_owner from public.items where id=new_id;
 if target_owner is not null then insert into public.comments(id,author,item_id,body) values(target,me,new_id,btrim(action->>'body'));
 else select owner into target_owner from public.spaces where id=new_id;insert into public.comments(id,author,space_id,body) values(target,me,new_id,btrim(action->>'body'));end if;
 if target_owner<>me then insert into public.notifications(recipient,actor,comment_id) values(target_owner,me,target);end if;
 elsif op in ('comment.delete','comment.hide') then
 select * into c from public.comments where id=target;
 if c.id is null then return;end if;
 if op='comment.delete' and c.author=me then delete from public.comments where id=target;
 elsif op='comment.hide' and (exists(select 1 from public.items where id=c.item_id and owner=me) or exists(select 1 from public.spaces where id=c.space_id and owner=me)) then update public.comments set hidden=true where id=target;
 else raise exception '댓글을 변경할 권한이 없어요.' using errcode='42501';end if;
 elsif op='notice.read' then update public.notifications set read=true where recipient=me;
 elsif op='block' then
 if target=me then raise exception '자신을 차단할 수 없어요.';end if;
 if (action->>'blocked')::boolean then
 if not exists(select 1 from public.members where user_id=target and island_id=isl.id) then raise exception '같은 섬의 멤버만 선택할 수 있어요.';end if;
 insert into public.blocks(blocker,blocked) values(me,target) on conflict do nothing;
 else delete from public.blocks where blocker=me and blocked=target;end if;
 elsif op='report' then
 new_id=(action->>'target')::uuid;
 if not(private.can_item(new_id) or private.can_space(new_id) or private.can_comment(new_id)) then raise exception '접근할 수 없는 대상이에요.';end if;
 perform private.rate_limit('report',3);insert into public.reports(reporter,target,reason) values(me,new_id,btrim(action->>'reason'));
 else raise exception '알 수 없는 요청이에요.';end if;
end$$;
-- Functions are not executable by PUBLIC by default in this application.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.active(),private.peer(uuid),private.can_item(uuid),private.can_space(uuid),private.can_comment(uuid) to authenticated;
revoke execute on function public.isola_state(),public.isola_invite(),public.isola_mutate(jsonb) from public,anon;
grant execute on function public.isola_state(),public.isola_invite(),public.isola_mutate(jsonb) to authenticated;
