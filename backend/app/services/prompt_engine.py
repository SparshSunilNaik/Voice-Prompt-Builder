import json

from app.models.contracts import GenerateRequest, RefineRequest

INTENT_SYSTEM_PROMPT = """You are a pragmatic prompt architect. Analyze the request rather than paraphrasing it.

Identify the user's actual goal, relevant context, intended deliverable, confirmed requirements,
missing requirements, constraints, domain, ambiguities, and concrete risks. Recommend the simplest
methodology that reliably fits the goal. Consider deterministic workflows, retrieval (RAG), tool-using
agents, hybrids, or domain-specific methods only when warranted. Supply no more than three genuinely
useful alternatives. Explain why the recommendation fits and never present assumptions as facts.

Return only JSON matching the supplied schema."""

FOLLOWUP_SYSTEM_PROMPT = """You identify only information that would materially improve the final prompt.
Generate between zero and {limit} contextual follow-up questions. Never ask for information already in
the request or analysis. Prioritize decisions that change scope, audience, output, constraints, or success
criteria. Avoid generic questions. Each question needs a unique stable ID, a relevance explanation,
optional concise choices when choices help, support for a custom answer, and must be skippable.
Return fewer than the limit when additional questions would add little value. Return only schema JSON."""

GENERATE_SYSTEM_PROMPT = """Synthesize a final prompt that another AI can execute without guesswork.
Respect the selected methodology, confirmed requirements, answered follow-ups, skipped questions, custom
instructions, and revision request. Use only headings that improve usability: Objective, Context, Role,
Methodology, Requirements, Constraints, Deliverables, Quality Standards, and Validation Criteria are
available but not mandatory. Be specific and actionable without bloated prompt-engineering jargon.
Never promote an assumption into a confirmed requirement. List unavoidable assumptions separately in the
JSON response. Output only schema JSON."""


def analysis_user_prompt(raw_input: str) -> str:
    return f"Analyze this rough request:\n\n{raw_input.strip()}"


def followup_user_prompt(request: RefineRequest) -> str:
    payload = {
        "original_request": request.input,
        "analysis": request.analysis.model_dump(),
        "selected_methodology": request.methodology.model_dump(),
        "user_methodology_instructions": request.custom_instructions or None,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def generation_user_prompt(request: GenerateRequest) -> str:
    confirmed_answers = [
        {"question_id": answer.question_id, "answer": answer.answer}
        for answer in request.answers
        if not answer.skipped and answer.answer.strip()
    ]
    skipped = [answer.question_id for answer in request.answers if answer.skipped]
    payload = {
        "original_request": request.input,
        "analysis": request.analysis.model_dump(),
        "selected_methodology": request.methodology.model_dump(),
        "confirmed_followup_answers": confirmed_answers,
        "skipped_question_ids": skipped,
        "custom_instructions": request.custom_instructions or None,
        "previous_prompt": request.previous_prompt or None,
        "revision_request": request.revision_request or None,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)
