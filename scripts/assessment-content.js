"use strict";
/**
 * Curated assessment content, band by band.
 *
 * HAND-AUTHORED. Nothing here is taken from data/hsk*.json beyond deciding
 * which words are in band: that data gives 听 as "yǐn", 上 as "shǎng", 看 as
 * "kān", 打 as "dozen" and 着 as "(chess) move", and glosses everything in
 * adult dictionary phrasing. Every reading and every child-facing string below
 * is authored, and corrections are recorded in docs/content-review.md.
 *
 * Rules applied when selecting audio targets (recognition + decoding):
 *   - single syllable, so the fixed clip set can be used and the item sounds
 *     identical on every device;
 *   - tone-marked, because the app's clip-key derivation forces a neutral tone
 *     to first tone (B02i) and would play a wrong reading;
 *   - no polyphonic characters, since a bare character gives no context to
 *     disambiguate which reading is being asked for;
 *   - recognition and decoding target sets are disjoint within a band.
 *
 * `anchor: true` = appears in BOTH forms, identically. Everything else is
 * form-specific.
 */

// ── C1 ──────────────────────────────────────────────────────────────────────
const C1 = {
  passageRange: [25, 50],
  recognition: [
    { zh:"水", py:"shuǐ", en:"water",    anchor:true },
    { zh:"山", py:"shān", en:"mountain", anchor:true },
    { zh:"人", py:"rén",  en:"person",   form:"A" },
    { zh:"大", py:"dà",   en:"big",      form:"A" },
    { zh:"小", py:"xiǎo", en:"small",    form:"A" },
    { zh:"好", py:"hǎo",  en:"good",     form:"A" },
    { zh:"天", py:"tiān", en:"sky; day", form:"A" },
    { zh:"家", py:"jiā",  en:"home",     form:"A" },
    { zh:"门", py:"mén",  en:"door",     form:"B" },
    { zh:"车", py:"chē",  en:"car",      form:"B" },
    { zh:"手", py:"shǒu", en:"hand",     form:"B" },
    { zh:"口", py:"kǒu",  en:"mouth",    form:"B" },
    { zh:"花", py:"huā",  en:"flower",   form:"B" },
    { zh:"月", py:"yuè",  en:"moon",     form:"B" },
  ],
  decoding: [
    { zh:"吃", py:"chī",  en:"to eat",   anchor:true },
    { zh:"走", py:"zǒu",  en:"to walk",  anchor:true },
    { zh:"喝", py:"hē",   en:"to drink", form:"A" },
    { zh:"说", py:"shuō", en:"to speak", form:"A" },
    { zh:"学", py:"xué",  en:"to study", form:"A" },
    { zh:"白", py:"bái",  en:"white",    form:"A" },
    { zh:"高", py:"gāo",  en:"tall",     form:"A" },
    { zh:"快", py:"kuài", en:"fast",     form:"A" },
    { zh:"冷", py:"lěng", en:"cold",     form:"B" },
    { zh:"热", py:"rè",   en:"hot",      form:"B" },
    { zh:"老", py:"lǎo",  en:"old",      form:"B" },
    { zh:"爱", py:"ài",   en:"to love",  form:"B" },
    { zh:"笑", py:"xiào", en:"to laugh", form:"B" },
    { zh:"早", py:"zǎo",  en:"early",    form:"B" },
  ],
  meaning: [
    { sent:"我喝水。",      target:"喝", answer:"drink",       wrong:["eat","run","sleep"],          anchor:true },
    { sent:"妈妈在家。",    target:"家", answer:"home",        wrong:["school","shop","park"],       anchor:true },
    { sent:"爸爸看书。",    target:"书", answer:"book",        wrong:["phone","bowl","chair"],       form:"A" },
    { sent:"天上有月。",    target:"月", answer:"the moon",    wrong:["a bird","the sun","a cloud"], form:"A" },
    { sent:"山上有花。",    target:"花", answer:"flowers",     wrong:["snow","rocks","houses"],      form:"A" },
    { sent:"我学中文。",    target:"学", answer:"study",       wrong:["forget","sell","carry"],      form:"A" },
    { sent:"水很冷。",      target:"冷", answer:"cold",        wrong:["deep","clean","sweet"],       form:"A" },
    { sent:"他走得很快。",  target:"快", answer:"fast",        wrong:["slowly","quietly","far"],     form:"A" },
    { sent:"天很热。",      target:"热", answer:"hot",         wrong:["windy","dark","wet"],         form:"B" },
    { sent:"哥哥走得早。",  target:"早", answer:"early",       wrong:["late","alone","again"],       form:"B" },
    { sent:"他笑了。",      target:"笑", answer:"laughed",     wrong:["cried","left","slept"],       form:"B" },
    { sent:"门前有车。",    target:"前", answer:"in front of", wrong:["behind","inside","under"],    form:"B" },
    { sent:"我爱我家。",    target:"爱", answer:"love",        wrong:["leave","clean","build"],      form:"B" },
    { sent:"老人在前面。",  target:"老", answer:"old",         wrong:["tall","busy","new"],          form:"B" },
  ],
  passages: [
    { id:"c1p1", form:"A", zh:"早上，妈妈在家。她说：“今天天很好，我们上山去。”我很爱上山。山上有花，花很白。我笑了。",
      questions:[
        { kind:"literal",   q:"What did Mum say the weather was like today?", answer:"Very good", wrong:["Very cold","Very windy","Very dark"], form:"A" },
        { kind:"reference", q:"In the story, who is “她” (she)?", answer:"Mum", wrong:["The child","The flower","A friend"], form:"A" },
        { kind:"inference", q:"Why does the child smile at the end?", answer:"Because they are happy going up the mountain", wrong:["Because they are going home","Because it started to rain","Because Mum was late"], form:"A" },
      ] },
    { id:"c1p2", form:"both", zh:"爸爸有一本书。书里有山，有水，也有花。他很爱看这本书。晚上，他在家看书。我也看。",
      questions:[
        { kind:"literal",   q:"What does Dad have?", answer:"A book", wrong:["A car","A flower","A cup"], anchor:true },
        { kind:"literal",   q:"What is inside the book?", answer:"Mountains, water and flowers", wrong:["Cars and roads","Animals and food","Numbers and letters"], form:"A" },
        { kind:"reference", q:"Where does Dad read in the evening?", answer:"At home", wrong:["At school","On the mountain","In the car"], form:"A" },
        { kind:"reference", q:"In the story, who is “他” (he)?", answer:"Dad", wrong:["The child","The writer","A teacher"], form:"B" },
        { kind:"inference", q:"How can you tell Dad likes this book?", answer:"He reads it at home in the evenings", wrong:["He bought two of them","He gave it away","He wrote it himself"], form:"B" },
      ] },
    { id:"c1p3", form:"B", zh:"今天很冷。我和哥哥走到山下。山上有水，水很冷。哥哥说：“早点回家吧。”我们就走了。",
      questions:[
        { kind:"literal",   q:"What is the weather like today?", answer:"Cold", wrong:["Hot","Rainy","Windy"], form:"B" },
        { kind:"sequence",  q:"What happens right after big brother speaks?", answer:"They go home", wrong:["They climb higher","They drink the water","They sit down"], form:"B" },
        { kind:"inference", q:"Why does big brother want to go home early?", answer:"Because it is cold", wrong:["Because he is hungry","Because it is dark","Because he is tired"], form:"B" },
      ] },
  ],
  writing: [
    { zh:"水", py:"shuǐ", en:"water",    anchor:true },
    { zh:"人", py:"rén",  en:"person",   form:"A" },
    { zh:"大", py:"dà",   en:"big",      form:"A" },
    { zh:"小", py:"xiǎo", en:"small",    form:"A" },
    { zh:"口", py:"kǒu",  en:"mouth",    form:"B" },
    { zh:"手", py:"shǒu", en:"hand",     form:"B" },
    { zh:"山", py:"shān", en:"mountain", form:"B" },
  ],
};

