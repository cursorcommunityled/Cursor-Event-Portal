-- Storage bucket for competition entry demo videos (uploaded by attendees)
insert into storage.buckets (id, name, public, file_size_limit)
values ('competition-videos', 'competition-videos', true, 52428800) -- 50MB limit
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Public read for videos
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Competition videos are publicly readable'
  ) then
    create policy "Competition videos are publicly readable"
    on storage.objects
    for select
    using (bucket_id = 'competition-videos');
  end if;
end $$;

-- Service role can insert/update/delete (API uploads)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Competition videos manageable by service role'
  ) then
    create policy "Competition videos manageable by service role"
    on storage.objects
    for all
    using (bucket_id = 'competition-videos' and auth.role() = 'service_role')
    with check (bucket_id = 'competition-videos' and auth.role() = 'service_role');
  end if;
end $$;
