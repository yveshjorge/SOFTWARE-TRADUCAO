# UX Contract

## Product context

Portuguese-speaking translators organizing their choices. UI pt-BR; timestamps stored in UTC and displayed in America/Sao_Paulo with Brasília label. Gregorian dates. Accessibility target WCAG 2.2 AA, tested through axe and keyboard workflows, not a certification.

## Business-context sources

| Scope                    | Source                                     | Type                                     | Reviewed   |
| ------------------------ | ------------------------------------------ | ---------------------------------------- | ---------- |
| Functional behavior      | docs/BACKLOG.md and linked Jira BM stories | Acceptance criteria                      | 2026-10-26 |
| Product audience         | Miro board linked in README                | Product canvas                           | 2026-10-26 |
| Permission model         | docs/ARCHITECTURE.md                       | Local deployment decision                | 2026-10-26 |
| Version lifecycle        | server/store.js; BM-13, BM-46              | Domain contract                          | 2026-10-26 |
| Temporary file retention | docs/ARCHITECTURE.md; BM-38                | Infrastructure contract                  | 2026-10-26 |
| Billing                  | Not part of this backlog                   | N/A                                      | 2026-10-26 |
| Legal stamp              | BM-12; docs/ARCHITECTURE.md                | Internal traceability, not certification | 2026-10-26 |

## Visual contract

See DESIGN.md. Runtime tokens in src/styles.css are canonical and tested for drift. Single light theme; forced-colors and reduced-motion support. Term and glossary create workflows are sibling references for shared fields, save feedback and modal cancellation.

## Canonical UI Map

| Capability      | Canonical owner                                 | Source of truth   | Allowed variants                                                 | Verification                   |
| --------------- | ----------------------------------------------- | ----------------- | ---------------------------------------------------------------- | ------------------------------ |
| Table Selection | src/Import.tsx selection state                  | BM-21             | Entire preview, up to 2000 rows                                  | E2E deselection                |
| Select/Listbox  | src/ui.tsx Select                               | DESIGN.md         | Native popup accepted                                            | Browser keyboard / selection   |
| Form            | src/ui.tsx Field and Textarea; server/domain.js | Domain validation | Term, glossary, note                                             | Validation E2E                 |
| Scrollbar       | src/styles.css global selectors                 | DESIGN.md         | Modal gutter, bounded preview                                    | Narrow layout + computed style |
| Toast           | src/main.tsx notification viewport              | This contract     | Success feedback                                                 | E2E status assertions          |
| CRUD            | src/api.ts and server/store.js                  | Jira criteria     | Create/edit return to owning list; details edit stays in context | CRUD E2E                       |

## Dataset navigation

Server pagination, 12 rows by default, maximum 50. Query, filters, ordering and page persist in URL. Search debounce 300ms, clear immediate, IME-aware; prior network requests aborted. Within a filter group options are OR; groups combine with AND. Client/glossary, project and work isolate context. All-result export uses every matching row, not just current page.

Loading has a labeled reserved region. Empty results retain filters and a create shortcut. Request failures retain the user's inputs and expose retry. Back/Forward restore URL filters. Import selection only applies to the current preview; selecting another file resets it. Preview shows exact selected count.

## Flow ledger

| Operation            | Pending                                | Success destination / feedback               | Failure recovery                          | Source                  |
| -------------------- | -------------------------------------- | -------------------------------------------- | ----------------------------------------- | ----------------------- |
| Create term/glossary | Disable submit                         | Owning list / saved status                   | Keep fields, inline errors                | BM-6, prerequisite BM-4 |
| Edit term/note       | Disable submit                         | Detail when opened there / history preserved | Keep entered text, reject stale version   | BM-11, BM-13            |
| Search               | Loading region                         | Filtered cards and count                     | Retry, keep filters                       | BM-2, BM-41             |
| Import               | Measured upload; indeterminate parsing | Preview then explicit commit / count         | Retain file/context; select again         | BM-21, BM-36            |
| Export               | Busy button                            | Download / exported status                   | Inline error; no empty file               | BM-8, BM-18             |
| Cancel               | None                                   | Restore trigger focus                        | Dirty draft requires discard confirmation | Shared modal            |

## Overlays and feedback

Native HTML dialog with accessible title owns modal behavior, inert background, focus containment and Escape. Initial browser focus is a safe control; closing restores the trigger. Cancel/Escape/close use the same dirty guard. Actual unload uses beforeunload only when dirty/busy. No hard delete feature is present in the supplied To Do scope.

One bottom live status viewport for acknowledgments; blocking errors remain inline. User-generated text is rendered as React text, never HTML. Search/inputs have visible labels, errors use aria-invalid and aria-describedby, first invalid field receives focus. Forms use noValidate. Textareas are multiline, scrollable and resize-none.

## Async and resilience

Pessimistic writes; no fake optimistic persistence. Buttons prevent double submit. Server import commit is idempotent per preview; term uniqueness prevents exact repeated creation. Versions enforce optimistic concurrency and return 409 without overwriting saved state. No sensitive drafts in browser storage. Disconnected requests preserve open forms; no offline mutation queue. This workstation-only application has no account sessions or role model; see architecture before any public deployment.

## Verification

Commands: npm run check; npm test; npm run build; npm run test:e2e; npm run format:check. Desktop 1440×1000 and narrow 390×844, pt-BR, light and reduced-motion. Tests exercise CRUD/history, notes, source links, filters, URL restoration, upload review/errors, failure recovery, keyboard focus and axe. See docs/VERIFICATION.md for actual run results and limits.
