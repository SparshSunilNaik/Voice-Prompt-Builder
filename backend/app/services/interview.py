"""Deterministic guards around model output for the adaptive interview and generation.

Smaller models do not reliably follow every instruction, so behaviour that users depend on
(no repeated questions, real multiple-choice options, honestly labelled generated examples)
is enforced here instead of only being requested in the prompt.
"""

import re

from app.models.contracts import FollowUpAnswer, PromptingStrategy
from app.services.prompt_engine import ILLUSTRATIVE_HEADING

FILLER_CHOICE = re.compile(
    r"^\s*(other|others|custom( answer)?|something else|please specify|none of (the|these) above|"
    r"not sure|i don'?t know)\b",
    re.IGNORECASE,
)
QUESTION_STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "do", "does", "you", "your", "we", "should",
    "what", "which", "how", "is", "are", "be", "will", "would", "this", "that", "it", "with", "any",
}  # fmt: skip
EXAMPLES_HEADING = re.compile(
    r"^(?P<lead>[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*)(?:few[- ]shot |one[- ]shot )?examples?"
    r"(?:[ \t]*\([^)\n]*\))?[ \t]*:?[ \t]*(?P<trail>(?:\*\*|__)?)[ \t]*:?[ \t]*$",
    re.IGNORECASE | re.MULTILINE,
)


def _words(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z0-9]+", text.lower()) if word not in QUESTION_STOPWORDS}


def is_repeat(question: str, previous: list[str], threshold: float = 0.6) -> bool:
    """True when the question is the same decision as an earlier one, worded slightly differently."""
    words = _words(question)
    for earlier in previous:
        other = _words(earlier)
        if not words or not other:
            if question.strip().lower() == earlier.strip().lower():
                return True
            continue
        shared = len(words & other)
        # Same wording overall, or the same decision narrowed to a sub-case
        # ("criteria for each category" -> "criteria for bug reports").
        if shared / len(words | other) >= threshold or (
            shared >= 3 and shared / min(len(words), len(other)) >= threshold
        ):
            return True
    return False


def clean_choices(choices: list[str], limit: int = 4) -> list[str]:
    """Drop blanks, duplicates and filler options; the UI always offers a custom answer."""
    seen: set[str] = set()
    cleaned: list[str] = []
    for choice in choices:
        text = choice.strip()
        key = text.lower()
        if not text or key in seen or FILLER_CHOICE.match(text):
            continue
        seen.add(key)
        cleaned.append(text)
    return cleaned[:limit]


NUMBER_WORDS = {"one": 1, "a single": 1, "single": 1, "two": 2, "three": 3, "four": 4, "five": 5}
STATED_COUNT = re.compile(
    r"\b(?P<count>[0-5]|one|a single|single|two|three|four|five)\s+(?:[a-z-]+\s+){0,4}?examples?\b",
    re.IGNORECASE,
)
NO_EXAMPLES = re.compile(
    r"\b(no|zero|without|skip(?: the)?)\s+examples?\b|\bjust instructions\b", re.IGNORECASE
)
OWN_EXAMPLES = re.compile(
    r"\b(my own|our own|i(?:'ll| will) (?:paste|provide|share|add)|i have)\b", re.IGNORECASE
)


def apply_stated_example_choice(
    strategy: PromptingStrategy, answers: list[FollowUpAnswer]
) -> PromptingStrategy:
    """Honour an explicit example count the user stated, which models sometimes overlook.

    Only unambiguous statements are applied ("2 examples", "no examples"); the latest one wins.
    """
    count: int | None = None
    own = False
    for answer in answers:
        text = answer.answer.strip()
        if answer.skipped or not text:
            continue
        if NO_EXAMPLES.search(text):
            count, own = 0, False
            continue
        stated = STATED_COUNT.search(text)
        if stated:
            raw = stated.group("count").lower()
            count = int(raw) if raw.isdigit() else NUMBER_WORDS[raw]
            own = bool(OWN_EXAMPLES.search(text))
    if count is None:
        return strategy
    source = "none" if count == 0 else "user_supplied" if own else strategy.example_source
    if count == strategy.example_count and source == strategy.example_source:
        return strategy
    data = strategy.model_dump(exclude={"examples"})
    data.update(example_count=count, example_source=source)
    return PromptingStrategy.model_validate(data)


def label_illustrative_examples(prompt: str, strategy: PromptingStrategy) -> tuple[str, str | None]:
    """Ensure model-written demonstrations are visibly marked as generated, not user-approved.

    Returns the possibly relabelled prompt and an assumption to surface when no heading could be found.
    """
    if strategy.example_count == 0 or strategy.example_source != "illustrative":
        return prompt, None
    if ILLUSTRATIVE_HEADING.lower() in prompt.lower():
        return prompt, None
    relabelled, replaced = EXAMPLES_HEADING.subn(
        lambda match: f"{match.group('lead')}{ILLUSTRATIVE_HEADING}{match.group('trail')}", prompt, count=1
    )
    if replaced:
        return relabelled, None
    return prompt, "Any examples in this prompt were generated as illustrations, not supplied by you."
