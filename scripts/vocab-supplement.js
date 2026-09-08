"use strict";
/**
 * Ordinary vocabulary the curriculum did not carry.
 *
 * `build_hsk_curriculum.js` takes the top 300 words per level from the upstream
 * HSK 3.0 list, ranked by corpus frequency. That corpus is adult and
 * news-heavy, so the 300-word cut kept 法官 "judge", 武器 "weapon" and 事故
 * "accident" while dropping 姐姐, 天气, 再见, 星期, 九 and 零. The result was a
 * curriculum that could not teach a child the words a child actually uses —
 * not in a story, not in a game, not in a quiz. Story authoring hit it as a
 * wall: `build_stories.js` refuses any span the curriculum cannot vouch for,
 * and 66 of 980 authored sentences were rejected for ordinary words.
 *
 * These lists close that gap. They are ADDITIVE: nothing already taught is
 * removed, so no child loses a word they have met.
 *
 * Every word here is in the upstream list AT THIS LEVEL — `build_vocab_supplement.js`
 * fails if one is not, so a word cannot drift to a level it does not belong to.
 *
 * **Every gloss is hand-written.** Upstream's first meaning is routinely unusable
 * for a child: 怕 is "surname Pa", 鱼 "surname Yu", 提 "used in 防 and 溜",
 * 满 "Manchu ethnic group", and 鸟 carries an obscenity. Taking `meanings[0]`
 * is what put "surname Shui" on 水 in the first place. Pinyin comes from
 * upstream, which is reliable.
 */

// ── HSK1 — the beginner lexicon that was missing outright ────────────────────
const HSK1 = {
  // Family and people
  "爷爷": "grandpa", "奶奶": "grandma", "哥哥": "older brother",
  "姐姐": "older sister", "弟弟": "younger brother", "妹妹": "younger sister",
  "家人": "family members", "老人": "an old person", "小朋友": "young child",
  "同学": "classmate",
  // Numbers and amounts
  "九": "nine", "零": "zero", "百": "hundred", "一半": "half",
  "一点儿": "a little",
  // Time
  "星期": "week", "星期天": "Sunday", "上午": "morning", "中午": "midday",
  "白天": "daytime", "前天": "the day before yesterday",
  "后天": "the day after tomorrow", "明年": "next year", "新年": "New Year",
  "生日": "birthday", "日期": "date", "一会儿": "a little while",
  "有时候": "sometimes", "半天": "a long while",
  // Food and drink
  "饭": "cooked rice; a meal", "米饭": "cooked rice", "面包": "bread",
  "鸡蛋": "egg", "牛奶": "milk", "水果": "fruit", "菜": "vegetable; dish",
  "茶": "tea", "包子": "steamed bun", "早饭": "breakfast", "午饭": "lunch",
  "晚饭": "dinner",
  // Home and things
  "桌子": "table", "杯子": "cup", "本子": "notebook", "书包": "schoolbag",
  "钱包": "wallet", "衣服": "clothes", "电视机": "television",
  "门口": "doorway", "楼上": "upstairs", "楼下": "downstairs",
  // School
  "上学": "to go to school", "放学": "school lets out",
  "上课": "to start class", "下课": "class ends", "课本": "textbook",
  "课文": "a reading passage", "汉字": "Chinese character",
  "汉语": "the Chinese language", "中文": "Chinese", "小学": "primary school",
  "中学": "middle school", "图书馆": "library",
  // Places
  "商店": "shop", "书店": "bookshop", "饭店": "restaurant",
  "车站": "station", "火车": "train", "机场": "airport",
  "电影院": "cinema", "洗手间": "toilet", "商场": "shopping centre",
  "马路": "road", "路口": "crossroads",
  // Where things are
  "左边": "the left side", "右边": "the right side", "上边": "above",
  "下边": "below", "里边": "the inside", "外边": "the outside", "前边": "in front",
  "后边": "behind", "东边": "the east side", "西边": "the west side",
  "南边": "the south side", "北边": "the north side",
  // Outdoors and weather
  "树": "tree", "雨": "rain", "下雨": "to rain", "天气": "weather",
  "地上": "on the ground",
  // Being polite
  "再见": "goodbye", "对不起": "sorry", "没关系": "it's all right",
  "不客气": "you're welcome", "请问": "may I ask", "请进": "please come in",
  "请坐": "please sit down", "请假": "to ask for leave",
  // Everyday doing words
  "唱歌": "to sing", "打球": "to play ball", "读书": "to read; to study",
  "见面": "to meet", "听见": "to hear", "记住": "to remember",
  "起床": "to get up", "走路": "to walk", "坐下": "to sit down",
  "开车": "to drive", "上车": "to get on", "下车": "to get off",
  "生病": "to fall ill", "看病": "to see a doctor",
  // Describing words
  "干净": "clean", "慢": "slow", "贵": "expensive", "饿": "hungry",
  "渴": "thirsty", "生气": "angry", "好吃": "tasty", "好看": "good-looking",
  "好听": "nice to listen to", "有名": "famous",
  // Useful odds and ends
  "帮忙": "to help out", "考试": "exam", "知识": "knowledge",
  "爱好": "hobby", "中间": "the middle", "旁边": "beside",
  "这儿": "here", "哪儿": "where",
};

