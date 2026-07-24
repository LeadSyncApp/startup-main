# Phase 9 — Investigation Scope: Pre-Flight Classifier & LLM Prompt-Following Reliability

**Filed:** 2026-07-22  
**Branch:** phase-3-8-product-matching (commit 3a96a5d)  
**Status:** Not started — investigate in next session  

---

## The Finding (from Phase 3-8 E2E test)

The product matching pipeline built today (BGE reranker, LLM judge, confidence tiers, matchReason, hallucination prevention) produces the correct internal answer for "anything in polyester?" — cotton pants at MEDIUM confidence, judge-confirmed, matchReason "made of polyester fabric." **But the customer never receives this answer.** Two upstream gates silently bypass the pipeline before it can deliver value:

- **Gate 1 (PreFlight classifier):** `classifyMessageIntentWithTimeout` (`ai.service.ts:1072`) decides the message isn't a "ProductInquiry," so `matchProductForMessage` is never called. The entire pipeline is skipped.
- **Gate 2 (generateShopReply internal classification):** Even when the correct match is handed directly inside `<MatchedProduct>` tags, the 70B LLM classifies the intent as "Support" and generates a generic handoff reply (`"Aapka message mil gaya hai..."`) instead of following the MATCHED PRODUCT CONFIDENCE RULES in its own prompt. It took 14.7s to get this wrong.

**Why this is worse than the earlier bugs:** Earlier issues (reranker disconnected, hallucination, E5 prefix) were all inside the product-matching logic itself — things we built and could fix. This is different: the entire pipeline sits behind a pre-existing gate that was never part of today's work, and a prompt-following gap in the LLM that ignores the answer even when it arrives. The pipeline is correct, but it's locked behind two doors that were always there.

---

## Gate 1 — PreFlight Classifier Investigation

### Location
- File: `leadsync-backend/src/services/ai/ai.service.ts`
- Function: `classifyMessageIntent()` (line 1011), wrapped by `classifyMessageIntentWithTimeout()` (line 1072)
- Model: `llama-3.1-8b-instant` (fast, cheap, 2s timeout)
- Prompt: Lines 1018-1052

### Current intent categories
```
"Greeting/SmallTalk" | "ProductInquiry" | "Support/Policy" | "OrderRelated" | "Other"
```

### Sub-specificity within ProductInquiry
```
"specific": asking for a specific item/attribute (e.g. "red checked shirt size M")
"general": asking for menu/catalog (e.g. "what do you have?")
```

### What to investigate

1. **Test a range of real attribute-style queries against the classifier — not just this one.** Build a small test harness that calls `classifyMessageIntent` directly with a panel of queries:

   | Category | Query |
   |---|---|
   | Direct product name | "do you have cotton pants?" |
   | Attribute (fabric) | "anything in polyester?" |
   | Attribute (color) | "anything red?" |
   | Attribute (size) | "do you have size 42?" |
   | Attribute (category) | "any shirts?" |
   | Hinglish attribute | "silk saree hai kya aapke paas" |
   | Compound attribute | "cotton pants" |
   | Plural form | "show me shirts" |
   | Low-confidence bound | "tell me about m" |
   | Non-product | "what time do you close?" |
   | Chit-chat | "hello how are you" |

2. **For each query, record:**
   - Classified intent
   - Classified inquiryType (specific / general / null)
   - Reasoning string
   - Latency (ms)

3. **Determine the misfire rate.** How many queries that should be "ProductInquiry/specific" are misclassified? Is "anything in polyester?" a one-off edge case or part of a broader pattern?

4. **Root cause in the prompt.** The current prompt's ProductInquiry definition says:
   > `"ProductInquiry": Inquiries about products, catalog, items, menu, prices, services, or availability.`
   > — `"specific": The user is asking for a specific item, attribute, brand, size, color, design, or looking up a particular product`

   Is "anything in polyester?" genuinely ambiguous under this definition? Or does the phrase "anything in [attribute]" get classified as a general support question by the fast model? Does adding explicit pattern examples in the prompt fix it without breaking other categories?

5. **Propose a fix.** Options:
   - Broaden the "ProductInquiry" definition with more edge-case examples
   - Remove the gate entirely — always run `matchProductForMessage` and let the matcher's null result indicate "no product relevance" rather than the classifier deciding in advance
   - Add a bypass: if `matchProductForMessage` returns a non-null result, override the pre-flight intent to "ProductInquiry" post-hoc

