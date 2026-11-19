import { body, validationResult } from 'express-validator';
import {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicketAnalysis,
  updateTicketStatus,
  updateFinalResponse,
} from '../services/ticket.service.js';
import { analyzeTicket, resumeWorkflow } from '../services/ticket-analysis.service.js';

// ---------------------------------------------------------------------------
// ticket.controller.js
//
// Handles HTTP request/response for all ticket endpoints.
// Keeps responsibilities clear:
//   - Parse and validate the incoming request
//   - Call the appropriate service function
//   - Shape and return the HTTP response
//   - Pass unexpected errors to the global error middleware via next(error)
//
// No SQL or LLM logic lives here.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Validation rules for POST /api/tickets
// ---------------------------------------------------------------------------
export const createTicketValidation = [
  body('customerName')
    .trim()
    .notEmpty().withMessage('customerName is required')
    .isLength({ max: 255 }).withMessage('customerName must be 255 characters or fewer'),

  body('customerEmail')
    .trim()
    .notEmpty().withMessage('customerEmail is required')
    .isEmail().withMessage('customerEmail must be a valid email address')
    .normalizeEmail(),

  body('subject')
    .trim()
    .notEmpty().withMessage('subject is required')
    .isLength({ max: 500 }).withMessage('subject must be 500 characters or fewer'),

  body('message')
    .trim()
    .notEmpty().withMessage('message is required')
    .isLength({ min: 10 }).withMessage('message must be at least 10 characters'),
];

