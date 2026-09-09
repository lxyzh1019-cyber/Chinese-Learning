const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
// Which level to build. HSK1 and HSK2 have their own texts; a level without
// one has nothing to draw a lesson from, and its lessons stay on the old
// template until its stories are written.
const LEVEL=Number(process.argv[2]||1);
const storyFile=path.join(ROOT,'data','stories',`hsk${LEVEL}.json`);
if(!fs.existsSync(storyFile)){
  console.error(`HSK${LEVEL} has no stories yet — write them before its lessons.`);
  process.exit(1);
}
const stories=require(storyFile).stories;
const {sharesSense}=require('./senses.js');
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

/**
 * Questions a machine can actually mark.
 *
 * The three questions every lesson used to carry were the same in all 88 files
 * — "read the first sentence again and say what it says", answered with that
 * sentence — plus "recite one sentence from memory", answered "any one
 * sentence from the passage above". None of that can be checked, so there was
 * no answer to mark, no correction to give and no follow-up to schedule; the
 * child could only be asked to grade themselves. These are built from the
 * story's own glosses and translations, so the answer and the explanation are
 * true by construction rather than authored twice.
 */
const DECOYS=[];   // {zh, en, gate} from every gate's story, for distractors
for(const d of DYN){
  const st=stories[`${d.story}-h${LEVEL}`]; if(!st) continue;
  for(const i of [0,1,2,3]) for(const t of (st.sents[i]||[])){
    if(t.t!=='c'||t.bonus||!t.mn) continue;
    if(/^[A-Z]{1,4}$/.test(String(t.mn).trim())) continue;
    DECOYS.push({zh:t.ch,en:t.mn,gate:d.id});
  }
}
const SENTS=[];    // {zh, en, gate} whole sentences, for the sentence-meaning check
for(const d of DYN){
  const st=stories[`${d.story}-h${LEVEL}`]; if(!st) continue;
  for(const i of [0,1,2,3]){
    if(!st.sents[i]||!st.trans[i]) continue;
    SENTS.push({zh:st.sents[i].map(t=>t.t==='p'?t.tx:(t.ch||t.tx)).join(''),en:st.trans[i],gate:d.id});
  }
}
/** Deterministic order, so a rebuild reproduces the file token for token. */
function pickWrong(cands,answerEn,want,gate){
  const out=[];
  for(const c of cands){
    if(c.gate===gate) continue;                       // same passage: answerable by elimination
    if(sharesSense(c.en,answerEn)) continue;          // §9.6
    if(out.some(o=>o.en===c.en||sharesSense(o.en,c.en))) continue;
    out.push(c);
    if(out.length===want) break;
  }
  return out;
}

function buildCheck(d,st,key,passage){
  const out=[];
  const id=(k)=>`hsk${LEVEL}_gate_${String(d.id).padStart(2,'0')}_${k}`;
  const opt=(t,i)=>({id:`o${i+1}`,text:t});

  // 1-2 word-meaning checks, on words the child meets in this very passage.
  key.filter(w=>w.en&&w.zh).slice(0,2).forEach((w,qi)=>{
    const wrong=pickWrong(DECOYS,w.en,3,d.id);
    if(wrong.length<3) return;
    const texts=[w.en,...wrong.map(x=>x.en)];
    out.push({
      id:id(`w${qi+1}`), kind:'wordMeaning', skill:'meaning',
      zh:w.zh, pinyin:w.pinyin,
      promptEn:`In the story, what does ${w.zh} mean?`,
      prompt:`短文里的“${w.zh}”是什么意思？`,
      options:texts.map(opt), answerId:'o1',
      explanationEn:`${w.zh} (${w.pinyin}) means "${w.en}" — you can find it in the passage above.`,
      explanation:`“${w.zh}”（${w.pinyin}）的意思是“${w.en}”，就在上面的短文里。`,
    });
  });

  // One sentence-meaning check, drawn from this gate's own passage.
  const mine=SENTS.filter(x=>x.gate===d.id&&passage.indexOf(x.zh)!==-1)[0];
  if(mine){
    const wrong=pickWrong(SENTS,mine.en,3,d.id);
    // The evidence this question produces has to be about a WORD, because that
    // is the only thing Review today can ask about later: reviewWordMeta looks
    // a target up in the library, the vocab tables and the story index, and a
    // whole sentence resolves in none of them. Keyed by the sentence, a miss
    // here became a review the app could never serve and never clear.
    const target=key.filter(w=>w.zh&&w.en&&mine.zh.indexOf(w.zh)!==-1)[0];
    if(wrong.length>=3&&target){
      out.push({
        id:id('s1'), kind:'sentenceMeaning', skill:'contextComprehension',
        zh:mine.zh, targetZh:target.zh, targetPinyin:target.pinyin,
        promptEn:'What does this sentence say?',
        prompt:'这句话说了什么？',
        options:[mine.en,...wrong.map(x=>x.en)].map(opt), answerId:'o1',
        explanationEn:`"${mine.zh}" means "${mine.en}".`,
        explanation:`“${mine.zh}”的意思是“${mine.en}”。`,
      });
    }
  }
  // Options are authored answer-first; shuffle deterministically by gate so a
  // rebuild is reproducible and the answer is not always the first button.
  return out.map((q,qi)=>{
    const k=(d.id+qi)%q.options.length;
    const rot=q.options.slice(k).concat(q.options.slice(0,k));
    return Object.assign({},q,{options:rot.map((o,i)=>({id:`o${i+1}`,text:o.text})),
      answerId:`o${rot.findIndex(o=>o.id===q.answerId)+1}`});
  });
}

let n=0;
for(const d of DYN){
  const st=stories[`${d.story}-h${LEVEL}`];
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
    lessonId:`hsk${LEVEL}_gate_${String(d.id).padStart(2,'0')}`,
    level:`HSK${LEVEL}`, gateId:d.id,
    title:`HSK${LEVEL} Gate ${d.id} · ${d.en}`,
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
    check:buildCheck(d,st,key,passage),
    speakingPromptEn:`Tell a grown-up about ${d.en} in two or three short Chinese sentences. Use words from the list above.`,
    speakingPrompt:`用上面的词，跟家里的大人说两三句中文，说一说${d.zh}。`,
  };
  fs.writeFileSync(path.join(ROOT,'data','lessons',`hsk${LEVEL}_gate_${String(d.id).padStart(2,'0')}.json`),
    JSON.stringify(lesson,null,2)+'\n');
  n++;
}
console.log('rewrote',n,`HSK${LEVEL} lessons from their own gate stories`);
