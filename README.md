# dortory · 도토리

서천에서 일하는 외국인노동자의 주거·통근 상담과 입주 행정 업무를 지원하는 웹 서비스입니다. 랜딩 페이지, 지도 중심 대시보드, 상담·서류 처리 화면과 서버 소스를 함께 관리합니다.

## 팀원 시작하기

GitHub 계정에 저장소 접근 권한을 받은 뒤 코드를 내려받습니다.

```bash
git clone https://github.com/silv06/dortory.git
cd dortory
git switch -c feature/my-task
```

작업을 마치면 브랜치를 올리고 Pull Request에서 변경 내용을 검토합니다.

```bash
git add <수정한 파일>
git commit -m "변경 내용 설명"
git push -u origin feature/my-task
```

## 프로젝트 구조

| 경로 | 역할 |
| --- | --- |
| `site/index.html` | 랜딩 페이지와 대시보드 진입점 |
| `site/styles.css`, `site/layout.css`, `site/rag.css` | 공통 스타일과 화면 배치 |
| `site/app.js`, `site/views.js`, `site/dashboard.js` | 화면 전환과 상담·주거 매칭 UI |
| `site/map.js` | 지도 표식과 주거·통근 경로 |
| `site/workspace.js`, `site/admin-log.js` | 서버 연동과 관리자 활동 로그 |
| `site/forms*.js`, `site/field-intake.js`, `site/aftercare.js` | 서식 작성·PDF 출력·현장 접수·입주 후 관리 |
| `site/assets`, `site/forms`, `site/vendor` | 로고·지도·글꼴, PDF 서식과 라이브러리 |
| `worker` | 상담 저장·관리자 인증·자료 검색·메일 발송 서버 코드 |
| `drizzle` | D1 데이터베이스 마이그레이션 |
| `scripts` | Worker 빌드와 Vercel 소스 준비 |
| `deployment/vercel` | Vercel API 게이트웨이와 Google 로그인 |
| `.openai/hosting.json` | 기존 Sites Worker 프로젝트 연결 정보 |

## 화면 미리보기

Python 3가 설치된 환경에서 저장소 루트에 아래 명령을 실행합니다.

```bash
python -m http.server 8000 --directory site
```

브라우저에서 `http://localhost:8000`을 엽니다. 이 명령은 화면 파일을 제공합니다. 로그인·상담 저장·관리자 업무·자료 검색·메일 발송에는 아래 서버 연결이 필요합니다.

## Worker 빌드

Node.js 22 환경에서 실행합니다.

```bash
npm run build
```

`scripts/build.mjs`가 화면 파일, 검색용 공개 자료와 서버 소스를 결합해 `dist/server/index.js`를 생성합니다. 데이터베이스 스키마와 Sites 연결 설정도 빌드 디렉터리에 복사합니다.

## 서버와 인증 연결

현재 구성은 Vercel에서 공개 화면과 Google OAuth를 제공하고, Sites Worker와 D1에서 상담·주택 대장·세션·활동 로그·메일 발송 상태를 관리합니다. Worker의 데이터베이스 바인딩 이름은 `DB`이며, 스키마는 `drizzle`의 마이그레이션 순서대로 적용합니다.

환경변수 이름은 `.env.example`에 정리돼 있습니다. 각 배포 환경의 설정 화면에 값을 등록합니다. Vercel과 Worker의 `DORTORY_VERCEL_SECRET`은 같은 값으로 설정하고, Google의 승인된 리디렉션 URI를 `DORTORY_PUBLIC_ORIGIN/auth/google/callback`에 맞춥니다.

| 환경 | 필요한 설정 |
| --- | --- |
| Sites Worker | `DB`, `DORTORY_ADMIN_EMAIL`, `DORTORY_VERCEL_SECRET` |
| Vercel | `DORTORY_VERCEL_SECRET`, `DORTORY_ORIGIN_ACCESS`, `DORTORY_PUBLIC_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| 메일 발송 | 관리자 Google 계정의 Gmail 발신 연결 또는 `RESEND_API_KEY`와 `DORTORY_MAIL_FROM` |
| 기존 계정 기록 연결 | 필요할 때 `DORTORY_LEGACY_OWNER_ID` 설정 |

`deployment/vercel/api/gateway.mjs`의 `SOURCE`는 현재 Sites Worker 주소를 가리킵니다. 별도 백엔드 프로젝트로 이전할 때 이 주소와 `.openai/hosting.json`의 프로젝트 연결 정보, 각 환경의 인증 설정을 함께 확인합니다.

## Vercel 배포 파일 준비

저장소 루트에서 별도 디렉터리를 지정합니다.

```bash
node scripts/prepare-vercel.mjs ../dortory-vercel
cd ../dortory-vercel
npm ci
npm run build
```

이 디렉터리가 Vercel 프로젝트의 루트입니다. 현재 공개 주소 검증은 `https://<프로젝트>.vercel.app` 형식을 사용합니다. 인증과 메일 연결의 상세 절차는 [배포 안내](deployment/README.md)에 있습니다.

## 디자인과 자료

흰색 바탕, 도토리 로고의 파란색 포인트와 Noto Sans KR을 사용합니다. 로고와 지도·이미지·폰트는 `site/assets`에 있습니다. 외부 라이브러리와 글꼴의 라이선스 파일을 해당 폴더에 포함했습니다.
