// src/App.tsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface Ticket {
  id: string;
  text: string;
  channel: string;
  type: string;
  relevance_score: number;
  group_id: string;
  ts?: string;
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel("realtime:tickets")
      .on<Ticket>(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          if (payload.new) {
            setTickets((prev) => [...prev, payload.new as Ticket]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTickets = async () => {
    const { data, error } = await supabase.from("tickets").select("*");
    if (error) console.error("Supabase fetch error:", error);
    if (data) setTickets(data as Ticket[]);
  };

  const groups: Record<string, Ticket[]> = tickets.reduce(
    (acc: Record<string, Ticket[]>, t: Ticket) => {
      if (!acc[t.group_id]) acc[t.group_id] = [];
      acc[t.group_id].push(t);
      return acc;
    },
    {}
  );

  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const latestA = new Date(a[1][a[1].length - 1].ts || "").getTime();
    const latestB = new Date(b[1][b[1].length - 1].ts || "").getTime();
    return latestB - latestA;
  });

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const formatDate = (ts?: string) => {
    if (!ts) return "N/A";
    const date = new Date(ts);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 sticky top-0 z-50 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">FDE Slackbot</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>{sortedGroups.length} Issues</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {sortedGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No issues yet — waiting for messages from Slack...</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Issue</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Messages</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Updated</th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map(([groupId, msgs]) => {
                  const firstText = msgs[0].text.length > 60
                    ? msgs[0].text.slice(0, 60) + "..."
                    : msgs[0].text;

                  const groupTime = formatDate(msgs[msgs.length - 1].ts);
                  const isExpanded = expandedGroups.has(groupId);

                  return (
                    <>
                      <tr
                        key={groupId}
                        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleGroup(groupId)}
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">{firstText}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{msgs.length}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{groupTime}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={3} className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                                Messages
                              </div>
                              {msgs.map((m, idx) => (
                                <div key={m.id} className="bg-white border border-gray-200 rounded p-4">
                                  <div className="flex justify-between items-start gap-3 mb-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase">
                                      Message {idx + 1}
                                    </span>
                                    <span className="text-xs text-gray-500">{formatDate(m.ts)}</span>
                                  </div>
                                  <p className="text-sm text-gray-700 mb-2">{m.text}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Channel:</span>
                                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                                      {m.channel}
                                    </code>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
