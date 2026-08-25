# User-Driven Task Pipeline Work Outline

## 1. Goal

Build two connected pipelines from these three forks:

- `rpiv-todo` owns a user-visible Markdown work plan.
- `pi-true-queue` sends one approved task batch at a time.
- `pi-context-tree` compresses the completed batch work after user review.

The agent must not receive the full future task list during execution. The agent creates the Markdown plan directly. Starting execution accepts its current content. Events control batch handoff and compression. The user reviews each compression summary.

## 2. Fixed design decisions

### Extension duties

#### `rpiv-todo`

- Detect the Markdown plan that the agent creates.
- Derive its filename from its level-one heading.
- Parse, validate, bind, watch, and update the plan automatically.
- Keep the Markdown file as the only task-content source.
- Show all batches and states only in user UI.
- Remove the `todo` agent tool and all related prompt guidance.
- Supply only the current batch to `pi-true-queue` through `pi.events`.
- Mark a batch complete only after reviewed compression succeeds.
- Provide `/todos dump` only as a user triage action.

#### `pi-true-queue`

- Own the execution run state.
- Send only the current batch to the agent.
- Keep future batch bodies out of model messages.
- Record the session boundary for the current batch.
- Stop at a user review gate after Pi is fully settled.
- Ask `rpiv-todo` for the next batch only after completion succeeds.

#### `pi-context-tree`

- Own all range selection, summary drafting, review, apply, and undo behavior.
- Keep `/compress` as the user slash command.
- Put range compression in one substantive service that the slash command and event path both call.
- Accept an event request from the queue for pipeline compression.
- Use the queue boundary to preselect the exact execution range.
- Require the user to approve the summary before apply.
- Keep all changes append-only and recoverable.

### Pi API and event rule

The pipeline must call compression through events. It must not dispatch slash-command text.

When `agent_settled` fires, the queue freezes the completed batch boundary and emits a compression request. `pi-context-tree` calls the shared compression service for that range. The queue waits for the final compression result and does not send the next batch during this work.

The normal `/compress` slash command stays available for direct user use. It calls the same service through its user-command path.

Pi `0.84.2` gives `navigateTree()` only to a user-started command context. A normal `agent_settled` handler does not receive this method. The implementation must resolve this API gap with a public event-safe Pi session mutation capability before event-driven apply is complete. Do not use a private Pi import, slash-command text dispatch, or broad Pi `/compact` as a fallback.

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

## 3. Markdown plan contract

Use this implementation stack:

- Use `remark` with `remark-gfm` for Markdown parse, AST positions, and Markdown output.
- Use the existing `typebox` dependency for plan and event payload schemas.
- Use Pi's native `pi.events` bus for extension communication.
- Use `node:fs/promises` for file reads and `node:fs.watch` for change events.
- Use `write-file-atomic` for checkbox and emergency dump writes.

Do not add another Markdown parser, file watcher, event bus, state framework, or orchestration package. Do not write custom parsing, schema validation, file watching, event transport, or atomic-write code.

### File shape

```markdown
# Work Plan Title

Plan-wide rules go here. The queue sends this preamble with each batch.

## 1. First batch

- [ ] First required change.
- [ ] Second required change.
  - [ ] Nested acceptance check.

## 2. Second batch

- [ ] Next required change.
```

The agent writes this file directly in the current project directory. `# Work Plan Title` maps to `Work_Plan_Title.md`.

### Parsing and filename rules

