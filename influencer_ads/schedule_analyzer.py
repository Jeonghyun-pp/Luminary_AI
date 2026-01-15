import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import urllib.parse

class ScheduleAnalyzer:
    """협찬 이메일에서 일정 정보를 분석하고 캘린더 링크를 생성하는 클래스"""
    
    def __init__(self):
        # 날짜 패턴들
        self.date_patterns = [
            r'(\d{4})[년\-\/](\d{1,2})[월\-\/](\d{1,2})[일]?',  # 2024년 1월 15일
            r'(\d{1,2})[월\-\/](\d{1,2})[일]?',  # 1월 15일
            r'(\d{1,2})[일]',  # 15일
            r'(\d{4})[년\-\/](\d{1,2})[월\-\/](\d{1,2})',  # 2024/1/15
            r'(\d{1,2})[\/\-](\d{1,2})',  # 1/15
        ]
        
        # 시간 패턴들
        self.time_patterns = [
            r'(\d{1,2}):(\d{2})',  # 14:30
            r'(\d{1,2})시\s*(\d{1,2})분?',  # 14시 30분
            r'(\d{1,2})시',  # 14시
            r'오전\s*(\d{1,2}):?(\d{1,2})?',  # 오전 9시
            r'오후\s*(\d{1,2}):?(\d{1,2})?',  # 오후 2시
        ]
        
        # 마감일 관련 키워드
        self.deadline_keywords = [
            '마감', '데드라인', 'deadline', 'due', '제출', '완료',
            '게시', '업로드', '발행', '공개', '출시'
        ]
        
        # 이벤트 관련 키워드
        self.event_keywords = [
            '미팅', '회의', 'meeting', '화상회의', '콜', 'call',
            '촬영', '영상', '사진', '방송', '라이브', 'live'
        ]
    
    def extract_dates(self, text: str) -> List[Dict]:
        """텍스트에서 날짜 정보 추출"""
        dates = []
        
        for pattern in self.date_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                groups = match.groups()
                try:
                    if len(groups) == 3:  # 년-월-일
                        year, month, day = groups
                        if int(year) < 100:  # 2자리 년도인 경우
                            year = f"20{year}"
                        date_obj = datetime(int(year), int(month), int(day))
                    elif len(groups) == 2:  # 월-일
                        month, day = groups
                        current_year = datetime.now().year
                        date_obj = datetime(current_year, int(month), int(day))
                    elif len(groups) == 1:  # 일만
                        day = groups[0]
                        current_date = datetime.now()
                        date_obj = datetime(current_date.year, current_date.month, int(day))
                    
                    dates.append({
                        'date': date_obj,
                        'text': match.group(),
                        'start_pos': match.start(),
                        'end_pos': match.end()
                    })
                except ValueError:
                    continue
        
        return dates
    
    def extract_times(self, text: str) -> List[Dict]:
        """텍스트에서 시간 정보 추출"""
        times = []
        
        for pattern in self.time_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                groups = match.groups()
                try:
                    if len(groups) == 2:  # 시:분
                        hour, minute = groups
                        hour = int(hour)
                        minute = int(minute) if minute else 0
                    elif len(groups) == 1:  # 시만
                        hour = int(groups[0])
                        minute = 0
                    else:
                        continue
                    
                    # 오전/오후 처리
                    if '오후' in match.group() and hour < 12:
                        hour += 12
                    elif '오전' in match.group() and hour == 12:
                        hour = 0
                    
                    times.append({
                        'hour': hour,
                        'minute': minute,
                        'text': match.group(),
                        'start_pos': match.start(),
                        'end_pos': match.end()
                    })
                except ValueError:
                    continue
        
        return times
    
    def analyze_schedule(self, email_data: Dict) -> Dict:
        """이메일에서 일정 정보 분석"""
        subject = email_data.get('subject', '')
        body = email_data.get('body', email_data.get('snippet', ''))
        combined_text = f"{subject} {body}"
        
        # 날짜와 시간 추출
        dates = self.extract_dates(combined_text)
        times = self.extract_times(combined_text)
        
        # 마감일 키워드 확인
        is_deadline = any(keyword in combined_text.lower() for keyword in self.deadline_keywords)
        
        # 이벤트 키워드 확인
        is_event = any(keyword in combined_text.lower() for keyword in self.event_keywords)
        
        # 가장 가까운 날짜 선택
        target_date = None
        if dates:
            # 현재 날짜와 가장 가까운 미래 날짜 선택
            current_date = datetime.now()
            future_dates = [d for d in dates if d['date'] >= current_date]
            if future_dates:
                target_date = min(future_dates, key=lambda x: x['date'])
            else:
                target_date = max(dates, key=lambda x: x['date'])
        
        # 기본 시간 설정
        target_time = None
        if times:
            target_time = times[0]  # 첫 번째 시간 사용
        else:
            # 기본 시간 설정 (오후 2시)
            target_time = {'hour': 14, 'minute': 0}
        
        # 캘린더 이벤트 생성
        event_data = self.create_calendar_event(
            email_data, target_date, target_time, is_deadline, is_event
        )
        
        return {
            'has_schedule': bool(target_date),
            'target_date': target_date,
            'target_time': target_time,
            'is_deadline': is_deadline,
            'is_event': is_event,
            'calendar_event': event_data,
            'extracted_dates': dates,
            'extracted_times': times
        }
    
    def create_calendar_event(self, email_data: Dict, target_date: Optional[Dict], 
                            target_time: Optional[Dict], is_deadline: bool, is_event: bool) -> Dict:
        """Google Calendar 이벤트 데이터 생성"""
        if not target_date:
            return None
        
        # 이벤트 제목 생성
        subject = email_data.get('subject', '협찬 프로젝트')
        sender = email_data.get('sender', '')
        
        if is_deadline:
            event_title = f"📅 마감일: {subject}"
        elif is_event:
            event_title = f"🎬 이벤트: {subject}"
        else:
            event_title = f"📧 협찬: {subject}"
        
        # 날짜와 시간 결합
        event_datetime = target_date['date'].replace(
            hour=target_time['hour'] if target_time else 14,
            minute=target_time['minute'] if target_time else 0,
            second=0,
            microsecond=0
        )
        
        # 종료 시간 설정 (1시간 후)
        end_datetime = event_datetime + timedelta(hours=1)
        
        # 이벤트 설명 생성
        description = f"""
발신자: {sender}
제목: {subject}

이메일 내용:
{email_data.get('body', email_data.get('snippet', ''))[:500]}...

자동 생성된 일정입니다.
        """.strip()
        
        # Google Calendar 링크 생성
        calendar_link = self.generate_calendar_link(
            event_title, event_datetime, end_datetime, description
        )
        
        return {
            'title': event_title,
            'start': event_datetime.isoformat(),
            'end': end_datetime.isoformat(),
            'description': description,
            'calendar_link': calendar_link,
            'datetime_display': event_datetime.strftime('%Y년 %m월 %d일 %H:%M')
        }
    
    def generate_calendar_link(self, title: str, start_dt: datetime, end_dt: datetime, description: str) -> str:
        """Google Calendar 링크 생성"""
        # 날짜를 Google Calendar 형식으로 변환
        start_str = start_dt.strftime('%Y%m%dT%H%M%S')
        end_str = end_dt.strftime('%Y%m%dT%H%M%S')
        
        # URL 인코딩
        params = {
            'action': 'TEMPLATE',
            'text': title,
            'dates': f"{start_str}/{end_str}",
            'details': description,
            'location': '',
            'trp': 'false'
        }
        
        # 쿼리 문자열 생성
        query_string = '&'.join([f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items()])
        
        return f"https://calendar.google.com/calendar/render?{query_string}"
