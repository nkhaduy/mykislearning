-- Phase 6: notification, reminder engine, and scheduled alerts.
-- Existing public.notifications is extended in place to avoid a duplicate inbox.

create or replace function public.is_hr_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())::text
      and role in ('hr', 'admin')
  );
$$;

create table if not exists public.notification_templates (
  id text primary key,
  event_type text not null,
  channel text not null check (channel in ('in_app', 'email')),
  locale text not null default 'vi' check (locale in ('vi', 'en', 'kr')),
  title_template text not null,
  body_template text,
  action_label_template text,
  action_url_template text,
  status text not null default 'active' check (status in ('draft', 'active', 'inactive', 'archived')),
  version int not null default 1,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel, locale, version)
);

create table if not exists public.notification_events (
  id text primary key,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  actor_id text,
  recipient_id text not null,
  payload jsonb not null default '{}',
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists recipient_id text,
  add column if not exists event_id text,
  add column if not exists event_type text,
  add column if not exists action_label text,
  add column if not exists action_url text,
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists read_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

update public.notifications
set
  recipient_id = coalesce(recipient_id, account_id),
  event_type = coalesce(event_type, type),
  action_url = coalesce(action_url, link),
  read_at = case when is_read = true and read_at is null then created_at else read_at end,
  metadata = coalesce(nullif(metadata, '{}'::jsonb), data, '{}'::jsonb)
where recipient_id is null or event_type is null or action_url is null or (is_read = true and read_at is null);

alter table public.notifications
  add constraint notifications_event_fk foreign key (event_id) references public.notification_events(id) on delete set null;

create index if not exists notification_templates_lookup_idx on public.notification_templates(event_type, channel, locale, status, version desc);
create index if not exists notification_events_recipient_idx on public.notification_events(recipient_id, occurred_at desc);
create index if not exists notification_events_status_idx on public.notification_events(status, created_at);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_id, read_at, created_at desc);
create index if not exists notifications_event_type_idx on public.notifications(event_type);
create index if not exists notifications_archived_idx on public.notifications(recipient_id, archived_at, created_at desc);

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for select using (account_id = (select auth.uid())::text or recipient_id = (select auth.uid())::text);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (account_id = (select auth.uid())::text or recipient_id = (select auth.uid())::text)
  with check (account_id = (select auth.uid())::text or recipient_id = (select auth.uid())::text);

create table if not exists public.notification_deliveries (
  id text primary key,
  notification_id text references public.notifications(id) on delete cascade,
  recipient_id text not null,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'not_configured')),
  provider text,
  provider_message_id text,
  attempt_count int not null default 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message_safe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists notification_deliveries_retry_idx on public.notification_deliveries(status, next_retry_at);
create index if not exists notification_deliveries_recipient_idx on public.notification_deliveries(recipient_id, created_at desc);

create table if not exists public.notification_preferences (
  id text primary key,
  employee_id text not null,
  event_type text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, event_type)
);

create table if not exists public.reminder_rules (
  id text primary key,
  event_type text not null,
  entity_type text not null,
  offset_value int not null default 0,
  offset_unit text not null default 'day' check (offset_unit in ('hour', 'day')),
  direction text not null check (direction in ('before', 'after', 'on')),
  channel text not null default 'in_app' check (channel in ('in_app', 'email')),
  is_mandatory boolean not null default false,
  status text not null default 'active' check (status in ('draft', 'active', 'inactive', 'archived')),
  configuration jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminder_rules_active_idx on public.reminder_rules(status, entity_type, event_type);

create table if not exists public.reminder_runs (
  id text primary key,
  rule_id text references public.reminder_rules(id) on delete set null,
  scheduled_for timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'skipped')),
  candidates_found int not null default 0,
  events_created int not null default 0,
  duplicates_skipped int not null default 0,
  failures int not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  unique (rule_id, scheduled_for)
);

create index if not exists reminder_runs_created_idx on public.reminder_runs(created_at desc);

alter table public.notification_templates enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.reminder_runs enable row level security;

