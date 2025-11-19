
import React, { useRef, useState, useEffect } from 'react';
import { TimelineEvent, Subtitle } from '../types';
import { Gif, Download, Monitor, Smartphone, Save, Refresh, Sparkles, Play, Pause } from '../constants';

interface EditorProps {
    videoBlob: Blob;
    audioBlob: Blob | null;
    timeline: TimelineEvent[];
    subtitles?: Subtitle[];
    voiceoverScript: string;
    onRestart: () => void;
    onSave: () => void;
}

export const Editor: React.FC<EditorProps> = ({ videoBlob, audioBlob, timeline, subtitles = [], voiceoverScript, onRestart, onSave }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timelineItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentCaption, setCurrentCaption] = useState<TimelineEvent | null>(null);
    const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVoiceoverEnabled, setIsVoiceoverEnabled] = useState(true);
    const [hasSaved, setHasSaved] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [generatedGifs, setGeneratedGifs] = useState<{ url: string, name: string }[]>([]);

    const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({
        transform: 'scale(1) translate(0px, 0px)',
        transition: 'transform 1s ease-in-out'
    });

    const videoUrl = React.useMemo(() => URL.createObjectURL(videoBlob), [videoBlob]);
    const audioUrl = React.useMemo(() => audioBlob ? URL.createObjectURL(audioBlob) : null, [audioBlob]);

    // --- TIMELINE & PLAYBACK LOGIC ---

    useEffect(() => {
        if (currentCaption) {
            const el = timelineItemRefs.current.get(currentCaption.id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentCaption]);

    useEffect(() => {
        const vid = videoRef.current;
        const aud = audioRef.current;
        if (!vid) return;

        const handleTimeUpdate = () => {
            if (isExporting) return;

            const time = vid.currentTime;
            setCurrentTime(time);

            // Sync audio
            if (aud && isVoiceoverEnabled && !aud.paused && Math.abs(aud.currentTime - time) > 0.3) {
                aud.currentTime = time;
            }

            // Find active visual event (Caption/Zoom)
            // Use a slight buffer to ensure we catch events even if frames skip
            const activeEvent = timeline.find(
                e => time >= e.startTime && time <= e.endTime
            );
            setCurrentCaption(activeEvent || null);

            // Handle Subtitles
            const activeSubtitle = subtitles.find(
                s => time >= s.startTime && time <= s.endTime
            );
            setCurrentSubtitle(activeSubtitle || null);

            // Handle Zoom
            const activeZoom = timeline.find(
                e => e.type === 'zoom' && time >= e.startTime && time <= e.endTime
            );

            if (activeZoom && activeZoom.details) {
                const { x = 50, y = 50, zoomScale = 1.5 } = activeZoom.details;
                setZoomStyle({
                    transformOrigin: `${x}% ${y}%`,
                    transform: `scale(${zoomScale})`,
                    transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                });
            } else {
                setZoomStyle({
                    transformOrigin: 'center center',
                    transform: 'scale(1)',
                    transition: 'transform 1s ease-out'
                });
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(vid.duration);
        };

        const handlePlay = () => {
            if (!isExporting) setIsPlaying(true);
        };

        const handlePause = () => {
            if (!isExporting) setIsPlaying(false);
        };

        const handleSeek = () => {
            if (aud && !isExporting) aud.currentTime = vid.currentTime;
        };

        vid.addEventListener('timeupdate', handleTimeUpdate);
        vid.addEventListener('loadedmetadata', handleLoadedMetadata);
        vid.addEventListener('play', handlePlay);
        vid.addEventListener('pause', handlePause);
        vid.addEventListener('seeking', handleSeek);
        vid.addEventListener('waiting', handlePause);

        return () => {
            vid.removeEventListener('timeupdate', handleTimeUpdate);
            vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
            vid.removeEventListener('play', handlePlay);
            vid.removeEventListener('pause', handlePause);
            vid.removeEventListener('seeking', handleSeek);
            vid.removeEventListener('waiting', handlePause);
        };
    }, [timeline, subtitles, isVoiceoverEnabled, isExporting]);

    // Audio Toggle Effect
    useEffect(() => {
        const aud = audioRef.current;
        if (!aud || isExporting) return;

        if (isVoiceoverEnabled && isPlaying) {
            const playPromise = aud.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name !== 'AbortError') console.log('Audio playback error:', error);
                });
            }
        } else {
            aud.pause();
        }
    }, [isVoiceoverEnabled, isPlaying, isExporting]);

    const togglePlay = () => {
        if (isExporting) return;
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        if (error.name !== 'AbortError') console.log("Video play error:", error);
                    });
                }
            }
        }
    };

    const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isExporting) return;
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const handleSave = () => {
        onSave();
        setHasSaved(true);
    };

    // --- EXPORT & RENDER ENGINE ---

    /**
     * Renders the video to a blob using an offline rendering process.
     * This separates the export from the UI state to ensure stability.
     */
    const renderToVideo = async (
        startTime: number,
        endTime: number,
        format: 'landscape' | 'portrait',
        isGifMode: boolean
    ): Promise<Blob | null> => {

        return new Promise(async (resolve) => {
            // 1. Create Offline Resources
            const offlineVideo = document.createElement('video');
            offlineVideo.src = videoUrl;
            offlineVideo.muted = true; // Mute element, we will mix audio via context
            offlineVideo.crossOrigin = "anonymous";

            await new Promise(r => {
                offlineVideo.onloadedmetadata = r;
                offlineVideo.load();
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const width = format === 'landscape' ? 1280 : 720;
            const height = format === 'landscape' ? 720 : 1280;
            canvas.width = width;
            canvas.height = height;

            // 2. Audio Setup (Only if not GIF mode and enabled)
            let audioDestination: MediaStreamAudioDestinationNode | null = null;
            let audioContext: AudioContext | null = null;

            if (!isGifMode && isVoiceoverEnabled && audioBlob) {
                audioContext = new AudioContext();
                audioDestination = audioContext.createMediaStreamDestination();

                // Decode audio data
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioDestination);
                source.start(0, startTime); // Start playing from the offset
            }

            // 3. Media Recorder Setup
            const stream = canvas.captureStream(30); // 30 FPS
            if (audioDestination) {
                const audioTracks = audioDestination.stream.getAudioTracks();
                if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
            }

            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: isGifMode ? 2500000 : 5000000
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                if (audioContext) audioContext.close();
                resolve(blob);
            };

            recorder.start();

            // 4. Render Loop
            offlineVideo.currentTime = startTime;
            await offlineVideo.play();

            const drawFrame = () => {
                if (offlineVideo.currentTime >= endTime || offlineVideo.ended) {
                    recorder.stop();
                    offlineVideo.pause();
                    return;
                }

                // Calculate Layout
                const vidW = offlineVideo.videoWidth;
                const vidH = offlineVideo.videoHeight;
                const scale = Math.max(width / vidW, height / vidH);
                const scaledW = vidW * scale;
                const scaledH = vidH * scale;
                const dx = (width - scaledW) / 2;
                const dy = (height - scaledH) / 2;

                // Draw Background
                if (ctx) {
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, width, height);

                    // Simulate Zoom (Simplified for Export)
                    // For a real detailed export we'd interpret the zoom events precisely
                    // For now we fit/cover
                    ctx.drawImage(offlineVideo, dx, dy, scaledW, scaledH);

                    // Draw Overlays
                    const t = offlineVideo.currentTime;

                    // Captions (Top)
                    const evt = timeline.find(e => t >= e.startTime && t <= e.endTime && e.type === 'caption');
                    if (evt) {
                        ctx.save();
                        ctx.font = 'bold 30px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const text = evt.text;
                        const textMetrics = ctx.measureText(text);
                        const pad = 20;
                        const boxW = textMetrics.width + pad * 2;
                        const boxH = 50;
                        const boxX = (width - boxW) / 2;
                        const boxY = format === 'portrait' ? 150 : 60;

                        // Shadow
                        ctx.shadowColor = "rgba(0,0,0,0.5)";
                        ctx.shadowBlur = 10;

                        ctx.fillStyle = 'rgba(79, 70, 229, 0.95)'; // Indigo
                        ctx.beginPath();
                        ctx.roundRect(boxX, boxY, boxW, boxH, 25);
                        ctx.fill();

                        ctx.shadowBlur = 0;
                        ctx.fillStyle = 'white';
                        ctx.fillText(text, width / 2, boxY + boxH / 2);
                        ctx.restore();
                    }

                    // Subtitles (Bottom) - Only if not GIF mode
                    if (!isGifMode) {
                        const sub = subtitles.find(s => t >= s.startTime && t <= s.endTime);
                        if (sub) {
                            ctx.save();
                            ctx.font = '500 28px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            const yPos = height - (format === 'portrait' ? 100 : 50);

                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 4;
                            ctx.strokeText(sub.text, width / 2, yPos);
                            ctx.fillStyle = 'white';
                            ctx.fillText(sub.text, width / 2, yPos);
                            ctx.restore();
                        }
                    }
                }

                // Update UI Progress
                if (!isGifMode) {
                    setExportProgress(Math.floor(((offlineVideo.currentTime - startTime) / (endTime - startTime)) * 100));
                }

                // Use requestVideoFrameCallback if available for better sync, else rAF
                if ('requestVideoFrameCallback' in offlineVideo) {
                    (offlineVideo as any).requestVideoFrameCallback(drawFrame);
                } else {
                    requestAnimationFrame(drawFrame);
                }
            };

            drawFrame();
        });
    };

    const handleExportVideo = async (format: 'landscape' | 'portrait') => {
        setIsExporting(true);
        setShowExportMenu(false);
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();

        const blob = await renderToVideo(0, duration || 30, format, false);

        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `demo-export-${format}.webm`;
            a.click();
        }

        setIsExporting(false);
        setExportProgress(0);
    };

    const handleGenerateMagicGifs = async () => {
        setIsExporting(true);
        setShowExportMenu(false);
        setIsPlaying(false);
        setGeneratedGifs([]);

        // Pick top 3 events
        const events = timeline.filter(t => t.type !== 'zoom').slice(0, 3);
        const newGifs = [];

        for (const evt of events) {
            // 3 second clips
            const start = evt.startTime;
            const end = Math.min(evt.startTime + 3, duration);
            const blob = await renderToVideo(start, end, 'landscape', true);
            if (blob) {
                newGifs.push({
                    url: URL.createObjectURL(blob),
                    name: `GIF-${evt.text.replace(/\s+/g, '-')}.webm`
                });
            }
        }

        setGeneratedGifs(newGifs);
        setIsExporting(false);
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden relative">

            {/* Export Overlay */}
            {(isExporting || generatedGifs.length > 0) && (
                <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-8">
                    {isExporting ? (
                        <>
                            <div className="w-20 h-20 mb-6 relative">
                                <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Processing Video...</h2>
                            <p className="text-slate-400">Rendering frames & subtitles</p>
                        </>
                    ) : (
                        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 max-w-2xl w-full">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                <Gif /> Magic GIFs Ready
                            </h2>
                            <div className="grid grid-cols-1 gap-4 mb-8">
                                {generatedGifs.map((gif, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-800 p-4 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <video src={gif.url} autoPlay muted loop className="w-24 h-14 bg-black object-cover rounded-lg" />
                                            <span className="font-medium text-slate-200">{gif.name}</span>
                                        </div>
                                        <a
                                            href={gif.url}
                                            download={gif.name}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                                        >
                                            Download
                                        </a>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setGeneratedGifs([])}
                                className="w-full py-3 text-slate-400 hover:text-white transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden Audio Player */}
            {audioUrl && (
                <audio ref={audioRef} src={audioUrl} />
            )}

            {/* Header */}
            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 z-50 relative">
                <h1 className="font-semibold text-lg flex items-center gap-2">
                    <span className="text-indigo-400">DemoDirector</span> Studio
                </h1>
                <div className="flex gap-3">
                    <div className="relative">
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                        >
                            <Download /> Export
                        </button>

                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                                <div className="p-3 text-xs text-slate-400 uppercase font-bold tracking-wider">Full Video</div>
                                <button
                                    onClick={() => handleExportVideo('landscape')}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors text-sm"
                                >
                                    <Monitor />
                                    <div>
                                        <div className="text-white font-medium">Landscape (16:9)</div>
                                        <div className="text-slate-500 text-xs">YouTube, Web</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleExportVideo('portrait')}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors text-sm"
                                >
                                    <Smartphone />
                                    <div>
                                        <div className="text-white font-medium">Portrait (9:16)</div>
                                        <div className="text-slate-500 text-xs">TikTok, Shorts, Reels</div>
                                    </div>
                                </button>

                                <div className="border-t border-slate-700 my-1"></div>
                                <div className="p-3 text-xs text-slate-400 uppercase font-bold tracking-wider">Shorts</div>
                                <button
                                    onClick={handleGenerateMagicGifs}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors text-sm"
                                >
                                    <Gif />
                                    <div>
                                        <div className="text-white font-medium">Generate Magic GIFs</div>
                                        <div className="text-slate-500 text-xs">Looping clips of highlights</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={hasSaved}
                        className={`text-sm px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${hasSaved ? 'bg-green-600/20 text-green-400 cursor-default' : 'bg-slate-800 hover:bg-slate-700 text-white'
                            }`}
                    >
                        {hasSaved ? 'Saved' : <Save />}
                    </button>
                    <button
                        onClick={onRestart}
                        className="text-sm text-slate-400 hover:text-white flex items-center gap-1 px-3 py-2"
                    >
                        <Refresh />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Main Stage */}
                <div className="flex-1 flex flex-col p-8 items-center justify-center bg-black relative">

                    {/* Video Container with Zoom */}
                    {/* Added z-0 to ensure isolation and proper stacking context */}
                    <div className="relative overflow-hidden rounded-xl shadow-2xl bg-black max-h-full aspect-video w-full max-w-5xl border border-slate-800 ring-1 ring-white/10 group isolate">
                        <div
                            ref={containerRef}
                            className="w-full h-full will-change-transform"
                            style={zoomStyle}
                        >
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                className="w-full h-full object-contain"
                                onClick={togglePlay}
                                muted={!isMuted}
                                playsInline
                                crossOrigin="anonymous"
                            />
                        </div>

                        {/* Visual Highlight Caption (Top) */}
                        {/* Z-Index 50 to ensure it floats above everything */}
                        {currentCaption && (
                            <div className="absolute top-8 md:top-12 left-0 right-0 flex justify-center pointer-events-none z-50 px-4">
                                <div className="bg-indigo-600/95 backdrop-blur-md text-white px-6 py-3 rounded-full text-lg md:text-xl font-bold shadow-2xl animate-in fade-in slide-in-from-top-4 border border-white/20 max-w-2xl text-center flex items-center gap-3">
                                    <Sparkles />
                                    {currentCaption.text}
                                </div>
                            </div>
                        )}

                        {/* Subtitle Overlay (Bottom) */}
                        {currentSubtitle && isVoiceoverEnabled && (
                            <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none z-50 px-8">
                                <div className="bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-lg text-lg md:text-xl font-medium text-center shadow-xl animate-in fade-in border border-white/10">
                                    {currentSubtitle.text}
                                </div>
                            </div>
                        )}

                        {/* Play/Pause Overlay */}
                        {!isPlaying && !isExporting && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 z-40 transition-opacity opacity-100 group-hover:opacity-100">
                                <div className="bg-white/20 backdrop-blur-sm p-6 rounded-full transition-transform transform group-hover:scale-110">
                                    <div className="scale-150">
                                        <Play />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-5xl mt-6 flex flex-col gap-3 px-4 z-40">
                        <div className="flex items-center gap-4">
                            <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition">
                                {isPlaying ? <Pause /> : <Play />}
                            </button>
                            <span className="text-xs font-mono text-slate-400 w-12 text-right">{Math.floor(currentTime)}s</span>
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                value={currentTime}
                                onChange={seek}
                                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <span className="text-xs font-mono text-slate-400 w-12">{Math.floor(duration)}s</span>
                        </div>

                        <div className="flex gap-6 justify-center pt-2 border-t border-slate-800/50 mt-2">
                            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                                <input
                                    type="checkbox"
                                    checked={isVoiceoverEnabled}
                                    onChange={e => setIsVoiceoverEnabled(e.target.checked)}
                                    disabled={!audioBlob}
                                    className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-offset-slate-900"
                                />
                                <span>AI Voiceover & Subtitles</span>
                            </label>

                            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                                <input
                                    type="checkbox"
                                    checked={!isMuted}
                                    onChange={e => setIsMuted(!e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-offset-slate-900"
                                />
                                <span>Original Audio</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Sidebar Timeline */}
                <div className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden z-30 shadow-xl">
                    <div className="flex border-b border-slate-800">
                        <div className="flex-1 p-3 text-center font-semibold text-slate-300 bg-slate-800/50">
                            Visual Timeline
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        {voiceoverScript && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-lg">
                                <h3 className="text-indigo-300 text-xs uppercase font-bold mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                                    Full Script
                                </h3>
                                <p className="text-slate-300 text-sm leading-relaxed italic">
                                    "{voiceoverScript}"
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <h3 className="text-slate-500 text-xs uppercase font-bold">Events</h3>
                            {timeline.length === 0 && <p className="text-slate-600 text-sm">No events generated.</p>}
                            {timeline.map((event) => (
                                <div
                                    key={event.id}
                                    ref={(el) => {
                                        if (el) timelineItemRefs.current.set(event.id, el);
                                        else timelineItemRefs.current.delete(event.id);
                                    }}
                                    onClick={() => {
                                        if (videoRef.current) videoRef.current.currentTime = event.startTime;
                                    }}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${currentTime >= event.startTime && currentTime <= event.endTime
                                        ? 'bg-slate-800 border-indigo-500/50 ring-1 ring-indigo-500 shadow-lg scale-[1.02]'
                                        : 'bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/80'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${event.type === 'zoom' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                                            }`}>
                                            {event.type}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {Math.floor(event.startTime)}s
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-200 leading-snug font-medium">
                                        {event.type === 'zoom' ? `Focus: ${event.details?.x}% / ${event.details?.y}%` : `"${event.text}"`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
