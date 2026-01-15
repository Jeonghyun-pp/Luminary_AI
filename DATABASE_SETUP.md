# 데이터베이스 설정 가이드

현재 서버 오류는 데이터베이스 연결 문제로 발생하고 있습니다. PrismaAdapter를 사용하려면 PostgreSQL 데이터베이스가 필요합니다.

## 빠른 해결 방법 (권장)

### 옵션 1: Neon (무료 PostgreSQL 클라우드 서비스)

1. [Neon](https://neon.tech)에 접속하여 무료 계정 생성
2. 새 프로젝트 생성
3. 연결 문자열 복사 (예: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
4. `.env` 파일의 `DATABASE_URL` 업데이트:
   ```env
   DATABASE_URL=여기에_복사한_연결_문자열_붙여넣기
   ```
5. 데이터베이스 마이그레이션 실행:
   ```bash
   npm run db:push
   ```
6. 서버 재시작

### 옵션 2: Supabase (무료 PostgreSQL 클라우드 서비스)

1. [Supabase](https://supabase.com)에 접속하여 무료 계정 생성
2. 새 프로젝트 생성
3. Settings > Database > Connection string > URI 복사
4. `.env` 파일의 `DATABASE_URL` 업데이트
5. 데이터베이스 마이그레이션 실행:
   ```bash
   npm run db:push
   ```
6. 서버 재시작

### 옵션 3: 로컬 PostgreSQL

1. PostgreSQL 설치 (Windows: [PostgreSQL 다운로드](https://www.postgresql.org/download/windows/))
2. PostgreSQL 실행
3. 데이터베이스 생성:
   ```sql
   CREATE DATABASE inbox_solution;
   ```
4. `.env` 파일의 `DATABASE_URL` 업데이트:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/inbox_solution?schema=public
   ```
5. 데이터베이스 마이그레이션 실행:
   ```bash
   npm run db:push
   ```
6. 서버 재시작

## 데이터베이스 마이그레이션

데이터베이스 URL을 설정한 후 다음 명령어를 실행하세요:

```bash
# Prisma 스키마를 데이터베이스에 적용
npm run db:push
```

또는 마이그레이션 파일을 생성하려면:

```bash
# 마이그레이션 파일 생성
npm run db:migrate
```

## 확인

서버를 재시작한 후 브라우저에서 `http://localhost:3000`에 접속하면 로그인 페이지가 표시되어야 합니다.

## 문제 해결

여전히 오류가 발생하면:

1. 터미널에서 데이터베이스 연결 오류 메시지 확인
2. `.env` 파일의 `DATABASE_URL`이 올바른지 확인
3. 데이터베이스가 실행 중인지 확인 (로컬인 경우)
4. 방화벽 설정 확인 (클라우드인 경우)

