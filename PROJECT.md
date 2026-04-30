# LLM-Guided Semantic JavaScript Minification

## Abstract
This project explores a novel approach to JavaScript compression using Large Language Models (LLMs) to perform **semantic-preserving transformations** that reduce code size beyond traditional minification tools.

## Motivation
Traditional tools (e.g., Terser, Closure Compiler) perform syntax-level optimizations. They do not explore deeper semantic equivalence transformations.

## Novelty
- First attempt to apply LLMs for **semantic minification**
- Goes beyond token/AST compression → explores **program equivalence search**
- Integrates:
  - LLM rewriting
  - AST constraints
  - Differential execution testing

## Methodology

### Pipeline
1. Parse JS → AST
2. Chunk code
3. LLM generates shorter variants
4. Validate:
   - AST constraints
   - Execution equivalence (Node.js sandbox)
5. Select minimal version

### Objective Function
Minimize:
    Size(code') + λ * SemanticError(code, code')

## Baselines
- Terser
- UglifyJS
- Google Closure Compiler
- Brotli compression

## Evaluation
- Compression ratio (%)
- Runtime correctness (test pass rate)
- Latency (ms)

## Expected Contribution
- New paradigm: **AI-driven program compression**
- Benchmark dataset for semantic JS minification
- Hybrid compiler + LLM architecture

## Target Venues
- ASE Workshop
- ICSE Workshop
- Applied Sciences
