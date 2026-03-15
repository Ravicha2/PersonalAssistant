# Student Workflow Upgrade: Research Synthesis & Recommendations

**Document type:** Research synthesis and actionable upgrade recommendations  
**Audience:** Product strategy, AI systems architecture  
**System:** Chrome extension personal assistant (Claude/OpenAI/Groq, Fastify backend)  
**Focus:** Student workflows — assignment completion, note-taking, research, exam prep, course material understanding

---

## 1. Prompt Engineering: Intent Clarification & Student Context

### 1.1 Research Summary

- **Ambiguity handling:** Well-designed systems use a **Detect–Clarify–Resolve–Learn** pattern instead of guessing. When intent is unclear (e.g., missing context, vague goals), the model should ask clarifying questions, especially in high-stakes or educational use.
- **Meta-prompting:** The LLM can first interpret intent, reframe the request, or generate clearer internal instructions before answering. This improves alignment, reduces hallucinations, and supports structured reasoning (e.g., ReAct, chain-of-thought).
- **Student intent:** In tutoring/ITS contexts, intent detection (e.g., “asking for help” vs “demonstrating understanding” vs “continuing lesson”) can reach ~89% accuracy; fine-grained pedagogical intent (Socratic questioning, hints, guided discovery) improves tutoring quality. LearnLM-style principles (active learning, cognitive load, curiosity) are relevant for response style.
- **Context inference:** Open tab content (lecture notes, assignment, textbook, forum) can be used to infer *type* of task (homework vs exam prep vs “just understand”) and adjust response format (summary vs step-by-step vs outline).

### 1.2 Recommended Patterns & Example Prompts

#### Pattern A: Two-phase “Interpret then Respond” (meta-prompt)

**Goal:** Have the model first output a structured interpretation (intent, constraints, response style) and only then generate the answer. Reduces mismatches when the student’s request is ambiguous.

**Example system prompt:**

```text
You are a study assistant for students. Before answering any request, you must first interpret it.

**Phase 1 – Internal interpretation (output in a single JSON block first):**
- intent: one of [understand_concept | homework_help | exam_prep | summarize | outline | step_by_step | other]
- inferred_goal: one sentence describing what the student likely wants (e.g., "Practice applying formula X to similar problems")
- response_style: [concise | detailed | socratic_hints | full_solution]
- needs_clarification: true/false – set true if the request is too vague to choose one intent (e.g., "help me with this" with no context)
- if needs_clarification: clarification_question: one short question to ask the student before answering

**Phase 2 – Response:**
- If needs_clarification is true, output only the clarification_question and stop.
- Otherwise, use the inferred intent and response_style to produce your answer. Prefer using the provided [PAGE_CONTEXT] (e.g., assignment text, lecture notes) to tailor the response.

Current page context (if any) is provided below in [PAGE_CONTEXT]. Use it to infer intent when the student says things like "this", "here", "the assignment".
```

**Example user message:** “Can you explain this?” with `[PAGE_CONTEXT]` = assignment instructions.  
**Expected behavior:** Model outputs Phase 1 JSON (e.g., intent: homework_help, response_style: step_by_step), then Phase 2 answer tailored to the assignment.

---

#### Pattern B: Instruction disambiguation with student-specific categories

**Goal:** Explicitly classify *what kind of help* the student needs so the model doesn’t default to “give full answer.” Aligns with research on pedagogical intent (hints vs full solution, Socratic vs direct).

**Example system prompt:**

```text
You are a study assistant. When a student asks for help, first classify their need:

- **Task type:** homework | exam_prep | concept_understanding | summarize_material | find_mistake | other
- **Desired depth:** quick_answer | explanation_only | step_by_step | hints_only | full_worked_solution
- **Clarification:** If the message is ambiguous (e.g., "help", "I don't get it", "explain"), ask exactly one clarifying question before answering. Choose from:
  - "Do you want a quick summary, a step-by-step explanation, or just hints to try yourself?"
  - "Is this for homework you need to submit, or for understanding before an exam?"
  - "Which part is unclear: the concept, the steps, or how to apply it?"

Rules:
1. If the user message is under 10 words and doesn't reference specific content (e.g., "help me", "explain"), output ONLY a clarifying question and wait.
2. If page context shows assignment instructions or a problem set, you may infer task_type and depth from that and skip clarification.
3. Otherwise respond according to the classified task_type and depth.
```

