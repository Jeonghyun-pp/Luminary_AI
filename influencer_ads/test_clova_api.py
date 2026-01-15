import requests
import uuid
import os

# API 키 (새로운 키로 테스트)
API_KEY = 'nv-bf2506d5f74f4d0c921a472cb24d8c44tQby'
REQUEST_ID = str(uuid.uuid4())

# 테스트할 여러 엔드포인트
endpoints = [
    "https://clovastudio.stream.ntruss.com/testapp/v1/chat-completions/HCX-003",
    "https://clovastudio.apigw.ntruss.com/testapp/v1/chat-completions/HCX-003",
]

headers = {
    "X-NCP-CLOVASTUDIO-API-KEY": API_KEY,
    "X-NCP-APIGW-API-KEY": API_KEY,
    "X-NCP-CLOVASTUDIO-REQUEST-ID": REQUEST_ID,
    "Content-Type": "application/json"
}

payload = {
    "messages": [
        {
            "role": "system",
            "content": "당신은 도움이 되는 AI 어시스턴트입니다."
        },
        {
            "role": "user",
            "content": "안녕하세요"
        }
    ],
    "topP": 0.8,
    "topK": 0,
    "maxTokens": 100,
    "temperature": 0.5,
    "repeatPenalty": 5.0,
    "stopBefore": [],
    "includeAiFilters": True,
    "seed": 0
}

print(f"API 키: {API_KEY[:20]}...")
print(f"Request ID: {REQUEST_ID}\n")

for i, url in enumerate(endpoints, 1):
    print(f"\n[테스트 {i}] {url}")
    print("-" * 80)
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        print(f"상태 코드: {response.status_code}")
        print(f"응답 헤더: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 성공!")
            print(f"응답: {result}")
            break
        else:
            print(f"❌ 실패")
            print(f"응답 내용: {response.text}")
    
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")

print("\n" + "=" * 80)
print("테스트 완료")

