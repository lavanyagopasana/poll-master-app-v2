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
export const getPolls = async () => {
  try {
    log.info('Fetching polls from /api/polls');
    const response = await apiClient.get('/api/polls', { 
      params: { _t: Date.now() } // Force cache refresh
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
    const response = await apiClient.post(`/api/polls/${pollId}/vote`, { optionId });
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
    const response = await apiClient.get('/api/votes/status');
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