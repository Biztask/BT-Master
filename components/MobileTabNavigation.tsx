import React from 'react';

interface TabListProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

const MobileTabNavigation: React.FC<TabListProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto hide-scrollbar mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === tab.id 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default MobileTabNavigation;
