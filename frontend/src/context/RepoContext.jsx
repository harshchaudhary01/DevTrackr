import React, { createContext, useContext, useState, useCallback } from 'react';

const RepoContext = createContext(null);

export const RepoProvider = ({ children }) => {
  const [selectedRepo, setSelectedRepo] = useState(() => {
    const saved = localStorage.getItem('devtrackr_selected_repo');
    return saved ? JSON.parse(saved) : null;
  });

  const selectRepo = useCallback((repo) => {
    setSelectedRepo(repo);
    if (repo) {
      localStorage.setItem('devtrackr_selected_repo', JSON.stringify(repo));
    } else {
      localStorage.removeItem('devtrackr_selected_repo');
    }
  }, []);

  return (
    <RepoContext.Provider value={{ selectedRepo, selectRepo }}>
      {children}
    </RepoContext.Provider>
  );
};

export const useRepo = () => {
  const context = useContext(RepoContext);
  if (!context) throw new Error('useRepo must be used within RepoProvider');
  return context;
};