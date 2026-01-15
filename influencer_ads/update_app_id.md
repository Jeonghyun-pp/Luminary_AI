# CLOVA Studio App ID 업데이트 가이드

## 문제
"Invalid Key - Legacy auth is incompatible with new API Key" 오류 발생

## 해결 방법

### 1. CLOVA Studio에서 App ID 확인
1. https://clovastudio.ncloud.com/ 접속
2. 좌측 "My Apps" 클릭
3. 앱 선택 또는 새로 생성
4. App ID 복사 (예: `testapp`, `my-app-123`)

### 2. classifier.py 파일 수정

**18번 줄**을 다음과 같이 수정:

```python
# 변경 전:
self.api_url = "https://clovastudio.stream.ntruss.com/testapp/v1/chat-completions/HCX-003"

# 변경 후 (App ID를 실제 값으로 교체):
self.api_url = "https://clovastudio.stream.ntruss.com/여기에_실제_App_ID/v1/chat-completions/HCX-003"
```

### 예시
만약 App ID가 `my-email-app`이라면:
```python
self.api_url = "https://clovastudio.stream.ntruss.com/my-email-app/v1/chat-completions/HCX-003"
```

## 참고
- testapp은 테스트용이며 제한적입니다
- 실제 앱을 만들어야 정상 작동합니다

