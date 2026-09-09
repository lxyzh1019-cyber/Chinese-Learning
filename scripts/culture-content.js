"use strict";
/**
 * The authored text for the culture readings.
 *
 * All 29 entries — 24 solar terms and 5 festivals — previously shared one
 * three-paragraph template. Paragraphs two and three were byte-identical across
 * every entry, paragraph one was the title dropped into a fixed sentence, and
 * both "comprehension" questions asked about the instructions rather than about
 * anything the child had read. The 立春 entry said 立春 was an important cultural
 * topic, told the child to ask a parent for pinyin about twenty per cent of the
 * time, and asked how the story related to seasons, family or festivals. There
 * was no story.
 *
 * Each entry here says what the term or festival actually is, at the level its
 * `hskBand` claims, and asks two questions the passage answers. Reviewed by:
 * model. **No educator has checked these**, the same standing caveat the
 * vocabulary and story corpora carry.
 */
module.exports = {
  // ── the 24 solar terms, in order round the year ────────────────────────
  term_01_li_chun: {
    paragraphs: [
      "立春是二十四节气里的第一个。",
      "这时候天还很冷，可是白天一天比一天长了。",
      "有的地方在这一天吃春饼，这叫“咬春”。",
    ],
    words: [
      { zh: "立春", py: "lì chūn", en: "Start of Spring" },
      { zh: "节气", py: "jié qi", en: "solar term" },
      { zh: "春饼", py: "chūn bǐng", en: "spring pancake" },
      { zh: "白天", py: "bái tiān", en: "daytime" },
    ],
    questions: [
      { question: "立春是第几个节气？", answer: "第一个。" },
      { question: "有的地方在立春这一天吃什么？", answer: "春饼。" },
    ],
  },
  term_02_yu_shui: {
    paragraphs: [
      "雨水的时候，天上下的雪慢慢变成了雨。",
      "雨多了以后，田里的土也软了。",
      "种田的人开始准备种东西。",
    ],
    words: [
      { zh: "雨水", py: "yǔ shuǐ", en: "Rain Water" },
      { zh: "雪", py: "xuě", en: "snow" },
      { zh: "土", py: "tǔ", en: "earth; soil" },
      { zh: "准备", py: "zhǔn bèi", en: "to get ready" },
    ],
    questions: [
      { question: "雨水的时候，雪变成了什么？", answer: "雨。" },
      { question: "种田的人开始做什么？", answer: "准备种东西。" },
    ],
  },
  term_03_jing_zhe: {
    paragraphs: [
      "惊蛰的时候，天上开始打雷。",
      "睡了一个冬天的虫子听到雷声，就醒过来了。",
      "“惊”是吓一跳的意思，所以这个节气叫惊蛰。",
    ],
    words: [
      { zh: "惊蛰", py: "jīng zhé", en: "Awakening of Insects" },
      { zh: "雷", py: "léi", en: "thunder" },
      { zh: "虫子", py: "chóng zi", en: "insect" },
      { zh: "醒", py: "xǐng", en: "to wake up" },
    ],
    questions: [
      { question: "什么声音把虫子叫醒了？", answer: "雷声。" },
      { question: "虫子睡了多久？", answer: "一个冬天。" },
    ],
  },
  term_04_chun_fen: {
    paragraphs: [
      "春分这一天，白天和晚上一样长。",
      "春分以后，白天一天比一天长。",
      "天气也慢慢暖和起来，草和花都开始长了。",
    ],
    words: [
      { zh: "春分", py: "chūn fēn", en: "Spring Equinox" },
      { zh: "一样", py: "yí yàng", en: "the same" },
      { zh: "暖和", py: "nuǎn huo", en: "warm" },
      { zh: "花", py: "huā", en: "flower" },
    ],
    questions: [
      { question: "春分这一天，白天和晚上有什么关系？", answer: "一样长。" },
      { question: "春分以后，白天怎么样？", answer: "一天比一天长。" },
    ],
  },
  term_05_qing_ming_term: {
    paragraphs: [
      "到了清明，天气变得又清又明，所以叫清明。",
      "这时候雨水多，草和树长得特别快。",
      "很多人在这几天去种树，也去看过去的家人。",
    ],
    words: [
      { zh: "清明", py: "qīng míng", en: "Clear and Bright" },
      { zh: "清", py: "qīng", en: "clear" },
      { zh: "明", py: "míng", en: "bright" },
      { zh: "种树", py: "zhòng shù", en: "to plant trees" },
    ],
    questions: [
      { question: "为什么这个节气叫清明？", answer: "因为天气变得又清又明。" },
      { question: "人们在清明这几天做什么？", answer: "去种树，也去看过去的家人。" },
    ],
  },
  term_06_gu_yu: {
    paragraphs: [
      "谷雨是春天的最后一个节气。",
      "这时候雨下得多，田里的谷子长得很快。",
      "种田的人有一句话：“雨生百谷。”",
    ],
    words: [
      { zh: "谷雨", py: "gǔ yǔ", en: "Grain Rain" },
      { zh: "谷子", py: "gǔ zi", en: "grain" },
      { zh: "最后", py: "zuì hòu", en: "last" },
      { zh: "长", py: "zhǎng", en: "to grow" },
    ],
    questions: [
      { question: "谷雨是春天的第几个节气？", answer: "最后一个。" },
      { question: "为什么这个节气叫谷雨？", answer: "因为雨多，谷子长得快。" },
    ],
  },
  term_07_li_xia: {
    paragraphs: [
      "立夏是夏天的第一个节气。",
      "天气开始热起来，田里的东西长得很快。",
      "有的地方在这一天吃鸡蛋，希望夏天身体好。",
    ],
    words: [
      { zh: "立夏", py: "lì xià", en: "Start of Summer" },
      { zh: "夏天", py: "xià tiān", en: "summer" },
      { zh: "鸡蛋", py: "jī dàn", en: "egg" },
      { zh: "身体", py: "shēn tǐ", en: "body; health" },
    ],
    questions: [
      { question: "立夏是哪个季节的第一个节气？", answer: "夏天。" },
      { question: "有的地方在立夏这一天吃什么？", answer: "鸡蛋。" },
    ],
  },
  term_08_xiao_man: {
    paragraphs: [
      "小满的时候，田里的麦子已经开始长了，可是还不满。",
      "因为还没有满，所以这个节气叫小满。",
      "种田的人知道，再过一些日子就可以收了。",
    ],
    words: [
      { zh: "小满", py: "xiǎo mǎn", en: "Grain Buds" },
      { zh: "麦子", py: "mài zi", en: "wheat" },
      { zh: "满", py: "mǎn", en: "full" },
      { zh: "收", py: "shōu", en: "to harvest" },
    ],
    questions: [
      { question: "小满的时候，麦子长满了没有？", answer: "还没有满。" },
      { question: "为什么这个节气叫小满？", answer: "因为麦子开始长了，可是还不满。" },
    ],
  },
  term_09_mang_zhong: {
    paragraphs: [
      "芒种是一年里最忙的时候。",
      "种田的人一边收麦子，一边种稻子。",
      "有一句话说：“芒种忙，两头忙。”",
    ],
    words: [
      { zh: "芒种", py: "máng zhòng", en: "Grain in Ear" },
      { zh: "忙", py: "máng", en: "busy" },
      { zh: "收", py: "shōu", en: "to harvest" },
      { zh: "稻子", py: "dào zi", en: "rice plants" },
    ],
    questions: [
      { question: "为什么芒种很忙？", answer: "因为一边收麦子，一边种稻子。" },
      { question: "“两头忙”说的是哪两件事？", answer: "收麦子和种稻子。" },
    ],
  },
  term_10_xia_zhi: {
    paragraphs: [
      "夏至这一天，白天最长，晚上最短。",
      "夏至以后，白天就一天比一天短了。",
      "有的地方在这一天吃面，说吃了面夏天就好过。",
    ],
    words: [
      { zh: "夏至", py: "xià zhì", en: "Summer Solstice" },
      { zh: "长", py: "cháng", en: "long" },
      { zh: "短", py: "duǎn", en: "short" },
      { zh: "面", py: "miàn", en: "noodles" },
    ],
    questions: [
      { question: "夏至这一天，白天怎么样？", answer: "最长。" },
      { question: "夏至以后，白天怎么样？", answer: "一天比一天短。" },
    ],
  },
  term_11_xiao_shu: {
    paragraphs: [
      "小暑的时候，天气已经很热了，但是还不是一年里最热的时候。",
      "这几天常常下大雨，雨停了以后反而更闷。",
      "人们一般早上或者晚上出门，中午在家里休息。",
    ],
    words: [
      { zh: "小暑", py: "xiǎo shǔ", en: "Minor Heat" },
      { zh: "闷", py: "mēn", en: "muggy; stuffy" },
      { zh: "休息", py: "xiū xi", en: "to rest" },
      { zh: "出门", py: "chū mén", en: "to go out" },
    ],
    questions: [
      { question: "小暑是一年里最热的时候吗？", answer: "不是，还不是最热的时候。" },
      { question: "人们为什么中午在家里休息？", answer: "因为中午太热。" },
    ],
  },
  term_12_da_shu: {
    paragraphs: [
      "大暑是一年里最热的时候。",
      "太阳很大，地上的水很快就干了。",
      "老人常说，这些日子要多喝水，少在外面走。",
    ],
    words: [
      { zh: "大暑", py: "dà shǔ", en: "Major Heat" },
      { zh: "太阳", py: "tài yáng", en: "sun" },
      { zh: "干", py: "gān", en: "dry" },
      { zh: "喝水", py: "hē shuǐ", en: "to drink water" },
    ],
    questions: [
      { question: "大暑是什么时候？", answer: "一年里最热的时候。" },
      { question: "老人说这些日子要注意什么？", answer: "多喝水，少在外面走。" },
    ],
  },
  term_13_li_qiu: {
    paragraphs: [
      "立秋是秋天的第一个节气。",
      "虽然叫立秋，可是天气还很热，人们把这时候的热叫“秋老虎”。",
      "早上和晚上开始凉一点，树上的叶子也慢慢变黄了。",
    ],
    words: [
      { zh: "立秋", py: "lì qiū", en: "Start of Autumn" },
      { zh: "秋天", py: "qiū tiān", en: "autumn" },
      { zh: "凉", py: "liáng", en: "cool" },
      { zh: "叶子", py: "yè zi", en: "leaf" },
    ],
    questions: [
      { question: "立秋以后天气马上就凉了吗？", answer: "没有，还很热，人们叫它“秋老虎”。" },
      { question: "什么慢慢变黄了？", answer: "树上的叶子。" },
    ],
  },
  term_14_chu_shu: {
    paragraphs: [
      "处暑的“处”是停下来的意思。",
      "到了处暑，最热的日子就要过去了。",
      "天气一天比一天凉，晚上睡觉要多盖一点。",
    ],
    words: [
      { zh: "处暑", py: "chǔ shǔ", en: "End of Heat" },
      { zh: "停", py: "tíng", en: "to stop" },
      { zh: "凉", py: "liáng", en: "cool" },
      { zh: "盖", py: "gài", en: "to cover" },
    ],
    questions: [
      { question: "处暑的“处”是什么意思？", answer: "停下来。" },
      { question: "处暑以后天气怎么样？", answer: "一天比一天凉。" },
    ],
  },
  term_15_bai_lu: {
    paragraphs: [
      "白露的时候，早上的草上有很多小水点，看起来是白的。",
      "这些水叫露水，是晚上天冷的时候出来的。",
      "有一句话说：“白露秋分夜，一夜凉一夜。”",
    ],
    words: [
      { zh: "白露", py: "bái lù", en: "White Dew" },
      { zh: "露水", py: "lù shuǐ", en: "dew" },
      { zh: "草", py: "cǎo", en: "grass" },
      { zh: "夜", py: "yè", en: "night" },
    ],
    questions: [
      { question: "白露的时候，早上的草上有什么？", answer: "露水。" },
      { question: "露水是什么时候出来的？", answer: "晚上天冷的时候。" },
    ],
  },
  term_16_qiu_fen: {
    paragraphs: [
      "秋分这一天，白天和晚上一样长。",
      "秋分以后，晚上就比白天长了。",
      "田里的东西这时候差不多都收好了。",
    ],
    words: [
      { zh: "秋分", py: "qiū fēn", en: "Autumn Equinox" },
      { zh: "一样", py: "yí yàng", en: "the same" },
      { zh: "收", py: "shōu", en: "to harvest" },
      { zh: "田", py: "tián", en: "field" },
    ],
    questions: [
      { question: "秋分这一天，白天和晚上有什么关系？", answer: "一样长。" },
      { question: "秋分以后，白天和晚上哪个长？", answer: "晚上。" },
    ],
  },
  term_17_han_lu: {
    paragraphs: [
      "寒露的时候，早上的露水已经很凉了。",
      "天气比白露的时候更冷，很多地方要开始穿厚一点的衣服。",
      "南方田里的稻子这时候差不多可以收了。",
    ],
    words: [
      { zh: "寒露", py: "hán lù", en: "Cold Dew" },
      { zh: "寒", py: "hán", en: "cold" },
      { zh: "衣服", py: "yī fu", en: "clothes" },
      { zh: "厚", py: "hòu", en: "thick" },
    ],
    questions: [
      { question: "寒露的露水和白露的比，怎么样？", answer: "更凉、更冷。" },
      { question: "这时候人们要开始做什么？", answer: "穿厚一点的衣服。" },
    ],
  },
  term_18_shuang_jiang: {
    paragraphs: [
      "霜降是秋天的最后一个节气。",
      "天气冷了以后，早上地上会有一层白白的霜。",
      "有的水果，比如柿子，霜降以后反而更甜。",
    ],
    words: [
      { zh: "霜降", py: "shuāng jiàng", en: "Frost's Descent" },
      { zh: "霜", py: "shuāng", en: "frost" },
      { zh: "甜", py: "tián", en: "sweet" },
      { zh: "柿子", py: "shì zi", en: "persimmon" },
    ],
    questions: [
      { question: "霜降是秋天的第几个节气？", answer: "最后一个。" },
      { question: "霜降以后，什么水果更甜？", answer: "柿子。" },
    ],
  },
  term_19_li_dong: {
    paragraphs: [
      "立冬是冬天的第一个节气。",
      "天气冷了，田里的活也做完了，人们开始休息。",
      "北方有的地方在立冬这一天吃饺子。",
    ],
    words: [
      { zh: "立冬", py: "lì dōng", en: "Start of Winter" },
      { zh: "冬天", py: "dōng tiān", en: "winter" },
      { zh: "休息", py: "xiū xi", en: "to rest" },
      { zh: "饺子", py: "jiǎo zi", en: "dumplings" },
    ],
    questions: [
      { question: "立冬是哪个季节的第一个节气？", answer: "冬天。" },
      { question: "北方有的地方在立冬这一天吃什么？", answer: "饺子。" },
    ],
  },
  term_20_xiao_xue: {
    paragraphs: [
      "小雪的时候，北方开始下雪，可是雪不大。",
      "雪下了一会儿就化了，地上还不会一直是白的。",
      "路上有一点滑，出门的时候要小心。",
    ],
    words: [
      { zh: "小雪", py: "xiǎo xuě", en: "Minor Snow" },
      { zh: "下雪", py: "xià xuě", en: "to snow" },
      { zh: "化", py: "huà", en: "to melt" },
      { zh: "滑", py: "huá", en: "slippery" },
    ],
    questions: [
      { question: "小雪的时候，雪大不大？", answer: "不大。" },
      { question: "出门的时候要注意什么？", answer: "路上有一点滑，要小心。" },
    ],
  },
  term_21_da_xue: {
    paragraphs: [
      "大雪的时候，雪下得比小雪多多了。",
      "有的地方一早起来，外面已经全白了。",
      "孩子们喜欢在雪里玩，大人说这些雪对田里的东西也好。",
    ],
    words: [
      { zh: "大雪", py: "dà xuě", en: "Major Snow" },
      { zh: "全", py: "quán", en: "entirely" },
      { zh: "孩子", py: "hái zi", en: "child" },
      { zh: "田", py: "tián", en: "field" },
    ],
    questions: [
      { question: "大雪和小雪比，雪下得怎么样？", answer: "下得更多。" },
      { question: "大人说这些雪对什么好？", answer: "对田里的东西好。" },
    ],
  },
  term_22_dong_zhi: {
    paragraphs: [
      "冬至这一天，白天最短，晚上最长。",
      "冬至以后，白天就一天比一天长了。",
      "这一天家里的人常常一起吃饭：北方吃饺子，南方吃汤圆。",
    ],
    words: [
      { zh: "冬至", py: "dōng zhì", en: "Winter Solstice" },
      { zh: "短", py: "duǎn", en: "short" },
      { zh: "饺子", py: "jiǎo zi", en: "dumplings" },
      { zh: "汤圆", py: "tāng yuán", en: "sweet rice balls" },
    ],
    questions: [
      { question: "冬至这一天，白天怎么样？", answer: "最短。" },
      { question: "南方的人在冬至吃什么？", answer: "汤圆。" },
    ],
  },
  term_23_xiao_han: {
    paragraphs: [
      "小寒的时候，天气已经很冷了。",
      "河上开始有冰，出门的人都穿得很厚。",
      "虽然叫小寒，可是有的地方比大寒还冷。",
    ],
    words: [
      { zh: "小寒", py: "xiǎo hán", en: "Minor Cold" },
      { zh: "冰", py: "bīng", en: "ice" },
      { zh: "厚", py: "hòu", en: "thick" },
      { zh: "冷", py: "lěng", en: "cold" },
    ],
    questions: [
      { question: "小寒的时候，河上有什么？", answer: "冰。" },
      { question: "小寒一定比大寒暖和吗？", answer: "不一定，有的地方比大寒还冷。" },
    ],
  },
  term_24_da_han: {
    paragraphs: [
      "大寒是二十四节气里的最后一个。",
      "这时候常常是一年里最冷的日子。",
      "大寒过去以后，就又到立春了，一年又重新开始。",
    ],
    words: [
      { zh: "大寒", py: "dà hán", en: "Major Cold" },
      { zh: "最后", py: "zuì hòu", en: "last" },
      { zh: "冷", py: "lěng", en: "cold" },
      { zh: "立春", py: "lì chūn", en: "Start of Spring" },
    ],
    questions: [
      { question: "大寒是第几个节气？", answer: "最后一个。" },
      { question: "大寒过去以后是哪个节气？", answer: "立春。" },
    ],
  },

  // ── the five festivals ─────────────────────────────────────────────────
  festival_spring: {
    paragraphs: [
      "春节是中国最重要的节日。",
      "这几天，家里的人都回家一起吃饭。",
      "大人给小孩红包，大家见面都说：“新年好！”",
    ],
    words: [
      { zh: "春节", py: "chūn jié", en: "Spring Festival" },
      { zh: "节日", py: "jié rì", en: "festival" },
      { zh: "红包", py: "hóng bāo", en: "red envelope" },
      { zh: "新年", py: "xīn nián", en: "new year" },
    ],
    questions: [
      { question: "春节的时候，家里的人做什么？", answer: "都回家一起吃饭。" },
      { question: "大人给小孩什么？", answer: "红包。" },
    ],
  },
  festival_lantern: {
    paragraphs: [
      "元宵节在春节以后的第十五天。",
      "这一天晚上，人们出门看灯，街上很热闹。",
      "大家还吃元宵。元宵是圆的，白白的，里面很甜。",
    ],
    words: [
      { zh: "元宵节", py: "yuán xiāo jié", en: "Lantern Festival" },
      { zh: "灯", py: "dēng", en: "lantern; light" },
      { zh: "热闹", py: "rè nao", en: "lively; bustling" },
      { zh: "圆", py: "yuán", en: "round" },
    ],
    questions: [
      { question: "元宵节是春节以后的第几天？", answer: "第十五天。" },
      { question: "元宵是什么样子的？", answer: "圆的，白白的，里面很甜。" },
    ],
  },
  festival_qingming: {
    paragraphs: [
      "清明节在春天，那时候天气很好。",
      "这一天，人们去看过去的家人，给他们送花。",
      "有的人也在这一天出去走一走，看看春天的草和树。",
    ],
    words: [
      { zh: "清明节", py: "qīng míng jié", en: "Qingming Festival" },
      { zh: "春天", py: "chūn tiān", en: "spring" },
      { zh: "送", py: "sòng", en: "to give; to bring" },
      { zh: "花", py: "huā", en: "flower" },
    ],
    questions: [
      { question: "人们在清明节做什么？", answer: "去看过去的家人，给他们送花。" },
      { question: "清明节在哪个季节？", answer: "春天。" },
    ],
  },
  festival_dragon_boat: {
    paragraphs: [
      "端午节是为了记住一位古时候的诗人，他叫屈原。",
      "屈原很爱自己的国家，后来跳进了河里。",
      "人们坐船去找他，还把米放进水里，希望鱼不要吃他。",
      "所以今天我们在端午节赛龙舟，也吃粽子。",
    ],
    words: [
      { zh: "端午节", py: "duān wǔ jié", en: "Dragon Boat Festival" },
      { zh: "诗人", py: "shī rén", en: "poet" },
      { zh: "龙舟", py: "lóng zhōu", en: "dragon boat" },
      { zh: "粽子", py: "zòng zi", en: "sticky-rice dumpling" },
    ],
    questions: [
      { question: "端午节是为了记住谁？", answer: "古时候的诗人屈原。" },
      { question: "今天人们在端午节做什么？", answer: "赛龙舟，也吃粽子。" },
    ],
  },
  festival_mid_autumn: {
    paragraphs: [
      "中秋节在秋天，这一天晚上的月亮又大又圆。",
      "家里的人一起看月亮，吃月饼。",
      "老人常常说嫦娥的故事：她一个人住在月亮上面。",
      "所以看到月亮的时候，不在家的人也会想起家里。",
    ],
    words: [
      { zh: "中秋节", py: "zhōng qiū jié", en: "Mid-Autumn Festival" },
      { zh: "月亮", py: "yuè liang", en: "moon" },
      { zh: "月饼", py: "yuè bǐng", en: "mooncake" },
      { zh: "圆", py: "yuán", en: "round" },
    ],
    questions: [
      { question: "中秋节的月亮是什么样子的？", answer: "又大又圆。" },
      { question: "老人说的故事里，谁住在月亮上面？", answer: "嫦娥。" },
    ],
  },
};
