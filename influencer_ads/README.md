# 📧 인플루언서 협찬 이메일 분류 시스템

Gmail API와 Naver HyperCLOVA API를 활용하여 협찬 요청 이메일을 자동으로 분류하는 Streamlit 애플리케이션입니다.

## 🌟 새로운 기능

### 🌐 외국어 이메일 번역
- **네이버 번역 API**를 이용한 자동 번역
- 외국어 이메일을 한국어로 번역 후 분류
- 원문과 번역문 모두 확인 가능

### 📅 협찬 일정 자동 분석
- 이메일에서 **날짜/시간 정보 자동 추출**
- **Google Calendar 링크 자동 생성**
- 마감일, 이벤트 등 일정 유형 자동 분류

### 💖 찜 기능
- 관심 있는 협찬 이메일을 찜 목록에 저장
- 찜한 이메일만 따로 관리 가능

### 📧 회신 기능
- **기본 회신 템플릿** 제공 (수락/거절)
- 템플릿 수정 후 **Gmail로 직접 전송**
- 분류별 맞춤 회신 템플릿

## ✨ 주요 기능

- Gmail API를 통한 이메일 자동 수집
- Naver HyperCLOVA를 활용한 지능형 이메일 분류 (다국어 지원)
- 3단계 협찬 유형 자동 분류:
  - **1단계**: 고정 금액만 (영상 제작 및 게시)
  - **2단계**: 고정 금액 + 조회수 기반 수익
  - **3단계**: 고정 금액 + 조회수 수익 + 제품 판매 수수료
- 직관적인 Streamlit UI
- 분류 결과 CSV 다운로드
- **Google Calendar 연동** 일정 관리

## 📋 필요 조건

- Python 3.8 이상
- Google Cloud 계정 (Gmail API + Calendar API 사용)
- Naver Cloud Platform 계정 (HyperCLOVA API 사용)
- 네이버 개발자센터 계정 (번역 API 사용)

## 🚀 설치 방법

### 1. 프로젝트 클론 또는 다운로드

```bash
cd influencer_ads
```

### 2. 가상환경 생성 (권장)

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. 필요한 패키지 설치

```bash
pip install -r requirements.txt
```

### 4. Google API 설정

#### 4.1 Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **APIs & Services** > **Library**에서 다음 API 활성화:
   - **Gmail API**
   - **Google Calendar API** (새로 추가)
4. **APIs & Services** > **Credentials**에서 OAuth 2.0 클라이언트 ID 생성:
   - 애플리케이션 유형: 데스크톱 애플리케이션
   - 이름: 임의로 설정
5. 생성된 클라이언트 ID의 JSON 파일 다운로드
6. 다운로드한 파일을 `credentials.json`으로 이름 변경 후 프로젝트 루트에 저장
7. **OAuth 동의 화면** 설정:
   - 사용자 유형: 외부 선택
   - 테스트 사용자에 본인 Gmail 주소 추가

### 5. Naver HyperCLOVA API 설정

#### 5.1 API 키 발급

