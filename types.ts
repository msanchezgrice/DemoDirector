

export enum AppStep {
  LANDING = 'LANDING',
  LIBRARY = 'LIBRARY',
  PLANNING = 'PLANNING',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  EDITING = 'EDITING'
}

export interface Shot {
  id: string;
  action: string;
  description: string;
  estimatedDuration: number;
}

export interface BrowserAction {
  id: string;
  action: 'click' | 'type' | 'scroll' | 'wait';
  target: string; // e.g. "Login Button"
  selector?: string; // CSS selector for Puppeteer/Playwright
  details: string;
  x: number; // 0-100 percentage width
  y: number; // 0-100 percentage height
  duration: number; // seconds
}

export interface TimelineEvent {
  id: string;
  startTime: number; // Seconds relative to video start
  endTime: number; // Seconds relative to video start
  text: string; // Caption text or voiceover script
  type: 'caption' | 'zoom' | 'highlight';
  details?: {
    x?: number; // Percentage 0-100
    y?: number; // Percentage 0-100
    zoomScale?: number;
  };
}

export interface Subtitle {
  startTime: number;
  endTime: number;
  text: string;
}

export interface DemoProject {
  id: string;
  createdAt: number;
  url: string;
  description: string;
  shotList: Shot[];
  browserActions?: BrowserAction[];
  videoBlob: Blob | null;
  videoUrl: string | null;
  timeline: TimelineEvent[];
  subtitles: Subtitle[];
  voiceoverScript: string;
  audioBlob: Blob | null;
}