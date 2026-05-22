# DevTrackr

> AI-powered developer productivity dashboard for GitHub repositories.

DevTrackr is a full-stack analytics platform that helps developers and teams understand how their projects are moving. After connecting a GitHub account, users can track repositories, sync activity data, generate AI insights, and review productivity metrics through a modern dashboard experience.

This project was built around the idea that raw GitHub activity is useful, but interpreted activity is far more valuable. DevTrackr turns commits, pull requests, issues, and contributor behavior into sprint summaries, health signals, bottleneck warnings, and actionable recommendations.

## Why DevTrackr?

Developers often jump between GitHub, notes, and dashboards just to answer simple questions:

- Are we shipping consistently?
- Which repositories are healthy and which are slowing down?
- Are pull requests getting merged fast enough?
- Are contributors going inactive?
- What should the team prioritize next?

DevTrackr answers those questions in one place by combining GitHub analytics with AI-generated interpretation.

## Core Highlights

- Secure authentication with JWT and bcrypt-backed password hashing
- GitHub account connection using a personal access token
- Repository discovery and selective tracking
- One-click repository sync for commits, PRs, issues, and contributors
- Analytics engine that computes productivity and health scores
- AI-generated sprint summaries and productivity insights
- Bottleneck detection and actionable recommendations
- Contributor activity monitoring with inactive contributor detection
- Interactive frontend dashboard with custom visual analytics
- Cached AI insight generation to reduce repeated LLM calls

## What Is Implemented

### Authentication
- User registration and login
- Protected routes with JWT middleware
- Profile fetch and profile update
- Rate limiting on auth routes

### GitHub Integration
- Connect GitHub account from inside the app
- Fetch authenticated user's repositories
- Track and untrack repositories
- Sync repository activity into MongoDB

### Analytics Engine
- Commit trend analysis
- Monthly and daily commit breakdown
- Pull request analytics
- Issue analytics
- Contributor analytics
- Productivity score calculation
- Project health score calculation
- Inactive contributor detection
- Activity feed generation

### AI Insights
- Sprint summary generation
- Productivity analysis
- Bottleneck detection
- Risk analysis
- Task and process recommendations
- Cached insights with expiry support

### Dashboard Experience
- Overview dashboard for all tracked repositories
- Repository-level detailed analytics
- Custom chart components for commit rhythm and activity
- Repository sync status and insight generation flows

## Tech Stack

### Frontend
- React 19
- Vite
- Tailwind CSS 4
- Custom SVG/CSS chart components

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- bcryptjs
- GitHub REST API
- Groq LLM API using `llama-3.3-70b-versatile`

## Architecture Overview

```text
Frontend (React + Vite)
    |
    v
Express API
    |
    +-- Auth Module
    +-- GitHub Integration Module
    +-- Analytics Engine
    +-- AI Insight Generator
    |
    v
MongoDB
```

## Project Flow

```text
1. User signs up or logs in
2. User connects a GitHub personal access token
3. DevTrackr fetches available repositories
4. User chooses repositories to track
5. Backend syncs commits, PRs, issues, and contributors
6. Analytics engine computes metrics and scores
7. AI layer generates summaries, risks, and recommendations
8. User explores the dashboard and repository insights
```

## Repository Structure

```text
DevTrackr/
|-- backend/
|   |-- src/
|   |   |-- analytics/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- models/
|   |   |-- prompts/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   `-- validators/
|   `-- server.js
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- assets/
|       |-- App.jsx
|       |-- index.css
|       `-- main.jsx
`-- README.md
```

## Key Backend Modules

### `auth`
Handles registration, login, current user session, and profile updates.

### `github`
Connects GitHub accounts, fetches repositories, and syncs repository activity.

### `analytics`
Transforms raw GitHub activity into computed metrics such as:

- total commits
- total pull requests
- total issues
- average merge time
- average issue resolution time
- commit frequency
- inactive contributors
- productivity score
- health score

### `ai`
Uses LLM prompts to generate:

- sprint summaries
- productivity insights
- bottlenecks
- recommendations
- risk analysis

## Data Models

The backend persists four main entities:

- `User` - account info, hashed password, GitHub identity, tracked repositories
- `Repository` - tracked GitHub repository metadata and sync state
- `Analytics` - stored commits, PRs, issues, contributors, heatmap data, metrics
- `AIInsights` - generated summaries, recommendations, bottlenecks, and risks

## API Overview

### Auth Routes
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

### GitHub Routes
- `POST /api/github/connect`
- `GET /api/github/repos`
- `GET /api/github/repos/tracked`
- `POST /api/github/repos/track`
- `DELETE /api/github/repos/:repoId`
- `POST /api/github/sync/:repoId`

### Analytics Routes
- `GET /api/analytics/:repoId`
- `GET /api/analytics/:repoId/metrics`
- `GET /api/analytics/:repoId/commits`
- `GET /api/analytics/:repoId/prs`
- `GET /api/analytics/:repoId/issues`
- `GET /api/analytics/:repoId/contributors`

### AI Routes
- `POST /api/ai/generate/:repoId`
- `GET /api/ai/insights/:repoId`
- `GET /api/ai/insights/:repoId/recommendations`
- `GET /api/ai/insights/:repoId/bottlenecks`

### Dashboard Routes
- `GET /api/dashboard/overview`
- `GET /api/dashboard/repo/:repoId`

## Setup Instructions

### 1. Clone the project

```bash
git clone <your-repository-url>
cd "PEP CLASS TEST"
```

### 2. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Configure environment variables

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=your_groq_api_key
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Run the backend

```bash
cd backend
node server.js
```

Optional development mode:

```bash
npx nodemon server.js
```

### 5. Run the frontend

```bash
cd frontend
npm run dev
```

### 6. Open the app

Visit:

```text
http://localhost:5173
```

## GitHub Token Notes

To connect GitHub from the app, generate a GitHub personal access token and paste it into the GitHub connection screen after logging in.

Recommended access depends on what you want to analyze:

- Public repositories: basic repository read access
- Private repositories: `repo` access

## Security and Engineering Notes

- Passwords are hashed before storage
- JWT secures protected API routes
- Sensitive GitHub token fields are excluded from default model queries
- Helmet is enabled for safer HTTP headers
- CORS is configured for known frontend origins
- API rate limiting is enabled globally and more strictly on auth endpoints
- AI results are cached for 6 hours to reduce repeated model calls

## What Makes This Project Stand Out

- It does not stop at data collection; it interprets team activity using AI
- It combines repository analytics and human-readable recommendations in one product
- It tracks both performance signals and risk signals
- It uses a clean modular backend structure that is easy to extend
- It already includes a real end-to-end workflow from signup to actionable insight

## Current Limitations

- Export to PDF is not implemented yet
- Commit-level additions and deletions are currently stored as `0` because detailed per-commit enrichment is skipped for performance
- The frontend uses custom chart components instead of Chart.js/Recharts
- Backend `package.json` does not yet include polished `dev` or `start` scripts

## Future Enhancements

- PDF report export
- Team-based multi-user workspaces
- Advanced contributor comparison views
- Historical sprint-to-sprint AI benchmarking
- Slack or email summaries
- Chart.js or Recharts integration for more chart variety
- CI/CD and automated testing

## Conclusion

DevTrackr is more than a dashboard. It is a developer intelligence platform that transforms GitHub activity into meaningful decisions. By combining repository analytics, contributor monitoring, productivity scoring, and AI-generated recommendations, the project delivers both technical depth and real product value.

If the goal is to build a project that feels practical, modern, and presentation-worthy, DevTrackr delivers exactly that.
