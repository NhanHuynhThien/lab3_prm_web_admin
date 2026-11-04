# TokenLedger Admin

Web quản trị TokenLedger dùng Next.js App Router, shadcn/ui và TypeScript. Backend Fastify xác minh Firebase ID token, gọi FCM/Gemini và lưu dữ liệu vận hành trên Supabase PostgreSQL. Mobile nằm ở repo riêng: [lab3_prm](https://github.com/NhanHuynhThien/lab3_prm).

## Tài liệu

- [Nghiệp vụ](docs/NGHIEP_VU.md): phạm vi, phân quyền và quy tắc chức năng.
- [Checklist](docs/CHECKLIST.md): kết quả kiểm tra, nghiệm thu và bàn giao.
- [Hướng dẫn cho agent](admin/AGENTS.md): quy ước do Next.js quản lý, giữ phục vụ phát triển.

## Cấu trúc

```text
admin/       Giao diện quản trị, Google login, design tokens
api/         Fastify API, Firebase identity/FCM, Gemini, Crashlytics reader
supabase/    SQL migration, RLS và RPC
scripts/     Kiểm tra cấu hình và kết nối dịch vụ
docs/        Nghiệp vụ và checklist nghiệm thu
```

## Chạy local

Yêu cầu Node.js >= 22.13 và npm. Chỉ dùng hai file cấu hình `admin/.env`, `api/.env`; không tạo thêm `.env.local` hoặc `.env.example`. Env và `api/credentials/` đã được Git ignore. Đặt quyền file env/credential là `600`, thư mục credential là `700`.

```sh
npm ci
npm run check
npm run dev
```

Web: [http://127.0.0.1:5173](http://127.0.0.1:5173). API: [http://127.0.0.1:8788/health](http://127.0.0.1:8788/health). `npm run dev` khởi chạy cả hai; Next.js dùng Webpack.

### Cấu hình web — admin/.env

| Biến | Giá trị / ý nghĩa |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:8788` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase public client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |

Các biến trên được bundle vào web. Secret Supabase/Gemini, private key và device token chỉ dùng ở backend. Hostname web cần nằm trong Firebase authorized domains.

### Cấu hình backend — api/.env

| Biến | Giá trị / ý nghĩa |
|---|---|
| `HOST` / `PORT` | Mặc định `127.0.0.1` / `8788`; chỉ bind loopback |
| `FIREBASE_PROJECT_ID` | Firebase project dùng chung với mobile và web |
| `GOOGLE_APPLICATION_CREDENTIALS` | Đường dẫn tính từ `api/`, ví dụ `credentials/firebase-fcm-dev.json` |
| `ADMIN_UIDS` | Danh sách UID được cấp admin, phân cách bằng dấu phẩy; mặc định rỗng |
| `ADMIN_ALLOWED_ORIGINS` | Đặt `http://127.0.0.1:5173,http://localhost:5173` cho local |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | URL project / secret backend |
| `DEVICE_ENCRYPTION_KEY` | 32 byte hex, gồm 64 ký tự thường; giữ ổn định để giải mã device token |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Key backend / model ID đã kiểm tra khả dụng; model không có mặc định |
| `GEMINI_ENABLED` / `FCM_ENABLED` | `true` để bật chức năng; mặc định `false` |
| `CRASHLYTICS_ENABLED` | Bật reader báo cáo; mặc định `false` |
| `FIREBASE_ANDROID_APP_ID` | Firebase app ID Android dùng cho Crashlytics reader |
| `AI_MAX_REQUESTS_PER_USER_DAY` | Mặc định `10`, giới hạn theo ngày UTC |
| `AI_MAX_OUTPUT_TOKENS` / `AI_TIMEOUT_MS` | Mặc định `1024` / `30000` |
| `PDF_UPLOAD_ENABLED` | Đặt `false` theo yêu cầu preflight; PDF thuộc phạm vi local trên mobile |

Code kiểm identity credential là `tokenledger-fcm-dev@<FIREBASE_PROJECT_ID>.iam.gserviceaccount.com` và đúng project. Admin được xác định bằng custom claim `admin: true` hoặc UID allowlist server. FCM và Crashlytics cần quyền dịch vụ tương ứng; đã có credential không đồng nghĩa đọc/gửi thành công.

## Database

Chạy [001_operations.sql](supabase/migrations/001_operations.sql) trong SQL Editor của đúng Supabase project. Migration tạo 7 bảng và 6 RPC, bật RLS, thu hồi quyền bảng/RPC của client. Browser chỉ gọi API; API kiểm quyền và owner trước khi dùng backend secret. Account/usage của mobile vẫn ở Firestore.

## Kiểm tra và build

```sh
npm run check
npm run format:check
npm test
npm run build
```

`check` chỉ kiểm tra cấu hình local, không gọi mạng. Unit test dùng dependency thay thế, không gửi push hoặc gọi model thật. Sau build, chạy hai lệnh sau ở hai terminal:

```sh
npm run start --workspace @tokenledger/api
npm run start --workspace @tokenledger/admin
```

Các lệnh kiểm tra dịch vụ thật chạy riêng khi cần:

```sh
npm run verify:services
npm run test:db --workspace @tokenledger/api
```

`verify:services` list model và gọi FCM `validate_only`, không sinh nội dung hoặc gửi push thật. `test:db` tạo dữ liệu QA trong database đã cấu hình và dọn các bản ghi của lượt chạy. Trạng thái nghiệm thu được ghi tại [checklist](docs/CHECKLIST.md).
