-- ============================================================
-- MyKIS Learning — Seed Data (Development / Preview only)
-- DO NOT run on Production automatically
-- ============================================================
-- NOTE: auth.users entries are created via Supabase Auth Admin API
-- or Supabase Dashboard. Only profile data is seeded here.
-- The auth.users UUIDs below are placeholders — replace with
-- actual UUIDs after creating accounts in Supabase Auth.
-- ============================================================

-- Demo HR account (replace UUID after creating in Supabase Auth)
-- Email: thanh.ntc@kisvn.vn  Password: set via Supabase Dashboard
-- insert into public.profiles (id, employee_code, full_name, email, role, department_id, position, account_status)
-- values ('00000000-0000-0000-0000-000000000001', 'HR001', 'Nguyễn Thị Cẩm Thanh', 'thanh.ntc@kisvn.vn', 'hr', null, 'HR Manager', 'active');

-- Demo Employee (replace UUID after creating in Supabase Auth)
-- Email: an.nguyen@kisvn.vn  Password: set via Supabase Dashboard
-- insert into public.profiles (id, employee_code, full_name, email, role, department_id, position, account_status)
-- values ('00000000-0000-0000-0000-000000000002', 'EMP001', 'Nguyễn Văn An', 'an.nguyen@kisvn.vn', 'employee', null, 'Môi giới chứng khoán', 'active');

-- Departments
insert into public.departments (id, name, code) values
  ('d1000000-0000-0000-0000-000000000001', 'Nhân sự', 'HR'),
  ('d1000000-0000-0000-0000-000000000002', 'Môi giới', 'BROKER'),
  ('d1000000-0000-0000-0000-000000000003', 'Phát triển kinh doanh', 'BD'),
  ('d1000000-0000-0000-0000-000000000004', 'Công nghệ thông tin', 'IT'),
  ('d1000000-0000-0000-0000-000000000005', 'Tài chính kế toán', 'FA'),
  ('d1000000-0000-0000-0000-000000000006', 'Tuân thủ & Pháp chế', 'LEGAL')
on conflict (id) do nothing;

-- Course categories
insert into public.course_categories (id, name, slug, sort_order) values
  ('c1000000-0000-0000-0000-000000000001', 'Onboarding', 'onboarding', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Kỹ năng mềm', 'soft-skills', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Chứng khoán & Tài chính', 'securities', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Tuân thủ', 'compliance', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Lãnh đạo', 'leadership', 5)
on conflict (id) do nothing;

-- Sample course
insert into public.courses (id, title, description, category_id, status, format) values
  ('e1000000-0000-0000-0000-000000000001',
   'Hướng dẫn nhân viên mới — KIS Vietnam',
   'Chương trình onboarding dành cho nhân viên mới gia nhập KIS Việt Nam.',
   'c1000000-0000-0000-0000-000000000001',
   'published',
   'blended')
on conflict (id) do nothing;
