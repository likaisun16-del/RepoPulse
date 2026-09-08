# Agent Operating Rules

## Long-running collection tasks

- After starting a long-running collection, build, sync, or migration task, report only startup, meaningful milestone progress, completion, or failure.
- Do not poll the task continuously or call the model repeatedly while waiting.
- Use a progress check interval of at least 5 minutes unless the user explicitly requests closer monitoring.
- Do not repeat unchanged status updates.
- Prefer tasks with explicit timeout, cancellation, retry, and failure states.
- At completion, cancellation, or failure, perform one final status check and report the result.
