import axios from 'axios';

// Use the correct backend URL
const API_BASE_URL = 'https://poll-master-v2-api.onrender.com';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const LOCAL_VOTE_TOKEN_KEY = 'pollmaster_vote_token';

const getOrCreateVoteToken = () => {
  try {
    const existing = localStorage.getItem(LOCAL_VOTE_TOKEN_KEY);
    if (existing && typeof existing === 'string' && existing.length > 0) return existing;

    // 16 bytes => 32 hex chars (fits into backend ip_address varchar length)
    let token = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    } else {
      token = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
      token = token.slice(0, 32);
    }

    localStorage.setItem(LOCAL_VOTE_TOKEN_KEY, token);
    return token;
  } catch {
    return '';
  }
};

// Development-only logging utility
const isDev = import.meta.env.DEV;
const log = {
  info: (...args) => isDev && console.log(...args),
  error: (...args) => isDev && console.error(...args)
};

// Add request interceptor for development logging only
apiClient.interceptors.request.use(
  (config) => {
    log.info(`📤 Making ${config.method.toUpperCase()} request to: ${config.url}`);

    const voteToken = getOrCreateVoteToken();
    if (voteToken) {
      config.headers = config.headers || {};
      config.headers['X-Vote-Token'] = voteToken;
    }

    return config;
  },
  (error) => {
    log.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for development logging only
apiClient.interceptors.response.use(
  (response) => {
    log.info(`📥 Response from ${response.config.url}:`, response.status);
    return response;
  },
  (error) => {
    log.error('Response error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Polls API endpoints - NOW USING IMPROVED BACKEND ROUTES
export const getPolls = async (bypassCache = false) => {
  try {
    log.info('Fetching polls from /api/polls');
    const response = await apiClient.get('/api/polls', {
      params: bypassCache ? { _t: Date.now() } : undefined,
      headers: bypassCache ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined
    });
    log.info('Polls response:', response.data);
    return response.data; // Return the data directly
  } catch (error) {
    log.error('Failed to fetch polls:', error);
    throw error;
  }
};

export const createPoll = async (pollData) => {
  try {
    log.info('Creating poll:', pollData);
    const response = await apiClient.post('/api/polls', pollData);
    log.info('Poll created:', response.data);
    return response.data;
  } catch (error) {
    log.error('Failed to create poll:', error);
    throw error;
  }
};

export const voteOnPoll = async (pollId, optionId) => {
  try {
    log.info(`Voting on poll ${pollId} with option ${optionId}`);
    const voteToken = getOrCreateVoteToken();
    const response = await apiClient.post(`/api/polls/${pollId}/vote`, { optionId, voteToken });
    log.info('Vote recorded:', response.data);
    return response.data;
  } catch (error) {
    log.error(`Failed to vote on poll ${pollId}:`, error);
    throw error;
  }
};

export const deletePoll = async (pollId) => {
  try {
    log.info(`Deleting poll ${pollId}`);
    const response = await apiClient.delete(`/api/polls/${pollId}`);
    log.info('Poll deleted:', response.data);
    return response.data;
  } catch (error) {
    log.error(`Failed to delete poll ${pollId}:`, error);
    throw error;
  }
};

export const getVoteStatus = async () => {
  try {
    log.info('Fetching vote status');
    const voteToken = getOrCreateVoteToken();
    const response = await apiClient.get('/api/votes/status', { params: { voteToken } });
    log.info('Vote status:', response.data);
    return response.data;
  } catch (error) {
    log.error('Failed to get vote status:', error);
    throw error;
  }
};

export default {
  getPolls,
  createPoll,
  voteOnPoll,
  deletePoll,
  getVoteStatus,
};