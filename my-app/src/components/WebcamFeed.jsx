// WebcamFeed.jsx
import React, { useRef, useEffect, memo } from "react";

/**
 * WebcamFeed component
 * - Captures video from user's webcam
 * - Sends frames to the backend every 2 seconds
 * - Memoized to prevent unnecessary re-renders and blinking
 */
const WebcamFeed = memo(({ onCapture, paused = false }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Mount camera once and keep the stream until unmount to avoid flicker
    let mounted = true;
    let streamRef = null;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef = stream;
        if (!mounted) return;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    })();

    return () => {
      mounted = false;
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      if (streamRef) {
        try {
          streamRef.getTracks().forEach((t) => t.stop());
        } catch (e) {}
      }
    };
  }, []); // mount only once

  // capture interval effect: controlled separately so pause doesn't tear down the camera
  useEffect(() => {
    let intervalId = null;
    if (paused) return; // don't start captures when paused

    intervalId = setInterval(() => {
      if (!videoRef.current || !onCapture) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

        canvas.toBlob((blob) => {
          if (blob) onCapture(blob);
        }, "image/jpeg");
      }
    }, 10000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [onCapture, paused]);

  return (
    <div className="webcam-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "8px",
          objectFit: "cover",
          backgroundColor: "#000",
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
});

export default WebcamFeed;
