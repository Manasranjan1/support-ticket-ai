import { interrupt } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// review.node.js
//
// Node 4 (final) of the LangGraph workflow.
//
// Responsibility: Pause the graph and wait for a human decision.
//
// ── How interrupt() works ───────────────────────────────────────────────────
//
// 1. The node calls interrupt(payload).
//    - Execution STOPS here — the rest of the function does not run yet.
//    - LangGraph checkpoints the full graph state at this exact point.
//    - The caller (ticket-analysis.service.js) receives the result with
//      an `__interrupt__` property containing the payload.
//
// 2. The HTTP layer detects __interrupt__, saves the thread_id to the DB,
//    and sets the ticket status to PENDING_REVIEW.
//
// 3. Later, a support agent calls PATCH /api/tickets/:id/approve or /reject.
//    - The API calls graph.invoke(new Command({ resume: 'approved' }), config)
//      using the same thread_id that was saved in step 2.
//
// 4. LangGraph loads the saved checkpoint and RESUMES execution inside this
//    node, right at the interrupt() call. The return value of interrupt()
//    becomes whatever was passed into Command({ resume: ... }).
//
// 5. The node returns { approvalStatus: decision } and the graph reaches END.
//
// ── Why MemorySaver is required ─────────────────────────────────────────────
//
// Without a checkpointer, LangGraph cannot save the state between step 1 and
// step 4. The graph would have no memory of the paused execution.
// MemorySaver stores checkpoints in-memory (lost on restart — documented tradeoff).
// ---------------------------------------------------------------------------

export async function humanReviewNode(state) {
  console.log(`[humanReview] Pausing for human review. Ticket: ${state.ticketId}`);

  // interrupt() pauses execution and surfaces this payload to the caller.
  // When the graph is resumed via Command({ resume: value }), that value
  // is returned here as `decision`.
  const decision = interrupt({
    message: 'Human review required. Approve or reject the suggested response.',
    ticketId: state.ticketId,
    suggestedResponse: state.suggestedResponse,
    category: state.category,
    priority: state.priority,
    assignedTeam: state.assignedTeam,
  });

  // This line only executes AFTER the graph is resumed.
  console.log(`[humanReview] Resumed with decision: "${decision}"`);

  return { approvalStatus: decision };
}
