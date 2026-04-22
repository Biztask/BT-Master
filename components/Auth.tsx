
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { IconBuilding, IconUser, IconLock, IconDatabase, IconChevronLeft } from './Icons';
import { apiRegisterCompany, apiCheckUsernameExists, apiLogin } from '../services/storageService';
import { resetFirebaseConfig } from '../services/firebaseConfig';

interface AuthProps {
  onLogin: (user: User) => void;
  onRegisterCompany: (user: User) => void;
  onReset: () => void;
}

const CREDENTIALS_KEY = 'biz_saved_credentials';

const Auth: React.FC<AuthProps> = ({ onLogin, onRegisterCompany, onReset }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  // Form State
  const [companyName, setCompanyName] = useState(localStorage.getItem('biz_company_code') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // Only for register
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const savedData = localStorage.getItem(CREDENTIALS_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.username) setUsername(parsed.username);
      } catch (e) {
        console.error("Error loading saved credentials", e);
      }
    }
  }, []);

  const saveCredentials = () => {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({
      username
    }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!companyName || !username || !password || !fullName) {
      setError('Vui lòng điền đầy đủ thông tin');
      setIsLoading(false);
      return;
    }

    // 1. Check duplicate username in DB
    const exists = await apiCheckUsernameExists(companyName, username);
    if (exists) {
      setError('Tên đăng nhập đã tồn tại trong công ty này');
      setIsLoading(false);
      return;
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: fullName,
      username: username,
      password: password,
      companyName: companyName,
      companyId: companyName, // Sử dụng mã công ty (companyName) thay vì tạo ngẫu nhiên để match với masterDb
      role: UserRole.DIRECTOR, // Chức vụ cao nhất cho người tạo
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
      email: `${username}@${companyName.replace(/\s+/g, '').toLowerCase()}.com`
    };

    // 2. Register in DB
    const success = await apiRegisterCompany(newUser);
    if (success) {
      saveCredentials(); // Save info on success
      const { password: _, ...userWithoutPassword } = newUser;
      onRegisterCompany(userWithoutPassword as User);
    } else {
      setError('Lỗi kết nối Server. Vui lòng thử lại sau.');
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const user = await apiLogin(companyName, username, password);

    if (user) {
      saveCredentials(); // Save info on success
      onLogin(user);
    } else {
      setError('Sai tên công ty, tài khoản hoặc mật khẩu');
    }
    setIsLoading(false);
  };

  return (
    // Changed background to Navy Blue gradient
    <div className="min-h-screen bg-gradient-to-b from-navy-800 to-black flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Tabs */}
        <div className="flex bg-gray-100">
          <button
            onClick={() => setMode('LOGIN')}
            className={`flex-1 py-4 font-bold text-sm transition-colors ${mode === 'LOGIN' ? 'bg-white text-navy-800 border-t-2 border-navy-800' : 'text-gray-500'}`}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => setMode('REGISTER')}
            className={`flex-1 py-4 font-bold text-sm transition-colors ${mode === 'REGISTER' ? 'bg-white text-navy-800 border-t-2 border-navy-800' : 'text-gray-500'}`}
          >
            Đăng Ký Công Ty
          </button>
        </div>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
            {mode === 'LOGIN' ? 'Chào mừng trở lại!' : 'Khởi tạo doanh nghiệp'}
          </h2>

          <form onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister} className="space-y-4">
            
            {/* Common: Company Code (Read-only) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">MÃ CÔNG TY</label>
              <div className="relative">
                <IconBuilding className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={companyName}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none font-bold"
                />
              </div>
            </div>

            {/* Register Only: Full Name */}
            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Họ tên giám đốc</label>
                <div className="relative">
                  <IconUser className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Common: Username */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên đăng nhập</label>
              <div className="relative">
                <IconUser className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none"
                />
              </div>
            </div>

            {/* Common: Password */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu</label>
              <div className="relative">
                <IconLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-navy-800 text-white font-bold py-3 rounded-xl hover:bg-navy-900 transition shadow-lg mt-4 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                mode === 'LOGIN' ? 'Đăng Nhập' : 'Tạo Công Ty'
              )}
            </button>
          </form>

          {/* Reset Config Link */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                onReset();
              }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 w-full transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
              Quay lại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
