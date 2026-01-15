"use client";

import { useEffect, useRef } from "react";
import { startOfMonth, endOfMonth } from "date-fns";

/**
 * Preloads data for all tabs in the background after login
 * This improves initial page load performance
 */
export function DataPreloader() {
  const hasPreloaded = useRef(false);

  useEffect(() => {
    // Only preload once per page load
    if (hasPreloaded.current) {
      return;
    }

    // Small delay to ensure page is loaded
    const timeoutId = setTimeout(() => {
      hasPreloaded.current = true;
      console.log("[DataPreloader] Starting background data preload...");

      // Preload all tab data in parallel
      const preloadPromises = [
        // Preload emails (Inbox tab)
        fetch("/api/emails")
          .then((res) => {
            if (res.ok) {
              console.log("[DataPreloader] Emails preloaded");
              return res.json();
            } else if (res.status === 401) {
              // Not authenticated, skip preload
              console.log("[DataPreloader] Not authenticated, skipping email preload");
            }
          })
          .catch((error) => {
            // Silently fail - user might not be authenticated yet
            console.log("[DataPreloader] Email preload skipped:", error.message);
          }),

        // Preload tasks (Tasks tab)
        fetch("/api/tasks")
          .then((res) => {
            if (res.ok) {
              console.log("[DataPreloader] Tasks preloaded");
              return res.json();
            } else if (res.status === 401) {
              console.log("[DataPreloader] Not authenticated, skipping task preload");
            }
          })
          .catch((error) => {
            console.log("[DataPreloader] Task preload skipped:", error.message);
          }),

        // Preload calendar events (Calendar tab) - current month
        (() => {
          const now = new Date();
          const timeMin = startOfMonth(now).toISOString();
          const timeMax = endOfMonth(now).toISOString();
          return fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
            .then((res) => {
              if (res.ok) {
                console.log("[DataPreloader] Calendar events preloaded");
                return res.json();
              } else if (res.status === 401) {
                console.log("[DataPreloader] Not authenticated, skipping calendar preload");
              }
            })
            .catch((error) => {
              console.log("[DataPreloader] Calendar preload skipped:", error.message);
            });
        })(),

        // Preload chatting threads (Chatting tab)
        fetch("/api/chatting/threads")
          .then((res) => {
            if (res.ok) {
              console.log("[DataPreloader] Chatting threads preloaded");
              return res.json();
            } else if (res.status === 401) {
              console.log("[DataPreloader] Not authenticated, skipping chatting preload");
            }
          })
          .catch((error) => {
            console.log("[DataPreloader] Chatting preload skipped:", error.message);
          }),
      ];

      // Wait for all preloads to complete (but don't block UI)
      Promise.allSettled(preloadPromises).then((results) => {
        const successCount = results.filter((r) => r.status === "fulfilled").length;
        console.log(`[DataPreloader] Preload completed: ${successCount}/${preloadPromises.length} successful`);
      });
    }, 500); // 500ms delay to ensure page is ready

    return () => clearTimeout(timeoutId);
  }, []);

  // This component doesn't render anything
  return null;
}

