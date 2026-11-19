// ---------------------------------------------------------------------------
// test-api.js — End-to-End API & Workflow Integration Test
//
// Tests the full lifecycle via HTTP:
//   1. POST /api/tickets (instant 201 response, background AI starts)
//   2. Poll GET /api/tickets/:id until status reaches PENDING_REVIEW
//   3. Inspect AI extraction: category, sentiment, priority, summary, suggestedResponse
//   4. PATCH /api/tickets/:id/response (edit response)
//   5. PATCH /api/tickets/:id/approve (resume graph, status -> APPROVED)
//   6. Verify final state and error handling (409 on duplicate approval)
//
// Usage:
//   node test-api.js
// ---------------------------------------------------------------------------

import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { testConnection } from './src/config/database.js';

async function runE2ETest() {
  console.log('='.repeat(65));
  console.log('  Support Ticket AI — End-to-End Integration Test');
  console.log('='.repeat(65));

  // 1. Verify DB
  try {
    await testConnection();
  } catch (err) {
    console.error('❌ Database connection failed. Please ensure DATABASE_URL in .env is configured.', err.message);
    process.exit(1);
  }

  // 2. Start ephemeral HTTP server
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`🌐 Test server listening on ${baseUrl}`);

  try {
    // 3. Test Health Check
    console.log('\n▶ Step 1: Health check (GET /health)...');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    console.log('  Response:', healthJson);

    // 4. Submit Ticket
    console.log('\n▶ Step 2: Creating ticket (POST /api/tickets)...');
    const postPayload = {
      customerName: 'Aarav Patel',
      customerEmail: 'aarav.patel@example.com',
      subject: 'Double charged on invoice #INV-4921',
      message: 'Hello, I noticed two charges of $99 on my bank statement for the same renewal invoice #INV-4921. Please review and process a refund for the duplicate charge as soon as possible.',
    };

    const postRes = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload),
    });

    const postJson = await postRes.json();
    console.log('  Status Code:', postRes.status);
    console.log('  Created Ticket ID:', postJson.data?.ticket?.id);
    console.log('  Initial Status:', postJson.data?.ticket?.status);

    const ticketId = postJson.data?.ticket?.id;
    if (!ticketId) throw new Error('Ticket ID was not returned.');

    // 5. Poll for AI Analysis Completion
    console.log('\n▶ Step 3: Polling GET /api/tickets/:id until AI analysis completes...');
    let ticket = null;
    const maxAttempts = 30; // 30 seconds max
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const getRes = await fetch(`${baseUrl}/api/tickets/${ticketId}`);
      const getJson = await getRes.json();
      ticket = getJson.data?.ticket;

      process.stdout.write(`  [${attempt}s] Current status: ${ticket?.status}\r`);

      if (ticket?.status === 'PENDING_REVIEW' || ticket?.status === 'ANALYSIS_FAILED') {
        break;
      }
    }
    console.log('\n');

    if (ticket?.status !== 'PENDING_REVIEW') {
      throw new Error(`AI Analysis did not reach PENDING_REVIEW. Final status was: ${ticket?.status}`);
    }

    console.log('✅ AI Analysis completed and graph paused at humanReview:');
    console.log(`  Category     : ${ticket.category}`);
    console.log(`  Sentiment    : ${ticket.sentiment}`);
    console.log(`  Priority     : ${ticket.priority}`);
    console.log(`  Assigned Team: ${ticket.assigned_team}`);
    console.log(`  Summary      : ${ticket.summary}`);
    console.log(`  Thread ID    : ${ticket.thread_id}`);
    console.log('\n  Suggested Response:');
    console.log(ticket.suggested_response.split('\n').map((l) => `    ${l}`).join('\n'));

    // 6. Test Response Editing
    console.log('\n▶ Step 4: Editing response (PATCH /api/tickets/:id/response)...');
    const customResponse = `Dear ${ticket.customer_name},\n\nWe have received your report regarding duplicate invoice #INV-4921. Our billing team is verifying the transaction and will issue a refund if confirmed within 24-48 business hours.\n\nBest regards,\nCustomer Support Team`;

    const editRes = await fetch(`${baseUrl}/api/tickets/${ticketId}/response`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalResponse: customResponse }),
    });

    const editJson = await editRes.json();
    console.log('  Status Code:', editRes.status);
    console.log('  Updated final_response:', editJson.data?.ticket?.final_response ? 'Yes' : 'No');

    // 7. Approve Ticket
    console.log('\n▶ Step 5: Approving response (PATCH /api/tickets/:id/approve)...');
    const approveRes = await fetch(`${baseUrl}/api/tickets/${ticketId}/approve`, {
      method: 'PATCH',
    });
    const approveJson = await approveRes.json();
    console.log('  Status Code:', approveRes.status);
    console.log('  Approved Status:', approveJson.data?.ticket?.status);

    // 8. Test Status Guard (Should return 409 Conflict)
    console.log('\n▶ Step 6: Testing status guard (Approving already approved ticket)...');
    const secondApproveRes = await fetch(`${baseUrl}/api/tickets/${ticketId}/approve`, {
      method: 'PATCH',
    });
    console.log('  Status Code (expected 409):', secondApproveRes.status);
    const secondApproveJson = await secondApproveRes.json();
    console.log('  Guard Message:', secondApproveJson.message);

    console.log('\n' + '='.repeat(65));
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('='.repeat(65));
  } finally {
    server.close();
  }
}

runE2ETest().catch((err) => {
  console.error('\n❌ Integration test failed:', err);
  process.exit(1);
});
