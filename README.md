# AI-Powered Support Ticket Intelligence 🎫🤖

A lightweight, robust AI backend that automates customer support ticket categorization, sentiment analysis, urgency prioritization, team routing, and response drafting using **Node.js**, **Express.js**, **PostgreSQL (Supabase)**, **LangChain.js**, and **LangGraph.js**.

Designed specifically as an interview-ready portfolio demonstration of **Stateful AI Workflows**, **Structured LLM Outputs**, and **Human-in-the-Loop (HITL)** approval orchestration.

---

## 🌟 Key Highlights & Engineering Concepts

1. **Stateful LangGraph Workflow Orchestration**: Rather than making chaotic chained LLM calls, processing logic is modeled as a directed acyclic graph (`StateGraph`) using `@langchain/langgraph`.
2. **Deterministic Classification via Structured Outputs**: Enforces strict JSON extraction matching a Zod schema via `withStructuredOutput()`. Completely eliminates brittle string regex parsing.
3. **Decoupled Provider Architecture**: Configurable AI provider layer (`src/config/ai.js`) enabling seamless switching between **Google Gemini** (default, free-tier friendly) and **OpenAI GPT** using a single environment variable (`AI_PROVIDER`).
4. **Human-in-the-Loop (HITL)**: Utilizes LangGraph's native `interrupt()` and `Command({ resume })` functionality alongside database state transitions (`PENDING_REVIEW` → `APPROVED` / `REJECTED`) so no AI-generated response is ever dispatched without human approval.
5. **Non-Blocking Asynchronous Ticket Ingestion**: Ticket submissions return an instant `201 Created` response with the ticket ID, triggering the multi-step AI workflow in the background.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v18+) | ES Modules (`"type": "module"`) |
| **Framework** | Express.js | RESTful routing and middleware pipeline |
| **Workflow Engine** | `@langchain/langgraph` | Stateful graph execution, checkpoints, and interrupts |
| **AI Framework** | `@langchain/core` / `@langchain/google-genai` / `@langchain/openai` | Unified LLM abstraction and prompt management |
| **Validation** | `zod` & `express-validator` | Output schema enforcement and HTTP request validation |
| **Database** | PostgreSQL via Supabase | Durable persistence of tickets, AI metadata, and status |
| **Testing** | Jest & Supertest | Automated route and unit testing |

---

## 🏗️ Architecture & Workflow

### LangGraph Workflow Diagram

```mermaid
flowchart TD
    START([Start / Ticket Received]) --> Classify[classifyTicket Node\nLLM Structured Extraction\nCategory, Sentiment, Priority, Summary]
    Classify --> Assign[assignTeam Node\nPure Business Rules\nMaps Category to Support Team]
    Assign --> Generate[generateResponse Node\nLLM Response Drafter\nProfessional, empathetic draft]
    Generate --> Review[humanReview Node\nLangGraph interrupt\nState checkpointer frozen]
    Review -->|Resume: approved| Approved[Status: APPROVED\nCopies response to final_response]
    Review -->|Resume: rejected| Rejected[Status: REJECTED]
    Approved --> END([End])
    Rejected --> END
```

### End-to-End System Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant API as Express API (/api/tickets)
    participant DB as PostgreSQL (Supabase)
    participant Graph as LangGraph Engine
    actor Agent as Support Agent

    Customer->>API: POST /api/tickets (message payload)
    API->>DB: INSERT ticket (status: NEW)
    API-->>Customer: 201 Created (ticket ID returned immediately)

    Note over API,Graph: Asynchronous Background Execution
    API->>DB: UPDATE status: ANALYZING
    API->>Graph: invoke({ ticketId, message, ... }, { thread_id })
    Graph->>Graph: 1. classifyTicket (Gemini / OpenAI via Zod)
    Graph->>Graph: 2. assignTeam (Deterministic mapping)
    Graph->>Graph: 3. generateResponse (Drafts reply)
    Graph->>Graph: 4. humanReview calls interrupt() [PAUSED]
    Graph-->>API: Returns execution paused + AI metadata
    API->>DB: UPDATE metadata, thread_id, status: PENDING_REVIEW

    Agent->>API: GET /api/tickets/:id (inspect analysis & suggestion)
    opt Agent Edits Response
        Agent->>API: PATCH /api/tickets/:id/response { finalResponse }
        API->>DB: UPDATE final_response
    end
    Agent->>API: PATCH /api/tickets/:id/approve
    API->>Graph: invoke(Command({ resume: 'approved' }), { thread_id })
    Graph-->>API: Graph completes to END
    API->>DB: UPDATE status: APPROVED
    API-->>Agent: 200 OK (ticket approved)
