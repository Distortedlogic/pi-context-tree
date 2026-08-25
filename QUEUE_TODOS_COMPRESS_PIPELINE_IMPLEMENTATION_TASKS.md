# Queue Todos Compress Pipeline Implementation Tasks

- Phase 0 contains the only prerequisite work that is outside this implementation sequence.
- After Phase 0, every checkbox changes source code, test code, package metadata, or TypeScript configuration.
- Keep the Markdown plan as the only source of task content and checkbox state.
- Keep future batch text out of agent messages, tool results, prompt guidance, and custom context entries.
- Keep `/compress` available as the direct user command.
- Use the same context-tree compression service for user-command and pipeline-event calls.
- Use only `remark@15.0.1`, `remark-gfm@4.0.1`, `write-file-atomic@8.0.0`, `typebox@1.3.7`, Node file APIs, and Pi extension APIs for this work.
- Do not add another parser, watcher, event bus, state framework, orchestration package, thin wrapper, or custom global registry.
- Update only existing test files in repositories that have tests.
- Do not add a test suite to `pi-true-queue`.

## 0. Finish the active prerequisite and switch branches

- [ ] Complete and commit every remaining task in `IDIOMATIC_NATIVE_PI_REFACTOR_TASK_LIST.md` on its active implementation branch.
- [ ] Switch `pi-context-tree`, `rpiv-mono`, and `true-queue` to their `queue-todos-compress-loop` branches.

## 1. Add the public event-safe Pi session action

- [ ] Add `runSessionAction<T>(handler: (ctx: ExtensionCommandContext) => Promise<T>): Promise<T>` to the public Pi `ExtensionAPI` type.
- [ ] Add the matching action handler to Pi's extension runtime action types.
- [ ] Implement `runSessionAction` in Pi's extension runner with the existing serialized session-mutation queue.
- [ ] Create a fresh session-bound `ExtensionCommandContext` for each callback.
- [ ] Reject the operation when the session changes before callback start or before mutation apply.
- [ ] Add `runSessionAction` to the structural `PiLike` adapter in `pi-context-tree`.
- [ ] Update every `pi-context-tree` workspace Pi development dependency to `0.84.2` and update `package-lock.json`.
- [ ] Update the `rpiv-mono` root Pi development dependencies to `0.84.2` and update `package-lock.json`.
- [ ] Route pipeline apply through `runSessionAction` and keep every `pi.events` payload limited to validated serializable data.

## 2. Add the fixed four-channel protocol constants and schemas

- [ ] Add `PLAN_REQUEST_CHANNEL = "rpiv-todo:plan:v1:request"` and `PLAN_RESULT_CHANNEL = "rpiv-todo:plan:v1:result"` to a substantive `packages/rpiv-todo/plan-protocol.ts` module with the plan schemas.
- [ ] Add matching plan channel constants and client payload schemas to `pi-true-queue/index.ts`.
- [ ] Add `COMPRESSION_REQUEST_CHANNEL = "pi-context-tree:compress:v1:request"` and `COMPRESSION_RESULT_CHANNEL = "pi-context-tree:compress:v1:result"` to `packages/extension/src/compression-protocol.ts` with the compression schemas.
- [ ] Add matching compression channel constants and client payload schemas to `pi-true-queue/index.ts`.
- [ ] Validate every producer and consumer payload with its TypeBox schema before use.
- [ ] Include one `operationId` created with `crypto.randomUUID()` in every request and matching result.
- [ ] Include `runId`, `batchId`, and protocol version in every plan-run request and result.
- [ ] Add TypeBox string-enum schemas for every plan and compression result state.
- [ ] Use `success` and `failed` for terminal plan request results.
- [ ] Use `accepted`, `applied`, `cancelled`, `failed`, and `undone` for compression results.
- [ ] Put error codes and user-safe messages in failed results.
- [ ] Use a fixed 5,000 ms timeout for plan requests and initial compression acceptance.
- [ ] Make context-tree emit `accepted` synchronously before draft and review work starts.
- [ ] Cancel the 5,000 ms compression timeout when `accepted` arrives.
- [ ] Pause plan execution when plan results or compression acceptance do not arrive before the timeout.
- [ ] Reject duplicate completed operation IDs without repeating file, context, or queue mutations.

