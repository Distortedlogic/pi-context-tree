import { createHash } from "node:crypto";
import { estimateEntryTokens, fmtTokens } from "./estimate.ts";
import { serializeEntries, textOfContent } from "./serialize.ts";
import { type SessionTree, contextSlice } from "./tree.ts";
import type { SessionEntry } from "./types.ts";
import { CTREE_DECISION, isCustomMessageEntry, isMessageEntry } from "./types.ts";

/** One atomic, ordered selection unit on the active context path. */
export interface RangeCandidate {
	/** Stable row/group ID. It is the first entry ID in the group. */
	id: string;
	startEntryId: string;
	endEntryId: string;
	/** Entries that must be selected together, in source order. */
	entryIds: string[];
	/** Zero-based positions in contextSlice. */
	pathIndex: number;
	endPathIndex: number;
	estTokens: number;
	label: string;
	selectable: boolean;
	protected: boolean;
	protectReason?: string;
}

/** Complete, immutable input for one append-only range compaction. */
export interface RangePlan {
	sourceLeafId: string;
	anchorId: string;
	startEntryId: string;
	endEntryId: string;
	selectedEntryIds: string[];
	continuationEntryIds: string[];
	selectedEntries: SessionEntry[];
	continuationEntries: SessionEntry[];
	selectedSerialized: string;
	continuationSerialized: string;
	selectedEstTokens: number;
	/** First eight hexadecimal characters of SHA-256(selectedSerialized). */
	sourceSha8: string;
}

const LABEL_MAX = 88;

function firstLine(text: string): string {
	const line = text.split("\n", 1)[0] ?? "";
	return line.length > LABEL_MAX ? `${line.slice(0, LABEL_MAX)}…` : line;
}

function entryLabel(entry: SessionEntry): string {
	if (isMessageEntry(entry)) {
		const message = entry.message;
		switch (message.role) {
			case "user":
				return `user: ${firstLine(textOfContent(message.content))}`;
			case "assistant": {
				const text = message.content
					.filter((block) => block.type === "text")
					.map((block) => (block as { text: string }).text)
					.join(" ");
				const tools = message.content
					.filter((block) => block.type === "toolCall")
					.map((block) => (block as { name: string }).name)
					.join(", ");
				return text ? `assistant: ${firstLine(text)}` : `assistant → ${tools || "…"}`;
			}
			case "toolResult":
				return `[${message.toolName}]`;
			case "bashExecution":
				return `[bash $ ${firstLine(message.command)}]`;
			case "custom":
				return `[${message.customType}]: ${firstLine(textOfContent(message.content))}`;
			case "branchSummary":
				return `branch summary: ${firstLine(message.summary)}`;
			case "compactionSummary":
				return `compaction: ${firstLine(message.summary)}`;
		}
	}
	if (isCustomMessageEntry(entry)) {
		return `[${entry.customType}]: ${firstLine(textOfContent(entry.content))}`;
	}
	if (entry.type === "branch_summary") {
		return `branch summary: ${firstLine((entry as { summary: string }).summary)}`;
	}
	if (entry.type === "compaction") {
		return `compaction: ${firstLine((entry as { summary: string }).summary)}`;
	}
	return entry.type;
}

function makeCandidate(
	slice: readonly SessionEntry[],
	startIndex: number,
	endPathIndex: number,
	protectReason?: string,
): RangeCandidate {
	const entries = slice.slice(startIndex, endPathIndex + 1);
	const first = entries[0] as SessionEntry;
	const last = entries[entries.length - 1] as SessionEntry;
	const entryIds = entries.map((entry) => entry.id);
	const selectable = protectReason === undefined;
	const toolCount =
		isMessageEntry(first) && first.message.role === "assistant"
			? first.message.content.filter((block) => block.type === "toolCall").length
			: 0;
	const resultCount = entries.filter((entry) => isMessageEntry(entry) && entry.message.role === "toolResult").length;
	const groupSuffix =
		toolCount > 0
			? ` · ${toolCount} call${toolCount === 1 ? "" : "s"} + ${resultCount} result${resultCount === 1 ? "" : "s"}`
			: "";
	return {
		id: first.id,
		startEntryId: first.id,
		endEntryId: last.id,
		entryIds,
		pathIndex: startIndex,
		endPathIndex,
		estTokens: entries.reduce((total, entry) => total + estimateEntryTokens(entry), 0),
		label: `${entryLabel(first)}${groupSuffix}`,
		selectable,
		protected: !selectable,
		protectReason,
	};
}