- Require one level-one title.
- Trim the title.
- Replace each whitespace run with `_`.
- Remove characters other than letters, numbers, `_`, and `-`.
- Collapse repeated `_` characters.
- Append `.md` and use the current project directory.
- Move a newly detected valid plan to this canonical filename when necessary.
- Stop on a destination filename collision.
- Treat each level-two heading as one queue batch.
- Require at least one GFM checkbox in each batch.
- Keep level-three and deeper headings inside their level-two batch.
- Keep document order as execution order.
- Send the complete current level-two section as the task body.
- Do not send later level-two sections.
- Treat `[x]` and `[X]` as complete.
- Treat a section as complete only when all its checkboxes are complete.
- Keep a partially checked section pending.
- Reject duplicate normalized batch identities.
- Permit only one incomplete canonical plan in a project.
- On session start, bind the one incomplete canonical plan automatically.
- Stop `/queue run` when there is no incomplete plan or more than one incomplete plan.

### Execution snapshot

- Starting `/queue run` accepts the current plan content.
- Compute the structure digest at that time.
- Include the title, preamble, headings, task text, and order.
- Normalize checkbox marks before digest calculation. Status writes must not change the digest.
- Keep the digest in internal run state. Do not add approval metadata to the Markdown file.
- Pause before another batch when plan text or order changes during execution.

### File writes

- Use source positions from the Markdown AST to change only checkbox marks.
- Do not reformat the full file for a status-only change.
- Check the expected structure digest before each write.
- Use an atomic file write.
- Reload the file after each write and verify the result.
- Pause the run on a conflict or invalid file.

## 4. Pipeline A: create the task list

### Happy path

1. Start a clean planning session.
2. Ask for one full read pass of each required code scope.
3. Tell the agent to halt after the preload pass.
4. Ask design questions and steer the result.
5. Tell the agent to write the technical task list directly to Markdown.
6. The agent uses the sanitized level-one heading as the filename.
7. `rpiv-todo` detects the successful Markdown write.
8. `rpiv-todo` validates, canonically names, and binds the plan.
9. Review the file outside the agent chat.
10. Ask the agent for targeted edits to the same file.
11. `rpiv-todo` reloads and validates each saved edit automatically.
12. Start a clean execution session when the plan is ready.

There is no load, reload, validate, approve, path-selection, or unload command in the happy path.

### Triage action

```text
/todos dump                    Flush current state to the bound H1-derived file and show its path.
```

`/todos dump` takes no path. It does not change queue phase, current batch, compression, or next-batch dispatch. It is not part of normal execution. Existing standalone `/todos` display behavior stays unchanged.

## 5. Pipeline B: execute the task list

### Happy path

1. Start a clean execution session.
2. Repeat the single full source read pass.
3. Let the agent halt with the code context loaded.
4. Run `/queue run` with no arguments. This is the signal that preload is complete.
5. `rpiv-todo` binds the one incomplete canonical plan in the project.
6. The queue captures its structure digest and sends only its first incomplete batch.
7. Steer the current batch when needed.
8. When Pi is fully settled, the queue freezes the batch boundary.
9. The queue emits a compression request before it sends another batch.
10. `pi-context-tree` calls the shared compression service for the completed batch range.
11. Review and edit the proposed execution summary.
12. Save the summary to approve it, or cancel to keep the current batch active.
13. After successful apply, `rpiv-todo` checks the completed batch in the same Markdown file.
14. The queue sends the next incomplete batch automatically.
15. Repeat steps 7 through 14 until the plan is complete.

### Pipeline command

```text
/queue run                     Start or resume the automatically bound plan.
```

`/queue run` takes no plan path. File loading, validation, progress display, safe recovery, compression requests, and next-batch dispatch are programmatic. Do not add pipeline-specific status, pause, resume, abort, recover, done, or path-selection commands. Existing standalone queue commands stay unchanged outside plan mode.

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

## 6. Queue run state

Add only the state required for plan execution. Keep standalone queue state compatible.

```text
idle
running
compressing
paused
complete
```

Persist these fields with one versioned custom session entry:

- Run ID.
- Canonical plan path.
- Structure digest captured by `/queue run`.
- Current batch ID and ordinal.
- Entry ID before the queued task message.
- Last settled entry ID.
- Current phase.
- Last compression operation ID.
- Pause reason.

