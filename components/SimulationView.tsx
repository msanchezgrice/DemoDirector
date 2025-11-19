import React, { useState, useEffect, useRef } from 'react';
import { BrowserAction } from '../types';
import { Robot, Cursor } from '../constants';

interface SimulationViewProps {
  actions: BrowserAction[];
  url: string;
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({ actions, url, onRecordingComplete, onCancel }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });
  const [showClick, setShowClick] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Start screen capture
  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1280,
          height: 720,
          frameRate: 30
        },
        audio: false
      });

      setStream(mediaStream);

      // Handle stream end
      mediaStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (err) {
      console.error("Error starting capture:", err);
      alert("Failed to start screen recording. Please try again.");
    }
  };

  const startSimulation = () => {
    if (!stream) return;

    // Start Recording
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      onRecordingComplete(blob);
      stream.getTracks().forEach(track => track.stop());
    };

    recorder.start(100);
    setIsRecording(true);
    setIsPlaying(true);
    setCurrentActionIndex(0);

    // Start Animation Loop
    startTimeRef.current = performance.now();
    requestAnimationFrame(animate);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPlaying(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;

    // Logic to progress through actions based on time
    // This is a simplified state machine for the animation

    // For now, let's just iterate through actions with a fixed duration if not specified
    // In a real implementation, we'd interpolate positions based on timestamps

    // Simple step-based animation for MVP
    // We will use a separate effect or interval for the step logic to keep it simple

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Effect to handle action sequencing
  useEffect(() => {
    if (!isPlaying) return;

    let timeoutId: NodeJS.Timeout;

    const executeAction = async () => {
      if (currentActionIndex >= actions.length) {
        // Finished
        setTimeout(() => stopRecording(), 1000); // Buffer at end
        return;
      }

      const action = actions[currentActionIndex];

      // 1. Move Cursor
      setCursorPosition({ x: action.x, y: action.y });

      // 2. Wait for move duration (simulated)
      await new Promise(r => setTimeout(r, 1000));

      // 3. Perform Action Visuals
      if (action.action === 'click') {
        setShowClick(true);
        setTimeout(() => setShowClick(false), 300);
      }

      // 4. Wait for action duration
      await new Promise(r => setTimeout(r, (action.duration || 1) * 1000));

      // Next
      setCurrentActionIndex(prev => prev + 1);
    };

    executeAction();

    return () => clearTimeout(timeoutId);
  }, [isPlaying, currentActionIndex, actions]);


  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">

      {/* Header / Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-slate-900/80 backdrop-blur z-50">
        <div className="text-white font-bold flex items-center gap-2">
          <Robot /> AI Simulation Preview
        </div>
        <div className="flex gap-4">
          {!stream ? (
            <button
              onClick={startCapture}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-full font-semibold"
            >
              1. Select Screen to Record
            </button>
          ) : !isRecording ? (
            <button
              onClick={startSimulation}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-full font-semibold animate-pulse"
            >
              2. Start Simulation
            </button>
          ) : (
            <div className="flex items-center gap-2 text-red-500 font-bold bg-slate-900 px-4 py-2 rounded-full border border-red-900">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              Recording...
            </div>
          )}

          <button onClick={onCancel} className="text-slate-400 hover:text-white px-4">
            Cancel
          </button>
        </div>
      </div>

      {/* Simulation Viewport */}
      <div
        ref={containerRef}
        className="relative bg-white w-[1280px] h-[720px] shadow-2xl overflow-hidden"
        style={{ transform: 'scale(0.85)' }} // Scale down to fit
      >
        {/* Browser Chrome Mock */}
        <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 ml-4 bg-white h-7 rounded-md border border-slate-300 flex items-center px-3 text-xs text-slate-600 font-mono">
            {url}
          </div>
        </div>

        {/* Content Area - Placeholder since we can't iframe */}
        <div className="absolute inset-0 top-10 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
          <div className="w-full h-full grid grid-cols-12 grid-rows-6 gap-4 p-8 opacity-20">
            {/* Wireframe background */}
            <div className="col-span-12 row-span-1 bg-slate-300 rounded"></div>
            <div className="col-span-3 row-span-5 bg-slate-300 rounded"></div>
            <div className="col-span-9 row-span-5 bg-slate-300 rounded"></div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-300 mb-2">Simulation Mode</h3>
              <p className="max-w-md">
                The AI is simulating interaction on <strong>{url}</strong>.
                <br />
                (Visual placeholder for recording)
              </p>
            </div>
          </div>

          {/* Active Action Overlay */}
          {isPlaying && actions[currentActionIndex] && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white px-6 py-3 rounded-xl shadow-xl backdrop-blur flex items-center gap-3 transition-all">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                {currentActionIndex + 1}
              </div>
              <div>
                <div className="text-xs text-indigo-300 uppercase font-bold tracking-wider">
                  {actions[currentActionIndex].action}
                </div>
                <div className="font-medium">
                  {actions[currentActionIndex].target}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cursor */}
        <div
          className="absolute z-50 pointer-events-none transition-all duration-1000 ease-in-out"
          style={{
            left: `${cursorPosition.x}%`,
            top: `${cursorPosition.y}%`,
            marginTop: '2.5rem' // Offset for header
          }}
        >
          <div className="relative">
            <Cursor />
            {showClick && (
              <div className="absolute -top-2 -left-2 w-10 h-10 bg-indigo-500/50 rounded-full animate-ping"></div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
