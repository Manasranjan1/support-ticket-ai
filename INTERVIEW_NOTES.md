# Interview Notes: AI-Powered Support Ticket Intelligence

> Study these before your technical interview.
> Each section covers a concept demonstrated in this project with a plain-English explanation.

---

## 1. Why ES Modules instead of CommonJS?

The project uses `"type": "module"` in `package.json`.

- ES Modules use `import`/`export` syntax (modern JavaScript standard).
- CommonJS uses `require()`/`module.exports` (Node.js legacy).
- LangChain.js and LangGraph.js are ESM-first. Using ESM avoids compatibility issues.
- ES Modules are statically analyzable — imports are resolved at parse time, not runtime.

**Interview answer:** "I used ES Modules because they are the modern JavaScript standard and because LangChain.js is ESM-first. This avoids import compatibility issues."

---

## 2. Why a Connection Pool instead of a single DB Client?

`pg.Pool` manages a pool of reusable database connections.

- An Express server handles many concurrent HTTP requests.
- Opening a new database connection for every request is slow and resource-intensive.
- A pool pre-opens a set of connections and reuses them across requests.
- When a request needs the DB, it borrows a connection from the pool and returns it when done.

**Interview answer:** "I used a connection pool because an Express server handles concurrent requests. A pool reuses existing connections instead of opening a new one for each request, which is faster and more resource-efficient."

---

## 3. What is LangChain.js?

LangChain.js is a JavaScript framework for building LLM-powered applications.

Key components used in this project:
- **Chat Models** — Wrappers around LLM providers (Gemini, OpenAI). Same interface regardless of provider.
- **Prompts** — Structured message templates passed to the LLM.
- **`withStructuredOutput(schema)`** — Forces the LLM to return a JSON object matching a Zod schema instead of free-form text.

---

## 4. What is LangGraph.js?

LangGraph.js is a framework for building stateful, graph-based AI workflows.

Core concepts:
- **StateGraph** — The graph itself. You define nodes (processing steps) and edges (transitions).
- **State (Annotation.Root)** — A shared object that all nodes can read and write to. It accumulates data as it flows through the graph.
- **Nodes** — Functions that receive the current state and return a partial state update.
- **Edges** — Define which node runs after the current one.
- **Conditional Edges** — Run different nodes depending on the current state value.
- **Checkpointer (MemorySaver)** — Saves the graph state at each step. Required for `interrupt()`.
- **`interrupt()`** — Pauses graph execution inside a node and waits for a human to resume it.
- **`Command({ resume: value })`** — Used to resume a paused graph, passing the human's decision back into the interrupted node.

---

## 5. What is `withStructuredOutput()`?

A LangChain method that forces LLMs to return a structured JSON object.

```js
const schema = z.object({
  category: z.enum(['Billing', 'Technical', 'Account', 'General']),
  sentiment: z.enum(['Positive', 'Neutral', 'Negative']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  summary: z.string(),
});

const structuredLLM = model.withStructuredOutput(schema);
const result = await structuredLLM.invoke(prompt);
// result is guaranteed to have: category, sentiment, priority, summary
```

**Why not parse LLM text manually?** Manual parsing is brittle. The LLM might format the output differently each time. `withStructuredOutput` uses tool/function-calling under the hood to enforce structure.

---

## 6. What is Human-in-the-Loop (HITL)?

A pattern where an AI workflow pauses and waits for a human decision before continuing.

In this project:
1. The graph generates a suggested response.
2. The `humanReview` node calls `interrupt()` — the graph pauses.
3. The ticket status is set to `PENDING_REVIEW` in the DB.
4. A support agent reviews the ticket via `GET /api/tickets/:id`.
5. The agent calls `PATCH /api/tickets/:id/approve` or `.../reject`.
6. The API resumes the graph using `graph.invoke(new Command({ resume: decision }), { configurable: { thread_id } })`.
7. The graph continues from where it paused and sets the final status.

**Why is this important?** The system assists humans — it does not autonomously send messages to customers.

---

## 7. Why configurable AI providers?

The `src/config/ai.js` module reads `AI_PROVIDER` from env vars and returns a compatible chat model.

```js
// src/config/ai.js
if (AI_PROVIDER === 'google') return new ChatGoogleGenerativeAI({ ... });
if (AI_PROVIDER === 'openai') return new ChatOpenAI({ ... });
```

The LangGraph workflow only receives a `model` object — it does not know or care whether it is Gemini or OpenAI. Switching providers means changing `.env`, not rewriting workflow logic.

This demonstrates **dependency injection** at a simple level — the dependency (the LLM) is passed in, not hardcoded.

---

## 8. Ticket Status Lifecycle

```
NEW → ANALYZING → PENDING_REVIEW → APPROVED
                                 → REJECTED
```

- `NEW` — Ticket just submitted, before AI processing starts.
- `ANALYZING` — LangGraph workflow is running.
- `PENDING_REVIEW` — Graph paused at `interrupt()`, waiting for human decision.
- `APPROVED` — Human approved the suggested response.
- `REJECTED` — Human rejected the suggested response.

---

## 9. Why not use an ORM (Prisma, TypeORM)?

For this project, raw `pg` queries are simpler:
- Fewer dependencies.
- SQL is explicit and readable.
- No migration setup required.
- The schema is small (one table).

An ORM makes more sense in larger projects with complex relationships and many tables.
