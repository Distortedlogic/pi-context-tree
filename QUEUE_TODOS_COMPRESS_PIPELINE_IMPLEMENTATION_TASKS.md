# Queue Todos Compress Pipeline Implementation Tasks

- Phase 0 contains only the branch setup required before pipeline implementation.
- After Phase 0, every checkbox changes source code, test code, package metadata, or TypeScript configuration.
- Store each task plan as persistent Markdown under the project `.pi/tasks/` directory.
- Use the H1-derived Markdown file as the Todo execution source of truth.
- Let the existing Git-sync extension persist `.pi/tasks/` outside the project Git history.
- Start execution in a new Pi session after planning is complete.
- Keep future batch text out of agent messages, tool results, prompt guidance, queue state, and session custom entries.
- Read plan state at session start, `/queue run`, before batch dispatch, and before checkbox mutation.
- Do not add `/todos load`, `/todos dump`, `fs.watch`, or an in-memory plan handoff.
- Keep `/compress` available as the direct user command.
- Use the same context-tree compression service for user-command and pipeline-event calls.
- Use only `remark@15.0.1`, `remark-gfm@4.0.1`, `write-file-atomic@8.0.0`, `typebox@1.3.7`, Node file APIs, and Pi extension APIs.
- Update only existing test files in repositories that have tests.
- Do not add a test suite to `pi-true-queue`.

## 0. Switch to the pipeline implementation branches

- [ ] Switch `pi-context-tree`, `rpiv-mono`, and `true-queue` to their `queue-todos-compress-loop` branches.
- [ ] Check out the Pi `0.84.2` source fork and switch it to a `queue-todos-compress-loop` branch.

## 1. Add the narrow event-safe Pi session mutation API

- [ ] Add an `applySessionMutation()` method to the public Pi `ExtensionAPI` type.
- [ ] Define its input as `expectedSessionId`, `expectedLeafId`, `navigateToEntryId`, navigation options, ordered custom messages, and ordered custom entries.
- [ ] Restrict navigation options to public `navigateTree()` options and require `summarize: false` for the pipeline call.
- [ ] Define its result as `applied`, `cancelled`, or `stale` with the resulting leaf ID when applied.
- [ ] Add the matching action handler to Pi's extension runtime action types.
- [ ] Implement the method in Pi's extension runner with the existing serialized session-mutation queue.
- [ ] Recheck the expected session ID and source leaf ID before navigation, then recheck the session ID and resulting target leaf ID before appending messages or entries.
- [ ] Apply navigation, custom messages, and custom entries as one ordered runner operation.
- [ ] Return `stale` without writes when the expected session ID or expected leaf ID changed.
- [ ] Add `applySessionMutation()` to the structural `PiLike` adapter in `pi-context-tree`.
- [ ] Update every `pi-context-tree` workspace Pi development dependency to `0.84.2` and update `package-lock.json`.
- [ ] Update the `rpiv-mono` root Pi development dependencies to `0.84.2` and update `package-lock.json`.

## 2. Add the fixed four-channel protocol constants and schemas

- [ ] Add `PLAN_REQUEST_CHANNEL = "rpiv-todo:plan:v1:request"` and `PLAN_RESULT_CHANNEL = "rpiv-todo:plan:v1:result"` to `packages/rpiv-todo/plan-protocol.ts` with the plan schemas.
- [ ] Add matching plan channel constants and client payload schemas to `pi-true-queue/index.ts`.
- [ ] Add `COMPRESSION_REQUEST_CHANNEL = "pi-context-tree:compress:v1:request"` and `COMPRESSION_RESULT_CHANNEL = "pi-context-tree:compress:v1:result"` to `packages/extension/src/compression-protocol.ts` with the compression schemas.
- [ ] Add matching compression channel constants and client payload schemas to `pi-true-queue/index.ts`.
- [ ] Validate every producer and consumer payload with its TypeBox schema before use.
- [ ] Include one `operationId` created with `crypto.randomUUID()` in every request and matching result.
- [ ] Include protocol version, operation ID, and run ID in every plan-run request and result.
- [ ] Require batch ID, structural revision, file revision, and expected checkbox bitmap only on batch-scoped plan and compression operations.
- [ ] Add TypeBox string-enum schemas for every plan and compression result state.
- [ ] Use `success` and `failed` for terminal plan request results.
- [ ] Use `accepted`, `applied`, `cancelled`, `failed`, and `undone` for compression results.
- [ ] Add error codes and user-safe messages to failed results.
- [ ] Use a fixed 5,000 ms timeout for plan requests and initial compression acceptance.
- [ ] Emit `accepted` synchronously before compression draft and review work starts.
- [ ] Cancel the compression timeout when `accepted` arrives and leave summary review untimed.
- [ ] Reject duplicate completed operation IDs without repeating Todo, context, or queue mutations.

