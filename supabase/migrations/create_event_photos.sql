-- Event photos table for attendee-submitted, admin-approved event photography
create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  storage_path text not null,
  caption text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_event_photos_event_id on public.event_photos(event_id);
create index if not exists idx_event_photos_status on public.event_photos(event_id, status);
create index if not exists idx_event_photos_uploaded_by on public.event_photos(uploaded_by);

-- Storage bucket for event photos
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do update set public = excluded.public;

-- Allow public read access to event photos
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Event photos are publicly readable'
  ) then
    create policy "Event photos are publicly readable"
    on storage.objects
    for select
    using (bucket_id = 'event-photos');
  end if;
end $$;

-- Allow service role to manage event photos
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Event photos are manageable by service role'
  ) then
    create policy "Event photos are manageable by service role"
    on storage.objects
    for all
    using (bucket_id = 'event-photos' and auth.role() = 'service_role')
    with check (bucket_id = 'event-photos' and auth.role() = 'service_role');
  end if;
end $$;

-- RLS on event_photos table
alter table public.event_photos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_photos'
      and policyname = 'Event photos are publicly readable'
  ) then
    create policy "Event photos are publicly readable"
    on public.event_photos for select
    using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_photos'
      and policyname = 'Service role can manage event photos'
  ) then
    create policy "Service role can manage event photos"
    on public.event_photos for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
  end if;
end $$;
