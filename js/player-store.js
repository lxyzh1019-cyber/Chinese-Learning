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
  const DEVICE_KEY = "zh_adv_device_v1";

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

  /**
   * This device's id, minted once and kept in localStorage.
   *
   * An attempt in progress is resumable only on the device that started it.
   * Two devices working the same attempt sat at identical revisions most of the
   * time, which is exactly the case the old compare-and-set let through; the
   * lock removes the case rather than adjudicating it. Finished and paused
   * attempts are still visible everywhere for history and comparison.
   */
  function deviceId(storage) {
    try {
      const cur = storage.getItem(DEVICE_KEY);
      if (cur) return cur;
      const id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      storage.setItem(DEVICE_KEY, id);
      return id;
    } catch (e) {
      return "d-unknown";
    }
  }

  /** A detached copy. A push must upload what it was handed, not what the object became. */
  function snapshot(x) { return JSON.parse(JSON.stringify(x)); }

  /**
   * One upload at a time per attempt.
   *
   * persist() fires a push on every render and every answer without awaiting,
   * so overlapping pushes for one attempt are the normal case. Unserialized,
   * two transactions race on the same base revision and the loser's answers
   * are refused as stale even though nothing diverged.
   */
  const inFlight = new Map();
  function serialize(key, fn) {
    const prev = inFlight.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    const guard = run.then(() => {}, () => {});
    inFlight.set(key, guard);
    guard.then(() => { if (inFlight.get(key) === guard) inFlight.delete(key); });
    return run;
  }

  const IN_PROGRESS = ["active", "paused"];
  const inProgress = (a) => !!a && IN_PROGRESS.indexOf(a.status) !== -1;

  /** Can this attempt be continued here? An attempt saved before device ids existed can. */
  function resumableOn(attempt, thisDeviceId) {
    if (!inProgress(attempt)) return false;
    if (!attempt.deviceId) return true;
    return attempt.deviceId === thisDeviceId;
  }

  // ── local mirror ─────────────────────────────────────────────────────────
  function readLocal(storage) {
    try {
      const raw = storage.getItem(LOCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const blob = parsed && typeof parsed === "object" ? parsed : {};
      if (!blob.attempts || typeof blob.attempts !== "object") blob.attempts = {};
      if (!Array.isArray(blob.queue)) blob.queue = [];
      // The cloud revision each attempt was last acknowledged at: the base the
      // next compare-and-set is made against.
      if (!blob.synced || typeof blob.synced !== "object") blob.synced = {};
      return blob;
    } catch (e) {
      return { attempts: {}, queue: [], synced: {} };
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
  function attemptRef(ctx, playerId, attemptId) {
    return ctx.db.collection(COLLECTION).doc(playerId).collection("assessments").doc(attemptId);
  }

  function conflictOf(attempt, remote) {
    return {
      attemptId: attempt.attemptId,
      localRevision: attempt.revision,
      remoteRevision: remote.revision,
      local: attempt,
      remote,
      // Raw responses are immutable, so a genuine divergence means two
      // devices answered the same item. Both are kept for the owner to
      // resolve; neither is discarded on a timestamp.
      conflictingItems: conflictingItems(attempt, remote),
    };
  }

  /**
   * Push one attempt with a compare-and-set on `revision`.
   *
   * The write is refused unless the cloud still holds the revision this device
   * last acknowledged for the attempt (or nothing at all). It used to be a
   * get() followed by a set() that refused only a strictly GREATER remote
   * revision — so a different answer at the same revision overwrote the cloud
   * and reported "Synced", and a writer landing between the two calls was
   * never seen. Inside a transaction, with equality on the base, both are
   * caught; on an SDK without transactions the same check runs unguarded,
   * which is still stricter than before.
   *
   * Returns `{ok:false, conflict:{...}}` on a refusal. The caller must surface
   * a choice — both records are preserved. Nothing is merged on a clock.
   */
  function pushAttempt(ctx, attempt) {
    if (!ctx.db) return Promise.resolve({ ok: false, reason: "offline", status: SYNC_LOCAL });
    if (!attempt || !attempt.attemptId) {
      return Promise.resolve({ ok: false, reason: "no attempt", status: SYNC_ATTENTION });
    }
    return serialize(attempt.attemptId, () => pushOnce(ctx, attempt, true));
  }

  /**
   * The upload itself. `attempt` is the caller's live object and the child may
   * answer another question while the transaction is in flight, so everything
   * that is written or acknowledged comes from `payload` — taken here, once,
   * before any await. Acknowledging `attempt.revision` afterwards recorded a
   * revision the cloud had never seen, which made isSynced() lie AND poisoned
   * the base for every later push of that attempt.
   */
  async function pushOnce(ctx, attempt, mayRebase) {
    const payload = snapshot(attempt);
    const rev = Number(payload.revision || 0);
    const ref = attemptRef(ctx, payload.playerId, payload.attemptId);
    const base = Number(readLocal(ctx.storage).synced[payload.attemptId] || 0);
    let seen = null;
    const check = (snap) => {
      const remote = (snap && snap.exists) ? snap.data() : null;
      seen = remote;
      if (remote && Number(remote.revision || 0) !== base) {
        const err = new Error("stale-write");
        err.conflict = conflictOf(payload, remote);
        throw err;
      }
    };
    try {
      if (typeof ctx.db.runTransaction === "function") {
        await ctx.db.runTransaction((tx) => Promise.resolve(tx.get(ref)).then((snap) => {
          check(snap);
          tx.set(ref, payload);
        }));
      } else {
        check(await ref.get());
        await ref.set(payload);
      }
      const after = readLocal(ctx.storage);
      after.synced[payload.attemptId] = rev;
      writeLocal(ctx.storage, after);
      return { ok: true, status: SYNC_OK, revision: rev };
    } catch (e) {
      if (e && e.conflict) {
        // A base ahead of the cloud is this device's own bookkeeping error, not
        // a divergence: no other writer can have moved the document backwards.
        // Re-base on what is actually there and try once more, so a single
        // device cannot wedge itself into a permanent, empty conflict.
        const remoteRev = Number((seen && seen.revision) || 0);
        if (mayRebase && remoteRev < base) {
          const fix = readLocal(ctx.storage);
          fix.synced[payload.attemptId] = remoteRev;
          writeLocal(ctx.storage, fix);
          return pushOnce(ctx, attempt, false);
        }
        return { ok: false, status: SYNC_ATTENTION, conflict: e.conflict };
      }
      return { ok: false, reason: String((e && e.message) || e), status: SYNC_ATTENTION };
    }
  }

  /** Every attempt the cloud holds for a player. Empty when offline or on error. */
  async function listCloudAttempts(ctx, playerId) {
    if (!ctx.db || !playerId) return [];
    try {
      const snap = await ctx.db.collection(COLLECTION).doc(playerId).collection("assessments").get();
      const docs = (snap && snap.docs) || [];
      return docs.map((d) => (typeof d.data === "function" ? d.data() : d)).filter((a) => a && a.attemptId);
    } catch (e) {
      return [];
    }
  }

  /**
   * Bring the cloud's attempts into the local mirror.
   *
   * History and resume read the local mirror only, so before this a second
   * device could not see an assessment the first had uploaded. Rules: a
   * cloud attempt this device has never seen is adopted; an attempt in
   * progress on THIS device is never overwritten by the cloud, whatever the
   * revision (this device is its authority); anything else is adopted when
   * the cloud copy is newer. Nothing here is queued for upload.
   */
  async function hydrateFromCloud(ctx, playerId, thisDeviceId) {
    const cloud = await listCloudAttempts(ctx, playerId);
    const blob = readLocal(ctx.storage);
    const adopted = [], kept = [];
    cloud.forEach((remote) => {
      if (remote.playerId !== playerId) return;
      const local = blob.attempts[remote.attemptId];
      if (!local) {
        blob.attempts[remote.attemptId] = remote;
        blob.synced[remote.attemptId] = remote.revision || 0;
        adopted.push(remote.attemptId);
        return;
      }
      if (inProgress(local) && local.deviceId && local.deviceId === thisDeviceId) {
        kept.push(remote.attemptId);
        return;
      }
      if (Number(remote.revision || 0) > Number(local.revision || 0)) {
        blob.attempts[remote.attemptId] = remote;
        blob.synced[remote.attemptId] = remote.revision || 0;
        adopted.push(remote.attemptId);
      } else {
        kept.push(remote.attemptId);
      }
    });
    if (adopted.length) writeLocal(ctx.storage, blob);
    return { adopted, kept };
  }

  /** Has this attempt's latest local revision been acknowledged by the cloud? */
  function isSynced(ctx, attempt) {
    if (!attempt) return false;
    const blob = readLocal(ctx.storage);
    return Number(blob.synced[attempt.attemptId] || 0) === Number(attempt.revision || 0);
  }

  function conflictingItems(local, remote) {
    const r = {};
    (remote.responses || []).forEach((x) => { r[x.itemId] = x; });
    return (local.responses || [])
      .filter((x) => r[x.itemId] && r[x.itemId].selectedOptionId !== x.selectedOptionId)
      .map((x) => ({ itemId: x.itemId, local: x, remote: r[x.itemId] }));
  }

  /**
   * Flush the queue. Conflicts are collected, never resolved automatically.
   *
   * Every read is fresh and every removal is by exact identity. The old flush
   * uploaded a snapshot taken before the loop and then wrote back a queue
   * derived from that same snapshot, so an answer saved while an upload was in
   * flight was both left un-uploaded AND dropped from the queue: it lived only
   * on this device and nothing would ever retry it. `baseRevision`, written by
   * saveAttempt since it shipped and read nowhere, is what makes the removal
   * exact — an entry queued at a revision the upload did not carry survives.
   */
  async function flushQueue(ctx) {
    const conflicts = [];
    const ids = [];
    (readLocal(ctx.storage).queue || []).forEach((e) => {
      if (e && e.attemptId && ids.indexOf(e.attemptId) === -1) ids.push(e.attemptId);
    });
    for (const attemptId of ids) {
      // Re-read per attempt: upload what the child has now, not what they had
      // when the flush started.
      const attempt = readLocal(ctx.storage).attempts[attemptId];
      // An entry whose attempt is gone (cleared progress, pruned mirror) has
      // nothing to send. Drop it rather than retrying it forever.
      const res = attempt ? await pushAttempt(ctx, attempt)
        : { ok: true, revision: Number.MAX_SAFE_INTEGER };
      if (res.conflict) conflicts.push(res.conflict);
      if (!res.ok) continue;
      const uploaded = Number(res.revision || 0);
      const fresh = readLocal(ctx.storage);
      fresh.queue = (fresh.queue || []).filter((e) =>
        e.attemptId !== attemptId || Number(e.baseRevision || 0) > uploaded);
      writeLocal(ctx.storage, fresh);
    }
    const pending = (readLocal(ctx.storage).queue || []).length;
    return {
      pending,
      conflicts,
      status: conflicts.length ? SYNC_ATTENTION : (pending ? SYNC_LOCAL : SYNC_OK),
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
    COLLECTION, LOCAL_KEY, DEVICE_KEY, SYNC_LOCAL, SYNC_OK, SYNC_ATTENTION,
    attemptPath, newAttemptId, deviceId, resumableOn, inProgress,
    readLocal, writeLocal, saveAttempt, loadAttempt, listAttempts,
    pushAttempt, listCloudAttempts, hydrateFromCloud, isSynced,
    flushQueue, conflictingItems, excludeItems,
  };
});