## 3. Replace the todo agent tool with the `.pi/tasks/` plan store

- [ ] Add `remark@15.0.1`, `remark-gfm@4.0.1`, and `write-file-atomic@8.0.0` to `packages/rpiv-todo/package.json` and update the root `package-lock.json`.
- [ ] Remove `registerTodoTool(pi)` from `packages/rpiv-todo/index.ts`.
- [ ] Remove todo tool registration, schema, execution, response-envelope, agent-rendering, and tool-result replay code from `packages/rpiv-todo/todo.ts` and `packages/rpiv-todo/tool/`.
- [ ] Remove todo `promptSnippet`, `promptGuidelines`, and guidance configuration.
- [ ] Remove the `todo` tool from every `rpiv-mono` permission template, setup allowlist, agent prompt, workflow registration, and shipped configuration entry.
- [ ] Remove sibling-package runtime calls that create, read, or update tasks through the `todo` agent tool.
- [ ] Create `.pi/tasks/` with `node:fs/promises.mkdir({ recursive: true })` before the first plan write or read.
- [ ] Reconnect the existing `/todos` display and todo overlay to parsed `.pi/tasks/` state.
- [ ] Add a project-scoped plan model that contains canonical file path, level-one title, shared preamble, ordered batches, stable batch IDs, exact batch Markdown, checkbox bitmaps, file revision, structural revision, and current batch ID.
- [ ] Add runtime-only in-progress display state without writing an in-progress marker into Markdown.
- [ ] Remove future batch bodies from todo session entries, queue entries, tool results, and custom message details.

## 4. Implement canonical `.pi/tasks/` Markdown plans

- [ ] Parse task-plan Markdown with `remark` and `remark-gfm`.
- [ ] Require exactly one level-one heading.
- [ ] Derive the canonical filename by trimming the H1, replacing each whitespace run with `_`, removing characters other than letters, numbers, `_`, and `-`, collapsing repeated `_`, and appending `.md`.
- [ ] Preserve the H1 letter case in the canonical filename.
- [ ] Reject an H1 that becomes empty after sanitization.
- [ ] Add an input handler for agent planning `write` calls that parse as task plans and replace their target path with `.pi/tasks/<H1-derived-filename>` before the write executes.
- [ ] Require later agent `edit` calls for the plan to target the same canonical `.pi/tasks/` path and reject any edit that changes the level-one heading from the first canonical write.
- [ ] Treat each level-two heading and its content as one ordered batch.
- [ ] Require at least one GFM checkbox in every batch.
- [ ] Attach every level-three and deeper heading to its parent level-two batch during AST traversal.
- [ ] Treat `[x]` and `[X]` as checked.
- [ ] Set batch completion to false when any checkbox in that batch is unchecked.
- [ ] Normalize each level-two heading by trimming it, collapsing whitespace to one space, and lowercasing it.
- [ ] Set `batchId` to the full lowercase hexadecimal SHA-256 of the normalized heading.
- [ ] Reject duplicate normalized batch headings.
- [ ] Extract the Markdown before the first level-two heading as the shared preamble.
- [ ] Set `fileRevision` to the lowercase hexadecimal SHA-256 of the exact UTF-8 file bytes.
- [ ] Set `structuralRevision` to the lowercase hexadecimal SHA-256 of title, preamble, ordered normalized headings, and task text with every checkbox marker normalized to `[ ]`.
- [ ] Record the exact checkbox bitmap for every batch.
- [ ] Use AST source offsets to change only checkbox markers.
- [ ] Write checkbox mutations with `write-file-atomic` and return the new file revision.

