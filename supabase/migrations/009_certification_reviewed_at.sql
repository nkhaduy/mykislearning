-- Add review timestamp for certificate approval workflow.
alter table public.employee_certifications add column if not exists reviewed_at timestamptz;