// ── HSK2 ─────────────────────────────────────────────────────────────────────
const HSK2 = {
  // Body
  "脚": "foot", "嘴": "mouth", "腿": "leg", "头发": "hair",
  // Animals
  "猫": "cat", "鸡": "chicken", "鸟": "bird", "鱼": "fish", "动物": "animal",
  // Food
  "蛋": "egg", "油": "oil", "食物": "food", "味道": "flavour",
  // Outdoors
  "太阳": "the sun", "雪": "snow", "空气": "air", "地球": "the Earth",
  "河": "river", "夜": "night", "安静": "quiet",
  // The four seasons: 夏天 was one of the words story authoring was rejected
  // for, and a curriculum that cannot say "summer" cannot tell a year's story.
  "春天": "spring", "夏天": "summer", "秋天": "autumn", "冬天": "winter",
  // Colours
  "颜色": "colour", "红色": "red", "黄": "yellow", "蓝": "blue",
  // Things
  "笔": "pen", "纸": "paper", "鞋": "shoe", "灯": "lamp", "网": "net",
  "瓶": "bottle", "船": "boat",
  // Places
  "办公室": "office", "公园": "park", "街": "street", "酒店": "hotel",
  "高中": "high school",
  // Time
  "周末": "weekend", "刚才": "just now", "后来": "later on", "日子": "a day",
  "多久": "how long", "出生": "to be born",
  // Describing words
  "漂亮": "pretty", "健康": "healthy", "年轻": "young", "短": "short",
  "低": "low", "急": "in a hurry", "疼": "sore", "舒服": "comfortable",
  "满意": "pleased", "可怕": "frightening", "方便": "convenient",
  "合适": "suitable",
  // Doing words
  "哭": "to cry", "怕": "to be afraid", "爬": "to climb", "骑": "to ride",
  "练": "to practise", "借": "to borrow; to lend", "养": "to raise",
  "喊": "to shout", "画": "to draw", "长大": "to grow up",
  "想起": "to think of", "照顾": "to look after", "听说": "to hear that",
  "提高": "to improve", "出发": "to set off", "小心": "to be careful",
  "关心": "to care about", "数": "to count",
  // How much
  "千": "thousand", "好多": "a great many", "差不多": "about the same",
  "经常": "often", "许多": "many", "不少": "quite a few",
  "越来越": "more and more",
  // Things people say
  "晚安": "good night", "喂": "hello (on the phone)", "怎么样": "how about it",
  "怎么办": "what should we do", "不行": "that won't do",
  // Other
  "意思": "meaning", "习惯": "habit", "方向": "direction", "成绩": "result",
  "语言": "language",
};

