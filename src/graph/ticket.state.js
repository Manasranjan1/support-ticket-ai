import { Annotation } from '@langchain/langgraph';

// ---------------------------------------------------------------------------
// ticket.state.js — LangGraph Shared Graph State
//
// This is the single object that flows through every node in the graph.
// Each node reads from it and returns a PARTIAL update (only the fields it sets).
// LangGraph merges those updates back into the state using the reducer functions.
//
// Annotation.Root() defines the state shape and how updates are applied.
//
// Reducer: (currentValue, newValue) => result
//   We use (x, y) => y ?? x for all fields, which means:
//   "Take the new value if it's provided, otherwise keep the existing value."
//   This is the standard "last-write-wins" / overwrite reducer.
//
// Why not just use a plain object?
//   LangGraph needs reducer functions to know HOW to merge parallel updates.
//   For this linear workflow it doesn't matter much, but it's the required API.
// ---------------------------------------------------------------------------

export const TicketState = Annotation.Root({
  // ── Input fields (set once at the start, never changed) ──────────────────
  ticketId: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  customerName: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  customerEmail: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  subject: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  customerMessage: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  // ── Set by classifyTicket node ────────────────────────────────────────────
  category: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  sentiment: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  priority: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  summary: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // ── Set by assignTeam node ────────────────────────────────────────────────
  assignedTeam: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // ── Set by generateResponse node ──────────────────────────────────────────
  suggestedResponse: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // ── Set by humanReview node (after interrupt resumes) ─────────────────────
  // Values: 'approved' | 'rejected'
  approvalStatus: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
});
