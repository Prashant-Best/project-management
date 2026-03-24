# Project Management Fullstack App

## Setup
1. `npm run install:all`
2. Copy `.env.example` to `.env`, set `MONGO_URI` (MongoDB Atlas)
3. Run the frontend: `cd client && npm run dev`
4. Run the backend: `cd server && npm run dev`

## Vercel Deploy
1. Import the repo as a single Vercel project
2. Set these environment variables in Vercel:
   `MONGO_URI`, `MONGO_DB_NAME`, `JWT_SECRET`
3. Deploy

Frontend is served at `/` and the Express API is exposed at `/api/*` through `api/[...path].js`.

## Local Dev
Client: cd client && npm run dev (http://localhost:5173)
Server: cd server && npm run dev (http://localhost:3000)