## 5. Implement boundary-based plan reads

- [ ] Read `.pi/tasks/` during Todo session start and parse the one incomplete canonical task plan for the project.
- [ ] During initial `/queue run` plan selection, return a failed plan result when `.pi/tasks/` contains zero or more than one incomplete canonical task plan; for a bound run whose final batch is complete, return a successful snapshot with no current batch.
- [ ] Re-read and parse the current plan when `/queue run` starts.
- [ ] Re-read and parse the current plan before every batch dispatch.
- [ ] Re-read and parse the current plan before every checkbox mutation.
- [ ] Compare the expected file revision before every checkbox write.
- [ ] Compare the run structural revision before every batch dispatch.
- [ ] Return a stale-file failure without writes when the expected file revision changed.
- [ ] Return a stale-structure failure and pause dispatch when the structural revision changed.
- [ ] Accept checkbox-only revision changes when structural revision remains equal and the expected bitmap matches.
- [ ] Re-read the plan after each successful atomic write and return its new file revision and checkbox bitmap.

## 6. Implement the disk-backed Todo event provider

- [ ] Register one handler for `rpiv-todo:plan:v1:request`.
- [ ] Validate each request before reading or changing plan state.
- [ ] Implement `snapshot` to return title, file revision, structural revision, counts, current batch ID, current batch ordinal, and no future batch body.
- [ ] Implement `current_batch` to return only the shared preamble, requested current batch Markdown, current checkbox bitmap, file revision, and structural revision.
- [ ] Implement `complete_batch` to compare the expected current file revision and pre-completion bitmap and atomically check every current batch checkbox without storing that bitmap in Todo state.
- [ ] Implement `reopen_batch` to compare a fresh expected file revision and atomically restore the bitmap supplied by the undo result with `revertsOperationId`.
- [ ] Make `complete_batch` and `reopen_batch` idempotent by operation ID.
- [ ] Reject a batch mutation when batch ID, file revision, structural revision, or expected checkbox bitmap differs.
- [ ] Emit every request result on `rpiv-todo:plan:v1:result`.
- [ ] Render the full plan only through the existing user TUI overlay and `/todos` display.
- [ ] Exclude future batch titles, bodies, plan paths, and full-plan state from event details, logs, errors, session entries, and agent messages.

## 7. Extract the shared context-tree compression service

- [ ] Refactor `packages/extension/src/range-compress.ts` so one substantive service owns summary drafting, summary review, source revalidation, append-only apply payload creation, marker creation, ambient refresh, and structured results.
- [ ] Move range planning and request normalization into the existing planning modules and pass one immutable `RangePlan` into the shared service.
- [ ] Make the existing `/compress` handler call the shared service through its command context.
- [ ] Connect the existing interactive range selector to the shared service without changing its selected plan.
- [ ] Route pipeline event requests to the same shared service.
- [ ] Build a declarative `applySessionMutation()` payload for the event path after summary approval.

## 8. Add exact pipeline range planning

- [ ] Add a pure core planner that accepts source leaf ID, entry ID before the queued task message, and last settled entry ID.
- [ ] Require the pre-task anchor and settled end entry to be on the active path.
- [ ] Locate the queued user task message immediately after the pre-task anchor in active context.
- [ ] Set the compression start boundary after the queued user task message.
- [ ] Start selection at the first assistant group after that task message.
- [ ] Include later user steering messages inside the continuous execution range.
- [ ] End selection at the complete atomic group that contains the settled end entry.
- [ ] Reject an incomplete assistant tool-call group.
- [ ] Reject a range that contains a protected decision or structural entry.
- [ ] Reuse `rangeCandidates()` and `planRange()` for grouping, ordering, serialization, source hash, and token totals.
- [ ] Preserve preload context and the exact queued task message outside the selected range.
- [ ] Return one immutable range plan to the shared compression service.

## 9. Add event-driven pipeline compression and exact undo identity

