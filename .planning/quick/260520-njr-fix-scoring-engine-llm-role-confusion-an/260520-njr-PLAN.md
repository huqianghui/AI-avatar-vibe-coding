---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/services/scoring_engine.py
  - backend/tests/test_scoring_engine_postvalidation.py
autonomous: true
requirements: []
must_haves:
  truths:
    - "Scoring prompt explicitly labels transcript roles as 'MR (YOU ARE EVALUATING THIS PERSON)' and 'HCP (DO NOT evaluate)'"
    - "Critical scoring rules appear immediately before the JSON output format (not buried early in prompt)"
    - "When ALL key_messages_status have delivered=false, key_message dimension score is capped at 30"
    - "When ALL key messages are undelivered AND MR messages are very short/irrelevant, ALL dimension scores are capped at 50"
  artifacts:
    - path: "backend/app/services/scoring_engine.py"
      provides: "Strengthened prompt + post-validation logic"
    - path: "backend/tests/test_scoring_engine_postvalidation.py"
      provides: "Unit tests for post-validation rules"
  key_links:
    - from: "score_with_llm()"
      to: "post-validation functions"
      via: "called after LLM JSON parse, before returning result dict"
      pattern: "_enforce_scoring_rules\\(.*key_messages_status.*dimensions\\)"
---

<objective>
Fix scoring engine bugs where: (1) the LLM evaluates HCP performance instead of MR performance due to role confusion in the prompt, and (2) the LLM ignores critical scoring rules because they are buried early in a long prompt.

Purpose: Ensure accurate MR-focused evaluation and enforce business rules programmatically as a safety net.
Output: Updated scoring_engine.py with strengthened prompt and post-validation logic, plus comprehensive unit tests.
</objective>

<execution_context>
@/Users/huqianghui/Downloads/1.github/AI-avatar-vibe-coding/.claude/get-shit-done/workflows/execute-plan.md
@/Users/huqianghui/Downloads/1.github/AI-avatar-vibe-coding/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/app/services/scoring_engine.py
@backend/tests/test_scoring_service.py (for test patterns and fixtures)
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Strengthen prompt and add post-validation logic</name>
  <files>backend/app/services/scoring_engine.py, backend/tests/test_scoring_engine_postvalidation.py</files>
  <behavior>
    - Test: _enforce_scoring_rules() with all key_messages delivered=false and LLM scores above 30 for key_message -> caps key_message to 30
    - Test: _enforce_scoring_rules() with all key_messages delivered=false and LLM key_message score already below 30 -> no change
    - Test: _enforce_scoring_rules() with some key_messages delivered=true -> no capping applied
    - Test: _enforce_scoring_rules() with all undelivered AND MR messages very short (total chars < 100) -> all dimensions capped to 50
    - Test: _enforce_scoring_rules() with all undelivered but MR messages substantive (total chars > 200) -> only key_message capped, other dims untouched
    - Test: _enforce_scoring_rules() with empty key_messages_status -> no capping (nothing to evaluate)
    - Test: build_scoring_prompt() output contains ">>> MR (EVALUATE THIS PERSON) <<<" label in transcript
    - Test: build_scoring_prompt() output contains ">>> HCP (DO NOT EVALUATE) <<<" label in transcript
    - Test: build_scoring_prompt() output has critical rules section immediately before JSON output format (within last 40 lines of prompt)
    - Test: score_with_llm() calls post-validation and returns capped scores when rules triggered
  </behavior>
  <action>
    1. Add a new function `_enforce_scoring_rules(dimensions, key_messages_status, messages)` to scoring_engine.py:
       - Check if ALL entries in key_messages_status have `delivered=false`
       - If yes: cap the "key_message" dimension score to max 30
       - Additionally check if MR messages are very short/irrelevant: sum total characters of all user-role messages; if total < 100 chars, cap ALL dimension scores to max 50
       - Return the (possibly mutated) dimensions list
       - Log a warning when capping is applied for observability

    2. Modify SCORING_PROMPT_TEMPLATE to fix role confusion:
       - In the transcript formatting (build_scoring_prompt), change role labels from plain "MR:" / "HCP:" to:
         `">>> MR (EVALUATE THIS PERSON) <<<: {content}"` and `">>> HCP (DO NOT EVALUATE) <<<: {content}"`
       - Move the critical scoring rules from lines 25-28 (currently buried after the first paragraph) to a new section called "## CRITICAL SCORING RULES (MUST FOLLOW)" placed IMMEDIATELY BEFORE the JSON output instructions at the end of the prompt
       - Keep a brief reminder at the top ("You evaluate ONLY the MR") but put the detailed enforcement rules at the end where LLMs pay most attention
       - Add one more reinforcement line right before the JSON structure: "REMINDER: Scores MUST reflect MR (role=user) performance ONLY. Every quote must come from MR messages marked with '>>> MR' above."

    3. In score_with_llm(), after parsing the LLM JSON result and before computing overall_score:
       - Call `_enforce_scoring_rules(dimensions, key_messages_status, messages)`
       - This ensures programmatic enforcement even if LLM ignores the prompt rules

    4. Write comprehensive unit tests in `backend/tests/test_scoring_engine_postvalidation.py`:
       - Test the _enforce_scoring_rules function directly with all cases from behavior section
       - Test build_scoring_prompt output structure (role labels, rule placement)
       - Test score_with_llm integration: mock the OpenAI client to return high scores when all key_messages undelivered, assert post-validation caps them
       - Use the same mock/patch patterns as test_scoring_service.py (AsyncMock, patch for config_service and azure_auth)
  </action>
  <verify>
    <automated>cd /Users/huqianghui/Downloads/1.github/AI-avatar-vibe-coding/backend && python -m pytest tests/test_scoring_engine_postvalidation.py -v --tb=short</automated>
  </verify>
  <done>
    - _enforce_scoring_rules() caps key_message to 30 when all messages undelivered
    - _enforce_scoring_rules() caps all dimensions to 50 when undelivered + short/irrelevant MR content
    - Prompt template uses strong role labels in transcript (">>> MR (EVALUATE THIS PERSON) <<<")
    - Critical rules appear at end of prompt near JSON output format
    - score_with_llm() applies post-validation before returning
    - All tests pass with 100% coverage of the new logic
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM output -> scoring logic | LLM may return scores that violate business rules |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | LLM JSON response | mitigate | Post-validation enforces score caps programmatically regardless of LLM output |
| T-quick-02 | Information Disclosure | Prompt template | accept | Prompt contains scenario data that is already authorized for the scoring context |
</threat_model>

<verification>
- All new tests pass: `pytest tests/test_scoring_engine_postvalidation.py -v`
- Existing scoring tests still pass: `pytest tests/test_scoring_service.py -v`
- Ruff lint and format checks pass: `ruff check backend/app/services/scoring_engine.py && ruff format --check backend/app/services/scoring_engine.py`
</verification>

<success_criteria>
- Post-validation logic programmatically enforces: key_message <= 30 when all undelivered, all dims <= 50 when undelivered + short MR content
- Prompt clearly labels roles to prevent LLM from evaluating HCP instead of MR
- Critical rules positioned at end of prompt for maximum LLM attention
- All tests green, ruff clean
</success_criteria>

<output>
After completion, create `.planning/quick/260520-njr-fix-scoring-engine-llm-role-confusion-an/260520-njr-SUMMARY.md`
</output>
