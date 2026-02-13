# Mac mini HTTPS Gallery

실서비스에 가까운 갤러리 UI + HTTPS 지원 백엔드 예제입니다.

## 1) 설치 및 실행

```bash
npm install
npm start
```

- 기본 HTTP: `http://localhost:8080`
- 인증서가 있으면 HTTPS: `https://localhost:8443` (+ 8080 -> 8443 리다이렉트)

## 2) Mac mini에서 HTTPS로 호스팅

### A. 빠른 개발용(자가 서명 인증서)

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/localhost-key.pem \
  -out certs/localhost-cert.pem \
  -days 365 \
  -subj '/CN=localhost'
npm start
```

### B. 실사용 권장(도메인 + 정식 인증서)

1. 도메인 DNS를 Mac mini 공인 IP로 연결
2. 라우터에서 80/443 포트 포워딩 설정
3. Nginx/Caddy 같은 리버스 프록시에서 TLS 종료
4. 백엔드는 내부 포트(예: `8080`)로만 실행

예시 환경 변수:

```bash
HOST=0.0.0.0 PORT=8080 HTTPS_PORT=8443 npm start
```

또는 이미 발급된 인증서 경로 지정:

```bash
SSL_CERT_PATH=/path/fullchain.pem SSL_KEY_PATH=/path/privkey.pem npm start
```

## 3) API

- `GET /api/health` : 서버 상태
- `GET /api/gallery` : 갤러리 데이터(JSON)

## 4) 구조

- `server.js` : Express 기반 정적 서빙 + HTTPS/리다이렉트
- `data/gallery.json` : 카드 데이터 소스
- `public/` : 실제 프론트엔드(HTML/CSS/JS)
