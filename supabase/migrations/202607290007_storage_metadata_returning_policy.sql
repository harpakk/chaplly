-- Permit owners to read/RETURNING their file metadata directly. The previous
-- policy called can_access_file(), which queried storage_files and could not see
-- the just-inserted row inside INSERT ... RETURNING.

drop policy if exists storage_files_owner_read on public.storage_files;
create policy storage_files_owner_read on public.storage_files
for select to authenticated
using(
  owner_user_id=auth.uid()
  or public.is_org_member(owner_organization_id)
  or exists(
    select 1 from public.fulfilment_files ff
    where ff.file_id=storage_files.id and public.can_access_fulfilment(ff.fulfilment_id)
  )
);