// ── HSK3 ─────────────────────────────────────────────────────────────────────
const HSK3 = {
  // Food and taste
  "糖": "sugar; sweets", "汤": "soup", "苹果": "apple", "甜": "sweet",
  "食品": "foodstuff", "卫生": "hygiene",
  // Outdoors
  "阳光": "sunshine", "桥": "bridge", "土": "soil", "石头": "stone",
  "温暖": "warm", "静": "still", "村": "village", "古": "ancient",
  // Animals
  "羊": "sheep",
  // Play and sport
  "足球": "football", "游": "to swim", "舞台": "stage", "决赛": "final match",
  // Body and feeling
  "胖": "chubby", "伤心": "sad", "坚强": "strong-willed",
  // People
  "女子": "woman", "男子": "man", "主任": "director", "作者": "author",
  "人才": "talented person", "歌手": "singer",
  // School and learning
  "课程": "course", "基础": "foundation", "进步": "progress",
  "指导": "to guide", "成长": "to grow up", "体验": "to experience",
  "话题": "topic",
  // Things
  "机器": "machine", "铁": "iron", "服装": "clothing", "工具": "tool",
  "现金": "cash",
  // Places
  "工厂": "factory", "厂": "works", "公共": "shared by everyone", "国内": "domestic",
  "各地": "everywhere",
  // Time
  "大约": "roughly", "提前": "ahead of time", "将来": "the future",
  "长期": "long term", "至今": "up to now", "当初": "back then",
  // Doing words
  "搬": "to move", "赶": "to hurry", "存": "to store", "念": "to read aloud",
  "造": "to build", "补": "to mend", "围": "to surround", "订": "to book",
  "争": "to compete", "吵": "to quarrel", "整理": "to tidy up",
  "庆祝": "to celebrate", "举办": "to hold an event", "计算": "to calculate",
  "开发": "to develop", "打破": "to break",
  // Describing words
  "紧急": "urgent", "积极": "eager", "强烈": "intense", "丰富": "abundant",
  "完整": "complete", "深刻": "profound", "全面": "all-round",
  "明确": "clear-cut", "现代": "modern", "类似": "alike",
  // Other
  "互相": "each other", "科技": "technology", "印象": "impression",
  "形式": "form", "现象": "phenomenon", "命运": "fate", "愿望": "wish",
  "性格": "character", "团结": "to unite", "只好": "to have no choice but",
};

// ── HSK4 ─────────────────────────────────────────────────────────────────────
const HSK4 = {
  // Body
  "脑袋": "head", "肚子": "belly", "腰": "waist", "眼泪": "tears",
  "身材": "build", "眼镜": "glasses", "体重": "body weight", "帽子": "hat",
  // Family and people
  "叔叔": "uncle", "姐妹": "sisters", "大哥": "eldest brother",
  "夫妻": "husband and wife", "夫妇": "married couple", "护士": "nurse",
  "运动员": "athlete",
  // Food
  "巧克力": "chocolate", "玉米": "corn", "盐": "salt", "辣": "spicy",
  "酸": "sour", "冰箱": "fridge",
  // Clothes and things
  "外套": "coat", "袋": "bag", "针": "needle", "模型": "model",
  "唱片": "record", "窗户": "window",
  // Outdoors
  "圆": "round", "地面": "the ground", "地下": "underground",
  "风景": "scenery", "植物": "plant",
  // Places and travel
  "大楼": "a tall building", "街道": "street", "电梯": "lift",
  "县": "county", "航班": "flight", "列车": "train",
  // Doing words
  "寄": "to post", "登": "to climb up", "摇": "to shake", "刷": "to brush",
  "睡着": "to fall asleep", "遇见": "to run into", "散": "to scatter",
  "减": "to subtract", "晒": "to dry in the sun", "填": "to fill in",
  "折": "to fold", "引": "to lead", "移": "to shift", "划": "to row",
  "堵": "to block", "拍照": "to take a photo", "迟到": "to arrive late",
  "锻炼": "to exercise",
  // Describing words
  "松": "loose", "弱": "weak", "宽": "wide", "细": "fine; thin",
  "厚": "thick", "薄": "thin (of a layer)", "粗": "coarse", "矮": "short (in height)",
  "笨": "clumsy", "纯": "pure", "稳": "steady", "沉": "heavy",
  "勇敢": "brave", "善良": "kind-hearted",
  // Feelings
  "冷静": "calm", "平静": "peaceful", "想念": "to miss someone",
  "怀念": "to look back fondly", "沉默": "silent", "勇气": "courage",
  "运气": "luck",
  // Other
  "地位": "standing", "质量": "quality", "结构": "structure",
  "教训": "a lesson learned", "结论": "conclusion", "培养": "to nurture",
  "独特": "distinctive", "逐渐": "gradually", "平均": "average",
  "统一": "to unify", "假如": "supposing",
};

module.exports = { 1: HSK1, 2: HSK2, 3: HSK3, 4: HSK4 };