drop policy if exists "notification_templates_select_hr" on public.notification_templates;
create policy "notification_templates_select_hr" on public.notification_templates for select using (public.is_hr_or_admin());
drop policy if exists "notification_templates_manage_hr" on public.notification_templates;
create policy "notification_templates_manage_hr" on public.notification_templates for all using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

drop policy if exists "notification_events_select_scope" on public.notification_events;
create policy "notification_events_select_scope" on public.notification_events for select using (recipient_id = (select auth.uid())::text or public.is_hr_or_admin());
drop policy if exists "notification_events_insert_hr" on public.notification_events;
create policy "notification_events_insert_hr" on public.notification_events for insert with check (public.is_hr_or_admin());

drop policy if exists "notification_deliveries_select_scope" on public.notification_deliveries;
create policy "notification_deliveries_select_scope" on public.notification_deliveries for select using (recipient_id = (select auth.uid())::text or public.is_hr_or_admin());

drop policy if exists "notification_preferences_own" on public.notification_preferences;
create policy "notification_preferences_own" on public.notification_preferences for select using (employee_id = (select auth.uid())::text or public.is_hr_or_admin());
drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own" on public.notification_preferences for update using (employee_id = (select auth.uid())::text or public.is_hr_or_admin()) with check (employee_id = (select auth.uid())::text or public.is_hr_or_admin());

drop policy if exists "reminder_rules_select_hr" on public.reminder_rules;
create policy "reminder_rules_select_hr" on public.reminder_rules for select using (public.is_hr_or_admin());
drop policy if exists "reminder_rules_manage_hr" on public.reminder_rules;
create policy "reminder_rules_manage_hr" on public.reminder_rules for all using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

drop policy if exists "reminder_runs_select_hr" on public.reminder_runs;
create policy "reminder_runs_select_hr" on public.reminder_runs for select using (public.is_hr_or_admin());

grant select, insert, update on public.notification_templates to authenticated;
grant select, insert on public.notification_events to authenticated;
grant select on public.notification_deliveries to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update on public.reminder_rules to authenticated;
grant select on public.reminder_runs to authenticated;

insert into public.notification_templates
  (id, event_type, channel, locale, title_template, body_template, action_label_template, action_url_template, status, version)
