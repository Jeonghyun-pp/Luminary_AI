import os
import pickle
import json
from typing import List, Dict, Optional
from datetime import datetime

class EmailManager:
    """이메일 찜, 회신 등의 추가 기능을 관리하는 클래스"""
    
    def __init__(self):
        self.favorites_file = 'favorites.json'
        self.replies_file = 'reply_templates.json'
        self.load_data()
    
    def load_data(self):
        """저장된 데이터 로드"""
        # 찜 목록 로드
        if os.path.exists(self.favorites_file):
            try:
                with open(self.favorites_file, 'r', encoding='utf-8') as f:
                    self.favorites = json.load(f)
            except:
                self.favorites = []
        else:
            self.favorites = []
        
        # 회신 템플릿 로드
        if os.path.exists(self.replies_file):
            try:
                with open(self.replies_file, 'r', encoding='utf-8') as f:
                    self.reply_templates = json.load(f)
            except:
                self.reply_templates = self.get_default_templates()
        else:
            self.reply_templates = self.get_default_templates()
    
    def save_data(self):
        """데이터 저장"""
        try:
            with open(self.favorites_file, 'w', encoding='utf-8') as f:
                json.dump(self.favorites, f, ensure_ascii=False, indent=2)
            
            with open(self.replies_file, 'w', encoding='utf-8') as f:
                json.dump(self.reply_templates, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"데이터 저장 오류: {e}")
    
    def get_default_templates(self) -> Dict:
        """기본 회신 템플릿 반환"""
        return {
            'tier1': {
                'subject': '협찬 제안에 대한 답변',
                'body': '''안녕하세요.

협찬 제안해주셔서 감사합니다.

고정 금액 협찬에 관심이 있습니다.
자세한 조건과 요구사항을 확인하고 싶습니다.

추가 정보를 보내주시면 검토 후 연락드리겠습니다.

감사합니다.'''
            },
            'tier2': {
                'subject': '협찬 제안에 대한 답변',
                'body': '''안녕하세요.

협찬 제안해주셔서 감사합니다.

고정 금액 + 조회수 기반 수익 구조에 관심이 있습니다.
구체적인 수익 구조와 조건을 확인하고 싶습니다.

추가 정보를 보내주시면 검토 후 연락드리겠습니다.

감사합니다.'''
            },
            'tier3': {
                'subject': '협찬 제안에 대한 답변',
                'body': '''안녕하세요.

협찬 제안해주셔서 감사합니다.

복합 수익 구조(고정 + 조회수 + 판매 수수료)에 관심이 있습니다.
구체적인 수익 구조와 조건을 확인하고 싶습니다.

추가 정보를 보내주시면 검토 후 연락드리겠습니다.

감사합니다.'''
            },
            'decline': {
                'subject': '협찬 제안에 대한 답변',
                'body': '''안녕하세요.

협찬 제안해주셔서 감사합니다.

현재 일정상 협찬에 참여하기 어려운 상황입니다.
앞으로 좋은 기회가 있으면 연락드리겠습니다.

감사합니다.'''
            }
        }
    
    def add_to_favorites(self, email_data: Dict, classification: str, explanation: str):
        """이메일을 찜 목록에 추가"""
        favorite_item = {
            'id': email_data.get('id', ''),
            'subject': email_data.get('subject', ''),
            'sender': email_data.get('sender', ''),
            'date': email_data.get('date', ''),
            'classification': classification,
            'explanation': explanation,
            'added_date': datetime.now().isoformat(),
            'body': email_data.get('body', email_data.get('snippet', ''))
        }
        
        # 중복 확인
        if not any(item['id'] == favorite_item['id'] for item in self.favorites):
            self.favorites.append(favorite_item)
            self.save_data()
            return True
        return False
    
    def remove_from_favorites(self, email_id: str):
        """찜 목록에서 제거"""
        self.favorites = [item for item in self.favorites if item['id'] != email_id]
        self.save_data()
    
    def get_favorites(self) -> List[Dict]:
        """찜 목록 반환"""
        return self.favorites
    
    def is_favorite(self, email_id: str) -> bool:
        """찜 여부 확인"""
        return any(item['id'] == email_id for item in self.favorites)
    
    def get_reply_template(self, classification: str) -> Dict:
        """분류에 따른 회신 템플릿 반환"""
        if classification in self.reply_templates:
            return self.reply_templates[classification]
        else:
            return self.reply_templates['decline']
    
    def update_reply_template(self, classification: str, subject: str, body: str):
        """회신 템플릿 업데이트"""
        self.reply_templates[classification] = {
            'subject': subject,
            'body': body
        }
        self.save_data()
    
    def get_all_templates(self) -> Dict:
        """모든 회신 템플릿 반환"""
        return self.reply_templates
