import { openai } from "@/lib/openai";
import { getUserRuleCollectionRef } from "@/lib/firebase";
import { InboxRule, RuleCondition, RuleAction } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Parse natural language rule description into structured rule
 */
export async function parseRuleFromNaturalLanguageTool(
  userId: string,
  naturalLanguageText: string
): Promise<InboxRule> {
  const systemPrompt = `You are a rule parsing assistant. Convert natural language rule descriptions into structured rule objects.

A rule consists of:
- name: Short descriptive name
- description: The original natural language description
- conditions: Array of conditions that must be met
- actions: Array of actions to perform when conditions are met

Condition fields: fromEmail, fromDomain, subject, body, channel, language, containsKeywords, notContainsKeywords, isReply, hasAttachment
Condition operators: CONTAINS, NOT_CONTAINS, EQUALS, NOT_EQUALS, IN

Action types: SET_PRIORITY, MARK_SPAM, MOVE_TO_FOLDER, CREATE_CALENDAR_EVENT, CREATE_TASK, AUTO_REPLY
Action values: For SET_PRIORITY: {priority: "HIGH"}, For MARK_SPAM: {spam: true}, etc.

Return a JSON object matching the InboxRule structure.`;

  const userPrompt = `Parse this rule description into a structured rule:

"${naturalLanguageText}"

Return only valid JSON matching the InboxRule structure, no markdown formatting.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const parsed = JSON.parse(response.choices[0].message.content || "{}");

  // Save to database
  const ruleCollection = await getUserRuleCollectionRef(userId);
  const ruleRef = await ruleCollection.add({
    userId,
    name: parsed.name || "Untitled Rule",
    description: parsed.description || naturalLanguageText,
    conditions: parsed.conditions || [],
    actions: parsed.actions || [],
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const ruleDoc = await ruleRef.get();
  const ruleData = ruleDoc.data();

  return {
    id: ruleDoc.id,
    ...ruleData,
    conditions: (ruleData?.conditions || []) as RuleCondition[],
    actions: (ruleData?.actions || []) as RuleAction[],
    createdAt: ruleData?.createdAt?.toDate?.() || new Date(),
    updatedAt: ruleData?.updatedAt?.toDate?.() || new Date(),
  } as InboxRule;
}

