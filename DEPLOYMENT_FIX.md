# 배포 후 ERR_CONNECTION_REFUSED 오류 해결 가이드

## 문제 원인

`ERR_CONNECTION_REFUSED` 오류는 프로덕션 환경에서 `NEXTAUTH_URL`이 `localhost`로 설정되어 있을 때 발생합니다.

## 해결 방법

### 1. Vercel 환경 변수 수정

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables** 클릭
4. 다음 환경 변수들을 확인/수정:

#### 필수 수정 사항:

**`NEXTAUTH_URL`**
- ❌ 잘못된 값: `http://localhost:3000`
- ✅ 올바른 값: `https://luminary-ai-rust.vercel.app`

**`AUTH_SECRET`**
- ✅ 반드시 설정되어 있어야 함
- 값이 없다면 생성:
  ```bash
  # PowerShell에서 실행
  -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
  ```

#### 전체 필수 환경 변수 목록:

```
NEXTAUTH_URL=https://luminary-ai-rust.vercel.app
AUTH_SECRET=<생성한-시크릿-키>
DATABASE_URL=<데이터베이스-연결-문자열>
OPENAI_API_KEY=<openai-api-key>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
```

**중요:** 각 환경 변수의 **Environment**를 **Production, Preview, Development 모두** 선택해야 합니다.

### 2. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. **API 및 서비스** → **사용자 인증 정보** 클릭
4. OAuth 2.0 클라이언트 ID 클릭 (편집)
5. **승인된 리디렉션 URI** 섹션에서 다음 URI 추가:
   ```
   https://luminary-ai-rust.vercel.app/api/auth/callback/google
   ```
6. **저장** 클릭

### 3. Vercel 재배포

환경 변수를 수정한 후:

1. Vercel 대시보드에서 **Deployments** 탭 클릭
2. 최신 배포 옆의 **⋯** 메뉴 클릭
3. **Redeploy** 선택
4. 또는 자동으로 재배포되도록 Git에 push:
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

### 4. 확인 사항

배포 후 다음을 확인하세요:

- [ ] Vercel 환경 변수 `NEXTAUTH_URL`이 `https://luminary-ai-rust.vercel.app`로 설정됨
- [ ] Google Cloud Console에 프로덕션 리다이렉트 URI 추가됨
- [ ] `AUTH_SECRET`이 설정됨
- [ ] 재배포 완료됨
- [ ] 브라우저 캐시 및 쿠키 삭제 후 다시 시도

## 추가 문제 해결

### 여전히 오류가 발생하는 경우

1. **Vercel Function Logs 확인:**
   - Vercel 대시보드 → 프로젝트 → **Functions** 탭
   - 실시간 로그에서 오류 메시지 확인

2. **브라우저 개발자 도구 확인:**
   - F12 → **Network** 탭
   - 실패한 요청의 URL 확인
   - `localhost`가 포함되어 있다면 환경 변수가 제대로 반영되지 않은 것

3. **환경 변수 재확인:**
   - Vercel 대시보드에서 환경 변수가 올바르게 설정되었는지 다시 확인
   - 특히 `NEXTAUTH_URL`의 오타 확인 (http vs https, 슬래시 등)

## 참고

- `trustHost: true`가 `auth.ts`에 설정되어 있어 Vercel에서 자동으로 호스트를 감지합니다
- 하지만 `NEXTAUTH_URL`은 여전히 명시적으로 설정하는 것이 권장됩니다
