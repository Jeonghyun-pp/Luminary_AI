# 📧 Gmail API 설정 가이드

## 1단계: Google Cloud Console 접속 및 프로젝트 생성

1. **Google Cloud Console 접속**
   - 브라우저에서 https://console.cloud.google.com/ 열기
   - Google 계정으로 로그인

2. **새 프로젝트 생성**
   - 상단 프로젝트 선택 드롭다운 클릭
   - "새 프로젝트" 버튼 클릭
   - 프로젝트 이름: `influencer-email-classifier` (원하는 이름)
   - "만들기" 버튼 클릭
   - 프로젝트가 생성될 때까지 대기 (약 10초)

## 2단계: Gmail API 활성화

1. **API 라이브러리로 이동**
   - 좌측 메뉴 ☰ > "API 및 서비스" > "라이브러리" 클릭
   
2. **Gmail API 검색 및 활성화**
   - 검색창에 "Gmail API" 입력
   - "Gmail API" 선택
   - "사용" 또는 "Enable" 버튼 클릭
   - 활성화 완료 메시지 확인

## 3단계: OAuth 동의 화면 구성

1. **OAuth 동의 화면으로 이동**
   - 좌측 메뉴 ☰ > "API 및 서비스" > "OAuth 동의 화면" 클릭

2. **User Type 선택**
   - "외부" 선택 (개인 Gmail 계정인 경우)
   - "만들기" 버튼 클릭

3. **앱 정보 입력**
   - **앱 이름**: `Influencer Email Classifier`
   - **사용자 지원 이메일**: 본인의 Gmail 주소 선택
   - **앱 로고**: (선택사항, 건너뛰기 가능)
   - **앱 도메인**: (선택사항, 건너뛰기 가능)
   - **개발자 연락처 정보**: 본인의 Gmail 주소 입력
   - "저장 후 계속" 버튼 클릭

4. **범위 설정** (Scopes)
   - "범위 추가 또는 삭제" 버튼 클릭
   - 검색창에 `gmail` 입력
   - `https://www.googleapis.com/auth/gmail.readonly` 체크
   - "업데이트" 버튼 클릭
   - "저장 후 계속" 버튼 클릭

5. **테스트 사용자 추가**
   - "+ ADD USERS" 버튼 클릭
   - 본인의 Gmail 주소 입력 (이메일을 가져올 계정)
   - "추가" 버튼 클릭
   - "저장 후 계속" 버튼 클릭

6. **요약 확인**
   - 설정 내용 확인
   - "대시보드로 돌아가기" 클릭

## 4단계: OAuth 2.0 클라이언트 ID 생성

1. **사용자 인증 정보로 이동**
   - 좌측 메뉴 ☰ > "API 및 서비스" > "사용자 인증 정보" 클릭

2. **OAuth 클라이언트 ID 생성**
   - 상단 "+ 사용자 인증 정보 만들기" 버튼 클릭
   - "OAuth 클라이언트 ID" 선택

3. **애플리케이션 유형 선택**
   - 애플리케이션 유형: **"데스크톱 앱"** 선택
   - 이름: `Influencer Email Client` (원하는 이름)
   - "만들기" 버튼 클릭

4. **credentials.json 다운로드**
   - "OAuth 클라이언트 생성됨" 팝업창이 나타남
   - "JSON 다운로드" 버튼 클릭
   - 다운로드된 파일 이름을 `credentials.json`으로 변경
   - 파일을 프로젝트 루트 디렉토리에 복사
     (`C:\Users\pjh_0\OneDrive\바탕 화면\influencer_ads\`)

## 5단계: credentials.json 확인

다운로드한 `credentials.json` 파일의 내용은 다음과 유사해야 합니다:

```json
{
  "installed": {
    "client_id": "xxxxx.apps.googleusercontent.com",
    "project_id": "your-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-xxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

## 6단계: 앱 실행 및 인증

1. **Streamlit 앱 실행**
   ```bash
   streamlit run app.py
   ```

2. **첫 실행 시 인증 과정**
   - 브라우저가 자동으로 열리며 Google 로그인 화면 표시
   - Gmail 계정으로 로그인
   - "Google에서 확인하지 않은 앱" 경고가 나타날 수 있음
     → "고급" 클릭
     → "앱 이름(안전하지 않음)으로 이동" 클릭
   - 권한 요청 확인 후 "허용" 클릭
   - 인증 완료되면 `token.pickle` 파일이 자동 생성됨

## 7단계: 완료!

✅ Gmail API 설정 완료!
✅ 이제 애플리케이션이 Gmail 이메일을 읽을 수 있습니다.
✅ `token.pickle` 파일이 있으면 다음 실행 시 재인증 불필요

## 🛠️ 문제 해결

### "credentials.json을 찾을 수 없습니다" 오류
- 파일이 프로젝트 루트 디렉토리에 있는지 확인
- 파일 이름이 정확히 `credentials.json`인지 확인

### "앱이 차단됨" 오류
- OAuth 동의 화면에서 테스트 사용자에 본인 이메일이 추가되었는지 확인
- "고급" > "안전하지 않은 페이지로 이동"을 클릭하여 진행

### 인증 후 오류 발생
- `token.pickle` 파일을 삭제하고 다시 인증 시도
- Gmail API가 활성화되어 있는지 확인

## 📝 참고 사항

- **보안**: `credentials.json`과 `token.pickle`은 절대 공개하지 마세요
- **쿼터**: Gmail API는 일일 사용량 제한이 있습니다 (무료: 1일 1억 쿼터)
- **테스트 모드**: 앱이 "테스트" 상태이므로 테스트 사용자만 사용 가능

