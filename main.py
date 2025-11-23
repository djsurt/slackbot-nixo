from fastapi import FastAPI, Request
from utils import classify_message
from models import Ticket
from database import SessionLocal, engine, Base
from datetime import datetime, timedelta
from embeddings import get_embedding, cosine_similarity
from supabase import create_client
import os
from dotenv import load_dotenv
import uuid
from functools import lru_cache

load_dotenv()
app = FastAPI()

from slack_sdk import WebClient

slack_client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))

@lru_cache(maxsize=100)
def get_slack_username(user_id: str) -> str:
    """Fetch and cache Slack usernames for display."""
    try:
        resp = slack_client.users_info(user=user_id)
        if resp["ok"]:
            return resp["user"]["real_name"]
    except Exception as e:
        print("Error fetching username:", e)
    return "Unknown User"

# Store processed event IDs to prevent duplicates
processed_events = set()

#TODO: People might be talking about the same issue in a different channel too.
def assign_group(db, new_text, new_embedding, ts, thread_ts=None):
    # 1️⃣ Same thread → same group
    if thread_ts:
        parent_ticket = db.query(Ticket).filter(Ticket.ts == thread_ts).first()
        if parent_ticket:
            return parent_ticket.group_id

    # 2️⃣ Compare with all tickets (cross-channel)
    tickets = db.query(Ticket).all()
    strong_similarity = 0.7
    weak_similarity = 0.5
    time_threshold = timedelta(minutes=15)

    best_match = None
    best_score = 0

    for t in tickets:
        if not t.embedding:
            continue
        sim = cosine_similarity(new_embedding, t.embedding)
        time_diff = abs((ts - t.ts).total_seconds())
        # Word similarity
        if sim >= strong_similarity and sim > best_score:
            best_match, best_score = t, sim
        # Time based similarity
        elif sim >= weak_similarity and time_diff < time_threshold.total_seconds() and sim > best_score:
            best_match, best_score = t, sim
    
    if best_match:
        return best_match.group_id
    # 3️⃣ Otherwise, make new group
    return str(uuid.uuid4())

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


def save_ticket_to_supabase(ticket_data):
    supabase.table("tickets").insert(ticket_data).execute()
    print(f"Saved ticket {ticket_data['id']} to Supabase.")

Base.metadata.create_all(bind=engine)
@app.post("/slack/events")
async def slack_events(request: Request):
    body = await request.json()
    print("Received Slack event:", body)

    # Slack URL verification (important step)
    if "challenge" in body:
        return {"challenge": body["challenge"]}

    # Prevent duplicate event processing
    event_id = body.get("event_id")
    if event_id in processed_events:
        print(f"Duplicate event {event_id}, skipping...")
        return {"ok": True}
    
    processed_events.add(event_id)

    # Example: print only message events
    event = body.get("event", {})
    text = event.get("text", "")
    ts_str = event.get("ts", "")
    ts = datetime.fromtimestamp(float(ts_str)) if ts_str else datetime.utcnow()
    channel = event.get("channel", "")
    user_id = event.get("user")

    username = get_slack_username(user_id) if user_id else "Unknown User"
    print(f"\n\n\nMessage from {username}: {text}")
    category, score = classify_message(text)
    print(f"\n\n\n\nClassified message as {category} with score {score}")
    if category != "irrelevant":
        db = SessionLocal()
        embedding = get_embedding(text)
        print(f"\n\n\nGenerated embedding of length {len(embedding)}")
        group_id = assign_group(db, text, embedding, ts, event.get("thread_ts"))
        ticket = Ticket(
            text=text,
            channel=channel,
            type=category,
            relevance_score=score,
            group_id=group_id,
            embedding=embedding,
            ts=ts,
            username=username
        )
        try:
            db.add(ticket)
            db.commit()
            # Create a dictionary with ticket data before closing the session
            ticket_data = {
                "id": ticket.id,
                "text": ticket.text,
                "channel": ticket.channel,
                "type": ticket.type,
                "relevance_score": ticket.relevance_score,
                "group_id": ticket.group_id,
                "username": ticket.username
            }
        except Exception as e:
            print(f"Error saving ticket: {e}")
            db.rollback()
            ticket_data = None
        finally:
            db.close()
        
        if ticket_data:
            save_ticket_to_supabase(ticket_data)
    return {"ok": True}
