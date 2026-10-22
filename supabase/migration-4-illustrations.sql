-- Mise à jour 4 : illustrations des histoires
alter table public.stories add column if not exists illustrations jsonb;
