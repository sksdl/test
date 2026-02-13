# Mac mini HTTPS Gallery

운영 가능한 갤러리 서비스 예제입니다.

- ✅ HTTPS 지원 + HTTP→HTTPS 리다이렉트
- ✅ 익명 닉네임 업로드 + 4자리 비밀번호 기반 삭제
- ✅ 관리자 로그인 토큰으로 전체 삭제 및 관리자 삭제
- ✅ 드래그&드롭 업로드, 진행률, 모달, 검색/정렬

## 실행

```bash
npm install
ADMIN_TOKEN='my-secure-token' npm start
```

## API

- `GET /api/health`
- `GET /api/gallery`
- `GET /api/admin/verify` (header: `x-admin-token`)
- `POST /api/gallery/upload` (multipart/form-data)
  - fields: `image`, `title`, `category`, `description`, `nickname`, `pin`
  - `pin`은 4자리 숫자
  - 제한: JPEG/PNG/WEBP, 최대 8MB
- `DELETE /api/gallery/:id`
  - 일반 사용자: JSON body `{ "nickname": "...", "pin": "1234" }`
  - 관리자: header `x-admin-token`
- `DELETE /api/gallery`
  - 관리자만 전체 삭제 가능 (`x-admin-token`)

## 보안/업로드 설계

- 파일 타입 제한: MIME 검사
- 파일 크기 제한: 8MB
- 파일명 안전화: 서버 UUID 재발급
- 업로드 폴더 분리: `/uploads`
- 삭제 비밀번호 저장: 해시(SHA-256)
- 관리자 접근 보호: `x-admin-token`
