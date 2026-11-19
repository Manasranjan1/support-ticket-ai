// ---------------------------------------------------------------------------
// test-ai.js — Manual AI Integration Test Script
//
// Run this to verify that:
//   1. The AI provider module loads correctly
//   2. The Gemini API key is valid
//   3. withStructuredOutput returns the expected shape
//   4. generateSuggestedResponse returns readable text
//
// Usage:
//   node test-ai.js
//
// This file is NOT part of the production app. Delete it after Phase 2 testing.
// ---------------------------------------------------------------------------

import dotenv from 'dotenv';
dotenv.config();

import { classifyTicket, generateSuggestedResponse } from './src/services/ticket-analysis.service.js';

// Sample tickets covering different categories and priorities
const testTickets = [
  {
    label: '🔴 Critical / Billing / Negative',
    customerName: 'Rahul Sharma',
    subject: 'Charged twice for my subscription',
    message:
      'My credit card was charged twice this month for the same subscription. I have not received any refund yet. This is completely unacceptable and I need this resolved immediately.',
  },
  {
    label: '🟡 High / Technical / Negative',
    customerName: 'Priya Patel',
    subject: 'App keeps crashing on login',
    message:
      'Every time I try to log in to the mobile app it crashes after the loading screen. I have tried reinstalling it twice but the problem persists. I cannot access my account at all.',
  },
  {
    label: '🟢 Low / General / Positive',
    customerName: 'Arjun Mehta',
    subject: 'Question about premium features',
    message:
      'Hi, I am considering upgrading to your premium plan. Could you tell me what additional features I would get compared to the free tier? Thank you for your help.',
  },
  {
    label: '🔵 Medium / Account / Neutral',
    customerName: 'Sara Khan',
    subject: 'Cannot update my email address',
    message:
      'I am trying to change my registered email address in account settings but the save button is greyed out. I need to update it because I no longer have access to the old one.',
  },
];

async function runTest() {
  console.log('='.repeat(60));
  console.log('  AI Integration Test — Phase 2');
  console.log('  Provider:', process.env.AI_PROVIDER || 'google');
  console.log('  Model:', process.env.GOOGLE_CHAT_MODEL || 'gemini-2.0-flash');
  console.log('='.repeat(60));

  for (const ticket of testTickets) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Test: ${ticket.label}`);
    console.log(`Subject: "${ticket.subject}"`);
    console.log('─'.repeat(60));

    try {
      // Step 1: Classify the ticket
      console.log('\n📊 Classifying ticket...');
      const classification = await classifyTicket({
        subject: ticket.subject,
        message: ticket.message,
      });

      console.log('Classification result:');
      console.log(`  Category : ${classification.category}`);
      console.log(`  Sentiment: ${classification.sentiment}`);
      console.log(`  Priority : ${classification.priority}`);
      console.log(`  Summary  : ${classification.summary}`);

      // Step 2: Generate a suggested response
      console.log('\n✍️  Generating suggested response...');
      const response = await generateSuggestedResponse({
        customerName: ticket.customerName,
        message: ticket.message,
        category: classification.category,
        priority: classification.priority,
        summary: classification.summary,
      });

      console.log('\nSuggested Response:');
      console.log(response);

    } catch (err) {
      console.error(`\n❌ Test failed for "${ticket.label}":`, err.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('  Tests complete');
  console.log('='.repeat(60));
}

runTest();
