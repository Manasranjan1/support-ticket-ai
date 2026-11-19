// ---------------------------------------------------------------------------
// test-graph.js — Manual LangGraph Workflow Test
//
// Run this to verify the full LangGraph workflow:
//   1. Graph runs through classify → assign → generate → interrupt
//   2. We detect the interrupt and display the paused state
//   3. We resume with 'approved' and verify the graph completes
//   4. We run a second ticket and resume with 'rejected'
//
// Usage:
//   node test-graph.js
//
// Requires: GOOGLE_API_KEY in .env (or OPENAI_API_KEY if AI_PROVIDER=openai)
// ---------------------------------------------------------------------------

import dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import { Command } from '@langchain/langgraph';
import { ticketGraph } from './src/graph/ticket.graph.js';

const testTickets = [
  {
    label: 'Test 1 — Approve flow (Billing / Critical)',
    ticketId: randomUUID(),
    customerName: 'Rahul Sharma',
    customerEmail: 'rahul@example.com',
    subject: 'Charged twice for subscription',
    customerMessage:
      'My credit card was charged twice this month for the same subscription. ' +
      'I have not received any refund yet. This is unacceptable.',
    resume: 'approved',
  },
  {
    label: 'Test 2 — Reject flow (Technical / High)',
    ticketId: randomUUID(),
    customerName: 'Priya Patel',
    customerEmail: 'priya@example.com',
    subject: 'App crashes on login',
    customerMessage:
      'Every time I try to log in the app crashes. I reinstalled twice. Cannot access my account.',
    resume: 'rejected',
  },
];

async function runTest() {
  console.log('='.repeat(65));
  console.log('  LangGraph Workflow Test — Phase 3');
  console.log('='.repeat(65));

  for (const ticket of testTickets) {
    console.log(`\n${'─'.repeat(65)}`);
    console.log(`${ticket.label}`);
    console.log(`Thread ID: ${ticket.ticketId}`);
    console.log('─'.repeat(65));

    // Each ticket gets its own thread_id — this is how LangGraph isolates
    // the checkpoint state for separate tickets.
    const config = { configurable: { thread_id: ticket.ticketId } };

    // ── Step 1: Initial graph run ──────────────────────────────────────────
    console.log('\n▶ Running graph (will pause at humanReview)...\n');

    const initialResult = await ticketGraph.invoke(
      {
        ticketId: ticket.ticketId,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        subject: ticket.subject,
        customerMessage: ticket.customerMessage,
      },
      config
    );

    // ── Step 2: Detect the interrupt ───────────────────────────────────────
    if (initialResult.__interrupt__) {
      const interruptPayload = initialResult.__interrupt__[0].value;

      console.log('⏸  Graph paused at humanReview node');
      console.log('\nInterrupt payload (what the HTTP layer would receive):');
      console.log(`  ticketId       : ${interruptPayload.ticketId}`);
      console.log(`  category       : ${initialResult.category}`);
      console.log(`  sentiment      : ${initialResult.sentiment}`);
      console.log(`  priority       : ${initialResult.priority}`);
      console.log(`  assignedTeam   : ${initialResult.assignedTeam}`);
      console.log(`  summary        : ${initialResult.summary}`);
      console.log('\n  suggestedResponse:');
      console.log(
        interruptPayload.suggestedResponse
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')
      );

      // ── Step 3: Resume with human decision ────────────────────────────────
      console.log(`\n▶ Resuming graph with decision: "${ticket.resume}"...\n`);

      const finalResult = await ticketGraph.invoke(
        new Command({ resume: ticket.resume }),
        config
      );

      console.log('✅ Graph completed');
      console.log(`  approvalStatus: ${finalResult.approvalStatus}`);
    } else {
      // This should not happen in normal flow — log the full result if it does
      console.log('⚠ Graph completed without interrupting (unexpected)');
      console.log(initialResult);
    }
  }

  console.log(`\n${'='.repeat(65)}`);
  console.log('  Graph tests complete');
  console.log('='.repeat(65));
}

runTest().catch((err) => {
  console.error('\n❌ Graph test failed:', err.message);
  process.exit(1);
});
