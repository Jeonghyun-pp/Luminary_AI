import requests
from typing import Dict, Tuple
import os
import uuid
import json


class ClovaAPI:
    """Naver HyperCLOVA API 클라이언트 (최신 v3 API)"""
    
    def __init__(self, api_key: str, request_id: str):
        # Naver CLOVA Studio API Key (Naver Cloud Platform > CLOVA Studio에서 발급)
        self.api_key = api_key
        # 요청 추적을 위한 고유 ID (자동 생성됨)
        self.request_id = request_id
        # HyperCLOVA X 최신 API 엔드포인트 (v3)
        self.host = "https://clovastudio.stream.ntruss.com"
        self.api_url = f"{self.host}/v3/chat-completions/HCX-005"
    
    def chat(self, messages: list, temperature: float = 0.5, max_tokens: int = 1000) -> str:
        """
        HyperCLOVA Chat API 호출 (v3 API)
        
        Args:
            messages: 대화 메시지 리스트
            temperature: 생성 다양성 (0.0~1.0)
            max_tokens: 최대 토큰 수
        
        Returns:
            생성된 응답 텍스트
        """
        # v3 API는 Authorization Bearer 토큰 방식 사용
        headers = {
            "Authorization": f"Bearer {self.api_key}",  # Bearer 토큰 형식
            "X-NCP-CLOVASTUDIO-REQUEST-ID": self.request_id,  # 요청 추적 ID
            "Content-Type": "application/json; charset=utf-8"
        }
        
        # v3 API의 메시지 형식 변환
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg["role"],
                "content": [{
                    "type": "text",
                    "text": msg["content"]
                }]
            })
        
        payload = {
            "messages": formatted_messages,
            "topP": 0.8,
            "topK": 0,
            "maxTokens": max_tokens,
            "temperature": temperature,
            "repetitionPenalty": 1.1,
            "stop": [],
            "includeAiFilters": True,
            "seed": 0
        }
        
        try:
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                result_data = response.json()
                # v3 API 응답 형식에 맞게 파싱
                if 'result' in result_data and 'message' in result_data['result']:
                    return result_data['result']['message']['content']
                elif 'message' in result_data:
                    # content가 배열 형태일 수 있음
                    content = result_data['message'].get('content', '')
                    if isinstance(content, list) and len(content) > 0:
                        return content[0].get('text', '')
                    return str(content)
                else:
                    return str(result_data)
            else:
                # 상세한 오류 정보 출력
                error_detail = f"Status: {response.status_code}, Response: {response.text}"
                raise Exception(f"API 오류: {error_detail}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"네트워크 오류: {str(e)}")


class SponsorshipClassifier:
    """Naver HyperCLOVA를 사용하여 협찬 이메일을 분류하는 클래스"""
    
    # 분류 카테고리 정의
    CATEGORIES = {
        'tier1': '1단계: 고정 금액 (영상 제작 및 게시)',
        'tier2': '2단계: 고정 금액 + 조회수 기반 수익',
        'tier3': '3단계: 고정 금액 + 조회수 기반 수익 + 제품 판매 수수료',
        'not_sponsorship': '협찬 요청이 아님',
        'unclear': '정보 불충분 (추가 확인 필요)'
    }
    
    def __init__(self, api_key: str):
        """
        Args:
            api_key: Naver CLOVA Studio API 키 (환경 변수 CLOVA_STUDIO_KEY에서 로드)
        """
        # API 키 저장 (Naver Cloud Platform > CLOVA Studio에서 발급받은 키)
        self.api_key = api_key
        # 각 요청마다 고유한 UUID 생성
        self.clova_api = ClovaAPI(api_key=api_key, request_id=str(uuid.uuid4()))
    
    def classify_email(self, email_data: Dict) -> Tuple[str, str, Dict]:
        """
        이메일을 분류하고 상세 정보 추출
        
        Args:
            email_data: 이메일 데이터 (subject, sender, body 등)
        
        Returns:
            (카테고리, 설명, 상세정보) 튜플
        """
        # 이메일 내용 준비
        email_content = f"""
제목: {email_data.get('subject', '')}
발신자: {email_data.get('sender', '')}
날짜: {email_data.get('date', '')}

본문:
{email_data.get('body', email_data.get('snippet', ''))}
"""
        
        # HyperCLOVA API 호출
        try:
            # 메시지 구성
            messages = [
                {
                    "role": "system",
                    "content": self._get_system_prompt()
                },
                {
                    "role": "user",
                    "content": email_content
                }
            ]
            
            # API 호출 (매 요청마다 새로운 UUID 생성)
            self.clova_api.request_id = str(uuid.uuid4())
            result = self.clova_api.chat(messages, temperature=0.3, max_tokens=1000)
            
            # 결과 파싱
            category, explanation, details = self._parse_classification_result(result)
            
            return category, explanation, details
        
        except Exception as e:
            print(f"분류 오류: {str(e)}")
            return 'unclear', f'오류 발생: {str(e)}', {}
    
    def _get_system_prompt(self) -> str:
        """분류를 위한 시스템 프롬프트"""
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
        """OpenAI 응답 파싱"""
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
                # "- 키: 값" 형태 파싱
                if ':' in line:
                    key_value = line[1:].strip().split(':', 1)
                    if len(key_value) == 2:
                        key = key_value[0].strip()
                        value = key_value[1].strip()
                        details[key] = value
            elif current_section is None and explanation:
                # 설명이 여러 줄인 경우
                explanation += ' ' + line
        
        return category, explanation, details
    
    def get_category_display_name(self, category: str) -> str:
        """카테고리 표시명 반환"""
        return self.CATEGORIES.get(category, '알 수 없음')

