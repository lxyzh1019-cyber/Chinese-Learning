"use strict";
/**
 * Orders the sentence builder accepts besides the one in the story.
 *
 * checkSB compares the child's chips against ONE string. The generator's
 * screens reject any sentence they can see a second order for, but they are a
 * lower bound (build_sentence_packs.js), so this is the place to record an
 * order a reviewer knows is equally good Chinese. The key is the answer as
 * stored in the pack (with its full stop); each alternate must use exactly the
 * same chips — validate_sentence_packs.js checks that — and is shown nowhere:
 * the reveal card still teaches the story's order.
 *
 * Keep it short. An entry here is a content decision, not a grammar rule.
 */
module.exports = {
  // "我们八点出门。": ["八点我们出门。"],
};
