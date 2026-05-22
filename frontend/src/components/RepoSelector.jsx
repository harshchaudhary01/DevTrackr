import React from 'react';
import { useTrackedRepos } from '../hooks/useGithub';
import { useRepo } from '../context/RepoContext';

const RepoSelector = () => {
  const { repos, loading } = useTrackedRepos();
  const { selectedRepo, selectRepo } = useRepo();

  if (loading) return <div className="px-3 py-2 text-sm text-slate-400">Loading repos...</div>;
  if (!repos || repos.length === 0) return <div className="px-3 py-2 text-sm text-slate-400">No repos tracked</div>;

  return (
    <select
      value={selectedRepo?.id || ''}
      onChange={(e) => {
        const repo = repos.find((r) => r._id === e.target.value) || repos[0];
        selectRepo(repo);
      }}
      className="bg-transparent border border-neon-blue/20 rounded px-3 py-2 text-sm text-white"
    >
      <option value="">Select repository</option>
      {repos.map((r) => (
        <option key={r._id} value={r._id}>{r.name}</option>
      ))}
    </select>
  );
};

export default RepoSelector;
