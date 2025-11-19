
import React, { useState, useEffect } from 'react';
import { Shot, BrowserAction } from '../types';
import { Robot, Sparkles, Code, Download, FileJson, VideoCamera } from '../constants';
import { generateBrowserActions } from '../services/geminiService';
import { SimulationView } from './SimulationView';

interface ShotListProps {
    shots: Shot[];
    onReadyToRecord: () => void;
    onSimulateRecording: (blob: Blob) => void;
    url: string;
    description: string;
}

export const ShotList: React.FC<ShotListProps> = ({ shots, onReadyToRecord, onSimulateRecording, url, description }) => {
    const [activeTab, setActiveTab] = useState<'plan' | 'agent'>('agent');
    const [actions, setActions] = useState<BrowserAction[]>([]);
    const [isGeneratingActions, setIsGeneratingActions] = useState(false);
    const [showSimulation, setShowSimulation] = useState(false);

    useEffect(() => {
        if (activeTab === 'agent' && actions.length === 0) {
            setIsGeneratingActions(true);
            generateBrowserActions(url, description)
                .then(setActions)
                .finally(() => setIsGeneratingActions(false));
        }
    }, [activeTab, url, description]);

    const downloadBlueprint = () => {
        const blueprint = {
            url,
            description,
            actions
        };
        const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: 'application/json' });
        const urlObj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `automation-blueprint-${url.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
        a.click();
    };

    if (showSimulation) {
        return (
            <SimulationView
                actions={actions}
                url={url}
                onRecordingComplete={onSimulateRecording}
                onCancel={() => setShowSimulation(false)}
            />
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-slate-950 text-white">

            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab('agent')}
                    className={`px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 ${activeTab === 'agent' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                    <Robot /> AI Agent Blueprint
                </button>
                <button
                    onClick={() => setActiveTab('plan')}
                    className={`px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 ${activeTab === 'plan' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                    <Sparkles /> Manual Plan
                </button>
            </div>

            <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-800">

                {activeTab === 'agent' ? (
                    <div>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Code />
                                    Automation Blueprint (Server-Side)
                                </h2>
                                <p className="text-slate-400 mt-2 max-w-2xl">
                                    The AI has designed a navigation path for <strong>{url}</strong>.
                                    Download this JSON blueprint to execute with Puppeteer, Playwright, or Selenium on your server.
                                </p>
                            </div>
                        </div>

                        {isGeneratingActions ? (
                            <div className="py-20 flex flex-col items-center text-indigo-400 animate-pulse">
                                <Sparkles />
                                <p className="mt-4">Analyzing site structure & generating selectors...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Action List */}
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Step-by-Step Plan</h3>
                                    {actions.map((action, index) => (
                                        <div key={index} className="flex items-start bg-slate-800 p-4 rounded-lg border border-slate-700">
                                            <div className="bg-indigo-900/50 text-indigo-300 w-6 h-6 rounded flex items-center justify-center flex-shrink-0 font-mono text-xs border border-indigo-500/30 mt-1">
                                                {index + 1}
                                            </div>
                                            <div className="ml-4 flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-indigo-200 uppercase text-xs tracking-wider">{action.action}</span>
                                                    {action.selector && (
                                                        <span className="text-slate-500 text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded">
                                                            {action.selector}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-white font-medium text-sm">{action.target}</h3>
                                                <p className="text-slate-400 text-xs mt-1">{action.details}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* JSON Preview */}
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">JSON Config</h3>
                                        <button
                                            onClick={downloadBlueprint}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                                        >
                                            <Download /> Download .JSON
                                        </button>
                                    </div>
                                    <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 flex-1 overflow-hidden relative font-mono text-xs text-green-400">
                                        <div className="absolute inset-0 overflow-auto p-4 custom-scrollbar">
                                            <pre>{JSON.stringify({
                                                project: "DemoDirector-Blueprint",
                                                target_url: url,
                                                steps: actions
                                            }, null, 2)}</pre>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-4">
                                        <button
                                            onClick={downloadBlueprint}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                                        >
                                            <FileJson />
                                            Download Blueprint
                                        </button>
                                        <button
                                            onClick={() => setShowSimulation(true)}
                                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                                        >
                                            <VideoCamera />
                                            Simulate & Record
                                        </button>
                                        <button
                                            onClick={onReadyToRecord}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                                        >
                                            <VideoCamera />
                                            Manual Record Instead
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                            <Sparkles />
                            Manual Director's Plan
                        </h2>
                        <p className="text-slate-400 mb-6">
                            Review the shots, then click "Start Recording" to navigate the app yourself.
                        </p>
                        <div className="space-y-4 mb-8">
                            {shots.map((shot, index) => (
                                <div key={shot.id} className="flex items-start bg-slate-900 p-4 rounded-lg border border-slate-700">
                                    <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 font-bold">
                                        {index + 1}
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-semibold text-indigo-200">{shot.action}</h3>
                                        <p className="text-slate-400 text-sm mt-1">{shot.description}</p>
                                        <span className="inline-block mt-2 text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded">
                                            ~{shot.estimatedDuration}s
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={onReadyToRecord}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                        >
                            I'm Ready to Record Manually
                            <VideoCamera />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
