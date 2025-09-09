"use client";

import React, { useEffect, useRef, useState } from "react";
import { LuFlipHorizontal } from "react-icons/lu";

interface CameraProps {
  onCapture: (dataUrl: string) => void;
}

const COUNTDOWN_SECONDS = 4;

const CameraCaptureOnTap: React.FC<CameraProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFront, setIsFront] = useState(true); // true = front cam, false = back cam

  const isSecure = window.isSecureContext || location.protocol === "https:";

  const startCamera = async (facingMode: "user" | "environment") => {
    if (!isSecure) {
      setError("Camera access requires HTTPS (or localhost).");
      return;
    }

    try {
      // Stop old stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: { facingMode },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("No video track found.");

      // Safeguard: block screen/display
      const label = videoTrack.label.toLowerCase();
      if (label.includes("screen") || label.includes("display")) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Invalid source detected (screen/display instead of camera).");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setError(null);

      console.log("✅ Using camera:", videoTrack.label);
    } catch (err: any) {
      console.error("Camera error:", err);
      setError(err.message || "Unable to access camera.");
    }
  };

  // Start default (front) on mount
  useEffect(() => {
    startCamera("user");
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const flipCamera = () => {
    const nextMode = isFront ? "environment" : "user";
    setIsFront(!isFront);
    startCamera(nextMode);
  };

  const handleTap = () => {
    if (capturedImage) return;
    if (countdown === null) {
      setCountdown(COUNTDOWN_SECONDS);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      capture();
      return;
    }
    const timer = setTimeout(
      () => setCountdown((prev) => (prev! > 0 ? prev! - 1 : 0)),
      1000
    );
    return () => clearTimeout(timer);
  }, [countdown]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    onCapture(dataUrl);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setCountdown(null);
    startCamera(isFront ? "user" : "environment");
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {error && <p className="text-red-600 font-semibold">{error}</p>}

      {!capturedImage && (
        <div
          className="relative w-full max-w-xs cursor-pointer"
          onClick={handleTap}
          onTouchStart={handleTap}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video shadow-lg border-2 border-green-700 rounded-lg"
          />

          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-white text-6xl font-bold drop-shadow-lg">{countdown}</span>
            </div>
          )}

          {countdown === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-white text-sm font-semibold text-center px-2">
                Tap anywhere to take photo
              </span>
            </div>
          )}
        </div>
      )}

      {!capturedImage && (
        <button
          type="button"
          onClick={flipCamera}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow flex items-center gap-2"
        >
          <LuFlipHorizontal size={20} />
          <span>Flip Camera</span>
        </button>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {capturedImage && (
        <div className="mt-4 w-full flex flex-col items-center">
          <p className="mb-2 font-semibold">Captured Image:</p>
          <img src={capturedImage} alt="Captured" className="w-full max-w-xs rounded shadow-md" />
          <button
            onClick={retakePhoto}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow"
          >
            Retake Photo
          </button>
        </div>
      )}
    </div>
  );
};

export default CameraCaptureOnTap;