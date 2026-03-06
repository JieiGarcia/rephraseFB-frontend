# rephraseFB

A real-time writing assistant for Japanese L2 learners studying English. This application detects Japanese characters in real-time, shows suggestion buttons (💡) next to mixed sentences, and provides AI-powered English suggestions through Gemini API integration.

## Features

- **Real-time Japanese Detection**: Automatically detects Japanese characters and mixed sentences
- **AI-Powered Suggestions**: Uses Google Gemini API to provide context-aware English suggestions
- **Two Task Modes**:
  - Control mode (no assistance)
  - Experimental mode (with AI assistance)
- **User Analytics**: Tracks suggestion interactions for research purposes
- **Responsive Design**: Clean, document-style writing interface

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Convex (serverless functions and database)
- **AI**: Google Gemini 2.5 Flash API
- **Styling**: Inline CSS with responsive design

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rephraseFB
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_ai_api_key_here
   ```

   The Convex deployment URL will be automatically configured when you run the dev server.

4. **Start the development servers**

   Start both the frontend and Convex backend:
   ```bash
   # Terminal 1: Start Convex dev server
   npx convex dev

   # Terminal 2: Start React dev server
   npm run dev
   ```

   The app will be available at `http://localhost:5173` (or another port if 5173 is occupied).

## Project Structure

```
rephraseFB/
├── src/
│   ├── components/
│   │   ├── WritingArea.tsx     # Main writing component with real-time analysis
│   │   ├── AuthPage.tsx        # User authentication
│   │   └── TaskSelection.tsx   # Task condition selection
│   ├── App.tsx                 # Main application component
│   └── main.tsx               # Application entry point
├── convex/
│   ├── schema.ts              # Database schema definition
│   ├── tasks.ts               # User and task management functions
│   └── suggestions.ts         # AI suggestion functions
├── legacy/
│   └── logic.js               # Reference implementation
└── public/                    # Static assets
```

## How It Works

### User Flow

1. **Authentication**: Users enter their user ID (e.g., "0001", "P001")
2. **Task Selection**: Choose between Control (no assistance) or Experimental (with AI assistance)
3. **Writing Session**:
   - In Experimental mode, mixed sentences trigger 💡 buttons
   - Clicking buttons shows AI suggestions in popups
   - English sentences may show colored underlines for improvements
4. **Submission**: Users submit their final text for research data collection

### Technical Architecture

#### Text Analysis Pipeline
- Japanese detection using Unicode regex: `/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/`
- Sentence extraction supporting both English (.!?) and Japanese (。！？) punctuation
- Three-tier categorization: English-only (analyzed), mixed sentences (excluded), incomplete Japanese (excluded)

#### State Management
- React hooks (useState, useRef, useCallback) with legacy-style global variables for immediate access
- Debounced analysis prevents excessive API calls (700ms for append, 3000ms for edits)

#### AI Integration
- Convex actions with Google Generative AI SDK
- Context-aware prompting for Japanese learners
- Unique tracking IDs for duplicate prevention and precise analytics

#### Database Schema
- **users**: Stores external user IDs with internal Convex IDs
- **tasks**: Tracks task conditions (control/experimental) and final submissions
- **suggestions**: Logs all suggestion interactions with tracking IDs and categories

## Development Commands

```bash
# Development
npm run dev          # Start development server (Vite with HMR)
npm run build        # Build for production (includes TypeScript check)
npm run lint         # Run ESLint
npm run preview      # Preview production build

# Convex Backend
npx convex dev       # Start Convex development server
npx convex deploy    # Deploy to production
npx convex logs      # View function logs
```

## Environment Variables

Required environment variables in `.env.local`:

- `GEMINI_API_KEY`: Google AI API key for Gemini integration
- `CONVEX_DEPLOYMENT`: Convex deployment URL (auto-configured)
- `VITE_CONVEX_URL`: Frontend Convex URL (auto-configured)

## Deployment

### Convex Backend
```bash
npx convex deploy
```

### Frontend Options

**Vercel (Recommended):**
```bash
npm i -g vercel
npm run build
vercel --prod
```

**Netlify:**
```bash
npm i -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

**GitHub Pages (Free):**
```bash
npm run build
# Upload dist/ folder to GitHub Pages
```

## Research Applications

This application is designed for research on Japanese L2 learners of English. It collects:

- Task completion data (control vs experimental conditions)
- Suggestion interaction patterns (accepted/ignored suggestions)
- Writing samples and improvement metrics
- User engagement analytics

All data is stored securely in Convex with proper user anonymization.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of academic research on language learning assistance systems.

## Support

For support, please open an issue in the repository or contact the research team.

---

**Note**: This application requires a Google AI API key to function properly. Make sure to set up your API key in the environment variables before running the application.