```

---

## 📊 Database Schema

```sql
CREATE TABLE support_tickets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name      VARCHAR(255)  NOT NULL,
  customer_email     VARCHAR(255)  NOT NULL,
  subject            VARCHAR(500)  NOT NULL,
  message            TEXT          NOT NULL,
  category           VARCHAR(50),   -- Billing | Technical | Account | General
  sentiment          VARCHAR(50),   -- Positive | Neutral | Negative
  priority           VARCHAR(50),   -- Low | Medium | High | Critical
  summary            TEXT,
  assigned_team      VARCHAR(100),  -- Billing Support | Technical Support | etc.
  suggested_response TEXT,
  final_response     TEXT,
  status             VARCHAR(50)   NOT NULL DEFAULT 'NEW',
  thread_id          VARCHAR(255),  -- LangGraph thread ID
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

### Ticket Status Lifecycle

```
NEW  ──▶  ANALYZING  ──▶  PENDING_REVIEW  ──▶  APPROVED
                   └──▶  ANALYSIS_FAILED  ──▶  REJECTED
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18.0.0 or higher
- A free [Supabase](https://supabase.com/) PostgreSQL database
- A free [Google AI Studio Gemini API Key](https://aistudio.google.com/) (or OpenAI API Key)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd support-ticket-ai

# Install dependencies
npm install
```