**Example:** User says “I’m stuck on problem 3.” With assignment in context, model infers homework + step_by_step. Without context, model asks: “Do you want a full solution or hints so you can try it yourself?”

---

#### Pattern C: Context-aware response style from page type

**Goal:** Use a lightweight classification of the *current page* (lecture notes, assignment, textbook, forum, slides) to set default response style and length without an extra user turn.

**Example system prompt:**

```text
You are a study assistant. You will receive:
1. [PAGE_TYPE] – one of: lecture_notes | assignment | textbook | forum | slides | problem_set | unknown
2. [PAGE_CONTEXT] – extracted text from the student's current tab
3. [USER_MESSAGE]

**Response adaptation:**
- lecture_notes / slides: Prefer concise summaries and connections to key terms; ask if they want practice questions.
- assignment / problem_set: Prefer step-by-step or hints (do not give full answers unless the student explicitly asks for a solution); reference rubric if present in context.
- textbook: Prefer definitions and concept explanation; can go longer if they ask "explain fully."
- forum: Prefer short, direct answers; can compare or contrast with other posts in context.

If [PAGE_TYPE] is unknown or [PAGE_CONTEXT] is empty, default to asking one clarifying question when the request is vague.
```

**Implementation note:** `PAGE_TYPE` can be produced by a small classifier (rule-based or LLM) in the backend from URL + DOM structure or from a first-pass LLM call; see Section 2.

---

### 1.3 Implementation Notes (Fastify/Extension)

- **Where to run:** Intent/clarification can be a single “pre-step” in the existing orchestrator: one LLM call that returns structured JSON (intent, clarification_question or proceed); if `needs_clarification` is true, stream the clarification question to the user and do not run the main answer flow until the user replies.
- **Token cost:** Patterns A and B add one small request (or one structured output block) per user message. Pattern C can be combined with content-type detection (Section 2) so PAGE_TYPE is set once per page load or per “collect context” action.
- **Extension:** Send `pageContext` and optional `pageType` (if backend or extension infers it) with each message so the backend can inject them into the system prompt.

---

## 2. Semantic Content Parsing & Page Understanding

### 2.1 Research Summary

- **Hierarchical structure:** Flat chunking loses document hierarchy (headings, sections, lists, code blocks). Preserving structure (e.g., chunks that respect `h1`/`h2`/sections) improves RAG and LLM reasoning. Recursive split strategies (split on `\n\n`, then on `\n`, then on sentence) are common; for HTML, splitting on heading/section boundaries is preferred.
- **Content type detection:** Educational material can be classified (e.g., “educativeness,” document type: lecture notes, assignment, textbook, forum). This can be rule-based (URL patterns, DOM), or model-based (e.g., short classification prompt or fine-tuned classifier). Type then drives parsing depth, chunk size, and which parts to keep (e.g., assignment rubrics, problem statements).
- **Semantic units:** Chunking by “meaningful units” (concepts, arguments, examples, definitions) rather than fixed token counts improves relevance. This can be approximated by section boundaries + sentence boundaries, or by an LLM pass that labels segments (concept / example / definition).

### 2.2 Recommended Parsing Approaches

#### Approach 1: Structure-preserving HTML → Markdown with section boundaries (Node/Fastify)

**Goal:** Convert tab HTML to markdown while keeping headings and list/code structure, then chunk by section so the LLM sees coherent “sections” instead of arbitrary cuts.

**Implementation:**

- **HTML → Markdown:** Use **Turndown** or **node-html-markdown** in the backend (or in the extension if you prefer to send markdown). Both preserve `h1`–`h6`, lists, tables, code blocks. Turndown is widely used; node-html-markdown is faster for very large documents.
- **Section splitting:** After conversion, split the markdown string on heading lines (e.g., `^#{1,6}\s+.+`). Each chunk = one heading + its body until the next heading. Optionally merge very short sections (e.g., < 100 chars) with the next section to avoid tiny chunks.
- **Size cap:** If a section is larger than the desired context window (e.g., 800 tokens), recursively split that section on `\n\n` or `\n` while keeping a short “parent heading” prefix in each sub-chunk for hierarchy.

**Trade-offs:** Simple to implement; works well for lecture notes, docs, and textbooks. May split tables or code blocks mid-way if they are inside a long section—mitigate by detecting fenced code blocks and keeping them intact.

