from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/slack/events")
async def slack_events(request: Request):
    body = await request.json()
    print("Received Slack event:", body)

    # Slack URL verification (important step)
    if "challenge" in body:
        return {"challenge": body["challenge"]}

    # Example: print only message events
    event = body.get("event", {})
    if event.get("type") == "message":
        user = event.get("user")
        text = event.get("text")
        print(f"Message from {user}: {text}")

    return {"ok": True}
