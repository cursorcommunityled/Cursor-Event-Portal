-- Raise event-photos bucket limit to support high-quality gallery uploads
insert into storage.buckets (id, name, public, file_size_limit)
values ('event-photos', 'event-photos', true, 20971520) -- 20MB
on conflict (id) do update set file_size_limit = excluded.file_size_limit;
