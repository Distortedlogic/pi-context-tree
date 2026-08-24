# User-Driven Task Pipeline Work Outline

## 1. Goal

Build two connected pipelines from these three forks:

- `rpiv-todo` owns a user-visible Markdown work plan.
- `pi-true-queue` sends one approved task batch at a time.
- `pi-context-tree` compresses the completed batch work after user review.

The agent must not receive the full future task list during execution. The user must control plan approval, batch completion, and range compression.

## 2. Flow seen in the `gabb-dd` sessions

The design must keep the useful parts of the proven manual flow.

### Plan creation session

Source session:

- `2026-08-24T00-47-30-222Z_01a0313c-99ae-708c-a540-1bdda06161ea.jsonl`

Observed flow:

1. The user asked for one full read pass of the dashboard files.
2. The user asked for one full read pass of the service source files.
3. The agent used the loaded context to answer design questions without more tool calls.
4. The user corrected scope and design errors.
5. The agent wrote `ADMIN_API_TELEMETRY_IMPLEMENTATION_PLAN.md`.
6. The user removed no-op work such as “confirm” and “get approval” tasks.
7. The user asked for targeted edits to the Markdown file.
8. The user repeatedly reviewed the file and asked for corrections.
9. The final file contained ordered `##` task batches with nested checkboxes.

### Execution session

Source session:

- `2026-08-24T03-18-10-675Z_01a031c6-8bf3-7da0-909a-33b0c5554f53.jsonl`

Observed flow:

1. The user started a clean session.
2. The user repeated one full source read pass to preload code context.
3. The user sent one `##` task batch at a time.
4. The user gave steering messages while the current batch was active.
5. The user required one commit per batch.
6. The user stopped scope growth and corrected failed work.
7. The next batch did not enter the agent context until the current batch was accepted.

The extensions must automate the handoff. They must not remove these user gates.

## 3. Fixed design decisions

### Extension duties

#### `rpiv-todo`

- Own the Markdown plan file.
- Parse, validate, load, watch, and write the plan.
- Show all batches and states only in user UI.
- Remove the `todo` agent tool and all related prompt guidance.
- Supply one requested batch to `pi-true-queue` through `pi.events`.
- Mark a batch complete only after reviewed compression succeeds.

#### `pi-true-queue`

- Own the execution run state.
- Send only the current batch to the agent.
- Keep future batch bodies out of model messages.
- Record the session boundary for the current batch.
- Stop at a user review gate after Pi is fully settled.
- Ask `rpiv-todo` for the next batch only after completion succeeds.

#### `pi-context-tree`

- Own all range selection, summary drafting, review, apply, and undo behavior.
- Keep normal `/compress` behavior.
- Add a queue-aware `/compress --batch` mode.
- Use the queue boundary to preselect the exact execution range.
- Require the user to start the command and approve the summary.
- Keep all changes append-only and recoverable.

### Pi API rule

Pi `0.84.2` gives tree navigation only to a user-started command context. A normal `agent_end` or `agent_settled` handler cannot call `navigateTree()`.

Therefore, batch compression must not run unattended. The user runs:

```text
/compress --batch
```

This command gets a command context inside `pi-context-tree`. After successful compression, it emits a completion event. The queue then marks the Markdown batch complete and sends the next batch.

### Context rule

Keep these entries in active context:

- The execution-session preload pass.
- The exact user message for each completed task batch.
- The reviewed summary for each completed task batch.
- The one current task batch.

Compress this range:

- Start at the first assistant entry after the current queued task message.
- Include all assistant text, tool calls, tool results, and later steering turns for that batch.
- End at the last settled entry for the batch.

This rule keeps the exact task requirements. It removes the large execution transcript.

## 4. Markdown plan contract

Use a maintained Markdown parser. Do not write a custom Markdown parser.

Recommended packages:

- `unified`
- `remark-parse`
- `remark-gfm`
- `remark-stringify`
- `chokidar` for file change events
- `write-file-atomic` for safe writes

### File shape

```markdown
# Work Plan Title

<!-- pi-work-plan:v1 approved-sha256=<digest> -->

Plan-wide rules can be here. The queue sends this preamble with each batch.

## 1. First batch

- [ ] First required change.
- [ ] Second required change.
  - [ ] Nested acceptance check.

## 2. Second batch

- [ ] Next required change.
```

### Parsing rules

- Require one level-one title.
- Treat each level-two heading as one queue batch.
- Require at least one GFM checkbox in each batch.
- Keep level-three and deeper headings inside their level-two batch.
- Keep document order as execution order.
- Send the complete current level-two section as the task body.
- Do not send later level-two sections.
- Treat `[x]` and `[X]` as complete.
- Treat a section as complete only when all its checkboxes are complete.
- Allow a partially checked section. It stays pending.
- Reject duplicate normalized batch identities.

