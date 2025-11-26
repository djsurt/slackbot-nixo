from fastapi import FastAPI, Request
from utils import classify_message
from datetime import datetime, timedelta, timezone
from embeddings import get_embedding, cosine_similarity
from supabase import create_client
import os
from dotenv import load_dotenv
from openai import OpenAI
import uuid
from functools import lru_cache
from slack_sdk import WebClient
import redis

load_dotenv()
app = FastAPI()


redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
slack_client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

def generate_issue_title(message_text: str) -> str:
    """Generate a concise, descriptive title for an issue using GPT."""
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that creates concise, descriptive titles (3-5 words) for support issues. The title should capture the main problem or topic. Return only the title, nothing else."
                },
                {
                    "role": "user",
                    "content": f"Create a short, descriptive title for this issue: {message_text}"
                }
            ],
            temperature=0.7,
            max_tokens=20
        )
        title = response.choices[0].message.content.strip()
        title = title.strip('"').strip("'")
        return title
    except Exception as e:
        print(f"Error generating title with GPT: {e}")
        words = message_text.split()[:3]
        return " ".join(words).capitalize()

def is_duplicate_event(event_id: str) -> bool:
    key = f"slack_event:{event_id}"
    try:
        if redis_client.exists(key):
            return True
        # Store the event ID with a TTL (e.g., 24 hours)
        redis_client.setex(key, 86400, "1")
        return False
    except Exception as e:
        print(f"Redis Connection error: {e}")
        #Fallbac to allow processing(or use another deduplication mechanism)
        return False


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


def assign_group(new_text, new_embedding, ts, thread_ts=None):
    """Assign a group_id to a message using Supabase queries."""
    # Same thread → same group
    if thread_ts:
        thread_dt = datetime.fromtimestamp(float(thread_ts)).isoformat()
        result = supabase.table("tickets").select("group_id, group_title").eq("ts", thread_dt).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["group_id"], False, result.data[0].get("group_title")

    # Fetch all tickets from Supabase
    result = supabase.table("tickets").select("*").execute()
    tickets = result.data
    
    strong_similarity = 0.7
    time_similarity = 0.4
    time_threshold = timedelta(minutes=2)

    best_match = None
    best_score = 0

    for ticket in tickets:
        if not ticket.get("embedding"):
            continue
        
        sim = cosine_similarity(new_embedding, ticket["embedding"])
        ticket_ts = datetime.fromisoformat(ticket["ts"].replace("Z", "")).replace(tzinfo=None)
        time_diff = abs((ts - ticket_ts).total_seconds())
        
        # High similarity - group regardless of time
        if sim >= strong_similarity and sim > best_score:
            best_match, best_score = ticket, sim
        # Within time window (1-2 minutes) and has some similarity
        elif time_diff <= time_threshold.total_seconds() and sim >= time_similarity and sim > best_score:
            best_match, best_score = ticket, sim
    
    if best_match:
        return best_match["group_id"], False, best_match.get("group_title")
    
    # New group
    return str(uuid.uuid4()), True, None

@app.post("/slack/events")
async def slack_events(request: Request):
    body = await request.json()
    print("Received Slack event:", body)

    # Slack URL verification (important step)
    if "challenge" in body:
        return {"challenge": body["challenge"]}

    # Prevent duplicate event processing
    event_id = body.get("event_id")
    if is_duplicate_event(event_id):
        print(f"Duplicate event {event_id}, skipping...")
        return {"ok": True}
    
    # Example: print only message events
    event = body.get("event", {})
    text = event.get("text", "")
    ts_str = event.get("ts", "")
    # Slack timestamps are in UTC, convert to UTC datetime
    ts = datetime.fromtimestamp(float(ts_str), tz=timezone.utc).replace(tzinfo=None) if ts_str else datetime.utcnow()
    channel = event.get("channel", "")
    user_id = event.get("user")

    username = get_slack_username(user_id) if user_id else "Unknown User"
    print(f"\n\n\nMessage from {username}: {text}")
    category, score = classify_message(text)
    print(f"\n\n\n\nClassified message as {category} with score {score}")
    if category != "irrelevant":
        embedding = get_embedding(text)
        print(f"\n\n\nGenerated embedding of length {len(embedding)}")
        
        group_id, is_new_group, existing_title = assign_group(text, embedding, ts, event.get("thread_ts"))
        
        # Generate title for new groups
        group_title = existing_title
        if is_new_group:
            print(f"\n\n\nNew group detected, generating title with GPT...")
            group_title = generate_issue_title(text)
            print(f"Generated title: {group_title}")
        
        # Create ticket data
        ticket_data = {
            "id": str(uuid.uuid4()),
            "text": text,
            "channel": channel,
            "type": category,
            "relevance_score": score,
            "group_id": group_id,
            "group_title": group_title,
            "embedding": embedding,
            "ts": ts.isoformat(),
            "username": username
        }
        
        try:
            # Save directly to Supabase
            supabase.table("tickets").insert(ticket_data).execute()
            print(f"Saved ticket {ticket_data['id']} to Supabase.")
        except Exception as e:
            print(f"Error saving ticket: {e}")

    return {"ok": True}
