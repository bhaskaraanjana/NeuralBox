# NeuralBox RAG Demo Playbook

## Demo Goal
Show that NeuralBox can ground answers in local documents, detect conflicting source material, and avoid fabricating answers when context is missing.

## Demo Assets
Use files in:
- `C:\DEV\NeuralBox\demo\rag\docs\incident_response_playbook.txt`
- `C:\DEV\NeuralBox\demo\rag\docs\enterprise_data_policy.txt`
- `C:\DEV\NeuralBox\demo\rag\docs\product_roadmap_summary.txt`
- `C:\DEV\NeuralBox\demo\rag\docs\customer_success_faq.txt`

## Pre-Demo Setup (3-5 min)
1. Open NeuralBox:
   - **Live (preferred for demos):** [https://neuralbox.infinitemind.space/chat.html](https://neuralbox.infinitemind.space/chat.html)
   - **Local:** `npm run dev -- --port 5174` then open `http://localhost:5174` (or the HTTPS URL Vite prints)
2. Load model:
   - Preferred: `Qwen 3 - 4B`
   - Backup: `Qwen 3 - 1.7B`
3. Open `Settings -> Regular`
4. In `Local RAG`:
   - Click `Clear All`
   - Add all files from `demo/rag/docs`
5. Open `Settings -> Advanced` and enable:
   - `Workbench Panel`
   - `Trust Layer in Messages`

## Live Demo Flow (10 min)

### 1) Baseline Retrieval
Prompt:
`What is the escalation code for critical incidents and what is the first response target?`

Expected:
- Escalation code: `AURORA-7712`
- First response target: `10 minutes`

### 2) Cross-Document Synthesis
Prompt:
`Compare standard diagnostic log retention and enterprise audit log retention.`

Expected:
- Standard diagnostic logs: `30 days`
- Enterprise audit logs: `90 days`
- Model should clearly distinguish scope and may mention policy conflict by context.

### 3) Product Context Retrieval
Prompt:
`What is the internal demo codename and the public showcase date?`

Expected:
- Codename: `Blue Harbor`
- Showcase date: `2026-05-06`

### 4) Observability Proof
Action:
- Point to Workbench Panel entries showing `rag_retrieval`.
- Point to Trust Layer metadata showing non-zero RAG matches.

### 5) Hallucination Resistance Check
Prompt:
`What is the Tokyo office emergency hotline number?`

Expected:
- The model should say information is not in provided docs (or uncertain).
- It should not invent a phone number.

## Fast Backup Prompts
- `Which document contains ORBIT-990 and what is it used for?`
- `What is the feature freeze date for the Spring release?`
- `Which support channel handles demo prep issues?`

## Demo Script (Talk Track)
1. `All data stays local in the browser; no server-side indexing.`
2. `RAG is automatic once docs are indexed; no manual retrieval mode required.`
3. `NeuralBox can answer grounded questions, synthesize across docs, and surface ambiguity.`
4. `When context is missing, the model should avoid making up facts.`

## Pass/Fail Checklist
- [ ] Docs indexed successfully in RAG panel
- [ ] At least one response includes correct grounded facts
- [ ] Workbench shows `rag_retrieval`
- [ ] Conflict/scope distinction handled correctly
- [ ] Missing-info query does not produce fabricated specifics

## Troubleshooting
- If RAG seems weak:
  1. Rephrase prompt with exact doc terms (for example: `AURORA-7712`, `ORBIT-990`).
  2. Confirm RAG status shows docs/chunks indexed.
  3. Use a stronger model (`Qwen 3 - 4B` over smaller tiers).
  4. Remove noisy docs and keep only relevant ones for the demo.

