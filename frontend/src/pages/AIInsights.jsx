import React from 'react';
import { useRepo } from '../context/RepoContext';
import { useAIInsights } from '../hooks/useAI';

const AIInsights = () => {
  const { selectedRepo } = useRepo();
  const { insights, loading, generating, generateInsights } = useAIInsights(selectedRepo?._id);

  if (!selectedRepo) return <div className="p-6">Please select a repository to generate AI insights.</div>;

  return (
    <div className="space-y-4">
      <h1 className="section-title">AI Insights — {selectedRepo.name}</h1>
      <div className="flex items-center gap-3">
        <button className="btn-cyber" onClick={() => generateInsights(false)} disabled={generating}>{generating ? 'Generating...' : 'Generate Insights'}</button>
      </div>

      <div className="glass-card p-4">
        {loading && <p>Loading insights...</p>}
        {!loading && insights && (
          <div>
            <h3 className="font-medium text-white">Sprint Summary</h3>
            <p className="text-sm text-slate-400 mt-2">{insights.sprintSummary || 'No sprint summary available.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