/** Build safe groups only from the context that the active leaf sends to the model. */
export function rangeCandidates(tree: SessionTree, sourceLeafId: string): RangeCandidate[] {
	if (!tree.get(sourceLeafId)) throw new Error(`source leaf ${sourceLeafId} was not found`);
	const slice = contextSlice(tree, sourceLeafId);

	let incompleteUserId: string | undefined;
	for (let i = slice.length - 1; i >= 0; i--) {
		const entry = slice[i];
		if (!entry || !isMessageEntry(entry) || entry.message.role !== "user") continue;
		const hasAssistantAfter = slice
			.slice(i + 1)
			.some((later) => isMessageEntry(later) && later.message.role === "assistant");
		if (!hasAssistantAfter) incompleteUserId = entry.id;
		break;
	}

	const candidates: RangeCandidate[] = [];
	for (let i = 0; i < slice.length; i++) {
		const entry = slice[i];
		if (!entry) continue;

		if (isMessageEntry(entry) && entry.message.role === "assistant") {
			const callIds = entry.message.content
				.filter((block) => block.type === "toolCall")
				.map((block) => (block as { id: string }).id);
			if (callIds.length > 0) {
				let endPathIndex = i;
				const resultIds: string[] = [];
				while (endPathIndex + 1 < slice.length) {
					const next = slice[endPathIndex + 1];
					if (!next || !isMessageEntry(next) || next.message.role !== "toolResult") break;
					resultIds.push(next.message.toolCallId);
					endPathIndex += 1;
				}
				const callSet = new Set(callIds);
				const resultSet = new Set(resultIds);
				const complete =
					callSet.size === callIds.length &&
					resultSet.size === resultIds.length &&
					resultIds.length === callIds.length &&
					callIds.every((id) => resultSet.has(id)) &&
					resultIds.every((id) => callSet.has(id));
				const protectReason = !complete
					? "incomplete assistant tool-call group"
					: entry.parentId
						? undefined
						: "no anchor before this message group";
				candidates.push(makeCandidate(slice, i, endPathIndex, protectReason));
				i = endPathIndex;
				continue;
			}
		}

		let protectReason: string | undefined;
		if (!entry.parentId) protectReason = "no anchor before this message group";
		else if (entry.id === incompleteUserId) protectReason = "incomplete current user turn";
		else if (isCustomMessageEntry(entry) && entry.customType === CTREE_DECISION) protectReason = "decision record";
		else if (isMessageEntry(entry) && entry.message.role === "custom" && entry.message.customType === CTREE_DECISION)
			protectReason = "decision record";
		else if (
			entry.type === "branch_summary" ||
			entry.type === "compaction" ||
			(isMessageEntry(entry) && (entry.message.role === "branchSummary" || entry.message.role === "compactionSummary"))
		)
			protectReason = "structural context entry";
		else if (isMessageEntry(entry) && entry.message.role === "toolResult")
			protectReason = "tool result without its assistant tool call";

		candidates.push(makeCandidate(slice, i, i, protectReason));
	}
	return candidates;
}

function endpointPosition(tree: SessionTree, slice: readonly SessionEntry[], id: string): number {
	if (!tree.get(id)) throw new Error(`entry ${id} was not found`);
	const position = slice.findIndex((entry) => entry.id === id);
	if (position === -1) throw new Error(`entry ${id} is not on the active context path`);
	return position;
}

