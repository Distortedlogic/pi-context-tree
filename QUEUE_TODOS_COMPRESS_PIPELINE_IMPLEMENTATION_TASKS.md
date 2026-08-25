# Queue Todos Compress Pipeline Implementation Tasks

- Phase 0 contains the only prerequisite work outside this implementation sequence.
- After Phase 0, every checkbox changes source code, test code, package metadata, or TypeScript configuration.
- Treat Markdown as a temporary planning and triage interchange format.
- Treat private in-memory Todo state as the execution source of truth.
- Keep future batch text out of agent messages, tool results, prompt guidance, queue state, and session custom entries.
- Accept loss of the loaded plan on Pi process restart or extension reload. Do not persist future batches to disk.
- Keep `/compress` available as the direct user command.
- Use the same context-tree compression service for user-command and pipeline-event calls.
- Use only `remark@15.0.1`, `remark-gfm@4.0.1`, `write-file-atomic@8.0.0`, `typebox@1.3.7`, Node file APIs, and Pi extension APIs.
- Update only existing test files in repositories that have tests.
- Do not add a test suite to `pi-true-queue`.

## 0. Finish the active prerequisite and switch branches

- [ ] Complete and commit every remaining task in `IDIOMATIC_NATIVE_PI_REFACTOR_TASK_LIST.md` on its active implementation branch.
- [ ] Switch `pi-context-tree`, `rpiv-mono`, and `true-queue` to their `queue-todos-compress-loop` branches.
- [ ] Check out the Pi `0.84.2` source fork and switch it to a `queue-todos-compress-loop` branch.

## 1. Add the narrow event-safe Pi session mutation API

- [ ] Add an `applySessionMutation()` method to the public Pi `ExtensionAPI` type.
- [ ] Define its input as `expectedSessionId`, `expectedLeafId`, `navigateToEntryId`, navigation options, ordered custom messages, and ordered custom entries.
- [ ] Restrict navigation options to public `navigateTree()` options and require `summarize: false` for the pipeline call.
- [ ] Define its result as `applied`, `cancelled`, or `stale` with the resulting leaf ID when applied.
- [ ] Add the matching action handler to Pi's extension runtime action types.
- [ ] Implement the method in Pi's extension runner with the existing serialized session-mutation queue.
- [ ] Recheck session ID and leaf ID before navigation and before appending messages or entries.
- [ ] Apply navigation, custom messages, and custom entries as one ordered runner operation.
- [ ] Return `stale` without writes when the expected session ID or expected leaf ID changed.
- [ ] Add `applySessionMutation()` to the structural `PiLike` adapter in `pi-context-tree`.
- [ ] Update every `pi-context-tree` workspace Pi development dependency to `0.84.2` and update `package-lock.json`.
- [ ] Update the `rpiv-mono` root Pi development dependencies to `0.84.2` and update `package-lock.json`.

## 2. Add the fixed five-channel protocol constants and schemas

- [ ] Add `PLAN_REQUEST_CHANNEL = "rpiv-todo:plan:v1:request"` and `PLAN_RESULT_CHANNEL = "rpiv-todo:plan:v1:result"` to `packages/rpiv-todo/plan-protocol.ts` with the plan schemas.
- [ ] Add matching plan channel constants and client payload schemas to `pi-true-queue/index.ts`.
- [ ] Add `COMPRESSION_REQUEST_CHANNEL = "pi-context-tree:compress:v1:request"` and `COMPRESSION_RESULT_CHANNEL = "pi-context-tree:compress:v1:result"` to `packages/extension/src/compression-protocol.ts` with the compression schemas.
- [ ] Add matching compression channel constants and client payload schemas to `pi-true-queue/index.ts`.
- [ ] Add `QUEUE_STATE_CHANNEL = "pi-true-queue:state:v1"` to `pi-true-queue/index.ts` and the todo plan protocol module.
- [ ] Define the queue-state payload as protocol version, run ID, and `idle`, `running`, `compressing`, `paused`, or `complete` phase only.
- [ ] Validate every producer and consumer payload with its TypeBox schema before use.
- [ ] Include one `operationId` created with `crypto.randomUUID()` in every request and matching result.
- [ ] Include `runId`, `batchId`, and protocol version in every plan-run request and result.
- [ ] Add TypeBox string-enum schemas for every plan and compression result state.
- [ ] Use `success` and `failed` for terminal plan request results.
- [ ] Use `accepted`, `applied`, `cancelled`, `failed`, and `undone` for compression results.
- [ ] Add error codes and user-safe messages to failed results.
- [ ] Use a fixed 5,000 ms timeout for plan requests and initial compression acceptance.
- [ ] Emit `accepted` synchronously before compression draft and review work starts.
- [ ] Cancel the compression timeout when `accepted` arrives and leave summary review untimed.
- [ ] Reject duplicate completed operation IDs without repeating Todo, context, or queue mutations.

