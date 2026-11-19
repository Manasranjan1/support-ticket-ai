import { body, validationResult } from 'express-validator';
import {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicketStatus,
  updateFinalResponse,
} from '../services/ticket.service.js';

// ---------------------------------------------------------------------------
// Validation rules
//
// express-validator lets us declare validation rules as middleware arrays.
// We define them here and attach them directly to routes in ticket.routes.js.
// validationResult() collects any failures and returns them in a consistent shape.
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

// A small helper that reads validation errors and sends a 400 if there are any.
// Returns true if the request is valid, false if the response has already been sent.
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
// Create a new support ticket.
// In Phase 1, we just save it to the DB. AI processing is added in Phase 5.
// ---------------------------------------------------------------------------
export async function createTicketHandler(req, res, next) {
  if (!handleValidationErrors(req, res)) return;

  try {
    const { customerName, customerEmail, subject, message } = req.body;
    const ticket = await createTicket({ customerName, customerEmail, subject, message });

    res.status(201).json({
      status: 'success',
      message: 'Ticket created successfully',
      data: { ticket },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// GET /api/tickets
// Return a lightweight list of all tickets.
// ---------------------------------------------------------------------------
export async function getAllTicketsHandler(req, res, next) {
  try {
    const tickets = await getAllTickets();

    res.status(200).json({
      status: 'success',
      data: {
        count: tickets.length,
        tickets,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// GET /api/tickets/:id
// Return the full details of a single ticket including AI analysis.
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
// Approve the AI-suggested response.
// Status must be PENDING_REVIEW before this action is allowed.
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

    const updated = await updateTicketStatus(id, 'APPROVED');

    res.status(200).json({
      status: 'success',
      message: 'Ticket response approved',
      data: { ticket: updated },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/tickets/:id/reject
// Reject the AI-suggested response.
// Status must be PENDING_REVIEW before this action is allowed.
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
// Allow a support agent to edit the suggested response before or after approval.
// Status must be PENDING_REVIEW for an edit to make sense.
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
        message: `Response can only be edited when status is 'PENDING_REVIEW'. Current status: '${ticket.status}'.`,
      });
    }

    const updated = await updateFinalResponse(id, finalResponse.trim());

    res.status(200).json({
      status: 'success',
      message: 'Response updated successfully',
      data: { ticket: updated },
    });
  } catch (error) {
    next(error);
  }
}
