import React from 'react';
import { RiMenuLine, RiGithubLine } from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import RepoSelector from './RepoSelector';

const TopBar = ({ onMenuToggle }) => {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-transparent">
      <div className="flex items-center gap-4">
        <button onClick={onMenuToggle} className="p-2 rounded-md text-slate-300 hover:text-neon-blue">
          <RiMenuLine size={20} />
        </button>
        <div className="hidden sm:block">
          <RepoSelector />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="btn-ghost hidden sm:inline-flex items-center gap-2">
          <RiGithubLine /> Connect
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center text-white text-sm">
            {user?.githubAvatar ? <img src={user.githubAvatar} alt="avatar" className="w-8 h-8 rounded-full" /> : (user?.name?.[0] || 'U')}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
