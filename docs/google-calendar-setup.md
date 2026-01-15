# Google Calendar API 설정 가이드

Google Calendar API를 활성화하고 사용하는 방법입니다.

## 사전 준비

1. Google Cloud Console 프로젝트 생성 완료
2. OAuth 2.0 클라이언트 ID 생성 완료
3. OAuth 동의 화면 설정 완료

## Google Calendar API 활성화

### 1. API 라이브러리에서 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴: **"API 및 서비스" > "라이브러리"**
4. 검색창에 "Google Calendar API" 입력
5. "Google Calendar API" 선택
6. **"사용"** 버튼 클릭

### 2. 필요한 스코프 확인

현재 프로젝트에서 사용하는 Calendar API 스코프:

```
https://www.googleapis.com/auth/calendar
```

이 스코프는:
- ✅ 일정 읽기
- ✅ 일정 생성
- ✅ 일정 수정
- ✅ 일정 삭제

**읽기 전용이 필요한 경우:**
```
https://www.googleapis.com/auth/calendar.readonly
```

### 3. OAuth 동의 화면에 스코프 추가

1. "API 및 서비스" > "OAuth 동의 화면"
2. "범위 추가 또는 삭제" 클릭
3. 다음 스코프 추가:
   - `https://www.googleapis.com/auth/calendar`
4. "업데이트" 클릭

---

## 권한 및 제한사항

### API 할당량

**무료 할당량:**
- 일일 할당량: 1,000,000,000 할당량 단위
- 초당 할당량: 250 할당량 단위

**일반적인 작업:**
- `events.list`: 100 할당량 단위
- `events.insert`: 50 할당량 단위
- `events.update`: 50 할당량 단위
- `events.delete`: 50 할당량 단위

---

## 테스트

### 수동 테스트

1. 애플리케이션 로그인
2. 이메일에서 "일정 추출" 버튼 클릭
3. Calendar 권한 승인
4. Google Calendar에서 일정 확인

### API 직접 테스트

```bash
# 일정 목록 조회
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events"

# 일정 생성
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "테스트 일정",
    "start": {"dateTime": "2024-12-31T10:00:00+09:00"},
    "end": {"dateTime": "2024-12-31T11:00:00+09:00"}
  }' \
  "https://www.googleapis.com/calendar/v3/calendars/primary/events"
```

---

## 문제 해결

### "API not enabled" 오류

- Google Calendar API가 활성화되었는지 확인

### "Insufficient permissions" 오류

- OAuth 스코프가 올바른지 확인
- 사용자가 권한을 승인했는지 확인

### 일정이 생성되지 않음

- 시간대 설정 확인 (Asia/Seoul)
- 날짜 형식 확인 (ISO 8601)
- 필수 필드 확인 (summary, start, end)

---

## 보안 고려사항

1. **최소 권한 원칙:**
   - 필요한 스코프만 요청
   - 읽기 전용 가능 시 사용

2. **사용자 데이터 보호:**
   - 일정 정보 암호화
   - 접근 제어

