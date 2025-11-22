from fastapi import FastAPI, Request
from utils import classify_message
from models import Ticket
from database import SessionLocal, engine, Base
app = FastAPI()

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
        ticket = Ticket(
            text=text,
            channel=channel,
            type=category,
            relevance_score=score,
        )
        try:
            db.add(ticket)
            db.commit()
        finally:
            db.close()
    return {"ok": True}
