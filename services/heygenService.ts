import axios from 'axios';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY as string;
const HEYGEN_API_URL = process.env.HEYGEN_API_URL || 'https://api.heygen.com';

const heygenApi = axios.create({
  baseURL: HEYGEN_API_URL,
  headers: {
    'X-Api-Key': HEYGEN_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Initialize a streaming session with HeyGen
 */
export const initStreamingSession = async (avatarId: string): Promise<any> => {
  try {
    const response = await heygenApi.post('/v1/streaming.create', {
      avatar_id: avatarId,
      quality: 'medium'
    });

    return response.data;
  } catch (error: any) {
    console.error('HeyGen Session Error:', error.response?.data || error.message);
    throw new Error('Failed to initialize streaming session');
  }
};

/**
 * Get a streaming token from HeyGen
 */
export const getStreamingToken = async (): Promise<string> => {
  try {
    const response = await heygenApi.post('/v1/streaming.get_token');
    return response.data.data.token;
  } catch (error: any) {
    console.error('HeyGen Token Error:', error.response?.data || error.message);
    throw new Error('Failed to get streaming token');
  }
};

/**
 * Send text to the streaming session for lip-sync
 */
export const speak = async (sessionId: string, text: string): Promise<any> => {
  try {
    const response = await heygenApi.post('/v1/streaming.task', {
      session_id: sessionId,
      text: text,
      task_type: 'repeat'
    });

    return response.data;
  } catch (error: any) {
    console.error('HeyGen Speak Error:', error.response?.data || error.message);
    throw new Error('Failed to send speak task');
  }
};
