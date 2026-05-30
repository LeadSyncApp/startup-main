# Core Identity Architecture (AI Agent Operating Standard)

This document defines how AI coding agents should operate when working in this repository.

## Foundational principles

1. **Context is everything**
   - Understand the problem, who it’s for, and why it matters.
   - Identify constraints (technical, business, time, compliance).
   - Define success criteria (measurable outcomes) before building.

2. **Precision through discovery**
   - Never assume code patterns exist—verify in the repo first.
   - Match established conventions (naming, architecture, error handling, validation, testing).

3. **Production-grade from day one**
   - Type-safe and explicit contracts.
   - Resilient error handling and graceful degradation.
   - Secure by design (validation, sanitization, least privilege).
   - Performance-aware and scalable.
   - Accessible (WCAG-minded) and inclusive.

4. **Consistency over cleverness**
   - Preserve working behavior.
   - Don’t introduce new paradigms without explicit approval.
   - Prefer minimal, reversible changes over sweeping refactors.

5. **Measurable business impact**
   - Every engineering decision should trace to UX, performance, cost, risk reduction, or competitive advantage.

## Engagement protocol

### Phase 1 — Reconnaissance (first 5–10 minutes)

For existing projects:
- Identify repo structure and entrypoints.
- Read project documentation (README/INSTALLATION, package scripts).
- Review recent changes where relevant.
- Identify tech stack versions and dependencies.
- Locate routing, state management, persistence, and API contracts.
- Map the relevant data models and interfaces.

For new projects:
- Clarify problem statement, target users, and MVP boundaries.
- Define success metrics and acceptance criteria.
- Identify constraints (budget, timeline, compliance).
- Choose stack based on requirements.
- Plan architecture, data model, and API contracts.
- Establish workflow and standards.

### Phase 2 — Pattern analysis

Identify existing patterns for:
- Naming conventions (files/components/functions/types).
- Component and module architecture (composition, hooks, services).
- Error handling and logging (what’s logged, where, and how).
- Validation and sanitization approach.
- Async/loading patterns and user feedback.
- Testing/build workflows and deployment expectations.

Avoid common anti-patterns:
- Direct state mutation.
- Implicit/unchecked types, pervasive `any`.
- Vague errors (“Something went wrong”).
- Missing loading/error states for async operations.
- Hardcoded configuration values.
- Inconsistent naming.
- Missing edge-case handling.
- Poor separation of concerns.

### Phase 3 — Implementation planning

Before writing code:
- List files to create/modify.
- Identify dependencies and conflicts.
- Plan backwards compatibility and migrations.
- Enumerate edge cases and failure modes.
- Outline testing and verification steps.
- Consider performance impact.
- Document any behavior changes.

## Core engineering standards

### Type safety
- Prefer strict TypeScript.
- Define explicit types/interfaces for payloads, state, and API responses.
- Avoid `any` unless justified and localized.
- Prefer discriminated unions for complex state.

### Error handling
- Wrap async operations in `try/catch`.
- Provide specific, actionable messages.
- Log for debugging without leaking secrets.
- Degrade gracefully with sensible fallbacks.

### Validation
- Validate client-side before API calls.
- Whitelist allowed inputs; reject unexpected fields.
- Sanitize user-provided strings before rendering.
- Provide real-time feedback where appropriate.

### Performance
- Lazy load non-critical routes/features.
- Debounce/throttle expensive interactions.
- Memoize expensive computations.
- Virtualize long lists where necessary.
- Monitor bundle size and avoid regressions.

### Security
- Never commit secrets.
- Validate and sanitize all inputs (XSS and injection defenses).
- Use secure headers and safe defaults.
- Apply rate limiting for sensitive actions.
- Hash/encrypt sensitive data.
- Follow OWASP best practices.

### Accessibility
- Use semantic HTML.
- Provide ARIA labels/roles as needed.
- Ensure keyboard navigation works.
- Manage focus in modals/dialogs.
- Maintain sufficient color contrast.

## State management best practices

- **Immutable updates:** never mutate state in place.
- **Persistence:** scope storage keys by user/company; handle quota and fallback.
- **Optimistic updates:** update UI first; revert on failure with user feedback.

## AI integration patterns

- **Prompt engineering:** clear context, constraints, and output schema; include examples when helpful.
- **Context management:** prune irrelevant history; summarize when needed.
- **Error recovery:** retry transient failures with backoff; fall back to simpler prompts.

## Testing methodology

Manual checklist:
- Build succeeds with zero errors.
- Critical user flows work end-to-end.
- Edge cases handled (empty/invalid inputs, network errors).
- Mobile responsiveness sanity check.
- Persistence works across refresh.

Automated testing principles (when tests exist):
- Test behavior, not implementation details.
- Cover critical journeys + edge cases.
- Mock external dependencies.
- Keep tests isolated and fast.

## Git workflow standards

- One logical change per commit.
- Stage specific files (avoid blanket adds).
- Use clear commit messages (conventional commits preferred).
- Feature branches for new work; keep `main` always deployable.
- **Never push to `main` without explicit permission.**

## Deployment excellence

Pre-deploy:
- Builds/tests pass.
- Env vars documented.
- No debug-only code.
- Security headers configured.

Post-deploy:
- Production URL loads.
- Critical flows work.
- Monitoring/error tracking receives events.
- No new console errors.

## Documentation standards

- Use comments to explain **why**, not what.
- Keep docs updated for setup and workflows.
- Add troubleshooting notes for common failure modes.

## Debugging methodology

1. Reproduce reliably.
2. Isolate the failure.
3. Verify assumptions.
4. Add targeted logging.
5. Form a hypothesis.
6. Test hypothesis with minimal change.
7. Implement production fix.
8. Prevent regression (tests or guardrails).

## Response templates (optional)

### Discovery phase
- Summarize what you found (stack, patterns, relevant files).
- List intended file changes.
- Provide a short plan with edge cases and success criteria.

### Implementation phase
- Track progress and note key decisions.
- Report validation results (build/tests) for touched areas.
- List files modified.

### Completion phase
- Summarize outcome + key features.
- Note risks/tradeoffs.
- Provide next steps.
