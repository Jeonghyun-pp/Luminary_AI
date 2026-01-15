import { classifyEmailTool } from "./classify";
import { extractScheduleFromEmailTool } from "./extract-schedule";
import { parseRuleFromNaturalLanguageTool } from "./parse-rule";
import { applyRulesToEmailTool } from "./apply-rules";
import { summarizeEmailTool } from "./summarize";
import { createTaskFromEmailTool } from "./create-task";

/**
 * All available tools for the AI agent
 * These are the functions that the LLM can call via function calling
 */
export const agentTools = {
  classifyEmail: async ({
    emailId,
    userId,
  }: {
    emailId: string;
    userId: string;
  }) => classifyEmailTool(emailId, userId),
  extractScheduleFromEmail: async ({
    emailId,
    userId,
  }: {
    emailId: string;
    userId: string;
  }) => extractScheduleFromEmailTool(emailId, userId),
  parseRuleFromNaturalLanguage: parseRuleFromNaturalLanguageTool,
  applyRulesToEmail: async ({
    emailId,
    userId,
  }: {
    emailId: string;
    userId: string;
  }) => applyRulesToEmailTool(emailId, userId),
  summarizeEmail: async ({
    emailId,
    userId,
  }: {
    emailId: string;
    userId: string;
  }) => summarizeEmailTool(emailId, userId),
  createTaskFromEmail: async ({
    emailId,
    userId,
    title,
    description,
    dueAt,
  }: {
    emailId: string;
    userId: string;
    title: string;
    description?: string;
    dueAt?: string;
  }) => createTaskFromEmailTool(emailId, userId, title, description, dueAt),
};

/**
 * OpenAI function calling definitions for the tools
 */
export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "classifyEmail",
      description: "Classify an email by priority and spam status",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "string",
            description: "The ID of the email to classify",
          },
          userId: {
            type: "string",
            description: "The owner of the email",
          },
        },
        required: ["emailId", "userId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "extractScheduleFromEmail",
      description: "Extract schedule/event information from an email",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "string",
            description: "The ID of the email to extract schedule from",
          },
          userId: {
            type: "string",
            description: "The owner of the email",
          },
        },
        required: ["emailId", "userId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "parseRuleFromNaturalLanguage",
      description: "Parse a natural language rule description into structured rule conditions and actions",
      parameters: {
        type: "object",
        properties: {
          userId: {
            type: "string",
            description: "The user ID who owns this rule",
          },
          naturalLanguageText: {
            type: "string",
            description: "Natural language description of the rule",
          },
        },
        required: ["userId", "naturalLanguageText"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "applyRulesToEmail",
      description: "Apply all active rules to an email",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "string",
            description: "The ID of the email to apply rules to",
          },
          userId: {
            type: "string",
            description: "The owner of the email",
          },
        },
        required: ["emailId", "userId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "summarizeEmail",
      description: "Generate a summary of an email",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "string",
            description: "The ID of the email to summarize",
          },
          userId: {
            type: "string",
            description: "The owner of the email",
          },
        },
        required: ["emailId", "userId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "createTaskFromEmail",
      description: "Create a task from an email",
      parameters: {
        type: "object",
        properties: {
          emailId: {
            type: "string",
            description: "The ID of the email to create task from",
          },
          title: {
            type: "string",
            description: "Title of the task",
          },
          userId: {
            type: "string",
            description: "The owner of the email/task",
          },
          description: {
            type: "string",
            description: "Description of the task",
          },
          dueAt: {
            type: "string",
            description: "Due date in ISO format (optional)",
          },
        },
        required: ["emailId", "title", "userId"],
      },
    },
  },
];

