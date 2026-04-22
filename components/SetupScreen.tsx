
import React, { useState } from 'react';
import { joinCompany, registerCompany } from '../services/firebaseConfig';
import { IconBuilding, IconUser, IconKey, IconDatabase, IconAlert } from './Icons';

interface SetupScreenProps {
  onComplete: () => void;
}

type SetupMode = 'select' | 'employee' | 'director';

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [mode, setMode] = useState<SetupMode>('select');
  const [companyCode, setCompanyCode] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await joinCompany(companyCode);
      if (success) {
        onComplete();
      } else {
        setError('Không thể kết nối đến không gian làm việc.');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi kết nối.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await registerCompany(companyCode, configJson);
      if (success) {
        onComplete();
      } else {
        setError('Không thể tạo không gian làm việc.');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi đăng ký.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-800 to-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img 
            src="/icon.png" 
            alt="App Icon" 
            className="w-20 h-20 rounded-2xl shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="mt-6 text-center text-4xl font-black text-white tracking-widest">
          BIZTASK
        </h2>
        <p className="mt-2 text-center text-sm text-gray-300 font-medium">
          {mode === 'select' && 'Ứng Dụng Quản Lý Doanh Nghiệp Toàn Diện'}
          {mode === 'employee' && 'Đăng nhập vào không gian làm việc'}
          {mode === 'director' && 'Tạo không gian làm việc mới'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <IconAlert className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {mode === 'select' && (
            <div className="space-y-4">
              <button
                onClick={() => setMode('employee')}
                className="w-full flex items-center justify-center px-4 py-4 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <IconUser className="w-6 h-6 mr-3 text-blue-500" />
                ĐĂNG NHẬP
              </button>
              <button
                onClick={() => setMode('director')}
                className="w-full flex items-center justify-center px-4 py-4 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <IconKey className="w-6 h-6 mr-3 text-white" />
                ĐĂNG KÝ CÔNG TY
              </button>
            </div>
          )}

          {mode === 'employee' && (
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700">
                  MÃ CÔNG TY
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IconBuilding className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="companyCode"
                    required
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3"
                    placeholder="VD: VINGROUP"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Đang kết nối...' : 'Vào không gian làm việc'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('select'); setError(''); }}
                  className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Quay lại
                </button>
              </div>
            </form>
          )}

          {mode === 'director' && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <label htmlFor="newCompanyCode" className="block text-sm font-medium text-gray-700">
                  MÃ CÔNG TY
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IconBuilding className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="newCompanyCode"
                    required
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3"
                    placeholder="VD: BIZTASK"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Mã này sẽ được cấp cho nhân viên để đăng nhập.</p>
              </div>

              <div>
                <label htmlFor="configJson" className="block text-sm font-medium text-gray-700">
                  Cấu hình Firebase (JSON)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <IconDatabase className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    id="configJson"
                    required
                    rows={5}
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3 font-mono text-xs"
                    placeholder='{ "apiKey": "...", "projectId": "..." }'
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Đang khởi tạo...' : 'Tạo không gian làm việc'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('select'); setError(''); }}
                  className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Quay lại
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
