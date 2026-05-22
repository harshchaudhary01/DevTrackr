import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center cyber-bg">
      <div className="w-full max-w-md glass-card p-6">
        <h2 className="section-title mb-4">Create account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-white/5 rounded" required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-white/5 rounded" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-transparent border border-white/5 rounded" required />
          <button type="submit" className="btn-cyber w-full" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
        </form>
        <p className="text-sm text-slate-400 mt-4">Already have an account? <Link to="/login" className="text-neon-blue">Sign in</Link></p>
      </div>
    </div>
  );
};

export default Register;
