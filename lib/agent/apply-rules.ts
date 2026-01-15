import {
  getUserEmailCollectionRef,
  getUserRuleCollectionRef,
} from "@/lib/firebase";
import { RuleCondition, RuleAction } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Apply all active rules to an email
 */
export async function applyRulesToEmailTool(emailId: string, userId: string) {
  const inboxCollection = await getUserEmailCollectionRef(userId);
  const emailDoc = await inboxCollection.doc(emailId).get();

  if (!emailDoc.exists) {
    throw new Error("Email not found");
  }

  const email = {
    id: emailDoc.id,
    ...emailDoc.data(),
  } as any;

  const rulesCollection = await getUserRuleCollectionRef(userId);
  const rulesSnapshot = await rulesCollection.where("isActive", "==", true).get();

  const rules = rulesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

  const updates: any = {};

  for (const rule of rules) {
    const conditions = rule.conditions as RuleCondition[];
    const actions = rule.actions as RuleAction[];

    // Check if all conditions match
    let matches = true;
    for (const condition of conditions) {
      if (!evaluateCondition(condition, email)) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Apply actions
      for (const action of actions) {
        applyAction(action, updates);
      }
    }
  }

  // Update email if any changes
  if (Object.keys(updates).length > 0) {
    await inboxCollection.doc(emailId).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return { applied: Object.keys(updates).length > 0, updates };
}

function evaluateCondition(condition: RuleCondition, email: any): boolean {
  const { field, operator, value } = condition;

  let fieldValue: string | string[] = "";
  switch (field) {
    case "fromEmail":
      fieldValue = email.from;
      break;
    case "fromDomain":
      fieldValue = email.from.split("@")[1] || "";
      break;
    case "subject":
      fieldValue = email.subject;
      break;
    case "body":
      fieldValue = email.bodyFullText || email.bodySnippet || "";
      break;
    case "channel":
      fieldValue = email.channel;
      break;
    case "containsKeywords":
      fieldValue = email.bodyFullText || email.bodySnippet || email.subject;
      break;
    default:
      return false;
  }

  const searchValue = Array.isArray(value) ? value : [value];
  const searchText = String(fieldValue).toLowerCase();

  switch (operator) {
    case "CONTAINS":
      return searchValue.some((v) => searchText.includes(String(v).toLowerCase()));
    case "NOT_CONTAINS":
      return !searchValue.some((v) => searchText.includes(String(v).toLowerCase()));
    case "EQUALS":
      return searchValue.some((v) => searchText === String(v).toLowerCase());
    case "NOT_EQUALS":
      return !searchValue.some((v) => searchText === String(v).toLowerCase());
    case "IN":
      return searchValue.some((v) => searchText.includes(String(v).toLowerCase()));
    default:
      return false;
  }
}

function applyAction(action: RuleAction, updates: any) {
  switch (action.type) {
    case "SET_PRIORITY":
      const priority = action.value?.priority;
      if (priority === "HIGH") {
        updates.priorityScore = 90;
        updates.priorityLabel = "HIGH";
      } else if (priority === "MEDIUM") {
        updates.priorityScore = 60;
        updates.priorityLabel = "MEDIUM";
      } else if (priority === "LOW") {
        updates.priorityScore = 30;
        updates.priorityLabel = "LOW";
      }
      break;
    case "MARK_SPAM":
      updates.isSpam = action.value?.spam || true;
      updates.spamScore = 100;
      break;
    default:
      break;
  }
}