### Stable approval

- Compute a structure digest from the title, preamble, headings, task text, and order.
- Exclude the approval comment from the digest.
- Normalize checkbox marks before digest calculation. Status writes must not invalidate approval.
- `/todos approve` writes or updates the approval comment.
- Any text or order change makes the approval stale.
- The queue must stop if the approved structure changes during a run.

### File writes

- Use source positions from the Markdown AST to change only checkbox marks.
- Do not reformat the full file for a status-only change.
- Check the expected structure digest before each write.
- Use an atomic file write.
- Reload the file after each write and verify the result.
- Pause the run on a conflict or invalid file.

## 5. Pipeline A: create and approve a task list

### User flow

1. Start a clean planning session.
2. Ask for one full read pass of each required code scope.
3. Tell the agent to halt after the preload pass.
4. Ask design questions and steer the result.
5. Tell the agent to write the technical task list to one Markdown file.
6. Run `/todos load <path>`.
7. Review the file outside the agent chat.
8. Ask the agent for targeted edits to that file.
9. Let the todo watcher reload and validate each change.
10. Run `/todos validate` until the file is valid.
11. Run `/todos approve` when the plan is final.
12. Start a clean execution session.

### Todo commands

```text
/todos                         Show the current user-only plan view.
/todos load <path>             Bind and load a Markdown plan.
/todos reload                  Reload the bound plan.
/todos validate                Show format and approval errors.
/todos approve                 Write the current structure digest.
/todos dump [path]             Write the current plan state to Markdown.
/todos unload                  Remove the current binding.
```

The command output must use UI notifications or overlays. It must not send the full plan as an agent message.

## 6. Pipeline B: execute the approved task list

### User flow

1. Start a clean execution session.
2. Repeat the single full source read pass.
3. Let the agent halt with the code context loaded.
4. Run `/queue start <plan-path>`.
5. Confirm the plan title, digest, and pending batch count.
6. The queue sends only the first pending batch.
7. Steer the current batch until it is acceptable.
8. When Pi is fully settled, review the queue status.
9. Run `/compress --batch`.
10. Review and edit the proposed execution summary.
11. Save the summary to approve it, or cancel to keep the batch active.
12. After a successful apply, the todo extension checks the batch in the Markdown file.
13. The queue sends the next pending batch.
14. Repeat until the plan is complete.

### Queue commands in plan mode

```text
/queue start <path>            Start an approved plan run.
/queue status                  Show the current run and phase.
/queue pause                   Stop automatic dispatch.
/queue resume                  Retry the current safe transition.
/queue abort                   End the run without changing pending tasks.
/queue recover                 Reconcile file state and session markers.
```

`/queue done` must not bypass reviewed compression in plan mode. It can keep its current behavior in standalone queue mode.

### Queue prompt shape

Send only:

- A short fixed rule that says this is the only current batch.
- The shared plan preamble.
- The exact current level-two section.

Do not send:

- The plan path.
- Future headings.
- Future task text.
- The full plan manifest.
- A list of remaining tasks.

## 7. Queue run state

Add a separate plan-run state. Keep standalone queue state compatible.

Suggested phases:

```text
idle
running
awaiting_review
compressing
compressed_pending_plan_write
ready_for_next
paused
complete
```

Persist these fields with a versioned custom session entry:

- Run ID.
- Canonical plan path.
- Approved structure digest.
- Current batch ID.
- Current batch ordinal.
- Entry ID before the queued task message.
- Last settled entry ID.
- Current phase.
- Last compression operation ID.
- Pause reason.

Do not persist future batch bodies in queue state. Fetch one body from `rpiv-todo` when it becomes current.

Use Pi `agent_settled`, not the current one-second `agent_end` timer, for the review boundary. `agent_settled` means that retries, automatic compaction, and follow-up messages are complete.

## 8. Inter-extension protocol

Use the native `pi.events` bus. Do not use `globalThis`, a shared mutable global, slash-command text dispatch, or direct imports between the three packages.

Use versioned channels and TypeBox payload validation.

Suggested channels:

```text
rpiv-todo:plan:v1:request
rpiv-todo:plan:v1:response
pi-true-queue:batch:v1:request
pi-true-queue:batch:v1:response
pi-context-tree:batch:v1:lifecycle
pi-work-pipeline:v1:probe
pi-work-pipeline:v1:capability
```

Every request must include a random request ID. Every response must include the same ID.

### Todo operations

- Load and validate a plan.
- Return a manifest without batch bodies.
- Return one batch body by ID and expected digest.
- Mark one batch in progress for UI display.
- Mark one batch complete.
- Reopen one batch after undo.
- Report a plan conflict.

### Queue boundary operations

`/compress --batch` asks the queue for:

