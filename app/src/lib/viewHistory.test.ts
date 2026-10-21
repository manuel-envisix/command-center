import { describe, expect, it } from "vitest";
import type { DashboardMessage } from "../types/message";
import { upsertViewInHistory } from "./viewHistory";

function view(partial: Partial<DashboardMessage>): DashboardMessage {
  return {
    kind: "view",
    blocks: [{ type: "markdown", content: "x" }],
    ...partial,
  };
}

describe("upsertViewInHistory", () => {
  it("dedupes replay by _seq", () => {
    const first = view({ _seq: 1, title: "Hallo Manuel" });
    const r1 = upsertViewInHistory([], first);
    expect(r1.isNew).toBe(true);
    expect(r1.views).toHaveLength(1);

    const r2 = upsertViewInHistory(r1.views, first);
    expect(r2.isNew).toBe(false);
    expect(r2.views).toHaveLength(1);
  });

  it("simulates triple reconnect replay without growing history", () => {
    const msg = view({ _seq: 1, id: "v1", title: "Hallo Manuel" });
    let views: DashboardMessage[] = [];
    let isNew = false;
    for (let i = 0; i < 3; i++) {
      const r = upsertViewInHistory(views, msg);
      views = r.views;
      if (r.isNew) isNew = true;
    }
    expect(views).toHaveLength(1);
    expect(isNew).toBe(true);
  });

  it("replaces older entry when same id is newer", () => {
    const older = view({ id: "daily", _seq: 2, title: "Alt" });
    const newer = view({ id: "daily", _seq: 5, title: "Neu" });
    const mid = upsertViewInHistory([], older);
    const end = upsertViewInHistory(mid.views, newer);
    expect(end.views).toHaveLength(1);
    expect(end.views[0].title).toBe("Neu");
    expect(end.isNew).toBe(false);
  });

  it("appends distinct seq values in order", () => {
    let views: DashboardMessage[] = [];
    views = upsertViewInHistory(views, view({ _seq: 2, title: "B" })).views;
    views = upsertViewInHistory(views, view({ _seq: 1, title: "A" })).views;
    views = upsertViewInHistory(views, view({ _seq: 3, title: "C" })).views;
    expect(views.map((v) => v._seq)).toEqual([1, 2, 3]);
  });
});
