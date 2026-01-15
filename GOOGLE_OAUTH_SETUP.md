# Google OAuth 설정 가이드

이 프로젝트는 NextAuth.js를 사용하므로 `credentials.json` 파일이 **필요하지 않습니다**. 
대신 Google Cloud Console에서 OAuth 2.0 클라이언트를 생성하고 환경 변수에 설정하면 됩니다.

## 단계별 설정 방법

### 1. Google Cloud Console 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 상단의 프로젝트 선택 드롭다운 클릭
3. "새 프로젝트" 클릭
4. 프로젝트 이름 입력 (예: "AI Inbox Solution")
5. "만들기" 클릭

### 2. OAuth 동의 화면 설정

1. 왼쪽 메뉴에서 **"API 및 서비스" > "OAuth 동의 화면"** 클릭
2. 사용자 유형 선택:
   - **외부**: 일반 사용자도 사용 가능 (테스트 중에는 제한적)
   - **내부**: Google Workspace 조직 내부만 사용 가능
3. 앱 정보 입력:
   - 앱 이름: "AI Inbox Solution" (또는 원하는 이름)
   - 사용자 지원 이메일: 본인 이메일
   - 앱 로고: 선택사항
4. 범위(Scopes) 추가:
   - "범위 추가 또는 삭제" 클릭
   - 다음 범위 추가:
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/calendar`
   - "업데이트" 클릭
5. 테스트 사용자 추가 (외부 앱인 경우):
   - "테스트 사용자" 섹션에서 "사용자 추가" 클릭
   - 본인 Google 이메일 주소 추가
6. "저장 후 계속" 클릭하여 완료

### 3. OAuth 2.0 클라이언트 ID 생성

1. 왼쪽 메뉴에서 **"API 및 서비스" > "사용자 인증 정보"** 클릭
2. 상단의 **"+ 사용자 인증 정보 만들기"** 클릭
3. **"OAuth 클라이언트 ID"** 선택
4. 애플리케이션 유형: **"웹 애플리케이션"** 선택
5. 이름 입력: "AI Inbox Solution Web Client"
6. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   - 프로덕션 환경이 있다면 추가로:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```
7. "만들기" 클릭
8. **클라이언트 ID**와 **클라이언트 보안 비밀번호**가 표시됩니다
   - 이 두 값을 복사해두세요!

### 4. Gmail API 및 Calendar API 활성화

1. 왼쪽 메뉴에서 **"API 및 서비스" > "라이브러리"** 클릭
2. 검색창에 "Gmail API" 입력 후 선택
3. "사용" 버튼 클릭
4. 다시 "라이브러리"로 돌아가서 "Google Calendar API" 검색
5. "사용" 버튼 클릭

### 5. 환경 변수 설정

`.env` 파일을 열고 다음 값들을 설정하세요:

```env
GOOGLE_CLIENT_ID=여기에_클라이언트_ID_붙여넣기
GOOGLE_CLIENT_SECRET=여기에_클라이언트_보안_비밀번호_붙여넣기
```

### 6. 서버 재시작

환경 변수를 변경한 후에는 개발 서버를 재시작해야 합니다:

```bash
# 서버 중지 (Ctrl+C)
# 그 다음 다시 시작
npm run dev
```

## 문제 해결

### "액세스 차단됨" 또는 "액세스 오류"가 발생하는 경우

#### 1. 승인된 리디렉션 URI 확인 (가장 흔한 원인)

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **"API 및 서비스" > "사용자 인증 정보"** 클릭
3. OAuth 2.0 클라이언트 ID 클릭 (클라이언트 ID: `860800071889-v1j0e1f4her6mifvjsijupohc04f2fcp.apps.googleusercontent.com`)
4. **"승인된 리디렉션 URI"** 섹션 확인
5. 다음 URI가 정확히 포함되어 있는지 확인:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. **없다면 추가:**
   - "URI 추가" 클릭
   - `http://localhost:3000/api/auth/callback/google` 입력
   - "저장" 클릭
   - ⚠️ **주의**: `https`가 아닌 `http`로 입력해야 합니다 (로컬 개발 환경)
   - ⚠️ **주의**: 마지막 슬래시(`/`) 포함 여부도 정확히 일치해야 합니다

#### 2. OAuth 동의 화면 - 상태 및 테스트 사용자 확인

1. **"API 및 서비스" > "OAuth 동의 화면"** 클릭
2. **앱 상태 확인:**
   - **"테스트 중"**: 테스트 사용자 목록에 등록된 이메일만 로그인 가능
   - **"게시됨"**: 모든 사용자가 로그인 가능 (테스트 사용자 제한 없음)

