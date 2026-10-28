# Review: women’s nightwear e-commerce planning prompt

The supplied prompt is a useful brief for a **plan**, not an instruction to implement a working store. It identifies the audience and six relevant areas, but leaves practical constraints and acceptance criteria open. The original spoken request and clarification answers were not supplied for this review, so preservation of that original intent cannot be verified. Payment options, inventory and user accounts appear in the generated brief; confirm these are actually wanted rather than treating their appearance as proof of user approval.

## Appropriate strategy

| Dimension | Recommendation | Reason |
|---|---|---|
| Example count | Zero-shot: no demonstrations | This is open-ended planning, not a task that needs a demonstrated transformation or exact brand-writing pattern. |
| Reasoning | Decompose and verify | Website scope, brand, marketing, phases and risks need a coherent structure and cross-checks. Request concise rationale and validation, not hidden reasoning traces. |
| Execution | Single structured planning response | Roadmap phases describe the future project. They are not an autonomous tool loop performed while writing the plan. |
| Optional references | One approved example for a precise brand voice; several for varied product-copy patterns | Use only if reference style or formatting is important and examples are available. |
| If the actual goal is a working store | A bounded implementation/test/fix workflow in a tool-enabled environment | State observable success checks, a cycle limit, tool requirements and honest failure/stop conditions. A normal chat cannot gain execution tools from the prompt wording. |

One-shot means **one demonstration**, not “do everything in one reply.” Few-shot, reasoning and execution mode are independent dimensions and can be combined. Start with the simplest adequate approach and evaluate the result. [Google prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies), [Anthropic workflow guidance](https://www.anthropic.com/research/building-effective-agents).

## Main quality gaps

- Geography, currency, budget and customer segment are unspecified. A plan can present conditional alternatives, but must not silently invent these facts.
- There is no MVP boundary or prioritization of must-have features versus later improvements.
- “Comprehensive,” “user-friendly” and “complying with regulations” do not define observable acceptance criteria. Compliance depends on jurisdiction and implementation; it cannot be certified by a planning prompt.
- Branding and social marketing can become generic unless recommendations are tied to a stated segment, positioning and measurable experiments.
- The prompt does not specify the final document structure, how estimates should be qualified, or how unresolved decisions should be surfaced.
- The planner should propose suitable roadmap phases; it is unnecessary to demand that the user already know the number of phases.

## Copy-ready revision for the planning goal

```text
Act as an e-commerce product and launch-planning consultant.

Create an actionable development, brand-building and social-media marketing plan for an e-commerce website selling women’s nightwear. The requested deliverable is a planning document.

Preserve this scope:
- Website planning must address payment options, inventory management and user accounts.
- Develop brand-positioning and identity recommendations for the intended customers.
- Use social media as the primary marketing channel.
- Propose phased delivery with opportunities for feedback and adjustment.
- Address usability, relevant compliance considerations and business risks, including overspending and competition.

Do not invent a country, currency, budget, timeline, customer age group, technology stack, market statistic or approved brand decision. Begin by identifying material missing information. Ask at most three questions if answers are essential. If answers are unavailable, provide conditional recommendations and clearly label unresolved decisions rather than presenting assumptions as facts.

Organize the plan into:
1. Objective and scope: distinguish confirmed requirements, proposed recommendations and open decisions.
2. Website requirements: prioritize MVP and later features, explain the customer journey, dependencies and practical acceptance checks. Explain options and tradeoffs before choosing payment or platform providers.
3. Brand strategy: recommend positioning, tone and visual direction with a short rationale. Label creative ideas as proposals.
4. Social-media plan: recommend channels, content themes, promotion experiments and measures of engagement and conversion. Tie spending to the supplied budget; otherwise describe alternatives without fabricated projections.
5. Delivery roadmap: propose suitable phases with deliverables, dependencies, feedback points and exit criteria. Label timelines and cost ranges as estimates, and explain what information they depend on.
6. UX and compliance considerations: address mobile navigation, product information, checkout usability and accessibility. Identify the jurisdiction-dependent privacy, consumer and e-commerce questions to verify. Do not claim legal compliance without evidence; cite current official sources if browsing is available, otherwise mark the checks as unverified.
7. Risk register: for each material risk, describe likelihood/impact, a warning signal and a practical mitigation. Include overspending and competition.
8. Immediate next decisions and actions.

Use concise tables where they improve comparison. Work through dependencies privately and present the resulting recommendations with brief rationale. Before finishing, check that all confirmed requirements are covered, recommendations are consistent with the stated resources, unresolved inputs are visible, and no unsupported facts or guarantees were added. Report the outcome of this check briefly.
```

## If the goal changes from planning to implementation

Replace the objective with an explicit request to implement the agreed MVP in a named workspace and specify the actual available tools. Include an instruction such as:

```text
If file editing, a runtime and browser/testing tools are available, implement the agreed MVP, run the relevant checks and fix failures for at most three build–test–fix cycles. Stop when the agreed acceptance checks pass, the cycle limit is reached, or a repeated blocker/user decision prevents progress. Report actual test results and remaining failures; never claim an unrun test passed. Do not deploy or activate real payment processing without explicit authorization. If those tools are unavailable, provide the implementation and reproducible validation commands and identify what was not executed.
```

This changes the deliverable and must reflect the user’s actual intention. It is not necessary for the current planning request.

## Validation performed

The application’s separate review call recommended zero-shot, decompose-and-verify and a single planning response for this brief. Live comparison cases selected direct zero-shot for a one-sentence summary, two-example few-shot for a demonstrated JSON extraction, and bounded iteration for a tool-enabled implementation task with an unsafe infinite-loop prompt. The checker flagged infinite looping, fabricated test passes and unauthorized deployment in that last case. See `prompt-quality-evaluation.json`.

The first evaluation also exposed a schema-normalization defect that removed real fields named `examples`; that defect was fixed and regression-tested. Shot labels are now derived from the explicit demonstration count to avoid confusing “one response” with one-shot prompting. Model review remains advisory; downstream task execution and user acceptance are separate checks.

The revised candidate also received a separate live review (`nightwear-revised-validation.json`). That model requested more budget/context despite the explicit fallback for unresolved inputs; this is a reviewer limitation, not proof that the fallback is absent. The manual assessment is that the prompt supports a conditional plan, while a tailored commercial plan still benefits from actual country, currency, budget and customer details. Automated review results must be checked against the text.
