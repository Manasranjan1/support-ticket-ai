import { db } from '../config/database.js';

// ---------------------------------------------------------------------------
// ticket.service.js
//
// All direct database interactions for the support_tickets table live here.
// The controller calls these functions and never writes SQL itself.
// This keeps SQL out of route/controller logic and in one predictable place.
// ---------------------------------------------------------------------------

/**
 * Insert a new ticket row.
 * Returns the full newly created ticket object.
 */
export async function createTicket({ customerName, customerEmail, subject, message }) {
  const sql = `
    INSERT INTO support_tickets (customer_name, customer_email, subject, message)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(sql, [customerName, customerEmail, subject, message]);
  return result.rows[0];
}

/**
 * Fetch all tickets, most recent first.
 * Returns a lightweight list (no large text columns like suggested_response).
 */
export async function getAllTickets() {
  const sql = `
    SELECT
      id,
      customer_name,
      customer_email,
      subject,
      status,
      category,
      sentiment,
      priority,
      assigned_team,
      created_at,
      updated_at
    FROM support_tickets
    ORDER BY created_at DESC
  `;
  const result = await db.query(sql);
  return result.rows;
}

/**
 * Fetch a single ticket by its UUID.
 * Returns the full ticket including AI analysis and suggested response.
 * Returns null if no ticket is found — the controller handles the 404.
 */
export async function getTicketById(id) {
  const sql = `
    SELECT * FROM support_tickets WHERE id = $1
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Update a ticket's AI analysis fields after the LangGraph workflow runs.
 * Called by ticket-analysis.service.js in later phases.
 */
export async function updateTicketAnalysis(id, { category, sentiment, priority, summary, assignedTeam, suggestedResponse, status, threadId }) {
  const sql = `
    UPDATE support_tickets
    SET
      category          = COALESCE($2, category),
      sentiment         = COALESCE($3, sentiment),
      priority          = COALESCE($4, priority),
      summary           = COALESCE($5, summary),
      assigned_team     = COALESCE($6, assigned_team),
      suggested_response = COALESCE($7, suggested_response),
      status            = COALESCE($8, status),
      thread_id         = COALESCE($9, thread_id),
      updated_at        = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await db.query(sql, [
    id, category, sentiment, priority, summary,
    assignedTeam, suggestedResponse, status, threadId,
  ]);
  return result.rows[0] || null;
}

/**
 * Update only the ticket status and updated_at.
 * Used by the approve/reject endpoints in Phase 4+.
 */
export async function updateTicketStatus(id, status) {
  const sql = `
    UPDATE support_tickets
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await db.query(sql, [id, status]);
  return result.rows[0] || null;
}

/**
 * Update the final_response field.
 * Called when a support agent edits or approves a response.
 */
export async function updateFinalResponse(id, finalResponse) {
  const sql = `
    UPDATE support_tickets
    SET final_response = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await db.query(sql, [id, finalResponse]);
  return result.rows[0] || null;
}
