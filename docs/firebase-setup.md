# Firebase 설정 가이드

이 문서는 AI Inbox Solution 프로젝트에서 Firebase Firestore를 설정하는 방법을 단계별로 설명합니다.

---

## 📋 목차

1. [Firebase 프로젝트 생성](#1-firebase-프로젝트-생성)
2. [Firestore Database 활성화](#2-firestore-database-활성화)
3. [서비스 계정 키 생성](#3-서비스-계정-키-생성)
4. [로컬 환경 설정](#4-로컬-환경-설정)
5. [Firestore 인덱스 생성](#5-firestore-인덱스-생성)
6. [Firestore 보안 규칙 설정](#6-firestore-보안-규칙-설정)
7. [환경 변수 설정](#7-환경-변수-설정)
8. [검증 및 테스트](#8-검증-및-테스트)
9. [문제 해결](#9-문제-해결)

---

## 1. Firebase 프로젝트 생성

### 1.1 Firebase Console 접속

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. Google 계정으로 로그인

### 1.2 새 프로젝트 추가

1. **"프로젝트 추가"** 또는 **"Add project"** 버튼 클릭
2. **프로젝트 이름 입력**: 예) `luminary-4c626` 또는 원하는 이름
3. **Google Analytics 설정** (선택사항):
   - Analytics 사용 여부 선택
   - 계정 선택 (필요시)
4. **"프로젝트 만들기"** 클릭
5. 프로젝트 생성 완료 대기 (약 1-2분)

### 1.3 프로젝트 ID 확인

- 프로젝트 설정에서 **프로젝트 ID** 확인 (예: `luminary-4c626`)
- 이 프로젝트 ID는 나중에 환경 변수에 사용됩니다

---

## 2. Firestore Database 활성화

### 2.1 Firestore Database 생성

1. Firebase Console 왼쪽 메뉴에서 **"Firestore Database"** 클릭
2. **"데이터베이스 만들기"** 또는 **"Create database"** 클릭
3. **보안 규칙 모드 선택**:
   - **프로덕션 모드** (권장): 보안 규칙이 적용됨
   - **테스트 모드**: 개발 중에만 사용 (30일 후 자동으로 거부됨)
   - 초기에는 **테스트 모드**로 시작해도 됩니다 (나중에 보안 규칙 설정 필요)
4. **위치 선택**:
   - 가까운 리전 선택 (예: `asia-northeast3` - 서울)
   - 리전은 나중에 변경할 수 없으므로 신중하게 선택
5. **"사용 설정"** 클릭
6. 데이터베이스 생성 완료 대기 (약 1분)

### 2.2 Firestore 데이터 구조

루미너리 서비스는 사용자별 데이터 격리를 위해 다음과 같은 구조를 사용합니다.

#### 상위 컬렉션
- `users` – 기본 사용자 프로필 및 각종 서브컬렉션의 부모
- `accounts` – OAuth 토큰 및 외부 계정 정보 (NextAuth/Firebase Adapter)
- `sessions` – 데이터베이스 세션 정보 (NextAuth)
- `verificationTokens` – 이메일 인증/비밀번호 초기화 토큰

#### `users/{uid}` 문서 하위 서브컬렉션
| 서브컬렉션 | 설명 |
| --- | --- |
| `inbox` | 협찬 이메일/DM 원본 및 AI 분석 결과 (기존 `emails` 대체) |
| `rules` | 사용자 정의 인박스 자동화 규칙 (`inboxRules` 대체) |
| `tasks` | 협찬 진행/칸반 카드 (`tasks` 대체) |
| `templates` | 회신 템플릿 (향후 확장) |
| `favorites` | 찜한 협찬 목록 |
| `replies` | 보낸 회신 기록 |
| `calendar` | 협찬 관련 일정/마감 정보 |

> 📌 **중요**: 모든 도메인 데이터는 `users/{uid}` 아래에 저장되므로, 다른 사용자가 다른 사람의 데이터를 읽을 수 없습니다. `accounts`/`sessions` 등 인증 관련 컬렉션만 전역으로 유지합니다.

---

## 3. 서비스 계정 키 생성

### 3.1 프로젝트 설정 이동

1. Firebase Console 왼쪽 하단의 **톱니바퀴 아이콘** 클릭
2. **"프로젝트 설정"** 또는 **"Project settings"** 선택

### 3.2 서비스 계정 탭

1. 상단 메뉴에서 **"서비스 계정"** 또는 **"Service accounts"** 탭 클릭
2. **"새 비공개 키 생성"** 또는 **"Generate new private key"** 버튼 클릭
3. 확인 팝업에서 **"키 생성"** 클릭
4. JSON 파일이 자동으로 다운로드됩니다

### 3.3 서비스 계정 키 파일 정보

다운로드된 파일 이름 형식:
```
{project-id}-firebase-adminsdk-{random}.json
```

예시:
```
luminary-4c626-firebase-adminsdk-fbsvc-2b85ffd0a1.json
```

**⚠️ 중요 보안 주의사항:**
- 이 파일은 **절대 Git에 커밋하지 마세요**
- 파일에 포함된 비공개 키는 프로젝트 전체에 대한 관리자 권한을 제공합니다
- `.gitignore`에 이미 추가되어 있습니다
- 파일을 안전하게 보관하세요

---

## 4. 로컬 환경 설정

로컬 개발을 위해 다음 중 하나의 방법을 선택하세요.

### 방법 1: 프로젝트 루트에 파일 배치 (가장 간단)

1. 다운로드한 서비스 계정 키 파일을 프로젝트 루트 디렉토리에 복사
2. 파일 이름은 그대로 유지 (예: `luminary-4c626-firebase-adminsdk-*.json`)
3. 코드가 자동으로 인식합니다

**장점**: 설정이 간단함  
**단점**: 프로젝트 폴더에 민감한 파일 존재 (하지만 `.gitignore`로 보호됨)

### 방법 2: 환경 변수로 파일 경로 지정

1. 서비스 계정 키 파일을 안전한 위치에 저장 (예: `~/.firebase/keys/`)
2. `.env` 파일에 추가:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./path/to/firebase-adminsdk-*.json
   ```

**장점**: 파일 위치를 명시적으로 제어  
**단점**: 경로를 정확히 지정해야 함

### 방법 3: 환경 변수에 JSON 문자열로 설정 (Vercel 배포 시 권장)

1. 서비스 계정 키 JSON 파일을 열기
2. 전체 내용을 한 줄로 변환 (줄바꿈 제거)
3. `.env` 파일에 추가:
   ```env
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...",...}
   FIREBASE_PROJECT_ID=luminary-4c626
   ```

**장점**: Vercel 등 배포 환경에서 사용하기 좋음  
**단점**: `.env` 파일이 길어짐

---

## 5. Firestore 인덱스 생성

Firestore는 복합 쿼리(여러 필드를 동시에 필터링하거나 정렬)를 사용할 때 인덱스가 필요합니다.

### 5.1 필요한 인덱스 목록

프로젝트에서 다음 인덱스들이 필요합니다:

#### 📧 `users/{uid}/inbox` (Collection Group: `inbox`)

| 컬렉션 그룹 | 필드 인덱스 | 정렬 순서 |
|---------|-----------|---------|
| `inbox` | `userId` (Ascending) + `category` (Ascending) | - |
| `inbox` | `userId` (Ascending) + `priorityLabel` (Ascending) | - |
| `inbox` | `userId` (Ascending) + `isSpam` (Ascending) | - |
| `inbox` | `userId` (Ascending) + `receivedAt` (Descending) | - |
| `inbox` | `userId` (Ascending) + `externalId` (Ascending) | - |

#### 📋 `users/{uid}/rules` (Collection Group: `rules`)

| 컬렉션 그룹 | 필드 인덱스 | 정렬 순서 |
|---------|-----------|---------|
| `rules` | `userId` (Ascending) + `isActive` (Ascending) | - |
| `rules` | `userId` (Ascending) + `createdAt` (Descending) | - |

#### ✅ `users/{uid}/tasks` (Collection Group: `tasks`)

| 컬렉션 그룹 | 필드 인덱스 | 정렬 순서 |
|---------|-----------|---------|
| `tasks` | `userId` (Ascending) + `status` (Ascending) | - |
| `tasks` | `userId` (Ascending) + `dueAt` (Ascending) | - |

#### 🔐 `accounts` 컬렉션

| 컬렉션 ID | 필드 인덱스 | 정렬 순서 |
|---------|-----------|---------|
| `accounts` | `userId` (Ascending) + `provider` (Ascending) | - |
| `accounts` | `provider` (Ascending) + `providerAccountId` (Ascending) | - |

### 5.2 인덱스 생성 방법

#### 자동 생성 (권장)

1. 애플리케이션 실행
2. 복합 쿼리를 사용하는 API를 호출
3. Firestore가 자동으로 인덱스 생성 링크를 제공하는 오류 메시지 표시
4. 오류 메시지의 링크 클릭 → Firebase Console에서 인덱스 생성 페이지로 이동
5. **"인덱스 만들기"** 클릭

#### 수동 생성

1. Firebase Console에서 **"Firestore Database"** 클릭
2. 상단 메뉴에서 **"인덱스"** 또는 **"Indexes"** 탭 클릭
3. **"인덱스 만들기"** 또는 **"Create Index"** 클릭
4. **컬렉션 그룹**을 선택하고 이름을 입력 (예: `inbox`, `rules`, `tasks`)
5. 필드 추가:
   - 필드 경로: `userId`, 정렬 순서: `오름차순`
   - 두 번째 필드: 쿼리에 필요한 값(예: `category`, `priorityLabel`, `dueAt` 등)과 정렬 방향 지정
6. 쿼리 범위는 **"컬렉션 그룹"**으로 유지
7. **"만들기"** 클릭
8. 인덱스 생성 완료 대기 (약 1-2분)

**⚠️ 참고**: 인덱스는 비용이 발생합니다. 필요한 인덱스만 생성하세요.

---

## 6. Firestore 보안 규칙 설정

프로덕션 환경에서는 반드시 보안 규칙을 설정해야 합니다.

### 6.1 보안 규칙 작성

Firebase Console에서 **"Firestore Database"** > **"규칙"** 탭으로 이동하고 다음 규칙을 적용하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function: 현재 사용자가 인증되었는지 확인
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function: 현재 사용자가 문서 소유자인지 확인
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users 컬렉션 및 모든 하위 문서: 자신의 데이터만 접근 가능
    match /users/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    
    // Accounts 컬렉션: 자신의 계정만 읽기/쓰기 가능
    match /accounts/{accountId} {
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Sessions 컬렉션: 자신의 세션만 읽기/쓰기 가능
    match /sessions/{sessionId} {
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Verification Tokens 컬렉션: 서버에서만 접근 가능 (클라이언트에서는 사용 안 함)
    match /verificationTokens/{tokenId} {
      allow read, write: if false; // 서버 사이드에서만 사용
    }
    
    // Emails 컬렉션: 자신의 이메일만 읽기/쓰기 가능
    match /emails/{emailId} {
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Inbox Rules 컬렉션: 자신의 규칙만 읽기/쓰기 가능
    match /inboxRules/{ruleId} {
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Tasks 컬렉션: 자신의 작업만 읽기/쓰기 가능
    match /tasks/{taskId} {
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // Calendar Tokens 컬렉션: 자신의 토큰만 읽기/쓰기 가능
    match /calendarTokens/{tokenId} {
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
  }
}
```

### 6.2 보안 규칙 게시

1. 위 규칙을 복사하여 Firebase Console의 규칙 편집기에 붙여넣기
2. **"게시"** 또는 **"Publish"** 버튼 클릭
3. 확인 팝업에서 **"게시"** 확인

### 6.3 보안 규칙 테스트 (선택사항)

Firebase Console에서 **"규칙 시뮬레이터"**를 사용하여 규칙을 테스트할 수 있습니다.

---

## 7. 환경 변수 설정

### 7.1 로컬 개발 (`.env` 파일)

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
AUTH_SECRET=your-auth-secret-here

# Firebase
FIREBASE_PROJECT_ID=luminary-4c626
# 방법 1: 파일이 프로젝트 루트에 있으면 자동 인식
# 방법 2: 파일 경로 지정
# GOOGLE_APPLICATION_CREDENTIALS=./path/to/firebase-adminsdk-*.json
# 방법 3: JSON 문자열로 설정 (Vercel 배포 시)
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Vercel Cron (프로덕션용)
# CRON_SECRET=your-cron-secret-here
```

### 7.2 프로덕션 (Vercel)

1. Vercel 대시보드에서 프로젝트 선택
2. **Settings** > **Environment Variables** 이동
3. 다음 변수 추가:
   - `FIREBASE_PROJECT_ID`: Firebase 프로젝트 ID
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: 서비스 계정 키 JSON (전체를 문자열로)
   - 기타 필요한 환경 변수들

---

## 8. 검증 및 테스트

### 8.1 연결 테스트

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 브라우저에서 `http://localhost:3000` 접속
3. 로그인 시도
4. Firebase Console에서 **"Firestore Database"** > **"데이터"** 탭 확인
5. `users` 컬렉션이 자동으로 생성되고 사용자 데이터가 추가되는지 확인

### 8.2 인덱스 확인

1. Firebase Console에서 **"Firestore Database"** > **"인덱스"** 탭 확인
2. 필요한 인덱스가 모두 생성되어 있는지 확인

### 8.3 API 테스트

1. 이메일 가져오기 API 호출: `POST /api/emails/fetch`
2. 이메일 목록 조회: `GET /api/emails`
3. 복합 쿼리가 정상 작동하는지 확인

---

## 9. 문제 해결

### 문제 1: "Firebase configuration missing" 오류

**증상**: 앱 실행 시 Firebase 설정 오류 메시지

**해결 방법**:
1. 서비스 계정 키 파일이 프로젝트 루트에 있는지 확인
2. 파일 이름이 `*-firebase-adminsdk-*.json` 형식인지 확인
3. `.env` 파일에 `FIREBASE_PROJECT_ID`가 설정되어 있는지 확인
4. 환경 변수 `FIREBASE_SERVICE_ACCOUNT_KEY` 또는 `GOOGLE_APPLICATION_CREDENTIALS`가 올바르게 설정되어 있는지 확인

### 문제 2: "The query requires an index" 오류

**증상**: API 호출 시 인덱스가 필요하다는 오류 메시지

**해결 방법**:
1. 오류 메시지에 포함된 링크를 클릭하여 자동으로 인덱스 생성
2. 또는 수동으로 Firebase Console에서 필요한 인덱스 생성 (5.2 참고)

### 문제 3: "Permission denied" 오류

**증상**: 데이터 읽기/쓰기 권한 오류

**해결 방법**:
1. Firestore 보안 규칙이 올바르게 설정되어 있는지 확인
2. 테스트 모드인 경우: 30일 후 자동으로 거부되므로 보안 규칙 설정 필요
3. 보안 규칙이 너무 엄격한 경우: 규칙을 완화하거나 로그인 상태 확인

### 문제 4: 서비스 계정 키 파일이 Git에 커밋됨

**증상**: GitHub에서 서비스 계정 키 파일이 보임

**해결 방법**:
1. 즉시 Firebase Console에서 해당 서비스 계정 키 삭제 및 새로 생성
2. `.gitignore`에 `*-firebase-adminsdk-*.json` 추가 확인
3. Git 히스토리에서 파일 제거:
   ```bash
   git rm --cached luminary-4c626-firebase-adminsdk-*.json
   git commit -m "Remove Firebase service account key from Git"
   ```

### 문제 5: 인덱스 생성 시간이 오래 걸림

**증상**: 인덱스 생성이 완료되지 않음

**해결 방법**:
1. Firebase Console에서 인덱스 상태 확인
2. 데이터가 많은 경우 인덱스 생성에 시간이 걸릴 수 있음 (최대 1시간)
3. 인덱스가 "구성 중" 상태인 경우 기다리기

---

## ✅ 체크리스트

Firebase 설정이 완료되었는지 확인하세요:

- [ ] Firebase 프로젝트 생성 완료
- [ ] Firestore Database 활성화 완료
- [ ] 서비스 계정 키 생성 및 다운로드 완료
- [ ] 로컬 환경에 서비스 계정 키 파일 배치 또는 환경 변수 설정
- [ ] `.env` 파일에 `FIREBASE_PROJECT_ID` 설정
- [ ] 필요한 Firestore 인덱스 생성 완료
- [ ] Firestore 보안 규칙 설정 완료 (프로덕션)
- [ ] 개발 서버 실행 및 연결 테스트 완료
- [ ] 로그인 기능 정상 작동 확인
- [ ] 이메일 가져오기 기능 정상 작동 확인

---

## 📚 참고 자료

- [Firebase 공식 문서](https://firebase.google.com/docs)
- [Firestore 문서](https://firebase.google.com/docs/firestore)
- [Firestore 보안 규칙](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore 인덱스](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**문서 최종 업데이트**: 2024년  
**작성자**: AI Inbox Solution Team