## 3. Replace the agent todo tool with a file-backed plan model

- [ ] Add `remark@15.0.1`, `remark-gfm@4.0.1`, and `write-file-atomic@8.0.0` to `packages/rpiv-todo/package.json` and update the root `package-lock.json`.
- [ ] Remove `registerTodoTool(pi)` from `packages/rpiv-todo/index.ts`.
- [ ] Remove todo tool registration, schema, execution, response-envelope, and agent-rendering code from `packages/rpiv-todo/todo.ts` and `packages/rpiv-todo/tool/`.
- [ ] Remove todo `promptSnippet`, `promptGuidelines`, and guidance configuration.
- [ ] Remove replay of task snapshots from `todo` tool results.
- [ ] Reconnect the existing `/todos` display and todo overlay to the file-backed plan state.
- [ ] Replace agent task types with a file plan model that contains:
  - [ ] Canonical file path.
  - [ ] Level-one title.
  - [ ] Shared preamble Markdown.
  - [ ] Ordered level-two batches.
  - [ ] Batch identity derived from its one-based ordinal and normalized level-two heading.
  - [ ] Exact batch Markdown.
  - [ ] Checkbox source positions.
  - [ ] Completion state.
  - [ ] Structure digest.
- [ ] Add runtime-only current-batch display state that does not write an in-progress marker into Markdown.
- [ ] Move Markdown parsing and state derivation into Pi-independent state modules and remove Pi UI imports from those modules.
- [ ] Replace session task snapshots with canonical path, digest, current batch ID, phase, and operation ID fields that contain no task body.

## 4. Implement canonical Markdown parsing and naming

- [ ] Parse plan files with `remark` and `remark-gfm`.
- [ ] Require exactly one level-one heading.
- [ ] Derive the canonical filename from the level-one heading by:
  - [ ] Trimming the heading text.
  - [ ] Replacing each whitespace run with `_`.
  - [ ] Removing characters other than letters, numbers, `_`, and `-`.
  - [ ] Collapsing repeated `_` characters.
  - [ ] Appending `.md`.
  - [ ] Placing the file in the current project directory.
- [ ] Reject a title that becomes empty after sanitization.
- [ ] Move a newly detected valid plan to its canonical filename when its current name differs.
- [ ] Stop and report a filename collision instead of overwriting another file.
- [ ] Treat each level-two heading and its content as one ordered batch.
- [ ] Require at least one GFM checkbox in every batch.
- [ ] Attach every level-three and deeper heading to its parent level-two batch during AST traversal.
- [ ] Treat `[x]` and `[X]` as checked.
- [ ] Mark a batch complete only when all checkboxes in that batch are checked.
- [ ] Set batch completion to false when any checkbox in that batch is unchecked.
- [ ] Normalize a batch heading by trimming it, collapsing whitespace to one space, and lowercasing it.
- [ ] Set `batchId` to `<one-based-ordinal>:<first-12-hex-of-SHA-256(normalized-heading)>`.
- [ ] Reject duplicate normalized batch headings.
- [ ] Extract the Markdown before the first level-two heading as the shared preamble.
- [ ] Build the structure-digest source from the title, preamble, ordered normalized headings, and task text with every checkbox marker normalized to `[ ]`.
- [ ] Set the structure digest to the lowercase hexadecimal SHA-256 of that UTF-8 source.
- [ ] Exclude status-only checkbox changes from the structure digest.
- [ ] Use AST source positions to patch only checkbox marks.
- [ ] Write checkbox changes with `write-file-atomic`.
- [ ] Reload and validate the file after every write.
- [ ] Preserve every source byte outside the checkbox marker offsets during a checkbox-only write.

## 5. Implement automatic plan detection, binding, and user display

