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

## 10. Express Request Validation with express-validator

`express-validator` lets you declare validation rules as middleware arrays attached directly to routes.

```js
// Declare rules
export const createTicketValidation = [
  body('customerEmail').isEmail().withMessage('Must be a valid email'),
  body('message').notEmpty().isLength({ min: 10 }),
];

// Attach to route
router.post('/', createTicketValidation, createTicketHandler);

// In the handler, check for errors
const errors = validationResult(req);
if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
```

**Why not validate in the service?** Services deal with data, not HTTP. Keeping validation in the controller/middleware layer means services can be called from anywhere (tests, other services) without needing an HTTP request object.

---

## 11. HTTP Status Codes Used in This Project

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST (new resource created) |
| 400 | Bad Request | Validation failure, invalid input |
| 404 | Not Found | Ticket ID doesn't exist in DB |
| 409 | Conflict | Trying to approve/reject a ticket in the wrong status |
| 500 | Internal Server Error | Unexpected DB or server error |

---

## 12. Why is the Global Error Middleware Registered Last?

Express processes middleware in the order they are registered. If the error handler were registered before the routes, it would never receive errors from those routes.

The 4-argument signature `(err, req, res, next)` is what tells Express it's an error handler — not a regular middleware. Never remove the `next` argument even if it's unused.

---

## 13. What is UUID and Why Use It as a Primary Key?

`gen_random_uuid()` generates a Version 4 UUID (e.g. `a1b2c3d4-...`).

Advantages over integer auto-increment:
- **Non-guessable** — An attacker can't iterate `/api/tickets/1`, `/api/tickets/2`
- **Globally unique** — Safe to merge rows from multiple data sources
- **No ordering information** — Doesn't leak how many tickets exist

The PostgreSQL error code `22P02` means "invalid text representation" — this fires when someone passes a non-UUID string to a UUID parameter. The error middleware catches it and returns a clean 400.

---

## 14. What is `withStructuredOutput()` and why use it?

Normally, an LLM returns free-form text. If you ask it to classify a ticket, it might say:
- "The category is Billing."
- "Category: Billing, Priority: Critical"
- "Based on the message, this appears to be a billing issue..."

Parsing this reliably is fragile. `withStructuredOutput(schema)` fixes this.

**How it works internally:**
LangChain translates your Zod schema into a function/tool definition and sends it to the LLM API. Instead of generating text, the model fills in a JSON object. The result is returned as a plain JS object — no parsing needed.

```js
const schema = z.object({
  category: z.enum(['Billing', 'Technical', 'Account', 'General']),
  sentiment: z.enum(['Positive', 'Neutral', 'Negative']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  summary: z.string().max(200),
});

const structuredModel = model.withStructuredOutput(schema);
const result = await structuredModel.invoke([systemMsg, userMsg]);
// result = { category: 'Billing', sentiment: 'Negative', priority: 'Critical', summary: '...' }
```

**Interview answer:** "I used `withStructuredOutput` with a Zod schema to force the LLM to return a typed JSON object instead of free-form text. This eliminates brittle string parsing and gives guaranteed structure."

---

## 15. Why does `.describe()` matter on Zod fields?

When LangChain translates your Zod schema into a tool definition, the `.describe()` text becomes the field description in the tool schema sent to the model. The LLM reads these descriptions to understand what value belongs in each field.

```js
priority: z.enum(['Low', 'Medium', 'High', 'Critical'])
  .describe(
    'Critical: payment failure, duplicate charges, complete service outage. ' +
    'High: service degraded, significant user impact...'
  )
```

Without `.describe()`, the model only sees the field name and enum values — no context. With descriptions, accuracy improves significantly.

---

## 16. What is the configurable AI provider pattern?

`src/config/ai.js` exports a single `getChatModel()` function:

```js
export function getChatModel(options = {}) {
  const provider = process.env.AI_PROVIDER || 'google';
  if (provider === 'google') return new ChatGoogleGenerativeAI({ ... });
  if (provider === 'openai') return new ChatOpenAI({ ... });
}
```

The workflow nodes call `getChatModel()` and work with the returned model object — they never import `ChatGoogleGenerativeAI` or `ChatOpenAI` directly. Switching providers is a one-line `.env` change.

This is **dependency injection** in a simple form: the dependency (the LLM provider) is resolved at the boundary of the config module, not scattered through the code.

---

## 17. Why different temperatures for classification vs response generation?

- **Temperature 0** — Deterministic. The model always picks the highest-probability token. Best for classification where you want consistent, repeatable results regardless of when you call it.
- **Temperature 0.3** — Slightly randomized. Produces more natural-sounding prose. Good for response generation where slight variation makes responses feel less robotic.

