"""Live check of the adaptive interview against the running local backend and real OpenRouter.

Not collected by pytest (no test_ prefix). Run with the backend started:
    ..\\.venv\\Scripts\\python.exe tests\\live_adaptive_check.py
Spends a small amount of OpenRouter credit. Prints no secrets.
"""

import json
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
TOKEN = (ROOT / ".backend-token").read_text(encoding="utf-8").strip()
BASE = "http://127.0.0.1:8000/api"

SCENARIOS = [
    {
        "name": "classification task (expect example-based prompting)",
        "input": "I need a prompt that sorts our customer support emails into billing, bug report or "
        "feature request, and gives a one line reason for each label.",
    },
    {
        "name": "multi-step reasoning task (expect chain-of-thought)",
        "input": "Make a prompt that helps me solve tricky probability puzzles for my statistics exam "
        "and explains how to get the answer.",
    },
]


def strategy_line(prompting: dict) -> str:
    return (
        f"{prompting['examples']} ({prompting.get('example_count')} x {prompting.get('example_source')}), "
        f"reasoning={prompting['reasoning']}, techniques={prompting.get('techniques')}"
    )


def pick_answer(question: dict) -> str:
    """Behave like a user: prefer generated examples / worked steps when offered, else option 1."""
    for choice in question["choices"]:
        lowered = choice.lower()
        if "generat" in lowered or "illustrative" in lowered or "step" in lowered:
            return choice
    return question["choices"][0] if question["choices"] else "Keep it general."


def run(client: httpx.Client, scenario: dict) -> dict:
    print(f"\n=== {scenario['name']} ===")
    analysis = (
        client.post(f"{BASE}/analyze", json={"input": scenario["input"]})
        .raise_for_status()
        .json()["analysis"]
    )
    methodology = analysis["methodology"]
    print("Initial strategy:", strategy_line(methodology["prompting"]))
    answers: list[dict] = []
    record = {"scenario": scenario["name"], "initial": methodology["prompting"], "questions": []}
    while True:
        result = (
            client.post(
                f"{BASE}/next-question",
                json={
                    "input": scenario["input"],
                    "analysis": analysis,
                    "methodology": methodology,
                    "answers": answers,
                },
            )
            .raise_for_status()
            .json()
        )
        methodology = result["methodology"]
        if result["done"]:
            print(f"Interview done after {len(answers)} question(s): {result['reason']}")
            break
        question = result["question"]
        answer = pick_answer(question)
        print(f"Q{len(answers) + 1}: {question['question']}")
        print(f"    options: {question['choices']}")
        print(f"    answer:  {answer}")
        assert 2 <= len(question["choices"]) <= 4, "questions must be multiple choice"
        assert question["id"] not in {a["question_id"] for a in answers}, "question IDs must be unique"
        record["questions"].append(
            {"question": question["question"], "choices": question["choices"], "answer": answer}
        )
        answers.append({"question_id": question["id"], "question": question["question"], "answer": answer})
    print("Final strategy:  ", strategy_line(methodology["prompting"]))
    checks: list[str] = []
    for item in answers:
        stated = re.search(r"\b(\d)\s+examples?\b", item["answer"].lower())
        if stated:
            expected, actual = int(stated.group(1)), methodology["prompting"]["example_count"]
            checks.append(
                f"explicit '{item['answer']}' -> example_count {actual}: "
                + ('OK' if actual == expected else 'MISMATCH')
            )
    generated = (
        client.post(
            f"{BASE}/generate",
            json={
                "input": scenario["input"],
                "analysis": analysis,
                "methodology": methodology,
                "answers": answers,
            },
        )
        .raise_for_status()
        .json()
    )
    print("--- generated prompt (first 1200 chars) ---")
    print(generated["prompt"][:1200])
    if methodology["prompting"]["example_source"] == "illustrative":
        labelled = "Illustrative examples (generated" in generated["prompt"]
        checks.append(f"illustrative examples labelled as generated: {'OK' if labelled else 'MISSING'}")
    for check in checks:
        print("CHECK", check)
    record.update(
        final=methodology["prompting"],
        prompt=generated["prompt"],
        assumptions=generated["assumptions"],
        checks=checks,
    )
    return record


def main() -> int:
    headers = {"Authorization": f"Bearer {TOKEN}"}
    with httpx.Client(headers=headers, timeout=120) as client:
        results = [run(client, scenario) for scenario in SCENARIOS]
    out = ROOT / "docs" / "live-adaptive-check.json"
    out.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
