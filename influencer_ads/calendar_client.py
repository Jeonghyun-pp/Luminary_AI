import os
import pickle
from datetime import datetime, timedelta
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import streamlit as st

# Google Calendar API 스코프
SCOPES = ['https://www.googleapis.com/auth/calendar']

class CalendarClient:
    """Google Calendar API 클라이언트"""
    
    def __init__(self):
        """캘린더 클라이언트 초기화"""
        self.service = None
        self.credentials = None
        
    def authenticate(self):
        """Google Calendar API 인증"""
        try:
            # 기존 토큰 확인
            if os.path.exists('calendar_token.pickle'):
                with open('calendar_token.pickle', 'rb') as token:
                    self.credentials = pickle.load(token)
            
            # 토큰이 없거나 유효하지 않은 경우
            if not self.credentials or not self.credentials.valid:
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    self.credentials.refresh(Request())
                else:
                    if not os.path.exists('credentials.json'):
                        raise FileNotFoundError("credentials.json 파일을 찾을 수 없습니다.")
                    
                    flow = InstalledAppFlow.from_client_secrets_file(
                        'credentials.json', SCOPES)
                    self.credentials = flow.run_local_server(port=0)
                
                # 토큰 저장
                with open('calendar_token.pickle', 'wb') as token:
                    pickle.dump(self.credentials, token)
            
            # 서비스 빌드
            self.service = build('calendar', 'v3', credentials=self.credentials)
            return True
            
        except Exception as e:
            st.error(f"캘린더 인증 실패: {str(e)}")
            return False
    
    def create_event(self, title, description, start_datetime, end_datetime=None, location=None):
        """캘린더 이벤트 생성"""
        try:
            if not self.service:
                if not self.authenticate():
                    return {'success': False, 'message': '캘린더 인증에 실패했습니다.'}
            
            # 종료 시간이 없으면 시작 시간 + 1시간으로 설정
            if not end_datetime:
                if isinstance(start_datetime, str):
                    start_dt = datetime.fromisoformat(start_datetime.replace('Z', '+00:00'))
                else:
                    start_dt = start_datetime
                end_dt = start_dt + timedelta(hours=1)
            else:
                if isinstance(end_datetime, str):
                    end_dt = datetime.fromisoformat(end_datetime.replace('Z', '+00:00'))
                else:
                    end_dt = end_datetime
            
            # 이벤트 생성
            event = {
                'summary': title,
                'description': description,
                'start': {
                    'dateTime': start_datetime.isoformat() if isinstance(start_datetime, datetime) else start_datetime,
                    'timeZone': 'Asia/Seoul',
                },
                'end': {
                    'dateTime': end_dt.isoformat() if isinstance(end_dt, datetime) else end_datetime,
                    'timeZone': 'Asia/Seoul',
                },
            }
            
            if location:
                event['location'] = location
            
            # 이벤트 추가
            created_event = self.service.events().insert(
                calendarId='primary', 
                body=event
            ).execute()
            
            return {
                'success': True, 
                'message': f'캘린더에 일정이 추가되었습니다: {title}',
                'event_id': created_event['id'],
                'event_link': created_event.get('htmlLink', '')
            }
            
        except HttpError as e:
            error_msg = f"캘린더 API 오류: {str(e)}"
            if e.resp.status == 403:
                error_msg += "\n캘린더 API 권한이 없습니다. Google Cloud Console에서 Calendar API를 활성화하세요."
            return {'success': False, 'message': error_msg}
            
        except Exception as e:
            return {'success': False, 'message': f'일정 추가 실패: {str(e)}'}
    
    def get_upcoming_events(self, max_results=10):
        """다가오는 이벤트 조회"""
        try:
            if not self.service:
                if not self.authenticate():
                    return {'success': False, 'events': [], 'message': '캘린더 인증에 실패했습니다.'}
            
            # 현재 시간
            now = datetime.utcnow().isoformat() + 'Z'
            
            # 이벤트 조회
            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            return {
                'success': True,
                'events': events,
                'message': f'{len(events)}개의 다가오는 일정을 찾았습니다.'
            }
            
        except Exception as e:
            return {'success': False, 'events': [], 'message': f'일정 조회 실패: {str(e)}'}
    
    def generate_calendar_link(self, title, description, start_datetime, end_datetime=None, location=None):
        """Google Calendar 링크 생성 (인증 없이)"""
        try:
            # 종료 시간이 없으면 시작 시간 + 1시간으로 설정
            if not end_datetime:
                if isinstance(start_datetime, str):
                    start_dt = datetime.fromisoformat(start_datetime.replace('Z', '+00:00'))
                else:
                    start_dt = start_datetime
                end_dt = start_dt + timedelta(hours=1)
            else:
                if isinstance(end_datetime, str):
                    end_dt = datetime.fromisoformat(end_datetime.replace('Z', '+00:00'))
                else:
                    end_dt = end_datetime
            
            # 날짜 형식 변환 (YYYYMMDDTHHMMSSZ)
            start_str = start_dt.strftime('%Y%m%dT%H%M%SZ')
            end_str = end_dt.strftime('%Y%m%dT%H%M%SZ')
            
            # URL 인코딩
            import urllib.parse
            title_encoded = urllib.parse.quote(title)
            description_encoded = urllib.parse.quote(description)
            location_encoded = urllib.parse.quote(location) if location else ''
            
            # Google Calendar 링크 생성
            calendar_link = f"https://calendar.google.com/calendar/render?action=TEMPLATE&text={title_encoded}&dates={start_str}/{end_str}&details={description_encoded}&location={location_encoded}"
            
            return {
                'success': True,
                'calendar_link': calendar_link,
                'message': '캘린더 링크가 생성되었습니다.'
            }
            
        except Exception as e:
            return {'success': False, 'message': f'캘린더 링크 생성 실패: {str(e)}'}
