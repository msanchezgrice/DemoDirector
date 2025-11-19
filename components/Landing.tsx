
import React, { useState } from 'react';
import { Icons } from '../constants';

interface LandingProps {
  onStart: (url: string, desc: string) => void;
  onOpenLibrary: () => void;
  isGenerating: boolean;
}

export const Landing: React.FC<LandingProps> = ({ onStart, onOpenLibrary, isGenerating }) => {
  const [url, setUrl] = useState('https://www.google.com/maps');
  const [desc, setDesc] = useState('A map application to find places and directions.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && desc) {
      onStart(url, desc);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center relative">
      
      <button 
        onClick={onOpenLibrary}
        className="absolute top-6 right-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-4 py-2 rounded-full hover:bg-slate-800"
      >
        <Icons.Collection />
        My Library
      </button>

      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-700">
        <div className="flex justify-center mb-6 text-indigo-400">
          <Icons.VideoCamera />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-white">DemoDirector AI</h1>
        <p className="text-slate-400 mb-8">
          Turn a simple screen recording into a polished product demo with AI-generated captions and edits.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Target App URL</label>
            <input
              type="url"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="https://myapp.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Short Description</label>
            <textarea
              required
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="What does this app do?"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                Start Demo Creation
                <Icons.Sparkles />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
