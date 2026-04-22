import axios from 'axios';

const API_BASE_URL = 'https://poll-master-v2-api.onrender.com' // Replace with your actual Render URL';

export const getPolls = () => axios.get(`${API_BASE_URL}/polls`);
export const createPoll = (pollData) => axios.post(`${API_BASE_URL}/polls`, pollData);
export const voteOnPoll = (pollId, optionId) => axios.post(`${API_BASE_URL}/polls/${pollId}/vote`, { optionId });
export const deletePoll = (pollId) => axios.delete(`${API_BASE_URL}/polls/${pollId}`);