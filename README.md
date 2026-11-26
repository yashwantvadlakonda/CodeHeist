# 🎮 CodeHeist – Beyond the Ordinary Puzzle Game

**Think Smart. Solve the Mystery. Beat the Challenge.**

CodeHeist is an immersive, interactive puzzle adventure game designed to challenge players through mysteries, logical reasoning, hidden clues, escape rooms and competitive brain battles.

Forget ordinary question-and-answer games. CodeHeist brings puzzles to life through engaging gameplay, animated environments, sound effects, time-based challenges and multiplayer competitions.

## 🌟 About the Project

The goal of CodeHeist is to make brain games more exciting, interactive and competitive.

Players explore mysterious rooms, discover hidden objects, solve challenging puzzles, unlock secret paths, collect rewards and compete with friends.

Whether you enjoy logical reasoning, visual challenges, riddles or solving mysteries, CodeHeist offers a variety of experiences.

## 🎯 Game Modes

### 🔍 Mystery Rooms
Explore mysterious environments, discover hidden clues, solve interconnected puzzles and uncover secrets.

### 🚪 Escape Challenge
Solve a series of challenging puzzles before time runs out. Every level introduces new obstacles and greater difficulty.

### 🧠 Brain Battle
Challenge other players in real-time multiplayer puzzle competitions. Think quickly, solve accurately and climb the leaderboard.

### 💎 Treasure Hunt
Follow mysterious clues, solve riddles, discover hidden objects and unlock valuable treasures.

### 📅 Daily Mystery
Take on a fresh daily challenge, maintain your streak and earn rewards for consistent participation.

## 🧩 Puzzle Categories

- Logical reasoning
- Visual pattern recognition
- Number sequences
- Riddles and word puzzles
- Hidden object discovery
- Memory challenges
- Shape and rotation puzzles
- Mathematical brain teasers
- Observation challenges
- Matching and arrangement puzzles
- Mystery investigations
- Spatial reasoning

## ✨ Key Features

- Interactive puzzle gameplay
- Multiple game modes
- Animated game environments
- Immersive background music
- Dynamic sound effects
- Countdown timers
- Hint system
- Progressive difficulty levels
- Player profiles and XP progression
- Achievements and rewards
- Daily challenges and streaks
- Global and weekly leaderboards
- Real-time multiplayer rooms
- Match history and player statistics
- Separate, protected administrator application

## 🎨 Gameplay Experience

CodeHeist focuses on making every interaction meaningful.

Players experience:
- Smooth transitions and animations.
- Correct and incorrect answer feedback.
- Puzzle-solving sound effects.
- Door unlocking and treasure reveal animations.
- Victory celebrations and level-up effects.
- Interactive challenges that reward observation and logical thinking.

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Game Frontend | React, Vite |
| UI and Styling | Tailwind CSS |
| Animations | Framer Motion |
| Backend | Node.js, Express |
| Real-time Communication | Socket.IO |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt |
| Version Control | Git, GitHub |

## 🏗️ Project Architecture

```text
CodeHeist/
│
├── game/
│   └── frontend/
│
├── admin/
│   └── frontend/
│
├── backend/
│
├── postgresql/
│   ├── migrations/
│   └── seeds/
│
├── README.md
└── .gitignore
```

- **Game Application:** Public-facing puzzle adventure experience.
- **Admin Application:** Separate application for managing puzzles, challenges and players.
- **Backend:** Handles authentication, game logic, scoring and multiplayer communication.
- **PostgreSQL:** Stores player information, puzzles, match records, rewards and progression.

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/CodeHeist.git
cd CodeHeist
```

Install backend dependencies:

```bash
cd backend
npm install
```

Configure your local `.env` file using `.env.example`.

Run database migrations and development seeds using the scripts defined in `backend/package.json`.

Start the backend:

```bash
npm run dev
```

Start the game frontend in another terminal:

```bash
cd game/frontend
npm install
npm run dev
```

Start the admin frontend separately:

```bash
cd admin/frontend
npm install
npm run dev
```

Check the actual configured ports in the project before opening the applications.

## 🔐 Security

- Passwords are hashed using bcrypt.
- Authentication is handled using JWT.
- Administrator access is protected by backend authorization.
- Environment variables are used for sensitive configuration.
- Player scores and rewards are validated by the server.
- PostgreSQL handles persistent application data.

## 🎯 Project Vision

CodeHeist aims to transform traditional puzzle-solving into an engaging gaming experience where intelligence, creativity, observation and quick thinking matter.

The objective is simple:

**Make players think, explore, compete and enjoy every challenge.**

## 📌 Project Status

Active Development 🚧

New puzzles, game modes, interactive environments and multiplayer experiences are being developed.

## 👨‍💻 Developed By

**Vadlakonda Yashwanth**

Built with creativity, logic and a passion for interactive gaming.

---

⭐ If you find CodeHeist interesting, consider starring the repository!
