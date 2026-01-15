# CLOVA Studio API 설정 가이드

## 문제 상황
현재 "Invalid Key - Legacy auth is incompatible with new API Key" 오류 발생
→ 구버전 API 키를 사용 중이거나 App ID가 잘못됨

## 해결 방법: CLOVA Studio Console에서 정보 확인

### 1단계: CLOVA Studio Console 접속
https://clovastudio.ncloud.com/ 접속 및 로그인

### 2단계: 앱 생성 또는 선택

#### 방법 A: 기존 앱이 있는 경우
1. 좌측 메뉴에서 **"Apps"** 클릭
2. 사용할 앱 선택
3. 다음 정보 확인:
   - **App ID** (예: `testapp`, `my-app-123`)
   - **API Key** (nv-로 시작)

#### 방법 B: 새 앱 만들기
1. 좌측 메뉴에서 **"Apps"** 클릭
2. **"+ Create New App"** 버튼 클릭
3. 앱 정보 입력:
   - App Name: `email-classifier` (원하는 이름)
   - Description: 협찬 이메일 분류 시스템
4. **"Create"** 클릭
5. 생성된 앱의 정보 확인:
   - **App ID** 복사
   - **API Key** 복사

### 3단계: Playground에서 테스트 (선택)

1. 좌측 **"Playground"** 클릭
2. HyperCLOVA X 선택
3. 간단한 메시지 입력해서 작동 확인
4. 우측 상단 **"View Code"** 클릭
5. Python 탭에서 실제 사용 예시 확인

### 4단계: 필요한 정보 정리

다음 정보를 확인하세요:

```
App ID: _____________________ (예: testapp, my-email-app)
API Key: ____________________ (nv-로 시작하는 긴 문자열)
```

### 5단계: 코드에 적용

확인한 정보를 알려주시면 코드를 자동으로 수정해드립니다!

## 참고 사항

### App ID 확인 방법
- Apps 페이지에서 앱 이름 클릭
- URL에서 확인: `https://clovastudio.ncloud.com/apps/[여기가App ID]`
- 앱 상세 페이지의 "App Information" 섹션

### API Key 확인 방법
- 앱 상세 페이지 > "API Keys" 섹션
- "Primary Key" 또는 "Secondary Key" 복사
- 반드시 `nv-`로 시작해야 함

### 자주 발생하는 문제
1. **testapp 사용**: testapp은 제한적이며 인증 문제가 발생할 수 있음
2. **구버전 키**: 이전에 발급받은 키는 새 API와 호환 안됨
3. **App ID 오타**: 정확한 App ID 필요

## 다음 단계

1. 위 정보를 확인하세요
2. App ID와 API Key를 알려주세요
3. 코드를 자동으로 수정해드립니다!

