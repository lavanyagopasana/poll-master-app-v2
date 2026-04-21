import { useEffect, useState, useCallback, useRef } from 'react'
import { getPolls, createPoll, voteOnPoll, deletePoll } from './api'
import PollCard from './components/PollCard'
import { Plus, List, BarChart3, X } from 'lucide-react'

function App() {
  const [polls, setPolls] = useState([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [errors, setErrors] = useState({});
  const lastOptionRef = useRef(null);
  const QUESTION_LIMIT = 100;

  const fetchPolls = useCallback(async () => {
    try {
      const response = await getPolls();
      setPolls(response.data);
    } catch (error) {
      console.error("Error fetching polls:", error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await getPolls();
        if (isMounted) {
          setPolls(response.data);
        }
      } catch (error) {
        console.error("Error fetching polls:", error);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [fetchPolls]);

  useEffect(() => {
    if (options.length > 2 && lastOptionRef.current) {
      lastOptionRef.current.focus();
    }
  }, [options.length]);

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
      setErrors((prev) => ({ ...prev, options: null }));
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    if (errors.options) setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasEmptyOption = options.some(opt => opt.trim() === "");
    if (hasEmptyOption) {
      setErrors({ options: "All options must be filled out" });
      return;
    }
    if (question.length > QUESTION_LIMIT) return;
    try {
      await createPoll({ question, options });
      setQuestion('');
      setOptions(['', '']);
      setErrors({});
      fetchPolls();
      document.getElementById('polls-list')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error("Error creating poll", err);
    }
  };

  const handleVote = async (pollId, optionId) => {
    try {
      await voteOnPoll(pollId, optionId);
      fetchPolls();
    } catch (err) {
      console.error("Error casting vote", err);
    }
  };

  const handleDelete = async (pollId) => {
    if (window.confirm("Are you sure you want to delete this poll?")) {
      try {
        await deletePoll(pollId);
        localStorage.removeItem(`voted_${pollId}`);
        fetchPolls();
      } catch (err) {
        console.error("Error deleting poll", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans relative overflow-x-hidden">
      {/* Background UI Illustrations - Fixed and Layered Below Content */}
      <div className="fixed inset-0 pointer-events-none opacity-40 md:opacity-100 z-0">
        {/* Top-Right Green Chart */}
        <div className="absolute top-40 right-20 bg-[#D4F5A6] p-4 rounded-3xl w-[260px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-[#CDEB9D]">
          <div className="w-10 h-10 bg-white rounded-xl mb-4" />
          <div className="w-full h-3 bg-white/60 rounded-full mb-2" />
          <div className="w-2/3 h-3 bg-white/60 rounded-full" />
        </div>
        
        {/* Mid-Left Pink Chart */}
        <div className="absolute top-[48%] left-16 bg-[#FFDAE9] p-4 rounded-3xl w-[200px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-[#F5C7D9]">
          <div className="w-full h-3 bg-white/60 rounded-full mb-2" />
          <div className="w-4/5 h-3 bg-white/60 rounded-full mb-2" />
          <div className="w-3/5 h-3 bg-white/60 rounded-full" />
        </div>

        {/* Small UI Dots (Subtle scattered details) */}
        <div className="absolute top-52 right-[450px] w-2.5 h-2.5 bg-slate-300 rounded-full" />
        <div className="absolute top-96 right-[380px] w-3 h-3 border-2 border-slate-300 rotate-12" />
        <div className="absolute bottom-60 left-[350px] w-3 h-3 bg-cyan-200" />
      </div>

      {/* 1. Navigation Bar */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-[#0E7490] p-1.5 rounded-lg shadow-lg shadow-cyan-900/10 relative z-10">
            <BarChart3 className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">Poll Master</span>
        </div>
        
        <div className="flex items-center gap-6">
          <a href="#polls-list" className="text-slate-600 font-medium hover:text-cyan-700 transition-colors hidden sm:block">View Polls</a>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white border border-slate-200 px-5 py-2 rounded-full hover:bg-slate-50 transition-all shadow-sm font-bold text-slate-700 flex items-center gap-2 text-sm"
          >
            <Plus size={18} />
            New Poll
          </button>
        </div>
      </nav>

      {/* Main content layer must have a positive z-index to stay above background details */}
      <main className="max-w-5xl mx-auto px-4 py-16 relative z-10">
        <div className="flex flex-col items-center">
          
          {/* Create Poll Card - Redesigned to be clean and simple */}
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_25px_60px_rgba(14,116,144,0.05)] border border-slate-100/70 p-12">
            <h2 className="text-3xl font-bold text-center text-slate-800 mb-8">Create a New Poll</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2 px-1">
                  <label className="text-sm font-bold text-slate-700">Enter Question</label>
                  <span className={`text-[10px] font-mono ${question.length > QUESTION_LIMIT ? 'text-red-500 font-bold animate-pulse' : 'text-slate-400'}`}>
                    {question.length}/{QUESTION_LIMIT}
                  </span>
                </div>
                <input 
                  type="text" 
                  placeholder="What is your favorite cuisine?..." 
                  value={question} 
                  onChange={(e) => setQuestion(e.target.value)}
                  required
                  className={`w-full px-6 py-4 rounded-xl bg-slate-50 border transition-all focus:outline-none ${
                    question.length > QUESTION_LIMIT 
                    ? 'border-red-500 ring-4 ring-red-500/10' 
                    : 'border-slate-200 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10'
                  }`}
                />
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Options (Min: 2, Max: 4)</label>
                {options.map((opt, index) => (
                  <div key={index} className="flex gap-3 group items-center">
                    <input 
                      type="text" 
                      placeholder={`Option ${index + 1}`} 
                      value={opt}
                      ref={index === options.length - 1 ? lastOptionRef : null}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      required
                      className={`flex-1 px-6 py-4 rounded-xl bg-slate-50 border transition-all focus:outline-none ${
                        errors.options && opt.trim() === ""
                        ? 'border-red-400 bg-red-50/30 ring-4 ring-red-500/5'
                        : 'border-slate-200 focus:border-cyan-600'
                      }`}
                    />
                    {options.length > 2 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveOption(index)} 
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Remove option"
                      >
                        <X size={18} strokeWidth={2.5}/>
                      </button>
                    )}
                  </div>
                ))}
                {errors.options && (
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-tighter px-1 animate-pulse">
                    {errors.options}
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={handleAddOption} 
                  disabled={options.length >= 4}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition-all disabled:opacity-40 shadow-sm"
                >
                  <Plus size={20} /> Add Option
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 rounded-xl bg-[#0E7490] text-white font-bold hover:bg-cyan-800 transition-all shadow-lg shadow-cyan-900/15 active:scale-95"
                >
                  Create Poll
                </button>
              </div>
            </form>
          </div>

          <p className="mt-14 text-slate-400 text-center max-w-sm leading-relaxed font-medium">
            Quickly create interactive polls, gather opinions, and share with your audience instantly.
          </p>
        </div>

        {/* 3. Results Section */}
        <div id="polls-list" className="mt-36">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-cyan-100 p-2.5 rounded-xl">
              <List className="text-cyan-700" size={24} />
            </div>
            <h2 className="text-3xl font-bold text-slate-800">Active Polls</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {polls.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-28 px-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
                <div className="relative mb-8">
                  <div className="absolute -inset-6 bg-cyan-50 rounded-full animate-pulse"></div>
                  <div className="relative bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                    <BarChart3 className="text-cyan-600 w-14 h-14" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-800 mb-2">No active polls</h3>
                <p className="text-slate-500 max-w-xs mb-10 leading-relaxed font-medium">
                  Your polls will appear here. Be the first to start a conversation!
                </p>

                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="bg-[#0E7490] text-white font-bold px-10 py-4 rounded-full hover:bg-cyan-800 transition-all shadow-lg shadow-cyan-900/20 active:scale-95 flex items-center gap-2"
                >
                  <Plus size={18} />
                  Start Creating Now
                </button>
              </div>
            ) : (
              polls.map(poll => (
                <PollCard 
                  key={`${poll.id}-${poll.total_votes}`} 
                  poll={poll} 
                  onVote={handleVote} 
                  onDelete={handleDelete} 
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;