values
  ('ntpl-course-assigned-vi', 'course_assigned', 'in_app', 'vi', 'Khóa học mới', 'Bạn đã được giao khóa học {{course_title}}. Hạn hoàn thành: {{due_date}}.', 'Mở khóa học', '/dashboard/courses', 'active', 1),
  ('ntpl-course-due-soon-vi', 'course_due_soon', 'in_app', 'vi', 'Sắp đến hạn khóa học', 'Khóa học {{course_title}} còn {{days_remaining}} ngày để hoàn thành.', 'Xem khóa học', '/dashboard/courses', 'active', 1),
  ('ntpl-course-overdue-vi', 'course_overdue', 'in_app', 'vi', 'Khóa học quá hạn', 'Khóa học {{course_title}} đã quá hạn {{days_overdue}} ngày.', 'Xem khóa học', '/dashboard/courses', 'active', 1),
  ('ntpl-lp-assigned-vi', 'learning_path_assigned', 'in_app', 'vi', 'Lộ trình học tập mới', 'Bạn đã được giao lộ trình {{learning_path_title}}.', 'Mở lộ trình', '/dashboard/learning-paths', 'active', 1),
  ('ntpl-lp-due-soon-vi', 'learning_path_due_soon', 'in_app', 'vi', 'Lộ trình sắp đến hạn', 'Lộ trình {{learning_path_title}} còn {{days_remaining}} ngày để hoàn thành.', 'Xem lộ trình', '/dashboard/learning-paths', 'active', 1),
  ('ntpl-lp-overdue-vi', 'learning_path_overdue', 'in_app', 'vi', 'Lộ trình quá hạn', 'Lộ trình {{learning_path_title}} đã quá hạn {{days_overdue}} ngày.', 'Xem lộ trình', '/dashboard/learning-paths', 'active', 1),
  ('ntpl-compliance-assigned-vi', 'compliance_assigned', 'in_app', 'vi', 'Đào tạo tuân thủ mới', 'Bạn được giao chương trình tuân thủ {{program_title}}. Hạn: {{due_date}}.', 'Mở tuân thủ', '/dashboard/compliance', 'active', 1),
  ('ntpl-compliance-due-soon-vi', 'compliance_due_soon', 'in_app', 'vi', 'Tuân thủ sắp đến hạn', 'Chương trình {{program_title}} còn {{days_remaining}} ngày.', 'Xem tuân thủ', '/dashboard/compliance', 'active', 1),
  ('ntpl-compliance-overdue-vi', 'compliance_overdue', 'in_app', 'vi', 'Tuân thủ quá hạn', 'Chương trình {{program_title}} đã quá hạn.', 'Xem tuân thủ', '/dashboard/compliance', 'active', 1),
  ('ntpl-cert-verified-vi', 'certificate_verified', 'in_app', 'vi', 'Chứng chỉ đã được xác minh', 'HR đã xác minh chứng chỉ {{certificate_name}}.', 'Xem chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-cert-rejected-vi', 'certificate_rejected', 'in_app', 'vi', 'Chứng chỉ cần bổ sung', 'Chứng chỉ {{certificate_name}} chưa được duyệt. {{rejection_reason}}', 'Cập nhật chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-cert-expiring-60-vi', 'certificate_expiring_60', 'in_app', 'vi', 'Chứng chỉ sắp hết hạn', 'Chứng chỉ {{certificate_name}} sẽ hết hạn trong 60 ngày.', 'Xem chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-cert-expiring-30-vi', 'certificate_expiring_30', 'in_app', 'vi', 'Chứng chỉ sắp hết hạn', 'Chứng chỉ {{certificate_name}} sẽ hết hạn trong 30 ngày.', 'Xem chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-cert-expiring-15-vi', 'certificate_expiring_15', 'in_app', 'vi', 'Chứng chỉ sắp hết hạn', 'Chứng chỉ {{certificate_name}} sẽ hết hạn trong 15 ngày.', 'Xem chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-cert-expiring-7-vi', 'certificate_expiring_7', 'in_app', 'vi', 'Chứng chỉ sắp hết hạn', 'Chứng chỉ {{certificate_name}} sẽ hết hạn trong 7 ngày.', 'Xem chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-cert-expired-vi', 'certificate_expired', 'in_app', 'vi', 'Chứng chỉ đã hết hạn', 'Chứng chỉ {{certificate_name}} đã hết hạn.', 'Gia hạn chứng chỉ', '/dashboard/certificates', 'active', 1),
  ('ntpl-training-24h-vi', 'training_session_reminder_24h', 'in_app', 'vi', 'Nhắc lịch đào tạo', 'Buổi {{session_title}} sẽ bắt đầu trong 24 giờ.', 'Xem lịch', '/dashboard/calendar', 'active', 1),
  ('ntpl-training-1h-vi', 'training_session_reminder_1h', 'in_app', 'vi', 'Sắp đến giờ đào tạo', 'Buổi {{session_title}} sẽ bắt đầu trong 1 giờ.', 'Xem lịch', '/dashboard/calendar', 'active', 1),
  ('ntpl-quiz-due-soon-vi', 'quiz_due_soon', 'in_app', 'vi', 'Quiz sắp đến hạn', 'Quiz {{quiz_title}} sắp đến hạn.', 'Làm quiz', '/dashboard/quizzes', 'active', 1),
  ('ntpl-report-ok-vi', 'report_export_completed', 'in_app', 'vi', 'Xuất báo cáo hoàn tất', 'Báo cáo {{report_type}} đã sẵn sàng.', 'Mở báo cáo', '/admin/reports', 'active', 1),
  ('ntpl-report-fail-vi', 'report_export_failed', 'in_app', 'vi', 'Xuất báo cáo thất bại', 'Không thể xuất báo cáo {{report_type}}. {{error_message}}', 'Thử lại', '/admin/reports', 'active', 1)
on conflict (event_type, channel, locale, version) do nothing;

insert into public.reminder_rules
  (id, event_type, entity_type, offset_value, offset_unit, direction, channel, is_mandatory, status, configuration)
