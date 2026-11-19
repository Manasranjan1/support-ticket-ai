import { Router } from 'express';
import {
  createTicketValidation,
  createTicketHandler,
  getAllTicketsHandler,
  getTicketByIdHandler,
  approveTicketHandler,
  rejectTicketHandler,
  updateResponseHandler,
} from '../controllers/ticket.controller.js';

const router = Router();

// ---------------------------------------------------------------------------
// Ticket CRUD
// ---------------------------------------------------------------------------

// Create a new ticket (validation middleware runs first, then the handler)
router.post('/', createTicketValidation, createTicketHandler);

// List all tickets
router.get('/', getAllTicketsHandler);

// Get a single ticket's full details
router.get('/:id', getTicketByIdHandler);

// ---------------------------------------------------------------------------
// Human Review Actions
// ---------------------------------------------------------------------------

// Approve the AI-suggested response
router.patch('/:id/approve', approveTicketHandler);

// Reject the AI-suggested response
router.patch('/:id/reject', rejectTicketHandler);

// Edit the suggested response (agent provides their own version)
router.patch('/:id/response', updateResponseHandler);

export default router;