- Run ID.
- Batch ID.
- Entry ID before the task message.
- Last settled entry ID.
- Expected run phase.

The context extension must reject the request if:

- There is no active plan run.
- The queue is not at `awaiting_review`.
- The anchor is not on the active path.
- The end entry is not on the active path.
- A required tool-call group is incomplete.
- The session changed during preview or review.

### Compression lifecycle events

Emit these states:

- `started`
- `cancelled`
- `applied`
- `failed`
- `undone`

Include the run ID, batch ID, operation ID, and source hash.

## 9. Work in `rpiv-todo`

1. Remove `registerTodoTool(pi)` from `packages/rpiv-todo/index.ts`.
2. Remove the agent-facing schema, execution path, response envelope, renderers, and prompt guidance.
3. Keep `/todos` and the overlay as user-only surfaces.
4. Replace tool-result replay with file-backed plan loading.
5. Persist only the bound path and approval state when session persistence is useful.
6. Add the Markdown AST parser and plan validator.
7. Add targeted checkbox status writes.
8. Add file watch and conflict handling.
9. Add the event-bus plan service.
10. Update the overlay to show batch state and the current run phase.
11. Keep foreground and child-session UI isolation.
12. Update README, configuration, and tool-reference documents so they no longer claim that an agent tool exists.
13. Update existing todo test files. Do not add a new test file.

## 10. Work in `pi-context-tree`

1. First decide the order of the existing native-Pi refactor and this pipeline work.
2. Do not mix the full native-tree refactor into the pipeline commits.
3. Align the extension with the installed Pi `0.84.2` command and event APIs.
4. Add a core planner that selects from the first assistant group after a queue anchor through the settled end entry.
5. Reuse the existing atomic tool-call grouping and `planRange()` logic.
6. Add `--batch` argument handling to `/compress`.
7. Show the exact range size and boundaries before summary drafting.
8. Keep the summary editor as a required approval gate.
9. Add default batch-summary instructions that preserve:
   - Files changed.
   - Important implementation decisions.
   - Exact commands and test results.
   - Failures and unresolved work.
   - Commit hashes.
10. Add optional workflow metadata to `ctree/range-tail` and `ctree/range-compact` v1 data.
11. Emit lifecycle events after cancel, failure, apply, and undo.
12. Keep normal `/compress`, `/undo`, recovery, and append-only behavior compatible.
13. Update existing core, extension, undo, golden, and TUI tests. Do not add a new test file.

## 11. Work in `pi-true-queue`

1. Keep standalone `+task` queue behavior separate from plan-run behavior.
2. Add the plan-run state machine.
3. Add capability checks for `rpiv-todo` and `pi-context-tree`.
4. Add `/queue start <path>` and plan-run commands.
5. Fetch only a manifest at start.
6. Fetch only the current batch body before dispatch.
7. Record the pre-task anchor before `sendUserMessage()`.
8. Use `agent_settled` to record the end boundary and enter `awaiting_review`.
9. Do not advance because the agent stopped.
10. Advance only after an `applied` compression event and a successful Markdown write.
11. Pause on timeout, missing extension, stale digest, invalid range, cancelled review, file conflict, or failed write.
12. Make completion and event handling idempotent by operation ID.
13. Add recovery that scans queue state and workflow-tagged context-tree markers.
14. Disable `enqueue_task` during a plan run. Do not let the agent change the approved plan order.
15. Make the agent enqueue tool opt-in in this user-driven fork, or remove it if standalone agent enqueue is not needed.
16. Update the sequential-isolation skill so the current plan batch is treated as the only task.
17. Replace the hard-coded `ctrl+q` shortcut or make it configurable. `pi-context-tree` already uses `ctrl+q`.
18. Update README and command help.
19. This repository has no test suite. Use type checks and a real Pi smoke run. Do not add a new test suite as part of this work.

## 12. Agent visibility rule

Required checks:

- `todo` is absent from the active agent tool list.
- Todo prompt snippets and prompt guidelines are absent.
- Future batch bodies never enter `sendUserMessage()`.
- Todo and queue custom state entries stay outside model context.
- The queue does not include the plan path in the task prompt.
- A provider-request inspection shows only the preload context, completed batch prompts and summaries, and the current batch.

For practical file isolation:

- Keep the approved plan outside the execution worktree when possible.
- During an active plan run, block direct built-in `read`, `edit`, and `write` calls on the canonical plan path.
- Return a generic denial that does not reveal the path.

This is context isolation, not an operating-system security boundary. An agent with unrestricted `bash` under the same user can try to read any readable file. Hard file secrecy needs a separate sandbox or file permission boundary.

## 13. Failure and recovery rules

### Summary cancel or failure

- Keep the queue at `awaiting_review`.
- Keep the Markdown batch pending or in progress.
- Send no next batch.

