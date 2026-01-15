# Gmail Modify 스코프 설정 가이드

현재 `gmail.modify` 스코프`를 사용하기 위해 다음 단계를 따라야 합니다.

## 1. Google Cloud Console에서 OAuth 동의 화면 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴: **"API 및 서비스" > "OAuth 동의 화면"** 클릭
4. **"범위 추가 또는 삭제"** 클릭
5. 다음 스코프를 추가:
   - `https://www.googleapis.com/auth/gmail.modify`
6. **"업데이트"** 클릭
7. **"저장 후 계속"** 클릭

## 2. 앱에서 재로그인

새로운 스코프를 적용하려면:

1. 앱에서 **완전히 로그아웃**
2. 다시 로그인
3. Google 동의 화면에서 새로운 권한을 승인

## 3. 확인

재로그인 후 채팅에서 스레드를 열면 Gmail에서 읽음 처리가 되어야 합니다.

