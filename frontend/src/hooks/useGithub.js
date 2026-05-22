import { useState, useEffect, useCallback } from 'react';
import { githubAPI } from '../services/api';
import toast from 'react-hot-toast';

export const useTrackedRepos = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTracked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await githubAPI.getTrackedRepos();
      setRepos(res.data.repositories || []);
    } catch { setRepos([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTracked(); }, [fetchTracked]);

  return { repos, loading, refetch: fetchTracked };
};

export const useGithubRepos = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await githubAPI.getRepos();
      setRepos(res.data.repositories || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch repositories.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { repos, loading, error, fetchRepos };
};

export const useSyncRepo = () => {
  const [syncing, setSyncing] = useState(false);

  const syncRepo = useCallback(async (repoId, repoName) => {
    setSyncing(true);
    const toastId = toast.loading(`Syncing ${repoName}...`);
    try {
      await githubAPI.syncRepo(repoId);
      toast.success(`${repoName} synced successfully!`, { id: toastId });
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed.', { id: toastId });
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { syncing, syncRepo };
};