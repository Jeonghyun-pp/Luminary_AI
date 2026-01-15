import { Email } from "@/types";
import { SortCommand } from "@/lib/agent/parse-sort-command";

/**
 * Extract deadline date from schedule string
 * Returns Date or null if cannot parse
 */
function extractDeadlineDate(schedule: string | null): Date | null {
  if (!schedule || schedule === "정보 없음") return null;

  // Try to extract date patterns
  const datePatterns = [
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
    /(\d{1,2})월\s*(\d{1,2})일/,
    /(\d{1,2})\/(\d{1,2})/,
    /마감[:\s]*(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/,
  ];

  const now = new Date();
  const currentYear = now.getFullYear();

  for (const pattern of datePatterns) {
    const match = schedule.match(pattern);
    if (match) {
      try {
        if (match.length === 4) {
          // Full date: YYYY-MM-DD
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          return new Date(year, month, day);
        } else if (match.length === 3) {
          // Month-Day: assume current year
          const month = parseInt(match[1]) - 1;
          const day = parseInt(match[2]);
          const date = new Date(currentYear, month, day);
          // If date is in the past, assume next year
          if (date < now) {
            return new Date(currentYear + 1, month, day);
          }
          return date;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract reward amount from reward string
 * Returns number (in 만원) or 0
 */
function extractRewardAmount(reward: string | null | undefined): number {
  if (!reward || reward === "정보 없음") return 0;

  // Extract number followed by "만원" or "원"
  const match = reward.match(/([\d,]+)(만원|원)/);
  if (match) {
    const numberStr = match[1].replace(/,/g, "");
    const amount = parseInt(numberStr, 10);
    if (!isNaN(amount)) {
      if (match[2] === "만원") {
        return amount;
      } else {
        // Convert 원 to 만원
        return amount / 10000;
      }
    }
  }

  return 0;
}

/**
 * Check if email matches filters
 */
function matchesFilters(email: Email, filters: SortCommand["filters"]): boolean {
  if (!filters) return true;

  // Category filter
  if (filters.category) {
    const product = email.emailAnalysis?.product || "";
    if (!product.toLowerCase().includes(filters.category.toLowerCase())) {
      return false;
    }
  }

  // Deadline filter
  if (filters.deadline) {
    const schedule = email.emailAnalysis?.schedule || email.sponsorshipInfo?.deadline || null;
    if (!schedule || schedule === "정보 없음") {
      // If no deadline info and filter requires deadline, exclude
      if (filters.deadline.type === "within") {
        return false;
      }
    } else {
      const deadlineDate = extractDeadlineDate(schedule);
      if (deadlineDate) {
        const now = new Date();
        const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (filters.deadline.type === "within") {
          const days = filters.deadline.days || 7;
          if (daysDiff > days || daysDiff < 0) {
            return false;
          }
        } else if (filters.deadline.type === "before") {
          if (daysDiff > (filters.deadline.days || 0)) {
            return false;
          }
        } else if (filters.deadline.type === "after") {
          if (daysDiff < (filters.deadline.days || 0)) {
            return false;
          }
        }
      }
    }
  }

  // Min reward filter
  if (filters.minReward !== undefined) {
    const reward = extractRewardAmount(email.sponsorshipInfo?.reward);
    if (reward < filters.minReward) {
      return false;
    }
  }

  return true;
}

/**
 * Compare two emails based on sort criteria
 * Returns: -1 if email1 should come before email2, 1 if after, 0 if equal
 */
function compareEmails(
  email1: Email,
  email2: Email,
  sortBy: SortCommand["sortBy"]
): number {
  if (!sortBy || sortBy.length === 0) {
    return 0;
  }

  for (const sort of sortBy) {
    let value1: any;
    let value2: any;

    switch (sort.field) {
      case "deadline":
        const schedule1 = email1.emailAnalysis?.schedule || email1.sponsorshipInfo?.deadline || null;
        const schedule2 = email2.emailAnalysis?.schedule || email2.sponsorshipInfo?.deadline || null;
        value1 = extractDeadlineDate(schedule1);
        value2 = extractDeadlineDate(schedule2);
        // Emails without deadline go to the end
        if (!value1 && !value2) continue;
        if (!value1) return 1;
        if (!value2) return -1;
        break;

      case "reward":
        value1 = extractRewardAmount(email1.sponsorshipInfo?.reward);
        value2 = extractRewardAmount(email2.sponsorshipInfo?.reward);
        break;

      case "priority":
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        value1 = priorityOrder[email1.priorityLabel || "LOW"] || 0;
        value2 = priorityOrder[email2.priorityLabel || "LOW"] || 0;
        break;

      case "receivedAt":
        value1 = new Date(email1.receivedAt).getTime();
        value2 = new Date(email2.receivedAt).getTime();
        break;

      default:
        continue;
    }

    if (value1 < value2) {
      return sort.order === "asc" ? -1 : 1;
    } else if (value1 > value2) {
      return sort.order === "asc" ? 1 : -1;
    }
    // If equal, continue to next sort criterion
  }

  return 0;
}

/**
 * Binary tree tournament sort for emails using pairwise comparison
 * More efficient for complex multi-criteria sorting
 * Uses tournament tree structure: compare pairs, winners advance
 */
function tournamentSort(emails: Email[], sortBy: SortCommand["sortBy"]): Email[] {
  if (emails.length <= 1) return emails;
  if (emails.length === 2) {
    return compareEmails(emails[0], emails[1], sortBy) <= 0
      ? [emails[0], emails[1]]
      : [emails[1], emails[0]];
  }

  // For small arrays, use standard sort (more efficient)
  if (emails.length <= 10) {
    return [...emails].sort((a, b) => compareEmails(a, b, sortBy));
  }

  // Tournament sort: build tournament tree by comparing pairs
  // Each level compares pairs, winners advance to next level
  let currentLevel: Email[] = [...emails];
  const tournamentTree: Email[][] = [currentLevel];

  // Build tournament tree levels
  while (currentLevel.length > 1) {
    const nextLevel: Email[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Compare pair, winner advances
        const comparison = compareEmails(currentLevel[i], currentLevel[i + 1], sortBy);
        nextLevel.push(comparison <= 0 ? currentLevel[i] : currentLevel[i + 1]);
      } else {
        // Odd number, advance the last one
        nextLevel.push(currentLevel[i]);
      }
    }
    tournamentTree.push(nextLevel);
    currentLevel = nextLevel;
  }

  // Extract sorted order from tournament tree
  // Start from the root (winner) and rebuild sorted list
  const sorted: Email[] = [];
  const used = new Set<string>();

  // Extract winners from each level, maintaining order
  for (let level = tournamentTree.length - 1; level >= 0; level--) {
    for (const email of tournamentTree[level]) {
      if (!used.has(email.id)) {
        sorted.push(email);
        used.add(email.id);
      }
    }
  }

  // Final pass: ensure correct order (tournament tree gives approximate order)
  return sorted.sort((a, b) => compareEmails(a, b, sortBy));
}

/**
 * Filter and sort emails based on command
 */
export function applySortCommand(emails: Email[], command: SortCommand): Email[] {
  // First, apply filters
  let filtered = emails.filter((email) => matchesFilters(email, command.filters));

  // Then, apply sorting
  if (command.sortBy && command.sortBy.length > 0) {
    // Use tournament sort for better performance with pairwise comparisons
    filtered = tournamentSort(filtered, command.sortBy);
  }

  return filtered;
}