Do not persist future batch bodies. Fetch one body from `rpiv-todo` when it becomes current.

Use Pi `agent_settled`, not the current one-second `agent_end` timer, for the compression boundary. At this event, freeze the boundary, enter `compressing`, emit the compression request, and block next-batch dispatch. On session start, replay this state and reconcile it with the bound Markdown file and active context-tree marker automatically.

## 7. Inter-extension protocol

Use the native `pi.events` bus. Do not use `globalThis`, a shared mutable global, slash-command text dispatch, or direct imports between the three packages.

Use versioned channels and TypeBox payload validation.

Use only these channels:

```text
rpiv-todo:plan:v1:request
rpiv-todo:plan:v1:result
pi-context-tree:compress:v1:request
pi-context-tree:compress:v1:result
```

The queue is the coordinator. Every request includes a random operation ID. Every result includes the same ID. Todo results use closed success or failure states. Compression emits `accepted` before draft and review, then emits one terminal apply, cancel, or failure state. A missing todo result or compression acceptance before 5,000 ms pauses execution. Do not apply a timeout while the user reviews the summary. Do not add probe, capability, lifecycle, or queue-boundary channels.

### Todo operations

- Detect, canonically name, validate, and bind the plan.
- Return its title, structure digest, counts, and current batch identity without future batch bodies.
- Return one current batch body by ID and expected digest.
- Show the current batch in user UI.
- Mark one batch complete.
- Reopen one batch after undo.
- Dump the bound plan for user triage without changing queue state.
- Report a plan conflict.

### Queue boundary operations

When `agent_settled` fires, the queue emits a compression request with:

- Run ID.
- Batch ID.
- Entry ID before the task message.
- Last settled entry ID.
- Expected run phase.

The context extension must reject the request if:

- There is no active plan run.
- The queue is not at `compressing`.
- The anchor is not on the active path.
- The end entry is not on the active path.
- A required tool-call group is incomplete.
- The session changed during preview or review.

### Compression results

Return these states on `pi-context-tree:compress:v1:result`:

- `accepted`
- `cancelled`
- `applied`
- `failed`
- `undone`

Emit `accepted` synchronously before draft and review starts. Emit one terminal `cancelled`, `applied`, or `failed` result when the request finishes. Include the run ID, batch ID, operation ID, and source hash. Progress UI stays inside `pi-context-tree`; it does not need another event channel.

## 8. Work in `rpiv-todo`

1. Remove `registerTodoTool(pi)` from `packages/rpiv-todo/index.ts`.
2. Remove the agent-facing schema, execution path, response envelope, renderers, and prompt guidance.
3. Keep the existing `/todos` display and overlay as user-only surfaces.
4. Detect successful agent Markdown writes and project file changes.
5. Parse the level-one heading and enforce its canonical filename.
6. On session start, bind the one incomplete canonical plan in the project.
7. Reject zero or multiple incomplete plans when `/queue run` requests a plan.
8. Keep all task content and checkbox state only in the Markdown file.
9. Add the Remark AST plan validator and targeted checkbox writes.
10. Add the four-channel event-bus plan service operations.
11. Add `/todos dump` with no arguments. It flushes the bound file and shows its path without emitting a pipeline event or changing plan-run state.
12. Update the overlay from file and queue events automatically.
13. Keep foreground and child-session UI isolation.
14. Update README, configuration, and tool-reference documents so they no longer claim that an agent tool exists.
15. Update existing todo test files. Do not add a new test file.

## 9. Work in `pi-context-tree`

