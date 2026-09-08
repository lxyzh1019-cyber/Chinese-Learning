const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const stories=require(path.join(ROOT,'data','stories','hsk1.json')).stories;
const DYN=readDynasties();
// Each lesson is built FROM its gate's own story: the passage is that story's
// opening, the key words are words the child will actually meet in it, and the
// questions are answerable from the passage. Before this, 22 of the HSK1
// lessons carried the gate's vocabulary list wrapped in instructions and asked
// "本关有几个生字？" — a question about the lesson, not about any text.
/** The 22 dynasties, read out of index.html where they still live inline. */
function readDynasties(){
  const vm=require('vm');
  const h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const i=h.indexOf('const DYNASTIES=');
  const j=h.indexOf('\n];',i)+3;
  const ctx={};vm.createContext(ctx);
  vm.runInContext(h.slice(i,j)+';globalThis.__d=DYNASTIES;',ctx);
  return ctx.__d.map(d=>({id:d.id,zh:d.zh,en:d.en,story:d.story,story2:d.story2}));
}

let n=0;
for(const d of DYN){
  const st=stories[d.story+'-h1'];
  if(!st) { console.error('no story for gate',d.id); continue; }
  const line=(i)=>st.sents[i].map(t=>t.t==='p'?t.tx:(t.ch||t.tx)).join('');
  const passage=[0,1,2,3].map(line).join('');
  const passageEn=[0,1,2,3].map(i=>st.trans[i]).join(' ');

  // Key words: CONTENT words from the passage, with the readings and glosses
  // the story itself uses. Taking simply the first tokens produced a card set
  // of 很 / 的 / 是 — grammar the child absorbs from reading and cannot usefully
  // study as flashcards — and a gloss of "DE" for 的, which teaches nothing.
  const FUNCTION_WORDS = new Set([..."的了是在也就都和很不有个们这那我你他她它把被会能要还又才只对从与之而或即乃则于以为所因",
    "一个","这个","那个","可以","没有","什么","一些"]);
  const seen=new Set(); const key=[];
  // Labelled, because a bare `break` only left the inner loop and every lesson
  // ran two or three words past the cap.
  outer:
  for(const i of [0,1,2,3]) for(const t of st.sents[i]){
    if(t.t!=='c'||t.bonus) continue;
    if(seen.has(t.ch)) continue;
    seen.add(t.ch);
    if(FUNCTION_WORDS.has(t.ch)) continue;
    if(!t.mn) continue;
    // A gloss that is just the pinyin shouted back (的 -> "DE") is not a gloss.
    if(/^[A-Z]{1,4}$/.test(String(t.mn).trim())) continue;
    key.push({zh:t.ch,pinyin:t.py,en:t.mn});
    if(key.length>=8) break outer;
  }

  const lesson={
    lessonId:`hsk1_gate_${String(d.id).padStart(2,'0')}`,
    level:'HSK1', gateId:d.id,
    title:`HSK1 Gate ${d.id} · ${d.en}`,
    explanationEn:`Gate ${d.id}: ${d.en}. Read the words below, then read the story out loud. The story is the same one you read on the map — this is the start of it.`,
    explanation:`第${d.id}关：${d.zh}。先读下面的词，再大声读短文。这段短文就是地图上那个故事的开头。`,
    passage, passageEn,
    keyVocab:key,
    // Questions a child can answer FROM the passage, each pointing at a
    // sentence that is actually there. The generic pair this replaces asked
    // "what happens next?" and answered with the third sentence, so the
    // question and its answer did not match.
    comprehension:[
      {questionEn:`Read the first sentence again. What does it tell you?`,
       question:`再读第一句。它说了什么？`,
       answerEn:st.trans[0], answer:line(0)},
      {questionEn:`Read the third sentence again. Who or what is it about?`,
       question:`再读第三句。它说的是谁，或者是什么？`,
       answerEn:st.trans[2], answer:line(2)},
      {questionEn:`Read the whole passage out loud, then say one sentence from memory.`,
       question:`大声读一遍短文，再试着背出其中的一句。`,
       answerEn:`Any one sentence from the passage above.`, answer:`上面短文里的任何一句。`},
    ],
    speakingPromptEn:`Tell a grown-up about ${d.en} in two or three short Chinese sentences. Use words from the list above.`,
    speakingPrompt:`用上面的词，跟家里的大人说两三句中文，说一说${d.zh}。`,
  };
  fs.writeFileSync(path.join(ROOT,'data','lessons',`hsk1_gate_${String(d.id).padStart(2,'0')}.json`),
    JSON.stringify(lesson,null,2)+'\n');
  n++;
}
console.log('rewrote',n,'HSK1 lessons from their own gate stories');
