"use strict";
/**
 * Words a story may use that the curriculum does not teach.
 *
 * The owner's rule for the 2026-09-17 rewrite: a story has to read the way a
 * Chinese adult would tell it to a child, and that sometimes needs a word the
 * gate lists never carry (治水, 茶馆, 皇帝). Such a word is allowed ONLY
 *
 *   - as a `bonus` token — blue in the reader, optional to tap, excluded from
 *     every game, flash deck and lesson, so a child is never quizzed on it; and
 *   - when it is listed here, with its reading and a child-facing gloss.
 *
 * build_stories.js refuses a seg token that is neither a name, nor a
 * curriculum word (any level), nor a compound of curriculum characters, nor an
 * entry here. That keeps docs/chinese-style.md's "never hand-gloss a word to
 * get past the build" true in its new form: you may, but only on this list,
 * which is one reviewable diff.
 *
 * This is NOT a dictionary source. story-dictionary.js does not read it; the
 * reading here is what seg_story.js writes into the token, and the gloss is
 * only a default the sentence may override.
 */
module.exports = {
  // ── HSK1 gates 1–3 (PR #51) ──
  "治水": { py: "zhì shuǐ", en: "to control the flood" },
  "田":   { py: "tián",     en: "field" },
  "海":   { py: "hǎi",      en: "sea" },
  "游泳": { py: "yóu yǒng", en: "to swim" },
  "放弃": { py: "fàng qì",  en: "to give up" },
  "热闹": { py: "rè nao",   en: "lively" },
  "棵":   { py: "kē",       en: "(counting word, plants)" },
  // ── HSK1 gates 4–8 ──
  "大人":   { py: "dà rén",      en: "grown-up" },
  "常常":   { py: "cháng cháng", en: "often" },
  "老鼠":   { py: "lǎo shǔ",     en: "mouse" },
  "打仗":   { py: "dǎ zhàng",    en: "to fight a war" },
  "打败":   { py: "dǎ bài",      en: "to defeat" },
  "皇帝":   { py: "huáng dì",    en: "emperor" },
  "城墙":   { py: "chéng qiáng", en: "city wall" },
  "爬山":   { py: "pá shān",     en: "to climb a mountain" },
  "山顶":   { py: "shān dǐng",   en: "mountain top" },
  "加油":   { py: "jiā yóu",     en: "keep going!" },
  "商人":   { py: "shāng rén",   en: "merchant" },
  "丝绸":   { py: "sī chóu",     en: "silk" },
  "竹子":   { py: "zhú zi",      en: "bamboo" },
  "树皮":   { py: "shù pí",      en: "tree bark" },
  "碎":     { py: "suì",         en: "in small pieces" },
  "薄薄":   { py: "báo báo",     en: "very thin" },
  "便宜":   { py: "pián yi",     en: "cheap" },
  "写字":   { py: "xiě zì",      en: "to write" },
  "有意思": { py: "yǒu yì si",   en: "interesting" },
  "聪明":   { py: "cōng ming",   en: "clever" },
  "不敢":   { py: "bù gǎn",      en: "dare not" },
  // ── HSK1 gates 9–13 ──
  "练习":     { py: "liàn xí",       en: "to practise" },
  "月亮":     { py: "yuè liang",     en: "moon" },
  "木头":     { py: "mù tou",        en: "wood" },
  "做官":     { py: "zuò guān",      en: "to be an official" },
  "种田":     { py: "zhòng tián",    en: "to farm" },
  "自由":     { py: "zì yóu",        en: "free" },
  "难过":     { py: "nán guò",       en: "sad" },
  "骑马":     { py: "qí mǎ",         en: "to ride a horse" },
  "窗边":     { py: "chuāng biān",   en: "by the window" },
  "小孩":     { py: "xiǎo hái",      en: "child" },
  "心里":     { py: "xīn lǐ",        en: "in the heart" },
  "一点":     { py: "yì diǎn",       en: "a little" },
  "两边":     { py: "liǎng biān",    en: "both sides" },
  "上去":     { py: "shàng qù",      en: "up; on top" },
  "做出":     { py: "zuò chū",       en: "to make; to produce" },
  "吃到":     { py: "chī dào",       en: "to get to eat" },
  "拿出":     { py: "ná chū",        en: "to take out" },
  "看起来":   { py: "kàn qǐ lái",    en: "to look (a certain way)" },
  "没有意思": { py: "méi yǒu yì si", en: "boring" },
  "稻子":     { py: "dào zi",        en: "rice plants" },
  "吹":       { py: "chuī",          en: "to blow" },
  "墨":       { py: "mò",            en: "ink" },
};
