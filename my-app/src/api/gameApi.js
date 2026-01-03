import axios from "axios";

// const BASE_URL = "https://backaicharades-q7oy.onrender.com"
const BASE_URL = "http://localhost:8000";

// GET random word
export const getRandomWord = async (category = null) => {
  const response = await axios.get(BASE_URL + "/get_word", {
    params: { category },
  });
  return response.data; // { word, choices }
};

// POST image, word, choices
export const sendFrameToBackend = async (imageBlob, word, choices) => {
  const formData = new FormData();
  formData.append("file", imageBlob, "capture.jpg");
  formData.append("word", word);
  formData.append("choices", choices.join(","));

  const response = await axios.post(BASE_URL + "/guess", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data; // { guess, result, response }
};

// POST score to leaderboard
export const submitScore = async (username, score) => {
  try {
    const response = await axios.post(BASE_URL + "/leaderboard", {
      username,
      score,
    });
    return response.data;
  } catch (error) {
    console.error("Error submitting score:", error);
    throw error;
  }
};

// GET leaderboard data
export const getLeaderboard = async () => {
  try {
    const response = await axios.get(BASE_URL + "/leaderboard");
    return response.data; // Array of { username, score } objects
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }
};

// Session management
export const startSession = async () => {
  const response = await axios.post(BASE_URL + "/start_session");
  return response.data; // { session_id, expires_at }
};

export const endSession = async (sessionId) => {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  const response = await axios.post(BASE_URL + "/end_session", formData);
  return response.data;
};

export const checkSession = async () => {
  const response = await axios.get(BASE_URL + "/check_session");
  return response.data; // { active: true/false }
};

export const heartbeat = async (sessionId) => {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  const response = await axios.post(BASE_URL + "/heartbeat", formData);
  return response.data;
};
