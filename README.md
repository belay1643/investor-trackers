# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Running the application

This repository contains both a React frontend (powered by Vite) and a simple Express backend.

### Install dependencies

```bash
# root workspace (frontend)
npm install

# backend folder
cd backend && npm install
```

### Development servers

- **Frontend** – from the root: `npm run dev` (the dev server is now forced to port `5175` so you can always open `http://localhost:5175`).
- **Backend** – from `./backend`: `npm run dev` (requires `nodemon`).
- **Combined** – the convenience script `npm run befast` will launch both servers concurrently (the `concurrently` package is used). You can still start them separately if you want to control ports individually.

### Forgot password functionality ✅

The login page exposes a **Forgot Password?** link that takes the user through a two‑step flow:

1. Enter a registered email address and request an OTP.  The server generates and stores a hashed OTP in MongoDB, then attempts to send it by email (or returns the code in development mode).
2. Submit the one‑time code together with a new password; the backend verifies the OTP and updates the hashed password in the database.

This flow is implemented in `src/ForgotPassword.tsx` and the corresponding Express endpoints (`/api/forgot-password/request` and `/api/forgot-password/reset`) in `backend/server.js`.

**MongoDB setup**

You must provide a connection string via `MONGO_URI` (e.g. `mongodb://localhost:27017`) and optionally a database name in `DB_NAME`. The server will create `users` and `password_reset_otps` collections for you and maintain indexes.

```dotenv
MONGO_URI=mongodb://localhost:27017
DB_NAME=tracker11
``` 

Make sure to configure the SMTP environment variables if you want real emails; otherwise the OTP is logged in the JSON response when running locally. You can also set `SKIP_EMAIL=true` in development to force the backend to skip any attempt to send a message and always return the OTP directly, which is handy if SMTP login keeps failing.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## 12. Security Implementation

### Backend security (required)
- **JWT authentication** for stateless request authorization.
- **bcrypt password hashing** for safe credential storage.
- **Role-based middleware** (e.g., admin/manager/viewer) to protect routes.
- **Company context validation** on every request (ensure users only access data for their active company).
- **HTTPS** (TLS) enforced in production.
- **Encrypted database backups** (store exports as encrypted archives).

### 🎨 UI Design Suggestions (Ethiopian context)
- Currency: **ETB (Br)**
- Use **simple English** and **clear labels**
- Keep UI **minimal and uncluttered**
- Ensure the app is **mobile responsive**
- Avoid **complex financial terms** (keep wording straightforward)
