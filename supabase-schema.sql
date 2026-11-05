-- Chạy toàn bộ đoạn SQL này trong Supabase Dashboard → SQL Editor → New query.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

drop policy if exists "Users can read their own notes" on public.notes;
create policy "Users can read their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own notes" on public.notes;
create policy "Users can create their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);


-- Cấp quyền ở mức bảng; RLS phía trên vẫn giới hạn từng tài khoản.
grant select, insert, update, delete on public.notes to authenticated;

-- Tự cập nhật updated_at khi có chỉnh sửa.
create or replace function public.notecloud_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notecloud_notes_updated_at on public.notes;
create trigger notecloud_notes_updated_at
before update on public.notes
for each row execute function public.notecloud_set_updated_at();

-- Bật Realtime cho bảng notes để các thiết bị đang mở app nhận thay đổi.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
     ) then
    execute 'alter publication supabase_realtime add table public.notes';
  end if;
end;
$$;
