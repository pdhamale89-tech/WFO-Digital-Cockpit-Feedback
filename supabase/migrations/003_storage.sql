-- Private screenshot bucket + Storage RLS. Object path convention: <user_id>/<uuid>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "screenshots_insert_own_folder" on storage.objects;
create policy "screenshots_insert_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "screenshots_select_own_or_admin" on storage.objects;
create policy "screenshots_select_own_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'feedback-screenshots'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Users may delete only orphaned uploads (e.g. failed submission); admins may delete any.
drop policy if exists "screenshots_delete" on storage.objects;
create policy "screenshots_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-screenshots'
         and (public.is_admin()
              or ((storage.foldername(name))[1] = auth.uid()::text
                  and not exists (select 1 from public.feedback f where f.screenshot_path = name))));