// ── C2 ──────────────────────────────────────────────────────────────────────
const C2 = {
  passageRange: [50, 80],
  recognition: [
    { zh:"狗", py:"gǒu",  en:"dog",      anchor:true },
    { zh:"马", py:"mǎ",   en:"horse",    anchor:true },
    { zh:"米", py:"mǐ",   en:"rice",     form:"A" },
    { zh:"药", py:"yào",  en:"medicine", form:"A" },
    { zh:"店", py:"diàn", en:"shop",     form:"A" },
    { zh:"眼", py:"yǎn",  en:"eye",      form:"A" },
    { zh:"脸", py:"liǎn", en:"face",     form:"A" },
    { zh:"心", py:"xīn",  en:"heart",    form:"A" },
    { zh:"头", py:"tóu",  en:"head",     form:"B" },
    { zh:"红", py:"hóng", en:"red",      form:"B" },
    { zh:"名", py:"míng", en:"name",     form:"B" },
    { zh:"信", py:"xìn",  en:"letter",   form:"B" },
    { zh:"卡", py:"kǎ",   en:"card",     form:"B" },
    { zh:"停", py:"tíng", en:"to stop",  form:"B" },
  ],
  decoding: [
    { zh:"让", py:"ràng",  en:"to let",        anchor:true },
    { zh:"带", py:"dài",   en:"to bring",      anchor:true },
    { zh:"完", py:"wán",   en:"to finish",     form:"A" },
    { zh:"接", py:"jiē",   en:"to receive",    form:"A" },
    { zh:"拉", py:"lā",    en:"to pull",       form:"A" },
    { zh:"讲", py:"jiǎng", en:"to tell",       form:"A" },
    { zh:"卖", py:"mài",   en:"to sell",       form:"A" },
    { zh:"选", py:"xuǎn",  en:"to choose",     form:"A" },
    { zh:"换", py:"huàn",  en:"to swap",       form:"B" },
    { zh:"懂", py:"dǒng",  en:"to understand", form:"B" },
    { zh:"办", py:"bàn",   en:"to handle",     form:"B" },
    { zh:"留", py:"liú",   en:"to keep",       form:"B" },
    { zh:"收", py:"shōu",  en:"to collect",    form:"B" },
    { zh:"靠", py:"kào",   en:"to lean on",    form:"B" },
  ],
  meaning: [
    { sent:"我的狗很小。",        target:"狗", answer:"a dog",        wrong:["a cat","a bird","a fish"],            anchor:true },
    { sent:"妈妈让我早点回家。",  target:"让", answer:"tells me to",  wrong:["stops me","helps me","asks me why"],  anchor:true },
    { sent:"他带了一本书来。",    target:"带", answer:"brought",      wrong:["lost","read","bought"],               form:"A" },
    { sent:"这家店卖水果。",      target:"卖", answer:"sells",        wrong:["grows","eats","washes"],              form:"A" },
    { sent:"我看不懂这个字。",    target:"懂", answer:"understand",   wrong:["write","hear","like"],                form:"A" },
    { sent:"请你选一个。",        target:"选", answer:"choose",       wrong:["count","move","open"],                form:"A" },
    { sent:"他的脸很红。",        target:"脸", answer:"face",         wrong:["hair","hand","coat"],                 form:"A" },
    { sent:"车在门前停了。",      target:"停", answer:"stopped",      wrong:["started","turned","fell"],            form:"A" },
    { sent:"我给她写了一封信。",  target:"信", answer:"a letter",     wrong:["a song","a list","a story"],          form:"B" },
    { sent:"你叫什么名字？",      target:"名", answer:"name",         wrong:["age","job","school"],                 form:"B" },
    { sent:"他的头有点痛。",      target:"头", answer:"head",         wrong:["foot","back","arm"],                  form:"B" },
    { sent:"我们吃米饭。",        target:"米", answer:"rice",         wrong:["bread","noodles","soup"],             form:"B" },
    { sent:"医生给了他一些药。",  target:"药", answer:"medicine",     wrong:["water","money","food"],               form:"B" },
    { sent:"请你把书收起来。",    target:"收", answer:"put away",     wrong:["read out","throw away","give back"],  form:"B" },
  ],
  passages: [
    { id:"c2p1", form:"A", zh:"小明有一只狗，它的名字叫小白。每天早上，小明都带小白去外面走一走。路上有很多人，也有别的狗。小白最爱和它们一起玩。回家以后，小明给小白一些米和水，小白很高兴。",
      questions:[
        { kind:"literal",   q:"What is the dog called?", answer:"Xiao Bai", wrong:["Xiao Ming","Xiao Hong","Xiao Mi"], form:"A" },
        { kind:"sequence",  q:"What does Xiao Ming do after they get home?", answer:"He gives the dog some rice and water", wrong:["He takes the dog out again","He goes to sleep","He calls a friend"], form:"A" },
        { kind:"inference", q:"Why does Xiao Bai enjoy the walk?", answer:"Because there are other dogs to play with", wrong:["Because the walk is short","Because it is quiet outside","Because Xiao Ming carries him"], form:"A" },
      ] },
    { id:"c2p2", form:"both", zh:"王医生的药店就在一家小店旁边。每天都有很多人来买药。有一天，一位老人来了，他说自己的头很痛。王医生给了他一些药，还让他多喝水，早点休息。老人说：“谢谢你，王医生。”",
      questions:[
        { kind:"literal",   q:"What is wrong with the old man?", answer:"His head hurts", wrong:["His eyes hurt","He is hungry","He is cold"], anchor:true },
        { kind:"literal",   q:"What is next to Doctor Wang's shop?", answer:"A small shop", wrong:["A school","A park","A station"], form:"A" },
        { kind:"reference", q:"Besides medicine, what does Doctor Wang tell him to do?", answer:"Drink more water and rest early", wrong:["Come back tomorrow","Walk every day","Eat more rice"], form:"A" },
        { kind:"reference", q:"Who says thank you at the end?", answer:"The old man", wrong:["Doctor Wang","The shopkeeper","A child"], form:"B" },
        { kind:"inference", q:"What kind of doctor does Wang seem to be?", answer:"Careful — he gives advice as well as medicine", wrong:["Impatient — he sends people away","Forgetful — he loses the medicine","Strict — he refuses to help"], form:"B" },
      ] },
    { id:"c2p3", form:"B", zh:"今天是星期六。姐姐带我去外面买东西。我们先到一家书店，买了两本书。后来我们又去了一家小店，我选了一张红色的卡。回家以前，姐姐还给我买了一个小马。我很高兴。",
      questions:[
        { kind:"literal",   q:"What day is it in the story?", answer:"Saturday", wrong:["Sunday","Monday","Friday"], form:"B" },
        { kind:"sequence",  q:"Where do they go first?", answer:"A bookshop", wrong:["A small shop","Home","A friend's house"], form:"B" },
        { kind:"inference", q:"How does the child feel about the day?", answer:"Happy", wrong:["Tired","Bored","Worried"], form:"B" },
      ] },
  ],
  writing: [
    { zh:"心", py:"xīn",  en:"heart",   anchor:true },
    { zh:"马", py:"mǎ",   en:"horse",   form:"A" },
    { zh:"米", py:"mǐ",   en:"rice",    form:"A" },
    { zh:"名", py:"míng", en:"name",    form:"A" },
    { zh:"头", py:"tóu",  en:"head",    form:"B" },
    { zh:"红", py:"hóng", en:"red",     form:"B" },
    { zh:"停", py:"tíng", en:"to stop", form:"B" },
  ],
};

