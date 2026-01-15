# Vercel 환경 변수 설정 가이드 (긴급 수정)

## 🚨 현재 문제

로그에서 다음 오류들이 발생하고 있습니다:
1. `authjs.callback-url=http%3A%2F%2Flocalhost%3A3000%2Finbox` - localhost 사용
2. `NODE_ENV was incorrectly set to "development"` - 환경 변수 오설정
3. 401 인증 오류 - 세션/쿠키 문제

## ✅ 즉시 해결 방법

### 1. Vercel 환경 변수 확인 및 수정

**Vercel 대시보드 → 프로젝트 → Settings → Environment Variables**에서:

#### ❌ 삭제해야 할 환경 변수:
- `NODE_ENV` (Vercel이 자동으로 설정하므로 수동 설정하면 안 됨)

#### ✅ 필수 환경 변수 (정확한 값):

```
NEXTAUTH_URL=https://luminary-ai-rust.vercel.app
AUTH_SECRET=<생성한-시크릿-키>
DATABASE_URL=<데이터베이스-연결-문자열>
OPENAI_API_KEY=<openai-api-key>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
```

**중요:**
- `NEXTAUTH_URL`은 반드시 `https://luminary-ai-rust.vercel.app` (슬래시 없이)
- 각 환경 변수의 **Environment**를 **Production, Preview, Development 모두** 선택
- `NODE_ENV`는 **절대 설정하지 마세요** (Vercel이 자동으로 설정)

### 2. AUTH_SECRET 생성 (없다면)

PowerShell에서 실행:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

생성된 값을 `AUTH_SECRET` 환경 변수에 설정

### 3. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **API 및 서비스** → **사용자 인증 정보**
3. OAuth 2.0 클라이언트 ID 편집
4. **승인된 리디렉션 URI**에 다음 추가:
   ```
   https://luminary-ai-rust.vercel.app/api/auth/callback/google
   ```
5. **저장**

### 4. 재배포

환경 변수 수정 후:
1. Vercel 대시보드 → **Deployments**
2. 최신 배포 → **⋯** → **Redeploy**

또는 Git push로 자동 재배포:
```bash
git add .
git commit -m "Fix: Update auth configuration for production"
git push
```

## 🔍 확인 사항

배포 후 다음을 확인:

- [ ] `NODE_ENV` 환경 변수가 **삭제**됨
- [ ] `NEXTAUTH_URL`이 `https://luminary-ai-rust.vercel.app`로 설정됨
- [ ] `AUTH_SECRET`이 설정됨
- [ ] Google Cloud Console에 프로덕션 리다이렉트 URI 추가됨
- [ ] 재배포 완료됨
- [ ] 브라우저 캐시 및 쿠키 삭제 후 다시 시도

## 📝 코드 변경 사항

다음 변경사항이 적용되었습니다:

1. **쿠키 secure 설정 개선**: `NODE_ENV` 대신 `NEXTAUTH_URL`이 https로 시작하는지 확인
2. **NextAuth 설정 최적화**: 프로덕션 환경에서 올바르게 작동하도록 수정

## ⚠️ 주의사항

- `NODE_ENV`는 **절대** Vercel 환경 변수에 설정하지 마세요
- Vercel은 자동으로 프로덕션 환경에서 `NODE_ENV=production`을 설정합니다
- 수동으로 설정하면 빌드/런타임 오류가 발생할 수 있습니다
