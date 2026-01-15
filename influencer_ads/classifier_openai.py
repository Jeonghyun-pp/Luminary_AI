from openai import OpenAI
from typing import Dict, Tuple
import os


class SponsorshipClassifier:
    """OpenAI를 사용하여 협찬 이메일을 분류하는 클래스 (임시)"""
    
    CATEGORIES = {
        'tier1': '1단계: 고정 금액 (영상 제작 및 게시)',
        'tier2': '2단계: 고정 금액 + 조회수 기반 수익',
        'tier3': '3단계: 고정 금액 + 조회수 기반 수익 + 제품 판매 수수료',
        'not_sponsorship': '협찬 요청이 아님',
        'unclear': '정보 불충분 (추가 확인 필요)'
    }
    
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    def classify_email(self, email_data: Dict) -> Tuple[str, str, Dict]:
        email_content = f"""
제목: {email_data.get('subject', '')}
발신자: {email_data.get('sender', '')}
날짜: {email_data.get('date', '')}

본문:
{email_data.get('body', email_data.get('snippet', ''))}
"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",  # 더 저렴한 모델
                messages=[
                    {"role": "system", "content": self._get_system_prompt()},
                    {"role": "user", "content": email_content}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            result = response.choices[0].message.content
            category, explanation, details = self._parse_classification_result(result)
            return category, explanation, details
        
        except Exception as e:
            print(f"분류 오류: {str(e)}")
            return 'unclear', f'오류 발생: {str(e)}', {}
    
    def _get_system_prompt(self) -> str:
        return """당신은 인플루언서의 협찬 요청 이메일을 분석하고 분류하는 전문 AI 어시스턴트입니다.

이메일을 읽고 다음 3가지 카테고리 중 하나로 분류하세요:

**1단계 (tier1)**: 고정 금액만 지급
- 영상을 만들어 게시하면 정해진 금액을 받는 형태
- 조회수나 판매량과 무관하게 고정 비용만 지급
- 예: "영상 1개당 100만원 지급", "고정 광고비 50만원"

**2단계 (tier2)**: 고정 금액 + 조회수 기반 추가 수익
- 기본 금액 + 조회수/뷰에 따른 추가 보상
- 판매 수수료는 없음
- 예: "기본 50만원 + 조회수 1만당 5만원 추가", "CPM 기반 수익 배분"

**3단계 (tier3)**: 고정 금액 + 조회수 수익 + 제품 판매 수수료
- 기본 금액 + 조회수 보상 + 제품 판매 시 커미션
- 가장 복합적인 수익 구조
- 예: "기본료 + 조회수 보상 + 판매액의 10% 수수료", "affiliate 링크를 통한 판매 수익 공유"

**not_sponsorship**: 협찬 요청이 아닌 경우

**unclear**: 정보가 불충분하여 분류가 어려운 경우

반드시 아래 형식으로 정확하게 응답해주세요:

CATEGORY: [tier1/tier2/tier3/not_sponsorship/unclear]
EXPLANATION: [분류 이유를 한국어로 2-3문장으로 설명]
DETAILS:
- 고정금액: [금액 또는 "명시 안됨"]
- 조회수보상: [있음/없음 및 상세]
- 판매수수료: [있음/없음 및 상세]
- 제품/서비스: [무엇인지]
- 특이사항: [기타 주목할 내용]
"""
    
    def _parse_classification_result(self, result: str) -> Tuple[str, str, Dict]:
        lines = result.strip().split('\n')
        category = 'unclear'
        explanation = ''
        details = {}
        current_section = None
        
        for line in lines:
            line = line.strip()
            if line.startswith('CATEGORY:'):
                category = line.replace('CATEGORY:', '').strip()
            elif line.startswith('EXPLANATION:'):
                explanation = line.replace('EXPLANATION:', '').strip()
            elif line.startswith('DETAILS:'):
                current_section = 'details'
            elif current_section == 'details' and line.startswith('-'):
                if ':' in line:
                    key_value = line[1:].strip().split(':', 1)
                    if len(key_value) == 2:
                        details[key_value[0].strip()] = key_value[1].strip()
            elif current_section is None and explanation:
                explanation += ' ' + line
        
        return category, explanation, details
    
    def get_category_display_name(self, category: str) -> str:
        return self.CATEGORIES.get(category, '알 수 없음')

