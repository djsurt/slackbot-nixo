from dotenv import load_dotenv
import os
from openai import OpenAI
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
CATEGORIES = ["bug", "feature", "support", "question", "irrelevant"]

def classify_message(msg_text: str):
    """Return (category, relevance_score) tuple."""
    prompt = f"""
    Classify this Slack message into one of the following categories for a Forward Deployed Engineer:
    {', '.join(CATEGORIES)}.

    Message: "{msg_text}"
    Only respond with the category name and a confidence score (0-1) in JSON.
    """

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    
    clean = response.choices[0].message.content.replace("```json", "").replace("```", "").strip()

    try:
        import json
        data = json.loads(clean)
        return data["category"], data.get("confidence", 1.0)
    except Exception as e:
        print(f"Error classifying message: {e}")
        return "irrelevant", 0