- [ ] Register one handler for `pi-context-tree:compress:v1:request`.
- [ ] Validate the request before accessing session state.
- [ ] Require run ID, batch ID, compression operation ID, structural revision, file revision, pre-task anchor ID, settled end ID, expected session ID, expected source leaf ID, expected queue phase, and pre-completion checkbox bitmap.
- [ ] Reject a request whose expected queue phase is not `compressing`.
- [ ] Emit `accepted` before draft and review work starts.
- [ ] Build the exact pipeline range plan from the current extension context.
- [ ] Draft the execution summary with the current model.
- [ ] Require the summary to preserve files changed, implementation decisions, exact commands and test results, failures, unresolved work, and commit hashes.
- [ ] Open the summary editor and require a non-empty saved value.
- [ ] Emit `cancelled` without session writes when the user cancels or saves an empty value.
- [ ] Revalidate session ID, source leaf, selected IDs, source hash, run ID, batch ID, structural revision, file revision, and checkbox bitmap after review.
- [ ] Call `applySessionMutation()` with the expected session and leaf IDs, anchor target, visible range-tail message, and range marker entry.
- [ ] Add run ID, batch ID, compression operation ID, structural revision, file revision, source hash, and pre-completion checkbox bitmap to both range entries.
- [ ] Emit one terminal `applied`, `cancelled`, or `failed` result after an accepted request.
- [ ] Derive duplicate applied results from workflow metadata on active or off-path range markers.
- [ ] Create a new operation ID for every pipeline `/undo` action.
- [ ] Add `revertsOperationId` that references the applied compression operation ID.
- [ ] Emit `undone` with run ID, batch ID, undo operation ID, `revertsOperationId`, structural revision, file revision, and saved checkbox bitmap.
- [ ] Apply all range changes append-only so original session entries remain recoverable.

## 10. Add the queue plan-run coordinator

- [ ] Add `@earendil-works/pi-coding-agent@0.84.2`, `@earendil-works/pi-tui@0.84.2`, `typebox@1.3.7`, and `typescript@6.0.3` as `pi-true-queue` development dependencies and create `package-lock.json`.
- [ ] Add `tsconfig.json` with `noEmit: true` and `index.ts` as its only source file.
- [ ] Add an npm `check` script that runs `tsc -p tsconfig.json`.
- [ ] Use the Pi `0.84.2` `agent_settled` event.
- [ ] Add `/queue run` with no arguments as the only pipeline-start command.
- [ ] Request a fresh Todo plan snapshot when `/queue run` starts.
- [ ] Return a user error when Todo reports zero or multiple incomplete `.pi/tasks/` plans.
- [ ] Route standalone queue commands and `+task` input through the existing standalone state path when no plan run is active.
- [ ] Add `idle`, `running`, `compressing`, `paused`, and `complete` plan-run phases.
- [ ] Persist only run ID, structural revision, file revision, current batch ID and ordinal, pre-task anchor ID, last settled entry ID, phase, last compression operation ID, and pause reason in queue custom entries.
- [ ] Request a fresh current batch from Todo before dispatch.
- [ ] Build the queued agent message from only the fixed current-batch rule, shared preamble, and current batch Markdown.
- [ ] Record the current leaf as the pre-task anchor before `sendUserMessage()`.
- [ ] Set phase to `running` before dispatch.
- [ ] Reject `enqueue_task` while a plan run is active.
- [ ] Route `enqueue_task` to the existing standalone path when no plan run is active.
- [ ] Delete the bundled sequential-isolation skill and remove its `pi-true-queue` package metadata references.

## 11. Implement the automatic batch completion loop

