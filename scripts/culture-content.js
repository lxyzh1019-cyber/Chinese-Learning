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
 * `hskBand` claims, and asks two questions the passage answers. Since the
 * 2026-09-18 rewrite (owner-reviewed, round by round) an entry is a short
 * story with a line of cause — what nature does, what people do about it,
 * why, one concrete custom, a line the child can relate to — `paragraphsEn`
 * carries one English line per paragraph, shown under it in the reader, and
 * the questions ask about the cause rather than restate a fact. Reviewed by:
 * model. **No educator has checked these**, the same standing caveat the
 * vocabulary and story corpora carry.
 */
module.exports = {
  // ── the 24 solar terms, in order round the year ────────────────────────
  term_01_li_chun: {
    paragraphs: [
      "立春是二十四节气里的第一个，一般在二月四日前后。",
      "这时候天还很冷，可是白天一天比一天长，太阳也一天比一天暖。",
      "老人说：“立春了，春天就在路上了。”",
      "有的地方在这一天吃春饼，把菜卷在薄薄的饼里，一口咬下去，这叫“咬春”。",
      "春饼里的菜是刚长出来的新菜，吃了它，就像把春天吃到了肚子里。",
      "你家立春的时候吃什么？",
    ],
    paragraphsEn: [
      "Lichun, the Start of Spring, is the first of the twenty-four solar terms, usually around the fourth of February.",
      "It is still cold, but each day is a little longer than the last, and the sun a little warmer.",
      "Old people say: \"Lichun has come, so spring is on its way.\"",
      "In some places people eat spring pancakes on this day, rolling vegetables in a thin pancake and biting in: this is called \"biting the spring\".",
      "The vegetables in the pancake are the first new ones of the year, so eating it is like eating spring itself.",
      "What does your family eat at Lichun?",
    ],
    words: [
      { zh: "立春", py: "lì chūn", en: "Start of Spring" },
      { zh: "节气", py: "jié qi", en: "solar term" },
      { zh: "春饼", py: "chūn bǐng", en: "spring pancake" },
      { zh: "白天", py: "bái tiān", en: "daytime" },
    ],
    questions: [
      { question: "立春的时候天还很冷，为什么人们说春天来了？", answer: "因为白天一天比一天长，太阳也一天比一天暖。" },
      { question: "吃春饼为什么叫“咬春”？", answer: "春饼里卷的是刚长出来的新菜，一口咬下去，就像把春天吃到了肚子里。" },
    ],
  },
  term_02_yu_shui: {
    paragraphs: [
      "雨水是春天的第二个节气。",
      "这时候天气暖了一点，天上下的雪慢慢变成了雨。",
      "雨多了以后，田里的土就软了，也湿了。",
      "土软了，种子才能放进去，所以种田的人开始准备种东西。",
      "他们把去年留下的种子拿出来，看一看，晒一晒。",
      "一场春雨下过，地上的草就绿了一片。",
    ],
    paragraphsEn: [
      "Yushui, Rain Water, is the second solar term of spring.",
      "The weather is a little warmer now, and the snow slowly turns into rain.",
      "After the rains, the soil in the fields turns soft and wet.",
      "Only soft soil will take a seed, so farmers begin getting ready to sow.",
      "They bring out the seeds kept from last year, look them over and dry them in the sun.",
      "After one spring rain, the ground turns green with grass.",
    ],
    words: [
      { zh: "雨水", py: "yǔ shuǐ", en: "Rain Water" },
      { zh: "雪", py: "xuě", en: "snow" },
      { zh: "土", py: "tǔ", en: "earth; soil" },
      { zh: "准备", py: "zhǔn bèi", en: "to get ready" },
    ],
    questions: [
      { question: "雨水的时候，为什么下的是雨，不是雪？", answer: "因为天气暖了一点。" },
      { question: "种田的人为什么要等土软了才种东西？", answer: "土软了，种子才能放进去。" },
    ],
  },
  term_03_jing_zhe: {
    paragraphs: [
      "惊蛰的时候，天上开始打雷了。",
      "很多虫子在土里睡了一个冬天，什么都听不到。",
      "春天的第一声雷很响，虫子听到雷声，吓了一跳，就醒过来了。",
      "“惊”是吓一跳的意思，“蛰”是虫子在土里睡觉，所以这个节气叫惊蛰。",
      "虫子醒了，鸟也回来了，田里一下子热闹起来。",
      "种田的人说：“惊蛰一到，地里就不能闲着了。”",
    ],
    paragraphsEn: [
      "At Jingzhe, the Awakening of Insects, the first thunder of the year is heard.",
      "Many insects have slept in the soil all winter and heard nothing.",
      "The first spring thunder is loud; the insects hear it, get a fright, and wake up.",
      "\"Jing\" means to be startled and \"zhe\" means insects sleeping in the ground, so that is the name of this term.",
      "The insects wake, the birds come back, and the fields are suddenly full of life.",
      "Farmers say: \"Once Jingzhe comes, the land cannot lie idle.\"",
    ],
    words: [
      { zh: "惊蛰", py: "jīng zhé", en: "Awakening of Insects" },
      { zh: "雷", py: "léi", en: "thunder" },
      { zh: "虫子", py: "chóng zi", en: "insect" },
      { zh: "醒", py: "xǐng", en: "to wake up" },
    ],
    questions: [
      { question: "虫子为什么在惊蛰的时候醒过来？", answer: "春天的第一声雷很响，虫子听到雷声，吓了一跳。" },
      { question: "“惊蛰”这两个字是什么意思？", answer: "“惊”是吓一跳，“蛰”是虫子在土里睡觉。" },
    ],
  },
  term_04_chun_fen: {
    paragraphs: [
      "春分这一天，白天和晚上一样长。",
      "春天从立春开始，到春分正好过了一半，所以叫“分”。",
      "春分以后，白天一天比一天长，晚上一天比一天短。",
      "白天长了，太阳晒的时间就多了，天气也慢慢暖和起来。",
      "草绿了，花开了，燕子从南边飞回来了。",
      "有的地方在这一天玩一个游戏：把鸡蛋立在桌子上，看谁能立起来。",
    ],
    paragraphsEn: [
      "On Chunfen, the Spring Equinox, day and night are the same length.",
      "Spring starts at Lichun, and by Chunfen it is exactly half over, which is why the name says \"divide\".",
      "After Chunfen the days grow longer and the nights shorter.",
      "Longer days mean more sunshine, so the weather slowly warms up.",
      "The grass turns green, the flowers open, and the swallows fly back from the south.",
      "In some places people play a game on this day: standing an egg on end on the table, to see who can do it.",
    ],
    words: [
      { zh: "春分", py: "chūn fēn", en: "Spring Equinox" },
      { zh: "一样", py: "yí yàng", en: "the same" },
      { zh: "暖和", py: "nuǎn huo", en: "warm" },
      { zh: "花", py: "huā", en: "flower" },
    ],
    questions: [
      { question: "为什么这个节气叫春分？", answer: "因为春天到这一天正好过了一半。" },
      { question: "春分以后，为什么天气慢慢暖和起来？", answer: "白天长了，太阳晒的时间就多了。" },
    ],
  },
  term_05_qing_ming_term: {
    paragraphs: [
      "到了清明，冬天的冷已经走远了，天变得又清又明，所以叫清明。",
      "这时候雨水多，太阳也暖，草和树长得特别快。",
      "树好种，很多人在这几天去种树。",
      "清明也是想念过去的家人的日子。",
      "人们去看家人住过的地方，把那里打扫干净，放上花。",
      "一边走在春天里，一边想着家里的老人，这就是清明。",
    ],
    paragraphsEn: [
      "By Qingming, the cold of winter is far behind and the sky is clear and bright, which is what the name means.",
      "There is plenty of rain and warm sun now, so grass and trees grow especially fast.",
      "Trees take root easily, so many people plant trees in these few days.",
      "Qingming is also a day for remembering family members who have died.",
      "People go to the place where they rest, sweep it clean, and lay flowers there.",
      "Walking in the spring and thinking of the old people of the family: that is Qingming.",
    ],
    words: [
      { zh: "清明", py: "qīng míng", en: "Clear and Bright" },
      { zh: "清", py: "qīng", en: "clear" },
      { zh: "明", py: "míng", en: "bright" },
      { zh: "种树", py: "zhòng shù", en: "to plant trees" },
    ],
    questions: [
      { question: "为什么这个节气叫清明？", answer: "因为冬天的冷走远了，天变得又清又明。" },
      { question: "人们为什么在清明这几天去种树？", answer: "这时候雨水多，太阳暖，树长得特别快。" },
    ],
  },
  term_06_gu_yu: {
    paragraphs: [
      "谷雨是春天的最后一个节气，过了它，夏天就要来了。",
      "这时候雨下得多，天气也暖了，田里的谷子长得很快。",
      "谷子要长，最要紧的就是水，所以春天的雨对种田的人很宝贵。",
      "种田的人有一句话：“雨生百谷。”意思是，一场春雨，一百种谷子都长起来了。",
      "谷雨前后，南方的人开始摘茶，这时候的茶叫“雨前茶”，最好喝。",
      "春天快过完了，人们要抓紧时间，把该种的都种下去。",
    ],
    paragraphsEn: [
      "Guyu, Grain Rain, is the last solar term of spring; after it, summer is on its way.",
      "It rains a great deal now and the weather is warm, so the grain in the fields grows fast.",
      "What grain needs most is water, so spring rain is precious to farmers.",
      "Farmers have a saying: \"Rain gives life to a hundred grains.\" One spring rain, and every kind of grain shoots up.",
      "Around Guyu, people in the south begin picking tea; tea from these days is called \"pre-rain tea\" and is the best of all.",
      "Spring is nearly over, so people hurry to get everything sown that needs sowing.",
    ],
    words: [
      { zh: "谷雨", py: "gǔ yǔ", en: "Grain Rain" },
      { zh: "谷子", py: "gǔ zi", en: "grain" },
      { zh: "最后", py: "zuì hòu", en: "last" },
      { zh: "长", py: "zhǎng", en: "to grow" },
    ],
    questions: [
      { question: "为什么这个节气叫谷雨？", answer: "因为这时候雨多，谷子长得很快。" },
      { question: "“雨生百谷”是什么意思？", answer: "一场春雨，一百种谷子都长起来了。" },
    ],
  },
  term_07_li_xia: {
    paragraphs: [
      "立夏是夏天的第一个节气。",
      "从这一天起，天气开始热起来，白天也越来越长。",
      "太阳多了，雨也多了，田里的东西长得很快，一天一个样。",
      "夏天热，人容易没有力气，也容易生病。",
      "所以有的地方在这一天吃鸡蛋，说吃了鸡蛋，夏天身体好，不怕热。",
      "孩子们还把鸡蛋放在小网里，挂在脖子上，和朋友比谁的蛋硬。",
    ],
    paragraphsEn: [
      "Lixia, the Start of Summer, is the first solar term of summer.",
      "From this day the weather begins to get hot, and the days keep growing longer.",
      "With more sun and more rain, everything in the fields grows fast, different every day.",
      "In the summer heat people easily lose their strength and easily fall ill.",
      "So in some places people eat an egg on this day, saying it keeps the body strong all summer and unafraid of the heat.",
      "Children also carry an egg in a little net around their neck, and see whose egg is the hardest.",
    ],
    words: [
      { zh: "立夏", py: "lì xià", en: "Start of Summer" },
      { zh: "夏天", py: "xià tiān", en: "summer" },
      { zh: "鸡蛋", py: "jī dàn", en: "egg" },
      { zh: "身体", py: "shēn tǐ", en: "body; health" },
    ],
    questions: [
      { question: "立夏以后，田里的东西为什么长得很快？", answer: "因为太阳多了，雨也多了。" },
      { question: "有的地方在立夏吃鸡蛋，是希望什么？", answer: "夏天身体好，不怕热。" },
    ],
  },
  term_08_xiao_man: {
    paragraphs: [
      "小满的时候，田里的麦子已经长高了，麦粒也开始长了。",
      "可是麦粒里还没有装满，只是小小的一点。",
      "因为满了一点，还没有全满，所以这个节气叫小满。",
      "种田的人天天去田里看，等麦粒一天一天变大。",
      "他们知道，再过一些日子，麦子黄了，就可以收了。",
      "老人说：“小满小满，麦粒渐满。”",
    ],
    paragraphsEn: [
      "At Xiaoman, Grain Buds, the wheat in the fields has grown tall and the grains have begun to form.",
      "But the grains are not yet full; there is only a little inside each one.",
      "A little full, but not yet all full: that is why this term is called Xiaoman, \"small fullness\".",
      "Farmers go to the fields every day to watch the grains swell day by day.",
      "They know that in a few more days the wheat will turn yellow and be ready to harvest.",
      "Old people say: \"Xiaoman, Xiaoman, the grains slowly fill.\"",
    ],
    words: [
      { zh: "小满", py: "xiǎo mǎn", en: "Grain Buds" },
      { zh: "麦子", py: "mài zi", en: "wheat" },
      { zh: "满", py: "mǎn", en: "full" },
      { zh: "收", py: "shōu", en: "to harvest" },
    ],
    questions: [
      { question: "为什么这个节气叫小满？", answer: "因为麦粒满了一点，还没有全满。" },
      { question: "种田的人天天去田里看，是在等什么？", answer: "等麦粒一天一天变大，麦子黄了就可以收。" },
    ],
  },
  term_09_mang_zhong: {
    paragraphs: [
      "芒种是一年里最忙的时候。",
      "这时候麦子黄了，要马上收，晚了麦粒就掉在地里了。",
      "麦子收完，又要马上种稻子，晚了稻子就长不好了。",
      "所以种田的人一边收麦子，一边种稻子，一天到晚都在田里。",
      "有一句话说：“芒种忙，两头忙。”两头就是收和种。",
      "这几天，全家人都要去田里帮忙，小孩也不例外。",
    ],
    paragraphsEn: [
      "Mangzhong, Grain in Ear, is the busiest time of the year.",
      "The wheat is yellow and must be harvested at once; leave it, and the grains drop in the field.",
      "As soon as the wheat is in, the rice must be planted; leave it, and the rice will not grow well.",
      "So farmers harvest wheat and plant rice at the same time, in the fields from morning to night.",
      "A saying goes: \"Mangzhong is busy, busy at both ends.\" The two ends are harvesting and planting.",
      "In these days the whole family goes out to help in the fields, children included.",
    ],
    words: [
      { zh: "芒种", py: "máng zhòng", en: "Grain in Ear" },
      { zh: "忙", py: "máng", en: "busy" },
      { zh: "收", py: "shōu", en: "to harvest" },
      { zh: "稻子", py: "dào zi", en: "rice plants" },
    ],
    questions: [
      { question: "芒种为什么是一年里最忙的时候？", answer: "因为要一边收麦子，一边种稻子，晚了都不行。" },
      { question: "为什么麦子黄了要马上收？", answer: "晚了麦粒就掉在地里了。" },
    ],
  },
  term_10_xia_zhi: {
    paragraphs: [
      "夏至这一天，白天最长，晚上最短。",
      "太阳在天上走得最高，中午的时候，人的影子最短。",
      "夏至以后，白天就一天比一天短了。",
      "可是天气不是马上变凉，最热的日子还在后面。",
      "有的地方在这一天吃面，说：“冬至饺子夏至面。”",
      "新收的麦子做成面，吃一碗凉凉的面，夏天就好过一点。",
    ],
    paragraphsEn: [
      "On Xiazhi, the Summer Solstice, the day is longest and the night shortest.",
      "The sun climbs highest in the sky, and at noon a person's shadow is shortest.",
      "After Xiazhi, the days grow shorter one by one.",
      "But the weather does not cool at once; the hottest days are still to come.",
      "In some places people eat noodles on this day, saying: \"Dumplings at Dongzhi, noodles at Xiazhi.\"",
      "The new wheat is made into noodles, and a bowl of cold noodles makes the summer a little easier to bear.",
    ],
    words: [
      { zh: "夏至", py: "xià zhì", en: "Summer Solstice" },
      { zh: "长", py: "cháng", en: "long" },
      { zh: "短", py: "duǎn", en: "short" },
      { zh: "面", py: "miàn", en: "noodles" },
    ],
    questions: [
      { question: "夏至这一天，为什么中午人的影子最短？", answer: "因为太阳在天上走得最高。" },
      { question: "夏至以后白天短了，天气马上变凉吗？", answer: "不是，最热的日子还在后面。" },
    ],
  },
  term_11_xiao_shu: {
    paragraphs: [
      "小暑的时候，天气已经很热了，但是还不是一年里最热的时候。",
      "“暑”就是热，“小暑”是热了，还没有热到头。",
      "这几天常常下大雨，雨停了以后，太阳一出来，地上的水变成了热气，反而更闷。",
      "中午太热，人们一般早上或者晚上出门，中午在家里休息。",
      "老人们坐在树下，一边摇扇子，一边聊天。",
      "小孩最喜欢的，是吃一块凉凉的西瓜。",
    ],
    paragraphsEn: [
      "At Xiaoshu, Minor Heat, the weather is already very hot, but not yet the hottest of the year.",
      "\"Shu\" means heat, and \"Xiaoshu\" means the heat has come but not yet reached its peak.",
      "Heavy rain falls often in these days; when it stops and the sun comes out, the water on the ground turns to steam and it feels even more stifling.",
      "Midday is too hot, so people go out in the morning or evening and rest at home at noon.",
      "Old people sit under the trees, waving fans and chatting.",
      "What children like best is a slice of cold watermelon.",
    ],
    words: [
      { zh: "小暑", py: "xiǎo shǔ", en: "Minor Heat" },
      { zh: "闷", py: "mēn", en: "muggy; stuffy" },
      { zh: "休息", py: "xiū xi", en: "to rest" },
      { zh: "出门", py: "chū mén", en: "to go out" },
    ],
    questions: [
      { question: "小暑的雨停了以后，为什么反而更闷？", answer: "太阳一出来，地上的水变成了热气。" },
      { question: "人们为什么早上或者晚上出门？", answer: "因为中午太热。" },
    ],
  },
  term_12_da_shu: {
    paragraphs: [
      "大暑是一年里最热的时候。",
      "太阳很大，地上的水很快就干了，田里的土也裂开了。",
      "所以种田的人要早早起来给田里浇水，太阳出来了就回家。",
      "老人常说，这些日子要多喝水，少在外面走。",
      "因为人出很多汗，身体里的水少了，就容易头晕。",
      "大暑过了，就是立秋，最热的日子终于要过去了。",
    ],
    paragraphsEn: [
      "Dashu, Major Heat, is the hottest time of the year.",
      "The sun is fierce; water on the ground dries in no time, and the soil in the fields cracks open.",
      "So farmers get up very early to water the fields, and go home once the sun is up.",
      "Old people often say that in these days you should drink plenty of water and not walk about outside too much.",
      "Because you sweat so much, the body loses water and you easily feel dizzy.",
      "After Dashu comes Liqiu, the Start of Autumn, and the hottest days are finally over.",
    ],
    words: [
      { zh: "大暑", py: "dà shǔ", en: "Major Heat" },
      { zh: "太阳", py: "tài yáng", en: "sun" },
      { zh: "干", py: "gān", en: "dry" },
      { zh: "喝水", py: "hē shuǐ", en: "to drink water" },
    ],
    questions: [
      { question: "大暑的时候，种田的人为什么早早起来浇水？", answer: "因为太阳很大，地上的水很快就干了。" },
      { question: "为什么这些日子要多喝水？", answer: "人出很多汗，身体里的水少了，容易头晕。" },
    ],
  },
  term_13_li_qiu: {
    paragraphs: [
      "立秋是秋天的第一个节气。",
      "虽然叫立秋，可是天气还很热，中午的太阳和夏天一样。",
      "人们把这时候的热叫“秋老虎”，意思是秋天来了，热还像老虎一样凶。",
      "可是早上和晚上已经开始凉一点了，风里有了一点秋天的味道。",
      "树上的叶子也慢慢变黄，一片一片落下来。",
      "老人说：“一叶落，知天下秋。”看到第一片黄叶，就知道秋天到了。",
    ],
    paragraphsEn: [
      "Liqiu, the Start of Autumn, is the first solar term of autumn.",
      "Although it is called the start of autumn, the weather is still hot, and the midday sun is the same as in summer.",
      "People call this heat the \"autumn tiger\": autumn has come, but the heat is still as fierce as a tiger.",
      "Yet mornings and evenings have begun to cool, and there is a hint of autumn in the wind.",
      "The leaves on the trees slowly turn yellow and fall one by one.",
      "Old people say: \"One leaf falls, and you know autumn has come to the world.\" The first yellow leaf tells you autumn is here.",
    ],
    words: [
      { zh: "立秋", py: "lì qiū", en: "Start of Autumn" },
      { zh: "秋天", py: "qiū tiān", en: "autumn" },
      { zh: "凉", py: "liáng", en: "cool" },
      { zh: "叶子", py: "yè zi", en: "leaf" },
    ],
    questions: [
      { question: "为什么人们把立秋以后的热叫“秋老虎”？", answer: "秋天来了，可是热还像老虎一样凶。" },
      { question: "立秋以后，人们从哪里知道秋天到了？", answer: "早上和晚上凉了，树上的叶子黄了、落了。" },
    ],
  },
  term_14_chu_shu: {
    paragraphs: [
      "处暑的“处”是停下来的意思，“暑”是热。",
      "到了处暑，热就停下来了，最热的日子终于过去了。",
      "白天还有一点热，可是晚上凉了，睡觉要多盖一点。",
      "天上的云变高了，也变少了，天看起来特别蓝。",
      "田里的稻子开始黄了，风一吹，像一片黄色的水。",
      "海边的人这时候开船出海，因为秋天的鱼又多又肥。",
    ],
    paragraphsEn: [
      "In Chushu, the End of Heat, \"chu\" means to stop and \"shu\" means heat.",
      "At Chushu the heat stops, and the hottest days are finally over.",
      "The days are still a little warm, but the nights are cool, and you need more cover to sleep.",
      "The clouds climb higher and grow fewer, and the sky looks especially blue.",
      "The rice in the fields begins to turn yellow, and when the wind blows it looks like a sheet of yellow water.",
      "People by the sea take their boats out now, because the autumn fish are plentiful and fat.",
    ],
    words: [
      { zh: "处暑", py: "chǔ shǔ", en: "End of Heat" },
      { zh: "停", py: "tíng", en: "to stop" },
      { zh: "凉", py: "liáng", en: "cool" },
      { zh: "盖", py: "gài", en: "to cover" },
    ],
    questions: [
      { question: "处暑这两个字是什么意思？", answer: "“处”是停下来，“暑”是热，热停下来了。" },
      { question: "海边的人为什么在处暑的时候出海？", answer: "因为秋天的鱼又多又肥。" },
    ],
  },
  term_15_bai_lu: {
    paragraphs: [
      "白露的时候，早上起来，草上有很多小水点。",
      "这些水叫露水，太阳一照，白白的，亮亮的，所以这个节气叫白露。",
      "露水是晚上出来的：晚上天冷，空气里的水变成了小水点，落在草上。",
      "所以有露水，就是晚上已经冷了。",
      "有一句话说：“白露秋分夜，一夜凉一夜。”",
      "从这时候起，人们早上出门要加一件衣服了。",
    ],
    paragraphsEn: [
      "At Bailu, White Dew, you get up in the morning and find the grass covered in tiny drops of water.",
      "These drops are dew; in the sun they look white and shining, and that is why the term is called White Dew.",
      "Dew forms at night: the night is cold, so the water in the air turns into tiny drops and settles on the grass.",
      "So if there is dew, the nights have already turned cold.",
      "A saying goes: \"From White Dew to the Autumn Equinox, each night is cooler than the last.\"",
      "From now on people put on an extra layer when they go out in the morning.",
    ],
    words: [
      { zh: "白露", py: "bái lù", en: "White Dew" },
      { zh: "露水", py: "lù shuǐ", en: "dew" },
      { zh: "草", py: "cǎo", en: "grass" },
      { zh: "夜", py: "yè", en: "night" },
    ],
    questions: [
      { question: "露水是怎么来的？", answer: "晚上天冷，空气里的水变成了小水点，落在草上。" },
      { question: "为什么这个节气叫白露？", answer: "露水被太阳一照，白白的，亮亮的。" },
    ],
  },
  term_16_qiu_fen: {
    paragraphs: [
      "秋分这一天，白天和晚上一样长。",
      "秋天从立秋开始，到秋分正好过了一半，所以叫“分”。",
      "秋分以后，晚上就比白天长了，天也一天比一天冷。",
      "田里的稻子、玉米这时候差不多都收好了。",
      "收完的东西放在院子里晒，院子里一片黄，一片红。",
      "所以秋分也是种田的人最高兴的日子：一年的活，有了结果。",
    ],
    paragraphsEn: [
      "On Qiufen, the Autumn Equinox, day and night are the same length.",
      "Autumn starts at Liqiu, and by Qiufen it is exactly half over, which is why the name says \"divide\".",
      "After Qiufen the nights are longer than the days, and each day is colder than the last.",
      "By now the rice and maize in the fields are nearly all harvested.",
      "The harvest is spread in the courtyard to dry, a patch of yellow here and a patch of red there.",
      "So Qiufen is also the happiest day for farmers: a year's work has borne fruit.",
    ],
    words: [
      { zh: "秋分", py: "qiū fēn", en: "Autumn Equinox" },
      { zh: "一样", py: "yí yàng", en: "the same" },
      { zh: "收", py: "shōu", en: "to harvest" },
      { zh: "田", py: "tián", en: "field" },
    ],
    questions: [
      { question: "为什么这个节气叫秋分？", answer: "因为秋天到这一天正好过了一半。" },
      { question: "秋分为什么是种田的人最高兴的日子？", answer: "田里的东西都收好了，一年的活有了结果。" },
    ],
  },
  term_17_han_lu: {
    paragraphs: [
      "寒露的时候，早上的草上还有露水，可是露水已经很凉了，快要变成冰了。",
      "“寒”就是冷，所以这个节气叫寒露。",
      "天气比白露的时候冷多了，很多地方的人开始穿厚一点的衣服。",
      "北方的大雁排成一行，一起飞到南方去过冬。",
      "南方田里的稻子这时候可以收了，山上的菊花也开了。",
      "很多人在这几天爬山，看红叶，看菊花。",
    ],
    paragraphsEn: [
      "At Hanlu, Cold Dew, there is still dew on the grass in the morning, but it is very cold now, almost ice.",
      "\"Han\" means cold, so this term is called Cold Dew.",
      "The weather is much colder than at White Dew, and in many places people begin wearing thicker clothes.",
      "In the north the wild geese line up and fly together to the south for the winter.",
      "In the south the rice can be harvested now, and the chrysanthemums on the hills are in bloom.",
      "Many people climb the hills in these days to see the red leaves and the chrysanthemums.",
    ],
    words: [
      { zh: "寒露", py: "hán lù", en: "Cold Dew" },
      { zh: "寒", py: "hán", en: "cold" },
      { zh: "衣服", py: "yī fu", en: "clothes" },
      { zh: "厚", py: "hòu", en: "thick" },
    ],
    questions: [
      { question: "寒露和白露的露水有什么不一样？", answer: "寒露的露水已经很凉了，快要变成冰了。" },
      { question: "大雁为什么飞到南方去？", answer: "因为北方冷了，它们要去南方过冬。" },
    ],
  },
  term_18_shuang_jiang: {
    paragraphs: [
      "霜降是秋天的最后一个节气。",
      "晚上比寒露的时候更冷，露水冻住了，变成了霜。",
      "早上起来，地上、草上、房顶上都是一层白白的霜，像下了一场小雪。",
      "很多菜怕霜，一夜就冻坏了，所以种田的人要在霜降以前把菜收回家。",
      "可是有的水果，比如柿子，霜降以后反而更甜。",
      "老人说：“霜打的柿子最好吃。”",
    ],
    paragraphsEn: [
      "Shuangjiang, Frost's Descent, is the last solar term of autumn.",
      "The nights are colder than at Cold Dew; the dew freezes and turns into frost.",
      "In the morning the ground, the grass and the rooftops are covered in a layer of white frost, as if a light snow had fallen.",
      "Many vegetables cannot stand frost and are ruined in one night, so farmers bring them in before Shuangjiang.",
      "But some fruit, such as persimmons, become sweeter after the frost.",
      "Old people say: \"A frost-bitten persimmon is the best of all.\"",
    ],
    words: [
      { zh: "霜降", py: "shuāng jiàng", en: "Frost's Descent" },
      { zh: "霜", py: "shuāng", en: "frost" },
      { zh: "甜", py: "tián", en: "sweet" },
      { zh: "柿子", py: "shì zi", en: "persimmon" },
    ],
    questions: [
      { question: "霜是怎么来的？", answer: "晚上更冷了，露水冻住了，就变成了霜。" },
      { question: "种田的人为什么要在霜降以前把菜收回家？", answer: "很多菜怕霜，一夜就冻坏了。" },
    ],
  },
  term_19_li_dong: {
    paragraphs: [
      "立冬是冬天的第一个节气。",
      "田里的东西都收完了，地也冻了，种不了东西，所以种田的人开始休息。",
      "他们把粮食放好，把柴放好，准备过一个长长的冬天。",
      "天气冷了，人要吃得好一点，身体才有力气。",
      "所以北方有的地方在立冬这一天吃饺子，饺子里有肉，也有菜，热热的。",
      "老人说：“立冬不吃饺子，冬天要冻耳朵。”因为饺子的样子像耳朵。",
    ],
    paragraphsEn: [
      "Lidong, the Start of Winter, is the first solar term of winter.",
      "Everything in the fields has been harvested and the ground is frozen, so nothing can be planted and farmers begin to rest.",
      "They store away the grain and the firewood, ready for a long winter.",
      "In the cold, people need to eat well to keep up their strength.",
      "So in some places in the north people eat dumplings on this day, filled with meat and vegetables, steaming hot.",
      "Old people say: \"Skip the dumplings at Lidong and your ears will freeze this winter,\" because a dumpling is shaped like an ear.",
    ],
    words: [
      { zh: "立冬", py: "lì dōng", en: "Start of Winter" },
      { zh: "冬天", py: "dōng tiān", en: "winter" },
      { zh: "休息", py: "xiū xi", en: "to rest" },
      { zh: "饺子", py: "jiǎo zi", en: "dumplings" },
    ],
    questions: [
      { question: "立冬以后，种田的人为什么开始休息？", answer: "田里的东西收完了，地也冻了，种不了东西。" },
      { question: "为什么老人说立冬不吃饺子会冻耳朵？", answer: "因为饺子的样子像耳朵。" },
    ],
  },
  term_20_xiao_xue: {
    paragraphs: [
      "小雪的时候，北方开始下雪了，可是雪不大。",
      "因为地还不够冷，雪落在地上，一会儿就化了。",
      "所以地上还不会一直是白的，只有房顶上和树上留一点白。",
      "路上又湿又滑，出门的时候要小心。",
      "人们开始做过冬的菜：把白菜、萝卜晒一晒，放在缸里。",
      "冬天菜少，这些菜要吃到春天。",
    ],
    paragraphsEn: [
      "At Xiaoxue, Minor Snow, it begins to snow in the north, but not much.",
      "The ground is not yet cold enough, so the snow melts soon after it lands.",
      "So the ground does not stay white; only the rooftops and the trees keep a little white.",
      "The roads are wet and slippery, so take care when you go out.",
      "People begin preparing food for the winter, drying cabbages and radishes in the sun and packing them in big jars.",
      "There are few vegetables in winter, so these have to last until spring.",
    ],
    words: [
      { zh: "小雪", py: "xiǎo xuě", en: "Minor Snow" },
      { zh: "下雪", py: "xià xuě", en: "to snow" },
      { zh: "化", py: "huà", en: "to melt" },
      { zh: "滑", py: "huá", en: "slippery" },
    ],
    questions: [
      { question: "小雪的时候，雪为什么一会儿就化了？", answer: "因为地还不够冷。" },
      { question: "人们为什么在小雪的时候把白菜、萝卜放在缸里？", answer: "冬天菜少，这些菜要吃到春天。" },
    ],
  },
  term_21_da_xue: {
    paragraphs: [
      "大雪的时候，雪下得比小雪多多了。",
      "地已经很冷了，雪落下来不化，一层一层越堆越厚。",
      "有的地方一早起来，外面已经全白了，路和田都看不见了。",
      "孩子们最高兴，跑到雪里堆雪人，打雪仗。",
      "大人也高兴，他们说：“瑞雪兆丰年。”",
      "意思是，雪盖在田上，像一床被子，麦子在下面不会冻坏，明年会长得很好。",
    ],
    paragraphsEn: [
      "At Daxue, Major Snow, far more snow falls than at Minor Snow.",
      "The ground is very cold now, so the snow does not melt but piles up layer on layer.",
      "In some places you wake to find everything white outside, the roads and fields gone from sight.",
      "The children are happiest of all, running out to build snowmen and have snowball fights.",
      "The grown-ups are happy too. They say: \"A timely snow promises a good year.\"",
      "The snow lies over the fields like a quilt, so the wheat beneath it does not freeze and will grow well next year.",
    ],
    words: [
      { zh: "大雪", py: "dà xuě", en: "Major Snow" },
      { zh: "全", py: "quán", en: "entirely" },
      { zh: "孩子", py: "hái zi", en: "child" },
      { zh: "田", py: "tián", en: "field" },
    ],
    questions: [
      { question: "大雪的时候，雪为什么越堆越厚？", answer: "地已经很冷了，雪落下来不化。" },
      { question: "大人为什么说雪对田里的麦子好？", answer: "雪盖在田上像一床被子，麦子在下面不会冻坏。" },
    ],
  },
  term_22_dong_zhi: {
    paragraphs: [
      "冬至这一天，白天最短，晚上最长。",
      "太阳在天上走得最低，中午的时候，人的影子最长。",
      "冬至以后，白天就一天比一天长了，所以老人说：“冬至一到，太阳就回来了。”",
      "从冬至起，最冷的日子开始了，人们叫它“数九”：每九天是一个“九”，数完九个“九”，春天就来了。",
      "这一天家里的人常常一起吃饭：北方吃饺子，南方吃汤圆。",
      "汤圆是圆的，一家人围在一起也是圆的，所以叫“团圆”。",
    ],
    paragraphsEn: [
      "On Dongzhi, the Winter Solstice, the day is shortest and the night longest.",
      "The sun travels lowest in the sky, and at noon a person's shadow is longest.",
      "After Dongzhi the days grow longer one by one, so old people say: \"Once Dongzhi comes, the sun comes back.\"",
      "From Dongzhi the coldest days begin, and people \"count the nines\": every nine days is one \"nine\", and when nine nines are counted, spring has come.",
      "On this day families often eat together: dumplings in the north, sweet rice balls in the south.",
      "The rice balls are round, and a family gathered in a circle is round too, which is why it is called \"reunion\".",
    ],
    words: [
      { zh: "冬至", py: "dōng zhì", en: "Winter Solstice" },
      { zh: "短", py: "duǎn", en: "short" },
      { zh: "饺子", py: "jiǎo zi", en: "dumplings" },
      { zh: "汤圆", py: "tāng yuán", en: "sweet rice balls" },
    ],
    questions: [
      { question: "为什么老人说“冬至一到，太阳就回来了”？", answer: "因为冬至以后，白天一天比一天长了。" },
      { question: "“数九”是怎么数的？", answer: "每九天是一个“九”，数完九个“九”，春天就来了。" },
    ],
  },
  term_23_xiao_han: {
    paragraphs: [
      "小寒的时候，天气已经很冷了。",
      "河上开始有冰，早上的风像刀子一样，出门的人都穿得很厚。",
      "虽然叫小寒，可是很多地方小寒比大寒还冷，因为这时候正是“三九”。",
      "北方的孩子在冰上玩，南方的人在家里吃热热的腊八粥。",
      "腊八粥里有米、有豆、有红枣，喝一碗，全身都暖了。",
      "老人说：“小寒大寒，冷成一团。”过了这两个节气，冬天就完了。",
    ],
    paragraphsEn: [
      "At Xiaohan, Minor Cold, the weather is already very cold.",
      "Ice forms on the rivers, the morning wind cuts like a knife, and everyone goes out wrapped up thick.",
      "Although it is called Minor Cold, in many places Xiaohan is colder than Major Cold, because this is the \"third nine\", the coldest stretch of winter.",
      "Children in the north play on the ice; people in the south stay in and eat hot Laba porridge.",
      "Laba porridge has rice, beans and red dates in it, and one bowl warms you all over.",
      "Old people say: \"Minor Cold, Major Cold, one huddle of cold.\" Once these two terms are over, winter is done.",
    ],
    words: [
      { zh: "小寒", py: "xiǎo hán", en: "Minor Cold" },
      { zh: "冰", py: "bīng", en: "ice" },
      { zh: "厚", py: "hòu", en: "thick" },
      { zh: "冷", py: "lěng", en: "cold" },
    ],
    questions: [
      { question: "为什么很多地方小寒比大寒还冷？", answer: "因为小寒的时候正是“三九”，一年里最冷的日子。" },
      { question: "南方的人在小寒的时候吃什么，为什么？", answer: "吃热热的腊八粥，喝一碗，全身都暖了。" },
    ],
  },
  term_24_da_han: {
    paragraphs: [
      "大寒是二十四节气里的最后一个。",
      "这时候常常是一年里最冷的日子，河全冻住了，地也硬得像石头。",
      "可是人们不怕，因为大寒一过，就又到立春了。",
      "所以大寒的时候，家家都在忙着过年：打扫房子，写春联，准备好吃的。",
      "在外面工作的人也都往家里赶，要和家人一起过年。",
      "一年从立春开始，到大寒结束，然后又重新开始，一年一年，就像一个圆。",
    ],
    paragraphsEn: [
      "Dahan, Major Cold, is the last of the twenty-four solar terms.",
      "These are often the coldest days of the year: the rivers are frozen solid and the ground is as hard as stone.",
      "But people are not afraid, because once Dahan is over, Lichun comes round again.",
      "So at Dahan every family is busy getting ready for the New Year: cleaning the house, writing spring couplets, preparing good things to eat.",
      "People working far away all hurry home to spend the New Year with their families.",
      "A year starts at Lichun and ends at Dahan, then starts again, year after year, like a circle.",
    ],
    words: [
      { zh: "大寒", py: "dà hán", en: "Major Cold" },
      { zh: "最后", py: "zuì hòu", en: "last" },
      { zh: "冷", py: "lěng", en: "cold" },
      { zh: "立春", py: "lì chūn", en: "Start of Spring" },
    ],
    questions: [
      { question: "大寒这么冷，人们为什么不怕？", answer: "因为大寒一过，就又到立春了。" },
      { question: "大寒的时候，家家都在忙什么？", answer: "忙着过年：打扫房子，写春联，准备好吃的。" },
    ],
  },

  // ── the five festivals ─────────────────────────────────────────────────
  festival_spring: {
    paragraphs: [
      "春节是中国最重要的节日，也是一年的第一天。",
      "春节以前，家家都要把房子打扫干净，门上贴红色的春联，因为新的一年要有新的样子。",
      "这几天，在外面工作、读书的人都回家，一家人坐在一起吃一顿大大的年夜饭。",
      "年夜饭里一定有鱼，因为“鱼”和“余”的声音一样，“年年有余”就是每年都有多的。",
      "吃完饭，大人给小孩红包，红包里有钱，意思是新的一年平平安安。",
      "第二天早上，大家见面都说：“新年好！”",
    ],
    paragraphsEn: [
      "The Spring Festival, Chinese New Year, is China's most important festival, and the first day of the year.",
      "Before it, every family cleans the house and pastes red couplets on the door, because a new year should have a new look.",
      "In these days everyone working or studying away from home comes back, and the family sits down together to a big New Year's Eve dinner.",
      "There is always a fish on the table, because \"fish\" and \"plenty\" sound the same in Chinese: \"fish every year\" means \"plenty every year\".",
      "After dinner the grown-ups give the children red envelopes with money inside, a wish for a safe and peaceful new year.",
      "The next morning, everyone who meets says: \"Happy New Year!\"",
    ],
    words: [
      { zh: "春节", py: "chūn jié", en: "Spring Festival" },
      { zh: "节日", py: "jié rì", en: "festival" },
      { zh: "红包", py: "hóng bāo", en: "red envelope" },
      { zh: "新年", py: "xīn nián", en: "new year" },
    ],
    questions: [
      { question: "春节以前，为什么家家都要打扫房子、贴春联？", answer: "因为新的一年要有新的样子。" },
      { question: "年夜饭里为什么一定有鱼？", answer: "因为“鱼”和“余”的声音一样，“年年有余”就是每年都有多的。" },
    ],
  },
  festival_lantern: {
    paragraphs: [
      "元宵节在春节以后的第十五天，是过年的最后一天。",
      "这一天晚上的月亮是新年的第一个圆月。",
      "很久以前，人们在这一天晚上点灯，是为了让天上的神看到，今年家里平平安安。",
      "后来灯越做越好看：有鱼灯，有兔子灯，有龙灯，人们出门看灯，街上很热闹。",
      "有的灯上写着一句话，让你猜一个字，猜对了有小礼物，这叫“猜灯谜”。",
      "大家还吃元宵。元宵是圆的，白白的，里面很甜，一家人吃了，就像月亮一样团团圆圆。",
    ],
    paragraphsEn: [
      "The Lantern Festival falls on the fifteenth day after Chinese New Year, the last day of the holiday.",
      "The moon that night is the first full moon of the new year.",
      "Long ago people lit lamps on this night so that the gods in heaven could see that the family was safe and well.",
      "Later the lanterns grew ever more beautiful, shaped like fish, rabbits and dragons, and people went out to see them, filling the streets.",
      "Some lanterns carry a riddle whose answer is one character; guess right and you win a small prize. This is called \"guessing lantern riddles\".",
      "Everyone also eats yuanxiao, round white sweet rice balls; a family that eats them together is whole and round, like the moon.",
    ],
    words: [
      { zh: "元宵节", py: "yuán xiāo jié", en: "Lantern Festival" },
      { zh: "灯", py: "dēng", en: "lantern; light" },
      { zh: "热闹", py: "rè nao", en: "lively; bustling" },
      { zh: "圆", py: "yuán", en: "round" },
    ],
    questions: [
      { question: "很久以前，人们为什么在元宵节晚上点灯？", answer: "为了让天上的神看到，今年家里平平安安。" },
      { question: "为什么元宵节要吃圆圆的元宵？", answer: "一家人吃了，就像月亮一样团团圆圆。" },
    ],
  },
  festival_qingming: {
    paragraphs: [
      "清明节在春天，天气很好，草绿了，花开了。",
      "这一天，人们去看过去的家人。",
      "家人不在了，可是人们没有忘记他们，所以每年这一天都要去看一看。",
      "人们把那里的草拔干净，给他们送花，还说一说家里这一年的事。",
      "这叫“扫墓”，意思是把家人住的地方打扫干净。",
      "看完家人，很多人在春天里走一走，放风筝，看看草和树，这叫“踏青”。",
    ],
    paragraphsEn: [
      "The Qingming Festival comes in spring, when the weather is fine, the grass is green and the flowers are out.",
      "On this day people visit the family members who have died.",
      "They are gone, but they are not forgotten, so every year on this day the family goes to see them.",
      "People clear the weeds from the grave, bring flowers, and tell them what has happened in the family this year.",
      "This is called \"sweeping the tombs\": cleaning the place where the family rests.",
      "Afterwards many people walk in the spring, fly kites and look at the grass and trees; this is called \"treading the green\".",
    ],
    words: [
      { zh: "清明节", py: "qīng míng jié", en: "Qingming Festival" },
      { zh: "春天", py: "chūn tiān", en: "spring" },
      { zh: "送", py: "sòng", en: "to give; to bring" },
      { zh: "花", py: "huā", en: "flower" },
    ],
    questions: [
      { question: "人们为什么每年清明节都去看过去的家人？", answer: "家人不在了，可是人们没有忘记他们。" },
      { question: "“扫墓”是什么意思？", answer: "把家人住的地方打扫干净。" },
    ],
  },
  festival_dragon_boat: {
    paragraphs: [
      "端午节在夏天，是为了记住一位古时候的诗人，他叫屈原。",
      "屈原很爱自己的国家，可是国王不听他的话，后来国家被别人打败了。",
      "屈原非常难过，跳进了河里。",
      "人们很爱屈原，坐船到河上去找他，可是没有找到。",
      "他们把米放进水里，希望鱼吃米，不要吃他。",
      "所以今天我们在端午节赛龙舟，也吃粽子：龙舟就是那时候找他的船，粽子就是那时候放进水里的米。",
    ],
    paragraphsEn: [
      "The Dragon Boat Festival, in summer, remembers a poet of ancient times called Qu Yuan.",
      "Qu Yuan loved his country, but the king would not listen to him, and later the country was defeated.",
      "Qu Yuan was heartbroken, and threw himself into the river.",
      "The people loved him and rowed out onto the river to look for him, but could not find him.",
      "They threw rice into the water, hoping the fish would eat the rice and not him.",
      "So today we race dragon boats and eat zongzi at the festival: the boats are the boats that searched for him, and the zongzi are the rice thrown into the water.",
    ],
    words: [
      { zh: "端午节", py: "duān wǔ jié", en: "Dragon Boat Festival" },
      { zh: "诗人", py: "shī rén", en: "poet" },
      { zh: "龙舟", py: "lóng zhōu", en: "dragon boat" },
      { zh: "粽子", py: "zòng zi", en: "sticky-rice dumpling" },
    ],
    questions: [
      { question: "屈原为什么跳进了河里？", answer: "国王不听他的话，国家被别人打败了，他非常难过。" },
      { question: "为什么今天我们在端午节赛龙舟、吃粽子？", answer: "龙舟就是那时候找他的船，粽子就是那时候放进水里的米。" },
    ],
  },
  festival_mid_autumn: {
    paragraphs: [
      "中秋节在秋天的中间，这一天晚上的月亮是一年里最大最圆的。",
      "秋天田里的东西都收好了，人们有时间，也有好吃的，所以一家人晚上坐在一起看月亮。",
      "他们吃月饼。月饼是圆的，和月亮一样，一个月饼切开，一家人一人一块。",
      "老人常常说嫦娥的故事：她吃了一种药，飞到了月亮上，从此一个人住在那里，只有一只兔子和她做伴。",
      "所以有人说，月亮上那些黑黑的地方，就是嫦娥和她的兔子。",
      "月亮是圆的，家也应该是圆的，所以看到月亮的时候，不在家的人也会想起家里。",
    ],
    paragraphsEn: [
      "The Mid-Autumn Festival falls in the middle of autumn, when the moon that night is the biggest and roundest of the year.",
      "The harvest is in, so people have time and good things to eat, and the family sits together in the evening to watch the moon.",
      "They eat mooncakes. A mooncake is round like the moon, and one cake is cut so that everyone in the family has a piece.",
      "Old people often tell the story of Chang'e: she took a magic medicine, flew up to the moon, and has lived there alone ever since with only a rabbit for company.",
      "So some say the dark patches on the moon are Chang'e and her rabbit.",
      "The moon is round and a family should be whole too, so anyone away from home who sees the moon thinks of home.",
    ],
    words: [
      { zh: "中秋节", py: "zhōng qiū jié", en: "Mid-Autumn Festival" },
      { zh: "月亮", py: "yuè liang", en: "moon" },
      { zh: "月饼", py: "yuè bǐng", en: "mooncake" },
      { zh: "圆", py: "yuán", en: "round" },
    ],
    questions: [
      { question: "为什么中秋节一家人晚上坐在一起看月亮？", answer: "田里的东西收好了，人们有时间，也有好吃的，这一天的月亮又最大最圆。" },
      { question: "看到月亮的时候，不在家的人为什么会想起家里？", answer: "月亮是圆的，家也应该是圆的。" },
    ],
  },
};