Setting temperature too high (e.g. 0.9+) on classification can cause the model to randomly return different categories for the same input.

---

## 18. Why call `safeParse()` after `withStructuredOutput`?

`withStructuredOutput` usually enforces the schema correctly, but:
- Some providers (especially Gemini on certain model versions) may occasionally return malformed tool call results.
- Edge cases like very short or empty messages can confuse the model.

`safeParse()` is a zero-cost safety net. If the LLM returns something unexpected, we throw a descriptive error immediately instead of propagating bad data into the database.

```js
const parsed = classificationSchema.safeParse(result);
if (!parsed.success) {
  throw new Error(`LLM returned invalid data: ${parsed.error.message}`);
}
return parsed.data;
```

For this project, raw `pg` queries are simpler:
- Fewer dependencies.
- SQL is explicit and readable.
- No migration setup required.
- The schema is small (one table).

An ORM makes more sense in larger projects with complex relationships and many tables.


---

## 19. What is a LangGraph StateGraph?

A `StateGraph` is the core building block of LangGraph. You define:
- **State shape** — via `Annotation.Root()`, the shared object all nodes read/write
- **Nodes** — functions that receive state and return a partial state update
- **Edges** — transitions between nodes (`addEdge`)
- **Conditional edges** — transitions that choose the next node based on state (`addConditionalEdges`)

```js
const workflow = new StateGraph(TicketState)
  .addNode('classifyTicket', classifyNode)
  .addNode('assignTeam', assignTeamNode)
  .addEdge(START, 'classifyTicket')
  .addEdge('classifyTicket', 'assignTeam')
  .addEdge('assignTeam', END);

export const graph = workflow.compile({ checkpointer });
```

**Interview answer:** "A StateGraph defines the workflow as a directed graph. Each node is a function that reads from and writes to a shared state object. Edges define execution order. The compiled graph is what you actually invoke."

---

## 20. What is `Annotation.Root()` and why are reducers needed?

`Annotation.Root()` defines the state schema. Each field needs a **reducer** — a function that tells LangGraph how to merge a new value into the existing state.

```js
ticketId: Annotation({
  reducer: (currentValue, newValue) => newValue ?? currentValue,
  default: () => '',
}),
```

The reducer `(x, y) => y ?? x` means: use the new value if provided, otherwise keep the existing one (overwrite pattern).

**Why are reducers needed?** In parallel graphs (multiple nodes running simultaneously), two nodes might update the same field. The reducer defines how to reconcile those updates. For our linear workflow, the reducer is straightforward — but it's the required API regardless.

---

## 21. What does `interrupt()` actually do?

`interrupt(payload)` is a LangGraph function that:
1. **Saves the entire graph state** to the checkpointer at the exact current point
2. **Throws a special signal** that LangGraph catches internally to halt graph execution
3. **Returns the payload** to the top-level `graph.invoke()` caller in `result.__interrupt__`

The calling code does **not** see an exception — it receives a normal result object with an `__interrupt__` array.

```js
// In the node:
const decision = interrupt({ message: 'Review required', ticketId: state.ticketId });
// Execution stops here until resumed

// What invoke() returns while paused:
// { category: '...', __interrupt__: [{ value: { message: 'Review required', ticketId: '...' } }] }
```

---

## 22. How does `Command({ resume })` work?

After a graph is interrupted, you resume it by calling `invoke()` again with the **same `thread_id`** and a `Command` object instead of an input object:

```js
const finalResult = await ticketGraph.invoke(
  new Command({ resume: 'approved' }),
  { configurable: { thread_id: savedThreadId } }
);
```

LangGraph:
1. Loads the saved checkpoint for `thread_id`
2. Re-enters the interrupted node
3. The `interrupt()` call returns `'approved'` (the resume value)
4. The node completes normally and the graph continues to END

---

## 23. Why is `thread_id` stored in the database?

The `MemorySaver` stores state keyed by `thread_id`. When an agent calls `PATCH /approve`:
1. The API fetches the ticket from the DB and reads `thread_id`
2. It calls `graph.invoke(new Command({ resume: 'approved' }), { configurable: { thread_id } })`
3. LangGraph finds the paused checkpoint and resumes it

Without the `thread_id` in the DB, the API would have no way to resume the correct paused workflow.

---

## 24. Why is one node pure JavaScript (no LLM)?

The `assignTeam` node is a simple category-to-team lookup:

```js
const TEAM_ASSIGNMENT = {
  Billing: 'Billing Support',
  Technical: 'Technical Support',
};
```

Using an LLM here would be slower, more expensive, and less reliable than a plain object lookup. This demonstrates that **LangGraph nodes are just functions** — they call an LLM, query a DB, hit an API, or run pure logic, whatever the step needs.
