# Project Management Fullstack App

## Setup
1. `npm run install:all`
2. Copy `.env.example` to `.env`, set `MONGO_URI` (MongoDB Atlas)
3. `npm run dev:client` & `npm run dev:server` or use concurrent

## Vercel Deploy
1. `npm i -g vercel`
2. `vercel login`
3. `vercel --prod`

Frontend served at /, API at /api/*

## Local Dev
Client: cd client && npm run dev (http://localhost:5173)
Server: cd server && npm run dev (http://localhost:3000)