- [ ] Listen for successful agent `write` and `edit` tool results that target Markdown files in the current project directory.
- [ ] Parse a changed Markdown file only after the write or edit succeeds.
- [ ] Bind a valid incomplete plan automatically.
- [ ] Watch the current project directory with `node:fs.watch` after session start.
- [ ] Reload the bound plan after a completed external file change.
- [ ] On session start, scan only top-level project Markdown files whose basenames match their sanitized level-one headings.
- [ ] Bind the one valid incomplete canonical plan automatically.
- [ ] Exclude fully complete plans from automatic binding.
- [ ] Return a failed plan result when there is no incomplete canonical plan.
- [ ] Return a failed plan result when there is more than one incomplete canonical plan.
- [ ] Ignore unrelated Markdown change events without replacing the current bound plan state.
- [ ] Update the todo overlay from the bound file and queue state.
- [ ] Show batch titles and states only in user UI.
- [ ] Exclude the plan path and future batch text from every agent-message construction input.
- [ ] Partition bound-plan and overlay state by Pi session ID so child sessions cannot replace foreground state.
- [ ] Dispose the file watcher and foreground UI binding during session shutdown.

## 6. Implement the todo event provider and emergency dump

- [ ] Register one handler for `rpiv-todo:plan:v1:request`.
- [ ] Validate each request before reading or changing plan state.
- [ ] Implement a `snapshot` request that returns:
  - [ ] Plan title.
  - [ ] Structure digest.
  - [ ] Total, complete, and incomplete batch counts.
  - [ ] Current incomplete batch ID and ordinal.
  - [ ] No future batch body.
- [ ] Implement a `current_batch` request that returns only the requested current batch body and shared preamble when the expected digest matches.
- [ ] Implement a `complete_batch` request that checks every checkbox in the matching batch atomically.
- [ ] Implement a `reopen_batch` request that restores the matching batch checkboxes to incomplete after pipeline undo.
- [ ] Make `complete_batch` and `reopen_batch` idempotent by operation ID.
- [ ] Reject a batch mutation when the structure digest changed.
- [ ] Emit every response on `rpiv-todo:plan:v1:result`.
- [ ] Add `/todos dump` with no path argument.
- [ ] Make `/todos dump` emit a stop request through the existing plan result channel.
- [ ] Make `/todos dump` flush current checkbox state to the bound canonical file.
- [ ] Make `/todos dump` show the canonical file path in user UI.
- [ ] Make `/todos dump` send no plan content to the agent.
- [ ] Route the existing standalone `/todos` display through the file-backed selectors and formatters.

## 7. Extract the shared context-tree compression service

- [ ] Refactor `packages/extension/src/range-compress.ts` so one substantive service owns:
  - [ ] Idle wait.
  - [ ] Source-leaf validation.
  - [ ] Range-plan validation.
  - [ ] Summary drafting.
  - [ ] Summary review.
  - [ ] Post-review source validation.
  - [ ] Append-only navigation and apply.
  - [ ] Marker creation.
  - [ ] Ambient UI refresh.
  - [ ] Structured operation result.
- [ ] Move range planning and request normalization into the existing planning modules and pass one immutable `RangePlan` into the shared service.
- [ ] Make the existing `/compress` handler call this service through its command context.
- [ ] Connect the existing interactive range selector to the shared service without changing its selected `RangePlan`.
- [ ] Route the pipeline event handler to the same shared service through `runSessionAction`.

## 8. Add exact pipeline range planning

- [ ] Add a pure core planner that accepts:
  - [ ] Source leaf ID.
  - [ ] Entry ID before the queued task message.
  - [ ] Last settled entry ID.
- [ ] Require the pre-task anchor and settled end entry to be on the active path.
- [ ] Locate the queued user task message immediately after the pre-task anchor in active context.
- [ ] Set the compression start boundary after the queued user task message.
- [ ] Start the selected range at the first assistant group after that task message.
- [ ] Include later user steering messages inside the continuous execution range.
- [ ] End the range at the complete atomic group that contains the settled end entry.
- [ ] Reject an incomplete assistant tool-call group.
- [ ] Reject a range that contains a protected decision or structural entry.
- [ ] Reuse `rangeCandidates()` and `planRange()` for grouping, ordering, serialization, source hash, and token totals.
- [ ] Preserve the preload context before the queued task message.
- [ ] Preserve the exact queued task message.
- [ ] Return one immutable range plan to the shared compression service.

