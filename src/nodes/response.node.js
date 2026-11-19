import { generateSuggestedResponse } from '../services/ticket-analysis.service.js';

// ---------------------------------------------------------------------------
// response.node.js
//
// Node 3 of the LangGraph workflow.
//
// Responsibility: Generate a professional, empathetic draft response for the
// support agent to review. By this point the state already has:
//   - category, priority, summary (from classifyTicket node)
//   - assignedTeam (from assignTeam node)
//
// The generated response is a SUGGESTION only. It is stored as
// `suggestedResponse` and must be explicitly approved by a human agent via
// the PATCH /api/tickets/:id/approve endpoint before it is considered final.
//
// This node makes ONE LLM call using free-form generation (not structured output).
// Prose responses need creativity — structured output is unnecessary here.
// ---------------------------------------------------------------------------

export async function generateResponseNode(state) {
  console.log(`[generateResponse] Generating suggested response for ticket: ${state.ticketId}`);

  const suggestedResponse = await generateSuggestedResponse({
    customerName: state.customerName,
    message: state.customerMessage,
    category: state.category,
    priority: state.priority,
    summary: state.summary,
  });

  console.log(`[generateResponse] Response generated (${suggestedResponse.length} chars)`);

  return { suggestedResponse };
}
