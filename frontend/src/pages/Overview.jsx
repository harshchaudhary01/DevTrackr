import React from 'react';
import { useOverview } from '../hooks/useAnalytics';
import KPICard from '../components/KPICard';

const Overview = () => {
  const { data, loading, error } = useOverview();

  if (loading) return <div className="p-6">Loading overview...</div>;
  if (error) return <div className="p-6">Error: {error}</div>;

  const metrics = data?.data?.metrics || {};

  return (
    <div className="space-y-6">
      <h1 className="section-title">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Commits" value={metrics.totalCommits ?? 0} />
        <KPICard title="Pull Requests" value={metrics.totalPRs ?? 0} />
        <KPICard title="Issues" value={metrics.totalIssues ?? 0} />
      </div>

      <div className="glass-card p-4"> 
        <p className="text-sm text-slate-400">Quick summary and charts will appear here.</p>
      </div>
    </div>
  );
};

export default Overview;
