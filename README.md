# InterviewCo-Pilot

AI-assisted real-time interview co-pilot for Google Meet. This repository contains the **Chrome Extension (Manifest V3)** and the **Node.js/Express backend server**.

---

## 📁 Repository Structure

```
InterviewCo-Pilot/
├── extension/                 # Manifest V3 Chrome Extension
│   ├── manifest.json          # Extension Manifest configuration
│   ├── background/
│   │   └── background.js      # Service worker for lifecycle & messaging
│   ├── content/
│   │   ├── content.js         # Content script injected into Google Meet
│   │   └── content.css        # Injected sidebar styles
│   ├── popup/
│   │   ├── popup.html         # Extension action popup UI
│   │   ├── popup.css          # Popup styling
│   │   └── popup.js           # Popup logic & server health checker
│   └── icons/                 # Extension icon assets (16x16, 48x48, 128x128)
├── server/                    # Express.js Backend API
│   ├── .env                   # Local environment variables (not committed)
│   ├── .env.example           # Environment template
│   ├── package.json           # Backend dependencies and scripts
│   └── server.js              # Express app & /health endpoint
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Running the Backend Server

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` if you haven't already:
   ```bash
   # On Windows PowerShell
   Copy-Item .env.example .env

   # On Linux/macOS
   cp .env.example .env
   ```

4. **Start the server:**
   - For development (with hot reload via nodemon):
     ```bash
     npm run dev
     ```
   - For standard start:
     ```bash
     npm start
     ```

5. **Verify the server is running:**
   Open your browser or run:
   ```bash
   curl http://localhost:5000/health
   ```
   You should see:
   ```json
   {
     "status": "ok",
     "service": "interview-copilot-backend",
     "timestamp": "...",
     "port": 5000
   }
   ```

---

### 2. Loading the Unpacked Extension in Google Chrome

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Toggle **Developer mode** in the top right corner.
3. Click the **Load unpacked** button in the top left.
4. Select the `extension/` directory from this project (`InterviewCo-Pilot/extension`).
5. The **InterviewCo-Pilot** extension will appear in your extensions list.

---

### 3. Testing the Setup

- **Popup Test:**
  Click the **InterviewCo-Pilot** icon in your Chrome toolbar. It will check connection to `http://localhost:5000/health` and display **Online** when the backend is running.
- **Google Meet Injected Sidebar:**
  Navigate to any Google Meet call or [meet.google.com](https://meet.google.com). The co-pilot overlay sidebar will be injected on the right side with a minimize/expand toggle.
