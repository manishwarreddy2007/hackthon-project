create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('DONOR', 'RECEIVER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.donation_status as enum ('AVAILABLE', 'REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COMPLETED', 'COLLECTED');
exception when duplicate_object then null;
end $$;

alter type public.donation_status add value if not exists 'COLLECTED';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'User',
  email text not null,
  phone text,
  role public.user_role not null,
  organization_name text not null default 'FoodLink member',
  organization_type text,
  location text not null default 'Hyderabad',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  pickup_location text not null,
  city text not null,
  description text not null,
  allergens text not null default 'None declared',
  urgency text not null default 'Medium',
  image_url text,
  pickup_minutes integer not null check (pickup_minutes > 0),
  pickup_by timestamptz not null,
  pickup_window text not null,
  status public.donation_status not null default 'AVAILABLE',
  coordinates jsonb,
  connected_receiver_id uuid references public.profiles(id),
  connection_id uuid,
  pickup_scheduled_at timestamptz,
  estimated_pickup_at timestamptz,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED')),
  distance_km numeric not null default 0 check (distance_km >= 0),
  match_score integer not null default 0 check (match_score between 0 and 100),
  connection_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.donation_requests drop constraint if exists donation_requests_status_check;
update public.donation_requests set status = 'PENDING' where status = 'PENDING_APPROVAL';
alter table public.donation_requests alter column status set default 'PENDING';
alter table public.donation_requests add constraint donation_requests_status_check check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED'));

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  request_id uuid not null references public.donation_requests(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  distance_km numeric not null default 0 check (distance_km >= 0),
  status text not null default 'ACCEPTED' check (status in ('ACCEPTED', 'PICKUP_SCHEDULED', 'COMPLETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pickup_scheduled_at timestamptz,
  collected_at timestamptz
);

alter table public.connections drop constraint if exists connections_status_check;
alter table public.connections add constraint connections_status_check check (status in ('ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'COMPLETED'));

do $$ begin
  alter table public.donations add constraint donations_connection_fk foreign key (connection_id) references public.connections(id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.donation_requests add constraint donation_requests_connection_fk foreign key (connection_id) references public.connections(id);
exception when duplicate_object then null;
end $$;

alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.donations add column if not exists updated_at timestamptz not null default now();
alter table public.donation_requests add column if not exists updated_at timestamptz not null default now();
alter table public.connections add column if not exists updated_at timestamptz not null default now();

create index if not exists donations_status_created_idx on public.donations(status, created_at desc);
create index if not exists donations_city_status_idx on public.donations(city, status);
create index if not exists donations_donor_idx on public.donations(donor_id);
create index if not exists donation_requests_donor_idx on public.donation_requests(donor_id, status);
create index if not exists donation_requests_receiver_idx on public.donation_requests(receiver_id, status);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at before update on public.donations for each row execute procedure public.set_updated_at();
drop trigger if exists donation_requests_set_updated_at on public.donation_requests;
create trigger donation_requests_set_updated_at before update on public.donation_requests for each row execute procedure public.set_updated_at();
drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at before update on public.connections for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, phone, role, organization_name, organization_type, location, verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'DONOR'),
    coalesce(new.raw_user_meta_data->>'organizationName', 'FoodLink member'),
    new.raw_user_meta_data->>'organizationType',
    coalesce(new.raw_user_meta_data->>'location', 'Hyderabad'),
    coalesce((new.raw_user_meta_data->>'role') = 'RECEIVER', false)
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    organization_name = excluded.organization_name,
    organization_type = excluded.organization_type,
    location = excluded.location,
    verified = excluded.verified;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.donation_requests enable row level security;
alter table public.connections enable row level security;

drop policy if exists "authenticated profiles can be read" on public.profiles;
drop policy if exists "profiles visible to account participants" on public.profiles;
create policy "profiles visible to account participants" on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.connections connection
    where (connection.donor_id = auth.uid() and connection.receiver_id = profiles.id)
       or (connection.receiver_id = auth.uid() and connection.donor_id = profiles.id)
  )
);
drop policy if exists "users can update own profile" on public.profiles;

create or replace function public.get_platform_profiles()
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  role public.user_role,
  organization_name text,
  organization_type text,
  location text,
  verified boolean
)
language sql stable security definer set search_path = public as $$
  select
    profile.id,
    profile.name,
    case when profile.id = auth.uid() or exists (
      select 1 from public.connections connection
      where (connection.donor_id = auth.uid() and connection.receiver_id = profile.id)
         or (connection.receiver_id = auth.uid() and connection.donor_id = profile.id)
    ) then profile.email else '' end,
    case when profile.id = auth.uid() or exists (
      select 1 from public.connections connection
      where (connection.donor_id = auth.uid() and connection.receiver_id = profile.id)
         or (connection.receiver_id = auth.uid() and connection.donor_id = profile.id)
    ) then coalesce(profile.phone, '') else '' end,
    profile.role,
    profile.organization_name,
    profile.organization_type,
    profile.location,
    profile.verified
  from public.profiles profile
  where auth.uid() is not null
    and (
      profile.id = auth.uid()
      or exists (
        select 1 from public.donation_requests request
        where (request.donor_id = auth.uid() and request.receiver_id = profile.id)
           or (request.receiver_id = auth.uid() and request.donor_id = profile.id)
      )
      or exists (
        select 1 from public.donations donation
        join public.profiles receiver_profile on receiver_profile.id = auth.uid()
        where donation.donor_id = profile.id
          and donation.status in ('AVAILABLE', 'REQUESTED')
          and receiver_profile.role = 'RECEIVER'
          and receiver_profile.location = donation.city
      )
    );
$$;
revoke all on function public.get_platform_profiles() from public, anon;
grant execute on function public.get_platform_profiles() to authenticated;

drop policy if exists "donations are visible to authenticated users" on public.donations;
create policy "donations are visible to authenticated users" on public.donations for select to authenticated using (
  donor_id = auth.uid()
  or (
    status in ('AVAILABLE', 'REQUESTED')
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid() and profile.role = 'RECEIVER' and profile.location = donations.city
    )
  )
  or exists (
    select 1 from public.donation_requests request
    where request.donation_id = donations.id
      and (request.donor_id = auth.uid() or request.receiver_id = auth.uid())
  )
);
drop policy if exists "donors create own donations" on public.donations;
create policy "donors create own donations" on public.donations for insert to authenticated with check (
  donor_id = auth.uid() and exists (
    select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'DONOR'
  )
);
drop policy if exists "donors update own donations" on public.donations;

 drop policy if exists "requests visible to participants" on public.donation_requests;
create policy "requests visible to participants" on public.donation_requests for select to authenticated using (donor_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists "receivers create own requests" on public.donation_requests;
drop policy if exists "donors update requests" on public.donation_requests;

drop policy if exists "connections visible to participants" on public.connections;
create policy "connections visible to participants" on public.connections for select to authenticated using (donor_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists "donors create connections" on public.connections;
drop policy if exists "participants update connections" on public.connections;

insert into storage.buckets (id, name, public) values ('food-images', 'food-images', true) on conflict (id) do nothing;
drop policy if exists "authenticated users upload food images" on storage.objects;
create policy "authenticated users upload food images" on storage.objects for insert to authenticated with check (bucket_id = 'food-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public food images are readable" on storage.objects;
create policy "public food images are readable" on storage.objects for select to public using (bucket_id = 'food-images');

create or replace function public.request_donation(
  p_donation_id uuid,
  p_donor_id uuid,
  p_distance_km numeric,
  p_match_score integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_request_id uuid; donation_row public.donations;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'RECEIVER') then raise exception 'Only receivers can request donations'; end if;
  select * into donation_row from public.donations where id = p_donation_id for update;
  if donation_row.id is null or donation_row.donor_id <> p_donor_id or donation_row.status not in ('AVAILABLE', 'REQUESTED') then raise exception 'Donation is no longer available'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and location = donation_row.city) then raise exception 'Donation is outside your registered city'; end if;
  if exists (select 1 from public.donation_requests where donation_id = p_donation_id and receiver_id = auth.uid() and status = 'PENDING') then raise exception 'Request already exists'; end if;
  insert into public.donation_requests (donation_id, donor_id, receiver_id, distance_km, match_score) values (p_donation_id, p_donor_id, auth.uid(), p_distance_km, p_match_score) returning id into new_request_id;
  update public.donations set status = 'REQUESTED' where id = p_donation_id and status in ('AVAILABLE', 'REQUESTED');
  return new_request_id;
end;
$$;
revoke all on function public.request_donation(uuid, uuid, numeric, integer) from public, anon;
grant execute on function public.request_donation(uuid, uuid, numeric, integer) to authenticated;

create or replace function public.approve_donation_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare request_row public.donation_requests; donation_row public.donations; new_connection_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'DONOR') then raise exception 'Only donors can accept requests'; end if;
  select * into request_row from public.donation_requests where id = p_request_id for update;
  select * into donation_row from public.donations where id = request_row.donation_id for update;
  if request_row.donor_id <> auth.uid() or request_row.status <> 'PENDING' or donation_row.status <> 'REQUESTED' then raise exception 'Request is no longer available'; end if;
  insert into public.connections (donation_id, request_id, donor_id, receiver_id, distance_km) values (request_row.donation_id, request_row.id, request_row.donor_id, request_row.receiver_id, request_row.distance_km) returning id into new_connection_id;
  update public.donation_requests set status = case when id = p_request_id then 'ACCEPTED' else 'REJECTED' end, connection_id = case when id = p_request_id then new_connection_id else null end where donation_id = request_row.donation_id and status = 'PENDING';
  update public.donations set status = 'ACCEPTED', connected_receiver_id = request_row.receiver_id, connection_id = new_connection_id where id = request_row.donation_id;
  return new_connection_id;
end;
$$;
revoke all on function public.approve_donation_request(uuid) from public, anon;
grant execute on function public.approve_donation_request(uuid) to authenticated;

create or replace function public.reject_donation_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare request_row public.donation_requests; pending_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'DONOR') then raise exception 'Only donors can reject requests'; end if;
  select * into request_row from public.donation_requests where id = p_request_id for update;
  if request_row.donor_id <> auth.uid() or request_row.status <> 'PENDING' then raise exception 'Request is no longer available'; end if;
  update public.donation_requests set status = 'REJECTED' where id = p_request_id;
  select count(*) into pending_count from public.donation_requests where donation_id = request_row.donation_id and status = 'PENDING';
  if pending_count = 0 then update public.donations set status = 'AVAILABLE' where id = request_row.donation_id and status = 'REQUESTED'; end if;
end;
$$;
revoke all on function public.reject_donation_request(uuid) from public, anon;
grant execute on function public.reject_donation_request(uuid) to authenticated;

create or replace function public.advance_donation_connection(p_connection_id uuid, p_next_step text, p_pickup_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
declare connection_row public.connections; now_value timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into connection_row from public.connections where id = p_connection_id for update;
  if connection_row.donor_id <> auth.uid() and connection_row.receiver_id <> auth.uid() then raise exception 'Connection is not available to this user'; end if;
  if connection_row.status = 'ACCEPTED' and p_next_step = 'PICKUP_SCHEDULED' then
    update public.connections set status = 'PICKUP_SCHEDULED', pickup_scheduled_at = now_value where id = p_connection_id;
    update public.donations set status = 'PICKUP_SCHEDULED', pickup_scheduled_at = now_value, estimated_pickup_at = now_value + make_interval(mins => p_pickup_minutes) where id = connection_row.donation_id;
  elsif connection_row.status = 'PICKUP_SCHEDULED' and p_next_step = 'COLLECTED' then
    update public.connections set status = 'COLLECTED', collected_at = now_value where id = p_connection_id;
    update public.donations set status = 'COLLECTED', collected_at = now_value where id = connection_row.donation_id;
  elsif connection_row.status = 'COLLECTED' and p_next_step = 'COMPLETED' then
    update public.connections set status = 'COMPLETED', collected_at = now_value where id = p_connection_id;
    update public.donations set status = 'COMPLETED', collected_at = now_value where id = connection_row.donation_id;
    update public.donation_requests set status = 'COMPLETED' where id = connection_row.request_id and status = 'ACCEPTED';
  else
    raise exception 'Invalid connection transition';
  end if;
end;
$$;
revoke all on function public.advance_donation_connection(uuid, text, integer) from public, anon;
grant execute on function public.advance_donation_connection(uuid, text, integer) to authenticated;
