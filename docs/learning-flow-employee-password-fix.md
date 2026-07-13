# Learning Flow, Employee UX, Bulk Action & Password Reset audit

Ngày: 2026-07-13

## Learning path

- UI cũ của learner detail render các bước như list row, nên thứ tự, node hiện tại và điều kiện khóa chưa tạo thành một hành trình.
- Đã đổi learner detail thành timeline/flow dùng dữ liệu thật từ `steps`, `position`, `computed_status`, prerequisite và `progress_percent`.
- Desktop dùng node + connector xuyên suốt, state completed/current/available/locked có semantic color và CTA riêng.
- Mobile chuyển thành vertical timeline, không ép horizontal scroll.
- Không đổi route, schema hoặc API; F5 vẫn lấy lại trạng thái từ `/api/learning-paths/my/:assignmentId`.

## Employees

- Page hierarchy được làm rõ: tiêu đề/mô tả, quick actions, summary, filter/search, bulk bar, table.
- Thêm clear filter, count kết quả hiện tại, “Thêm thao tác” cho Import ảnh/sort, hover row và mobile table scroll có kiểm soát.
- Reset password modal được mount thật trên `/admin/employees`, dùng profile từ API khi có để không phụ thuộc mock account cache.
- Error reset giữ modal mở, hiển thị mã/lý do cụ thể và cho retry.

## Course bulk action

- Root cause là async bulk action chỉ render vùng bảng ở nhánh cuối, trong khi `dialogState`/body modal state được quản lý ở full render; partial/error branch dễ giữ loading/overlay stale.
- Đã chuyển start/finally sang full `render()`, giữ selection của record thất bại, clear record đã xử lý và hiển thị summary xóa/archive/error.

## Password reset

- Production schema hiện là custom `profiles` password storage (`password_status`, fallback `avatar_url` với PBKDF2), không có `auth_user_id` hoặc Supabase Auth Admin linkage.
- Flow đúng là profile ID → hash PBKDF2 → ghi `password_status` hoặc fallback `avatar_url` → active/unlock → audit.
- Backend trả rõ lookup/write/status errors; không log plaintext password.
- Production test: valid test profile trả 200; missing profile trả 404 `ACCOUNT_NOT_FOUND`.

## Deferred

- Không thêm Supabase Auth Admin mapping vì không tồn tại trong data model hiện tại.
- Không chạy full Phase 1–9 regression; chỉ smoke các route và flow liên quan.
