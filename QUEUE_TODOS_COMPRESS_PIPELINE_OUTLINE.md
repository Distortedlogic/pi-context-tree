# User-Driven Task Pipeline Work Outline

## 1. Goal

Build two connected pipelines from these three forks:

- `rpiv-todo` owns a persistent Markdown task plan under `.pi/tasks/`.
- `pi-true-queue` sends only the current task batch to the agent.
- `pi-context-tree` compresses the completed batch execution after user review.

The planning agent writes and refines the task plan under `.pi/tasks/`. The existing Git-sync extension persists that directory outside the project Git history. The user then starts a new execution session. Todo reads and updates the Markdown plan at defined pipeline boundaries. Future task titles and bodies never enter execution-agent context, queue state, event details, logs, errors, or session custom entries.

## 2. Fixed design decisions

### Extension duties

#### `rpiv-todo`

- Create and read task plans only under `.pi/tasks/`.
- Derive each plan filename from its level-one heading.
- Parse the plan on session start, `/queue run`, before batch dispatch, and before checkbox mutation.
- Keep Markdown as the execution source of truth.
- Remove the `todo` agent tool and all related prompt, permission, setup, workflow, and runtime references.
- Render the full plan only through user TUI surfaces.
- Return only the current batch through `pi.events`.
- Apply completion and undo as expected-revision atomic checkbox writes.

#### `pi-true-queue`

- Own execution run metadata without future task content.
- Request a fresh plan snapshot and current batch at each dispatch boundary.
- Send only the shared preamble and current batch to the agent.
- Freeze the current execution range on `agent_settled`.
- Request compression before the next batch.
- Dispatch the next batch only after compression and Markdown completion both succeed.

#### `pi-context-tree`

- Own range planning, summary drafting, review, append-only apply, and undo.
- Keep `/compress` as the direct user command.
- Use one substantive compression service for the slash-command and event paths.
- Keep the preload and exact queued task message outside the compressed range.
- Put file revision, structural revision, checkbox bitmap, run identity, batch identity, and operation identity in pipeline range markers.

### Pi API and event rule

The pipeline calls compression through events. It does not dispatch slash-command text.

Pi exposes one declarative `applySessionMutation()` operation with expected session ID, expected leaf ID, navigation target, navigation options, ordered custom messages, and ordered custom entries. The runner serializes the operation, rechecks session and leaf identity, navigates, and appends in order. It returns `applied`, `cancelled`, or `stale`. It does not expose a full command context to an event handler.

When `agent_settled` fires, Queue freezes the batch boundary and emits a compression request. Context Tree emits `accepted`, drafts and opens the review, then emits one terminal result. Queue blocks next-batch dispatch until the terminal result and Todo completion succeed.

### Context rule

Keep these entries in active context:

- The execution-session preload pass.
- The exact queued user message for each completed task batch.
- The reviewed summary for each completed task batch.
- The one current task batch.

Compress from the first assistant group after the queued task message through the complete atomic group that contains the last settled entry. Include later user steering turns inside that continuous range. Preserve tool-call groups, preload context, and the exact queued task message.

## 3. Markdown plan contract

Use this implementation stack:

- `remark@15.0.1` with `remark-gfm@4.0.1` for parsing and AST source positions.
- `typebox@1.3.7` for plan and event payload schemas.
- Pi `pi.events` for extension communication.
- `node:fs/promises` for `.pi/tasks/` directory and file operations.
- `write-file-atomic@8.0.0` for checkbox mutations.

Do not add a file watcher, another parser, another event bus, a state framework, or a custom global registry.

### File shape

```markdown
# Work Plan Title

Plan-wide rules go here. Queue sends this preamble with each batch.

## 1. First batch

- [ ] First required change.
- [ ] Second required change.
  - [ ] Nested acceptance check.

## 2. Second batch

- [ ] Next required change.
```

`# Work Plan Title` maps to `.pi/tasks/Work_Plan_Title.md`. Preserve H1 letter case.

### Planning write rules

- Create `.pi/tasks/` before the first task-plan write.
- Parse an agent planning `write` call that contains a valid task plan before execution.
- Replace its target path with `.pi/tasks/<H1-derived-filename>`.
- Require later plan edits to target the same canonical path.
- Do not rename a plan after writing.

### Parsing and identity rules

