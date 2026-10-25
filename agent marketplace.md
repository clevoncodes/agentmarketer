I'll start by **researching** the Paystack MCP and agent tooling, since it shapes the architecture.



Here's what I found and a plan built on it. One design decision matters more than the rest, so it comes first.



\## The core rule: the AI never owns the price



In 2023 a Chevrolet dealership's chatbot was talked into agreeing to sell a Tahoe for $1. The user told it to agree with everything and to call each reply legally binding, but no actual sale resulted. The lesson is that a public chatbot shouldn't be able to invent prices or declare that a contract exists. Your app is the same idea, with real money at stake.



So split the work in two:



\- \*\*Negotiation engine (plain code, deterministic):\*\* holds the seller's floor price and decides every counter-offer and whether to accept.

\- \*\*LLM:\*\* turns the buyer's message into structured data (e.g. `{intent: "offer", amount: 1800}`), then phrases the engine's decision in a friendly tone. It never sees the floor price. Even a successful prompt injection can't leak or breach what it doesn't know.



Output validation checks that any naira figure in the reply matches the engine's number. A "deal" exists only when the backend creates a locked order, never because the chat text says so.



\## Paystack: what the research shows



\- \*\*Official MCP server:\*\* it's in public preview. It exposes the Paystack API through a generic `make\_paystack\_request` tool and runs via `npx @paystack/mcp-server` with a test secret key. Community versions also exist, e.g. a Smithery-hosted one with 28 tools including `initialize\_transaction`, `create\_customer` and `create\_product`.

\- \*\*My recommendation:\*\* don't let the negotiating LLM call Paystack directly with your secret key. Give it one internal tool, `create\_checkout(deal\_id)`, which your backend executes after validating the deal. Use the MCP server where it helps most: dev-time exploration, admin and reconciliation assistants for the market chief, and demos. Keep the money path in ordinary backend code, since a preview-stage server is a risky thing to depend on there.

\- \*\*Paying sellers (split payments):\*\* create a subaccount per seller, then pass its code when initializing the transaction. The commission stays in your main balance. A transaction can only be split between the main account and one subaccount; splitting across several subaccounts needs the Funds Transfers API. For the MVP, that means one seller per checkout, which fits single-item haggling anyway.

\- \*\*Confirming payment:\*\* verify the `x-paystack-signature` header (HMAC-SHA512) on the raw request body, then call Paystack's verify endpoint before fulfilling. Make webhook handling idempotent, and mark the order paid only after this step.



\## How a negotiation works



1\. The buyer opens a product and a session starts. The agent quotes the list price and the payment method.

2\. Each buyer message goes through intent extraction, then the engine.

3\. The engine uses the seller's settings (list price, maximum discount, concession style) to choose a counter. A simple approach is to concede in shrinking steps (say 50%, 30%, then 20% of the allowed discount), with an auto-accept when the buyer's offer is at or above the floor.

4\. On the 4th buyer message the agent must give a final answer (accept, a final counter, or walk away). Then the session expires.

5\. Accepting creates a locked order at the agreed price with a payment window (e.g. 15 minutes), then a Paystack checkout link.



Decision for you: does "I want to buy this" count as one of the four messages? I'd say no. Count only messages that contain an offer or a question about price.



\## Seller and market chief settings



\*\*Seller:\*\*

\- Product details, photos, unit (e.g. "congo" or "derica" measures matter in local markets) and stock.

\- List price, maximum discount %, and a minimum order quantity.

\- Bargaining style (firm or flexible), delivery options and fees, and opening hours.

\- Bank details, verified through account resolution (confirm the exact endpoint in Paystack's docs).

\- Notification channel (SMS or WhatsApp).



\*\*Market chief (super admin):\*\*

\- Approve, suspend, and verify sellers.

\- Platform commission, and a global cap on discounts.

\- Banned items and categories.

\- Rules like session limits, payment window, and cooldowns.

\- Dispute queue, refunds, audit logs, and analytics.



Use role-based access (chief, market admin, seller), with every admin action logged.



\## What you may have missed



\- \*\*Re-bargaining abuse:\*\* buyers opening fresh sessions to get a better price. Add a per-buyer, per-product cooldown and a rate limit per device and phone number.

\- \*\*Buyer identity:\*\* require phone or email verification before a session starts, so payments and disputes are traceable.

\- \*\*Fulfilment:\*\* delivery, order status, and who confirms receipt. Paystack settles on its own schedule, so decide whether you need delayed settlement. Subaccounts support configurable settlement schedules (auto, weekly, monthly, manual). Confirm the details with Paystack.

\- \*\*Disputes and refunds:\*\* you need a process before launch, not after.

\- \*\*Language:\*\* many market buyers will write in Pidgin, Yoruba, Hausa or Igbo. Test this early, because it affects LLM quality.

\- \*\*Low-bandwidth use:\*\* make it a PWA with small payloads and a fast first load. A WhatsApp channel is a strong second phase.

\- \*\*Reliability and cost:\*\* a fallback when the LLM is down (e.g. "Final price is X, pay now"), plus per-session token caps. A small, fast model is enough since the engine does the thinking.

\- \*\*Compliance:\*\* check Nigeria's data protection rules for storing chat and phone data, and Paystack's requirements for marketplace platforms. I haven't verified these, so confirm them directly.

\- \*\*Terms of use:\*\* state clearly that only the confirmed order price is binding.



\## Realistic plan (2–3 developers)



| Phase | Weeks | Deliverable |

|---|---|---|

| 0. Validate | 1 | Talk to 5–10 real traders (would they trust this? what discounts are normal?), open a Paystack account, and begin business verification early since it can take a while. |

| 1. Core loop | 2–3 | Single seller, chat UI, engine, 4-message limit, test-mode checkout, webhook plus verify. |

| 2. Sellers | 2–3 | Onboarding, product listing, settings, subaccounts, order list, notifications. |

| 3. Admin | 1–2 | Market chief dashboard, RBAC, rules, disputes, audit log. |

| 4. Harden and pilot | 2 | Red-team the bot (price injection, fake "manager" claims), load test, then a pilot with 3–5 sellers in one market. |



A sensible stack: Next.js PWA, Neon Postgres, Redis for session and rate limits, and a small Groq-hosted model for chat. "Grok" is xAI's model family; Groq is the inference provider. Groq's API is OpenAI-compatible, its free usage has account-level rate limits, and its model lineup changes, so verify current limits and model IDs before launch. Groq currently recommends `openai/gpt-oss-20b` as a replacement for deprecated Llama models; keep the model configurable.

### Oja catalog search integration

The current prototype uses Groq to rank only the existing Oja product catalog for natural-language searches. The model returns catalog IDs, and the app renders product names and prices from its own catalog; the model cannot invent products or change prices. If the API key is missing or Groq is unavailable, search falls back to the existing local keyword matching. This search assistant is separate from bargaining: bargaining decisions and seller price floors remain deterministic backend logic.

Set `GROQ_API_KEY` in `.env.local` (copy `.env.example`) to enable AI search. Keep the key server-side and never commit it. This prototype has no shared rate limiter or persistent search sessions; add Redis-backed limits before exposing it to production traffic.

Research checked 25 October 2026:

- [Groq OpenAI compatibility](https://console.groq.com/docs/openai)
- [Groq model lifecycle and migration guidance](https://console.groq.com/docs/deprecations)
- [Groq GPT-OSS 20B model page](https://console.groq.com/docs/model/openai/gpt-oss-20b)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)