values
  ('rr-course-due-7d', 'course_due_soon', 'course_assignment', 7, 'day', 'before', 'in_app', false, 'active', '{"threshold":"7d"}'),
  ('rr-course-due-3d', 'course_due_soon', 'course_assignment', 3, 'day', 'before', 'in_app', false, 'active', '{"threshold":"3d"}'),
  ('rr-course-due-1d', 'course_due_soon', 'course_assignment', 1, 'day', 'before', 'in_app', false, 'active', '{"threshold":"1d"}'),
  ('rr-course-overdue-1d', 'course_overdue', 'course_assignment', 1, 'day', 'after', 'in_app', false, 'active', '{"threshold":"1d_overdue"}'),
  ('rr-course-overdue-7d', 'course_overdue', 'course_assignment', 7, 'day', 'after', 'in_app', false, 'active', '{"threshold":"7d_overdue"}'),
  ('rr-lp-due-7d', 'learning_path_due_soon', 'learning_path_assignment', 7, 'day', 'before', 'in_app', false, 'active', '{"threshold":"7d"}'),
  ('rr-lp-due-3d', 'learning_path_due_soon', 'learning_path_assignment', 3, 'day', 'before', 'in_app', false, 'active', '{"threshold":"3d"}'),
  ('rr-lp-due-1d', 'learning_path_due_soon', 'learning_path_assignment', 1, 'day', 'before', 'in_app', false, 'active', '{"threshold":"1d"}'),
  ('rr-lp-overdue-1d', 'learning_path_overdue', 'learning_path_assignment', 1, 'day', 'after', 'in_app', false, 'active', '{"threshold":"1d_overdue"}'),
  ('rr-lp-overdue-7d', 'learning_path_overdue', 'learning_path_assignment', 7, 'day', 'after', 'in_app', false, 'active', '{"threshold":"7d_overdue"}'),
  ('rr-compliance-due-7d', 'compliance_due_soon', 'compliance_assignment', 7, 'day', 'before', 'in_app', true, 'active', '{"threshold":"7d"}'),
  ('rr-compliance-due-3d', 'compliance_due_soon', 'compliance_assignment', 3, 'day', 'before', 'in_app', true, 'active', '{"threshold":"3d"}'),
  ('rr-compliance-due-1d', 'compliance_due_soon', 'compliance_assignment', 1, 'day', 'before', 'in_app', true, 'active', '{"threshold":"1d"}'),
  ('rr-compliance-overdue-0d', 'compliance_overdue', 'compliance_assignment', 0, 'day', 'on', 'in_app', true, 'active', '{"threshold":"overdue"}'),
  ('rr-compliance-overdue-7d', 'compliance_overdue', 'compliance_assignment', 7, 'day', 'after', 'in_app', true, 'active', '{"threshold":"7d_overdue"}'),
  ('rr-cert-expiring-60d', 'certificate_expiring_60', 'certificate', 60, 'day', 'before', 'in_app', true, 'active', '{"threshold":"60d"}'),
  ('rr-cert-expiring-30d', 'certificate_expiring_30', 'certificate', 30, 'day', 'before', 'in_app', true, 'active', '{"threshold":"30d"}'),
  ('rr-cert-expiring-15d', 'certificate_expiring_15', 'certificate', 15, 'day', 'before', 'in_app', true, 'active', '{"threshold":"15d"}'),
  ('rr-cert-expiring-7d', 'certificate_expiring_7', 'certificate', 7, 'day', 'before', 'in_app', true, 'active', '{"threshold":"7d"}'),
  ('rr-cert-expired-0d', 'certificate_expired', 'certificate', 0, 'day', 'on', 'in_app', true, 'active', '{"threshold":"expired"}'),
  ('rr-session-24h', 'training_session_reminder_24h', 'training_session', 24, 'hour', 'before', 'in_app', false, 'active', '{"threshold":"24h"}'),
  ('rr-session-1h', 'training_session_reminder_1h', 'training_session', 1, 'hour', 'before', 'in_app', false, 'active', '{"threshold":"1h"}')
on conflict (id) do nothing;
