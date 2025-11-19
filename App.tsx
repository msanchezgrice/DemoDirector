
import React, { useState, useEffect } from 'react';
import { Landing } from './components/Landing';
import { ShotList } from './components/ShotList';
import { Recorder } from './components/Recorder';
import { Editor } from './components/Editor';
import { Library } from './components/Library';
import { AppStep, DemoProject } from './types';
import { generateShotList, analyzeVideoAndGenerateTimeline, generateVoiceover } from './services/geminiService';
import { VideoCamera, Sparkles } from './constants';

const App: React.FC = () => {
  console.log("App component is rendering");
  const [step, setStep] = useState<AppStep>(AppStep.LANDING);
  const [savedProjects, setSavedProjects] = useState<DemoProject[]>([]);

  // Load library from local storage
  useEffect(() => {
    const saved = localStorage.getItem('demo_projects');
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
  }, []);

  // Save library to local storage
  useEffect(() => {
    localStorage.setItem('demo_projects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  const [project, setProject] = useState<DemoProject>({
    id: '',
    createdAt: 0,
    url: '',
    description: '',
    shotList: [],
    videoBlob: null,
    videoUrl: null,
    timeline: [],
    subtitles: [],
    voiceoverScript: '',
    audioBlob: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleStart = async (url: string, description: string) => {
    setIsProcessing(true);
    setProcessingStatus("Creating a plan...");
    setError(null);
    try {
      // 1. Generate Plan
      const shotList = await generateShotList(url, description);
      setProject({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        url,
        description,
        shotList,
        videoBlob: null,
        videoUrl: null,
        timeline: [],
        subtitles: [],
        voiceoverScript: '',
        audioBlob: null
      });
      setStep(AppStep.PLANNING);
    } catch (err) {
      console.error(err);
      setError("Failed to generate plan. Please check your API key or try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingComplete = async (blob: Blob) => {
    setProject(prev => ({ ...prev, videoBlob: blob }));
    setStep(AppStep.PROCESSING);

    try {
      // 2. Analyze Video
      setProcessingStatus("Analyzing video content (this may take 30s)...");
      // Pass description here so AI can infer value proposition
      const { timeline, subtitles, script } = await analyzeVideoAndGenerateTimeline(blob, project.url, project.description);

      setProject(prev => ({ ...prev, timeline, subtitles, voiceoverScript: script }));

      // 3. Generate Voiceover
      if (script) {
        setProcessingStatus("Generating AI voiceover...");
        const audioBlob = await generateVoiceover(script);
        setProject(prev => ({ ...prev, audioBlob }));
      }

      setStep(AppStep.EDITING);
    } catch (err) {
      console.error(err);
      setError("Failed to process video. The AI could not analyze the visual content. Please try recording again.");
      // Allow retry of processing or recording
      setStep(AppStep.RECORDING);
    }
  };

  const handleSaveProject = () => {
    setSavedProjects(prev => {
      // Update if exists, else add new
      const exists = prev.find(p => p.id === project.id);
      if (exists) {
        return prev.map(p => p.id === project.id ? project : p);
      }
      return [...prev, project];
    });
  };

  const handleDeleteProject = (id: string) => {
    setSavedProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleOpenProject = (proj: DemoProject) => {
    setProject(proj);
    setStep(AppStep.EDITING);
  };

  const handleRestart = () => {
    setStep(AppStep.LANDING);
    setProject({
      id: '',
      createdAt: 0,
      url: '',
      description: '',
      shotList: [],
      videoBlob: null,
      videoUrl: null,
      timeline: [],
      subtitles: [],
      voiceoverScript: '',
      audioBlob: null
    });
  };

  // Render Logic
  if (step === AppStep.LANDING) {
    return (
      <div className="text-white p-10">
        <h1>Icon Test</h1>
        <VideoCamera />
      </div>
    );
  }

  if (step === AppStep.LIBRARY) {
    return (
      <Library
        projects={savedProjects}
        onSelectProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onBack={() => setStep(AppStep.LANDING)}
      />
    );
  }

  if (step === AppStep.PLANNING) {
    return (
      <ShotList
        shots={project.shotList}
        onReadyToRecord={() => setStep(AppStep.RECORDING)}
        onSimulateRecording={handleRecordingComplete}
        url={project.url}
        description={project.description}
      />
    );
  }

  if (step === AppStep.RECORDING) {
    return (
      <>
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {error} <button className="underline ml-2" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        <Recorder onRecordingComplete={handleRecordingComplete} />
      </>
    );
  }

  if (step === AppStep.PROCESSING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-4">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">AI Director is Working</h2>
        <p className="text-slate-400 max-w-md text-center animate-pulse">
          {processingStatus}
        </p>
      </div>
    );
  }

  if (step === AppStep.EDITING && project.videoBlob) {
    return (
      <Editor
        videoBlob={project.videoBlob}
        audioBlob={project.audioBlob}
        timeline={project.timeline}
        subtitles={project.subtitles}
        voiceoverScript={project.voiceoverScript}
        onRestart={handleRestart}
        onSave={handleSaveProject}
      />
    );
  }

  return <div>Error: Unknown State</div>;
};

export default App;