1. Complete and commit the existing native-Pi refactor before pipeline implementation starts.
2. Base the pipeline work on that clean refactor commit. Do not mix refactor changes into pipeline commits.
3. Align the extension with the installed Pi `0.84.2` command and event APIs.
4. Extract one substantive range-compression service from the current command flow.
5. Keep `/compress` and make it call this service through the user-command path.
6. Add a core planner that selects from the first assistant group after a queue anchor through the settled end entry.
7. Reuse the existing atomic tool-call grouping and `planRange()` logic.
8. Register an event handler that validates a queue request and calls the same service.
9. Resolve the event-context navigation API gap through a public Pi capability.
10. Show the exact range size and boundaries before summary drafting.
11. Keep the summary editor as a required approval gate.
12. Add default batch-summary instructions that preserve:
    - Files changed.
    - Important implementation decisions.
    - Exact commands and test results.
    - Failures and unresolved work.
    - Commit hashes.
13. Add required run ID, batch ID, operation ID, and source hash metadata to `ctree/range-tail` and `ctree/range-compact` v1 data.
14. Return a closed `cancelled`, `applied`, `failed`, or `undone` result on the compression result channel.
15. Keep normal `/compress`, `/undo`, recovery, and append-only behavior compatible.
16. Update existing core, extension, undo, golden, and TUI tests. Do not add a new test file.

## 10. Work in `pi-true-queue`

1. Keep standalone `+task` behavior unchanged outside plan mode.
2. Add `/queue run` with no arguments as the only pipeline command.
3. On `/queue run`, request the automatically bound plan and capture its structure digest.
4. Fetch only the current batch body before dispatch.
5. Record the pre-task anchor before `sendUserMessage()`.
6. Use `agent_settled` to freeze the end boundary and enter `compressing`.
7. Emit the compression request immediately after the boundary is frozen.
8. Block next-batch dispatch while compression or summary review is active.
9. After `applied`, ask `rpiv-todo` to check the batch and then fetch the next batch.
10. Pause on timeout, missing result, stale digest, invalid range, cancelled review, file conflict, or failed write.
11. Make each request and result idempotent by operation ID.
12. Reconcile queue state, plan state, and context-tree markers automatically on session start.
13. Reject `enqueue_task` while a plan run is active.
14. Update the sequential-isolation skill so the current plan batch is treated as the only task.
15. Change the queue shortcut from `ctrl+q` to `ctrl+shift+q`. Keep `ctrl+q` for `pi-context-tree`.
16. Update README and command help.
17. Use type checks and a real Pi smoke run. Do not add a new test suite to this repository.

## 11. Agent visibility rule

Required checks:

- `todo` is absent from the active agent tool list.
- Todo prompt snippets and prompt guidelines are absent.
- Future batch bodies never enter `sendUserMessage()`.
- Todo and queue custom state entries stay outside model context.
- The queue does not include the plan path in the task prompt.
- A provider-request inspection shows only the preload context, completed batch prompts and summaries, and the current batch.

This pipeline provides model-context isolation. It removes the todo tool, withholds the plan path, and never injects future batch content. Do not add file-tool interception or a filesystem sandbox to these extensions. Operating-system file security is outside this pipeline.

## 12. Failure and recovery rules

### Summary cancel or failure

- Keep the Markdown batch incomplete.
- Send no next batch.
- After cancellation, return the queue to `running` so the user can steer the same batch.
- On the next `agent_settled`, emit a new compression request automatically.
- If no more steering is needed, `/queue run` retries compression for the frozen range.
- Pause with the failure reason when compression cannot safely retry.

### Compression succeeds but the Markdown write fails

- Pause with the applied operation ID and pending checkbox write.
- Do not compress the same range again.
- `/queue run` retries only the idempotent checkbox write and next-batch transition.

### Plan changes during execution

- Compare the structure digest captured by `/queue run`.
- Pause before the next dispatch.
- After the user reviews the file, `/queue run` captures the new structure and resumes from its first incomplete batch.

### Session restart

- Replay the latest queue run state.
- Bind the canonical plan automatically.
- Verify the structure digest captured by `/queue run`.
- Scan active workflow-tagged range markers.
- Continue the next safe internal transition automatically when file and session state agree.
- Pause with one clear reason when they do not agree.

### Undo

