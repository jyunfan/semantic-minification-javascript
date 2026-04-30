# Round 3 Experiment: Prompt-Defined Semantic Rewrites

## Goal

Use the rewrite policy in `PROMPT.md` as the specification for local semantic compression candidates, then compare:

```text
baseline = Terser(original)
candidate = Terser(prompt_defined_rewrite(original))
```

No API or LLM call is used in this round.

## Scope

Round 3 uses the same pinned real-world artifacts as Round 2.

## Prompt Policy

The implemented deterministic rules correspond to the safe transformations listed in `PROMPT.md`.

## Validation Status

This round verifies that candidates:

- can be minified by Terser,
- parse after minification.

Full upstream behavioral validation remains future work.

## Experiment Log

- Date: 2026-04-30.
- Command: `npm run experiment:round3`.
- Corpus: the same eleven pinned real-project artifacts as Round 2.
- Candidate generator: deterministic implementation of the safe rewrite policy written in `PROMPT.md`.
- Validator: Babel parseability after Terser minification.
- Selector: smallest raw Terser output among syntax-valid candidates.
- Prompt SHA-256: recorded in `results/round3.md`.

## Observations

- Round 3 reproduced the same aggregate output as Round 2: 140 raw bytes, 15 gzip bytes, and 118 Brotli bytes better than Terser across the full corpus.
- The prompt file provided a clearer contract for future LLM runs, but no actual model call was made in this round.
- The measured improvement remained effectively noise-level on production artifacts.

## Limitations

- The experiment tested prompt-derived deterministic rules, not model creativity.
- The same syntax-only validation limitation from Round 2 remained.
- The candidate generator still explored only whole-rule variants, not many small local alternatives.

## Next Action

Run an LLM-as-candidate-generator experiment: select small source windows, ask for shorter equivalent JavaScript, splice each response into the original artifact, run Terser, and accept only measured compressed-size wins.
