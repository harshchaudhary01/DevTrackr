import { useState, useEffect, useCallback } from 'react';
import { aiAPI } from '../services/api';
import toast from 'react-hot-toast';

export const useAIInsights = (repoId) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Try to load existing insights
  const loadInsights = useCallback(async () => {
    if (!repoId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await aiAPI.getInsights(repoId);
      setInsights(res.data.insights);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message);
      }
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  // Generate new insights
  const generateInsights = useCallback(async (force = false) => {
    if (!repoId) return;
    setGenerating(true);
    const toastId = toast.loading('🤖 Gemini AI is analyzing your repository...');
    try {
      const res = await aiAPI.generateInsights(repoId, force);
      setInsights(res.data.insights);
      toast.success('✨ AI insights generated!', { id: toastId });
    } catch (err) {
      const msg = err.response?.data?.message || 'AI generation failed.';
      toast.error(msg, { id: toastId });
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [repoId]);

  return { insights, loading, generating, error, generateInsights, refetch: loadInsights };
};