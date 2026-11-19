import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getChatModel } from '../config/ai.js';

// ---------------------------------------------------------------------------
// ticket-analysis.service.js
//
// Responsible for all AI-powered analysis of a support ticket.
// In Phase 2 this module is standalone — it is called directly to verify
// the LLM integration works. In Phase 5 it gets wired into the Express API.
//
// Key LangChain concept demonstrated here: withStructuredOutput()
// Instead of parsing free-form LLM text, we bind a Zod schema to the model.
// LangChain uses tool/function-calling under the hood to enforce the shape.
// The result is a plain JS object — guaranteed to match the schema.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Classification Schema
//
// Zod is used for two purposes:
//   1. Defining the shape we want from the LLM (passed to withStructuredOutput)
//   2. Runtime validation of the LLM result (extra safety net)
//
// .describe() on each field guides the LLM — these descriptions appear in the
// function/tool definition that LangChain sends to the model.
// ---------------------------------------------------------------------------
const classificationSchema = z.object({
  category: z
    .enum(['Billing', 'Technical', 'Account', 'General'])
    .describe(
      'The primary category of the support ticket. ' +
      'Billing: payment, refund, charge, invoice issues. ' +
      'Technical: bugs, errors, app not working, performance. ' +
      'Account: login, password, profile, access issues. ' +
      'General: product questions, feedback, other.'
    ),

  sentiment: z
    .enum(['Positive', 'Neutral', 'Negative'])
    .describe(
      'The emotional tone of the customer message. ' +
      'Positive: satisfied, happy, grateful. ' +
      'Neutral: informational, no strong emotion. ' +
      'Negative: frustrated, angry, upset, urgent.'
    ),

  priority: z
    .enum(['Low', 'Medium', 'High', 'Critical'])
    .describe(
      'The urgency and business impact of the ticket. ' +
      'Low: general questions, minor feedback. ' +
      'Medium: minor issues that need attention but are not blocking. ' +
      'High: service degraded, significant user impact. ' +
      'Critical: payment failure, duplicate charges, complete service outage, data loss.'
    ),

  summary: z
    .string()
    .max(200)
    .describe(
      'A concise, neutral one or two sentence summary of the customer issue. ' +
      'Write in third person. Do not include proposed solutions. Max 200 characters.'
    ),
});

// ---------------------------------------------------------------------------
// classifyTicket
//
// Sends the ticket message to the LLM and returns structured analysis.
// Uses temperature: 0 for deterministic, consistent classification results.
//
// @param {object} ticket
// @param {string} ticket.subject  - The ticket subject line
// @param {string} ticket.message  - The customer's message body
// @returns {Promise<{ category, sentiment, priority, summary }>}
// ---------------------------------------------------------------------------
export async function classifyTicket({ subject, message }) {
  // getChatModel() reads AI_PROVIDER from env — no provider logic here
  const model = getChatModel({ temperature: 0 });

  // Bind the Zod schema to the model.
  // LangChain translates the schema into a tool/function definition and sends
  // it to the LLM API. The model fills in the fields instead of generating text.
  const structuredModel = model.withStructuredOutput(classificationSchema, {
    name: 'classifyTicket', // Names the tool — helps some models understand context
  });

  const systemPrompt = new SystemMessage(
    `You are an expert customer support analyst. 
Your task is to analyze a customer support ticket and extract structured information.

Be objective and consistent. Base your analysis only on what the customer has written.
Do not invent or assume issues that are not mentioned.`
  );

  const userPrompt = new HumanMessage(
    `Analyze this customer support ticket:

Subject: ${subject}
Message: ${message}

Classify the ticket by category, sentiment, priority, and provide a brief summary.`
  );

  // Invoke the structured model — returns a plain JS object matching the schema
  const result = await structuredModel.invoke([systemPrompt, userPrompt]);

  // Extra safety: validate the result against our schema at runtime.
  // withStructuredOutput should already enforce this, but explicit validation
  // catches any edge cases and gives clear error messages during development.
  const parsed = classificationSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(
      `LLM returned invalid classification data: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// generateSuggestedResponse
//
// Given a classified ticket, generates a professional, empathetic draft response.
// Uses a slightly higher temperature (0.3) for more natural-sounding language.
//
// IMPORTANT: This response is a SUGGESTION only. It is never automatically sent.
// A human agent must approve it via the PATCH /api/tickets/:id/approve endpoint.
//
// @param {object} ticket
// @param {string} ticket.customerName
// @param {string} ticket.message
// @param {string} ticket.category
// @param {string} ticket.priority
// @param {string} ticket.summary
// @returns {Promise<string>} The suggested response text
// ---------------------------------------------------------------------------
export async function generateSuggestedResponse({ customerName, message, category, priority, summary }) {
  const model = getChatModel({ temperature: 0.3 });

  const systemPrompt = new SystemMessage(
    `You are a professional and empathetic customer support agent.
Your task is to draft a response to a customer support ticket.

Rules you must follow:
- Be professional, empathetic and clear.
- Acknowledge the customer's issue directly.
- Do NOT promise refunds, credits, fixes or timelines you cannot guarantee.
- Do NOT invent actions that have been taken (e.g., do not say "we have processed your refund").
- Do NOT include a subject line — write the response body only.
- End by telling the customer a support agent will follow up.
- Keep the response concise: 3–5 short paragraphs.`
  );

  const userPrompt = new HumanMessage(
    `Draft a response for this support ticket:

Customer Name: ${customerName}
Category: ${category}
Priority: ${priority}
Issue Summary: ${summary}
Customer's Original Message: ${message}

Write the response body addressed to ${customerName}.`
  );

  const result = await model.invoke([systemPrompt, userPrompt]);

  // result.content is the raw string response from the LLM
  if (!result.content || typeof result.content !== 'string') {
    throw new Error('LLM returned an empty or invalid response for generateSuggestedResponse');
  }

  return result.content.trim();
}
