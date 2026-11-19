import { classifyTicket } from '../services/ticket-analysis.service.js';

// ---------------------------------------------------------------------------
// classify.node.js
//
// Node 1 of the LangGraph workflow.
//
// Responsibility: Call the LLM to classify the ticket and extract:
//   - category  (Billing | Technical | Account | General)
//   - sentiment (Positive | Neutral | Negative)
//   - priority  (Low | Medium | High | Critical)
//   - summary   (brief description of the issue)
//
// This node makes ONE LLM call using withStructuredOutput (Zod schema).
// It reads from state and returns only the fields it sets — LangGraph merges
// the partial update into the full state automatically.
// ---------------------------------------------------------------------------

export async function classifyNode(state) {
  console.log(`[classifyTicket] Classifying ticket: "${state.subject}"`);

  const result = await classifyTicket({
    subject: state.subject,
    message: state.customerMessage,
  });

  console.log(`[classifyTicket] Result → Category: ${result.category}, Sentiment: ${result.sentiment}, Priority: ${result.priority}`);

  // Return only the fields this node is responsible for.
  // LangGraph merges this with the existing state — other fields are untouched.
  return {
    category: result.category,
    sentiment: result.sentiment,
    priority: result.priority,
    summary: result.summary,
  };
}
