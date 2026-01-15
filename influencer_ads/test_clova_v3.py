import requests
import uuid

# API 설정
API_KEY = 'nv-bf2506d5f74f4d0c921a472cb24d8c44tQby'
REQUEST_ID = str(uuid.uuid4())

# v3 API 엔드포인트
url = "https://clovastudio.stream.ntruss.com/v3/chat-completions/HCX-005"

# 헤더 설정 (Bearer 토큰 방식)
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "X-NCP-CLOVASTUDIO-REQUEST-ID": REQUEST_ID,
    "Content-Type": "application/json; charset=utf-8"
}

# 요청 데이터
payload = {
    "messages": [
        {
            "role": "system",
            "content": [{
                "type": "text",
                "text": "당신은 도움이 되는 AI 어시스턴트입니다."
            }]
        },
        {
            "role": "user",
            "content": [{
                "type": "text",
                "text": "안녕하세요! 간단하게 인사해주세요."
            }]
        }
    ],
    "topP": 0.8,
    "topK": 0,
    "maxTokens": 256,
    "temperature": 0.5,
    "repetitionPenalty": 1.1,
    "stop": [],
    "includeAiFilters": True,
    "seed": 0
}

print("=" * 80)
print("CLOVA Studio v3 API 테스트")
print("=" * 80)
print(f"API 키: {API_KEY[:20]}...")
print(f"Request ID: {REQUEST_ID}")
print(f"URL: {url}\n")

try:
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    
    print(f"상태 코드: {response.status_code}")
    print(f"응답 헤더: {dict(response.headers)}\n")
    
    if response.status_code == 200:
        print("✅ 성공!")
        result = response.json()
        print(f"응답 데이터:\n{result}\n")
        
        # 실제 메시지 추출
        if 'result' in result and 'message' in result['result']:
            message = result['result']['message']
            print(f"📨 AI 응답: {message.get('content', message)}")
        else:
            print(f"📨 전체 응답: {result}")
    else:
        print("❌ 실패")
        print(f"오류 내용: {response.text}")

except Exception as e:
    print(f"❌ 예외 발생: {str(e)}")

print("\n" + "=" * 80)