## 3. Replace the todo agent tool with private in-memory plan state

- [ ] Add `remark@15.0.1`, `remark-gfm@4.0.1`, and `write-file-atomic@8.0.0` to `packages/rpiv-todo/package.json` and update the root `package-lock.json`.
- [ ] Remove `registerTodoTool(pi)` from `packages/rpiv-todo/index.ts`.
- [ ] Remove todo tool registration, schema, execution, response-envelope, agent-rendering, and tool-result replay code from `packages/rpiv-todo/todo.ts` and `packages/rpiv-todo/tool/`.
- [ ] Remove todo `promptSnippet`, `promptGuidelines`, and guidance configuration.
- [ ] Remove the `todo` tool from every `rpiv-mono` permission template, setup allowlist, agent prompt, workflow registration, and shipped configuration entry.
- [ ] Remove sibling-package runtime calls that create, read, or update tasks through the `todo` agent tool.
- [ ] Reconnect the existing `/todos` display and todo overlay to private in-memory plan state.
- [ ] Add a project-scoped in-memory plan store that contains:
  - [ ] Plan revision ID.
  - [ ] Level-one title.
  - [ ] H1-derived triage filename.
  - [ ] Shared preamble Markdown.
  - [ ] Ordered batches.
  - [ ] Stable batch IDs.
  - [ ] Exact batch Markdown.
  - [ ] Current checkbox bitmap for each batch.
  - [ ] Current batch ID.
  - [ ] Completed operation results.
  - [ ] Queue phase received from `QUEUE_STATE_CHANNEL`.
- [ ] Add runtime-only in-progress display state without a Markdown marker.
- [ ] Partition loaded plans by project identity and bind only one foreground execution session to each loaded plan.
- [ ] Remove future batch bodies from todo session entries, queue entries, tool results, and custom message details.
- [ ] Clear loaded plan content when the extension reloads or the Pi process starts without an in-memory plan.

## 4. Implement temporary Markdown import and export

- [ ] Parse planning and triage files with `remark` and `remark-gfm`.
- [ ] Require exactly one level-one heading.
- [ ] Derive the canonical filename by trimming the H1, replacing each whitespace run with `_`, removing characters other than letters, numbers, `_`, and `-`, collapsing repeated `_`, and appending `.md`.
- [ ] Preserve the H1 letter case in the canonical filename.
- [ ] Reject an H1 that becomes empty after sanitization.
- [ ] Require the agent-created file path to equal the H1-derived path in the current project directory.
- [ ] Reject a noncanonical path during `/todos load` without moving or renaming the file.
- [ ] Treat each level-two heading and its content as one ordered batch.
- [ ] Require at least one GFM checkbox in every batch.
- [ ] Attach every level-three and deeper heading to its parent level-two batch during AST traversal.
- [ ] Treat `[x]` and `[X]` as checked.
- [ ] Set batch completion to false when any checkbox in that batch is unchecked.
- [ ] Normalize each level-two heading by trimming it, collapsing whitespace to one space, and lowercasing it.
- [ ] Set `batchId` to the full lowercase hexadecimal SHA-256 of the normalized heading.
- [ ] Reject duplicate normalized batch headings.
- [ ] Extract the Markdown before the first level-two heading as the shared preamble.
- [ ] Create a new `planRevisionId` with `crypto.randomUUID()` on every successful load.
- [ ] Record the exact checkbox bitmap for every batch during import.
- [ ] Serialize private Todo state back to the H1-derived Markdown shape for triage dump.
- [ ] Write triage Markdown with `write-file-atomic`.

## 5. Implement final approval through `/todos load`

- [ ] Listen for successful agent `write` and `edit` tool results that target Markdown in the current project directory.
- [ ] Record the latest successful Markdown write path without parsing or loading its task bodies.
- [ ] Add `/todos load` with no path argument.
- [ ] Read the remembered candidate path only when `/todos load` runs.
- [ ] Parse and validate the complete plan into a staged in-memory value.
- [ ] Reject load when no remembered candidate exists, the file is missing, the path is noncanonical, or validation fails.
- [ ] Delete the Markdown file with `node:fs/promises.unlink` after staged validation succeeds.
- [ ] Publish the staged value to the private in-memory plan store only after deletion succeeds.
- [ ] Clear the remembered candidate path after successful load.
- [ ] Treat successful `/todos load` as final user approval.
- [ ] Preserve the loaded project plan in extension module memory when the planning session closes and the user starts a new session in the same Pi process.
- [ ] Bind the next foreground session for that project as the execution session when `/queue run` starts.
- [ ] Remove project-directory scanning, automatic incomplete-plan discovery, `node:fs.watch`, post-write renaming, and session-start file binding code.

