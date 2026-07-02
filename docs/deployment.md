# Deployment

Để deploy tự động:

```bash
bash scripts/deploy-production.sh
```

Script đọc secrets từ `MYKIS_DEPLOY_ENV` hoặc `~/.config/mykis/deploy.env`, chạy Supabase migration dry-run/apply, build, deploy Cloudflare Worker, rồi chạy production smoke tests.

Mặc định script dùng `SUPABASE_MIGRATION_TRANSPORT=auto`: thử Supabase Management Migration API qua HTTPS trước, không yêu cầu máy local kết nối trực tiếp PostgreSQL port 5432. Có thể đặt `SUPABASE_MIGRATION_TRANSPORT=postgres` khi chạy ở mạng cho phép kết nối database trực tiếp.
