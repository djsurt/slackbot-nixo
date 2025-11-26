// src/App.tsx
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Navbar from "./components/Navbar";
import IssueCard from "./components/IssueCard";

interface Ticket {
  id: string;
  text: string;
  channel: string;
  type: string;
  relevance_score: number;
  group_id: string;
  group_title?: string; // Add this
  username?: string;
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
      timeZone: "America/Los_Angeles",
    });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F6" }}>
      {/* Header */}
      <Navbar title="FDE Slackbot" activeIssuesCount={sortedGroups.length} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {sortedGroups.length === 0 ? (
          <div className="text-center py-24">
            <div className="max-w-md mx-auto">
              <p className="text-lg text-slate-600 font-medium">
                No issues yet — waiting for messages from Slack
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Your dashboard will populate automatically
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroups.map(([groupId, msgs]) => {
              // Use GPT-generated title or fallback
              const issueTitle = msgs[0].group_title || msgs[0].text.slice(0, 60);
              const isExpanded = expandedGroups.has(groupId);

              return (
                <IssueCard
                  key={groupId}
                  groupId={groupId}
                  issueTitle={issueTitle}
                  messages={msgs}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(groupId)}
                  formatDate={formatDate}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