- Require exactly one H1 and at least one checkbox in every H2 batch.
- Keep H3 and deeper content inside its H2 batch.
- Preserve document order as execution order.
- Normalize each H2 by trimming, collapsing whitespace to one space, and lowercasing.
- Set each batch ID to the full lowercase hexadecimal SHA-256 of its normalized H2.
- Reject duplicate normalized H2 values.
- Treat `[x]` and `[X]` as checked.
- Derive each batch checkbox bitmap from its checkbox order.
- Mark a batch complete only when every checkbox in that batch is checked.
- Treat Markdown before the first H2 as the shared preamble.

### Revision rules

- Set `fileRevision` to SHA-256 of the exact UTF-8 file bytes.
- Set `structuralRevision` to SHA-256 of title, preamble, ordered normalized H2 values, and task text with every checkbox marker normalized to `[ ]`.
- Capture both revisions when `/queue run` starts.
- Re-read before every batch dispatch and checkbox mutation.
- Pause dispatch when structural revision changes.
- Reject a checkbox write when file revision or expected bitmap changes.
- Apply checkbox changes through AST source offsets and `write-file-atomic`.
- Re-read after every write and return the new file revision and bitmap.

## 4. Pipeline A: create the task list

1. Start a planning session.
2. Preload the required code context.
3. Ask questions and steer the plan.
4. Tell the agent to write the technical task list.
5. Todo replaces the planning write path with `.pi/tasks/<H1-derived-filename>`.
6. The agent and user refine that same Markdown file.
7. Start a new Pi session when the task plan is final.

There is no Todo load, dump, approve, path-selection, scan, rename, or watch command.

## 5. Pipeline B: execute the task list

1. Start the new execution session.
2. Todo reads the one incomplete canonical plan under `.pi/tasks/` without sending its content to the agent.
3. Preload the required code context.
4. Run `/queue run` with no arguments.
5. Queue requests a fresh plan snapshot and captures file and structural revisions.
6. Queue requests and sends only the current batch and shared preamble.
7. On `agent_settled`, Queue freezes the execution range and requests compression.
8. Context Tree emits `accepted`, drafts the summary, and opens user review.
9. After `applied`, Queue asks Todo to atomically check the batch in Markdown.
10. Queue re-reads the plan and sends only the next incomplete batch.
11. Repeat until no incomplete batch remains.

`/queue run` takes no plan path. Existing standalone queue commands remain on their standalone state path.

### Queue prompt shape

Send only the fixed current-batch rule, shared preamble, and current H2 batch. Exclude the plan path, future headings, future task text, full manifest, and remaining-task count.

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
- Structural revision.
- File revision.
- Current batch ID and ordinal.
- Entry ID before the queued task message.
- Last settled entry ID.
- Current phase.
- Last compression operation ID.
- Pause reason.

Do not persist future batch bodies. Fetch one body from `rpiv-todo` when it becomes current.

Use Pi `agent_settled`, not the current one-second `agent_end` timer, for the compression boundary. At this event, freeze the boundary, enter `compressing`, emit the compression request, and block next-batch dispatch. On session start, replay this state and reconcile it with the bound Markdown file and active context-tree marker automatically.

## 7. Inter-extension protocol

Use Pi's native `pi.events` bus with TypeBox validation. Use only these channels:

```text
rpiv-todo:plan:v1:request
rpiv-todo:plan:v1:result
pi-context-tree:compress:v1:request
pi-context-tree:compress:v1:result
```

Every request and result includes protocol version, operation ID, and run ID. Only batch-scoped plan and compression operations require batch ID, structural revision, file revision, and expected checkbox bitmap. Todo results use terminal `success` or `failed` states. Compression emits `accepted` before draft and review, then one terminal `applied`, `cancelled`, or `failed` result. Use a 5,000 ms timeout only for Todo results and initial compression acceptance.

### Todo operations

- `snapshot` returns title, revisions, counts, current batch identity, and no future batch body.
- `current_batch` returns only the shared preamble, current batch Markdown, bitmap, and revisions.
- `complete_batch` compares the expected current revision and pre-completion bitmap, then applies atomic Markdown completion without storing the bitmap in Todo state.
- `reopen_batch` uses a fresh current file revision and restores the exact bitmap supplied by the undo result with `revertsOperationId`.

### Compression request

Queue sends run ID, batch ID, compression operation ID, structural revision, file revision, pre-task anchor ID, settled end ID, expected session ID, expected source leaf ID, expected `compressing` phase, and pre-completion checkbox bitmap.

### Compression results