// Reads validation errors and sends 400 if any exist.
// Returns false and sends the response — the caller should return immediately.
function handleValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/tickets
//
// Phase 1: Creates the ticket in the DB and returns it (no AI yet).
// Phase 5: Will also trigger analyzeTicket() after creating the DB row.
//
// The ticket is created first so the client immediately receives a ticket ID.
// AI processing runs after and updates the same row.
// ---------------------------------------------------------------------------
export async function createTicketHandler(req, res, next) {
  if (!handleValidationErrors(req, res)) return;

  try {
    const { customerName, customerEmail, subject, message } = req.body;

    // Step 1: Save the ticket to the DB with status=NEW
    const ticket = await createTicket({ customerName, customerEmail, subject, message });

    // Step 2: Trigger the LangGraph AI workflow asynchronously.
    // We do NOT await this — the client gets an immediate response with the ticket ID.
    // The workflow runs in the background and updates the DB row when it completes.
    //
    // Why not await?
    //   The LangGraph workflow makes 2 LLM API calls. This takes 3–8 seconds.
    //   Making the client wait that long for a POST response is poor UX.
    //   The client can poll GET /api/tickets/:id to see when status changes.
    runAnalysisInBackground(ticket);

    res.status(201).json({
      status: 'success',
      message: 'Ticket created. AI analysis has started.',
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// runAnalysisInBackground
//
// Fires the LangGraph workflow without blocking the HTTP response.
// Updates the DB row with AI results when the graph pauses at humanReview.
//
// This is a "fire and forget" pattern. Errors are caught and logged,
// and the ticket status is set to reflect any failure.
// ---------------------------------------------------------------------------
async function runAnalysisInBackground(ticket) {
  try {
    // Update status to ANALYZING so the client knows processing has started
    await updateTicketStatus(ticket.id, 'ANALYZING');

    // Run the full workflow — this pauses at humanReview and returns AI results
    const analysisResult = await analyzeTicket(ticket);

    // Save all AI results + thread_id to the DB and set status to PENDING_REVIEW
    await updateTicketAnalysis(ticket.id, {
      category: analysisResult.category,
      sentiment: analysisResult.sentiment,
      priority: analysisResult.priority,
      summary: analysisResult.summary,
      assignedTeam: analysisResult.assignedTeam,
      suggestedResponse: analysisResult.suggestedResponse,
      status: 'PENDING_REVIEW',
      threadId: analysisResult.threadId,
    });

    console.log(`✅ Ticket ${ticket.id} analyzed. Status: PENDING_REVIEW`);
  } catch (error) {
    // If the AI workflow fails (LLM error, network issue, etc.),
    // log the error and leave the ticket in a visible error state.
    // A support agent can manually handle it.
    console.error(`❌ AI analysis failed for ticket ${ticket.id}:`, error.message);

    try {
      await updateTicketStatus(ticket.id, 'ANALYSIS_FAILED');
    } catch (dbError) {
      console.error('Failed to update ticket status to ANALYSIS_FAILED:', dbError.message);
    }
  }
}

// ---------------------------------------------------------------------------
// GET /api/tickets — List all tickets (lightweight)
// ---------------------------------------------------------------------------
export async function getAllTicketsHandler(req, res, next) {
  try {
    const tickets = await getAllTickets();
    res.status(200).json({
      status: 'success',
      data: { count: tickets.length, tickets },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// GET /api/tickets/:id — Full ticket details
// ---------------------------------------------------------------------------
export async function getTicketByIdHandler(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        status: 'error',
        message: `Ticket with id '${id}' not found`,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tickets/:id/approve
//
// Human approves the AI-suggested response.
//
// Flow:
//   1. Validate ticket exists and is in PENDING_REVIEW
//   2. Resume the paused LangGraph workflow with 'approved'
//   3. Update DB status to APPROVED
//   4. Return updated ticket
//
// The graph's humanReview node receives 'approved' as the interrupt return value,
// sets approvalStatus in graph state, and the graph reaches END.
// ---------------------------------------------------------------------------
export async function approveTicketHandler(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      return res.status(404).json({ status: 'error', message: `Ticket '${id}' not found` });
    }
    if (ticket.status !== 'PENDING_REVIEW') {
      return res.status(409).json({
        status: 'error',
        message: `Ticket cannot be approved. Current status is '${ticket.status}'. Expected 'PENDING_REVIEW'.`,
      });
    }
    if (!ticket.thread_id) {
      return res.status(409).json({
        status: 'error',
        message: 'No active workflow thread found. This ticket may not have been processed by the AI workflow.',
      });
    }

    // Resume the paused LangGraph graph with the human decision
    await resumeWorkflow(ticket.thread_id, 'approved');

    // Update the DB to reflect the final approved status
    const updated = await updateTicketStatus(id, 'APPROVED');

    res.status(200).json({
      status: 'success',
      message: 'Ticket response approved successfully',
      data: { ticket: updated },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tickets/:id/reject
//
// Human rejects the AI-suggested response.
// Same flow as approve, but resumes with 'rejected'.
// ---------------------------------------------------------------------------
export async function rejectTicketHandler(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      return res.status(404).json({ status: 'error', message: `Ticket '${id}' not found` });
    }
    if (ticket.status !== 'PENDING_REVIEW') {
      return res.status(409).json({
        status: 'error',
        message: `Ticket cannot be rejected. Current status is '${ticket.status}'. Expected 'PENDING_REVIEW'.`,
      });
    }
    if (!ticket.thread_id) {
      return res.status(409).json({
        status: 'error',
        message: 'No active workflow thread found for this ticket.',
      });
    }

    // Resume the paused LangGraph graph with the human decision
    await resumeWorkflow(ticket.thread_id, 'rejected');

    // Update the DB status
    const updated = await updateTicketStatus(id, 'REJECTED');

    res.status(200).json({
      status: 'success',
      message: 'Ticket response rejected',
      data: { ticket: updated },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tickets/:id/response
//
// Support agent edits the suggested response before approving.
// This is a pure database update — no graph involvement.
//
// After editing, the agent still needs to call PATCH /approve to finalize.
// The edited text goes into final_response; suggested_response is preserved.
// ---------------------------------------------------------------------------
export async function updateResponseHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { finalResponse } = req.body;

    if (!finalResponse || typeof finalResponse !== 'string' || finalResponse.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'finalResponse is required and must be a non-empty string',
      });
    }

    const ticket = await getTicketById(id);

    if (!ticket) {
      return res.status(404).json({ status: 'error', message: `Ticket '${id}' not found` });
    }
    if (ticket.status !== 'PENDING_REVIEW') {
      return res.status(409).json({
        status: 'error',
        message: `Response can only be edited when status is 'PENDING_REVIEW'. Current: '${ticket.status}'.`,
      });
    }

    const updated = await updateFinalResponse(id, finalResponse.trim());

    res.status(200).json({
      status: 'success',
      message: 'Response updated. Call PATCH /approve to finalize.',
      data: { ticket: updated },
    });
  } catch (error) {
    next(error);
  }
}
