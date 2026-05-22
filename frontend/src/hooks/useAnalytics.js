import { useState, useEffect, useCallback } from 'react';
import { analyticsAPI, dashboardAPI } from '../services/api';
import toast from 'react-hot-toast';

export const useRepoDashboard = (repoId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!repoId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardAPI.getRepoDashboard(repoId);
      setData(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load dashboard data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
};

export const useOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getOverview();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
};

export const useContributors = (repoId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return;
    const fetch = async () => {
      try {
        const res = await analyticsAPI.getContributors(repoId);
        setData(res.data);
      } catch { setData(null); }
      finally { setLoading(false); }
    };
    fetch();
  }, [repoId]);

  return { data, loading };
};