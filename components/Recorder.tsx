
import React, { useRef, useState, useEffect } from 'react';
import { Stop } from '../constants';

interface RecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>('video/webm');

  const startCapture = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Handle stream end (user clicks "Stop sharing" in browser UI)
      mediaStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (err: any) {
      console.error("Error starting capture:", err);
      if (err.name === 'NotAllowedError') {
        setError("Permission denied. Please allow screen recording access.");
      } else if (err.message && err.message.includes('display-capture')) {
        setError("Screen recording is disabled by the permissions policy of this environment.");
      } else {
        setError("Failed to start screen recording. " + (err.message || ""));
      }
    }
  };

  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];

    // Dynamically detect supported MIME type
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4'
    ];

    const selectedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    // Store simple type for final blob to avoid complex codec strings causing issues downstream
    const simpleType = selectedType.split(';')[0];
    mimeTypeRef.current = simpleType;

    const options = {
      mimeType: selectedType,
      // Lower bitrate to ~1 Mbps to keep file size small for AI analysis
      videoBitsPerSecond: 1000000
    };

    try {
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Use the simple mimeType for the Blob
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        onRecordingComplete(blob);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      recorder.start(1000); // Collect chunks every second
      setIsRecording(true);
      setTimer(0);
      timerRef.current = window.setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } catch (err: any) {
      console.error("MediaRecorder error:", err);
      setError("Failed to start recording: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    } else if (stream) {
      // If we are just previewing (not recording) and want to stop/change
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="w-full max-w-4xl relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl aspect-video">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
            <p className="mb-4">Select a tab or window to record your demo.</p>
            <button
              onClick={startCapture}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Select Screen to Record
            </button>
            {error && (
              <div className="mt-4 bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-lg max-w-md text-center text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Overlay Controls */}
        {stream && (
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 z-10">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
              >
                <div className="w-3 h-3 bg-white rounded-full"></div>
                Start Rec
              </button>
            ) : (
              <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-sm px-6 py-2 rounded-full border border-slate-700">
                <div className="flex items-center gap-2 text-red-500 font-mono font-bold text-lg animate-pulse">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  {formatTime(timer)}
                </div>
                <button
                  onClick={stopRecording}
                  className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full transition-colors"
                >
                  <Stop />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-slate-400 max-w-lg">
        <p>
          {isRecording
            ? "Follow your shot list. Navigate calmly. The AI will speed it up later if needed."
            : "Once you select a screen, click Record. Try to keep it under 1 minute for faster processing."}
        </p>
      </div>
    </div>
  );
};