- Add run and batch metadata to pipeline-owned range markers.
- When `/undo` restores such a range, return `undone`.
- Reopen the matching Markdown batch.
- Clear any next-batch state that moved off the active path.
- Make the restored batch current in `running` state.
- On its next `agent_settled`, restart compression automatically.

### Missing result or protocol mismatch

- Fail closed after the fixed request timeout.
- Show the missing extension or supported protocol version.
- Do not add a separate capability-probe flow.
- Do not fall back to broad Pi `/compact`.
- Do not send the next batch.

## 13. Version and repository preparation

1. Complete and commit `IDIOMATIC_NATIVE_PI_REFACTOR_TASK_LIST.md` separately.
2. Start pipeline implementation from a clean `pi-context-tree` worktree at that commit.
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

## 14. Existing-test update plan

### `rpiv-todo`

Update existing files for:

- No agent tool registration.
- Automatic plan detection and canonical naming.
- Markdown validation and session-start binding.
- Structure digest capture at `/queue run`.
- Targeted checkbox and dump writes.
- Zero-plan, multiple-plan, collision, and file-conflict behavior.
- User-only overlay and `/todos dump` output.
- Session and overlay isolation.
- Event-bus request and result behavior.

### `pi-context-tree`

Update existing files for:

- Queue-anchor range planning.
- Opening task-message retention.
- Tool-call group safety.
- Event-started compression cancellation.
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

## 15. End-to-end acceptance run

Use a small plan with three batches and one nested checklist.

1. Have the agent create a three-batch Markdown plan directly.
2. Confirm that the H1-derived filename is canonical and the plan binds automatically.
3. Have the agent edit the same file and confirm automatic reload.
4. Start a clean execution session.
5. Preload source files once.
6. Run `/queue run` with no arguments.
7. Confirm that the first provider request has no batch 2 or batch 3 text.
8. Run batch 1 with at least one tool call and one user steering turn.
9. Confirm that `agent_settled` freezes the range, emits compression, and blocks the next batch.
10. Cancel the event-started summary review once and confirm that the batch stays current.
11. Add one steering turn and confirm that the next `agent_settled` emits compression again.
12. Approve the summary.
13. Confirm that:
    - The batch 1 user task message remains in context.
    - Raw batch 1 assistant and tool entries are off the active path.
    - The reviewed batch 1 summary is in context.
    - The preload context is still active.
    - Batch 1 checkboxes are complete in the Markdown file.
    - Only batch 2 is sent next.
14. Force one Markdown conflict and confirm fail-closed behavior.
15. Review the file and use `/queue run` to continue batch 2.
16. Run `/todos dump` and confirm that the same canonical file is flushed while queue phase and current batch stay unchanged.
17. Complete batch 2.
18. Undo batch 2 compression and confirm automatic queue and Markdown rollback.
19. Complete all batches.
20. Restart Pi during one run and confirm automatic recovery.
21. Confirm that the final plan is checked, the queue is empty, and all original transcripts remain recoverable.

## 16. Work order

Use this order to keep each fork independently usable:

1. Prepare versions, branches, installs, and shortcut bindings.
2. Implement the file-backed, user-only todo plan provider.
3. Implement the event-callable compression service and keep the `/compress` user command.
4. Implement the queue plan-run state machine and event clients.
5. Add undo and restart reconciliation.
6. Run existing repository checks.
7. Run the three-extension acceptance flow.
8. Update all user documents and installation steps.

## 17. Work that is not in the first version

- Automatic judgment that code work is complete.
- Automatic git worktree, commit, deploy, or merge-request work.
- Parallel batch execution.
- Agent-created or agent-reordered plan tasks during execution.
- Broad automatic Pi `/compact` calls.
- A hard file-security boundary against unrestricted shell access.
- Native Pi tree changes beyond the completed prerequisite refactor.

The first version must automate batch handoff, keep the required user review points, and hide future work from the agent.
