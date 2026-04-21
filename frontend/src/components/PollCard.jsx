import React, { useState } from 'react';
import { Trash2, Flame, Sparkles } from 'lucide-react';

const PollCard = ({ poll, onVote, onDelete }) => {
  const [voted, setVoted] = useState(() => {
    const hasVoted = localStorage.getItem(`voted_${poll.id}`);
    return hasVoted === 'true';
  });

  const handleVoteAction = (optionId) => {
    localStorage.setItem(`voted_${poll.id}`, 'true');
    setVoted(true);
    onVote(poll.id, optionId);
  };

  const totalVotesCount = poll.total_votes ?? poll.totalVotes ?? 0;

  const renderBadges = () => {
    const badges = [];
    const pollDate = new Date(poll.createdAt);
    const now = new Date();
    const hoursOld = Math.abs(now - pollDate) / 36e5;

    if (hoursOld < 24) {
      badges.push(
        <div key="new" className="flex items-center gap-1 bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-amber-100">
          <Sparkles size={10} /> New
        </div>
      );
    }

    if (totalVotesCount >= 5) {
      badges.push(
        <div key="trending" className="flex items-center gap-1 bg-orange-50 text-orange-600 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-orange-100">
          <Flame size={10} /> Trending
        </div>
      );
    }
    return badges;
  };

  const calculatePercent = (votes) => {
    if (totalVotesCount === 0) return 0;
    return ((votes / totalVotesCount) * 100).toFixed(1);
  };

  return (
    /* ADDED: animate-in fade-in zoom-in-95 to make the card "pop" when it appears */
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)] flex flex-col h-full hover:shadow-md transition-all duration-500 animate-in fade-in zoom-in-95 slide-in-from-bottom-4">
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
            {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : 'Active Poll'}
          </span>
          {renderBadges()}
        </div>
        
        <button 
          onClick={() => onDelete(poll.id)}
          className="text-slate-300 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-6 leading-tight">
        {poll.question}
      </h3>

      <div className="space-y-3 flex-grow">
        {poll.options.map((opt) => (
          <div key={opt.id}>
            {voted ? (
              /* --- RESULTS VIEW (With Smooth Bar Animation) --- */
              <div className="animate-in fade-in slide-in-from-left-2 duration-700">
                <div className="flex justify-between items-end mb-1.5 px-1">
                  <span className="text-sm font-semibold text-slate-700">{opt.text}</span>
                  <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md">
                    {calculatePercent(opt.votes)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  {/* The duration-1000 and ease-out creates the "growing" bar effect */}
                  <div 
                    className="bg-cyan-600 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${calculatePercent(opt.votes)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 px-1 text-right">{opt.votes} votes</p>
              </div>
            ) : (
              /* --- VOTING VIEW --- */
              <button
                onClick={() => handleVoteAction(opt.id)}
                className="w-full flex justify-between items-center px-4 py-3.5 rounded-2xl border-2 border-slate-50 bg-slate-50 text-slate-700 font-semibold hover:border-cyan-500 hover:bg-white hover:text-cyan-700 hover:shadow-sm transition-all duration-200 active:scale-[0.95] group"
              >
                <span>{opt.text}</span>
                <span className="text-[10px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-600 text-white px-2 py-1 rounded-md">
                  Vote
                </span>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-5 border-t border-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${voted ? 'bg-cyan-500' : 'bg-emerald-500 animate-pulse'}`}></div>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             {voted ? 'Results Live' : 'Accepting Votes'}
           </span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-lg">
          <span className="text-[10px] font-medium opacity-70 uppercase tracking-tighter">Total</span>
          <span className="text-sm font-black">{totalVotesCount}</span>
        </div>
      </div>
    </div>
  );
};

export default PollCard;