- [ ] On `agent_settled`, read the last settled entry ID for the active batch.
- [ ] Change phase from `running` to `compressing` before the compression request.
- [ ] Request a fresh current batch and checkbox bitmap from Todo before compression.
- [ ] Pause when the returned structural revision differs from the run structural revision.
- [ ] Emit one compression request with a new operation ID, structural revision, file revision, and current checkbox bitmap.
- [ ] Start the 5,000 ms acceptance timeout and cancel it when `accepted` arrives.
- [ ] Block next-batch dispatch while compression or summary review is active.
- [ ] On `cancelled`, keep the Markdown batch incomplete and return phase to `running`.
- [ ] Emit a new compression request on the next `agent_settled` after user steering.
- [ ] Make `/queue run` retry compression for the frozen range when no new steering turn is needed.
- [ ] On `failed`, set phase to `paused`, persist the error code, and send no next batch.
- [ ] On `applied`, request `complete_batch` with matching run ID, batch ID, structural revision, file revision, compression operation ID, and saved checkbox bitmap.
- [ ] Retain the applied compression operation ID when `complete_batch` returns stale-file and route `/queue run` directly to a fresh completion comparison.
- [ ] After the atomic Markdown completion succeeds, request a fresh snapshot and current batch.
- [ ] Set phase to `complete` and clear the active batch when no incomplete batch remains.
- [ ] Dispatch the next batch only after compression and Markdown completion both succeed.

## 12. Implement new-session startup, disk recovery, and undo reconciliation

- [ ] Read the current `.pi/tasks/` plan during Todo session start without sending its content to the agent.
- [ ] Rebuild Todo display state from the Markdown plan after Pi process restart or extension reload.
- [ ] Replay queue run metadata from queue custom entries when an execution session resumes.
- [ ] Reconcile persisted Queue state with active and off-path context-tree range markers during session startup and resume the exact pending transition for each persisted phase.
- [ ] Re-read the plan and compare structural revision, file revision, current batch ID, and checkbox bitmap before resuming a persisted run.
- [ ] Pause with a fixed mismatch error code when persisted queue metadata and current Markdown state disagree.
- [ ] On an `undone` result, request a fresh Todo snapshot and current batch before reopening the batch.
- [ ] Send `reopen_batch` with the fresh file revision, current structural revision, batch ID, undo operation ID, `revertsOperationId`, and checkbox bitmap from the undo result.
- [ ] Apply `reopen_batch` as an expected-current-revision atomic Markdown checkbox write.
- [ ] Clear next-batch state that moved off the active path.
- [ ] Make the reopened batch current in `running` phase.
- [ ] Restart compression on its next `agent_settled`.
- [ ] Pause before the next dispatch when Git-sync or user edits change the structural revision.

## 13. Update existing test code

- [ ] Update existing Pi extension-runner tests for `applySessionMutation()`, serialized mutation order, stale-session rejection, and ordered append behavior.
- [ ] Update existing `rpiv-todo` tests for removal of the agent tool, prompt guidance, permission entries, setup references, and sibling runtime calls.
- [ ] Update existing `rpiv-todo` tests for `.pi/tasks/` directory creation, H1-derived write-path replacement, noncanonical edit rejection, duplicate headings, and stable heading-hash batch IDs.
- [ ] Update existing `rpiv-todo` tests for exact file revisions, normalized structural revisions, checkbox bitmaps, and status-only revision changes.
- [ ] Update existing `rpiv-todo` tests for session-start, queue-run, pre-dispatch, and pre-mutation boundary reads without `fs.watch`.
- [ ] Update existing `rpiv-todo` isolation tests to prove future titles, bodies, paths, and full-plan state do not appear in event data, logs, errors, queue entries, session entries, or agent messages.
- [ ] Update existing `rpiv-todo` tests for expected-revision atomic completion, stale-file rejection, fresh-revision exact bitmap reopen, and operation idempotency without Todo-owned bitmap storage.
- [ ] Update existing `rpiv-todo` tests for new-session plan loading, extension reload, Pi restart, and Git-sync structural revision changes.
- [ ] Update existing `pi-context-tree` core tests for queue-anchor range planning, opening task retention, steering inclusion, and tool-call grouping.
- [ ] Update existing `pi-context-tree` extension tests for event acceptance, untimed review, declarative session mutation, stale source rejection, and file-revision marker metadata.
- [ ] Update existing `pi-context-tree` undo tests for new undo operation IDs, `revertsOperationId`, saved bitmap results, and source restoration.
- [ ] Update existing context-tree golden tests for byte-preserved source entries and tail-before-marker order.
- [ ] Update existing context-tree TUI tests for event-started summary review.