// ── C3 ──────────────────────────────────────────────────────────────────────
const C3 = {
  passageRange: [80, 120],
  recognition: [
    { zh:"牛", py:"niú",   en:"cow",       anchor:true },
    { zh:"火", py:"huǒ",   en:"fire",      anchor:true },
    { zh:"刀", py:"dāo",   en:"knife",     form:"A" },
    { zh:"猪", py:"zhū",   en:"pig",       form:"A" },
    { zh:"龙", py:"lóng",  en:"dragon",    form:"A" },
    { zh:"金", py:"jīn",   en:"gold",      form:"A" },
    { zh:"城", py:"chéng", en:"city",      form:"A" },
    { zh:"光", py:"guāng", en:"light",     form:"A" },
    { zh:"皮", py:"pí",    en:"skin",      form:"B" },
    { zh:"香", py:"xiāng", en:"fragrant",  form:"B" },
    { zh:"图", py:"tú",    en:"picture",   form:"B" },
    { zh:"板", py:"bǎn",   en:"board",     form:"B" },
    { zh:"室", py:"shì",   en:"room",      form:"B" },
    { zh:"钟", py:"zhōng", en:"clock",     form:"B" },
  ],
  decoding: [
    { zh:"抓", py:"zhuā",  en:"to grab",     anchor:true },
    { zh:"挂", py:"guà",   en:"to hang",     anchor:true },
    { zh:"跳", py:"tiào",  en:"to jump",     form:"A" },
    { zh:"追", py:"zhuī",  en:"to chase",    form:"A" },
    { zh:"破", py:"pò",    en:"broken",      form:"A" },
    { zh:"传", py:"chuán", en:"to pass on",  form:"A" },
    { zh:"输", py:"shū",   en:"to lose",     form:"A" },
    { zh:"配", py:"pèi",   en:"to match",    form:"A" },
    { zh:"演", py:"yǎn",   en:"to perform",  form:"B" },
    { zh:"建", py:"jiàn",  en:"to build",    form:"B" },
    { zh:"修", py:"xiū",   en:"to repair",   form:"B" },
    { zh:"退", py:"tuì",   en:"to step back",form:"B" },
    { zh:"付", py:"fù",    en:"to pay",      form:"B" },
    { zh:"升", py:"shēng", en:"to rise",     form:"B" },
  ],
  meaning: [
    { sent:"火很热，别靠太近。",          target:"火", answer:"fire",            wrong:["ice","wind","sand"],                       anchor:true },
    { sent:"他抓住了我的手。",            target:"抓", answer:"took hold of",    wrong:["let go of","washed","pointed at"],         anchor:true },
    { sent:"墙上挂着一张图。",            target:"挂", answer:"is hanging",      wrong:["is falling","is drawn","is torn"],         form:"A" },
    { sent:"这座城很大，人也很多。",      target:"城", answer:"city",            wrong:["farm","island","forest"],                  form:"A" },
    { sent:"小狗跳过了那条河。",          target:"跳", answer:"jumped",          wrong:["swam","walked","looked"],                  form:"A" },
    { sent:"我们的队昨天输了。",          target:"输", answer:"lost",            wrong:["won","played","trained"],                  form:"A" },
    { sent:"这个杯子破了。",              target:"破", answer:"broken",          wrong:["empty","clean","heavy"],                   form:"A" },
    { sent:"这个故事传了很多年。",        target:"传", answer:"has been passed down", wrong:["was written down","was forgotten","was translated"], form:"A" },
    { sent:"花很香。",                    target:"香", answer:"smells nice",     wrong:["looks bright","feels soft","grows fast"],  form:"B" },
    { sent:"他们在城里建了一座桥。",      target:"建", answer:"built",           wrong:["crossed","painted","found"],               form:"B" },
    { sent:"爸爸在修我的自行车。",        target:"修", answer:"repairing",       wrong:["riding","selling","cleaning"],             form:"B" },
    { sent:"我已经付了钱。",              target:"付", answer:"paid",            wrong:["counted","saved","borrowed"],              form:"B" },
    { sent:"太阳升起来了。",              target:"升", answer:"rose",            wrong:["set","hid","turned"],                      form:"B" },
    { sent:"教室里有一块板。",            target:"板", answer:"a board",         wrong:["a window","a door","a light"],             form:"B" },
  ],
  passages: [
    { id:"c3p1", form:"A", zh:"从前，有一个小城，城里住着一位老人。老人家里养了一头牛和几只猪。每天早上，他先去田里做事，回来以后再喂牛。有一年冬天特别冷，别人的牛都病了，只有他的牛还很好。大家问他为什么，他说：“因为我天天都照顾它，从来没有忘记过。”",
      questions:[
        { kind:"literal",   q:"What animals does the old man keep?", answer:"A cow and some pigs", wrong:["A horse and a dog","Chickens and ducks","Only a cow"], form:"A" },
        { kind:"sequence",  q:"What does he do before feeding the cow?", answer:"He works in the field", wrong:["He goes to the market","He visits neighbours","He cleans the house"], form:"A" },
        { kind:"inference", q:"Why was his cow still healthy that cold winter?", answer:"Because he looked after it every single day", wrong:["Because his cow was younger","Because his house was warmer","Because he gave it medicine"], form:"A" },
      ] },
    { id:"c3p2", form:"both", zh:"学校后面有一间旧教室，墙上挂着很多学生画的图。上个月，几位老师和家长一起把它修好了：地板换了新的，灯也亮了起来。现在每到下午，学生都在那里画画、唱歌。校长说：“这间教室虽然旧，可是它是我们大家一起建起来的。”",
      questions:[
        { kind:"literal",   q:"What is hanging on the walls?", answer:"Pictures drawn by students", wrong:["Photographs of teachers","Maps of the city","Lists of names"], anchor:true },
        { kind:"literal",   q:"What two things were fixed?", answer:"The floor and the lights", wrong:["The roof and the door","The windows and the desks","The walls and the stairs"], form:"A" },
        { kind:"sequence",  q:"When do students use the room now?", answer:"In the afternoons", wrong:["Early in the morning","Only at weekends","During lunch"], form:"A" },
        { kind:"reference", q:"Who repaired the classroom?", answer:"Teachers and parents together", wrong:["The students alone","Workers from the city","The headteacher alone"], form:"B" },
        { kind:"inference", q:"Why does the headteacher value the old room?", answer:"Because everyone built it together", wrong:["Because it is the largest room","Because it is the oldest building","Because it cost very little"], form:"B" },
      ] },
    { id:"c3p3", form:"B", zh:"小云很喜欢演话剧。上个星期六，学校里有一场表演，她要演一条龙。可是那天早上，她的衣服破了一个大口子。妈妈马上帮她修好，还配上一块金色的布。表演的时候，大家都说那条龙最好看。小云心里又高兴又有点不好意思。",
      questions:[
        { kind:"literal",   q:"What part is Xiao Yun playing?", answer:"A dragon", wrong:["A cow","A doctor","A tree"], form:"B" },
        { kind:"sequence",  q:"What happens right after her costume tears?", answer:"Her mother mends it", wrong:["She wears a different one","The show is cancelled","She asks a teacher"], form:"B" },
        { kind:"inference", q:"Why does she feel a little embarrassed as well as happy?", answer:"Because everyone was praising her", wrong:["Because she forgot her lines", "Because the costume still looked torn","Because she arrived late"], form:"B" },
      ] },
  ],
  writing: [
    { zh:"牛", py:"niú",   en:"cow",     anchor:true },
    { zh:"火", py:"huǒ",   en:"fire",    form:"A" },
    { zh:"刀", py:"dāo",   en:"knife",   form:"A" },
    { zh:"金", py:"jīn",   en:"gold",    form:"A" },
    { zh:"图", py:"tú",    en:"picture", form:"B" },
    { zh:"皮", py:"pí",    en:"skin",    form:"B" },
    { zh:"城", py:"chéng", en:"city",    form:"B" },
  ],
};