## 6. Implement the todo event provider and triage dump

- [ ] Register one handler for `rpiv-todo:plan:v1:request`.
- [ ] Validate each request before reading or changing private plan state.
- [ ] Implement `snapshot` to return plan revision ID, title, counts, current batch ID, current batch ordinal, and no future batch body.
- [ ] Implement `current_batch` to return only the shared preamble, requested current batch Markdown, current checkbox bitmap, and expected plan revision ID.
- [ ] Implement `complete_batch` to save the exact pre-completion checkbox bitmap under the compression operation ID and set every current batch checkbox to checked in memory.
- [ ] Implement `reopen_batch` to restore the saved pre-completion checkbox bitmap referenced by `revertsOperationId`.
- [ ] Make `complete_batch` and `reopen_batch` idempotent by operation ID.
- [ ] Reject a batch mutation when plan revision ID or batch ID differs.
- [ ] Emit every request result on `rpiv-todo:plan:v1:result`.
- [ ] Listen to `pi-true-queue:state:v1` and update only cached run ID and queue phase.
- [ ] Add `/todos dump` with no path argument.
- [ ] Reject `/todos dump` unless cached queue phase is `idle`, `paused`, or `complete`.
- [ ] Serialize the complete private plan to its H1-derived Markdown filename when `/todos dump` runs.
- [ ] Show the created triage file path in user UI.
- [ ] Leave queue phase, current batch, operation state, and next-batch dispatch unchanged.
- [ ] Record the dumped path as the next `/todos load` candidate.
- [ ] Replace private plan state from the edited triage file on the next successful `/todos load`, assign a new plan revision ID, and delete the file again.
- [ ] Send no plan content to the agent from `/todos load`, `/todos dump`, event results, display state, or overlay details.

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
- [ ] Require run ID, batch ID, compression operation ID, plan revision ID, pre-task anchor ID, settled end ID, expected session ID, expected source leaf ID, expected queue phase, and pre-completion checkbox bitmap.
- [ ] Reject a request whose expected queue phase is not `compressing`.
- [ ] Emit `accepted` before draft and review work starts.
- [ ] Build the exact pipeline range plan from the current extension context.
- [ ] Draft the execution summary with the current model.
- [ ] Require the summary to preserve files changed, implementation decisions, exact commands and test results, failures, unresolved work, and commit hashes.
- [ ] Open the summary editor and require a non-empty saved value.
- [ ] Emit `cancelled` without session writes when the user cancels or saves an empty value.
- [ ] Revalidate session ID, source leaf, selected IDs, source hash, run ID, batch ID, plan revision ID, and checkbox bitmap after review.
- [ ] Call `applySessionMutation()` with the expected session and leaf IDs, anchor target, visible range-tail message, and range marker entry.
- [ ] Add run ID, batch ID, compression operation ID, plan revision ID, source hash, and pre-completion checkbox bitmap to both range entries.
- [ ] Emit one terminal `applied`, `cancelled`, or `failed` result after an accepted request.
- [ ] Derive duplicate applied results from workflow metadata on active or off-path range markers.
- [ ] Create a new operation ID for every pipeline `/undo` action.
- [ ] Add `revertsOperationId` that references the applied compression operation ID.
- [ ] Emit `undone` with run ID, batch ID, undo operation ID, `revertsOperationId`, plan revision ID, and saved checkbox bitmap.
- [ ] Apply all range changes append-only so original session entries remain recoverable.

## 10. Add the queue plan-run coordinator and phase broadcast

- [ ] Add `@earendil-works/pi-coding-agent@0.84.2`, `@earendil-works/pi-tui@0.84.2`, `typebox@1.3.7`, and `typescript@6.0.3` as `pi-true-queue` development dependencies and create `package-lock.json`.
- [ ] Add `tsconfig.json` with `noEmit: true` and `index.ts` as its only source file.
- [ ] Add an npm `check` script that runs `tsc -p tsconfig.json`.
- [ ] Use the Pi `0.84.2` `agent_settled` event.
- [ ] Add `/queue run` with no arguments as the only pipeline-start command.
- [ ] Return a user error when `/queue run` receives no loaded in-memory plan snapshot.
- [ ] Route standalone queue commands and `+task` input through the existing standalone state path when no plan run is active.
- [ ] Add `idle`, `running`, `compressing`, `paused`, and `complete` plan-run phases.
- [ ] Persist only run ID, plan revision ID, current batch ID and ordinal, pre-task anchor ID, last settled entry ID, phase, last compression operation ID, and pause reason in queue custom entries.
- [ ] Emit an initial `pi-true-queue:state:v1` payload with `idle` phase on session start.
- [ ] Emit `pi-true-queue:state:v1` after every plan-run phase change.
- [ ] Request only the loaded in-memory plan snapshot and current batch from Todo.
- [ ] Build the queued agent message from only the fixed current-batch rule, shared preamble, and current batch Markdown.
- [ ] Record the current leaf as the pre-task anchor before `sendUserMessage()`.
- [ ] Set phase to `running` before dispatch.
- [ ] Reject `enqueue_task` while a plan run is active.
- [ ] Route `enqueue_task` to the existing standalone path when no plan run is active.

