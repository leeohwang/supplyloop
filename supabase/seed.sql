-- Data-only school seeds. Passwords and Auth users are provisioned separately.
insert into public.schools (id, name, slug, enabled_categories, pickup_label, term_label)
values
  ('11111111-1111-1111-1111-111111111111', 'School A', 'school-a', array['clothing', 'textbook'], 'Main office pickup', 'Demo term'),
  ('22222222-2222-2222-2222-222222222222', 'School B', 'school-b', array['clothing', 'textbook'], 'Main office pickup', 'Demo term')
on conflict (id) do nothing;
