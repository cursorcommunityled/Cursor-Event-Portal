-- Add hero_featured flag for admin-curated hero gallery photos
alter table public.event_photos
  add column if not exists hero_featured boolean not null default false;

create index if not exists idx_event_photos_hero_featured
  on public.event_photos(hero_featured) where hero_featured = true;
