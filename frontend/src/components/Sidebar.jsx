import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiDashboardLine,
  RiGithubLine,
  RiBarChartLine,
  RiRobot2Line,
  RiTeamLine,
  RiSettings3Line,
  RiLogoutBoxLine,
  RiCodeLine,
  RiMenuLine,
} from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { useRepo } from '../context/RepoContext';

const navItems = [
  { to: '/dashboard', icon: RiDashboardLine, label: 'Overview' },
  { to: '/dashboard/repositories', icon: RiGithubLine, label: 'Repositories' },
  { to: '/dashboard/analytics', icon: RiBarChartLine, label: 'Analytics' },
  { to: '/dashboard/ai-insights', icon: RiRobot2Line, label: 'AI Insights' },
  { to: '/dashboard/contributors', icon: RiTeamLine, label: 'Contributors' },
  { to: '/dashboard/settings', icon: RiSettings3Line, label: 'Settings' },
];

const Sidebar = ({ isOpen, onToggle }) => {
  const { user, logout } = useAuth();
  const { selectedRepo } = useRepo();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 h-screen z-50 flex flex-col"
      animate={{ width: isOpen ? 240 : 72 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{
        background: 'linear-gradient(180deg, #0a0f1e 0%, #030712 100%)',
        borderRight: '1px solid rgba(0,212,255,0.1)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center flex-shrink-0 shadow-neon-blue">
          <RiCodeLine className="text-white text-lg" />
        </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <span className="font-display text-white font-bold text-base tracking-widest">
                DEV<span className="text-neon-blue">TRACKR</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected Repo Badge */}
      <AnimatePresence>
        {isOpen && selectedRepo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mt-3 px-3 py-2 rounded-lg border border-neon-blue/20 bg-neon-blue/5"
          >
            <p className="text-xs text-slate-500 font-mono mb-0.5">ACTIVE REPO</p>
            <p className="text-xs text-neon-blue font-medium truncate">{selectedRepo.name}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
          >
            <item.icon className="text-xl flex-shrink-0" />
            <AnimatePresence>
              {isOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/5 p-2">
        {/* User info */}
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {user?.githubAvatar ? (
              <img src={user.githubAvatar} alt="avatar" className="w-8 h-8 rounded-full" />
            ) : (
              user?.name?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.githubUsername ? `@${user.githubUsername}` : user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="sidebar-item w-full hover:text-red-400 hover:bg-red-500/10"
        >
          <RiLogoutBoxLine className="text-xl flex-shrink-0" />
          <AnimatePresence>
            {isOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;