# slackbot-nixo

## Prerequisites

- Python 3.9+
- Node.js 18+
- ngrok (for local Slack webhook testing)
- Slack workspace with admin access
- Supabase account
- OpenAI API key

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd slackbot-nixo
```

### 2. Backend Setup

#### 2.1 Create Python Virtual Environment

```bash
python3 -m venv nixoenv
source nixoenv/bin/activate  # On macOS/Linux
# or
nixoenv\Scripts\activate  # On Windows
```

#### 2.2 Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### 2.3 Configure Environment Variables
Create the following `.env` variable at the root:
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```
#### 2.4 Set Up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Create a `tickets` table with the following schema:

```sql
CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  text TEXT,
  channel TEXT,
  type TEXT,
  relevance_score TEXT,
  group_id TEXT,
  username TEXT,
  ts TIMESTAMP DEFAULT NOW()
);
```

![Supabase Schema](media/supabase_schema.png)

3. Enable real-time subscriptions for the tickets table:

![Enable Real-time in Supabase](media/things_to_enable_supabase.png)

4. Copy your Supabase URL and service role key to the `.env` file. 
Note: The Supabase URL is just https://your_project_id.supabase.co
Another note: I'm using the Legacy Keys here.
### 3. Slack App Configuration

#### 3.1 Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "FDE Issue Tracker") and select your workspace

#### 3.2 Configure Bot Permissions

Navigate to **OAuth & Permissions** and add these Bot Token Scopes:
- `channels:history`
- `channels:read`
- `chat:write`
- `groups:history`
- `groups:read`
- `users:read`

![Slack OAuth Configuration](media/SlackOAuthConfig.png)

#### 3.3 Install App to Workspace

1. Click "Install to Workspace"
2. Copy the **Bot User OAuth Token** (starts with `xoxb-`) to the `.env` file

#### 3.4 Enable Event Subscriptions

1. Navigate to **Event Subscriptions**
2. Set Request URL: `https://your-ngrok-url.ngrok.io/slack/events` (see step 4 for ngrok setup)
3. Toggle "Enable Events" to ON
4. Subscribe to bot events:
   - `message.channels`
5. Save changes

![Event Subscriptions Configuration](media/EventSubscriptions.png)

### 4. Start the Backend Server

#### 4.1 Start ngrok (for local development)

In a new terminal:

```bash
ngrok http 8000
```

Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) and update your Slack app's Event Subscriptions Request URL to `https://abc123.ngrok.io/slack/events`

#### 4.2 Start FastAPI Server

```bash
# Make sure your virtual environment is activated
source nixoenv/bin/activate

# Start the server
uvicorn main:app --reload --port 8000
```

The backend will be running at `http://localhost:8000`

### 5. Frontend Setup

#### 5.1 Navigate to Dashboard Directory

```bash
cd fde-dashboard
```

#### 5.2 Install Node Dependencies

```bash
npm install
```

#### 5.3 Configure Frontend Environment Variables

Create a `.env` file in the `fde-dashboard` directory:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 5.4 Start Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## Usage

### Testing the Bot

1. Invite the bot to a Slack channel: `/invite @FDE Issue Tracker`
2. Send a message in the channel (e.g., "The login button is broken")
3. The bot will:
   - Classify the message (bug, feature, support, question, or irrelevant)
   - Generate an embedding for similarity matching
   - Group it with related messages
   - Store it in Supabase
4. View the issue in real-time on the dashboard

### Dashboard Features

- **Real-time Updates**: New issues appear instantly via Supabase subscriptions
- **Issue Grouping**: Similar messages are automatically grouped together
- **Expandable Details**: Click any row to see all messages in that group

## Development
This is what my file structure looked like:
![File Structure](media/File_Struct_1.png)
![File Structure2](media/File_Struct_2.png)

## Troubleshooting

### Backend Issues

**Bot not receiving messages:**
- Verify ngrok is running and URL is updated in Slack app
- Check that the bot is invited to the channel
- Verify `SLACK_BOT_TOKEN` in `.env` is correct

**Database errors:**
- Ensure Supabase table schema matches the model
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct

**Classification errors:**
- Check `OPENAI_API_KEY` is valid and has credits
- Review logs for OpenAI API errors

### Frontend Issues

**Dashboard not showing data:**
- Verify Supabase credentials in frontend `.env`
- Check browser console for errors
- Ensure real-time subscriptions are enabled on the `tickets` table

**Real-time updates not working:**
- Confirm `ALTER PUBLICATION supabase_realtime ADD TABLE tickets;` was run
- Check Supabase project settings for real-time enabled

