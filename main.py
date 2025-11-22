from fastapi import FastAPI, Request
from utils import classify_message
from models import Ticket
from database import SessionLocal, engine, Base
app = FastAPI()
from embeddings import get_embedding, cosine_similarity
from supabase import create_client
import os
from dotenv import load_dotenv
import uuid
load_dotenv()

#TODO: People might be talking about the same issue in a different channel too.
def assign_group(db, new_text, new_embedding, channel, thread_ts=None):
    # 1️⃣ Same thread → same group
    if thread_ts:
        return thread_ts

    # 2️⃣ Compare to existing tickets in the same channel
    tickets = db.query(Ticket).filter(Ticket.channel == channel).all()
    threshold = 0.7
    for t in tickets:
        if not t.embedding:
            continue
        sim = cosine_similarity(new_embedding, t.embedding)
        if sim > threshold:
            return t.group_id  # Same issue
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

    # Example: print only message events
    event = body.get("event", {})
    text = event.get("text", "")
    channel = event.get("channel", "")
    category, score = classify_message(text)
    print(f"\n\n\n\nClassified message as {category} with score {score}")
    if category != "irrelevant":
        db = SessionLocal()
        embedding = get_embedding(text)
        print(f"\n\n\nGenerated embedding of length {len(embedding)}")
        group_id = assign_group(db, text, embedding, channel, event.get("thread_ts"))
        ticket = Ticket(
            text=text,
            channel=channel,
            type=category,
            relevance_score=score,
            group_id=group_id,
            embedding=embedding
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
                "group_id": ticket.group_id
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
