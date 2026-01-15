import requests
import os
from typing import Dict, Optional
import json

class TranslationClient:
    """네이버 번역 API를 사용하여 이메일 내용을 번역하는 클라이언트"""
    
    def __init__(self):
        self.client_id = os.getenv('NAVER_CLIENT_ID')
        self.client_secret = os.getenv('NAVER_CLIENT_SECRET')
        self.translate_url = "https://openapi.naver.com/v1/papago/n2mt"
        
        # 언어 감지 URL
        self.detect_url = "https://openapi.naver.com/v1/papago/detectLangs"
    
    def detect_language(self, text: str) -> Optional[str]:
        """텍스트의 언어를 감지"""
        if not self.client_id or not self.client_secret:
            return None
            
        try:
            headers = {
                'X-Naver-Client-Id': self.client_id,
                'X-Naver-Client-Secret': self.client_secret,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
            
            data = {'query': text[:500]}  # API 제한으로 500자까지만
            
            response = requests.post(self.detect_url, headers=headers, data=data)
            
            if response.status_code == 200:
                result = response.json()
                return result.get('langCode')
            else:
                print(f"언어 감지 오류: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"언어 감지 중 오류: {e}")
            return None
    
    def translate_text(self, text: str, source_lang: str = 'auto', target_lang: str = 'ko') -> Optional[str]:
        """텍스트를 번역"""
        if not self.client_id or not self.client_secret:
            return None
            
        try:
            headers = {
                'X-Naver-Client-Id': self.client_id,
                'X-Naver-Client-Secret': self.client_secret,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
            
            data = {
                'source': source_lang,
                'target': target_lang,
                'text': text[:5000]  # API 제한으로 5000자까지만
            }
            
            response = requests.post(self.translate_url, headers=headers, data=data)
            
            if response.status_code == 200:
                result = response.json()
                return result['message']['result']['translatedText']
            else:
                print(f"번역 오류: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"번역 중 오류: {e}")
            return None
    
    def translate_email(self, email_data: Dict) -> Dict:
        """이메일 전체를 번역"""
        try:
            # 제목과 본문을 번역
            subject = email_data.get('subject', '')
            body = email_data.get('body', email_data.get('snippet', ''))
            
            # 언어 감지
            combined_text = f"{subject} {body}"
            detected_lang = self.detect_language(combined_text)
            
            # 한국어가 아닌 경우에만 번역
            if detected_lang and detected_lang != 'ko':
                translated_subject = self.translate_text(subject, detected_lang, 'ko')
                translated_body = self.translate_text(body, detected_lang, 'ko')
                
                return {
                    'original_subject': subject,
                    'original_body': body,
                    'translated_subject': translated_subject or subject,
                    'translated_body': translated_body or body,
                    'detected_language': detected_lang,
                    'is_translated': True
                }
            else:
                return {
                    'original_subject': subject,
                    'original_body': body,
                    'translated_subject': subject,
                    'translated_body': body,
                    'detected_language': 'ko',
                    'is_translated': False
                }
                
        except Exception as e:
            print(f"이메일 번역 중 오류: {e}")
            return {
                'original_subject': email_data.get('subject', ''),
                'original_body': email_data.get('body', email_data.get('snippet', '')),
                'translated_subject': email_data.get('subject', ''),
                'translated_body': email_data.get('body', email_data.get('snippet', '')),
                'detected_language': 'unknown',
                'is_translated': False
            }
