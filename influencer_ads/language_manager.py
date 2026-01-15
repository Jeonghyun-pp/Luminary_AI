import os
from typing import Dict, Any
import streamlit as st

class LanguageManager:
    """다국어 지원 관리자"""
    
    def __init__(self):
        self.languages = {
            'ko': '한국어',
            'en': 'English',
            'ja': '日本語',
            'zh': '中文',
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'ru': 'Русский'
        }
        
        self.translations = {
            'ko': {
                'app_title': '📧 인플루언서 협찬 이메일 분류 시스템',
                'app_description': '🤖 Gmail API와 Naver HyperCLOVA AI를 활용한 스마트 협찬 이메일 자동 분류 시스템',
                'tier1_title': '🟢 1단계',
                'tier1_desc': '고정 금액만',
                'tier1_detail': '영상 제작 시 고정 비용 지급',
                'tier2_title': '🟡 2단계',
                'tier2_desc': '고정 + 조회수',
                'tier2_detail': '기본료 + 조회수 기반 추가 수익',
                'tier3_title': '🔴 3단계',
                'tier3_desc': '고정 + 조회수 + 판매',
                'tier3_detail': '복합 수익 구조',
                'settings_title': '⚙️ 설정',
                'email_count_label': '📊 가져올 이메일 수',
                'search_query_label': '🔍 검색 쿼리 (선택사항)',
                'search_query_placeholder': '예: is:unread',
                'fetch_button': '📥 이메일 가져오기',
                'reset_token_button': '🔄 인증 토큰 재설정',
                'statistics_title': '📊 통계',
                'total_emails': '📧 총 이메일',
                'fetching_emails': '🔄 이메일을 가져오는 중...',
                'classifying_emails': '분류 중...',
                'classification_complete': '✅ 모든 이메일 분류가 완료되었습니다!',
                'no_emails_found': '⚠️ 검색된 이메일이 없습니다.',
                'emails_fetched': '✅ {count}개의 이메일을 가져왔습니다.',
                'download_csv': '📥 결과를 CSV로 다운로드',
                'calendar_title': '📅 일정 관리',
                'add_event': '➕ 일정 추가',
                'event_title': '제목',
                'event_date': '날짜',
                'event_time': '시간',
                'event_description': '설명',
                'save_event': '💾 일정 저장',
                'upcoming_events': '📋 다가오는 일정',
                'no_events': '등록된 일정이 없습니다.',
                'language_settings': '🌐 언어 설정',
                'select_language': '언어 선택'
            },
            'en': {
                'app_title': '📧 Influencer Sponsorship Email Classification System',
                'app_description': '🤖 Smart sponsorship email auto-classification system using Gmail API and Naver HyperCLOVA AI',
                'tier1_title': '🟢 Tier 1',
                'tier1_desc': 'Fixed Amount Only',
                'tier1_detail': 'Fixed payment for video production',
                'tier2_title': '🟡 Tier 2',
                'tier2_desc': 'Fixed + Views',
                'tier2_detail': 'Base fee + additional revenue based on views',
                'tier3_title': '🔴 Tier 3',
                'tier3_desc': 'Fixed + Views + Sales',
                'tier3_detail': 'Complex revenue structure',
                'settings_title': '⚙️ Settings',
                'email_count_label': '📊 Number of emails to fetch',
                'search_query_label': '🔍 Search query (optional)',
                'search_query_placeholder': 'e.g., is:unread',
                'fetch_button': '📥 Fetch Emails',
                'reset_token_button': '🔄 Reset Auth Token',
                'statistics_title': '📊 Statistics',
                'total_emails': '📧 Total Emails',
                'fetching_emails': '🔄 Fetching emails...',
                'classifying_emails': 'Classifying...',
                'classification_complete': '✅ All email classification completed!',
                'no_emails_found': '⚠️ No emails found.',
                'emails_fetched': '✅ Fetched {count} emails.',
                'download_csv': '📥 Download Results as CSV',
                'calendar_title': '📅 Schedule Management',
                'add_event': '➕ Add Event',
                'event_title': 'Title',
                'event_date': 'Date',
                'event_time': 'Time',
                'event_description': 'Description',
                'save_event': '💾 Save Event',
                'upcoming_events': '📋 Upcoming Events',
                'no_events': 'No events scheduled.',
                'language_settings': '🌐 Language Settings',
                'select_language': 'Select Language'
            },
            'ja': {
                'app_title': '📧 インフルエンサー協賛メール分類システム',
                'app_description': '🤖 Gmail APIとNaver HyperCLOVA AIを活用したスマート協賛メール自動分類システム',
                'tier1_title': '🟢 レベル1',
                'tier1_desc': '固定金額のみ',
                'tier1_detail': '動画制作時の固定費用支払い',
                'tier2_title': '🟡 レベル2',
                'tier2_desc': '固定 + 再生回数',
                'tier2_detail': '基本料 + 再生回数ベースの追加収益',
                'tier3_title': '🔴 レベル3',
                'tier3_desc': '固定 + 再生回数 + 販売',
                'tier3_detail': '複合収益構造',
                'settings_title': '⚙️ 設定',
                'email_count_label': '📊 取得するメール数',
                'search_query_label': '🔍 検索クエリ（任意）',
                'search_query_placeholder': '例: is:unread',
                'fetch_button': '📥 メール取得',
                'reset_token_button': '🔄 認証トークンリセット',
                'statistics_title': '📊 統計',
                'total_emails': '📧 総メール数',
                'fetching_emails': '🔄 メールを取得中...',
                'classifying_emails': '分類中...',
                'classification_complete': '✅ すべてのメール分類が完了しました！',
                'no_emails_found': '⚠️ メールが見つかりません。',
                'emails_fetched': '✅ {count}件のメールを取得しました。',
                'download_csv': '📥 結果をCSVでダウンロード',
                'calendar_title': '📅 スケジュール管理',
                'add_event': '➕ イベント追加',
                'event_title': 'タイトル',
                'event_date': '日付',
                'event_time': '時間',
                'event_description': '説明',
                'save_event': '💾 イベント保存',
                'upcoming_events': '📋 今後のイベント',
                'no_events': 'スケジュールされたイベントはありません。',
                'language_settings': '🌐 言語設定',
                'select_language': '言語選択'
            }
        }
    
    def get_language(self) -> str:
        """현재 선택된 언어 반환"""
        return st.session_state.get('selected_language', 'ko')
    
    def set_language(self, language: str):
        """언어 설정"""
        st.session_state['selected_language'] = language
    
    def get_text(self, key: str, **kwargs) -> str:
        """번역된 텍스트 반환"""
        current_lang = self.get_language()
        text = self.translations.get(current_lang, {}).get(key, self.translations['ko'].get(key, key))
        
        # 문자열 포맷팅 처리
        if kwargs:
            try:
                text = text.format(**kwargs)
            except (KeyError, ValueError):
                pass
        
        return text
    
    def get_language_options(self) -> Dict[str, str]:
        """언어 옵션 반환"""
        return self.languages
    
    def translate_email_content(self, content: str, target_lang: str = None) -> str:
        """이메일 내용 번역 (간단한 키워드 매핑)"""
        if not target_lang:
            target_lang = self.get_language()
        
        # 간단한 키워드 번역 매핑
        keyword_translations = {
            'ko': {
                'sponsorship': '협찬',
                'collaboration': '제휴',
                'partnership': '파트너십',
                'advertisement': '광고',
                'promotion': '홍보',
                'influencer': '인플루언서',
                'marketing': '마케팅',
                'brand': '브랜드',
                'revenue': '수익',
                'payment': '지급',
                'fee': '수수료'
            },
            'en': {
                '협찬': 'sponsorship',
                '제휴': 'collaboration',
                '파트너십': 'partnership',
                '광고': 'advertisement',
                '홍보': 'promotion',
                '인플루언서': 'influencer',
                '마케팅': 'marketing',
                '브랜드': 'brand',
                '수익': 'revenue',
                '지급': 'payment',
                '수수료': 'fee'
            },
            'ja': {
                'sponsorship': '協賛',
                'collaboration': 'コラボレーション',
                'partnership': 'パートナーシップ',
                'advertisement': '広告',
                'promotion': 'プロモーション',
                'influencer': 'インフルエンサー',
                'marketing': 'マーケティング',
                'brand': 'ブランド',
                'revenue': '収益',
                'payment': '支払い',
                'fee': '手数料'
            }
        }
        
        translated_content = content
        translations = keyword_translations.get(target_lang, {})
        
        for original, translated in translations.items():
            translated_content = translated_content.replace(original, translated)
        
        return translated_content