**Node snippet (conceptual):**

```js
// Pseudo-code: section-aware split
const headingRegex = /^(#{1,6})\s+.+$/gm;
const sections = markdown.split(headingRegex).filter(Boolean);
// Pair heading with content; then chunk long sections by \n\n with max tokens.
```

---

#### Approach 2: Content-type–aware parsing and prioritization

**Goal:** Detect page type (lecture notes, assignment, textbook, forum, slides, problem set) and adjust what is extracted, how much, and how it’s labeled for the LLM.

**Implementation:**

- **Detection:**
  - **Rule-based:** URL patterns (e.g., `/courses/`, `/assignments/`, `canvas.instructure.com`, `drive.google.com` for Docs), plus DOM cues (e.g., `role="main"`, `.assignment-description`, `.lecture-content`). Emit a single label: `pageType`.
  - **LLM-based:** Send a short excerpt (e.g., first 500 tokens of text) to a single classification call: “Classify as one of: lecture_notes, assignment, textbook, forum, slides, problem_set, reference, other.” Use a small/fast model to limit latency.
- **Parsing by type:**
  - **Assignment:** Prefer to extract instructions, rubric, and problem statements; strip long readings or boilerplate. Use Approach 1 for structure; optionally add a “priority” tag (e.g., “assignment_instructions”) so the orchestrator can put this first in context.
  - **Lecture notes / slides:** Prefer headings and bullet blocks; trim duplicate nav/footer. Chunk by slide or by `h2`/`h3`.
  - **Textbook:** Use Approach 1; optionally keep “Definition”/“Example” blocks as atomic chunks.
  - **Forum:** Extract thread title + first post + the post in focus; limit depth to avoid token overflow.

**Trade-offs:** Rule-based is fast and free; LLM classification adds one cheap call. Improves relevance and allows response-style rules (Section 1, Pattern C).

---

#### Approach 3: Semantic segment labels (optional enhancement)

**Goal:** Tag chunks by semantic role (e.g., concept, definition, example, procedure, exercise) so the LLM can prioritize “definitions” when the student says “what does X mean?” and “examples” when they say “give me an example.”

**Implementation:**

- After Approach 1 (and optionally 2), run a lightweight LLM pass over each section (or every N sections to save cost): “Label this segment as one of: definition, concept_explanation, example, procedure, exercise, other.” Store the label with the chunk.
- At query time, include labeled chunks in context; optionally boost “definition” and “example” chunks when the user message contains “define,” “meaning,” “example,” etc. This can be implemented as a simple keyword boost or a tiny classifier.

**Trade-offs:** Adds latency and cost; best as a later optimization. Use for high-value pages (e.g., single assignment or single textbook chapter) rather than every tab.

---

### 2.3 Implementation Considerations (Node/Fastify)

- **Where:** Parsing and chunking can live in the backend (e.g., in the same pipeline that receives tab HTML or markdown from the extension). Extension sends raw HTML or markdown; backend runs Turndown/node-html-markdown, then section split and optional type detection/labeling.
- **Caching:** Cache parsed/chunked result per `url + hash(content)` for a short TTL so repeated questions on the same page don’t re-parse.
- **Token budget:** Reserve a fixed token budget for “page context” (e.g., 2K–4K tokens); fill with highest-priority chunks (e.g., assignment instructions, then sections that match keywords from the user message).

---

## 3. Student-Relevant Connectors: Prioritized List

Research sources: student surveys (e.g., Direct Textbook 2025, Campus Technology 2024, Kahoot 2024), LMS and study tool ecosystems, and API availability. Criteria: student demand, fit with studying/assignments/notes/research, and feasibility on a Node/Fastify backend.

