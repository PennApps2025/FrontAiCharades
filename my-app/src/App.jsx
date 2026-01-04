import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// Import background music
import bgMusic from "../resources/background-music.mp3";

import StartScreen from "./components/StartScreen";
import GameScreen from "./components/GameScreen";
import EndScreen from "./components/EndScreen";
import RoundIntro from "./components/RoundIntro";
import Leaderboard from "./components/Leaderboard";

import { getRandomWord, sendFrameToBackend, submitScore } from "./api/gameApi";

// Define the game duration in seconds.
const GAME_DURATION = 45; // seconds for the whole match

function App() {
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'end'
  const [currentWord, setCurrentWord] = useState("");
  const [choices, setChoices] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(new Audio(bgMusic));

  // store full backend response: { guess, result, response }
  const [aiResponse, setAiResponse] = useState(null);
  const [aiResponseKey, setAiResponseKey] = useState(0);
  const [resultConfirmed, setResultConfirmed] = useState(null); // 'success', 'fail', null
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [resultMessage, setResultMessage] = useState(null);
  const [gameStartKey, setGameStartKey] = useState(0); // increment to reset timer / start new game
  const [displayedGuess, setDisplayedGuess] = useState("");
  const overlayTimeoutRef = useRef(null);
  const lastSentTime = useRef(0);
  const nextCaptureDelay = useRef(10000); // Dynamic delay based on API response time
  const isFetchingWord = useRef(false); // Prevent duplicate word fetches

  // Audio control based on game state
  useEffect(() => {
    const audio = audioRef.current;
    audio.loop = true;
    audio.volume = 0.5;

    if (gameState === "playing" || gameState === "intro") {
      audio.play().catch((error) => {
        console.log("Audio autoplay failed:", error);
      });
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
    };
  }, [gameState]);

  // When AI returns a guess, show an overlay for correct/incorrect.
  // If correct, increment score and immediately fetch a new word so player can continue.
  useEffect(() => {
    if (aiResponse && gameState === "playing") {
      const isSuccess = aiResponse.result === "success";
      setResultConfirmed(isSuccess ? "success" : "fail");
      setResultMessage(isSuccess ? "Correct!" : "Incorrect");

      // show the backend response text while the overlay is visible
      const text = aiResponse.response || aiResponse.guess || "";
      setDisplayedGuess(text);

      // clear any existing overlay timeout
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }

      overlayTimeoutRef.current = setTimeout(() => {
        setResultMessage(null);
        setResultConfirmed(null);
        setDisplayedGuess("");
        // keep `aiResponse` so the latest backend response persists in state
        overlayTimeoutRef.current = null;
      }, 1500);

      if (isSuccess) {
        setScore((s) => s + 1);
        if (!isFetchingWord.current) {
          isFetchingWord.current = true;
          (async () => {
            try {
              const data = await getRandomWord();
              setCurrentWord(data.word);
              setChoices(data.choices);
            } catch (e) {
              console.error("prefetch next word failed", e);
            } finally {
              isFetchingWord.current = false;
            }
          })();
        }
      }
      // bump key so countdown timers listening to resetSignal can restart
      setAiResponseKey((k) => k + 1);
    }
    // cleanup on unmount
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
    };
  }, [aiResponse, gameState]);

  // Clear overlay and related transient state whenever the game stops playing
  useEffect(() => {
    if (gameState !== "playing") {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
      setResultMessage(null);
      setResultConfirmed(null);
      setDisplayedGuess("");
    }
  }, [gameState]);

  // No per-round end processing: the global match ends when the timer expires.

  const handleStartGame = async () => {
    try {
      const data = await getRandomWord();
      setCurrentWord(data.word);
      setChoices(data.choices);
      setAiResponse(null);
      setScore(0);
      setAttempts(0);
      // show round intro first, then actually start playing after intro completes
      setGameState("intro");
      // bump start key anyway so timer components stay deterministic
      setGameStartKey((k) => k + 1);
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  const handleBackToStart = () => {
    setGameState("start");
  };

  const handleShowLeaderboard = () => {
    setGameState("leaderboard");
  };

  const handleIntroComplete = () => {
    setGameState("playing");
  };

  const handlePlayAgain = () => {
    setGameState("start");
  };

  const handleSendFrame = useCallback(
    async (imageBlob) => {
      if (!imageBlob) return;

      const now = Date.now();
      const minDelay = nextCaptureDelay.current;
      if (now - lastSentTime.current < minDelay) {
        return;
      }
      lastSentTime.current = now;

      try {
        const apiStartTime = Date.now();
        const data = await sendFrameToBackend(imageBlob, currentWord, choices);
        const apiResponseTime = Date.now() - apiStartTime;

        // Dynamic adjustment: aim for ~5 captures per 45s game
        // If API takes 2s, next capture in 7s (2s + 7s = 9s cycle)
        // If API takes 4s, next capture in 5s (4s + 5s = 9s cycle)
        const targetCycle = 9000; // Target 9s per cycle = 5 captures in 45s
        const nextDelay = Math.max(
          5000,
          Math.min(10000, targetCycle - apiResponseTime)
        );
        nextCaptureDelay.current = nextDelay;

        console.log(`API: ${apiResponseTime}ms, Next capture: ${nextDelay}ms`);

        // store the full response object
        setAiResponse(data);
        setAttempts((prev) => prev + 1);
      } catch (error) {
        console.error("Error sending frame to backend:", error);

        // Check if it's a quota exceeded error
        if (error.response?.status === 429) {
          const message =
            error.response?.data?.detail ||
            "Thanks for playing! 🎮 This demo has a daily limit to keep it free for everyone. We've reached today's limit, but you can try again tomorrow! See you then! ⏰";

          alert(message);
          setGameState("start");
        }

        nextCaptureDelay.current = 10000; // Reset to default on error
      }
    },
    [currentWord, choices]
  );

  const handleSkipWord = useCallback(async () => {
    try {
      const data = await getRandomWord();
      setCurrentWord(data.word);
      setChoices(data.choices);
      setResultConfirmed(null);
    } catch (err) {
      console.error("Error fetching new word:", err);
    }
  }, []);

  const handleQuitGame = () => {
    setGameState("start");
    setCurrentWord("");
    setChoices([]);
    setAiResponse(null);
  };

  // --- Timer expiration ---
  const handleTimeUp = () => {
    // End the overall game when the global timer finishes
    setGameState("end");
  };

  // Toggle mute/unmute
  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="App-container">
      <button
        className="sound-toggle"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
      {gameState === "start" && <h1>AI Charades</h1>}

      {gameState === "start" && (
        <StartScreen
          onStartGame={handleStartGame}
          onShowLeaderboard={handleShowLeaderboard}
        />
      )}

      {gameState === "intro" && <RoundIntro onComplete={handleIntroComplete} />}

      {gameState === "playing" && (
        <GameScreen
          currentWord={currentWord}
          aiGuess={aiResponse?.response || aiResponse?.guess || ""}
          resetSignal={aiResponseKey}
          onCapture={handleSendFrame}
          duration={GAME_DURATION}
          onTimeUp={handleTimeUp}
          onSkipWord={handleSkipWord}
          onQuit={handleQuitGame}
          paused={false}
          startSignal={gameStartKey}
          score={score}
        />
      )}
      {gameState === "end" && (
        <EndScreen
          score={score}
          totalRounds={attempts}
          onRestart={handleStartGame}
          onBackToStart={handleBackToStart}
          onShowLeaderboard={handleShowLeaderboard}
        />
      )}
      {gameState === "leaderboard" && (
        <Leaderboard onBack={handleBackToStart} />
      )}
      {/* Animated guess overlay (success: green circle, fail: red X) */}
      <div className="guess-overlay">
        <div
          className={`guess-card ${resultMessage ? "show" : ""}`}
          aria-hidden={!resultMessage}
        >
          <div
            className={`guess-icon ${
              resultConfirmed === "success" ? "success" : "fail"
            }`}
            aria-hidden={!resultMessage}
          >
            {resultConfirmed === "success" ? "O" : "X"}
          </div>
        </div>
        {/* AI response text is displayed in the GameScreen robot area (AIGuessDisplay) */}
      </div>
    </div>
  );
}

export default App;
