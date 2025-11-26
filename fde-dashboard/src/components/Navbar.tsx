import React from 'react';

interface NavbarProps {
  title: string;
  activeIssuesCount: number;
}

const Navbar: React.FC<NavbarProps> = ({ title, activeIssuesCount }) => {
  return (
    <div className="sticky top-0 z-50 backdrop-blur-lg shadow-sm" style={{ borderBottom: '1px solid #E8D5C4', backgroundColor: 'rgba(250, 249, 246, 0.95)' }}>
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#000000', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>{title}</h1>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ backgroundColor: '#F5F5F5', border: '1px solid #E0E0E0' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#E07A5F' }}></div>
            <span className="text-sm font-medium" style={{ color: '#3D405B' }}>{activeIssuesCount} Active Issues</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;