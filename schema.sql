-- =============================================================================
-- support_tickets table
-- Run this SQL in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  -- UUID primary key — avoids sequential ID guessing and is globally unique
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer-provided fields (required at ticket creation)
  customer_name     VARCHAR(255)  NOT NULL,
  customer_email    VARCHAR(255)  NOT NULL,
  subject           VARCHAR(500)  NOT NULL,
  message           TEXT          NOT NULL,

  -- AI-generated analysis fields (populated after the LangGraph workflow runs)
  category          VARCHAR(50),   -- Billing | Technical | Account | General
  sentiment         VARCHAR(50),   -- Positive | Neutral | Negative
  priority          VARCHAR(50),   -- Low | Medium | High | Critical
  summary           TEXT,          -- Short AI-generated description of the issue
  assigned_team     VARCHAR(100),  -- Billing Support | Technical Support | etc.

  -- Response fields
  suggested_response TEXT,         -- AI-generated draft response (never auto-sent)
  final_response     TEXT,         -- Agent-edited or approved version

  -- Workflow tracking
  status            VARCHAR(50)   NOT NULL DEFAULT 'NEW',
  -- Statuses: NEW → ANALYZING → PENDING_REVIEW → APPROVED | REJECTED
  --           NEW → ANALYZING → ANALYSIS_FAILED  (if LLM/network error occurs)

  -- LangGraph thread ID — used to resume the paused graph on approve/reject
  -- Stored here so the HTTP layer can find the right paused workflow
  thread_id         VARCHAR(255),

  -- Timestamps
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index on status for filtering tickets by their current state
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Index on created_at for ordering (most recent first)
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
