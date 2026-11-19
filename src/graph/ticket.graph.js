import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { TicketState } from './ticket.state.js';
import { classifyNode } from '../nodes/classify.node.js';
import { assignTeamNode } from '../nodes/assignment.node.js';
import { generateResponseNode } from '../nodes/response.node.js';
import { humanReviewNode } from '../nodes/review.node.js';

// ---------------------------------------------------------------------------
// ticket.graph.js — LangGraph StateGraph Definition
//
// This file assembles the complete ticket processing workflow.
// It is the "blueprint" — it defines structure but contains no business logic.
//
// ── Graph structure ──────────────────────────────────────────────────────────
//
//   START
//     │
//     ▼
//   classifyTicket   ← 1 LLM call: category, sentiment, priority, summary
//     │
//     ▼
//   assignTeam       ← Pure JS: maps category → support team
//     │
//     ▼
//   generateResponse ← 1 LLM call: draft reply for the customer
//     │
//     ▼
//   humanReview      ← interrupt() — graph PAUSES here
//     │               resumes when agent calls approve/reject
//     ▼
//    END
//
// ── Why MemorySaver? ─────────────────────────────────────────────────────────
//
// interrupt() requires a checkpointer. Without it, LangGraph cannot save the
// paused state and the graph cannot be resumed.
//
// MemorySaver stores state in process memory — it is intentionally lightweight.
// The tradeoff: state is lost if the server restarts. For this portfolio project,
// the DB `status` field is the durable source of truth; MemorySaver handles
// only the in-flight workflow state.
//
// ── Why a single exported instance? ─────────────────────────────────────────
//
// We compile the graph ONCE at module load time and export a single instance.
// Every HTTP request uses the same compiled graph but a DIFFERENT thread_id,
// so each ticket gets its own isolated state checkpoint.
// ---------------------------------------------------------------------------

const checkpointer = new MemorySaver();

const workflow = new StateGraph(TicketState)
  .addNode('classifyTicket', classifyNode)
  .addNode('assignTeam', assignTeamNode)
  .addNode('generateResponse', generateResponseNode)
  .addNode('humanReview', humanReviewNode)
  .addEdge(START, 'classifyTicket')
  .addEdge('classifyTicket', 'assignTeam')
  .addEdge('assignTeam', 'generateResponse')
  .addEdge('generateResponse', 'humanReview')
  .addEdge('humanReview', END);

// compile() locks the graph structure and attaches the checkpointer.
// After this point the graph is immutable.
export const ticketGraph = workflow.compile({ checkpointer });