// ── C4 ──────────────────────────────────────────────────────────────────────
const C4 = {
  passageRange: [120, 180],
  recognition: [
    { zh:"梦", py:"mèng",  en:"dream",    anchor:true },
    { zh:"冰", py:"bīng",  en:"ice",      anchor:true },
    { zh:"牌", py:"pái",   en:"sign",     form:"A" },
    { zh:"箱", py:"xiāng", en:"box",      form:"A" },
    { zh:"牙", py:"yá",    en:"tooth",    form:"A" },
    { zh:"兵", py:"bīng",  en:"soldier",  form:"A" },
    { zh:"货", py:"huò",   en:"goods",    form:"A" },
    { zh:"季", py:"jì",    en:"season",   form:"A" },
    { zh:"盘", py:"pán",   en:"plate",    form:"B" },
    { zh:"顶", py:"dǐng",  en:"top",      form:"B" },
    { zh:"户", py:"hù",    en:"household",form:"B" },
    { zh:"苦", py:"kǔ",    en:"bitter",   form:"B" },
    { zh:"梯", py:"tī",    en:"ladder",   form:"B" },
    { zh:"岸", py:"àn",    en:"shore",    form:"B" },
  ],
  decoding: [
    { zh:"抱", py:"bào",   en:"to hug",       anchor:true },
    { zh:"醒", py:"xǐng",  en:"to wake up",   anchor:true },
    { zh:"冲", py:"chōng", en:"to rush",      form:"A" },
    { zh:"翻", py:"fān",   en:"to turn over", form:"A" },
    { zh:"烧", py:"shāo",  en:"to burn",      form:"A" },
    { zh:"抽", py:"chōu",  en:"to draw out",  form:"A" },
    { zh:"戴", py:"dài",   en:"to wear",      form:"A" },
    { zh:"摆", py:"bǎi",   en:"to arrange",   form:"A" },
    { zh:"躺", py:"tǎng",  en:"to lie down",  form:"B" },
    { zh:"擦", py:"cā",    en:"to wipe",      form:"B" },
    { zh:"贴", py:"tiē",   en:"to stick on",  form:"B" },
    { zh:"脱", py:"tuō",   en:"to take off",  form:"B" },
    { zh:"挑", py:"tiāo",  en:"to pick out",  form:"B" },
    { zh:"吸", py:"xī",    en:"to breathe in",form:"B" },
  ],
  meaning: [
    { sent:"昨天晚上我做了一个梦。",          target:"梦", answer:"a dream",       wrong:["a mistake","a promise","a plan"],            anchor:true },
    { sent:"他抱着一只小猫走进来。",          target:"抱", answer:"holding",       wrong:["chasing","feeding","drawing"],               anchor:true },
    { sent:"水太冷，都结成冰了。",            target:"冰", answer:"ice",           wrong:["steam","mud","salt"],                        form:"A" },
    { sent:"门口挂着一块牌子。",              target:"牌", answer:"a sign",        wrong:["a mirror","a curtain","a basket"],           form:"A" },
    { sent:"这个箱子太重了，我搬不动。",      target:"箱", answer:"box",           wrong:["chair","ladder","door"],                     form:"A" },
    { sent:"他每天早上七点就醒了。",          target:"醒", answer:"wakes up",      wrong:["gets dressed","leaves home","eats"],         form:"A" },
    { sent:"请把桌子擦一擦。",                target:"擦", answer:"wipe",          wrong:["move","measure","paint"],                    form:"A" },
    { sent:"这种药有点苦。",                  target:"苦", answer:"bitter",        wrong:["sweet","warm","expensive"],                  form:"A" },
    { sent:"她戴上帽子出门了。",              target:"戴", answer:"put on",        wrong:["took off","folded","lost"],                  form:"B" },
    { sent:"孩子们躺在草地上看星星。",        target:"躺", answer:"lying",         wrong:["running","sitting up","standing"],           form:"B" },
    { sent:"他把照片贴在墙上。",              target:"贴", answer:"stuck",         wrong:["threw","hid","tore"],                        form:"B" },
    { sent:"回家以后先把鞋脱了。",            target:"脱", answer:"take off",      wrong:["put on","clean","tie"],                      form:"B" },
    { sent:"请你挑一个你喜欢的。",            target:"挑", answer:"pick out",      wrong:["put back","share","count"],                  form:"B" },
    { sent:"山顶上有很多雪。",                target:"顶", answer:"the top",       wrong:["the bottom","the side","the path"],          form:"B" },
  ],
  passages: [
    { id:"c4p1", form:"A", zh:"李阿姨在城边开了一家小店，门口挂着一块旧牌子。店里卖的东西不多，可是每样都摆得很整齐。冬天的早上特别冷，路上结了冰，来买东西的人也少了。有一天，一个孩子在店门口摔倒了。李阿姨马上跑出去把他抱起来，还给他倒了一杯热水。从那以后，附近的人都愿意到她的店里来。他们说，这里卖的不只是货，还有一份心意。",
      questions:[
        { kind:"literal",   q:"What is hanging at the shop door?", answer:"An old sign", wrong:["A red lantern","A paper picture","A small bell"], form:"A" },
        { kind:"sequence",  q:"What does Auntie Li do first when the child falls?", answer:"She runs out and picks him up", wrong:["She calls his parents","She pours hot water","She closes the shop"], form:"A" },
        { kind:"inference", q:"Why do neighbours start coming to her shop?", answer:"Because of the kindness she showed, not the goods", wrong:["Because her prices dropped","Because the other shops closed","Because she sells more things now"], form:"A" },
      ] },
    { id:"c4p2", form:"both", zh:"张爷爷年轻的时候当过兵，那些年他很少回家。后来他回到村里，每天早上都到河岸边走一走，然后回家擦桌子、摆好碗筷，等孙女来吃饭。孙女问他：“您当兵的时候苦不苦？”他想了很久才说：“苦的时候当然有，可是我一想到家里的人，就不觉得苦了。”孙女听了没有说话，只是把碗轻轻放下。那天晚上，她做了一个梦，梦见爷爷年轻时的样子。",
      questions:[
        { kind:"literal",   q:"What was Grandpa Zhang when he was young?", answer:"A soldier", wrong:["A teacher","A doctor","A shopkeeper"], anchor:true },
        { kind:"sequence",  q:"What does he do after his morning walk?", answer:"He wipes the table and lays out the bowls", wrong:["He reads the newspaper","He goes back to sleep","He visits a neighbour"], form:"A" },
        { kind:"reference", q:"Who asks him whether those years were hard?", answer:"His granddaughter", wrong:["His son","A neighbour","An old friend"], form:"A" },
        { kind:"reference", q:"What does the granddaughter dream about that night?", answer:"Grandpa as a young man", wrong:["The river bank","Her own future","A family meal"], form:"B" },
        { kind:"inference", q:"What made the hard years bearable for him?", answer:"Thinking about his family", wrong:["The friends he served with","Knowing it would end soon","The pay he received"], form:"B" },
      ] },
    { id:"c4p3", form:"B", zh:"上个季度，我们班要做一个关于水的报告。老师把同学分成四组，每组挑一个题目。我们这组选了冰。刚开始，大家觉得这个题目很简单，可是查了资料以后才发现，问题比想象的多得多。有的同学去图书馆翻书，有的在家里做实验：把水放进箱子里，看它多久才会结冰。最后我们把结果贴在一张大纸上，还画了图。报告那天，老师说我们这组做得最认真。",
      questions:[
        { kind:"literal",   q:"What topic did this group choose?", answer:"Ice", wrong:["Rain","Rivers","Steam"], form:"B" },
        { kind:"sequence",  q:"What did they discover after looking things up?", answer:"There were far more questions than they expected", wrong:["The topic was too easy","Another group had the same topic","They had run out of time"], form:"B" },
        { kind:"inference", q:"Why did the teacher praise this group?", answer:"Because they worked thoroughly, using both books and experiments", wrong:["Because they finished first","Because their poster was the largest","Because they chose the hardest topic"], form:"B" },
      ] },
  ],
  writing: [
    { zh:"冰", py:"bīng", en:"ice",     anchor:true },
    { zh:"牙", py:"yá",   en:"tooth",   form:"A" },
    { zh:"苦", py:"kǔ",   en:"bitter",  form:"A" },
    { zh:"梦", py:"mèng", en:"dream",   form:"A" },
    { zh:"户", py:"hù",   en:"household",form:"B" },
    { zh:"兵", py:"bīng", en:"soldier", form:"B" },
    { zh:"盘", py:"pán",  en:"plate",   form:"B" },
  ],
};

module.exports = { C1, C2, C3, C4 };
