import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

/**
 * 
 * 
 * SQL SCHEMA
 * 
-- Users are handled by Supabase Auth (auth.users)

-- Each user owns lists
create table lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users not null,
  name text not null,
  created_at timestamp default now()
);

-- Todos belong to a list
create table todos (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists on delete cascade not null,
  task text not null,
  completed boolean default false,
  inserted_at timestamp default now()
);

-- Sharing: users can be invited to lists
create table list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists on delete cascade,
  user_id uuid references auth.users,
  role text check (role in ('owner','editor','viewer')) default 'viewer'
);

-- Ensure owner is always a member
create or replace function handle_new_list()
returns trigger as $$
begin
  insert into list_members (list_id, user_id, role) values (new.id, new.owner, 'owner');
  return new;
end;
$$ language plpgsql;

create trigger add_owner_as_member
after insert on lists
for each row execute function handle_new_list();


-- Row level security policies

-- lists
alter table lists enable row level security;

create policy "owners and members can view"
  on lists for select
  using (exists (
    select 1 from list_members m
    where m.list_id = lists.id and m.user_id = auth.uid()
  ));

   OR (EXISTS ( SELECT 1
   FROM list_members m
  WHERE ((m.list_id = lists.id) AND (m.user_id = auth.uid())))))

create policy "owners can insert"
  on lists for insert
  with check (auth.uid() = owner);

-- todos
alter table todos enable row level security;

create policy "list members can CRUD todos"
  on todos for all
  using (exists (
    select 1 from list_members m
    where m.list_id = todos.list_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from list_members m
    where m.list_id = todos.list_id and m.user_id = auth.uid()
  ));

-- list_members
alter table list_members enable row level security;

create policy "members can view members"
  on list_members for select
  using (list_id in (select list_id from list_members where user_id = auth.uid()));

create policy "owners can manage members"
  on list_members for all
  using (role = 'owner' and user_id = auth.uid());


 */