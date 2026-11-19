import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { getChatModel } from '../config/ai.js';
import { ticketGraph } from '../graph/ticket.graph.js';

// ---------------------------------------------------------------------------
// ticket-analysis.service.js
//
// All AI-powered operations live here.
// This module is the bridge between:
//   - The LangGraph workflow (ticket.graph.js)
//   - The Express controllers (ticket.controller.js)
//   - The database service (ticket.service.js)
//
// Functions exported:
//   classifyTicket()         — structured LLM call (category/sentiment/priority/summary)
//   generateSuggestedResponse() — free-form LLM response draft
//   analyzeTicket()          — runs the full graph, handles the interrupt
//   resumeWorkflow()         — resumes a paused graph after human decision
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Classification Schema (Zod)
// Passed to withStructuredOutput() to enforce a typed return from the LLM.
// .describe() text is embedded in the tool definition sent to the LLM API.
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
// One LLM call → category, sentiment, priority, summary
// Called by classify.node.js inside the LangGraph workflow.
// ---------------------------------------------------------------------------
export async function classifyTicket({ subject, message }) {
  const model = getChatModel({ temperature: 0 });

  const structuredModel = model.withStructuredOutput(classificationSchema, {
    name: 'classifyTicket',
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

  const result = await structuredModel.invoke([systemPrompt, userPrompt]);

  // Runtime validation — extra safety net on top of withStructuredOutput
  const parsed = classificationSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`LLM returned invalid classification data: ${parsed.error.message}`);
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// generateSuggestedResponse
// One LLM call → professional draft reply for the customer.
// Called by response.node.js inside the LangGraph workflow.
//
// IMPORTANT: This is a DRAFT only. Never auto-sent. Requires human approval.
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

  if (!result.content || typeof result.content !== 'string') {
    throw new Error('LLM returned an empty or invalid response for generateSuggestedResponse');
  }

  return result.content.trim();
}

// ---------------------------------------------------------------------------
// analyzeTicket
//
// Orchestrates the full LangGraph workflow for a newly created ticket.
// Called by ticket.controller.js → POST /api/tickets (Phase 5).
//
// Flow:
//   1. Run the graph with the ticket data
//   2. Graph runs: classify → assignTeam → generateResponse → humanReview
//   3. Graph PAUSES at humanReview (interrupt)
//   4. We detect the interrupt and return the AI results
//   5. The controller saves the results + thread_id to the DB
//
// The ticket's DB `id` is used as the graph `thread_id`.
// This creates a natural 1:1 link between the DB row and the graph checkpoint.
//
// @param {object} ticket - The DB ticket row (snake_case field names)
// @returns {object} AI analysis results + threadId
// ---------------------------------------------------------------------------
export async function analyzeTicket(ticket) {
  // Use the ticket's DB UUID as the LangGraph thread_id.
  // This means: one ticket = one graph thread = one checkpoint series.
  const threadId = ticket.id;
  const config = { configurable: { thread_id: threadId } };

  const result = await ticketGraph.invoke(
    {
      ticketId: ticket.id,
      customerName: ticket.customer_name,
      customerEmail: ticket.customer_email,
      subject: ticket.subject,
      customerMessage: ticket.message,
    },
    config
  );

  // The graph should always pause at humanReview.
  // If __interrupt__ is present, the graph is waiting for human input — this is the expected case.
  if (result.__interrupt__) {
    return {
      category: result.category,
      sentiment: result.sentiment,
      priority: result.priority,
      summary: result.summary,
      assignedTeam: result.assignedTeam,
      suggestedResponse: result.suggestedResponse,
      threadId,
    };
  }

  // Safety fallback: graph completed without interrupting.
  // This should not happen in normal operation. Log it and return what we have.
  console.warn('[analyzeTicket] Graph completed without interrupting — humanReview node may have been skipped.');
  return {
    category: result.category,
    sentiment: result.sentiment,
    priority: result.priority,
    summary: result.summary,
    assignedTeam: result.assignedTeam,
    suggestedResponse: result.suggestedResponse,
    threadId,
  };
}

// ---------------------------------------------------------------------------
// resumeWorkflow
//
// Resumes a paused LangGraph graph after a human decision.
// Called by the approve and reject controller handlers.
//
// LangGraph loads the checkpoint saved during the interrupt() call,
// re-enters the humanReview node, and runs to completion.
//
// @param {string} threadId   - The graph thread_id (same as ticket.id)
// @param {string} decision   - 'approved' | 'rejected'
// @returns {object} Final graph state
// ---------------------------------------------------------------------------
export async function resumeWorkflow(threadId, decision) {
  const config = { configurable: { thread_id: threadId } };

  const finalState = await ticketGraph.invoke(
    new Command({ resume: decision }),
    config
  );

  return finalState;
}
