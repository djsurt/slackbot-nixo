import React from 'react';

interface Message {
  id: string;
  text: string;
  channel: string;
  username?: string;
  ts?: string;
}

interface IssueCardProps {
  groupId: string;
  issueTitle: string;
  messages: Message[];
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (ts?: string) => string;
}

const IssueCard: React.FC<IssueCardProps> = ({
  issueTitle,
  messages,
  isExpanded,
  onToggle,
  formatDate,
}) => {
  const groupTime = formatDate(messages[messages.length - 1].ts);
  const latestMessage = messages[messages.length - 1];

  return (
    <div className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8D5C4' }}>
      {/* Card Header */}
      <div
        className="p-6 cursor-pointer transition-all duration-300"
        style={{ backgroundColor: isExpanded ? '#FFF5EE' : 'transparent' }}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold mb-1" style={{ color: '#3D405B' }}>
                {issueTitle || "General inquiry"}
              </h3>
              <p className="text-sm line-clamp-2" style={{ color: '#6B6B6B' }}>
                {latestMessage.text}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FFE8DC', color: '#D4684F', border: '1px solid #E8C4B0' }}>
                  {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                </span>
                <span className="text-xs font-medium" style={{ color: '#8B8B8B' }}>
                  Updated {groupTime}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <svg
              className={`w-5 h-5 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              style={{ color: '#E07A5F' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6" style={{ borderTop: '1px solid #E8D5C4', backgroundColor: '#FFF9F5' }}>
          <div className="space-y-4">
            <div className="mb-6">
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#3D405B' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#E07A5F' }}></span>
                Latest Update
              </h4>
              <div className="pl-4 py-3 bg-white rounded-r-lg shadow-sm" style={{ borderLeft: '4px solid #E07A5F' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>{latestMessage.text}</p>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: '#D4684F' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#E07A5F' }}></span>
                All Messages ({messages.length})
              </h4>
            </div>

            <div className="space-y-3">
              {messages.map((m, idx) => (
                <div
                  key={m.id}
                  className="bg-white rounded-xl p-4 hover:shadow-md transition-all duration-300"
                  style={{ border: '1px solid #E8D5C4' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: '#FFFFFF', border: '2px solid #000000' }}>
                        <span className="font-bold text-xs" style={{ color: '#E07A5F' }}>
                          {idx + 1}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-bold" style={{ color: '#3D405B' }}>
                          {m.username || "Unknown"}
                        </span>
                        <p className="text-xs" style={{ color: '#8B8B8B' }}>
                          Message {idx + 1}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium" style={{ color: '#8B8B8B' }}>
                      {formatDate(m.ts)}
                    </span>
                  </div>
                  <p className="text-sm mb-3 leading-relaxed" style={{ color: '#4A4A4A' }}>{m.text}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium" style={{ color: '#8B8B8B' }}>Channel:</span>
                    <code className="px-2.5 py-1 rounded-md font-mono font-semibold" style={{ backgroundColor: '#FFE8DC', color: '#D4684F', border: '1px solid #E8C4B0' }}>
                      {m.channel}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueCard;
