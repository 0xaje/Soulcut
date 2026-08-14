# SoulCut Minds-Native Transformation: Architecture Audit

## Current product map

SoulCut is an authenticated React 19, TypeScript, Tailwind, Express, tRPC, Drizzle, and MySQL application. Manus OAuth resolves each signed-in account to a local `users` row, and all existing video jobs, progress events, reports, shares, branding, quotas, and rate-limit records are scoped with that internal numeric `userId`.

The product already has a durable analysis queue. A protected submission creates a user-owned video job, the worker records progress events, and a scheduled worker claims and processes the job. The source-analysis path uses a server-side structured LLM response and preserves source grounding by returning no clips when timing cannot be supported. Existing reports, exports, sharing, revocation, upload validation, user isolation, and SSE progress remain part of the product contract.

The current public route is `/`; the authenticated workspace route is `/app`. The workspace currently focuses on video submission, job history, reports, and result cards. The client has no existing Mind, Creative DNA, onboarding, feedback, or recommendation-personalization components. The current project contains no Minds SDK dependency, Minds connector, `MINDS_API_KEY`, or Minds API base-URL configuration.

## Verified Minds boundary

The official Minds v1 REST API represents a customer-facing Mind with the historical `spark` resource name. It supports Mind creation and management, knowledge ingestion, and stateful or completion-based chat. API requests use a bearer API key and the production base URL is `https://api.getminds.ai/v1`; the authenticated account check is `GET /auth/me`. Minds knowledge can be added from files, links, or keyword enrichment and is processed asynchronously before retrieval. [1] [2] [3]

SoulCut will keep its application-owned creative memory in its own database because it must remain private per SoulCut user, be queryable for evidence/confidence UI, and remain available when the external Minds connection is unavailable. A dedicated server-side adapter will make the external Mind relationship explicit: it will create or synchronize one private Minds Mind per SoulCut Creative Mind only when `MINDS_API_KEY` is configured, persist the returned external Mind ID, and degrade truthfully to local SoulCut memory when configuration or service access is unavailable. No client-side API calls, fabricated Minds responses, or fake connection states will be introduced.

## Safe implementation sequence

| Phase | Scope | Compatibility rule |
| --- | --- | --- |
| Foundation | Add a Minds adapter, server-only environment contract, connection state, and tests. | No existing analysis workflow is removed. |
| Data model | Add one Creative Mind per user, evidence-backed memories, feedback events, and activity. | Existing video jobs and reports are unchanged. |
| Onboarding and DNA | Add a first-run Mind introduction, lightweight preference collection, and Creative DNA view. | User data remains owner-scoped. |
| Learning loop | Add direct teaching and recommendation feedback with evidence/confidence updates. | Weak signals remain low confidence and never become hard claims. |
| Personalization | Pass bounded, evidence-backed Mind context into analysis and render personalized reasons. | Source grounding and timestamp safety remain intact. |
| Product redesign | Make the Mind central in the workspace while retaining report, export, history, and sharing features as supporting controls. | Existing workflows remain reachable. |

## Required configuration before external synchronization

The external Minds integration requires a server-only `MINDS_API_KEY`. This key must be supplied through the project secret manager and must never be committed, returned to the browser, written to logs, or used as a fallback client credential. The adapter will default to the documented production endpoint and will treat a missing, invalid, unavailable, or plan-limited external integration as a truthful unavailable state rather than as a failed local Creative Mind.

## Animoca Brands Builder API verification note

The official Minds Builder Hub separately documents a Builder API key for Animoca Brands Minds. Its account-setup guide instructs builders to create at least one Mind, create a key in the Builder console, and store the one-time token as `MINDS_BUILDER_API_KEY` before using the official Minds CLI or client library. This is a distinct integration surface from the `getminds.ai` research API and must be verified against the Builder client-library documentation before it is used by SoulCut. [4]

The official Builder Node package is `@animocabrands/minds-client-lib`. It reads `MINDS_BUILDER_API_KEY`, authenticates Builder API requests with `X-Api-Key`, and exposes `getMind(mindId)` for account-scoped Mind detail. The Builder API reference also documents its live host as `https://api.build.hellominds.ai`, and its Builder-key account endpoint as `GET /v1/humans/{humanId}/minds`; the supplied human ID must match the human ID encoded in the Builder API key. [5] [6]

## References

[1]: https://getminds.ai/api/overview "Minds API Overview"
[2]: https://getminds.ai/api/authentication "Minds API Authentication"
[3]: https://getminds.ai/api/knowledge "Minds Knowledge API"
[4]: https://build.hellominds.ai/en/docs "Minds Builder Hub: Account setup"
[5]: https://build.hellominds.ai/en/docs/get-started/client-library "Minds Builder Hub: Client Library"
[6]: https://build.hellominds.ai/docs/api "Minds Builder API Reference"
