# 도토리 배포 연결

Sites Worker와 D1은 상담·대장·활동 로그·메일 발송 상태를 저장한다. Vercel은 공개 화면과 Google OAuth를 제공한다. 소스는 이 저장소에서 함께 관리한다.

`node scripts/prepare-vercel.mjs <별도 배포 디렉터리>`로 Vercel에 올릴 파일을 준비한다. `deployment/vercel`과 `site`를 합치며 `.vercel` 연결 상태와 비밀값은 이 저장소에 넣지 않는다.

Vercel preview 환경변수는 `DORTORY_VERCEL_SECRET`, `DORTORY_ORIGIN_ACCESS`, `DORTORY_PUBLIC_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`이다. Sites에는 지정 관리자 이메일 `DORTORY_ADMIN_EMAIL`과 같은 `DORTORY_VERCEL_SECRET`을 설정한다. private Sites origin의 접근용 토큰은 그 origin에만 전송한다.

Google redirect URI는 `DORTORY_PUBLIC_ORIGIN/auth/google/callback`과 일치해야 한다. 일반 로그인은 `openid email profile`, 관리자 발신 연결은 추가로 `gmail.send`를 사용한다. Gmail API를 Google 프로젝트에서 활성화한다. 발신 연결은 관리자 로그인 후 활동 로그 화면에서 진행하며 같은 관리자 Google 계정인지 서버에서 다시 확인한다.

Google 인증을 완료한 계정의 이메일이 지정 관리자 이메일과 일치하면, Vercel이 로그인 직후 관리자 쿠키도 발급한다. 관리자 로그아웃 또는 8시간 만료 이후에는 구글 인증을 다시 진행한다.

Gmail의 갱신 토큰과 발신 클라이언트 설정은 서버에서 AES-GCM으로 암호화해 D1에 보관한다. 브라우저나 API 응답에는 반환하지 않는다. 공개 화면에서 로그인·로그아웃·메일 발송 권한을 별도로 처리한다. `DORTORY_VERCEL_SECRET`을 바꾼 경우 발신 계정을 다시 연결해야 한다.

활동 로그는 서버에서 기록하고 관리자 세션으로만 조회한다. 상담/대장 저장은 변경 성공과 로그 기록을 같은 DB 배치로 처리한다. 상담 접수와 발송은 고유 요청 ID로 중복을 방지한다. Gmail 발송 후 응답을 확인하지 못한 건은 중복 발송을 막기 위해 자동 재발송하지 않으며 관리자 로그와 상담 화면에 확인 필요 상태를 표시한다.

구글 로그인은 Google 고유 식별자를 사용한다. 지정된 관리자 이메일이 구글에서 확인되면 `DORTORY_LEGACY_OWNER_ID`에 등록한 기존 소유자 본인의 상담만 연결한다. 다른 이용자의 기록은 이메일만으로 자동 병합하지 않는다. 관리자는 원래 상담 기록을 대장에서 확인할 수 있다.
