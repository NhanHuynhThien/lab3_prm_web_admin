# Nghiệp vụ TokenLedger Admin

## Mục tiêu và phạm vi

TokenLedger hỗ trợ người dùng theo dõi token và chi phí AI cá nhân. Web admin theo dõi tình trạng dịch vụ, thiết bị, nhật ký và Crashlytics. Backend cung cấp API cho web và mobile.

Web admin không còn trang Model & bảng giá và Thông báo. API model, giá và thông báo vẫn giữ nguyên ở backend để mobile không đổi luồng; hai mục bên dưới mô tả hành vi API, không phải màn hình web.

PDF chỉ nằm trong phạm vi xử lý local trên mobile; không triển khai upload cloud. Đây là thay đổi phạm vi theo yêu cầu người dùng, chưa phải xác nhận miễn yêu cầu upload của đề bài. Remote Config, Analytics và bằng chứng Android thật cần nghiệm thu ở repo mobile.

## Vai trò và quyền truy cập

| Vai trò | Quyền |
|---|---|
| Chưa đăng nhập | Chỉ kiểm tra API health |
| Người dùng đã xác minh | Xem catalog; quản lý thiết bị, inbox và phân tích của chính mình |
| Admin | Các quyền người dùng, quản lý model/giá, gửi thông báo, xem audit và báo cáo vận hành |

Firebase token phải thuộc phiên Google với email đã xác minh. Backend lấy UID từ token; admin dựa trên claim `admin: true` hoặc allowlist server. Route guard phía web chỉ hỗ trợ giao diện; API kiểm quyền độc lập.

Admin không có API liệt kê chat, ledger hoặc phân tích riêng của người dùng khác. Supabase dùng backend secret; mọi thao tác dữ liệu cá nhân phải lọc theo owner. Device token được mã hóa AES-256-GCM và không trả về giao diện quản trị.

## Model và bảng giá

- Model gồm ID, provider, tên, mô tả, trạng thái `active` / `paused` / `deprecated` và revision.
- Tạo model gửi revision `0`; cập nhật gửi revision hiện tại. Database tăng revision; dữ liệu cũ hoặc trùng ID trả `409`.
- Giá gồm model, input/output/cache rate, thời điểm hiệu lực và URL nguồn HTTPS. Đơn vị là USD micros trên một triệu token; `1 USD = 1.000.000 micros`.
- Cache rate chưa biết giữ `null`. Giá phải là số nguyên không âm trong giới hạn schema.
- Mỗi thay đổi giá tạo bản ghi mới. Cặp model/thời điểm hiệu lực là duy nhất; không tự sửa chi phí lịch sử của mobile.
- Lưu model và giá đồng thời ghi audit trong RPC.

## Thông báo

1. Mobile đăng ký thiết bị sau đăng nhập và consent. Token mới cập nhật binding; logout cần xóa binding thiết bị của owner.
2. Admin soạn tiêu đề/nội dung, chọn thiết bị của mình hoặc tất cả thiết bị đăng ký. Đích mở app chỉ gồm `overview`, `accounts`, `analytics`, `profile`.
3. Preview trả số thiết bị, không gửi. Tối đa 500 thiết bị/lượt; không có thiết bị thì không tạo job gửi.
4. Gửi thật yêu cầu `confirmation: "SEND"` và UUID `requestId`. Cùng ID, actor và nội dung trả job cũ sau bước kiểm tra thiết bị; nội dung hoặc actor khác trả `409` khi tới bước claim job.
5. Backend gửi FCM, đếm accepted/failed, xóa token không hợp lệ và ghi audit. Job kết thúc ở `accepted`, `partial` hoặc `failed`; `sending` cần đối chiếu nếu lượt xử lý bị gián đoạn.
6. Inbox được lưu cho owner có ít nhất một thiết bị được FCM chấp nhận. Chỉ owner được đọc hoặc đánh dấu đã đọc.

FCM accepted chưa chứng minh đã hiển thị hoặc đã đọc. Mobile cần xử lý foreground/background/terminated, token rotation và tap route. Retry tự động có backoff và khôi phục job gián đoạn chưa được triển khai.

