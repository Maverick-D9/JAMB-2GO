import { useEffect, useState } from "react";

export default function CBTDrillReview() {
  const [data, setData] = useState({ questions: [], answers: {}, config: {} });
  const [filter, setFilter] = useState('all'); // all | correct | wrong

  useEffect(() => {
    const qs = JSON.parse(localStorage.getItem('drillQuestions') || '[]');
    const ans = JSON.parse(localStorage.getItem('drillAnswers') || '{}');
    const cfg = JSON.parse(localStorage.getItem('drillConfig') || '{}');
    setData({ questions: qs, answers: ans, config: cfg });
  }, []);

  const filtered = data.questions.map((q,i)=>({q,i})).filter(({q,i})=>{
    const userAns = data.answers[i];
    const correctAns = (q.correct_answer || q.correct || q.answer || '').toString().trim().toUpperCase();
    const isCorrect = userAns === correctAns;
    if(filter==='correct') return isCorrect;
    if(filter==='wrong') return!isCorrect;
    return true;
  });

  const correctCount = data.questions.filter((q,i)=>{
    const ca = (q.correct_answer || q.correct || q.answer || '').toString().trim().toUpperCase();
    return data.answers[i] === ca;
  }).length;

  return (
    <div className="min-h-screen bg-[#070B18] text-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#070B18]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[840px] mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-[11px] tracking-widest text-slate-400 font-bold uppercase">{data.config?.topic} • Review</div>
            <h1 className="font-black text-[15px]">{filtered.length} Questions • {filter.toUpperCase()}</h1>
          </div>
          <button onClick={()=> window.location.href = "/cbt-drill-result"} className="px-4 py-2 rounded-full bg-white text-black text-sm font-black">← Result</button>
        </div>
        {/* Filters */}
        <div className="max-w-[840px] mx-auto px-4 pb-3 flex gap-2">
          {[
            {id:'all', label:`All (${data.questions.length})`},
            {id:'correct', label:`✓ Correct (${correctCount})`},
            {id:'wrong', label:`✗ Wrong (${data.questions.length - correctCount})`},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-black border transition ${filter===f.id? 'bg-white text-black border-white' : 'bg-[#121A2E] border-white/10 text-slate-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[760px] mx-auto p-4 grid gap-5">
        {filtered.map(({q, i: idx}) => {
          const userAns = data.answers[idx];
          const correctAns = (q.correct_answer || q.correct || q.answer || '').toString().trim().toUpperCase();
          const isCorrect = userAns === correctAns;

          return (
            <div key={idx} className="group">
              {/* Status bar */}
              <div className={`h-1.5 rounded-t-[20px] ${isCorrect? 'bg-emerald-400' : 'bg-red-400'}`} />

              <div className={`bg-[#121A2E] border-x border-b border-white/10 rounded-b-[20px] p-5 md:p-6 -mt-[1px]`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-black ${isCorrect? 'bg-emerald-400/20 text-emerald-400' : 'bg-red-400/20 text-red-400'}`}>
                      {idx+1}
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${isCorrect? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>
                      {isCorrect? '✓ CORRECT' : `✗ WRONG • YOU: ${userAns || '—'} • ANS: ${correctAns}`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold">Q{idx+1}</span>
                </div>

                <div className="text-[17px] font-bold leading-[1.35] mb-4" dangerouslySetInnerHTML={{__html: q.question_text || q.question}} />

                <div className="grid gap-2.5">
                  {['A','B','C','D'].map(k => {
                    const val = q[`option_${k.toLowerCase()}`] || q[k] || q[`option_${k}`] || '';
                    if (!val) return null;
                    const isCorrectOpt = k === correctAns;
                    const isUserOpt = k === userAns;
                    return (
                      <div key={k} className={`relative p-3.5 rounded-xl border-2 flex gap-3 items-start text-sm
                        ${isCorrectOpt? 'bg-emerald-500/10 border-emerald-500/60 text-white' : ''}
                        ${!isCorrectOpt && isUserOpt? 'bg-red-500/10 border-red-500/50 text-white' : ''}
                        ${!isCorrectOpt &&!isUserOpt? 'bg-[#0C1224] border-white/5 text-slate-300' : ''}
                      `}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0
                          ${isCorrectOpt? 'bg-emerald-400 text-black' : isUserOpt? 'bg-red-400 text-black' : 'bg-white/10 text-slate-400'}`}>{k}</div>
                        <span className="pt-0.5">{val}</span>
                        {isCorrectOpt && <span className="ml-auto text-emerald-400 font-black">✓</span>}
                        {isUserOpt &&!isCorrectOpt && <span className="ml-auto text-red-400 font-black">✗</span>}
                      </div>
                    )
                  })}
                </div>

                {q.explanation && (
                  <div className="mt-4 p-4 bg-sky-400/[0.08] border border-sky-400/20 rounded-xl">
                    <div className="text-[11px] font-black tracking-widest text-sky-400 mb-1">💡 EXPLANATION</div>
                    <div className="text-[13px] leading-relaxed text-slate-200">{q.explanation}</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length===0 && (
          <div className="text-center py-20 text-slate-500">No questions for this filter</div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-4 pb-10">
          <button onClick={()=> window.location.href = "/cbt-drill-result"} className="py-4 rounded-2xl bg-[#121A2E] border border-white/10 font-bold">← Back to Result</button>
          <button onClick={()=> window.location.href = "/cbt-drill"} className="py-4 rounded-2xl bg-sky-400 text-black font-black">New Drill 🎯</button>
        </div>
      </div>
    </div>
  )
}