### Verification plan
- Before/after: run the test panel against the classifier, show the full classification output for each query
- Confirm no regression on queries that currently classify correctly

---

## Gate 2 — generateShopReply Prompt-Following Reliability

### Location
- File: `leadsync-backend/src/services/ai/ai.service.ts`
- Function: `generateShopReply()` (line 445)
- Model: `llama-3.3-70b-versatile` (slower, expensive, used for final reply)
- The `compileDynamicOmniPrompt()` output (lines 358–441) is injected as the system prompt

### What the LLM receives
When a product match exists, the context block contains:
```xml
<ActiveMerchantMenuSnapshot>
Matched Product: cotton pants — Confidence: MEDIUM (OUT OF STOCK)
</ActiveMerchantMenuSnapshot>

<MatchedProduct>
{"name":"cotton pants","confidenceTier":"MEDIUM","stockStatus":"OUT_OF_STOCK","matchReason":"made of polyester fabric"}
</MatchedProduct>
```

And the system prompt contains the full `MATCHED PRODUCT CONFIDENCE RULES` section telling the LLM exactly how to handle each tier.

**Despite this, the LLM returned:**
```
intent_type: "Support"
replyText: "Aapka message mil gaya hai. Hamaare agent jaldi hi reply karenge!"
latency: 14,710ms
```

### What to investigate

1. **Reproduce the failure deterministically.** Call `generateShopReply` with a controlled payload (empty conversation history, no draft order, single matched product, empty rules) and verify the LLM still returns "Support" instead of "Query." Rule out context pollution from other pipeline stages.

2. **Test with different match scenarios:**
   - HIGH confidence, IN_STOCK
   - MEDIUM confidence, OUT_OF_STOCK (the polyester case)
   - LOW confidence, IN_STOCK
   - LOW confidence, OUT_OF_STOCK
   - NONE (null match)

3. **Test prompt modifications in isolation.**
   - Hypothesis A: The MATCHED PRODUCT CONFIDENCE RULES are too far from the RESPONSE SCHEMA section — the model sees them but doesn't connect rules to intent classification.
   - Hypothesis B: The intent classification definitions in the prompt are incomplete — "Query" and "Support" are listed in the response schema but never explicitly defined (unlike "Checkout" and "OrderConfirmed" which have detailed definitions).
   - Hypothesis C: The model has learned a strong prior that "Support" → generic handoff, and the matched product rules aren't weighted strongly enough to override it.

   **Test each hypothesis with a modified prompt and compare before/after output.**

4. **Flag the 14.7s latency separately.**
   - The silk saree query (null match) completed in 2.6s — what caused the 5.7x slowdown for polyester?
   - Is it the model "hemming and hawing" over conflicting signals?
   - Does adding an explicit "if <MatchedProduct> has data → intent MUST be Query" rule reduce latency by removing ambiguity?
   - Measure before/after LLM times for the same queries.

5. **Propose a fix.** Options:
   - Add explicit definitions of "Query" and "Support" in the INTENT RECOGNITION section (currently only "Checkout" and "OrderConfirmed" are defined)
   - Add a conditional rule: "If <MatchedProduct> contains a product object (not 'No matched product.'), the intent MUST be 'Query' and you MUST follow the MATCHED PRODUCT CONFIDENCE RULES"
   - Move the matched-product handling logic ABOVE the intent classification section so it's processed first
   - Post-process: if the LLM returns "Support" but a matched product was provided, override the intent to "Query" server-side

### Verification plan
- Before/after: same set of test queries against `generateShopReply`, show the full response (intent_type, replyText, latency) for each
- Confirm the fix doesn't break the "no match" path (silk saree query must still return the correct "not available" reply)
- Measure latency impact of any prompt changes

---

## Success criteria for Phase 9

1. A query like "anything in polyester?" reaches the product matching pipeline and the customer-facing reply reflects the matched product — not a generic handoff.
2. The "no match" path (e.g. "do you have silk sarees?") continues to return the correct "not available" reply — no regression.
3. Latency for matched-product queries is not materially worse than the current 2-4s path for non-matched queries.
4. Both fixes have before/after empirical verification with real Groq API calls — no assertions without evidence.