### 3. Database Setup
1. Log into your Supabase Dashboard.
2. Open the **SQL Editor**.
3. Copy the contents of [`schema.sql`](file:///c:/Users/manas/OneDrive/Documents/Placement/Backend/support-ticket-ai/schema.sql) and click **Run**.

### 4. Environment Variables
Create a `.env` file in the project root:
```env
# Server
PORT=3000
NODE_ENV=development

# Database (Supabase Session Pooler on port 5432)
DATABASE_URL=postgresql://postgres.[your-project-ref]:[your-password]@aws-0-[region].pooler.supabase.com:5432/postgres

# AI Provider ("google" or "openai")
AI_PROVIDER=google

# Google Gemini Configuration
GOOGLE_API_KEY=your_gemini_api_key_here
GOOGLE_CHAT_MODEL=gemini-2.0-flash

# OpenAI Configuration (only required if AI_PROVIDER=openai)
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
```

### 5. Running the Application
```bash
# Start in watch mode for development
npm run dev

# Or start standard production server
npm start
```

---

## 📡 API Reference

### 1. Health Check
`GET /health`
```json
{
  "status": "ok",
  "message": "Support Ticket AI is running",
  "timestamp": "2026-11-20T00:50:00.000Z",
  "environment": "development"
}
```

---

### 2. Submit Support Ticket
`POST /api/tickets`
- **Body**:
```json
{
  "customerName": "Rahul Sharma",
  "customerEmail": "rahul.sharma@example.com",
  "subject": "Double charged on my renewal",
  "message": "My credit card was charged twice for the annual subscription. I need a refund for the duplicate transaction immediately."
}
```
- **Response** (`201 Created`):
```json
{
  "status": "success",
  "message": "Ticket created. AI analysis has started.",
  "data": {
    "ticket": {
      "id": "e4a2c94d-7681-4b13-a417-36e690a618cf",
      "customer_name": "Rahul Sharma",
      "customer_email": "rahul.sharma@example.com",
      "subject": "Double charged on my renewal",
      "message": "My credit card was charged twice...",
      "status": "NEW",
      "created_at": "2026-11-20T00:50:10.000Z"
    }
  }
}
```

---

### 3. Fetch Single Ticket (With AI Analysis)
`GET /api/tickets/:id`
- **Response** (`200 OK` once AI analysis reaches `PENDING_REVIEW`):
```json
{
  "status": "success",
  "data": {
    "ticket": {
      "id": "e4a2c94d-7681-4b13-a417-36e690a618cf",
      "customer_name": "Rahul Sharma",
      "category": "Billing",
      "sentiment": "Negative",
      "priority": "Critical",
      "summary": "Customer was charged twice for annual subscription renewal and requests an immediate refund.",
      "assigned_team": "Billing Support",
      "suggested_response": "Dear Rahul Sharma,\n\nThank you for reaching out to us. I apologize for the duplicate charge on your annual renewal...",
      "final_response": null,
      "status": "PENDING_REVIEW",
      "thread_id": "e4a2c94d-7681-4b13-a417-36e690a618cf"
    }
  }
}
```

---

### 4. Edit Suggested Response (Optional Agent Action)
`PATCH /api/tickets/:id/response`
- **Body**:
```json
{
  "finalResponse": "Dear Rahul, We have verified the duplicate billing of $99 and initiated a reversal to your payment method. Please allow 3-5 business days."
}
```

---

### 5. Approve Ticket Response
`PATCH /api/tickets/:id/approve`
- Resumes the paused LangGraph workflow and marks status `APPROVED`.

---

### 6. Reject Ticket Response
`PATCH /api/tickets/:id/reject`
- Resumes the paused LangGraph workflow and marks status `REJECTED`.

---

## 🧪 Testing Suite

### Run Automated Unit & Route Tests
Runs automated Jest tests covering routing, error handling, status guards, and team assignment logic:
```bash
npm test
```

### Run Standalone AI Provider Test
Tests LLM connectivity, structured Zod extraction, and response drafting across 4 diverse scenarios:
```bash
node test-ai.js
```

### Run Standalone LangGraph Test
Tests state graph compilation, execution, interrupt triggering, and resume lifecycle:
```bash
node test-graph.js
```

### Run Complete End-to-End Integration Test
Boots an ephemeral server, submits a ticket, polls for analysis completion, edits response, and approves via HTTP:
```bash
node test-api.js
```

---

## 📁 Project Structure

```
support-ticket-ai/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection pool & health check
│   │   └── ai.js                # Provider factory (Google Gemini / OpenAI)
│   ├── controllers/
│   │   └── ticket.controller.js # HTTP request validation & response handling
│   ├── graph/
│   │   ├── ticket.state.js      # Annotation.Root shared graph state
│   │   └── ticket.graph.js      # StateGraph assembly, compilation & MemorySaver
│   ├── middleware/
│   │   └── error.middleware.js  # Global Express error handler & PG error codes
│   ├── nodes/
│   │   ├── classify.node.js     # Node: Structured classification via LLM
│   │   ├── assignment.node.js   # Node: Team assignment rule logic
│   │   ├── response.node.js     # Node: Customer response draft generation
│   │   └── review.node.js       # Node: interrupt() for human approval
│   ├── routes/
│   │   └── ticket.routes.js     # Express router definition
│   └── services/
│       ├── ticket.service.js           # Database queries (CRUD & status updates)
│       └── ticket-analysis.service.js  # LangGraph orchestration & resume calls
├── tests/
│   ├── assignment.test.js       # Unit tests for routing rules
│   └── routes.test.js           # Supertest API validation & route tests
├── app.js                       # Express application wiring
├── server.js                    # Application entrypoint & DB verification
├── schema.sql                   # PostgreSQL schema definition
├── test-ai.js                   # Manual LLM test script
├── test-graph.js                # Manual LangGraph test script
├── test-api.js                  # End-to-end integration test
├── PROGRESS.md                  # Development phase tracker
├── INTERVIEW_NOTES.md           # Technical interview concepts & explanations
├── .env.example                 # Environment variable template
└── package.json
```

---

## 🚢 Deployment Guidelines

### Deploy to Render or Railway
1. **Repository**: Push this project to GitHub.
2. **Environment Variables**: In your deployment dashboard, configure:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `DATABASE_URL=<your-supabase-connection-string>`
   - `AI_PROVIDER=google`
   - `GOOGLE_API_KEY=<your-google-api-key>`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Health Check Path**: `/health`

---

## 🎓 Technical Interview Talking Points

For in-depth explanations, code snippets, and preparation questions, refer to [`INTERVIEW_NOTES.md`](file:///c:/Users/manas/OneDrive/Documents/Placement/Backend/support-ticket-ai/INTERVIEW_NOTES.md).

Key topics covered:
- Why LangGraph StateGraphs are superior to linear LLM chains
- How `withStructuredOutput` and Zod function schemas prevent hallucinated formats
- Why LangGraph `interrupt()` and `Command({ resume })` provide true Human-in-the-Loop workflows
- Reducer semantics in `Annotation.Root`
- Asynchronous non-blocking HTTP patterns for multi-second LLM operations
- State isolation using database UUIDs as thread IDs
