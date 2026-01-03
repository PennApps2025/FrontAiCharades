import React from "react";

// Import your components
import WordPrompt from "./WordPrompt";
import WebcamFeed from "./WebcamFeed";
import AIGuessDisplay from "./AIGuessDisplay";
import Timer from "./Timer";
import CountdownTimer from "./CountdownTimer";
import robotImg from "../../resources/curious_robot.gif";

// Import the new CSS for layout and arcade theme
import "../gameScreenLayout.css";

const GameScreen = ({
  currentWord,
  aiGuess,
  onCapture,
  duration,
  onTimeUp,
  onSkipWord,
  onQuit,
  paused = false,
  isTransitioning = false,
  startSignal = 0,
  resetSignal = null,
  score = 0,
}) => {
  const CAPTURE_INTERVAL = 10; // seconds - matches WebcamFeed interval

  return (
    <div className={"game-screen" + (isTransitioning ? " transitioning" : "")}>
      {/* Quit button fixed at top-right of the page */}
      <button
        className="quit-top-right control-button"
        onClick={onQuit}
        aria-label="Exit Game"
      ></button>
      <div className="game-header">
        <WordPrompt word={currentWord} />
        {/* Render Timer always (so it can listen to round changes) but hide when paused */}
        <div style={{ visibility: paused ? "hidden" : "visible", width: 300 }}>
          <Timer
            duration={duration}
            onTimeUp={onTimeUp}
            paused={paused}
            startSignal={startSignal}
          />
        </div>
      </div>

      {/* Webcam + Countdown side by side */}
      <div className="webcam-countdown-container">
        {/* Robot block (image + AI guess above it) placed to the left of the centered webcam */}
        <div className="robot-block">
          <AIGuessDisplay guess={aiGuess} />
          <img src={robotImg} alt="robot" className="robot-image" />
        </div>

        <div className="webcam-container">
          <WebcamFeed onCapture={onCapture} paused={paused} />
        </div>
        <CountdownTimer
          interval={CAPTURE_INTERVAL}
          onCapture={onCapture}
          paused={paused}
          resetSignal={resetSignal}
          score={score}
        />
      </div>

      <div className="game-controls">
        <button
          className="control-button skip-button"
          onClick={onSkipWord}
          aria-label="Skip Word"
        ></button>
      </div>
    </div>
  );
};

export default GameScreen;
