# Gmail API 설정 가이드

Gmail API를 활성화하고 사용하는 방법입니다.

## 사전 준비

1. Google Cloud Console 프로젝트 생성 완료
2. OAuth 2.0 클라이언트 ID 생성 완료
3. OAuth 동의 화면 설정 완료

## Gmail API 활성화

### 1. API 라이브러리에서 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴: **"API 및 서비스" > "라이브러리"**
4. 검색창에 "Gmail API" 입력
5. "Gmail API" 선택
6. **"사용"** 버튼 클릭

### 2. 필요한 스코프 확인

현재 프로젝트에서 사용하는 Gmail API 스코프:

```
https://www.googleapis.com/auth/gmail.readonly
```

이 스코프는:
- ✅ 이메일 읽기
- ✅ 이메일 목록 조회
- ❌ 이메일 보내기 (필요시 추가)
- ❌ 이메일 삭제 (필요시 추가)

### 3. OAuth 동의 화면에 스코프 추가

1. "API 및 서비스" > "OAuth 동의 화면"
2. "범위 추가 또는 삭제" 클릭
3. 다음 스코프 추가:
   - `https://www.googleapis.com/auth/gmail.readonly`
4. "업데이트" 클릭

---

## 권한 및 제한사항

### API 할당량

**무료 할당량:**
- 일일 할당량: 1,000,000,000 할당량 단위
- 초당 할당량: 250 할당량 단위

**일반적인 작업:**
- `messages.list`: 5 할당량 단위
- `messages.get`: 5 할당량 단위

### 제한사항

- 최대 500개 메시지/요청
- Rate limiting 적용
- 사용자당 일일 할당량 제한

---

## 테스트

### 수동 테스트

1. 애플리케이션 로그인
2. "이메일 가져오기" 버튼 클릭
3. Gmail 권한 승인
4. 이메일 목록 확인

### API 직접 테스트

```bash
# OAuth 토큰 필요
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10"
```

---

## 문제 해결

### "API not enabled" 오류

- Gmail API가 활성화되었는지 확인
- 프로젝트가 올바른지 확인

### "Insufficient permissions" 오류

- OAuth 스코프가 올바른지 확인
- 사용자가 권한을 승인했는지 확인
- 토큰이 만료되지 않았는지 확인

### "Rate limit exceeded" 오류

- API 호출 빈도 감소
- 재시도 로직 추가
- 할당량 모니터링

---

## 보안 고려사항

1. **읽기 전용 스코프 사용:**
   - 현재는 `gmail.readonly`만 사용
   - 필요시에만 쓰기 권한 추가

2. **토큰 보안:**
   - 토큰을 안전하게 저장
   - 만료 시 자동 갱신

3. **사용자 데이터 보호:**
   - GDPR 준수
   - 데이터 암호화

