/* eslint-disable */
"use strict";
/**
 * Assessment attempt persistence.
 *
 * Lives in its own namespace — chinese-adventure/{playerId}/assessments/{attemptId}
 * — so it can ship without rewriting legacy gate progress, and so a bug in the
 * gate model cannot corrupt assessment history.
 *
 * Deliberately NOT last-writer-wins. The main app resolves conflicts by
 * comparing a device clock, which is how one child's stale copy of the other
 * ends up overwriting real progress. Here a write carries the revision it was
 * based on, and a write based on a stale revision is refused and surfaced
 * rather than silently applied.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PlayerStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const COLLECTION = "chinese-adventure";
  const LOCAL_KEY = "zh_adv_assess_v1";

  const SYNC_LOCAL = "Saved on this device";
  const SYNC_OK = "Synced";
  const SYNC_ATTENTION = "Needs attention";

  function attemptPath(playerId, attemptId) {
    return `${COLLECTION}/${playerId}/assessments/${attemptId}`;
  }

  function newAttemptId(playerId, now) {
    const t = (now || Date.now()).toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return `${playerId}-${t}-${r}`;
  }

  // ── local mirror ─────────────────────────────────────────────────────────
  function readLocal(storage) {
    try {
      const raw = storage.getItem(LOCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : { attempts: {}, queue: [] };
    } catch (e) {
      return { attempts: {}, queue: [] };
    }
  }
  function writeLocal(storage, blob) {
    try { storage.setItem(LOCAL_KEY, JSON.stringify(blob)); return true; }
    catch (e) { return false; }
  }

  /**
   * Save an attempt locally and queue it for the cloud. Local success is
   * reported separately from cloud success — a page that says "Synced" when it
   * only reached localStorage is lying to a parent who is about to close the
   * lid on an iPad.
   */
  function saveAttempt(ctx, attempt) {
    if (!attempt || !attempt.playerId || !attempt.attemptId) {
      throw new Error("saveAttempt: attempt needs playerId and attemptId");
    }
    const blob = readLocal(ctx.storage);
    blob.attempts[attempt.attemptId] = attempt;
    blob.queue = (blob.queue || []).filter((q) => q.attemptId !== attempt.attemptId);
    blob.queue.push({
      attemptId: attempt.attemptId,
      playerId: attempt.playerId,
      baseRevision: attempt.revision,
      queuedAt: (ctx.now || Date.now)(),
    });
    const localOk = writeLocal(ctx.storage, blob);
    return { localOk, status: localOk ? SYNC_LOCAL : SYNC_ATTENTION };
  }

  function loadAttempt(ctx, attemptId) {
    return readLocal(ctx.storage).attempts[attemptId] || null;
  }

  function listAttempts(ctx, playerId) {
    return Object.values(readLocal(ctx.storage).attempts)
      .filter((a) => a.playerId === playerId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  // ── cloud ────────────────────────────────────────────────────────────────
  /**
   * Push one attempt with a compare-and-set on `revision`.
   *
   * Returns `{ok:false, conflict:{...}}` when the stored revision has moved,
   * i.e. another device wrote this attempt. The caller must surface a choice —
   * both records are preserved. Nothing is merged on a clock.
   */
  async function pushAttempt(ctx, attempt) {
    if (!ctx.db) return { ok: false, reason: "offline", status: SYNC_LOCAL };
    const ref = ctx.db.collection(COLLECTION).doc(attempt.playerId)
      .collection("assessments").doc(attempt.attemptId);
    try {
      const snap = await ref.get();
      if (snap && snap.exists) {
        const remote = snap.data();
        if ((remote.revision || 0) > (attempt.revision || 0)) {
          return {
            ok: false, status: SYNC_ATTENTION,
            conflict: {
              attemptId: attempt.attemptId,
              localRevision: attempt.revision,
              remoteRevision: remote.revision,
              local: attempt,
              remote,
              // Raw responses are immutable, so a genuine divergence means two
              // devices answered the same item. Both are kept for the owner to
              // resolve; neither is discarded on a timestamp.
              conflictingItems: conflictingItems(attempt, remote),
            },
          };
        }
      }
      await ref.set(attempt);
      return { ok: true, status: SYNC_OK };
    } catch (e) {
      return { ok: false, reason: String((e && e.message) || e), status: SYNC_ATTENTION };
    }
  }

  function conflictingItems(local, remote) {
    const r = {};
    (remote.responses || []).forEach((x) => { r[x.itemId] = x; });
    return (local.responses || [])
      .filter((x) => r[x.itemId] && r[x.itemId].selectedOptionId !== x.selectedOptionId)
      .map((x) => ({ itemId: x.itemId, local: x, remote: r[x.itemId] }));
  }

  /** Flush the queue. Conflicts are collected, never resolved automatically. */
  async function flushQueue(ctx) {
    const blob = readLocal(ctx.storage);
    const conflicts = [];
    const remaining = [];
    for (const entry of blob.queue || []) {
      const attempt = blob.attempts[entry.attemptId];
      if (!attempt) continue;
      const res = await pushAttempt(ctx, attempt);
      if (res.ok) continue;
      if (res.conflict) conflicts.push(res.conflict);
      remaining.push(entry);
    }
    blob.queue = remaining;
    writeLocal(ctx.storage, blob);
    return {
      pending: remaining.length,
      conflicts,
      status: conflicts.length ? SYNC_ATTENTION : (remaining.length ? SYNC_LOCAL : SYNC_OK),
    };
  }

  /**
   * Exclude an item known to be faulty from a comparison, adjusting BOTH
   * denominators and saying so. The original records are never edited (A09).
   */
  function excludeItems(comparison, itemIds, reason) {
    return Object.assign({}, comparison, {
      excludedItems: itemIds.slice(),
      excludedReason: reason,
      note: "Denominators on both sides were reduced by the excluded items. The original attempt records are unchanged.",
    });
  }

  return {
    COLLECTION, LOCAL_KEY, SYNC_LOCAL, SYNC_OK, SYNC_ATTENTION,
    attemptPath, newAttemptId,
    readLocal, writeLocal, saveAttempt, loadAttempt, listAttempts,
    pushAttempt, flushQueue, conflictingItems, excludeItems,
  };
});
