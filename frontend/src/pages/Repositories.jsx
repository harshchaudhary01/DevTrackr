import React from 'react';
import { useTrackedRepos, useSyncRepo } from '../hooks/useGithub';
import { useRepo } from '../context/RepoContext';

const Repositories = () => {
  const { repos, loading, refetch } = useTrackedRepos();
  const { selectedRepo, selectRepo } = useRepo();
  const { syncing, syncRepo } = useSyncRepo();

  if (loading) return <div className="p-6">Loading repositories...</div>;

  return (
    <div className="space-y-4">
      <h1 className="section-title">Repositories</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {repos.map((r) => (
          <div key={r._id} className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{r.name}</p>
              <p className="text-xs text-slate-400">{r.language} • {r.stars} ★</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { selectRepo(r); }} className="btn-ghost">Select</button>
              <button onClick={async () => { await syncRepo(r._id, r.name); refetch(); }} className="btn-cyber" disabled={syncing}>{syncing ? 'Syncing...' : 'Sync'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Repositories;