## 9. Add event-driven pipeline compression and undo results

- [ ] Register one handler for `pi-context-tree:compress:v1:request`.
- [ ] Validate the request with TypeBox before accessing session state.
- [ ] Require `runId`, `batchId`, `operationId`, pre-task anchor ID, settled end ID, and expected queue phase.
- [ ] Reject a request whose expected phase is not `compressing`.
- [ ] Route the event path through the public Pi session-action API.
- [ ] Build the exact pipeline range plan inside the fresh session action.
- [ ] Show the selected entry count and token estimate before summary drafting.
- [ ] Draft the execution summary with the current model.
- [ ] Require the summary to preserve:
  - [ ] Files changed.
  - [ ] Important implementation decisions.
  - [ ] Exact commands and test results.
  - [ ] Failures and unresolved work.
  - [ ] Commit hashes.
- [ ] Open the summary editor and require a non-empty saved value.
- [ ] Return `cancelled` without writes when the user cancels or saves an empty value.
- [ ] Revalidate source leaf, selected IDs, source hash, run ID, and batch ID after review.
- [ ] Apply through `navigateTree(..., { summarize: false })`.
- [ ] Add run ID, batch ID, operation ID, and source hash to `ctree/range-tail` and `ctree/range-compact` v1 data.
- [ ] Emit `accepted` on `pi-context-tree:compress:v1:result` before draft and review work starts.
- [ ] Emit one matching terminal `applied`, `cancelled`, or `failed` result after the accepted request finishes.
- [ ] Derive prior applied operation results from workflow metadata on active or off-path context-tree markers.
- [ ] Return the prior result for a duplicate operation ID without another mutation.
- [ ] Extend `/undo` so a pipeline-owned range returns `undone` with the same run, batch, and operation identity.
- [ ] Apply pipeline compression with append-only tail and marker entries so original session entries remain byte-for-byte recoverable.

## 10. Add the queue plan-run coordinator

- [ ] Add `@earendil-works/pi-coding-agent@0.84.2`, `@earendil-works/pi-tui@0.84.2`, `typebox@1.3.7`, and `typescript@6.0.3` as `pi-true-queue` development dependencies and create `package-lock.json`.
- [ ] Add `tsconfig.json` with `noEmit: true` and `index.ts` as its only source file.
- [ ] Add an npm `check` script that runs `tsc -p tsconfig.json`.
- [ ] Use the Pi `0.84.2` `agent_settled` event in `pi-true-queue`.
- [ ] Add `/queue run` with no arguments as the only pipeline command.
- [ ] Route standalone queue commands and `+task` input through the existing standalone state path when no plan run is active.
- [ ] Add plan-run phases:
  - [ ] `idle`
  - [ ] `running`
  - [ ] `compressing`
  - [ ] `paused`
  - [ ] `complete`
- [ ] Persist one versioned plan-run custom entry with:
  - [ ] Run ID.
  - [ ] Canonical plan path.
  - [ ] Structure digest.
  - [ ] Current batch ID and ordinal.
  - [ ] Pre-task anchor entry ID.
  - [ ] Last settled entry ID.
  - [ ] Current phase.
  - [ ] Last compression operation ID.
  - [ ] Pause reason.
- [ ] Remove future batch body fields from the persisted plan-run schema.
- [ ] On `/queue run`, request a plan snapshot and capture its current structure digest.
- [ ] Request only the current incomplete batch body.
- [ ] Send the shared preamble and current batch as one queued user task.
- [ ] Build the queued agent message from only the fixed current-batch rule, shared preamble, and current batch Markdown.
- [ ] Record the current leaf as the pre-task anchor before `sendUserMessage()`.
- [ ] Set the phase to `running` before dispatch.
- [ ] Reject `enqueue_task` while a plan run is active.
- [ ] Route `enqueue_task` to the existing standalone enqueue path when no plan run is active.

## 11. Implement the automatic batch completion loop

