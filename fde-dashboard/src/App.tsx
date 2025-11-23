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

  // ✅ Group tickets by group_id
  const groups: Record<string, Ticket[]> = tickets.reduce(
    (acc: Record<string, Ticket[]>, t: Ticket) => {
      if (!acc[t.group_id]) acc[t.group_id] = [];
      acc[t.group_id].push(t);
      return acc;
    },
    {}
  );

  // ✅ Sort groups by latest message time (optional)
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const latestA = new Date(a[1][a[1].length - 1].ts || "").getTime();
    const latestB = new Date(b[1][b[1].length - 1].ts || "").getTime();
    return latestB - latestA;
  });

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        FDE Slackbot Dashboard
      </h1>

      {sortedGroups.length === 0 && (
        <p className="text-gray-500">No tickets yet — waiting for messages...</p>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedGroups.map(([groupId, msgs]) => {
          // Use first message’s text as title (truncate if long)
          const firstText = msgs[0].text.length > 60
            ? msgs[0].text.slice(0, 60) + "..."
            : msgs[0].text;

          const latestType = msgs[msgs.length - 1].type;
          const groupTime = msgs[msgs.length - 1].ts
            ? new Date(msgs[msgs.length - 1].ts!).toLocaleString()
            : "";

          return (
            <div
              key={groupId}
              className="bg-white shadow-md rounded-2xl p-5 border border-gray-100 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold text-lg text-gray-800">
                  🧩 {firstText}
                </h2>
                <span className="text-sm text-gray-500">{latestType}</span>
              </div>

              <p className="text-xs text-gray-400 mb-3">Updated: {groupTime}</p>

              <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {msgs.map((m) => (
                  <li key={m.id} className="text-gray-700 text-sm">
                    • {m.text}
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-xs text-gray-400">
                Group ID: {groupId.slice(0, 8)}…
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
