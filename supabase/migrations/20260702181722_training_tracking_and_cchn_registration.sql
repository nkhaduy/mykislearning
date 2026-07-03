-- Training Tracking Records
create table if not exists public.training_tracking_records (
  id uuid not null default gen_random_uuid() primary key,
  employee_id uuid,
  employee_name text not null,
  position_title text not null,
  department text not null,
  training_name text not null,
  purpose_and_job_relevance text not null,
  training_provider text not null,
  training_category text not null,
  start_date date,
  end_date date,
  study_format text,
  total_cost_vnd numeric,
  status text not null default 'not_updated' check (status in ('not_updated','planned','in_progress','completed','cancelled')),
  notes text,
  source_key text unique,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_tracking_employee on public.training_tracking_records(employee_id);
create index if not exists idx_training_tracking_department on public.training_tracking_records(department);
create index if not exists idx_training_tracking_status on public.training_tracking_records(status);
create index if not exists idx_training_tracking_start_date on public.training_tracking_records(start_date);
create index if not exists idx_training_tracking_end_date on public.training_tracking_records(end_date);

-- CCHN Catalog Items
create table if not exists public.cchn_catalog_items (
  id uuid not null default gen_random_uuid() primary key,
  item_group text not null check (item_group in ('subject','fee','reimbursement','other')),
  label_vi text not null,
  label_en text,
  color_token text,
  is_custom boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_cchn_catalog_item_group_label on public.cchn_catalog_items(item_group, lower(label_vi));

-- CCHN Registrations
create table if not exists public.cchn_registrations (
  id uuid not null default gen_random_uuid() primary key,
  employee_id uuid,
  employee_name text not null,
  position_title text,
  department text,
  registration_date date,
  planned_training_date date,
  planned_exam_date date,
  study_format text,
  status text not null default 'draft' check (status in ('draft','registered','approved','studying','completed','cancelled')),
  total_cost_vnd numeric,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cchn_registrations_employee on public.cchn_registrations(employee_id);
create index if not exists idx_cchn_registrations_department on public.cchn_registrations(department);
create index if not exists idx_cchn_registrations_status on public.cchn_registrations(status);

-- CCHN Registration Items (join table)
create table if not exists public.cchn_registration_items (
  id uuid not null default gen_random_uuid() primary key,
  registration_id uuid not null references public.cchn_registrations(id) on delete cascade,
  catalog_item_id uuid not null references public.cchn_catalog_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (registration_id, catalog_item_id)
);

-- Updated-at trigger function (if not already created)
create or replace function public.set_training_tracking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers
drop trigger if exists trg_training_tracking_records_updated_at on public.training_tracking_records;
create trigger trg_training_tracking_records_updated_at before update on public.training_tracking_records for each row execute function public.set_training_tracking_updated_at();

drop trigger if exists trg_cchn_catalog_items_updated_at on public.cchn_catalog_items;
create trigger trg_cchn_catalog_items_updated_at before update on public.cchn_catalog_items for each row execute function public.set_training_tracking_updated_at();

drop trigger if exists trg_cchn_registrations_updated_at on public.cchn_registrations;
create trigger trg_cchn_registrations_updated_at before update on public.cchn_registrations for each row execute function public.set_training_tracking_updated_at();

-- RLS
alter table public.training_tracking_records enable row level security;
alter table public.cchn_catalog_items enable row level security;
alter table public.cchn_registrations enable row level security;
alter table public.cchn_registration_items enable row level security;

drop policy if exists deny_anon_training_tracking_records on public.training_tracking_records;
drop policy if exists deny_anon_cchn_catalog_items on public.cchn_catalog_items;
drop policy if exists deny_anon_cchn_registrations on public.cchn_registrations;
drop policy if exists deny_anon_cchn_registration_items on public.cchn_registration_items;

create policy deny_anon_training_tracking_records on public.training_tracking_records for all to anon, authenticated using (false) with check (false);
create policy deny_anon_cchn_catalog_items on public.cchn_catalog_items for all to anon, authenticated using (false) with check (false);
create policy deny_anon_cchn_registrations on public.cchn_registrations for all to anon, authenticated using (false) with check (false);
create policy deny_anon_cchn_registration_items on public.cchn_registration_items for all to anon, authenticated using (false) with check (false);

-- Seed training tracking records
insert into public.training_tracking_records (employee_name, position_title, department, training_name, purpose_and_job_relevance, training_provider, training_category, start_date, end_date, study_format, total_cost_vnd, status, source_key, created_by) values
('Lương Ngọc Hiền', 'Associate', 'Legal', 'Legal English', 'Nâng cao trình độ tiếng anh chuyên môn, thêm từ vựng chuyên ngành.\nKhoá đào tạo phù hợp với vai trò và mục đích phục vụ cho công việc.', 'Trường ĐH Luật TP.HCM', 'Ngoại ngữ', '2026-06-22', '2026-08-14', null, 5000000, 'not_updated', 'seed-2026-luong-ngoc-hien-legal-english', '00000000-0000-0000-0000-000000000000'),
('Phan Thị Như Quỳnh', 'Associate', 'Kế toán', 'Business English', 'Nâng cao trình độ tiếng anh giao tiếp cho công việc.\nKhoá học sẽ hợp lý hơn nếu học chuyên sâu về Tiếng Anh kế toán. Các khoá học tại Kyna English thường thiên hướng về giao tiếp nhiều hơn.', 'CÔNG TY CỔ PHẦN DREAM VIET EDUCATION - KYNA ENGLISH', 'Ngoại ngữ', '2026-05-18', '2026-09-18', 'Online', 4920000, 'not_updated', 'seed-2026-phan-thi-nhu-quynh-business-english', '00000000-0000-0000-0000-000000000000'),
('Vũ Phi Hùng', 'Assistant Manager', 'MKT', 'Thạc sỹ Quản trị Kinh doanh - Hệ Điều hành cao cấp - Hướng Ứng dụng', 'Nâng cao năng lực quản lý chiến lược và tổ chức, bao gồm xây dựng chiến lược, quản trị nguồn nhân lực, kiểm soát chi phí và quản lý dự án. Tăng cường khả năng xây dựng mối quan hệ hợp tác và triển khai các sáng kiến mới nhằm đóng góp vào sự phát triển của công ty.\nKhoá học phù hợp với vị trí công việc hiện tại và sẽ nâng cao năng lực quản lý cho nhân viên.', 'Đại học Kinh tế TP. HCM', 'Nghiệp vụ', null, null, 'Full-time', 10000000, 'not_updated', 'seed-2026-vu-phi-hung-emba', '00000000-0000-0000-0000-000000000000')
on conflict (source_key) do nothing;

-- Seed CCHN catalog items
insert into public.cchn_catalog_items (item_group, label_vi, label_en, color_token, is_custom, created_by, status) values
('subject', 'Những vấn đề cơ bản về chứng khoán và thị trường chứng khoán', 'Basic of securities & Stock market', 'blue', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Môi giới và tư vấn đầu tư chứng khoán', 'Brokerage and Investment advisory', 'teal', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Pháp luật về chứng khoán và thị trường chứng khoán', 'Law of securities & Stock market', 'purple', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Phân tích và đầu tư chứng khoán', 'Analysis and Investment Securities', 'green', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Tư vấn tài chính và bảo lãnh phát hành', 'Financial Consulting & Underwriting', 'orange', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Phân tích báo cáo tài chính doanh nghiệp', 'Analyzing Financial Statements Business', 'pink', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Quản lý quỹ và tài sản', 'Fund and Asset Management', 'indigo', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Chứng khoán phái sinh', 'Derivatives Securities', 'red', false, '00000000-0000-0000-0000-000000000000', 'active'),
('subject', 'Hệ thống công cụ nợ, TPCP và TPDNRL', null, 'cyan', false, '00000000-0000-0000-0000-000000000000', 'active'),
('fee', 'Chi phí cấp CCHN', null, 'amber', false, '00000000-0000-0000-0000-000000000000', 'active'),
('reimbursement', 'Hoàn tiền đào tạo do nghỉ việc trong thời gian cam kết', null, 'slate', false, '00000000-0000-0000-0000-000000000000', 'active')
on conflict (item_group, lower(label_vi)) do nothing;
