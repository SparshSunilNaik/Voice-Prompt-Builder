from app.models.contracts import FollowUpAnswer, PromptingStrategy
from app.services.interview import (
    apply_stated_example_choice,
    clean_choices,
    is_repeat,
    label_illustrative_examples,
)
from app.services.prompt_engine import ILLUSTRATIVE_HEADING

ILLUSTRATIVE = PromptingStrategy(example_count=3, example_source="illustrative")


def test_near_duplicate_questions_from_live_run_are_detected() -> None:
    earlier = ["What specific criteria should we use for each category?"]
    assert is_repeat("What specific criteria should we use for bug reports?", earlier)
    assert is_repeat("Do you have EXAMPLES", ["Do you have examples?"])
    assert not is_repeat("How should we classify emails that fit multiple categories?", earlier)
    assert not is_repeat("What complexity level are the probability puzzles?", ["What format do you prefer?"])
    assert not is_repeat("Who is it for?", [])


def test_filler_and_duplicate_choices_are_removed() -> None:
    raw = [
        "User suggestions",
        "New functionality",
        "user suggestions",
        " ",
        "Custom answer",
        "Other payment issues",
    ]
    assert clean_choices(raw) == ["User suggestions", "New functionality"]
    assert clean_choices(["Yes, please specify", "No"]) == ["Yes, please specify", "No"]
    assert clean_choices(["a", "b", "c", "d", "e"]) == ["a", "b", "c", "d"]


def test_generated_examples_get_an_honest_heading() -> None:
    for heading, expected in [
        ("**Examples:**", f"**{ILLUSTRATIVE_HEADING}**"),
        ("### Examples:", f"### {ILLUSTRATIVE_HEADING}"),
        ("Examples", ILLUSTRATIVE_HEADING),
        ("## Few-shot examples (3)", f"## {ILLUSTRATIVE_HEADING}"),
    ]:
        prompt, note = label_illustrative_examples(
            f"Classify emails.\n\n{heading}\n1. Input: x", ILLUSTRATIVE
        )
        assert expected in prompt and note is None, heading
    # Only the heading line changes; prose mentioning examples is untouched.
    prose = "Use the examples below.\n### Example\nInput: a"
    assert label_illustrative_examples(prose, ILLUSTRATIVE)[0].startswith("Use the examples below.")


def test_labelling_leaves_other_strategies_alone_and_falls_back_to_an_assumption() -> None:
    text = "Classify emails.\n### Examples:\n1. Input: x"
    user = PromptingStrategy(example_count=2, example_source="user_supplied")
    assert label_illustrative_examples(text, user) == (text, None)
    assert label_illustrative_examples(text, PromptingStrategy()) == (text, None)
    already = f"## {ILLUSTRATIVE_HEADING}\n1. Input: x"
    assert label_illustrative_examples(already, ILLUSTRATIVE) == (already, None)
    prompt, note = label_illustrative_examples("Classify emails. Input: x -> Output: y", ILLUSTRATIVE)
    assert prompt == "Classify emails. Input: x -> Output: y" and "generated as illustrations" in note


def said(*texts: str, skipped: bool = False) -> list[FollowUpAnswer]:
    return [
        FollowUpAnswer(question_id=f"q{i}", question="Examples?", answer=text, skipped=skipped)
        for i, text in enumerate(texts)
    ]


def test_stated_example_counts_override_the_model_strategy() -> None:
    model = PromptingStrategy(example_count=3, example_source="illustrative", reasoning="chain_of_thought")
    own = apply_stated_example_choice(model, said("Yes, I will paste 2 of my own solved examples"))
    assert (own.example_count, own.example_source, own.examples) == (2, "user_supplied", "few_shot")
    assert own.reasoning == "chain_of_thought"
    one = apply_stated_example_choice(model, said("1 example"))
    assert (one.examples, one.example_source) == ("one_shot", "illustrative")
    assert apply_stated_example_choice(model, said("a single worked example")).example_count == 1
    none = apply_stated_example_choice(model, said("No examples, just instructions"))
    assert (none.examples, none.example_source) == ("zero_shot", "none")
    latest = apply_stated_example_choice(model, said("2 examples", "Actually no examples"))
    assert latest.example_count == 0


def test_unrelated_or_skipped_answers_do_not_change_examples() -> None:
    model = PromptingStrategy(example_count=3, example_source="illustrative")
    assert (
        apply_stated_example_choice(model, said("Basic Bayesian problems", "In-depth step-by-step")) is model
    )
    assert apply_stated_example_choice(model, said("1 example", skipped=True)) is model
    assert apply_stated_example_choice(model, said("Generate 3 examples for me")) is model
