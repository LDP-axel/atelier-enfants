-- =====================================================================
--  Mise à jour 2 : modules créés par les parents + plusieurs familles
--  À exécuter UNE fois dans Supabase > SQL Editor (après schema.sql)
-- =====================================================================

-- ---------- Modules créés avec l'IA depuis l'Espace parents ----------
create table if not exists public.custom_modules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null,
  subject text not null default 'mo',       -- 'fr', 'ma', 'mo' ou 'en'
  description text,
  questions jsonb not null,                 -- [{question, options[], answer (indice), explication}]
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists custom_modules_child on public.custom_modules (child_id, created_at desc);

alter table public.custom_modules enable row level security;
drop policy if exists cm_all on public.custom_modules;
create policy cm_all on public.custom_modules for all
  using (public.is_member(family_id))
  with check (public.is_member(family_id) and public.child_family(child_id) = family_id);
grant select, insert, update, delete on public.custom_modules to authenticated;

-- ---------- Création d'une famille avec ses propres enfants ----------
-- Les ateliers existants (une page par enfant) : jade, mael, lanahee, lila.
drop function if exists public.setup_family(text);
create or replace function public.setup_family(p_name text default 'Famille', p_kids jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; kids jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select family_id into fid from family_members where user_id = auth.uid() limit 1;
  if fid is not null then return fid; end if;
  kids := coalesce(p_kids, '[{"slug":"jade","first_name":"Jade","grade":"CM2"},{"slug":"mael","first_name":"Mael","grade":"CE1"}]'::jsonb);
  if jsonb_typeof(kids) <> 'array' or jsonb_array_length(kids) = 0 then raise exception 'Choisissez au moins un enfant'; end if;
  if exists (select 1 from jsonb_to_recordset(kids) as x(slug text) where x.slug not in ('jade','mael','lanahee','lila')) then
    raise exception 'Atelier inconnu';
  end if;
  insert into families(name) values (coalesce(nullif(trim(p_name),''),'Famille')) returning id into fid;
  insert into family_members(family_id, user_id, role) values (fid, auth.uid(), 'owner');
  insert into children(family_id, slug, first_name, grade)
    select fid, x.slug, x.first_name, x.grade from jsonb_to_recordset(kids) as x(slug text, first_name text, grade text);
  return fid;
end $$;
revoke all on function public.setup_family(text, jsonb) from public;
grant execute on function public.setup_family(text, jsonb) to authenticated;
