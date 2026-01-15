import os
import pickle
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import base64
from typing import List, Dict

# Gmail API 스코프 설정
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
]


class GmailClient:
    """Gmail API를 사용하여 이메일을 가져오는 클라이언트"""
    
    def __init__(self):
        self.service = None
        self.authenticate()
    
    def authenticate(self):
        """Gmail API 인증 처리"""
        creds = None
        
        # token.pickle 파일이 있으면 기존 인증 정보 로드
        if os.path.exists('token.pickle'):
            with open('token.pickle', 'rb') as token:
                creds = pickle.load(token)
        
        # 유효한 인증 정보가 없으면 새로 로그인
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists('credentials.json'):
                    raise FileNotFoundError(
                        "credentials.json 파일이 없습니다. "
                        "Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성하고 "
                        "credentials.json 파일을 다운로드하세요."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            
            # 인증 정보 저장
            with open('token.pickle', 'wb') as token:
                pickle.dump(creds, token)
        
        self.service = build('gmail', 'v1', credentials=creds)
    
    def get_emails(self, query: str = '', max_results: int = 10) -> List[Dict]:
        """
        Gmail에서 이메일 가져오기
        
        Args:
            query: Gmail 검색 쿼리 (예: 'is:unread', 'from:example@gmail.com')
            max_results: 가져올 최대 이메일 개수
        
        Returns:
            이메일 정보 리스트
        """
        try:
            # 이메일 ID 목록 가져오기
            results = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            
            if not messages:
                return []
            
            # 각 이메일의 상세 정보 가져오기
            emails = []
            for message in messages:
                msg = self.service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='full'
                ).execute()
                
                email_data = self._parse_email(msg)
                emails.append(email_data)
            
            return emails
        
        except Exception as e:
            error_msg = str(e)
            print(f"이메일 가져오기 오류: {error_msg}")
            
            # 구체적인 오류 메시지 제공
            if "403" in error_msg or "Forbidden" in error_msg:
                print("Gmail API 권한이 없습니다. OAuth 동의 화면 설정을 확인하세요.")
            elif "401" in error_msg or "Unauthorized" in error_msg:
                print("Gmail API 인증이 실패했습니다. 토큰을 재설정하세요.")
            elif "quota" in error_msg.lower():
                print("Gmail API 일일 할당량을 초과했습니다.")
            elif "not found" in error_msg.lower():
                print("Gmail API가 활성화되지 않았습니다.")
            
            return []
    
    def _parse_email(self, msg: Dict) -> Dict:
        """이메일 메시지 파싱"""
        headers = msg['payload']['headers']
        
        # 헤더에서 정보 추출
        subject = ''
        sender = ''
        date = ''
        
        for header in headers:
            if header['name'] == 'Subject':
                subject = header['value']
            elif header['name'] == 'From':
                sender = header['value']
            elif header['name'] == 'Date':
                date = header['value']
        
        # 이메일 본문 추출
        body = self._get_email_body(msg['payload'])
        
        return {
            'id': msg['id'],
            'subject': subject,
            'sender': sender,
            'date': date,
            'body': body,
            'snippet': msg.get('snippet', '')
        }
    
    def _get_email_body(self, payload: Dict) -> str:
        """이메일 본문 추출"""
        body = ''
        
        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    if 'data' in part['body']:
                        body = base64.urlsafe_b64decode(
                            part['body']['data']
                        ).decode('utf-8')
                        break
                elif part['mimeType'] == 'text/html' and not body:
                    if 'data' in part['body']:
                        body = base64.urlsafe_b64decode(
                            part['body']['data']
                        ).decode('utf-8')
        else:
            if 'body' in payload and 'data' in payload['body']:
                body = base64.urlsafe_b64decode(
                    payload['body']['data']
                ).decode('utf-8')
        
        return body
    
    def search_sponsorship_emails(self, max_results: int = 20) -> List[Dict]:
        """협찬 관련 이메일 검색"""
        # 협찬 관련 키워드로 검색 (포괄적인 키워드 사용)
        keywords = [
            '협찬',
            '광고',
            '홍보',
            '제휴',
            '파트너십',
            'sponsorship',
            'sponsored',
            'partnership',
            'collaboration',
            'influencer',
            '인플루언서',
            '마케팅',
            '브랜드',
            '수익',
            '광고비',
            '협찬료'
        ]
        # 따옴표 없이 사용하여 부분 매칭 허용
        query = ' OR '.join(keywords)
        
        return self.get_emails(query=query, max_results=max_results)
        
    def send_reply(self, original_message_id: str, reply_subject: str, reply_body: str, recipient_email: str) -> Dict:
        """이메일 회신 전송"""
        try:
            # 원본 메시지 가져오기
            original_message = self.service.users().messages().get(
                userId='me',
                id=original_message_id,
                format='full'
            ).execute()
            
            # 원본 메시지의 헤더에서 정보 추출
            headers = original_message['payload']['headers']
            original_subject = ''
            original_message_id_header = ''
            
            for header in headers:
                if header['name'] == 'Subject':
                    original_subject = header['value']
                elif header['name'] == 'Message-ID':
                    original_message_id_header = header['value']
            
            # 회신 제목 생성 (Re: 추가)
            if not reply_subject.startswith('Re:'):
                reply_subject = f"Re: {reply_subject}"
            
            # 한글 제목 인코딩 (RFC 2047)
            import email.header
            encoded_subject = email.header.Header(reply_subject, 'utf-8').encode()
            
            # 회신 메시지 생성
            reply_message = f"""To: {recipient_email}
Subject: {encoded_subject}
In-Reply-To: {original_message_id_header}
References: {original_message_id_header}

{reply_body}"""
            
            # Base64 인코딩
            import base64
            message_bytes = reply_message.encode('utf-8')
            message_b64 = base64.urlsafe_b64encode(message_bytes).decode('utf-8')
            
            # 메시지 전송
            message = {
                'raw': message_b64
            }
            
            sent_message = self.service.users().messages().send(
                userId='me',
                body=message
            ).execute()
            
            return {
                'success': True,
                'message_id': sent_message['id'],
                'message': '회신이 성공적으로 전송되었습니다.'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '회신 전송 중 오류가 발생했습니다.'
            }

