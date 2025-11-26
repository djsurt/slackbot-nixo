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
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6' }}>
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
