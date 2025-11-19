
import React from 'react';
import { DemoProject } from '../types';
import { Collection, VideoCamera, Play, Trash } from '../constants';

interface LibraryProps {
  projects: DemoProject[];
  onSelectProject: (project: DemoProject) => void;
  onDeleteProject: (id: string) => void;
  onBack: () => void;
}

export const Library: React.FC<LibraryProps> = ({ projects, onSelectProject, onDeleteProject, onBack }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 px-8 py-12 text-white">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-12">
          <div>
            <button
              onClick={onBack}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 mb-2 text-sm font-medium transition-colors"
            >
              ← Back to Home
            </button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Collection />
              Demo Library
            </h1>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
            <div className="text-slate-600 mb-4 scale-150 opacity-50">
              <VideoCamera />
            </div>
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No saved demos yet</h3>
            <p className="text-slate-500 max-w-md text-center mb-8">
              Create your first AI-powered demo video to start building your collection.
            </p>
            <button
              onClick={onBack}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Create New Demo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all group"
              >
                {/* Placeholder for video thumbnail - in a real app we'd capture a frame */}
                <div className="h-40 bg-slate-800 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60"></div>
                  <Play />
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-lg mb-1 truncate text-white group-hover:text-indigo-300 transition-colors">
                    {project.description || "Untitled Project"}
                  </h3>
                  <p className="text-slate-500 text-xs mb-4 font-mono truncate">
                    {project.url}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
                    <span className="bg-slate-800 px-2 py-1 rounded">
                      {project.timeline.length} events
                    </span>
                    <span className="bg-slate-800 px-2 py-1 rounded">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onSelectProject(project)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Open Editor
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                      }}
                      className="px-3 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 rounded-lg transition-colors"
                    >
                      <Trash />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