- [ ] On `agent_settled`, read the last settled entry ID for the active current batch.
- [ ] Change the phase from `running` to `compressing` before the compression request.
- [ ] Persist the frozen pre-task anchor and settled end entry.
- [ ] Emit one compression request with a new operation ID.
- [ ] Start the fixed result timeout.
- [ ] Block all next-batch dispatch while compression is active.
- [ ] On `cancelled`, keep the Markdown batch incomplete and return the queue to `running`.
- [ ] Let user steering continue the same batch after cancellation.
- [ ] Emit a new compression request on the next `agent_settled`.
- [ ] Make `/queue run` retry compression for the frozen range when no new steering turn is needed.
- [ ] On `failed`, set `paused`, persist the reason, and send no next batch.
- [ ] On `applied`, request `complete_batch` with the matching run, batch, digest, and operation identity.
- [ ] Retain the applied compression operation ID when `complete_batch` fails and route retry directly to the pending checkbox write.
- [ ] Make `/queue run` retry only the pending idempotent checkbox write after this failure.
- [ ] After checkbox success, request only the next incomplete batch.
- [ ] Set `complete` and clear the active task when no incomplete batch remains.
- [ ] Dispatch the next batch only after the prior compression and checkbox write both succeed.
- [ ] Handle `/todos dump` stop results by setting `paused` and sending no next batch.

## 12. Implement automatic restart and undo reconciliation

- [ ] On queue session start, replay the latest plan-run custom entry.
- [ ] Finish recovery immediately when the replayed phase is `complete`.
- [ ] Ask `rpiv-todo` to bind the canonical incomplete plan automatically for every non-complete phase.
- [ ] Recompute and compare the structure digest.
- [ ] Scan the active path for pipeline-owned `ctree/range-compact` markers.
- [ ] Match markers by run ID, batch ID, operation ID, and source hash.
- [ ] When phase is `compressing` and no matching applied marker exists, re-emit the persisted compression operation.
- [ ] When a matching applied marker exists and the batch is unchecked, emit the idempotent `complete_batch` request.
- [ ] When the batch is checked and another incomplete batch exists, set it as current and dispatch it.
- [ ] When the batch is checked and no incomplete batch exists, set phase to `complete`.
- [ ] Set phase to `paused` with a fixed mismatch error code for every other file, queue, and marker state combination.
- [ ] On an `undone` compression result, request `reopen_batch` for the matching batch.
- [ ] Clear next-batch state that moved off the active path.
- [ ] Make the reopened batch current in `running` state.
- [ ] Restart compression on its next `agent_settled`.
- [ ] When plan text or order changes during a run, pause before another dispatch.
- [ ] On the next `/queue run`, capture the new structure digest and resume from the first incomplete batch.
- [ ] Accept status-only checkbox changes during restart by comparing the normalized structure digest.

## 13. Update existing test code

- [ ] Update existing `rpiv-todo` tests for removal of the agent tool and prompt guidance.
- [ ] Update existing `rpiv-todo` tests for canonical H1 filenames, empty sanitized names, collisions, and automatic rename.
- [ ] Update existing `rpiv-todo` tests for zero, one, and multiple incomplete project plans.
- [ ] Update existing `rpiv-todo` tests for automatic file reload, structure digest stability, targeted checkbox writes, and `/todos dump`.
- [ ] Update existing `rpiv-todo` tests for plan request/result validation, operation idempotency, and session isolation.
- [ ] Update existing `pi-context-tree` core tests for queue-anchor range planning, opening task retention, steering inclusion, and tool-call grouping.
- [ ] Update existing `pi-context-tree` extension tests for event requests, public session actions, review cancellation, stale source rejection, and exact marker metadata.
- [ ] Update existing `pi-context-tree` undo tests for `undone` pipeline results and source restoration.
- [ ] Update existing context-tree golden tests for byte-preserved source entries and tail-before-marker order.
- [ ] Update existing context-tree TUI tests for the event-started summary review.
- [ ] Update existing Pi extension-runner tests for `runSessionAction`, serialized mutation order, and stale-session rejection.
