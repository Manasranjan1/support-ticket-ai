# Progress Tracker

## Project: AI-Powered Support Ticket Intelligence

---

## Phase 0: Planning and Project Setup ✅ COMPLETED

**Goal:** Working Express application connected to PostgreSQL.

### Completed Tasks

- [x] Reviewed PRD and identified technical decisions
- [x] Verified LangChain.js and LangGraph.js current APIs
- [x] Created project folder structure
- [x] Initialized `package.json` with ES Modules (`"type": "module"`)
- [x] Created `.env.example` with all required environment variables
- [x] Created `.gitignore`
- [x] Implemented `src/config/database.js` (pg Pool + testConnection)
- [x] Implemented `app.js` (Express app + `/health` endpoint + 404 handler)
- [x] Implemented `server.js` (startup with DB verification)
- [x] Created `PROGRESS.md`
- [x] Created `INTERVIEW_NOTES.md`

### Key Decisions Made in Phase 0

1. **ES Modules** — `"type": "module"` in package.json. All files use `import/export`.
2. **`node --watch`** for dev instead of nodemon — built into Node.js v18+, no extra dependency.
3. **Single DB config module** — all DB access flows through `db.query()` exported from `database.js`.
4. **Fail-fast startup** — server won't start if DB connection fails.

---

## Phase 1: Ticket API and Database ✅ COMPLETED

**Goal:** Working ticket management API (no AI yet).

### Completed Tasks

- [x] Installed `express-validator`
- [x] Created `schema.sql` — run in Supabase SQL Editor to create the `support_tickets` table
- [x] Implemented `src/services/ticket.service.js` — all DB queries
- [x] Implemented `src/controllers/ticket.controller.js` — request handling + validation
- [x] Implemented `src/routes/ticket.routes.js` — route definitions
- [x] Implemented `src/middleware/error.middleware.js` — global error handler
- [x] Updated `app.js` — mounted `/api/tickets` router and error middleware
- [x] All 6 endpoints working: POST, GET list, GET by ID, PATCH approve, PATCH reject, PATCH response

### Key Decisions Made in Phase 1

1. **Thin controller, thin service** — Controllers handle HTTP (request parsing, response shaping). Services handle SQL. No business logic leaks between them.
2. **Status guard on approve/reject** — Both endpoints check `status === 'PENDING_REVIEW'` before allowing the action. Returns 409 Conflict if the ticket is in the wrong state.
3. **`updateTicketAnalysis()` already written** — This is a Phase 5 concern (connecting the graph to the DB) but the function is ready so Phase 5 is just wiring, not new SQL.
4. **Lightweight GET /api/tickets** — The list view excludes `suggested_response` and `message` to keep payloads small. Full details are on GET /api/tickets/:id.

---

## Phase 2: LLM Integration and Structured Outputs ✅ COMPLETED

**Goal:** Working AI ticket analysis with structured LLM outputs.

### Completed Tasks

- [x] Installed `@langchain/core`, `@langchain/google-genai`, `@langchain/openai`, `@langchain/langgraph`, `zod`
- [x] Created `src/config/ai.js` — provider factory (Google/OpenAI, env-driven)
- [x] Created `src/services/ticket-analysis.service.js`:
  - `classifyTicket()` — structured output via Zod schema + `withStructuredOutput()`
  - `generateSuggestedResponse()` — free-form LLM response generation
- [x] Created `test-ai.js` — manual test script with 4 real ticket scenarios
- [x] Verified Gemini API + structured output returns correct shape

### Key Decisions Made in Phase 2

1. **One LLM call for all classification** — category, sentiment, priority, and summary come from one `withStructuredOutput()` call. Three separate calls would be slower and waste API quota.
2. **Double validation** — `withStructuredOutput` enforces shape at the LLM level; `safeParse()` catches it again at runtime. Belt and suspenders.
3. **Temperature 0 for classification, 0.3 for responses** — Classification needs determinism; response generation benefits from slightly more natural language variation.
4. **`generateSuggestedResponse` uses free-form output** — Responses are prose, not structured data. Using `model.invoke()` directly is correct here.
5. **System prompt safety rules** — The response generator is explicitly told never to promise refunds, timelines, or confirm actions not yet taken.

---

## Phase 3: LangGraph Workflow ✅ COMPLETED

**Goal:** Working LangGraph ticket-processing workflow.

### Completed Tasks

- [x] Created `src/graph/ticket.state.js` — `Annotation.Root` state with 11 fields and overwrite reducers
- [x] Created `src/nodes/classify.node.js` — calls `classifyTicket()`, returns 4 fields
- [x] Created `src/nodes/assignment.node.js` — pure JS team routing, no LLM
- [x] Created `src/nodes/response.node.js` — calls `generateSuggestedResponse()`
- [x] Created `src/nodes/review.node.js` — `interrupt()` pause + resume with `approvalStatus`
- [x] Created `src/graph/ticket.graph.js` — `StateGraph` compiled with `MemorySaver` checkpointer
- [x] Created `test-graph.js` — full approve + reject workflow simulation
- [x] All 6 modules load without errors

### Graph Flow

```
START → classifyTicket → assignTeam → generateResponse → humanReview → END
```

### Key Decisions Made in Phase 3

1. **Single compiled graph instance** — compiled once at module load, shared across all requests. Each ticket gets its own `thread_id` for isolated checkpointing.
2. **`assignTeam` is pure JS** — No LLM needed for a simple category→team map. Demonstrates that graph nodes can be any function.
3. **`interrupt()` payload is informational** — It carries a copy of the data the agent needs to review. The DB is still the source of truth.
4. **`MemorySaver` tradeoff documented** — State lost on restart is a known, acceptable tradeoff for portfolio scope. The DB `thread_id` and `status` fields are the durable layer.

---

## Phase 4: Response Generation and Human Review ✅ COMPLETED

**Goal:** Complete AI-assisted support workflow with human approval, rejection, and editing.

### Completed Tasks

- [x] Extended `src/services/ticket-analysis.service.js`:
  - `analyzeTicket(ticket)`: Runs the full graph, detects the interrupt, extracts analysis payload and `threadId`.
  - `resumeWorkflow(threadId, decision)`: Resumes the paused workflow via `Command({ resume: decision })`.
- [x] Connected Human-in-the-Loop review endpoints in `src/controllers/ticket.controller.js`:
  - `approveTicketHandler`: Resumes the paused graph with `'approved'` and updates status to `APPROVED`.
  - `rejectTicketHandler`: Resumes the paused graph with `'rejected'` and updates status to `REJECTED`.
  - `updateResponseHandler`: Supports editing responses before approval (`final_response` update).
- [x] Implemented status transition validations (`PENDING_REVIEW` required for review actions).
- [x] Verified non-blocking background analysis execution pattern.

---

## Phase 5: API Integration and Database Persistence ⏳ PENDING

---

## Phase 6: Testing, Documentation and Deployment ⏳ PENDING