1. [Naver Cloud Platform](https://www.ncloud.com/)에 로그인
2. 콘솔 > "AI·NAVER API" > "CLOVA Studio" 선택
3. 서비스 신청 및 활성화
4. 좌측 메뉴 > "도메인" > "API Key 관리"
5. "API Key 생성" 버튼 클릭
6. 생성된 API 키 복사

#### 5.2 환경 변수 설정

1. `.env.example` 파일을 `.env`로 복사
2. `.env` 파일에 API 키 입력:

```env
# Naver CLOVA Studio API Key
CLOVA_STUDIO_KEY=nv-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

**참고**: Request ID는 자동으로 생성됩니다 (UUID 사용).

## 💻 사용 방법

### 1. 애플리케이션 실행

```bash
streamlit run app.py
```

### 2. 첫 실행 시 Google 인증

- 브라우저가 자동으로 열리며 Google 로그인 화면이 표시됩니다
- Gmail 계정으로 로그인하고 권한을 승인합니다
- **Gmail API**와 **Calendar API** 권한을 모두 승인해야 합니다
- 인증 정보는 `token.pickle`과 `token_calendar.pickle` 파일로 저장됩니다

### 3. 언어 설정

- 사이드바에서 **🌐 언어 설정** 섹션을 찾습니다
- 드롭다운에서 원하는 언어를 선택합니다
- 선택한 언어로 즉시 인터페이스가 변경됩니다

### 4. 이메일 분류

1. 사이드바에서 가져올 이메일 수 설정
2. 필요시 검색 쿼리 입력 (예: `is:unread`, `after:2024/01/01`)
3. "📥 이메일 가져오기" 버튼 클릭
4. 시스템이 자동으로 이메일을 가져와 분류합니다
5. 탭을 통해 단계별로 분류된 이메일을 확인합니다

### 5. 캘린더 일정 관리

- **📅 일정 관리** 섹션에서 다가오는 일정을 확인할 수 있습니다
- **➕ 일정 추가** 버튼으로 새로운 일정을 생성할 수 있습니다
- 협찬 이메일에서 자동으로 일정을 생성할 수 있습니다

### 6. 결과 저장

- "📥 결과를 CSV로 다운로드" 버튼을 클릭하여 분류 결과를 저장할 수 있습니다

## 📁 프로젝트 구조

```
influencer_ads/
├── app.py                 # Streamlit 메인 애플리케이션
├── gmail_client.py        # Gmail API 클라이언트 (읽기 + 전송)
├── translation_client.py  # 네이버 번역 API 클라이언트 (새로 추가)
├── schedule_analyzer.py   # 협찬 일정 분석기 (새로 추가)
├── email_manager.py       # 이메일 관리 (찜, 회신 템플릿) (새로 추가)
├── classifier.py          # HyperCLOVA 기반 분류기
├── classifier_openai.py   # OpenAI 기반 분류기 (대안)
├── requirements.txt       # Python 패키지 의존성
├── .env                   # 환경 변수 (API 키)
├── .env.example          # 환경 변수 예시
├── credentials.json      # Google API 인증 정보 (Gmail)
├── token.pickle          # Gmail 인증 토큰 (자동 생성)
├── favorites.json         # 찜한 이메일 목록 (자동 생성)
├── reply_templates.json   # 회신 템플릿 (자동 생성)
└── README.md             # 프로젝트 문서
```

## 🔍 Gmail 검색 쿼리 예시

- `is:unread` - 읽지 않은 이메일만
- `from:example@gmail.com` - 특정 발신자
- `after:2024/01/01` - 특정 날짜 이후
- `subject:협찬` - 제목에 특정 키워드 포함
- `has:attachment` - 첨부파일이 있는 이메일

## ⚠️ 주의사항

1. **API 비용**: Naver HyperCLOVA API는 사용량에 따라 요금이 부과됩니다 (무료 크레딧 제공)
2. **API 제한**: Gmail API는 일일 쿼터 제한이 있습니다
3. **인증 정보 보안**: `credentials.json`, `token.pickle`, `.env` 파일은 절대 공개 저장소에 업로드하지 마세요
4. **첫 실행**: Gmail 인증 시 "앱이 확인되지 않음" 경고가 나타날 수 있습니다. "고급" > "앱 이름으로 이동"을 클릭하여 진행하세요
5. **HyperCLOVA 모델**: 현재 HCX-003 모델을 사용하며, 한국어 처리에 최적화되어 있습니다

## 🛠️ 문제 해결

### "credentials.json 파일이 없습니다" 오류
- Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성하고 credentials.json을 다운로드하세요

### "Naver HyperCLOVA API 키가 설정되지 않았습니다" 오류
- `.env` 파일을 생성하고 `CLOVA_STUDIO_KEY` 변수에 올바른 API 키를 입력하세요
- Naver Cloud Platform에서 CLOVA Studio 서비스가 활성화되어 있는지 확인하세요
- API 키는 `nv-`로 시작합니다

### API 호출 오류 (401, 403)
- API 키가 올바른지 확인하세요 (복사할 때 공백이 포함되지 않았는지 확인)
- CLOVA Studio에서 해당 모델(HCX-003)에 대한 권한이 있는지 확인하세요
- API 키 할당량이 남아있는지 확인하세요

### Gmail 인증 실패
- `token.pickle` 파일을 삭제하고 다시 시도하세요
- Google Cloud Console에서 OAuth 동의 화면이 올바르게 설정되었는지 확인하세요

### "검색된 이메일이 없습니다" 오류
- **인증 문제**: 사이드바의 "🔄 인증 토큰 재설정" 버튼 클릭
- **검색 옵션 변경**: "🤖 자동" 대신 "📅 최근 이메일" 또는 "📬 읽지 않은 이메일" 선택
- **기본 테스트**: 오류 메시지 하단의 "🧪 기본 이메일 테스트" 버튼 클릭
- **Gmail 직접 확인**: Gmail에서 협찬 관련 키워드로 직접 검색해보기

## 📝 라이선스

이 프로젝트는 개인 사용을 위한 것입니다.

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해주세요.

