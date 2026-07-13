# MyKIS Learning — Product & UX autonomous audit

Ngày audit: 2026-07-13

## Audit summary

### Must fix

- Course delete trước đây gọi `force=true` ngay từ row action, không có confirmation và có thể xóa enrollment, progress, content và version liên quan.
- `/admin/courses` thiếu row checkbox, Select all, selection count và batch action.
- Employee directory có department filter nhưng chưa có Select all theo kết quả filter và chưa nối selection vào assignment flow.
- Course assignment có bulk UI nhưng local assignment được tạo trước khi xác nhận persistence API; đây là rủi ro “trông như đã lưu”.
- Cần giữ rõ empty/loading/error state và không reset selection sai ngữ cảnh khi filter thay đổi.

### Should improve

- Dashboard Admin cần tiếp tục rà soát KPI thật, time filter và drill-down.
- Learner dashboard cần kiểm tra hierarchy “cần làm ngay / đang học / sắp tới / hoàn thành” trên production viewport.
- Live Training và course player cần visual smoke test ở 390×844, 768×1024 và 1440×900.
- Tách microcopy destructive action khỏi các nút outline thông thường để giảm nhầm lẫn.

### Keep as-is

- Live Training đã có bulk complete, roster và flow persistence riêng; không thay đổi trong pass này.
- Existing course detail/content builder và navigation shell giữ nguyên để tránh regression.
- Employee creation pending state và retry flow giữ nguyên vì đã có feedback và retry.

### Removed/deprecated

- Không xóa UI legacy trong pass này vì chưa đủ bằng chứng về mức sử dụng production.

## Implemented

### Admin / Courses

- Thêm checkbox từng khóa, Select all theo các khóa đang hiển thị, indeterminate state, count và bulk action bar.
- Bulk delete dùng một request `POST /api/courses/bulk`.
- Confirmation hiển thị số lượng và tên một số khóa đầu.
- Backend trả kết quả từng record. Course có dependency được archive; course không có dependency mới hard-delete.
- Single delete cũng đi qua flow confirm + safe batch API.

### Employees

- Select all chọn toàn bộ nhân viên thuộc kết quả filter hiện tại, gồm nhiều trang.
- Đổi filter sẽ clear selection để không giữ selection sai ngữ cảnh.
- Action bar cho phép mở bulk assignment với số nhân viên đã chọn.

### Backend/data

- Batch course endpoint có authorization HR, dependency check, partial failure result và audit log.
- Không thêm migration hoặc thay đổi schema.

## Deferred

- Bulk publish/archive/restore UI cho course: cần thống nhất business rule về version hiện hành và learner visibility.
- Bulk employee reminder/status/export: cần xác nhận action nào được HR phê duyệt và endpoint tương ứng.
- Hardening assignment flow để chờ API response trước khi cập nhật local state: cần test production response shape và local fallback hiện có.
- Dashboard/learner visual audit đầy đủ: cần browser session có dữ liệu đại diện để kiểm tra end-to-end, không suy đoán từ static markup.

## Verification

- Source syntax: `node --check app.js`, `node --check worker/router.js`, `node --check worker/routes/courses.js`.
- Build/smoke: chạy sau khi hoàn tất diff.
- Migration: không chạy migration.
- Deploy: chỉ thực hiện sau build và smoke pass.
