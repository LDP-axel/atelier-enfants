-- =====================================================================
--  L'Atelier des enfants — schéma Supabase
--  À coller UNE SEULE FOIS dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Famille',
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.family_invites (
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (family_id, email)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  slug text not null,              -- 'jade' ou 'mael'
  first_name text not null,
  grade text not null,             -- 'CM2', 'CE1'…
  created_at timestamptz not null default now(),
  unique (family_id, slug)
);

-- Tout l'état d'un atelier (étoiles, réglages, jours, carnet d'erreurs…)
create table if not exists public.child_state (
  child_id uuid primary key references public.children(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Une ligne par question répondue (historique complet)
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.children(id) on delete cascade,
  module_id text,
  question_key text,
  prompt text,
  given text,
  answer text,
  is_correct boolean,
  hints_used int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists attempts_child_date on public.attempts (child_id, created_at desc);

-- Histoires créées avec l'IA
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  params jsonb,
  title text,
  pages jsonb,
  glossary jsonb,
  questions jsonb,
  score int,
  created_at timestamptz not null default now()
);
create index if not exists stories_child_date on public.stories (child_id, created_at desc);

-- ---------- Fonctions d'aide (sécurité) ----------
create or replace function public.is_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid());
$$;

create or replace function public.child_family(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from children where id = cid;
$$;

-- ---------- Sécurité : chacun ne voit que sa famille ----------
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.children       enable row level security;
alter table public.child_state    enable row level security;
alter table public.attempts       enable row level security;
alter table public.stories        enable row level security;

drop policy if exists fam_select on public.families;
create policy fam_select on public.families for select using (public.is_member(id));
drop policy if exists fam_update on public.families;
create policy fam_update on public.families for update using (public.is_member(id));

drop policy if exists mem_select on public.family_members;
create policy mem_select on public.family_members for select using (public.is_member(family_id));

drop policy if exists inv_select on public.family_invites;
create policy inv_select on public.family_invites for select using (public.is_member(family_id));
drop policy if exists inv_delete on public.family_invites;
create policy inv_delete on public.family_invites for delete using (public.is_member(family_id));

drop policy if exists kids_select on public.children;
create policy kids_select on public.children for select using (public.is_member(family_id));
drop policy if exists kids_update on public.children;
create policy kids_update on public.children for update using (public.is_member(family_id));

drop policy if exists state_all on public.child_state;
create policy state_all on public.child_state for all
  using (public.is_member(public.child_family(child_id)))
  with check (public.is_member(public.child_family(child_id)));

drop policy if exists att_select on public.attempts;
create policy att_select on public.attempts for select using (public.is_member(public.child_family(child_id)));
drop policy if exists att_insert on public.attempts;
create policy att_insert on public.attempts for insert with check (public.is_member(public.child_family(child_id)));
drop policy if exists att_delete on public.attempts;
create policy att_delete on public.attempts for delete using (public.is_member(public.child_family(child_id)));

drop policy if exists sto_all on public.stories;
create policy sto_all on public.stories for all
  using (public.is_member(public.child_family(child_id)))
  with check (public.is_member(public.child_family(child_id)));

-- ---------- Création de la famille (Jade + Mael) ----------
create or replace function public.setup_family(p_name text default 'Famille') returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select family_id into fid from family_members where user_id = auth.uid() limit 1;
  if fid is not null then return fid; end if;
  insert into families(name) values (coalesce(nullif(trim(p_name),''),'Famille')) returning id into fid;
  insert into family_members(family_id, user_id, role) values (fid, auth.uid(), 'owner');
  insert into children(family_id, slug, first_name, grade) values
    (fid, 'jade', 'Jade', 'CM2'),
    (fid, 'mael', 'Mael', 'CE1');
  return fid;
end $$;

-- ---------- Invitation de l'autre parent ----------
create or replace function public.invite_parent(p_family uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_family) then raise exception 'Accès refusé'; end if;
  insert into family_invites(family_id, email, invited_by)
  values (p_family, lower(trim(p_email)), auth.uid())
  on conflict do nothing;
end $$;

create or replace function public.accept_invites() returns int
language plpgsql security definer set search_path = public as $$
declare n int; my_email text;
begin
  my_email := lower(coalesce(auth.jwt() ->> 'email',''));
  if auth.uid() is null or my_email = '' then return 0; end if;
  insert into family_members(family_id, user_id, role)
    select family_id, auth.uid(), 'parent' from family_invites where email = my_email
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from family_invites where email = my_email;
  return n;
end $$;

revoke all on function public.setup_family(text) from public;
revoke all on function public.invite_parent(uuid, text) from public;
revoke all on function public.accept_invites() from public;
grant execute on function public.setup_family(text) to authenticated;
grant execute on function public.invite_parent(uuid, text) to authenticated;
grant execute on function public.accept_invites() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.child_family(uuid) to authenticated;
