# ISOLA · 이솔라

**좋아하는 것들로 채운, 우리의 작은 섬.** 1~8명의 친구가 집과 정원을 꾸미고 책·영화·문장·위스키를 기록하는 비동기 웹 서비스의 첫 개발 버전입니다.

> 현재 상태: 로컬 체험 가능한 알파. 인증·DB migration·권한 로직은 구현되어 있으나 사용자 Supabase 프로젝트에 DB 구조 적용과 미인증 API 차단 검증을 마쳤습니다. 실메일 검증, 실기기 성능 측정, 운영 준비는 남아 있습니다. 전체 기획서의 출시 완료를 의미하지 않습니다.

## 실행

Node.js 22 이상 권장.

```sh
npm ci
npm run dev
```

[로컬 앱](http://localhost:3000)에서 **샘플 섬 둘러보기**를 선택합니다. 샘플은 브라우저 localStorage에만 저장되고 실제 친구에게 초대나 알림을 전송하지 않습니다. 실계정 데이터와 분리되어 있습니다.

## 실제 Supabase 연결

현재 사용자 프로젝트에는 001 migration이 이미 적용되어 있습니다. 아래 순서는 **새 프로젝트** 설정 안내이며, 기존 프로젝트에서 001을 다시 실행하지 마세요.

1. Supabase에서 새 프로젝트를 생성합니다. DB 비밀번호와 service_role/Secret key는 프런트엔드에 넣지 않습니다.
2. SQL Editor에서 `supabase/migrations/001_isola.sql`을 **빈 프로젝트에 한 번** 실행합니다. 기존 데이터가 있는 프로젝트에는 그대로 실행하지 마세요.
3. 기본 인증 메일의 로그인 링크를 사용할 수 있습니다. 커스텀 SMTP가 준비되면 Magic Link 템플릿에 `{{ .Token }}`을 넣어 OTP로 전환할 수도 있습니다. 앱은 두 방식을 지원합니다. 현재 대시보드에서는 커스텀 SMTP 없이 템플릿을 편집할 수 없습니다.
4. Authentication → URL Configuration에 개발용 `http://localhost:3000`과 실제 배포 URL을 설정합니다.
5. 프로젝트 API 설정의 URL과 Publishable key 또는 anon key를 복사합니다.
6. `.env.example`을 `.env.local`로 복사해 두 공개 값만 입력합니다. `.env.local`은 Git에서 제외합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

7. 개발 서버를 다시 시작합니다. 실제 이메일로 로그인하고 섬을 생성합니다.
8. 다른 이메일/브라우저로 초대 수락 → 기록 공개 → 방문 → 댓글 → 알림을 검증합니다.

Supabase 무료/기본 메일 발송 제한과 사용자 지정 SMTP 설정은 프로젝트 대시보드에서 확인하세요. OTP 테스트의 성공 여부는 실제 프로젝트에서 확인해야 합니다. 두 공개 연결 값만으로 DB migration을 실행할 수는 없습니다.

### 로컬 Supabase (선택)

Docker와 Supabase CLI가 설치된 경우 `supabase start` 및 로컬 전용 `supabase db reset`으로 migration을 적용할 수 있습니다. `db reset`은 로컬 데이터 초기화 명령입니다. 현재 자동 테스트는 Docker 없이 PGlite PostgreSQL 엔진에 동일 migration을 적용하고 auth 역할을 모사합니다.

## 구현한 흐름

- 동화적인 쿼터뷰 3D 섬, 집·정원, 바닥 탭 이동, 목록 대안
- 브라우저 샘플 모드와 실제 이메일 링크/OTP 모드
- 섬 생성, 8개 집터, 만료·취소 가능한 초대, 방장 이전·내보내기·탈퇴
- 성별 제한 없는 체형·머리·피부·옷 팔레트, 선택적 자기표현
- 4종 취향 기록, 검색·필터, 공개 범위, 개인 데이터 내보내기
- 8종 도형 소품 배치·회전·이동·삭제, 충돌·통로 검사, 초안·공개본 분리
- 취향 받침대에 공개 기록 연결, 비동기 방문·댓글·알림
- 양방향 차단, 기록 신고 접수, 계정 삭제 요청과 즉시 접근 차단
- RLS, 서버 권한 검증, revision 충돌 처리, 초대·가입 트랜잭션
- PWA manifest·아이콘·오프라인 안내. 개인 데이터는 서비스 워커에 저장하지 않음

## 검사

```sh
npm run typecheck
npm test
npm run build
npm audit
```

`tests/database.test.ts`는 실제 PostgreSQL 호환 엔진에 migration을 적용하고 authenticated 역할로 읽기·쓰기 권한을 검사합니다. PGlite는 실제 Supabase Auth, 메일 전달, 다중 연결 동시성이나 Realtime을 검증하지 않습니다. 이 항목은 클라우드 스테이징에서 별도 검증해야 합니다.

## 문서

- [원 기획서를 ISOLA로 업데이트한 제품 명세](docs/PRODUCT_SPEC.ko.md)
- [현재 구현과 남은 작업](docs/STATUS.ko.md)
- [아키텍처 결정](docs/ARCHITECTURE.ko.md)
- [운영 및 출시 체크리스트](docs/OPERATIONS.ko.md)
- [에셋 출처](docs/ASSETS.md)

## 배포

Next.js를 지원하는 호스팅에 저장소를 연결하고 위 두 공개 환경 변수를 설정한 뒤 `npm run build`로 빌드합니다. 이번 작업은 GitHub 소스 커밋까지이며 공개 운영 배포는 하지 않습니다. 새 Supabase 프로젝트의 migration 적용·메일 설정·스테이징 검수 후 배포하세요.

## 비범위

실시간 아바타 동기화, 실시간 채팅, AI 생성, 결제, 공동 편집, 사용자 이미지 업로드, 미니게임은 아직 구현하지 않습니다. 소품은 자체 제작 도형 기반이며 외부 상용 게임의 아트를 사용하지 않습니다.