### Compression succeeds but Markdown write fails

- Set `compressed_pending_plan_write`.
- Do not compress the same range again.
- Let `/queue resume` retry the idempotent plan write.

### Plan changes during execution

- Compare the approved structure digest.
- Pause before the next dispatch.
- Require a new user approval or a new run.

### Session restart

- Replay the latest queue run state.
- Reload the plan file by canonical path.
- Verify the approved digest.
- Scan active workflow-tagged range markers.
- Resume only when file state and session state agree.

### Undo

- Add run and batch metadata to pipeline-owned range markers.
- When `/undo` restores such a range, emit `undone`.
- Pause the queue.
- Reopen the matching Markdown batch.
- Clear any next-batch state that was moved off the active path.
- Require the user to resume the corrected batch.

### Missing extension or protocol mismatch

- Fail closed.
- Show the missing package or supported protocol version.
- Do not fall back to broad Pi `/compact`.
- Do not send the next batch.

## 14. Version and repository preparation

1. Resolve the current dirty `pi-context-tree` worktree separately. Do not stage its deleted or untracked files by accident.
2. Decide whether `IDIOMATIC_NATIVE_PI_REFACTOR_TASK_LIST.md` lands before this work.
3. Rebase or update all three `queue-todos-compress-loop` branches.
4. Test against the installed Pi `0.84.2`.
5. Align TypeBox with Pi `0.84.2`, which uses `typebox` `1.3.7`.
6. Verify source install and fork install for each extension.
7. Load all three forks together and resolve command and shortcut collisions before feature work.

Current version gap:

- Installed Pi: `0.84.2`.
- `pi-context-tree` is documented against `0.79.1`.
- `rpiv-mono` uses Pi `0.80.6` in root development dependencies.
- `pi-true-queue` uses wildcard peer dependencies.

## 15. Existing-test update plan

### `rpiv-todo`

Update existing files for:

- No agent tool registration.
- Markdown load and validation.
- Approval digest behavior.
- Targeted status writes.
- File conflict behavior.
- User-only command output.
- Session and overlay isolation.
- Event-bus request and response behavior.

### `pi-context-tree`

Update existing files for:

- Queue-anchor range planning.
- Opening task-message retention.
- Tool-call group safety.
- Batch command cancellation.
- Source-leaf revalidation.
- Workflow metadata.
- Lifecycle events.
- Undo notification.
- Byte-preserved original entries.

### `pi-true-queue`

Use:

- TypeScript checking against Pi `0.84.2`.
- A local three-extension TUI smoke run.
- Session JSONL inspection.
- Provider-request inspection for future-task leakage.

Do not add a test suite to this repository in this change.

## 16. End-to-end acceptance run

Use a small plan with three batches and one nested checklist.

1. Create the plan in a planning session.
2. Load, edit, validate, and approve it.
3. Start a clean execution session.
4. Preload source files once.
5. Start the queue run.
6. Confirm that the first provider request has no batch 2 or batch 3 text.
7. Run batch 1 with at least one tool call.
8. Add one user steering turn.
9. Confirm that `agent_settled` stops at review.
10. Cancel `/compress --batch` once and confirm no state advances.
11. Run it again and approve the summary.
12. Confirm that:
    - The batch 1 user task message remains in context.
    - Raw batch 1 assistant and tool entries are off the active path.
    - The reviewed batch 1 summary is in context.
    - The preload context is still active.
    - Batch 1 checkboxes are complete in the Markdown file.
    - Only batch 2 is sent next.
13. Force one Markdown conflict and confirm fail-closed behavior.
14. Recover and complete batch 2.
15. Undo batch 2 compression and confirm queue and Markdown rollback.
16. Resume and complete all batches.
17. Restart Pi during one run and confirm recovery.
18. Confirm that the final plan is checked, the queue is empty, and all original transcripts remain recoverable.

## 17. Work order

Use this order to keep each fork independently usable:

1. Prepare versions, branches, installs, and shortcut bindings.
2. Implement the file-backed, user-only todo plan provider.
3. Implement queue-aware range planning and `/compress --batch`.
4. Implement the queue plan-run state machine and event clients.
5. Add undo and restart reconciliation.
6. Run existing repository checks.
7. Run the three-extension acceptance flow.
8. Update all user documents and installation steps.

## 18. Work that is not in the first version

- Automatic judgment that code work is complete.
- Automatic plan approval.
- Automatic git worktree, commit, deploy, or merge-request work.
- Parallel batch execution.
- Agent-created or agent-reordered plan tasks during execution.
- Broad automatic Pi `/compact` calls.
- A hard file-security boundary against unrestricted shell access.
- The full native Pi tree refactor, unless it is selected as a prerequisite.

The first version must reproduce the proven user flow with less manual copying. It must keep the user review points and hide future work from the agent.