## 11. Implement the automatic batch completion loop

- [ ] On `agent_settled`, read the last settled entry ID for the active batch.
- [ ] Change phase from `running` to `compressing` before the compression request and broadcast the new phase.
- [ ] Emit one compression request with a new operation ID, current plan revision ID, and current checkbox bitmap.
- [ ] Start the 5,000 ms acceptance timeout and cancel it when `accepted` arrives.
- [ ] Block next-batch dispatch while compression or summary review is active.
- [ ] On `cancelled`, keep the batch incomplete, return phase to `running`, and broadcast the phase.
- [ ] Emit a new compression request on the next `agent_settled` after user steering.
- [ ] Make `/queue run` retry compression for the frozen range when no new steering turn is needed.
- [ ] On `failed`, set phase to `paused`, persist the error code, broadcast the phase, and send no next batch.
- [ ] On `applied`, request `complete_batch` with matching run ID, batch ID, plan revision ID, compression operation ID, and saved checkbox bitmap.
- [ ] Retain the applied compression operation ID when `complete_batch` fails and route `/queue run` directly to the pending in-memory completion mutation.
- [ ] After in-memory completion succeeds, request only the next incomplete batch.
- [ ] Set phase to `complete` and clear the active batch when no incomplete batch remains.
- [ ] Dispatch the next batch only after compression and internal Todo completion both succeed.

## 12. Implement live-session handoff, loss handling, and undo reconciliation

- [ ] Transfer the project-scoped loaded plan from the planning session to the next foreground execution session within the same Pi process.
- [ ] Preserve the loaded plan when the planning session shuts down during `/new` or session switch.
- [ ] Clear the loaded plan and active plan run on extension reload or Pi process restart.
- [ ] Show one user-safe lost-plan error after reload or restart instead of attempting file or session recovery.
- [ ] Remove file-based restart reconciliation, canonical-path queue state, structure-digest queue state, incomplete-file binding, and context-marker restart scanning.
- [ ] On an `undone` result, send `reopen_batch` with the undo operation ID, `revertsOperationId`, plan revision ID, batch ID, and saved checkbox bitmap.
- [ ] Clear next-batch state that moved off the active path.
- [ ] Make the reopened batch current in `running` phase and broadcast the phase.
- [ ] Restart compression on its next `agent_settled`.
- [ ] Accept a triage-edited plan only through `/todos load`, which creates a new plan revision and replaces the prior in-memory state.

## 13. Update existing test code

- [ ] Update existing Pi extension-runner tests for `applySessionMutation()`, serialized mutation order, stale-session rejection, and ordered append behavior.
- [ ] Update existing `rpiv-todo` tests for removal of the agent tool, prompt guidance, permission entries, setup references, and sibling runtime calls.
- [ ] Update existing `rpiv-todo` tests for canonical H1 paths, noncanonical rejection, duplicate headings, stable heading-hash batch IDs, and temporary file deletion.
- [ ] Update existing `rpiv-todo` tests for `/todos load`, final approval, in-memory plan creation, same-process execution-session handoff, and reload loss.
- [ ] Update existing `rpiv-todo` tests for snapshot, current-batch isolation, exact checkbox bitmap completion, exact bitmap reopen, and operation idempotency.
- [ ] Update existing `rpiv-todo` tests for queue-phase broadcast handling and `/todos dump` rejection in `running` and `compressing` phases.
- [ ] Update existing `rpiv-todo` tests for triage dump creation, no queue mutation, triage reload, new revision creation, and file deletion.
- [ ] Update existing `pi-context-tree` core tests for queue-anchor range planning, opening task retention, steering inclusion, and tool-call grouping.
- [ ] Update existing `pi-context-tree` extension tests for event acceptance, untimed review, declarative session mutation, stale source rejection, and exact marker metadata.
- [ ] Update existing `pi-context-tree` undo tests for new undo operation IDs, `revertsOperationId`, saved bitmap results, and source restoration.
- [ ] Update existing context-tree golden tests for byte-preserved source entries and tail-before-marker order.
- [ ] Update existing context-tree TUI tests for event-started summary review.