3. **테스트 사용자 확인:**
   - **"테스트 사용자"** 섹션 확인
   - 앱 상태가 **"테스트 중"**인 경우:
     - 로그인하려는 Google 이메일이 테스트 사용자 목록에 있어야 합니다
     - **주의**: 지원 이메일(`hwangsungyun0105@gmail.com`)은 자동으로 테스트 사용자에 포함되지 않을 수 있습니다
     - 없다면 **"사용자 추가"** 클릭하여 이메일 추가
     - 변경사항 저장

4. **지원 이메일과 테스트 사용자:**
   - 지원 이메일은 개발자 연락처일 뿐, 자동으로 테스트 사용자 권한을 받지 않습니다
   - 지원 이메일도 테스트 사용자 목록에 명시적으로 추가해야 합니다

#### 3. OAuth 동의 화면 - 범위(Scopes) 확인

1. **"API 및 서비스" > "OAuth 동의 화면"** 클릭
2. **"범위"** 섹션 확인
3. 다음 범위가 모두 등록되어 있는지 확인:
   - ✅ `openid`
   - ✅ `https://www.googleapis.com/auth/userinfo.email`
   - ✅ `https://www.googleapis.com/auth/userinfo.profile`
   - ✅ `https://www.googleapis.com/auth/gmail.readonly`
   - ✅ `https://www.googleapis.com/auth/calendar`
4. 없다면 **"범위 추가 또는 삭제"** 클릭하여 추가

#### 4. API 활성화 확인

1. **"API 및 서비스" > "라이브러리"** 클릭
2. 다음 API가 **"사용 설정됨"** 상태인지 확인:
   - ✅ **Gmail API**
   - ✅ **Google Calendar API**
3. 활성화되지 않았다면:
   - 검색창에 "Gmail API" 입력 → 선택 → "사용" 클릭
   - 검색창에 "Google Calendar API" 입력 → 선택 → "사용" 클릭

#### 5. 환경 변수 확인

1. 프로젝트 루트의 `.env.local` 또는 `.env` 파일 확인
2. 다음 변수가 올바르게 설정되어 있는지 확인:
   ```env
   GOOGLE_CLIENT_ID=860800071889-v1j0e1f4her6mifvjsijupohc04f2fcp.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
3. **주의사항:**
   - 따옴표(`"` 또는 `'`)로 감싸지 않기
   - 앞뒤 공백 없어야 함
   - `=` 기호 앞뒤 공백 없어야 함
4. 환경 변수 변경 후 **개발 서버 재시작 필수**

#### 6. 특정 계정만 로그인이 안 되는 경우

**증상:** 일부 계정은 잘 로그인되는데 특정 계정만 액세스 차단이 발생하는 경우

**원인:** 브라우저에 저장된 해당 계정의 이전 인증 정보나 Google 계정에 저장된 앱 권한 문제

**해결 방법:**

1. **Google 계정에서 앱 권한 취소:**
   - [Google 계정 권한 관리](https://myaccount.google.com/permissions) 접속
   - "AI Inbox Solution" 또는 관련 앱 찾기
   - "제거" 또는 "권한 취소" 클릭

2. **브라우저 캐시 및 쿠키 삭제:**
   - 브라우저 개발자 도구 열기 (F12)
   - Application 탭 → Cookies → `localhost:3000` 삭제
   - 또는 Storage → Clear site data

3. **시크릿 모드에서 시도:**
   - 브라우저 시크릿/프라이빗 모드 열기
   - `http://localhost:3000/auth/signin` 접속
   - 로그인 시도

4. **다른 브라우저에서 시도:**
   - Chrome에서 문제가 있으면 Edge나 Firefox에서 시도
   - 또는 다른 프로필 사용

#### 7. 브라우저 캐시 및 쿠키 삭제 (일반)

때때로 브라우저에 저장된 이전 인증 정보가 문제를 일으킬 수 있습니다:
1. 브라우저 개발자 도구 열기 (F12)
2. Application 탭 → Cookies → `localhost:3000` 삭제
3. 또는 시크릿 모드에서 다시 시도

#### 8. 일반적인 오류 메시지별 해결 방법

- **"redirect_uri_mismatch"**: 승인된 리디렉션 URI 확인 (1번 항목)
- **"access_denied"**: 테스트 사용자 확인 (2번 항목) 또는 OAuth 동의 화면 게시 필요
- **"invalid_client"**: 환경 변수 확인 (5번 항목)
- **"invalid_scope"**: 범위(Scopes) 확인 (3번 항목)

### 프로덕션 배포 시

프로덕션 환경에서는:
1. OAuth 동의 화면을 "게시"해야 합니다
2. Google의 검토 프로세스를 거쳐야 할 수 있습니다
3. 승인된 리디렉션 URI에 프로덕션 도메인을 추가해야 합니다

## 참고 자료

- [NextAuth.js Google Provider 문서](https://next-auth.js.org/providers/google)
- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API 문서](https://developers.google.com/gmail/api)
- [Google Calendar API 문서](https://developers.google.com/calendar/api)

