import React, { useState, useRef, useEffect } from 'react';
import { IconSearch, IconX } from './Icons';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = 'Chọn...', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div 
        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white flex justify-between items-center cursor-pointer focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-gray-900 truncate' : 'text-gray-500 truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption ? (
          <button 
            type="button"
            className="text-gray-400 hover:text-gray-600 ml-2 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          >
            <IconX className="w-4 h-4" />
          </button>
        ) : (
          <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col">
          <div className="p-2 border-b border-gray-100 flex-shrink-0 relative">
            <IconSearch className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="w-full bg-gray-50 border border-gray-200 rounded-md py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-blue-50 ${opt.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-center text-gray-500">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
