import streamlit as st
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from gmail_client import GmailClient
from classifier import SponsorshipClassifier
from translation_client import TranslationClient
from schedule_analyzer import ScheduleAnalyzer
from email_manager import EmailManager
from calendar_client import CalendarClient
import pandas as pd

# 환경 변수 로드
load_dotenv()

# 페이지 설정
st.set_page_config(
    page_title="협찬 이메일 분류 시스템",
    page_icon="📧",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 커스텀 CSS 스타일
st.markdown("""
<style>
    /* Google Fonts - Noto Sans KR 임포트 */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    
    /* 전체 폰트 적용 */
    html, body, [class*="css"], .stMarkdown {
        font-family: 'Noto Sans KR', sans-serif !important;
    }
    
    /* 메인 타이틀 스타일 */
    h1 {
        color: #4A90E2 !important;
        font-weight: 700 !important;
        text-align: center;
        padding: 1.5rem 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    
    /* 서브 헤더 스타일 */
    h2, h3 {
        color: #5B7C99 !important;
        font-weight: 600 !important;
    }
    
    /* 카드 스타일 */
    .stContainer {
        background-color: white;
        border-radius: 15px;
        padding: 1.5rem;
        box-shadow: 0 2px 10px rgba(74, 144, 226, 0.1);
        margin-bottom: 1rem;
    }
    
    /* 버튼 스타일 */
    .stButton > button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 25px;
        padding: 0.6rem 2rem;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(74, 144, 226, 0.4);
    }
    
    /* 사이드바 스타일 */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #E6F3FF 0%, #F0F8FF 100%);
    }
    
    /* 프로그레스 바 스타일 */
    .stProgress > div > div > div > div {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    }
    
    /* 메트릭 스타일 */
    [data-testid="stMetricValue"] {
        color: #4A90E2;
        font-size: 2rem !important;
        font-weight: 700 !important;
    }
    
    /* 탭 스타일 */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    
    .stTabs [data-baseweb="tab"] {
        border-radius: 10px 10px 0 0;
        padding: 10px 20px;
        font-weight: 600;
    }
    
    /* Divider 스타일 */
    hr {
        margin: 2rem 0;
        border: none;
        height: 2px;
        background: linear-gradient(90deg, transparent, #4A90E2, transparent);
    }
    
    /* 성공 메시지 스타일 */
    .stSuccess {
        background-color: #D4EDDA;
        border-left: 4px solid #28A745;
        border-radius: 8px;
    }
    
    /* 경고 메시지 스타일 */
    .stWarning {
        background-color: #FFF3CD;
        border-left: 4px solid #FFC107;
        border-radius: 8px;
    }
    
    /* 에러 메시지 스타일 */
    .stError {
        background-color: #F8D7DA;
        border-left: 4px solid #DC3545;
        border-radius: 8px;
    }
    
    /* 정보 박스 스타일 */
    .stInfo {
        background-color: #D1ECF1;
        border-left: 4px solid #17A2B8;
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

# 제목 및 설명
st.title("📧 인플루언서 협찬 이메일 분류 시스템")

# 소개 섹션
st.markdown("""
<div style='background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); 
            padding: 1.5rem; border-radius: 15px; margin-bottom: 2rem;'>
    <p style='color: #5B7C99; font-size: 1.1rem; margin: 0; text-align: center;'>
        🤖 <strong>Gmail API</strong>와 <strong>Naver HyperCLOVA AI</strong>를 활용한 
        스마트 협찬 이메일 자동 분류 시스템
    </p>
</div>
""", unsafe_allow_html=True)

# 카테고리 소개
col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("""
    <div style='background: white; padding: 1.5rem; border-radius: 15px; 
                box-shadow: 0 2px 10px rgba(74, 144, 226, 0.1); text-align: center;'>
        <h3 style='color: #52C41A; margin-top: 0;'>🟢 1단계</h3>
        <p style='color: #666;'>고정 금액만</p>
        <p style='font-size: 0.9rem; color: #999;'>영상 제작 시 고정 비용 지급</p>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown("""
    <div style='background: white; padding: 1.5rem; border-radius: 15px; 
                box-shadow: 0 2px 10px rgba(74, 144, 226, 0.1); text-align: center;'>
        <h3 style='color: #FAAD14; margin-top: 0;'>🟡 2단계</h3>
        <p style='color: #666;'>고정 + 조회수</p>
        <p style='font-size: 0.9rem; color: #999;'>기본료 + 조회수 기반 추가 수익</p>
    </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown("""
    <div style='background: white; padding: 1.5rem; border-radius: 15px; 
                box-shadow: 0 2px 10px rgba(74, 144, 226, 0.1); text-align: center;'>
        <h3 style='color: #F5222D; margin-top: 0;'>🔴 3단계</h3>
        <p style='color: #666;'>고정 + 조회수 + 판매</p>
        <p style='font-size: 0.9rem; color: #999;'>복합 수익 구조</p>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)


def initialize_clients():
    """클라이언트 초기화"""
    try:
        # Naver HyperCLOVA API 키 확인
        clova_api_key = os.getenv('CLOVA_STUDIO_KEY', 'nv-bf2506d5f74f4d0c921a472cb24d8c44tQby')
        
        if not clova_api_key:
            st.error("❌ Naver HyperCLOVA API 키가 설정되지 않았습니다. .env 파일을 확인하세요.")
            st.info("""
**필요한 환경 변수:**
- CLOVA_STUDIO_KEY (Naver CLOVA Studio API 키)
- NAVER_CLIENT_ID (네이버 번역 API 클라이언트 ID)
- NAVER_CLIENT_SECRET (네이버 번역 API 클라이언트 시크릿)

**API 키 발급 방법:**
1. https://www.ncloud.com/ 접속
2. CLOVA Studio 서비스 신청
3. 도메인 > API Key 관리에서 키 발급
4. 네이버 개발자센터에서 번역 API 키 발급
            """)
            return None, None, None, None, None, None
        
        # Gmail 클라이언트 초기화
        gmail_client = GmailClient()
        
        # 분류기 초기화
        classifier = SponsorshipClassifier(clova_api_key)
        
        # 번역 클라이언트 초기화
        translation_client = TranslationClient()
        
        # 일정 분석기 초기화
        schedule_analyzer = ScheduleAnalyzer()
        
        # 이메일 관리자 초기화
        email_manager = EmailManager()
        
        # 캘린더 클라이언트 초기화
        calendar_client = CalendarClient()
        
        return gmail_client, classifier, translation_client, schedule_analyzer, email_manager, calendar_client
    
    except FileNotFoundError as e:
        st.error(f"❌ {str(e)}")
        st.info("""
**Gmail API 설정 방법:**
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성
3. Gmail API 활성화
4. OAuth 2.0 클라이언트 ID 생성 (데스크톱 앱)
5. credentials.json 파일 다운로드 후 프로젝트 루트에 저장
        """)
        return None, None, None, None, None, None
    
    except Exception as e:
        st.error(f"❌ 초기화 오류: {str(e)}")
        return None, None, None, None, None, None


def display_email_card(email, classification, explanation, details, translation_data=None, schedule_data=None, email_manager=None, calendar_client=None, tab_prefix=""):
    """이메일 카드 UI (개선된 디자인)"""
    # 카테고리별 색상 및 라벨
    category_info = {
        'tier1': {'icon': '🟢', 'color': '#52C41A', 'label': '1단계', 'bg': '#F6FFED'},
        'tier2': {'icon': '🟡', 'color': '#FAAD14', 'label': '2단계', 'bg': '#FFFBE6'},
        'tier3': {'icon': '🔴', 'color': '#F5222D', 'label': '3단계', 'bg': '#FFF1F0'},
        'not_sponsorship': {'icon': '⚪', 'color': '#8C8C8C', 'label': '협찬 아님', 'bg': '#FAFAFA'},
        'unclear': {'icon': '🔵', 'color': '#1890FF', 'label': '불분명', 'bg': '#E6F7FF'}
    }
    
    info = category_info.get(classification, category_info['unclear'])
    
    # 번역된 제목 사용
    display_subject = email['subject']
    if translation_data and translation_data.get('is_translated'):
        display_subject = translation_data['translated_subject']
    
    # 카드 컨테이너
    st.markdown(f"""
    <div style='background: white; padding: 1.5rem; border-radius: 15px; 
                box-shadow: 0 4px 15px rgba(74, 144, 226, 0.1); 
                margin-bottom: 1.5rem; border-left: 5px solid {info["color"]};'>
        <div style='display: flex; align-items: center; margin-bottom: 1rem;'>
            <span style='font-size: 1.5rem; margin-right: 0.5rem;'>{info["icon"]}</span>
            <h3 style='margin: 0; color: #2C3E50; flex-grow: 1;'>{display_subject}</h3>
            <span style='background: {info["bg"]}; color: {info["color"]}; 
                         padding: 0.3rem 1rem; border-radius: 20px; 
                         font-weight: 600; font-size: 0.9rem;'>{info["label"]}</span>
        </div>
    """, unsafe_allow_html=True)
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.markdown(f"**👤 발신자:** {email['sender']}")
        st.markdown(f"**📅 날짜:** {email['date']}")
        
        # 번역 정보 표시
        if translation_data and translation_data.get('is_translated'):
            st.markdown(f"**🌐 언어:** {translation_data['detected_language']} → 한국어")
        
        # 일정 정보 표시
        if schedule_data and schedule_data.get('has_schedule'):
            st.markdown(f"**📅 일정:** {schedule_data['calendar_event']['datetime_display']}")
            
            # 캘린더 추가 버튼들
            col_cal1, col_cal2 = st.columns(2)
            
            with col_cal1:
                if st.button("📅 캘린더에 추가", key=f"add_calendar_{tab_prefix}_{email['id']}"):
                    if calendar_client:
                        result = calendar_client.create_event(
                            title=email['subject'],
                            description=email.get('body', email.get('snippet', '')),
                            start_datetime=schedule_data['calendar_event']['start'],
                            end_datetime=schedule_data['calendar_event']['end']
                        )
                        
                        if result['success']:
                            st.success(result['message'])
                        else:
                            st.error(result['message'])
                    else:
                        st.error("캘린더 클라이언트가 초기화되지 않았습니다.")
            
            with col_cal2:
                if schedule_data['calendar_event']['calendar_link']:
                    st.markdown(f"[🔗 링크로 추가]({schedule_data['calendar_event']['calendar_link']})")
        
        with st.expander("📄 이메일 본문 보기"):
            # 번역된 본문 사용
            if translation_data and translation_data.get('is_translated'):
                st.markdown("**번역된 내용:**")
                body = translation_data['translated_body']
                if len(body) > 1000:
                    st.text(body[:1000] + "...")
                else:
                    st.text(body)
                
                with st.expander("원문 보기"):
                    original_body = translation_data['original_body']
                    if len(original_body) > 1000:
                        st.text(original_body[:1000] + "...")
                    else:
                        st.text(original_body)
            else:
                body = email.get('body', email.get('snippet', ''))
                if len(body) > 1000:
                    st.text(body[:1000] + "...")
                else:
                    st.text(body)
    
    with col2:
        st.markdown(f"""
        <div style='background: {info["bg"]}; padding: 1rem; border-radius: 10px;'>
            <p style='margin: 0; color: {info["color"]}; font-weight: 600;'>📋 분류 결과</p>
            <p style='margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;'>{explanation}</p>
        </div>
        """, unsafe_allow_html=True)
        
        # 찜 기능
        if email_manager:
            is_favorite = email_manager.is_favorite(email['id'])
            # 탭 접두사와 이메일 ID를 조합한 고유 키 생성
            unique_key = f"{tab_prefix}_{email['id']}"
            
            if is_favorite:
                if st.button("💖 찜 해제", key=f"unfavorite_{unique_key}"):
                    email_manager.remove_from_favorites(email['id'])
                    st.rerun()
            else:
                if st.button("🤍 찜하기", key=f"favorite_{unique_key}"):
                    email_manager.add_to_favorites(email, classification, explanation)
                    st.rerun()
        
        if details:
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("**📊 상세 정보:**")
            for key, value in details.items():
                st.markdown(f"• **{key}:** {value}")
    
    st.markdown("</div>", unsafe_allow_html=True)


def main():
    """메인 함수"""
    
    # 사이드바 설정
    with st.sidebar:
        st.markdown("""
        <div style='text-align: center; padding: 1rem 0;'>
            <h2 style='color: #4A90E2; margin: 0;'>⚙️ 설정</h2>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        max_emails = st.slider(
            "📊 가져올 이메일 수",
            min_value=5,
            max_value=50,
            value=20,
            step=5
        )
        
        # 검색 옵션
        search_option = st.selectbox(
            "🔍 검색 옵션",
            options=['auto', 'custom', 'recent', 'unread'],
            format_func=lambda x: {
                'auto': '🤖 자동 (협찬 키워드 검색)',
                'custom': '✏️ 사용자 정의',
                'recent': '📅 최근 이메일',
                'unread': '📬 읽지 않은 이메일'
            }[x]
        )
        
        search_query = ""
        if search_option == 'custom':
            search_query = st.text_input(
                "검색 쿼리 입력",
                placeholder="예: from:example@gmail.com",
                help="Gmail 검색 문법을 사용할 수 있습니다"
            )
        elif search_option == 'recent':
            search_query = "newer_than:7d"  # 최근 7일
        elif search_option == 'unread':
            search_query = "is:unread"
        
        st.markdown("<br>", unsafe_allow_html=True)
        
        # 토큰 재설정 버튼 추가
        if st.button("🔄 인증 토큰 재설정", help="Gmail 인증 문제가 있을 때 사용"):
            if os.path.exists('token.pickle'):
                os.remove('token.pickle')
            st.success("✅ 인증 토큰이 삭제되었습니다. 새로 인증하세요.")
        
        fetch_button = st.button("📥 이메일 가져오기", type="primary", use_container_width=True)
        
        st.markdown("<br><br>", unsafe_allow_html=True)
        
        st.markdown("""
        <div style='background: white; padding: 1rem; border-radius: 10px; 
                    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.15);'>
            <h3 style='color: #4A90E2; margin-top: 0; text-align: center;'>📊 통계</h3>
        """, unsafe_allow_html=True)
        
        if 'classified_emails' in st.session_state:
            emails = st.session_state['classified_emails']
            
            # 카테고리별 개수
            tier1_count = sum(1 for e in emails if e['classification'] == 'tier1')
            tier2_count = sum(1 for e in emails if e['classification'] == 'tier2')
            tier3_count = sum(1 for e in emails if e['classification'] == 'tier3')
            
            st.metric("📧 총 이메일", len(emails))
            st.metric("🟢 1단계", tier1_count)
            st.metric("🟡 2단계", tier2_count)
            st.metric("🔴 3단계", tier3_count)
        
        st.markdown("</div>", unsafe_allow_html=True)
    
    # 메인 영역
    if fetch_button:
        with st.spinner("🔄 이메일을 가져오는 중..."):
            gmail_client, classifier, translation_client, schedule_analyzer, email_manager, calendar_client = initialize_clients()
            
            if gmail_client is None or classifier is None:
                return
            
            # 이메일 가져오기
            if search_option == 'auto':
                emails = gmail_client.search_sponsorship_emails(max_results=max_emails)
            else:
                emails = gmail_client.get_emails(query=search_query, max_results=max_emails)
            
            if not emails:
                st.warning("⚠️ 검색된 이메일이 없습니다.")
                
                # 디버깅 정보 표시
                st.markdown("### 🔍 문제 해결 방법")
                st.markdown("""
                **가능한 원인들:**
                
                1. **Gmail 인증 문제**
                   - 사이드바의 "🔄 인증 토큰 재설정" 버튼 클릭
                   - 브라우저에서 새로 인증 진행
                
                2. **검색 쿼리 문제**
                   - 검색 쿼리를 비워두고 다시 시도
                   - 또는 간단한 쿼리 사용: `is:unread`
                
                3. **Gmail API 권한 문제**
                   - Google Cloud Console에서 Gmail API 활성화 확인
                   - OAuth 동의 화면에서 테스트 사용자 추가 확인
                
                4. **이메일이 실제로 없는 경우**
                   - Gmail에서 협찬 관련 키워드로 직접 검색해보기
                   - 다른 검색어로 시도: `sponsorship`, `collaboration`, `partnership`
                """)
                
                # 간단한 테스트 버튼 추가
                if st.button("🧪 기본 이메일 테스트 (최근 5개)"):
                    test_emails = gmail_client.get_emails(query='', max_results=5)
                    if test_emails:
                        st.success(f"✅ {len(test_emails)}개의 기본 이메일을 가져왔습니다.")
                        st.info("Gmail 연결은 정상입니다. 검색 쿼리를 확인해보세요.")
                    else:
                        st.error("❌ Gmail 연결에 문제가 있습니다. 인증을 다시 시도해주세요.")
                
                return
            
            st.success(f"✅ {len(emails)}개의 이메일을 가져왔습니다.")
        
        # 이메일 분류
        classified_emails = []
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        import time
        
        for i, email in enumerate(emails):
            status_text.text(f"분류 및 분석 중... ({i+1}/{len(emails)})")
            
            # 번역 수행
            translation_data = None
            if translation_client:
                translation_data = translation_client.translate_email(email)
            
            # 번역된 이메일로 분류 수행
            email_for_classification = email
            if translation_data and translation_data.get('is_translated'):
                email_for_classification = {
                    **email,
                    'subject': translation_data['translated_subject'],
                    'body': translation_data['translated_body']
                }
            
            # 분류 수행
            classification, explanation, details = classifier.classify_email(email_for_classification)
            
            # 일정 분석 수행
            schedule_data = None
            if schedule_analyzer:
                schedule_data = schedule_analyzer.analyze_schedule(email_for_classification)
            
            classified_emails.append({
                'email': email,
                'classification': classification,
                'explanation': explanation,
                'details': details,
                'translation_data': translation_data,
                'schedule_data': schedule_data
            })
            
            progress_bar.progress((i + 1) / len(emails))
            
            # API 제한 방지: 각 요청 사이에 1초 대기
            if i < len(emails) - 1:  # 마지막 요청 후에는 대기 안함
                time.sleep(1)
        
        status_text.empty()
        progress_bar.empty()
        
        # 세션 상태에 저장
        st.session_state['classified_emails'] = classified_emails
        
        st.success("✅ 모든 이메일 분류가 완료되었습니다!")
    
    # 분류된 이메일 표시
    if 'classified_emails' in st.session_state:
        classified_emails = st.session_state['classified_emails']
        
        # 이메일 관리자 초기화 (세션 상태에서 가져오거나 새로 생성)
        if 'email_manager' not in st.session_state:
            try:
                email_manager = EmailManager()
                st.session_state['email_manager'] = email_manager
            except:
                email_manager = None
        else:
            email_manager = st.session_state['email_manager']
        
        # 캘린더 클라이언트 초기화 (세션 상태에서 가져오거나 새로 생성)
        if 'calendar_client' not in st.session_state:
            try:
                calendar_client = CalendarClient()
                st.session_state['calendar_client'] = calendar_client
            except:
                calendar_client = None
        else:
            calendar_client = st.session_state['calendar_client']
        
        # 필터 탭
        tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs(["🟢 1단계", "🟡 2단계", "🔴 3단계", "📋 전체", "💖 찜한 이메일", "📧 회신", "📅 캘린더"])
        
        with tab1:
            st.header("1단계: 고정 금액만")
            tier1_emails = [e for e in classified_emails if e['classification'] == 'tier1']
            if tier1_emails:
                for item in tier1_emails:
                    display_email_card(
                        item['email'],
                        item['classification'],
                        item['explanation'],
                        item['details'],
                        item.get('translation_data'),
                        item.get('schedule_data'),
                        email_manager,
                        calendar_client,
                        "tier1"
                    )
            else:
                st.info("해당하는 이메일이 없습니다.")
        
        with tab2:
            st.header("2단계: 고정 금액 + 조회수 수익")
            tier2_emails = [e for e in classified_emails if e['classification'] == 'tier2']
            if tier2_emails:
                for item in tier2_emails:
                    display_email_card(
                        item['email'],
                        item['classification'],
                        item['explanation'],
                        item['details'],
                        item.get('translation_data'),
                        item.get('schedule_data'),
                        email_manager,
                        calendar_client,
                        "tier2"
                    )
            else:
                st.info("해당하는 이메일이 없습니다.")
        
        with tab3:
            st.header("3단계: 고정 금액 + 조회수 + 판매 수수료")
            tier3_emails = [e for e in classified_emails if e['classification'] == 'tier3']
            if tier3_emails:
                for item in tier3_emails:
                    display_email_card(
                        item['email'],
                        item['classification'],
                        item['explanation'],
                        item['details'],
                        item.get('translation_data'),
                        item.get('schedule_data'),
                        email_manager,
                        calendar_client,
                        "tier3"
                    )
            else:
                st.info("해당하는 이메일이 없습니다.")
        
        with tab4:
            st.header("전체 이메일")
            for item in classified_emails:
                display_email_card(
                    item['email'],
                    item['classification'],
                    item['explanation'],
                    item['details'],
                    item.get('translation_data'),
                    item.get('schedule_data'),
                    email_manager,
                    calendar_client,
                    "all"
                )
        
        with tab5:
            st.header("💖 찜한 이메일")
            favorites = email_manager.get_favorites() if email_manager else []
            if favorites:
                for i, favorite in enumerate(favorites):
                    with st.container():
                        st.markdown(f"""
                        <div style='background: white; padding: 1rem; border-radius: 10px; 
                                    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.1); margin-bottom: 1rem;'>
                            <h4 style='margin: 0; color: #2C3E50;'>📧 {favorite['subject']}</h4>
                        </div>
                        """, unsafe_allow_html=True)
                        
                        col1, col2 = st.columns([3, 1])
                        
                        with col1:
                            st.write(f"**👤 발신자:** {favorite['sender']}")
                            st.write(f"**📅 날짜:** {favorite['date']}")
                            st.write(f"**🏷️ 분류:** {favorite['classification']}")
                            st.write(f"**💭 설명:** {favorite['explanation']}")
                        
                        with col2:
                            if st.button("🗑️ 찜 해제", key=f"remove_favorite_{i}"):
                                email_manager.remove_from_favorites(favorite['id'])
                                st.rerun()
            else:
                st.info("찜한 이메일이 없습니다.")
        
        with tab6:
            st.header("📧 회신")
            
            # 회신할 이메일 선택
            reply_email_id = st.selectbox(
                "회신할 이메일 선택",
                options=[item['email']['id'] for item in classified_emails],
                format_func=lambda x: next(item['email']['subject'] for item in classified_emails if item['email']['id'] == x)
            )
            
            if reply_email_id:
                selected_email = next(item for item in classified_emails if item['email']['id'] == reply_email_id)
                
                # 회신 템플릿 선택
                template_type = st.selectbox(
                    "회신 템플릿 선택",
                    options=['tier1', 'tier2', 'tier3', 'decline'],
                    format_func=lambda x: {
                        'tier1': '1단계 협찬 수락',
                        'tier2': '2단계 협찬 수락', 
                        'tier3': '3단계 협찬 수락',
                        'decline': '협찬 거절'
                    }[x]
                )
                
                # 템플릿 가져오기
                template = email_manager.get_reply_template(template_type)
                
                # 제목 수정
                reply_subject = st.text_input("제목", value=template['subject'])
                
                # 본문 수정
                reply_body = st.text_area("본문", value=template['body'], height=300)
                
                # 발신자 이메일 추출
                sender_email = selected_email['email']['sender']
                if '<' in sender_email and '>' in sender_email:
                    sender_email = sender_email.split('<')[1].split('>')[0]
                
                col1, col2 = st.columns(2)
                
                with col1:
                    if st.button("📤 회신 전송", type="primary"):
                        # Gmail 클라이언트 초기화
                        try:
                            gmail_client = GmailClient()
                            result = gmail_client.send_reply(
                                reply_email_id,
                                reply_subject,
                                reply_body,
                                sender_email
                            )
                            
                            if result['success']:
                                st.success(result['message'])
                            else:
                                st.error(result['message'])
                        except Exception as e:
                            st.error(f"Gmail 클라이언트 초기화 실패: {str(e)}")
                
                with col2:
                    if st.button("💾 템플릿 저장"):
                        email_manager.update_reply_template(template_type, reply_subject, reply_body)
                        st.success("템플릿이 저장되었습니다.")
        
        with tab7:
            st.header("📅 캘린더 관리")
            
            if calendar_client:
                col_cal1, col_cal2 = st.columns(2)
                
                with col_cal1:
                    if st.button("🔐 캘린더 인증", type="primary"):
                        if calendar_client.authenticate():
                            st.success("✅ 캘린더 인증이 완료되었습니다!")
                        else:
                            st.error("❌ 캘린더 인증에 실패했습니다.")
                
                with col_cal2:
                    if st.button("📅 다가오는 일정 조회"):
                        result = calendar_client.get_upcoming_events(max_results=10)
                        if result['success']:
                            st.success(result['message'])
                            events = result['events']
                            
                            if events:
                                for event in events:
                                    start = event['start'].get('dateTime', event['start'].get('date'))
                                    st.write(f"**{event['summary']}**")
                                    st.write(f"📅 {start}")
                                    if 'description' in event:
                                        st.write(f"📝 {event['description'][:100]}...")
                                    st.markdown("---")
                            else:
                                st.info("다가오는 일정이 없습니다.")
                        else:
                            st.error(result['message'])
                
                # 일정이 있는 이메일들 표시
                st.markdown("### 📧 일정이 포함된 이메일")
                scheduled_emails = [item for item in classified_emails if item.get('schedule_data', {}).get('has_schedule')]
                
                if scheduled_emails:
                    for item in scheduled_emails:
                        with st.expander(f"📅 {item['email']['subject']}"):
                            schedule_data = item['schedule_data']
                            st.write(f"**일정:** {schedule_data['calendar_event']['datetime_display']}")
                            st.write(f"**발신자:** {item['email']['sender']}")
                            
                            col1, col2 = st.columns(2)
                            with col1:
                                if st.button("📅 캘린더에 추가", key=f"calendar_add_{item['email']['id']}"):
                                    result = calendar_client.create_event(
                                        title=item['email']['subject'],
                                        description=item['email'].get('body', item['email'].get('snippet', '')),
                                        start_datetime=schedule_data['calendar_event']['start'],
                                        end_datetime=schedule_data['calendar_event']['end']
                                    )
                                    
                                    if result['success']:
                                        st.success(result['message'])
                                    else:
                                        st.error(result['message'])
                            
                            with col2:
                                if schedule_data['calendar_event']['calendar_link']:
                                    st.markdown(f"[🔗 링크로 추가]({schedule_data['calendar_event']['calendar_link']})")
                else:
                    st.info("일정이 포함된 이메일이 없습니다.")
            else:
                st.error("캘린더 클라이언트가 초기화되지 않았습니다.")
        
        # CSV 다운로드 기능
        if st.button("📥 결과를 CSV로 다운로드"):
            # DataFrame 생성
            data = []
            for item in classified_emails:
                email = item['email']
                data.append({
                    '제목': email['subject'],
                    '발신자': email['sender'],
                    '날짜': email['date'],
                    '분류': item['classification'],
                    '설명': item['explanation'],
                    '상세정보': str(item['details'])
                })
            
            df = pd.DataFrame(data)
            csv = df.to_csv(index=False, encoding='utf-8-sig')
            
            st.download_button(
                label="CSV 파일 다운로드",
                data=csv,
                file_name="sponsorship_classification.csv",
                mime="text/csv"
            )


if __name__ == "__main__":
    main()

