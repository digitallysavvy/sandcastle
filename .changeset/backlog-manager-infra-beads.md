---
"@ai-hero/sandcastle": patch
---

Add backlog manager selection to `sandcastle init` (GitHub Issues or Beads). Templates use placeholders (`{{LIST_TASKS_COMMAND}}`, `{{VIEW_TASK_COMMAND}}`, `{{CLOSE_TASK_COMMAND}}`) that are replaced at scaffold time with the correct commands for the chosen backlog manager. The simple-loop template's list command is upgraded to include labels and comments. Selecting Beads skips the "Create Sandcastle label" step.
