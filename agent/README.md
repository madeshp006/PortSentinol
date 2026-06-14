# PortSentinel Local Network Agent

The PortSentinel Local Network Agent is a lightweight Node.js worker designed to reside inside private networks (RFC1918). It polls the PortSentinel SaaS platform for scheduled and on-demand internal scan requests, executes the connect-scan checks locally, and updates findings directly.

## Installation & Setup

### Requirements
- Node.js (v18.0.0 or higher recommended)
- Access to the internet to reach your PortSentinel SaaS platform backend

### Quickstart

1. **Install Dependencies**:
   - On Windows: Double-click `install.bat` or run:
     ```bash
     npm install
     ```
   - On Linux/macOS:
     ```bash
     npm install
     ```

2. **Configure & Start**:
   - Start the agent in interactive mode:
     ```bash
     npm start
     ```
   - On first run, it will prompt you for:
     - The backend API URL (e.g. `http://localhost:5000`)
     - Your developer API token (obtainable from Profile -> Developer Settings on the web panel)
     - A custom friendly name for this agent

Once registered, credentials will be saved locally to `~/.portsentinel/agent.json` and the agent will begin heartbeating and checking for work every 10 seconds.

## Environment Variables

Alternatively, you can run in a headless, non-interactive environment (like Docker or CI/CD pipelines) by creating a `.env` file or exporting environment variables:

```ini
PORT_SENTINEL_URL=http://localhost:5000
PORT_SENTINEL_API_KEY=your_developer_api_key
```

When these variables are present, the agent automatically bypasses the interactive questions and registers silently with default values.
