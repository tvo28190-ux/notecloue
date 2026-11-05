-- NoteCloud không dùng đăng ký/đăng nhập người dùng.
-- Mọi thao tác CRUD đi qua Edge Function note-api, được bảo vệ bằng NOTE_ADMIN_KEY.
-- Chạy toàn bộ file này trong Supabase Dashboard → SQL Editor → New query.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tương thích với bảng notes đã tạo theo hướng dẫn phiên bản đăng nhập trước đó.
alter table public.notes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.notes alter column user_id drop not null;
alter table public.notes add column if not exists title text not null default '';
alter table public.notes add column if not exists content text not null default '';
alter table public.notes add column if not exists is_pinned boolean not null default false;
alter table public.notes add column if not exists is_archived boolean not null default false;
alter table public.notes add column if not exists deleted_at timestamptz;
alter table public.notes add column if not exists created_at timestamptz not null default now();
alter table public.notes add column if not exists updated_at timestamptz not null default now();

create index if not exists notes_updated_idx on public.notes (updated_at desc);

-- Không cho anon/authenticated truy cập thẳng bảng notes.
-- Edge Function sử dụng service_role ở máy chủ, không đưa khóa đó ra trình duyệt.
alter table public.notes enable row level security;
drop policy if exists "Users can read their own notes" on public.notes;
drop policy if exists "Users can create their own notes" on public.notes;
drop policy if exists "Users can update their own notes" on public.notes;
drop policy if exists "Users can delete their own notes" on public.notes;
revoke all on table public.notes from anon, authenticated;
grant select, insert, update, delete on table public.notes to service_role;

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
