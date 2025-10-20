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

  const baseFieldClasses = "w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-gray-800 shadow-sm transition duration-150 ease-in-out focus:bg-white";

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col">
       <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 shadow-lg w-full">
            <div className="container mx-auto flex items-center gap-4">
                <img 
                    src="https://mscnitanp.pages.dev/nitanp_logo.png" 
                    alt="NIT Andhra Pradesh Logo" 
                    className="h-16 w-16 flex-shrink-0"
                />
                <div>
                    <h1 className="text-xl font-bold">National Institute of Technology, Andhra Pradesh</h1>
                    <p className="text-sm text-slate-300">Student Outing Management</p>
                </div>
            </div>
        </header>

        <main className="flex-grow flex items-center justify-center p-4">
            <div className="w-full max-w-md p-10 space-y-8 bg-white rounded-xl shadow-2xl">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-800">Gate Security Login</h2>
                    <p className="mt-2 text-gray-600">Please sign in to your assigned gate</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="relative">
                            <label htmlFor="username" className="sr-only">Username</label>
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input 
                                id="username" 
                                name="username" 
                                type="text" 
                                autoComplete="username" 
                                required 
                                className={baseFieldClasses}
                                placeholder="Enter Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <label htmlFor="password" className="sr-only">Password</label>
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input 
                                id="password" 
                                name="password" 
                                type="password" 
                                autoComplete="current-password" 
                                required 
                                className={baseFieldClasses}
                                placeholder="Enter Password"
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

                    <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-md border border-gray-200">
                        <p className="font-semibold">Login Hint:</p>
                        <p>Use username <code className="bg-gray-200 px-1 rounded">FRONTGATE</code> or <code className="bg-gray-200 px-1 rounded">BACKGATE</code> with password <code className="bg-gray-200 px-1 rounded">password123</code>.</p>
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
        </main>
    </div>
  );
};

export default Login;