import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionTree, planRange } from "@pi-context-tree/core";
import { describe, expect, it } from "vitest";
import type { CtxLike } from "../src/adapter.ts";
import { executePanelAction, openPanel, registerPanel } from "../src/panel-cmd.ts";
import { type FakeWorld, entriesByType, makeFake } from "./fake-pi.ts";

interface CapturedMount {
	options?: { overlay?: boolean; overlayOptions?: { width?: string; maxHeight?: string } };
	panel?: { opts?: { maxBody?: number } };
}

function rangePlan(w: FakeWorld) {
	w.session.user("root");
	w.session.assistant("anchor");
	const start = w.session.user("selected work");
	const end = w.session.assistant("selected result");
	w.session.user("continuation question");
	const leaf = w.session.assistant("continuation answer");
	return planRange(SessionTree.fromEntries(w.session.entries), leaf, start, end);
}

describe("panel reopens after an action (mockup: the panel stays up)", () => {
	it("executes a jump, reopens with fresh state, and stops on close", async () => {
		const w = makeFake();
		w.session.user("kickoff");
		const target = w.session.assistant("plan");
		w.session.user("later");
		const queue: unknown[] = [{ type: "jump", entryId: target }, { type: "close" }];
		let opens = 0;
		w.ui.custom = async <T>(): Promise<T> => {
			opens += 1;
			return queue.shift() as T;
		};
		registerPanel(w.pi, { draft: async () => "unused" });

		await w.commands.get("panel")?.("", w.ctx);

		expect(opens).toBe(2); // reopened once after the jump, closed on the second action
		expect(w.calls.navigate).toEqual([{ target, options: { summarize: false } }]);
	});

	it("stops immediately when the panel is dismissed without an action", async () => {
		const w = makeFake();
		w.session.user("kickoff");
		let opens = 0;
		w.ui.custom = async <T>(): Promise<T> => {
			opens += 1;
			return undefined as T;
		};
		registerPanel(w.pi, { draft: async () => "unused" });
		await w.commands.get("panel")?.("", w.ctx);
		expect(opens).toBe(1);
	});
});

describe("panel range actions", () => {
	it("dispatches range-apply through the dynamic range module with default panel instructions", async () => {
		const w = makeFake();
		const plan = rangePlan(w);
		let draftUser = "";
		w.ui.editorQueue.push("__ACCEPT_PREFILL__");

		await executePanelAction(
			w.pi,
			w.ctx,
			{ type: "range-apply", plan },
			{
				draft: async (_ctx, _model, _system, user) => {
					draftUser = user;
					return "approved panel summary";
				},
			},
		);

		expect(draftUser).toContain("Create a concise continuation summary");
		expect(entriesByType(w.session, "custom_message", "ctree/range-tail")).toHaveLength(1);
		expect(entriesByType(w.session, "custom", "ctree/range-compact")).toHaveLength(1);
	});

	it("rejects range mutation without command context", async () => {
		const w = makeFake();
		const plan = rangePlan(w);
		const viewOnlyCtx: CtxLike = {
			ui: w.ui,
			sessionManager: w.ctx.sessionManager,
			model: w.ctx.model,
			modelRegistry: w.ctx.modelRegistry,
			getContextUsage: w.ctx.getContextUsage,
		};

		await executePanelAction(w.pi, viewOnlyCtx, { type: "range-apply", plan }, { draft: async () => "unused" });

		expect(w.ui.notes().some((note) => note.includes("needs a command context"))).toBe(true);
		expect(entriesByType(w.session, "custom_message", "ctree/range-tail")).toHaveLength(0);
	});

	it("revalidates sourceLeafId before dispatch writes or drafts", async () => {
		const w = makeFake();
		const plan = rangePlan(w);
		w.session.user("new leaf after panel selection");
		let drafted = false;

		await executePanelAction(
			w.pi,
			w.ctx,
			{ type: "range-apply", plan },
			{
				draft: async () => {
					drafted = true;
					return "must not run";
				},
			},
		);

		expect(drafted).toBe(false);
		expect(w.calls.navigate).toHaveLength(0);
		expect(entriesByType(w.session, "custom_message", "ctree/range-tail")).toHaveLength(0);
		expect(w.ui.notes().some((note) => note.includes("session changed"))).toBe(true);
	});
});

