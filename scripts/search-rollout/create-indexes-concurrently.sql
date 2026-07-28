-- Run each statement separately, outside a transaction.
create index concurrently if not exists profiles_search_document_trgm_idx
  on public.profiles using gin (employee_search_document gin_trgm_ops);
create index concurrently if not exists profiles_status_name_cursor_idx
  on public.profiles (account_status, employee_sort_name, id)
  include (employee_code, email, department, position, location, manager_name, updated_at);
create index concurrently if not exists profiles_department_status_name_cursor_idx
  on public.profiles (department, account_status, employee_sort_name, id);
create index concurrently if not exists profiles_employee_code_prefix_idx
  on public.profiles (public.kis_search_normalize(employee_code) text_pattern_ops);
create index concurrently if not exists profiles_email_prefix_idx
  on public.profiles (public.kis_search_normalize(email) text_pattern_ops);
create index concurrently if not exists profiles_full_name_prefix_idx
  on public.profiles (public.kis_search_normalize(full_name) text_pattern_ops);
