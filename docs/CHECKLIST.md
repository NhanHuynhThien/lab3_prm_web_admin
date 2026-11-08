# Checklist triển khai và nghiệm thu

Cập nhật: 04/11/2026. `[x]` có source hoặc kết quả kiểm tra tương ứng; các mục triển khai không thay thế nghiệm thu dịch vụ thật. `[ ]` chưa có bằng chứng nghiệm thu trong lần rà soát này.

## Đã có trong source

- [x] Web Next.js/shadcn/ui: login, tổng quan (gồm trạng thái dịch vụ, `/system` chuyển hướng về `/`) và Crashlytics; điều hướng dưới màn hình trên điện thoại. Model/giá và thông báo chỉ còn ở API.
- [x] Firebase verified identity; kiểm quyền admin và owner ở API.
- [x] Supabase migration: 7 bảng bật RLS, 6 RPC, client không có quyền bảng/RPC.
- [x] Model revision và bảng giá theo phiên bản, audit, xử lý conflict.
- [x] Device token mã hóa, notification preview, SEND, UUID idempotency, job và inbox.
- [x] Gemini aggregate consent, validation, daily cap, usage và lịch sử theo owner.
- [x] Crashlytics reader, lọc trường phản hồi, unknown/zero, trạng thái chưa cấu hình.
- [x] CORS allowlist, body/rate/time limits và thông báo lỗi không trả secret upstream.
- [x] Git ignore env/credential/build; GitHub Actions có format, test, build và audit.

## Kiểm tra local ngày 04/11/2026

| Lệnh | Kết quả | Phạm vi |
|---|---|---|
| `npm run check` | Pass | Cấu hình hiện diện, PDF upload tắt, identity/project/quyền file hợp lệ theo preflight; không gọi mạng |
| `npm run format:check` | Pass | Source API/test và TS/TSX/CSS web |
| `npm test` | 12/12 pass | Auth/admin/owner, notification preview, aggregate/giá, Gemini và Crashlytics dùng dữ liệu/dependency kiểm thử |
| `npm run build` | Pass | TypeScript API và Next.js production build |

Lần rà soát này không chạy lại live DB QA, `verify:services`, generation, push thật hoặc audit dependency. Tài liệu setup trước đây ghi nhận live DB QA, Gemini model-list và FCM `validate_only` đã pass; đây là kết quả lịch sử, cần chạy lại khi cấu hình thay đổi. Trạng thái project, IAM, quota và CI remote chưa được xác minh lại.

## Nghiệm thu chức năng

- [ ] Google login với session thật; UID được cấp admin vào workspace, tài khoản thường bị chặn.
- [ ] Model: tạo/sửa/reload; hai phiên cập nhật cùng revision phải conflict, dữ liệu vẫn đúng.
- [ ] Giá: kiểm nguồn/thời điểm, trùng phiên bản trả `409`, chi phí lịch sử không đổi.
- [ ] Browser QA: loading/empty/error, retry, responsive, bàn phím/focus và reduced motion.
- [ ] Live DB QA: revision đồng thời, unique price, mã hóa token, owner isolation, job idempotency và daily cap; chỉ dọn dữ liệu của lượt QA.
- [ ] Mobile nối catalog, đăng ký/xóa thiết bị, inbox/read và Gemini API của backend này.
- [ ] Android thật: consent, token rotation, nhiều thiết bị, logout; nhận foreground/background/terminated và tap đúng route sau đăng nhập.
- [ ] FCM thật: preview không gửi, gửi có xác nhận, accepted/failed/inbox khớp; token lỗi được dọn.
- [ ] Hoàn thiện retry/backoff và đối chiếu job `sending` bị gián đoạn trước khi vận hành cần độ tin cậy cao.
- [ ] Gemini thật với aggregate QA: JSON/usage đúng, quota/timeout có lỗi phù hợp, dữ liệu thiếu không biến thành số 0/hóa đơn.
- [ ] Kiểm tra hủy yêu cầu từ mobile và chốt retention cho lịch sử phân tích/inbox/audit.
- [ ] Crashlytics thật: xác minh API/IAM/response, đối chiếu Firebase Console, kỳ 7/30 ngày, unknown/zero và giới hạn trang.
- [ ] Android thật: fatal/non-fatal xuất hiện trên Console; Remote Config publish có hiệu lực và Analytics DebugView ghi đúng event.
- [ ] Mobile: giữ PDF local mở được và bỏ/ẩn upload cloud; ghi rõ ngoại lệ phạm vi so với đề bài.

## Bàn giao

- [ ] Chạy lại kiểm tra local sau thay đổi source; ghi kết quả và lỗi còn tồn tại vào checklist này.
- [ ] Chạy `npm audit --audit-level=high` và kiểm tra kết quả GitHub Actions trên commit bàn giao.
- [ ] Kiểm tra candidate commit/frontend bundle không chứa env, server secret, private key hoặc device token.
- [ ] Chuẩn bị evidence Android thật, video/slide giải thích client/server, auth, FCM, giá, Gemini và Crashlytics; đối chiếu checklist mobile tại `../../lab3_prm/TASKS.md` nếu file còn tồn tại.
- [ ] Nếu triển khai production: chốt host/HTTPS, cách bind backend qua hạ tầng phù hợp, secret store và origin allowlist. Cấu hình hiện tại chỉ phục vụ loopback local.

Hướng dẫn chạy/cấu hình nằm ở [README](../README.md); quy tắc chức năng nằm ở [nghiệp vụ](NGHIEP_VU.md). Duy trì ba tài liệu này; giữ `admin/AGENTS.md` do Next.js quản lý.
