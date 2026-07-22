<div align="center">

# Sentinel AI

### AI-powered emergency detection system for real-time personal safety

Detects distress speech, prepares SOS alerts with live location, and helps notify trusted contacts during emergencies.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql)

</div>

---

## Overview

Sentinel AI is an AI-powered emergency safety application that continuously monitors for distress speech and panic voice patterns. When an emergency is detected, it prepares an SOS alert containing the user's live location and audio transcript, helping notify trusted contacts quickly.

---

## Key Features

- AI-based distress keyword detection
- Panic voice monitoring
- Live GPS location retrieval
- Audio recording and transcription
- Automatic SOS message generation
- Emergency contact management
- SOS history tracking
- Secure authentication using Supabase
- Responsive user interface

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| Frontend | React, TypeScript, Vite, TanStack Router |
| Styling | Tailwind CSS |
| Backend | Supabase |
| Database | PostgreSQL |
| Browser APIs | Web Speech API, MediaRecorder API, Geolocation API |

---

## System Workflow

```text
User Enables Safety Mode
            │
            ▼
Microphone Monitoring
            │
            ▼
AI Detects Distress Speech
            │
            ▼
Fetch Live GPS Location
            │
            ▼
Record Audio Clip
            │
            ▼
Generate Transcript
            │
            ▼
SOS Countdown
            │
      Cancel / Confirm
            │
            ▼
Generate SOS Message
            │
            ▼
Open SMS Application
            │
            ▼
Store Event in Supabase
```

---

## Project Structure

```
src/
├── components/
├── hooks/
├── integrations/
├── lib/
├── routes/
└── styles/
```

---

## Installation

Clone the repository

```bash
git clone https://github.com/adarshk-ops/sentinel-ai.git
```

Navigate to the project

```bash
cd sentinel-ai
```

Install dependencies

```bash
npm install
```

Run the project

```bash
npm run dev
```

---

## Environment Variables

Create a `.env` file.

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

---


## Future Improvements

- AI emotion recognition
- Wearable device integration
- Offline emergency support
- Multi-language detection
- Emergency service integration
- Push notifications

---

## Author

**Adarsh K**

GitHub: https://github.com/adarshk-ops

---

<div align="center">

Built with React, TypeScript, and Supabase.

</div>
