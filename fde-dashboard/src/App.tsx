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
  username?: string; // ✅ new field
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

  // Group tickets by group_id
  const groups: Record<string, Ticket[]> = tickets.reduce(
    (acc: Record<string, Ticket[]>, t: Ticket) => {
      if (!acc[t.group_id]) acc[t.group_id] = [];
      acc[t.group_id].push(t);
      return acc;
    },
    {}
  );

  // Sort by latest message (newest first)
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const latestA = new Date(a[1][a[1].length - 1].ts || "").getTime();
    const latestB = new Date(b[1][b[1].length - 1].ts || "").getTime();
    return latestB - latestA;
  });

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) newExpanded.delete(groupId);
    else newExpanded.add(groupId);
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
            <p className="text-gray-500">
              No issues yet — waiting for messages from Slack...
            </p>
          </div>
        ) : (
          <div className="border border-gray-300 rounded-xl overflow-hidden divide-y-4 divide-gray-300">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Issue
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Messages
                  </th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map(([groupId, msgs]) => {
                  const firstMsgRaw = msgs[0].text;
                  const words = firstMsgRaw
                    .replace(/[^\w\s]/g, "")
                    .split(/\s+/)
                    .filter(Boolean);

                  const stopwords = new Set([
                    "oh","ohh","hmm","huh","okay","ok","yeah","yup","nope","alright",
                    "right","sure","hi","hello","thanks","thank","please","cool","great",
                    "awesome","nice","well","anyway","yep","no",
                    "the","a","an","is","are","was","were","be","been","to","for",
                    "on","in","of","and","or","with","we","you","i","it","need",
                    "some","help","can","should","could","would","also","just",
                    "want","like","there","this","that","again","doesnt","not",
                    "from","about","have","has","had","get","got","do","did","does"
                  ]);

                  const filtered = words.filter(
                    (w) => w.length > 3 && !stopwords.has(w.toLowerCase())
                  );

                  const technicalKeywords = filtered.filter((w) =>
                    /(api|login|backend|frontend|server|infra|infrastructure|database|export|timeout|crash|error|feature|support|deploy|button|mobile|auth|endpoint|integration|performance|latency|pipeline|cloud|aws|gcp|azure)/i.test(w)
                  );

                  const businessKeywords = filtered.filter((w) =>
                    /(procurement|finance|invoice|vendor|compliance|sales|operations|payment|contract|report|approval|audit|budget|inventory|crm|erp|hr|human|resources|supply|chain|customer|billing|data|policy|dashboard|security|governance|accounting|marketing|analytics|legal)/i.test(w)
                  );

                  const properNouns = words.filter(
                    (w) => /^[A-Z]/.test(w) && !stopwords.has(w.toLowerCase())
                  );

                  const combined = Array.from(
                    new Set([...properNouns, ...businessKeywords, ...technicalKeywords])
                  );

                  let issueTitle = "";
                  if (combined.length > 0) {
                    issueTitle = combined.slice(0, 4).join(" ");
                  } else if (filtered.length > 0) {
                    issueTitle = filtered.slice(0, 3).join(" ");
                  } else {
                    issueTitle = firstMsgRaw.slice(0, 60);
                  }

                  issueTitle =
                    issueTitle.charAt(0).toUpperCase() + issueTitle.slice(1);

                  const groupTime = formatDate(msgs[msgs.length - 1].ts);
                  const isExpanded = expandedGroups.has(groupId);

                  return (
                    <>
                      <tr
                        key={groupId}
                        className="border-t-4 border-gray-300 hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => toggleGroup(groupId)}
                      >
                        <td className="px-6 py-4 text-base text-gray-900 font-bold tracking-wide">
                          {issueTitle || "General inquiry"}
                          <p className="text-xs text-gray-500 truncate mt-1 italic">
                            “{msgs[0].text.slice(0, 60)}...”
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{msgs.length}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{groupTime}</td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-gray-50 animate-fadeIn">
                          <td colSpan={3} className="px-6 py-5">
                            <div className="space-y-4">
                              <h3 className="text-sm font-semibold text-blue-600 mb-2">
                                Issue context: {issueTitle}
                              </h3>
                              <div className="border-l-4 border-blue-200 pl-4 text-gray-600 text-sm italic">
                                "{msgs[0].text}"
                              </div>

                              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mt-4">
                                Messages
                              </div>

                              {msgs.map((m, idx) => (
                                <div
                                  key={m.id}
                                  className="bg-white border-2 border-gray-400 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow"
                                >
                                  <div className="flex justify-between items-start gap-3 mb-2">
                                    <div>
                                      <span className="text-xs font-semibold text-gray-600 uppercase">
                                        Message {idx + 1}
                                      </span>
                                      <p className="text-xs text-gray-500 italic">
                                        Sent by: {m.username || "Unknown"}
                                      </p>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {formatDate(m.ts)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-800 mb-2">{m.text}</p>
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