| Rank | Integration | Category | Student demand & use case | Data / capabilities | Integration complexity |
|------|-------------|----------|---------------------------|---------------------|-------------------------|
| **1** | **Canvas LMS** | LMS | Very high. Central for assignments, due dates, grades, and course content. Students already use Chrome extensions (e.g., Tasks for Canvas) for assignment tracking. | REST API: courses, assignments, due dates, rubrics, submissions, calendar. OAuth2. | Medium. Well-documented REST API; need institution OAuth or user-installed app. Rate limits and SIS/course visibility vary by institution. |
| **2** | **Google Calendar** (existing) | Calendar | Already in your stack; critical for deadlines and study blocks. | Events, create/update. | Done. Extend with “assignment due dates” from Canvas/Blackboard if those connectors are added. |
| **3** | **Notion** (existing) | Note-taking | High. Surveys show Notion among top study apps; used for notes, wikis, and assignment tracking. | API: read/write pages, blocks, search. OAuth. | Medium. API is clear; rate limits and block structure need handling. Sync “assignment brief” or “study guide” into Notion from assistant. |
| **4** | **Zotero** | Citation / research | High for students writing papers. 53%+ use AI for research/summaries; citation management is a pain point. | Web API v3: libraries, items, citations, full-text, OAuth. | Medium. Good docs and JS/TS clients. Expose “saved sources” and “citation for this” in chat. |
| **5** | **Quizlet** | Study / flashcards | Very high. Over half of surveyed students use Quizlet for flashcards and review. | GraphQL API, OAuth. Sets, terms, study sessions. | Medium–high. Ecosystem exists; rate limits and ToS for AI use must be checked. Use case: “flashcards from this page” or “quiz me on this.” |
| **6** | **Google Docs** (existing) | Docs / writing | Already in your stack; used for drafts and group work. | Read/write document content. | Done. Optional: “summarize this doc” or “outline for my essay” using page context. |
| **7** | **Blackboard / Moodle** | LMS | High where adopted. Second major LMS family after Canvas. | Blackboard REST APIs; Moodle web services. LTI and institutional setup. | Medium–high. More fragmented than Canvas; institution-specific. Start with “assignment list and due dates” read-only. |
| **8** | **Anki** | Study / spaced repetition | Strong among serious studiers; often used with AnkiConnect (local). | AnkiConnect (local HTTP): decks, cards, study. No cloud OAuth. | Medium. Extension or backend talks to user’s local AnkiConnect. Good for “add a flashcard from this” or “generate cards for this concept.” |

### 3.1 Rationale and data exposure (short)

- **Canvas:** Assignments and due dates are the top student pain point; API supports courses, assignments, rubrics, and calendar. Enables “what’s due this week?” and “help me with this assignment” with full brief in context.
- **Notion:** Directly supports note-taking and organization workflows; API allows creating/updating pages and blocks so the assistant can push summaries or outlines.
- **Zotero:** Fills the “research and citations” gap; API gives access to library and metadata so the assistant can suggest citations or summarize saved papers.
- **Quizlet:** Aligns with “study and memorize” workflow; API allows creating sets and reading terms—enables “make me a set from these notes” (with care for copyright/ToS).
- **Anki:** Complements Quizlet for users who prefer spaced repetition; AnkiConnect is simple but requires local install; “generate cards” is a clear use case.

### 3.2 Suggested implementation order

1. **Canvas** (or Blackboard if your target schools use it): Read-only assignments + due dates first; then optional “open assignment in new tab” or “put assignment brief in context.”
2. **Zotero:** OAuth + read library; “cite this” or “summarize this paper from my library.”
3. **Notion:** Deeper use of existing connector: “add this summary to my Notion” or “create a study guide page.”
4. **Quizlet / Anki:** After core LMS + notes + citations; focus on “generate flashcards from current page” with clear attribution and ToS.

---

## 4. Performance & Speed Optimization Roadmap

Research sources: OpenAI latency guide, TTFT/streaming optimizations, prompt caching, and OpenAI/Anthropic best practices. Goal: reduce end-to-end latency from “user sends message” to “first token and smooth stream” in the chat pipeline.

### 4.1 Tactics Ranked by Impact vs Feasibility