describe("panel keyboard shortcut", () => {
	// Keys that pi binds (app + tui + tree) or the terminal eats as control chars.
	// Our shortcut must avoid all of these or pi silently skips it (ctrl+t did).
	const PI_BOUND_OR_RESERVED = new Set([
		"ctrl+a",
		"ctrl+b",
		"ctrl+c",
		"ctrl+d",
		"ctrl+g",
		"ctrl+l",
		"ctrl+n",
		"ctrl+o",
		"ctrl+p",
		"ctrl+r",
		"ctrl+s",
		"ctrl+t",
		"ctrl+u",
		"ctrl+v",
		"ctrl+x",
		"ctrl+z",
		"ctrl+h",
		"ctrl+i",
		"ctrl+j",
		"ctrl+m", // ASCII backspace/tab/enter(LF)/enter(CR)
	]);

	it("registers exactly ctrl+q — free in pi and deliverable in raw mode", () => {
		const w = makeFake();
		registerPanel(w.pi, { draft: async () => "" });
		const keys = [...w.shortcuts.keys()];
		expect(keys).toEqual(["ctrl+q"]);
		expect(PI_BOUND_OR_RESERVED.has(keys[0] ?? ""), `${keys[0]} collides with a pi/terminal key`).toBe(false);
	});

	it("the shortcut opens the panel", async () => {
		const w = makeFake();
		w.session.user("hi");
		let opened = false;
		w.ui.custom = async <T>(): Promise<T> => {
			opened = true;
			return { type: "close" } as T;
		};
		registerPanel(w.pi, { draft: async () => "" });
		await w.shortcuts.get("ctrl+q")?.(w.ctx);
		expect(opened).toBe(true);
	});
});

describe("openPanel overlay host", () => {
	it("mounts full-screen: width 100% and body rows sized from the terminal", async () => {
		const w = makeFake();
		w.session.user("hello");
		const captured: CapturedMount = {};
		w.ui.custom = async <T>(factory: unknown, options?: unknown): Promise<T> => {
			captured.options = options as CapturedMount["options"];
			const f = factory as (tui: unknown, theme: unknown, kb: unknown, done: (a: unknown) => void) => unknown;
			captured.panel = f({ terminal: { rows: 40, columns: 120 } }, undefined, undefined, () => {}) as {
				opts?: { maxBody?: number };
			};
			return undefined as T;
		};

		await openPanel(w.pi, w.ctx, {});

		expect(captured.options?.overlay).toBe(true);
		expect(captured.options?.overlayOptions?.width).toBe("100%");
		// 40 terminal rows minus panel chrome (header, gauge, dividers, secthead, footer, notify, scroll hint)
		expect(captured.panel?.opts?.maxBody).toBe(31);
	});

	it("lists records as text when the panel host is unavailable (/decisions outside the TUI)", async () => {
		const w = makeFake(); // FakeUi has no ui.custom by default — same as pi RPC/headless
		w.session.user("kickoff");
		const a = w.session.assistant("plan");
		w.session.append({
			type: "custom",
			customType: "ctree/fork",
			data: { v: 1, name: "feat-x", parentEntryId: a, trunkModel: "anthropic/opus-4.8", status: "open" },
		});
		w.session.append({
			type: "custom_message",
			customType: "ctree/decision",
			content: "## Decision: feat-x\n**Outcome:** tmpdir collision fixed.",
			display: true,
			details: { v: 1, forkEntryId: "x003", branchName: "feat-x" },
		});
		registerPanel(w.pi, { draft: async () => "unused" });

		await w.commands.get("decisions")?.("", w.ctx);

		const notes = w.ui.notes().join("\n");
		expect(notes).toContain("◆ feat-x");
		expect(notes).toContain("tmpdir collision fixed");
		expect(notes).not.toContain("needs pi's interactive TUI");
	});

	it("says so when there are no records to list", async () => {
		const w = makeFake();
		w.session.user("kickoff");
		registerPanel(w.pi, { draft: async () => "unused" });
		await w.commands.get("decisions")?.("", w.ctx);
		expect(w.ui.notes().some((n) => n.includes("no decision records"))).toBe(true);
	});

	it("/decisions --export writes the trunk records to a markdown file", async () => {
		const w = makeFake();
		w.session.user("kickoff");
		const a = w.session.assistant("plan");
		w.session.append({
			type: "custom",
			customType: "ctree/fork",
			data: { v: 1, name: "feat-x", parentEntryId: a, trunkModel: "anthropic/opus-4.8", status: "open" },
		});
		w.session.append({
			type: "custom_message",
			customType: "ctree/decision",
			content: "## Decision: feat-x\n**Outcome:** shipped the importer.",
			display: true,
			details: { v: 1, forkEntryId: "x003", branchName: "feat-x" },
		});
		registerPanel(w.pi, { draft: async () => "unused" });

		const out = join(tmpdir(), "ctree-decisions-export.test.md");
		await w.commands.get("decisions")?.(`--export ${out}`, w.ctx);

		const md = readFileSync(out, "utf8");
		expect(md).toContain("# Decision records");
		expect(md).toContain("## Decision: feat-x");
		expect(md).toContain("shipped the importer");
		expect(w.ui.notes().some((n) => n.includes("wrote 1 decision record"))).toBe(true);
	});

	it("falls back to a sane body size when the host exposes no terminal dims", async () => {
		const w = makeFake();
		w.session.user("hello");
		const captured: CapturedMount = {};
		w.ui.custom = async <T>(factory: unknown): Promise<T> => {
			const f = factory as (tui: unknown, theme: unknown, kb: unknown, done: (a: unknown) => void) => unknown;
			captured.panel = f({}, undefined, undefined, () => {}) as { opts?: { maxBody?: number } };
			return undefined as T;
		};

		await openPanel(w.pi, w.ctx, {});

		expect(captured.panel?.opts?.maxBody).toBeGreaterThanOrEqual(20);
	});
});
