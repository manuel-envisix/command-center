import type { DashboardMessage } from "../types/message";
import { isViewMessage } from "../types/message";

export interface UpsertViewResult {
  views: DashboardMessage[];
  isNew: boolean;
}

function isNewer(a: DashboardMessage, b: DashboardMessage): boolean {
  const seqA = a._seq ?? 0;
  const seqB = b._seq ?? 0;
  if (seqA !== seqB) return seqA > seqB;
  const tsA = a._receivedAt ?? 0;
  const tsB = b._receivedAt ?? 0;
  return tsA > tsB;
}

/** Idempotent merge for relay history replay and live pushes. */
export function upsertViewInHistory(
  prev: DashboardMessage[],
  msg: DashboardMessage,
): UpsertViewResult {
  if (!isViewMessage(msg)) {
    return { views: prev, isNew: false };
  }

  if (msg._seq != null) {
    const bySeq = prev.findIndex((v) => v._seq === msg._seq);
    if (bySeq >= 0) {
      return { views: prev, isNew: false };
    }
  }

  if (msg.id) {
    const byId = prev.findIndex((v) => v.id === msg.id);
    if (byId >= 0) {
      const existing = prev[byId];
      if (!isNewer(msg, existing)) {
        return { views: prev, isNew: false };
      }
      const views = [...prev];
      views[byId] = msg;
      return { views, isNew: false };
    }
  }

  const views = [...prev, msg].sort((a, b) => (a._seq ?? 0) - (b._seq ?? 0));
  return { views, isNew: true };
}