| Rank | Tactic | Impact (latency reduction) | Feasibility | Notes |
|-----|--------|----------------------------|-------------|--------|
| **1** | **Streaming + show progress** | High (perceived) | High | Already streaming; ensure first token is shown immediately and no “wait for full sentence” buffering. Add loading state: “Reading your tabs…”, “Asking Claude…” so users see progress. |
| **2** | **Prompt caching (static prefix)** | High (up to ~80% latency, ~90% input cost on cache hit) | High | Put system prompt, role, and fixed instructions in the first 256+ tokens; keep variable content (conversation, page context) later. Use OpenAI’s prompt caching when available; similar ideas apply to Claude (prefix caching where supported). |
| **3** | **Fewer / combined LLM requests** | High | Medium | Combine “intent + clarification” into one call (Section 1); combine “content type + routing” into one call. Reduces round-trips. |
| **4** | **Tab-to-backend pipeline optimization** | Medium–high | Medium | Run “collect context” in parallel with “send message” where possible; pre-extract and cache parsed content per tab when the user opens the assistant so the first message doesn’t wait on full extraction. |
| **5** | **Smaller/faster model for classification** | Medium | Medium | Use a small/fast model (or one cheap call) for intent, page type, or “retrieval needed?”; reserve the main model for the final answer. Cuts time where classification is on the critical path. |
| **6** | **Generate fewer output tokens** | Medium | High | Ask the model to be concise where appropriate (e.g., “one short clarification question”); use `max_tokens`; shorter structured fields (e.g., JSON keys) reduce decode time. |
| **7** | **Cache parsed page context** | Medium | High | Cache by `url + content hash` with short TTL so repeated questions on the same page don’t re-parse or re-chunk. |
| **8** | **Parallelize independent steps** | Medium | Medium | Run intent/classification and context retrieval in parallel when they don’t depend on each other; then single main LLM call. |

### 4.2 Concrete Recommendations for Your Stack

- **Extension → Backend:** Send minimal payload first (e.g., message + tab URLs); let backend request tab content if needed, or send content in parallel so the backend can start prompt build while parsing.
- **Backend:**  
  - One combined “intent + clarification + page_type” call with a small output (JSON); if no clarification, proceed to main stream.  
  - Put all static system prompt text at the very start of the prompt; variable blocks (conversation, [PAGE_CONTEXT]) after.  
  - Cache parsed/chunked context per tab (in-memory or short-lived Redis) keyed by URL + hash.
- **Streaming:** Emit first token as soon as received; avoid buffering for “complete sentence.” Consider “thinking” or “progress” placeholders for tool use (e.g., “Searching your notes…”).
- **Model choice:** Use a single fast model for classification/pre-step; use your best model only for the final answer stream. Test with smaller models (e.g., Claude Haiku, GPT-4o-mini) for the pre-step to measure latency vs quality.

### 4.3 Metrics to Track

- **Time to first token (TTFT):** From “send” to first token in UI. Target: &lt; 1–2 s for most requests.
- **Time to “useful” response:** e.g., first complete sentence or first 50 tokens.
- **End-to-end:** From “user clicks send” to “stream ends,” including context collection when enabled.

---

## 5. Summary Table

| Area | Top 2–3 actions |
|------|------------------|
| **Prompt engineering** | (1) Two-phase interpret-then-respond with optional clarification; (2) Student-specific disambiguation (homework vs exam vs concept); (3) Page-type–aware response style. |
| **Content parsing** | (1) Structure-preserving HTML→Markdown + section-based chunking; (2) Content-type–aware parsing and prioritization; (3) Optional semantic labels for definitions/examples. |
| **Connectors** | (1) Canvas LMS (assignments, due dates); (2) Zotero (citations/research); (3) Deeper Notion (notes/summaries); (4) Quizlet/Anki (flashcards). |
| **Performance** | (1) Streaming + progress UI; (2) Prompt caching (static prefix); (3) Fewer/combined requests; (4) Cache parsed context; (5) Parallelize + smaller model for classification. |

---

## 6. Implementation status (as of March 2025)

- **Docling (built-in):** The backend can run Docling as part of the system. Set `DOCLING_ENABLED=1` in backend `.env` and install Docling (`pip install docling`). The backend then exposes a **parse_document** tool: the model can pass a document URL (or server file path) and receive markdown for summaries and answers. A Python helper script lives at `backend/scripts/docling_convert.py`; the Node server spawns it. Optionally, users can still add the external “Docling” MCP preset in Connectors for the same capability via MCP.
- **Voice-friendly responses:** Backend accepts `prefer_voice_response` (WebSocket and REST). When true, the system prompt instructs the model to keep answers concise and suitable for reading aloud (short paragraphs, avoid long code/lists).
- **Voice input/output:** Extension includes voice input (mic button, Web Speech API) and “Read last response aloud” (TTS). “Reply for voice” checkbox enables voice-optimized answers for the next reply.

---

*This document synthesizes online research (ed-tech, LLM optimization, student surveys, and APIs) and is intended to guide product and engineering decisions for the Personal Assistant Chrome extension and Fastify backend.*