Context Tree emits `accepted` before draft and review, then one terminal result. Pipeline undo emits `undone` with a new undo operation ID and `revertsOperationId`. Range metadata and results include exact revisions, source hash, and saved checkbox bitmap.

## 8. Work in `rpiv-todo`

1. Remove the Todo agent tool, schemas, renderers, prompt guidance, tool-result replay, and every `rpiv-mono` permission, setup, workflow, prompt, configuration, and runtime reference to that tool.
2. Add exact `remark`, `remark-gfm`, and `write-file-atomic` dependencies.
3. Create `.pi/tasks/` before plan file access and reconnect `/todos` and the overlay to parsed disk state.
4. Redirect valid planning task-list writes to the H1-derived `.pi/tasks/` path before execution.
5. Parse H1, preamble, H2 batches, stable heading-hash IDs, checkbox bitmaps, file revision, and structural revision.
6. Read the `.pi/tasks/` plan at session start, `/queue run`, before batch dispatch, and before checkbox mutation.
7. Reject zero or multiple incomplete canonical plans under `.pi/tasks/` when `/queue run` requests a snapshot.
8. Implement `snapshot`, `current_batch`, `complete_batch`, and `reopen_batch` with expected-revision atomic checkbox writes.
9. Exclude future plan content from event details, logs, errors, session entries, and agent messages.
10. Render the full plan only through `/todos` and the user TUI overlay.
11. Update existing Todo test code for the final disk-backed behavior and session isolation.

## 9. Work in `pi-context-tree`

1. Align workspace Pi development dependencies with `0.84.2`.
2. Add the public declarative `applySessionMutation()` API to Pi and the context-tree adapter.
3. Extract one substantive compression service for slash-command and event calls.
4. Keep the normal `/compress` selector connected to that service.
5. Add the pure queue-anchor range planner and reuse existing atomic grouping and `planRange()` logic.
6. Register the compression request handler and emit `accepted` before untimed user review.
7. Apply the approved event range through `applySessionMutation()` with expected session and leaf IDs.
8. Add run ID, batch ID, compression operation ID, structural revision, file revision, source hash, and pre-completion bitmap to both range entries.
9. Give pipeline undo a new operation ID and `revertsOperationId`.
10. Return exact `applied`, `cancelled`, `failed`, and `undone` results.
11. Update existing core, extension, undo, golden, and TUI test code.

## 10. Work in `pi-true-queue`

1. Add exact Pi and TypeScript development dependencies, `tsconfig.json`, and the npm type-check script.
2. Keep standalone queue paths separate from plan-run state and add `/queue run` with no path argument.
3. Request a fresh plan snapshot and current batch from Todo at each dispatch boundary.
4. Persist only run ID, revisions, current batch identity, session boundaries, phase, operation ID, and pause reason.
5. Send only the fixed current-batch rule, shared preamble, and current batch Markdown.
6. Record the pre-task anchor before `sendUserMessage()` and freeze the settled end before compression.
7. Use `agent_settled` to enter `compressing` and request compression.
8. Block dispatch until compression and atomic Markdown completion succeed.
9. Pause on stale structure, stale file, bitmap mismatch, timeout, invalid range, or failed mutation.
10. Make request, result, completion, and retry paths idempotent by operation ID.
11. Reconcile disk plan state and persisted queue metadata on resumed execution sessions.
12. Reject `enqueue_task` during plan runs and retain standalone enqueue behavior outside plan mode.
13. Move the queue shortcut to `ctrl+shift+q`.

## 11. Agent visibility rule

- Store the full plan under `.pi/tasks/` outside the project Git history.
- Remove the Todo agent tool, prompt snippets, and prompt guidance.
- Return only the current batch body through Todo events.
- Build agent messages from only the current-batch rule, shared preamble, and current batch.
- Keep future titles, future bodies, plan paths, full manifests, and remaining-task counts out of queue state, event details, logs, errors, widgets exposed to context, session entries, and agent messages.
- Render the full plan only through user TUI APIs.

This pipeline provides model-context isolation. It does not add filesystem sandbox or tool-interception work.

## 12. Failure and recovery rules

### Summary cancellation

- Keep the Markdown batch incomplete.
- Return Queue to `running` and send no next batch.
- Start a new compression operation on the next `agent_settled` or explicit `/queue run` retry.

### Stale file or bitmap

- Re-read before mutation.
- Reject the write when file revision or expected bitmap changed.
- Retain the applied compression operation ID and retry only the completion comparison.

### Structural change

- Compare the current structural revision before every dispatch.
- Set Queue to `paused` and send no next batch when it differs from the run revision.