/** Plan one normalized, continuous range without changing the tree. */
export function planRange(tree: SessionTree, sourceLeafId: string, startId: string, endId: string): RangePlan {
	if (!tree.get(sourceLeafId)) throw new Error(`source leaf ${sourceLeafId} was not found`);
	const slice = contextSlice(tree, sourceLeafId);
	const candidates = rangeCandidates(tree, sourceLeafId);
	const startPosition = endpointPosition(tree, slice, startId);
	const endPosition = endpointPosition(tree, slice, endId);
	const normalizedStartId = startPosition <= endPosition ? startId : endId;
	const normalizedEndId = startPosition <= endPosition ? endId : startId;
	const normalizedStartPosition = Math.min(startPosition, endPosition);
	const normalizedEndPosition = Math.max(startPosition, endPosition);
	const firstGroup = candidates.find(
		(candidate) => candidate.pathIndex <= normalizedStartPosition && candidate.endPathIndex >= normalizedStartPosition,
	);
	const lastGroup = candidates.find(
		(candidate) => candidate.pathIndex <= normalizedEndPosition && candidate.endPathIndex >= normalizedEndPosition,
	);
	if (!firstGroup || !lastGroup) throw new Error("range endpoint is structural-only or missing");
	if (normalizedStartId !== firstGroup.startEntryId) {
		throw new Error(`range start ${normalizedStartId} would split a required tool-call group`);
	}
	if (normalizedEndId !== lastGroup.endEntryId) {
		throw new Error(`range end ${normalizedEndId} would split a required tool-call group`);
	}

	const firstGroupIndex = candidates.indexOf(firstGroup);
	const lastGroupIndex = candidates.indexOf(lastGroup);
	const selectedGroups = candidates.slice(firstGroupIndex, lastGroupIndex + 1);
	const blocked = selectedGroups.find((candidate) => candidate.protected);
	if (blocked) {
		throw new Error(`entry ${blocked.id} is protected: ${blocked.protectReason ?? "not selectable"}`);
	}

	const selectedEntries = slice.slice(firstGroup.pathIndex, lastGroup.endPathIndex + 1);
	const continuationEntries = slice.slice(lastGroup.endPathIndex + 1);
	const firstEntry = selectedEntries[0];
	if (!firstEntry) throw new Error("range is empty");
	const anchorId = firstEntry.parentId;
	if (!anchorId) throw new Error("range has no entry before it to use as an anchor");
	const selectedSerialized = serializeEntries(selectedEntries);
	const continuationSerialized = serializeEntries(continuationEntries);

	return {
		sourceLeafId,
		anchorId,
		startEntryId: firstGroup.startEntryId,
		endEntryId: lastGroup.endEntryId,
		selectedEntryIds: selectedEntries.map((entry) => entry.id),
		continuationEntryIds: continuationEntries.map((entry) => entry.id),
		selectedEntries,
		continuationEntries,
		selectedSerialized,
		continuationSerialized,
		selectedEstTokens: selectedEntries.reduce((total, entry) => total + estimateEntryTokens(entry), 0),
		sourceSha8: createHash("sha256").update(selectedSerialized).digest("hex").slice(0, 8),
	};
}

/** Render only the approved summary and the unchanged post-range continuation. */
export function renderRangeTail(plan: RangePlan, approvedSummary: string): string {
	const summary = approvedSummary.trim();
	if (!summary) throw new Error("approved range summary is empty");
	const header = `[ctree/range-compact: summarized ${plan.selectedEntryIds.length} entries, ~${fmtTokens(
		plan.selectedEstTokens,
	)} tokens, source ${plan.sourceSha8}. Originals preserved at leaf ${plan.sourceLeafId}.]`;
	const parts = [header, summary];
	if (plan.continuationSerialized.trim()) {
		parts.push("[unchanged continuation after compressed range]", plan.continuationSerialized);
	}
	return `${parts.join("\n\n")}\n`;
}
