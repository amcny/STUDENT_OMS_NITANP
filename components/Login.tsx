import React, { useState } from 'react';

interface LoginProps {
  onLogin: (gateName: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const upperUser = username.trim().toUpperCase();
    
    // In a real application, this would be an API call.
    // For this demo, we use hardcoded credentials.
    if (password === 'password123') {
        if (upperUser === 'FRONTGATE') {
            onLogin('Front Gate');
            return;
        }
        if (upperUser === 'BACKGATE') {
            onLogin('Back Gate');
            return;
        }
    }
    setError('Invalid username or password.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Student Outing Management</h1>
          <p className="mt-2 text-gray-600">Please sign in to your assigned gate</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
                <label htmlFor="username" className="sr-only">Username</label>
                <input 
                    id="username" 
                    name="username" 
                    type="text" 
                    autoComplete="username" 
                    required 
                    className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                    placeholder="Username (e.g., FRONTGATE)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input 
                    id="password" 
                    name="password" 
                    type="password" 
                    autoComplete="current-password" 
                    required 
                    className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-800" role="alert">
                <p>{error}</p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <p>Hint: Use username <code className="bg-gray-200 p-1 rounded">FRONTGATE</code> or <code className="bg-gray-200 p-1 rounded">BACKGATE</code> with password <code className="bg-gray-200 p-1 rounded">password123</code>.</p>
          </div>

          <div>
            <button 
              type="submit" 
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
