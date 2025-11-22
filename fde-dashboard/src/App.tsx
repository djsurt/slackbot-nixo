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
  console.log("SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);

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
    console.log("Tickets:", data, "Error:", error);
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

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold">FDE Slackbot Dashboard</h1>
      {Object.entries(groups).map(([groupId, msgs]) => (
        <div key={groupId} className="bg-white shadow rounded-2xl p-4">
          <h2 className="font-semibold text-lg mb-2">
            Group: {msgs[0].type.toUpperCase()}
          </h2>
          <ul className="space-y-1">
            {msgs.map((m) => (
              <li key={m.id} className="text-gray-700">
                • {m.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
