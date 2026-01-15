/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Firebase Admin SDK requires Node.js runtime
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  // 환경 변수 우선순위: .env.local이 시스템 환경 변수보다 우선하도록
  env: {
    // .env.local의 값이 우선되도록 명시적으로 설정하지 않음
    // Next.js는 자동으로 .env.local을 최우선으로 로드함
  },
};

export default nextConfig;

