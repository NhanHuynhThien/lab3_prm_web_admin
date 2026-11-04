-- TokenLedger operational database. No personal ledger/chat migration.
-- Backend Firebase authorization is mandatory. No direct browser table access.
begin;
create table if not exists public.tl_models(id text primary key,revision integer not null check(revision>0),payload jsonb not null,updated_at timestamptz not null default now());
create table if not exists public.tl_prices(id uuid primary key default gen_random_uuid(),model_id text not null references public.tl_models(id),effective_from timestamptz not null,payload jsonb not null,created_at timestamptz not null default now(),unique(model_id,effective_from));
create table if not exists public.tl_devices(uid text not null,id text not null,token text not null,token_hash text not null unique,metadata jsonb not null,updated_at timestamptz not null default now(),primary key(uid,id));
create table if not exists public.tl_jobs(id uuid primary key,actor text not null,intent jsonb not null,payload jsonb not null,created_at timestamptz not null default now());
create table if not exists public.tl_inbox(id uuid not null,uid text not null,payload jsonb not null,created_at timestamptz not null default now(),primary key(uid,id));
create table if not exists public.tl_audit(id uuid primary key default gen_random_uuid(),payload jsonb not null,created_at timestamptz not null default now());
create table if not exists public.tl_analyses(id uuid primary key default gen_random_uuid(),uid text not null,created_at timestamptz not null default now(),payload jsonb not null);
create index if not exists tl_analyses_owner_time on public.tl_analyses(uid,created_at desc);
create index if not exists tl_inbox_owner_time on public.tl_inbox(uid,created_at desc);
alter table public.tl_models enable row level security;
alter table public.tl_prices enable row level security;
alter table public.tl_devices enable row level security;
alter table public.tl_jobs enable row level security;
alter table public.tl_inbox enable row level security;
alter table public.tl_audit enable row level security;
alter table public.tl_analyses enable row level security;
revoke all on public.tl_models,public.tl_prices,public.tl_devices,public.tl_jobs,public.tl_inbox,public.tl_audit,public.tl_analyses from anon,authenticated;
grant select,insert,update,delete on public.tl_models,public.tl_prices,public.tl_devices,public.tl_jobs,public.tl_inbox,public.tl_audit,public.tl_analyses to service_role;

create or replace function public.tl_save_model(p_data jsonb,p_actor text) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; expected integer:=(p_data->>'revision')::integer; mid text:=p_data->>'id';
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(mid,0));
  result:=p_data||jsonb_build_object('revision',expected+1,'updatedAt',now());
  if expected=0 then
    if exists(select 1 from public.tl_models where id=mid) then raise exception 'conflict'; end if;
    insert into public.tl_models(id,revision,payload) values(mid,1,result);
  else
    update public.tl_models set revision=expected+1,payload=result,updated_at=now() where id=mid and revision=expected;
    if not found then raise exception 'conflict'; end if;
  end if;
  insert into public.tl_audit(payload) values(jsonb_build_object('id',gen_random_uuid(),'actor',p_actor,'action',case when expected=0 then 'model.create' else 'model.update' end,'target',mid,'outcome','success','at',now()));
  return result;
end $$;
create or replace function public.tl_save_price(p_data jsonb,p_actor text) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; pid uuid:=gen_random_uuid();
begin
  if not exists(select 1 from public.tl_models where id=p_data->>'modelId') then raise exception 'not_found';end if;
  result:=p_data||jsonb_build_object('id',pid,'createdAt',now(),'createdBy',p_actor);
  insert into public.tl_prices(id,model_id,effective_from,payload) values(pid,p_data->>'modelId',(p_data->>'effectiveFrom')::timestamptz,result);
  insert into public.tl_audit(payload) values(jsonb_build_object('id',gen_random_uuid(),'actor',p_actor,'action','price.create','target',pid,'outcome','success','at',now()));
  return result;
end $$;
create or replace function public.tl_save_device(p_uid text,p_id text,p_token text,p_hash text,p_metadata jsonb) returns void language plpgsql set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hash,0));
  delete from public.tl_devices where token_hash=p_hash;
  insert into public.tl_devices(uid,id,token,token_hash,metadata) values(p_uid,p_id,p_token,p_hash,p_metadata||jsonb_build_object('updatedAt',now())) on conflict(uid,id) do update set token=excluded.token,token_hash=excluded.token_hash,metadata=excluded.metadata,updated_at=now();
end $$;
create or replace function public.tl_claim_job(p_draft jsonb,p_actor text) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; old public.tl_jobs%rowtype; jid uuid:=(p_draft->>'requestId')::uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jid::text,0));
  select * into old from public.tl_jobs where id=jid;
  if found then
    if old.actor<>p_actor or old.intent<>p_draft then raise exception 'conflict';end if;
    return jsonb_build_object('existing',true,'job',old.payload);
  end if;
  result:=(p_draft-'requestId')||jsonb_build_object('id',jid,'status','sending','accepted',0,'failed',0,'createdAt',now());
  insert into public.tl_jobs(id,actor,intent,payload) values(jid,p_actor,p_draft,result);
  insert into public.tl_audit(payload) values(jsonb_build_object('id',gen_random_uuid(),'actor',p_actor,'action','notification.claim','target',jid,'outcome','success','at',now()));
  return jsonb_build_object('existing',false,'job',result);
end $$;
create or replace function public.tl_finish_job(p_job jsonb,p_recipients text[]) returns void language plpgsql set search_path='' as $$
declare recipient text;
begin
  update public.tl_jobs set payload=p_job where id=(p_job->>'id')::uuid;
  foreach recipient in array p_recipients loop
    insert into public.tl_inbox(id,uid,payload) values((p_job->>'id')::uuid,recipient,jsonb_build_object('id',p_job->>'id','title',p_job->>'title','body',p_job->>'body','target',p_job->>'target','createdAt',p_job->>'createdAt','readAt',null)) on conflict(uid,id) do nothing;
  end loop;
end $$;
create or replace function public.tl_reserve_analysis(p_uid text,p_max integer) returns uuid language plpgsql set search_path='' as $$
declare result uuid:=gen_random_uuid(); amount integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('analysis:'||p_uid,0));
  select count(*) into amount from public.tl_analyses where uid=p_uid and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if amount>=p_max then raise exception 'daily_limit';end if;
  insert into public.tl_analyses(id,uid,payload) values(result,p_uid,jsonb_build_object('id',result,'status','running'));
  return result;
end $$;
revoke all on function public.tl_save_model(jsonb,text),public.tl_save_price(jsonb,text),public.tl_save_device(text,text,text,text,jsonb),public.tl_claim_job(jsonb,text),public.tl_finish_job(jsonb,text[]),public.tl_reserve_analysis(text,integer) from public,anon,authenticated;
grant execute on function public.tl_save_model(jsonb,text),public.tl_save_price(jsonb,text),public.tl_save_device(text,text,text,text,jsonb),public.tl_claim_job(jsonb,text),public.tl_finish_job(jsonb,text[]),public.tl_reserve_analysis(text,integer) to service_role;
commit;
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename like 'tl_%' order by tablename;