### Session restart

- Re-read the `.pi/tasks/` plan.
- Replay queue metadata from the execution session.
- Compare revisions, current batch identity, checkbox bitmap, and active range markers.
- Resume only the matching pending transition; otherwise pause with a fixed mismatch error code.

### Undo

- Give undo a new operation ID and `revertsOperationId`.
- Request a fresh Todo snapshot and current batch after the `undone` result.
- Restore the marker bitmap through an atomic Markdown write that uses the fresh current file revision.
- Clear next-batch state that moved off the active path and make the restored batch current.

### Missing result or protocol mismatch

- Fail closed after the 5,000 ms Todo or acceptance timeout.
- Do not send the next batch or fall back to broad Pi `/compact`.

## 13. Version and repository preparation

1. Switch `pi-context-tree`, `rpiv-mono`, and `true-queue` to `queue-todos-compress-loop` branches.
2. Check out the Pi `0.84.2` source fork on its `queue-todos-compress-loop` branch.
3. Align Pi development dependencies with `0.84.2` and TypeBox with `1.3.7`.
4. Move the queue shortcut to `ctrl+shift+q` and keep `ctrl+q` for Context Tree.

## 14. Existing-test update plan

### `rpiv-todo`

Update existing test code for:

- Todo agent-tool and consumer removal.
- `.pi/tasks/` creation and H1-derived planning-write redirection.
- Stable heading-hash batch IDs.
- File and structural revisions.
- Session-start, queue-run, pre-dispatch, and pre-mutation reads without `fs.watch`.
- Current-batch-only event results.
- Expected-revision atomic completion and fresh-revision exact bitmap reopen without Todo-owned bitmap storage.
- New-session and restart disk recovery.
- No future content in events, logs, errors, session entries, or agent messages.

### `pi-context-tree`

Update existing test code for:

- Queue-anchor range planning and task-message retention.
- Event acceptance and untimed review.
- Declarative session mutation and stale rejection.
- Revision, bitmap, run, batch, and operation marker metadata.
- New undo operation IDs and `revertsOperationId`.
- Byte-preserved original entries.

### `pi-true-queue`

Add TypeScript configuration and test through existing integration paths without adding a test suite.

## 15. End-to-end acceptance run

1. Create a three-batch plan and confirm its write path is `.pi/tasks/<H1-derived-filename>`.
2. Refine the same file in the planning session.
3. Start a new execution session and preload source context.
4. Run `/queue run` and confirm only batch 1 and the shared preamble enter agent context.
5. Complete batch 1 with tool calls and steering.
6. Confirm `agent_settled` starts compression and blocks next-batch dispatch.
7. Cancel one review, steer again, and confirm a new compression operation starts.
8. Approve the summary and confirm atomic Markdown completion before batch 2 dispatch.
9. Confirm preload and exact batch 1 task text remain active while raw execution entries move off path.
10. Change plan structure and confirm Queue pauses before dispatch.
11. Create a stale file revision and confirm checkbox mutation rejects without overwrite.
12. Undo batch 2 and confirm exact bitmap restoration with a new undo operation ID.
13. Resume the execution session after Pi restart and confirm disk and queue metadata reconciliation.
14. Complete all batches and confirm the final Markdown plan is checked and no future content leaked through context or extension state.

## 16. Work order

1. Switch pipeline branches and align versions.
2. Add `applySessionMutation()` to Pi.
3. Add the four-channel schemas.
4. Remove the Todo agent tool and consumers.
5. Add the `.pi/tasks/` parser, writer, revisions, and stable IDs.
6. Add boundary reads and the Todo event provider.
7. Extract the shared compression service.
8. Add the pipeline range planner.
9. Add event compression and exact undo metadata.
10. Add the queue coordinator and persisted run metadata.
11. Add the automatic completion loop.
12. Add disk-backed restart and undo reconciliation.
13. Update existing test code.

## 17. Work that is not in the first version

- Automatic judgment that code work is complete.
- Automatic Git worktree, commit, deploy, or merge-request work.
- Parallel batch execution.
- Agent-created or agent-reordered plan tasks during execution.
- Broad automatic Pi `/compact` calls.
- Filesystem sandbox or tool-interception work.
- Native Pi tree behavior changes unrelated to the pipeline mutation API.

The first version uses persistent `.pi/tasks/` Markdown, sends only the current batch, compresses each completed execution range, and updates batch state atomically before dispatching the next batch.
