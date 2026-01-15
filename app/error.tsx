"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Error:", error);
  }, [error]);

  const isDatabaseError = error.message?.includes("database") || 
                         error.message?.includes("Firebase") ||
                         error.message?.includes("Firestore") ||
                         error.message?.includes("connection");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          문제가 발생했습니다
        </h2>
        <p className="mb-4 text-gray-600">
          {error.message || "예상치 못한 오류가 발생했습니다."}
        </p>
        
        {isDatabaseError && (
          <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              데이터베이스 연결 오류
            </p>
            <p className="text-xs text-yellow-700">
              Firebase 데이터베이스가 설정되지 않았습니다. 
              <br />
              <code className="text-xs bg-yellow-100 px-1 rounded">docs/env-variables.md</code> 파일을 참고하여 Firebase를 설정해주세요.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <Button onClick={reset} variant="default">
            다시 시도
          </Button>
          <Button
            onClick={() => (window.location.href = "/auth/signin")}
            variant="outline"
          >
            로그인 페이지로
          </Button>
        </div>
      </div>
    </div>
  );
}

