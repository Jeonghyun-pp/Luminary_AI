# redirect_uri_mismatch 오류 해결 가이드

## 문제 원인

`redirect_uri_mismatch` 오류는 Google OAuth에서 요청한 리디렉션 URI가 Google Cloud Console에 등록된 URI와 정확히 일치하지 않을 때 발생합니다.

## 해결 방법 (단계별)

### 1단계: Google Cloud Console에서 정확한 URI 확인

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **API 및 서비스** → **사용자 인증 정보** 클릭
3. **OAuth 2.0 클라이언트 ID** 목록에서 **웹 애플리케이션** 타입 클라이언트 찾기
4. 클라이언트 ID 클릭 (편집)
5. **"승인된 리디렉션 URI"** 섹션 확인

### 2단계: 정확한 URI 추가

다음 URI가 **정확히** 등록되어 있는지 확인:

```
https://luminary-ai-rust.vercel.app/api/auth/callback/google
```

**주의사항:**
- ✅ `https://`로 시작 (http 아님)
- ✅ 마지막에 슬래시(`/`) 없음
- ✅ `/api/auth/callback/google` 정확히 일치
- ✅ 도메인: `luminary-ai-rust.vercel.app` (오타 없음)

**등록 방법:**
1. "승인된 리디렉션 URI" 섹션에서 **"+ URI 추가"** 클릭
2. 다음을 정확히 입력:
   ```
   https://luminary-ai-rust.vercel.app/api/auth/callback/google
   ```
3. **저장** 클릭
4. 저장 완료 메시지 확인

### 3단계: Vercel 환경 변수 확인

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables** 클릭
4. `NEXTAUTH_URL` 확인:
   - Value: `https://luminary-ai-rust.vercel.app` (슬래시 없이)
   - 오타나 슬래시가 있으면 수정

### 4단계: 실제 요청되는 URI 확인

브라우저 개발자 도구에서 확인:

1. 브라우저에서 F12 키 누르기
2. **Network** 탭 열기
3. Google 로그인 버튼 클릭
4. 실패한 요청 찾기 (보통 `accounts.google.com` 관련)
5. **Headers** 탭에서 `redirect_uri` 파라미터 확인
6. 이 URI가 Google Cloud Console에 등록된 URI와 정확히 일치하는지 확인

### 5단계: 추가 확인 사항

#### A. 여러 URI 등록 확인

다음 URI들이 모두 등록되어 있는지 확인:

```
https://luminary-ai-rust.vercel.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

#### B. OAuth 클라이언트 타입 확인

- **애플리케이션 유형**이 **"웹 애플리케이션"**이어야 함
- 다른 타입(데스크톱 앱 등)이면 "승인된 리디렉션 URI" 섹션이 없을 수 있음

#### C. 저장 확인

- Google Cloud Console에서 **저장** 버튼을 클릭했는지 확인
- 저장 후 페이지를 새로고침하여 URI가 목록에 나타나는지 확인

### 6단계: Vercel 재배포

환경 변수를 변경했다면:

1. Vercel 대시보드 → **Deployments**
2. 최신 배포 → **⋯** → **Redeploy**

### 7단계: 브라우저 캐시 삭제

1. 브라우저 개발자 도구 열기 (F12)
2. **Application** 탭 → **Cookies** → 모든 쿠키 삭제
3. 또는 시크릿 모드에서 테스트

## 자주 발생하는 오류

### 오류 1: URI 끝에 슬래시가 있음
- ❌ `https://luminary-ai-rust.vercel.app/api/auth/callback/google/`
- ✅ `https://luminary-ai-rust.vercel.app/api/auth/callback/google`

### 오류 2: http vs https
- ❌ `http://luminary-ai-rust.vercel.app/api/auth/callback/google`
- ✅ `https://luminary-ai-rust.vercel.app/api/auth/callback/google`

### 오류 3: 도메인 오타
- ❌ `luminary-ai-rust.vercel.com` (com 아님)
- ✅ `luminary-ai-rust.vercel.app`

### 오류 4: 경로 오타
- ❌ `/api/auth/callbacks/google` (callbacks 아님)
- ✅ `/api/auth/callback/google`

## 확인 체크리스트

- [ ] Google Cloud Console에 `https://luminary-ai-rust.vercel.app/api/auth/callback/google` 정확히 등록됨
- [ ] URI에 슬래시나 오타 없음
- [ ] Vercel 환경 변수 `NEXTAUTH_URL`이 `https://luminary-ai-rust.vercel.app`로 설정됨
- [ ] OAuth 클라이언트 타입이 "웹 애플리케이션"임
- [ ] Google Cloud Console에서 저장 완료됨
- [ ] Vercel 재배포 완료됨
- [ ] 브라우저 캐시 삭제 후 재시도

## 추가 도움

여전히 오류가 발생하면:
1. 브라우저 개발자 도구 → Network 탭에서 실제 요청되는 `redirect_uri` 확인
2. Google Cloud Console의 "승인된 리디렉션 URI" 목록 스크린샷
3. Vercel 환경 변수 `NEXTAUTH_URL` 값 확인

이 정보들을 공유해주시면 더 정확한 해결책을 제시할 수 있습니다.
