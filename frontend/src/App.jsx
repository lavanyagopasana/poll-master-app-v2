import { useEffect, useState, useRef } from 'react'
import { getPolls, createPoll, voteOnPoll, deletePoll, getVoteStatus } from './api'
import PollCard from './components/PollCard'
import { Plus, List, BarChart3, X, Loader2 } from 'lucide-react'

// Development-only logging utility
const isDev = import.meta.env.DEV;
const log = {
  info: (...args) => isDev && console.log(...args),
  error: (...args) => isDev && console.error(...args)
};

function App() {
  const [polls, setPolls] = useState([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [votedPolls, setVotedPolls] = useState([]);
  const lastOptionRef = useRef(null);
  const QUESTION_LIMIT = 100;
  
  // Cache refs to prevent unnecessary API calls
  const pollsCacheRef = useRef(null);
  const voteStatusCacheRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Load vote status for current user (with caching)
  const loadVoteStatus = async (force = false) => {
    const now = Date.now();
    
    // Check cache first
    if (!force && voteStatusCacheRef.current && (now - lastFetchTimeRef.current) < CACHE_DURATION) {
      log.info("Using cached vote status");
      setVotedPolls(voteStatusCacheRef.current);
      return;
    }
    
    try {
      const response = await getVoteStatus();
      const votedPollIds = response.data?.voted_polls || [];
      
      // Update cache
      voteStatusCacheRef.current = votedPollIds;
      lastFetchTimeRef.current = now;
      
      setVotedPolls(votedPollIds);
      log.info(`Loaded vote status: ${votedPollIds.length} voted polls`);
    } catch (err) {
      log.error("Error fetching vote status:", err);
      // Don't set error for vote status, just continue without it
    }
  };

  // Load polls with caching
  const loadPolls = async (force = false) => {
    const now = Date.now();
    
    // Check cache first (unless forced)
    if (!force && pollsCacheRef.current && (now - lastFetchTimeRef.current) < CACHE_DURATION) {
      log.info("Using cached polls");
      setPolls(pollsCacheRef.current);
      await loadVoteStatus(); // Use cached vote status
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const [pollsResponse] = await Promise.all([
        getPolls(),
        loadVoteStatus(force) // Force refresh only when polls are forced
      ]);
      
      // Handle new standardized API response format
      const pollsData = pollsResponse.data?.polls || pollsResponse.data || [];
      
      // Update cache
      pollsCacheRef.current = pollsData;
      lastFetchTimeRef.current = now;
      
      setPolls(pollsData);
      log.info(`Loaded ${pollsData.length} polls`);
    } catch (err) {
      log.error("Error fetching polls:", err);
      setError("Failed to load polls. Please check if backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fixed: Wrap loadPolls in an async function to avoid setState warning
  useEffect(() => {
    let isMounted = true;
    
    const initLoad = async () => {
      if (isMounted) {
        await loadPolls();
      }
    };
    
    initLoad();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, '']);
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
  };

  // Focus utility
  useEffect(() => {
    if (options.length > 2 && lastOptionRef.current) {
      lastOptionRef.current.focus();
    }
  }, [options.length]);

  const handleVote = async (pollId, optionId) => {
    try {
      // Optimistic update: update UI immediately
      setPolls(prevPolls => prevPolls.map(poll => {
        if (poll.id === pollId) {
          return {
            ...poll,
            total_votes: (poll.total_votes || 0) + 1,
            options: poll.options.map(opt => 
              opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
            )
          };
        }
        return poll;
      }));
      
      // Add to voted polls state immediately and update cache
      setVotedPolls(prev => {
        const updated = [...new Set([...prev, pollId])];
        voteStatusCacheRef.current = updated; // Update cache
        return updated;
      });
      
      // Call API to record vote
      await voteOnPoll(pollId, optionId);
      log.info("Vote successful");
      
      // No need to refresh vote status since we updated it optimistically
      
    } catch (err) {
      log.error("Vote failed", err);
      // Revert optimistic update on failure
      await loadPolls();
      
      if (err.response?.status === 429) {
        setError("You have already voted on this poll.");
      } else {
        setError("Failed to record vote. Please try again.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }
    
    if (options.some(opt => !opt.trim())) {
      setError("Please fill in all options");
      return;
    }
    
    if (question.length > QUESTION_LIMIT) {
      setError(`Question must be less than ${QUESTION_LIMIT} characters`);
      return;
    }
    
    setError(null);
    
    try {
      // Create poll and get response
      const response = await createPoll({ question, options });
      log.info("Poll created successfully");
      
      // Optimistic update: add new poll to the list immediately
      if (response.data?.poll) {
        setPolls(prevPolls => {
          const updated = [response.data.poll, ...prevPolls];
          pollsCacheRef.current = updated; // Update cache
          return updated;
        });
      }
      
      // Reset form
      setQuestion('');
      setOptions(['', '']);
      
      // Scroll to polls section
      document.getElementById('polls-list')?.scrollIntoView({ behavior: 'smooth' });
      
      // No need to refresh vote status for new polls
      
    } catch (err) {
      log.error("Create failed", err);
      setError("Failed to create poll. Please try again.");
      // Only reload on error
      await loadPolls();
    }
  };

  const handleDelete = async (pollId) => {
    if (!window.confirm("Are you sure you want to delete this poll?")) return;
    
    // Optimistic delete
    setPolls(polls.filter(p => p.id !== pollId));
    
    try {
      await deletePoll(pollId);
      log.info("Poll deleted successfully");
    } catch (error) {
      log.error("Delete failed", error);
      setError("Failed to delete poll. Please try again.");
      await loadPolls(); // Reload to restore
    }
  };

  const refreshPolls = async () => {
    // Clear cache and force refresh
    pollsCacheRef.current = null;
    voteStatusCacheRef.current = null;
    lastFetchTimeRef.current = 0;
    await loadPolls(true); // Force refresh
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans relative overflow-x-hidden">
      
      {/* Background Illustrations */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div 
          className="absolute top-40 -right-10 p-4 rounded-3xl w-65 shadow-lg hidden lg:block"
          style={{ backgroundColor: '#D4F5A6', border: '1px solid #CDEB9D', opacity: 0.8 }}
        >
          <div className="w-10 h-10 bg-white rounded-xl mb-4" />
          <div className="w-full h-3 bg-white/60 rounded-full mb-2" />
          <div className="w-2/3 h-3 bg-white/60 rounded-full" />
        </div>

        <div 
          className="absolute bottom-40 -left-10 p-4 rounded-3xl w-55 shadow-lg hidden lg:block"
          style={{ backgroundColor: '#FFDAE9', border: '1px solid #F5C7D9', opacity: 0.8 }}
        >
          <div className="w-full h-3 bg-white/60 rounded-full mb-2" />
          <div className="w-4/5 h-3 bg-white/60 rounded-full mb-2" />
          <div className="w-3/5 h-3 bg-white/60 rounded-full" />
        </div>
      </div>

      <nav className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-white/90 backdrop-blur-md border-b border-slate-100 z-100 flex items-center justify-between px-4 md:px-10">
        <div className="flex items-center gap-2">
          <div className="bg-[#0E7490] p-1.5 rounded-lg shadow-lg">
            <BarChart3 className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-800">Poll Master</span>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-[#0E7490] text-white px-4 py-2 md:px-5 md:py-2.5 rounded-full hover:bg-cyan-800 transition-all font-bold flex items-center gap-2 text-xs md:text-sm"
          >
            <Plus size={16} />
            <span>New Poll</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 pt-24 md:pt-36 pb-16 relative z-10">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex flex-col items-center">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-[0_25px_60px_rgba(14,116,144,0.05)] border border-slate-100/70 p-6 md:p-10">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-800 mb-6">Create a New Poll</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <div className="flex justify-between items-end mb-2 px-1">
                            <label className="text-sm font-bold text-slate-700">Enter Question</label>
                            <span className={`text-[10px] font-mono ${question.length > QUESTION_LIMIT ? 'text-red-500' : 'text-slate-400'}`}>
                                {question.length}/{QUESTION_LIMIT}
                            </span>
                        </div>
                        <input 
                            type="text" 
                            placeholder="What is your favorite cuisine?..." 
                            value={question} 
                            onChange={(e) => setQuestion(e.target.value)}
                            required
                            maxLength={QUESTION_LIMIT}
                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-cyan-600 focus:outline-none"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Options (2-4)</label>
                        {options.map((opt, index) => (
                        <div key={index} className="flex gap-2 group items-center">
                            <input 
                            type="text" 
                            placeholder={`Option ${index + 1}`} 
                            value={opt}
                            ref={index === options.length - 1 ? lastOptionRef : null}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            required
                            className="flex-1 px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-cyan-600 focus:outline-none"
                            />
                            {options.length > 2 && (
                            <button type="button" onClick={() => handleRemoveOption(index)} className="text-slate-300 hover:text-red-500 p-1 transition-colors">
                                <X size={18} />
                            </button>
                            )}
                        </div>
                        ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={handleAddOption} disabled={options.length >= 4} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40 transition-all">
                          + Add Option
                        </button>
                        <button type="submit" className="flex-1 py-3.5 rounded-xl bg-[#0E7490] text-white font-bold hover:bg-cyan-800 shadow-lg transition-all">
                          Create Poll
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div id="polls-list" className="mt-24 md:mt-32 scroll-mt-24">
          <div className="flex items-center justify-between mb-8 md:mb-12">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-100 p-2 rounded-xl">
                <List className="text-cyan-700" size={20} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Active Polls</h2>
            </div>
            <button 
              onClick={refreshPolls}
              className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-cyan-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Loading amazing polls...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
              {polls.length === 0 ? (
                <div className="col-span-full py-20 px-6 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">No active polls</h3>
                  <p className="text-slate-500 mb-6">Be the first to start a conversation!</p>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="px-6 py-2 bg-[#0E7490] text-white rounded-full hover:bg-cyan-800 transition-colors"
                  >
                    Create First Poll
                  </button>
                </div>
              ) : (
                polls.map(poll => (
                  <PollCard 
                    key={`${poll.id}-${poll.total_votes}`} 
                    poll={poll} 
                    onVote={handleVote} 
                    onDelete={handleDelete} 
                    hasVoted={votedPolls.includes(poll.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;