## Phân tích Gemini

- Chỉ chạy khi người dùng chủ động gửi aggregate có `consent: true`; schema từ chối trường ngoài hợp đồng, gồm nội dung chat tùy ý.
- Aggregate gồm kỳ phân tích, token, chi phí có thể chưa biết, nguồn, phân bổ mục đích và tùy chọn coverage/chi tiết. Tổng và phân bổ phải khớp; kỳ tối đa 366 ngày.
- Số liệu là aggregate phía client cung cấp, chưa phải ledger/hóa đơn đã được backend đối soát. Gemini diễn giải số liệu; dữ liệu thiếu giữ là chưa biết.
- Database giữ chỗ theo UID trước khi gọi model, giới hạn mặc định 10 lượt/ngày UTC, gồm cả lượt đã giữ chỗ nhưng thất bại. Endpoint giới hạn thêm 5 yêu cầu/phút theo cấu hình rate limit của Fastify.
- Phản hồi được kiểm tra JSON schema, lưu lịch sử theo owner, model, usage metadata và request latency. Bỏ phần thought text khi đọc phản hồi.
- Token usage thiếu giữ `null`; `costEstimateMicros` và `billedCostMicros` hiện đều `null`. Latency không phải thời gian làm việc hay GPU time.
- Có xử lý timeout, quota, model không khả dụng và lỗi dịch vụ. Hủy yêu cầu từ mobile và chính sách retention cần nghiệm thu/bổ sung.

## Tổng quan và Crashlytics

Tổng quan hiển thị số thiết bị, số dịch vụ đã cấu hình và audit từ database. Trạng thái dịch vụ và thông tin dự án nằm ngay trong Tổng quan (trang Hệ thống cũ chuyển hướng về đây); `configured` không đảm bảo kết nối đã được xác minh.

Code hiện có màn Crashlytics và backend reader gọi Reports API `v1alpha`. Reader chọn kỳ 7 hoặc 30 ngày, cache 60 giây và chỉ lấy 25 nhóm đầu. Khi còn trang sau, các tổng trên UI chỉ áp dụng dữ liệu đã tải.

Reader chỉ trả các trường vận hành được chọn, lọc email/credential theo quy tắc trong code, giữ khác biệt giữa số 0 và chưa biết. Chưa bật thì trả trạng thái chưa cấu hình; lỗi quyền/kết nối phải hiển thị lỗi thay vì số liệu giả. Cần xác minh quyền, hợp đồng phản hồi và số liệu thật trước nghiệm thu.

## Dữ liệu và hợp đồng API

Migration vận hành gồm `tl_models`, `tl_prices`, `tl_devices`, `tl_jobs`, `tl_inbox`, `tl_audit`, `tl_analyses`. Dữ liệu cá nhân gốc của mobile tiếp tục ở Firestore.

| Nhóm | Endpoint chính |
|---|---|
| Phiên và catalog | `GET /health`, `GET /v1/session`, `GET /v1/catalog` |
| Quản trị | `GET /v1/admin/status`, `GET /v1/admin/audit`, `POST /v1/admin/models`, `POST /v1/admin/prices` |
| Thông báo admin | `GET/POST /v1/admin/notification-jobs`, `POST /v1/admin/notification-jobs/preview` |
| Thiết bị và inbox | `PUT/DELETE /v1/me/devices/:id`, `GET /v1/me/notifications`, `POST /v1/me/notifications/:id/read` |
| Phân tích cá nhân | `GET/POST /v1/me/analyses` |
| Crashlytics | `GET /v1/admin/crashlytics?days=7` hoặc `days=30`, tùy chọn `report` |

Schema chi tiết nằm ở [schemas.ts](../api/src/schemas.ts), route ở [app.ts](../api/src/app.ts), quy tắc database ở [migration](../supabase/migrations/001_operations.sql). Khi thay đổi chức năng, cập nhật tài liệu này và checklist tương ứng.
