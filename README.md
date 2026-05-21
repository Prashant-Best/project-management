# DevFlow MERN Stack App

DevFlow is a MERN project management app with a React/Vite frontend, an Express/Node.js backend, and MongoDB for persistence.

## Architecture

- `client/`: React + Vite single page app.
- `server/`: Express API with JWT authentication and Mongoose models.
- `MongoDB Atlas`: hosted database used by the backend.
- `Docker`: backend runs in a Node.js container; frontend is built with Node.js and served from nginx.

The frontend calls the backend through `VITE_API_BASE_URL`. For local Docker runs this is `http://localhost:3000/api`. In production, set it to your deployed Render backend URL plus `/api`.

## Environment Variables

Create `server/.env` from `.env.example`:

```env
PORT=3000
MONGO_URI=mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/devflow?retryWrites=true&w=majority
MONGO_DB_NAME=devflow
JWT_SECRET=replace_with_a_long_random_secret
```

Do not commit real `.env` values.

## Run Locally Without Docker

Install dependencies:

```bash
npm run install:all
```

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

## Run With Docker

Build and run both containers with Docker Compose:

```bash
docker compose up --build
```

Open the frontend at `http://localhost:8080`.

Backend health check:

```bash
curl http://localhost:3000/api/health
```

Useful individual Docker commands:

```bash
docker build -t devflow-backend ./server
docker run --env-file ./server/.env -p 3000:3000 devflow-backend
```

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:3000/api -t devflow-frontend ./client
docker run -p 8080:80 devflow-frontend
```

## Backend Deployment On Render

1. Push this repository to GitHub.
2. In Render, create a new **Web Service** from the repository.
3. Use these settings:
   - Root Directory: `server`
   - Runtime: `Docker`
   - Dockerfile Path: `./Dockerfile`
   - Port: `3000`
4. Add environment variables in Render:
   - `MONGO_URI`
   - `MONGO_DB_NAME`
   - `JWT_SECRET`
   - `PORT=3000`
5. Deploy the service.
6. Confirm the backend is public by opening:

```text
https://your-render-service.onrender.com/api/health
```

Deployment link:

```text
Replace this with your Render backend URL after deployment.
```
