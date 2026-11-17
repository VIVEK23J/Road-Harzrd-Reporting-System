create type public.app_role as enum ('admin','user');
create type public.hazard_status as enum ('pending','verified','in_progress','resolved','rejected');
create type public.hazard_type as enum ('pothole','debris','flooding','signal','crack','lighting','other');
create type public.hazard_severity as enum ('low','medium','high','critical');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.hazards (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  type hazard_type not null,
  severity hazard_severity not null default 'medium',
  status hazard_status not null default 'pending',
  description text,
  photo_path text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  vote_count integer not null default 0,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.hazards to anon, authenticated;
grant insert, update, delete on public.hazards to authenticated;
grant all on public.hazards to service_role;
alter table public.hazards enable row level security;
create policy "public view" on public.hazards for select using (status <> 'rejected');
create policy "owner view" on public.hazards for select to authenticated using (auth.uid() = reporter_id);
create policy "admin view" on public.hazards for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "report" on public.hazards for insert to authenticated with check (auth.uid() = reporter_id and status = 'pending');
create policy "admin update" on public.hazards for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete" on public.hazards for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.hazard_status_events (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id) on delete cascade,
  status hazard_status not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.hazard_status_events to anon, authenticated;
grant all on public.hazard_status_events to service_role;
alter table public.hazard_status_events enable row level security;
create policy "events readable" on public.hazard_status_events for select using (true);

create or replace function public.log_hazard_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.hazard_status_events (hazard_id, status, actor_id) values (new.id, new.status, new.reporter_id);
  elsif new.status is distinct from old.status then
    new.updated_at := now();
    insert into public.hazard_status_events (hazard_id, status, note, actor_id) values (new.id, new.status, new.admin_note, auth.uid());
  end if;
  return new;
end $$;
create trigger hazard_status_insert after insert on public.hazards for each row execute function public.log_hazard_status();
create trigger hazard_status_update before update on public.hazards for each row execute function public.log_hazard_status();

create table public.hazard_votes (
  hazard_id uuid not null references public.hazards(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (hazard_id, user_id)
);
grant select on public.hazard_votes to anon, authenticated;
grant insert, delete on public.hazard_votes to authenticated;
grant all on public.hazard_votes to service_role;
alter table public.hazard_votes enable row level security;
create policy "votes readable" on public.hazard_votes for select using (true);
create policy "vote own" on public.hazard_votes for insert to authenticated with check (auth.uid() = user_id);
create policy "unvote own" on public.hazard_votes for delete to authenticated using (auth.uid() = user_id);

create or replace function public.sync_vote_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.hazards set vote_count = (select count(*) from public.hazard_votes where hazard_id = coalesce(new.hazard_id, old.hazard_id))
  where id = coalesce(new.hazard_id, old.hazard_id);
  return null;
end $$;
create trigger votes_sync after insert or delete on public.hazard_votes for each row execute function public.sync_vote_count();

create table public.hazard_comments (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id) on delete cascade,
  user_id uuid not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
grant select on public.hazard_comments to anon, authenticated;
grant insert, delete on public.hazard_comments to authenticated;
grant all on public.hazard_comments to service_role;
alter table public.hazard_comments enable row level security;
create policy "comments readable" on public.hazard_comments for select using (true);
create policy "comment own" on public.hazard_comments for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own comment" on public.hazard_comments for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create policy "photos readable" on storage.objects for select using (bucket_id = 'hazard-photos');
create policy "photos upload own" on storage.objects for insert to authenticated with check (bucket_id = 'hazard-photos' and (storage.foldername(name))[1] = auth.uid()::text);