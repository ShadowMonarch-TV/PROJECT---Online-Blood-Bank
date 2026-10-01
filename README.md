# Smart Online Blood Booking and Donor Management System

A full-stack Final Year Project built with Python Django, SQLite, and a React + Vite frontend.

## Features

- Role-based auth (`user`, `donor`, `blood_bank`, `admin`)
- Multi-page UI with shared animated sliding sidebar
- Dashboard overview with animated counters and recent notifications
- Discover page: blood search, blood-group compatibility helper, favorites
- Workflow page: role-based operations (booking, donor response, stock, approvals, low-stock)
- Analytics page: role-specific animated trend charts and demand/stock insights
- Account page: profile update, password change, notifications
- Favorites module for users/donors/admins
- Stock alert subscriptions (blood group + city) with automatic availability notifications
- Low-stock monitoring for blood banks and admin

## Tech Stack

- Backend: Python Django
- Database: SQLite (`node:sqlite`)
- Auth: JWT + bcryptjs
- Frontend: React + Vite

## Project Structure

```
.
??? client/
?   ??? index.html
?   ??? vite.config.mjs
?   ??? src/
?       ??? App.jsx
?       ??? main.jsx
?       ??? styles.css
?       ??? api.js
?       ??? components/
?       ??? context/
?       ??? pages/
??? data/                # auto-created for SQLite DB
??? scripts/
?   ??? smoke-test.js
??? server.js
??? package.json
??? README.md
```

## Setup

1. Create a Python environment and install backend dependencies:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

2. Run database migrations (and seed sample data automatically):

```bash
python backend\\manage.py migrate
```

3. Install frontend dependencies:

```bash
npm install
```

4. Start dev (Django API + React):

```bash
npm run dev
```

5. Dev URLs:

- `http://localhost:5173`
- `http://localhost:8000` (API)

6. Build frontend for production:

```bash
npm run client:build
```

7. Start production server:

```bash
python backend\\manage.py runserver 8000
```

8. Optional smoke test:

```bash
npm run smoke-test
```

9. Production URL:

- `http://localhost:8000`

## Default Seed Accounts

- Admin: `admin@bloodbank.com` / `Admin@123`
- Blood bank: `citycare@bloodbank.com` / `Bank@123`
- Blood bank: `lifeline@bloodbank.com` / `Bank@123`

## API Highlights

- Auth/Profile:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PUT /api/auth/profile`
  - `PUT /api/auth/change-password`

- Meta/Search:
  - `GET /api/meta/blood-groups`
  - `GET /api/meta/compatibility/:bloodGroup`
  - `GET /api/blood/search`

- Favorites:
  - `GET /api/favorites/my`
  - `POST /api/favorites`
  - `DELETE /api/favorites/:bankId`

- Alerts:
  - `POST /api/alerts/subscribe`
  - `GET /api/alerts/my`
  - `PUT /api/alerts/:id/status`
  - `DELETE /api/alerts/:id`

- User/Donor:
  - `POST /api/bookings`
  - `GET /api/bookings/my`
  - `PUT /api/bookings/:id/cancel`
  - `POST /api/emergency-requests`
  - `GET /api/emergency-requests/my`
  - `GET /api/emergency-requests/my/responses`
  - `PUT /api/emergency-requests/:id/close`
  - `PUT /api/donor/availability`
  - `GET /api/donor/requests`
  - `POST /api/donor/requests/:id/respond`
  - `PUT /api/donor/requests/:id/withdraw`
  - `GET /api/donor/responses`
  - `GET /api/activity/my`

- Blood bank/Admin:
  - `GET /api/blood-bank/stock`
  - `PUT /api/blood-bank/stock/:bloodGroup`
  - `GET /api/blood-bank/bookings`
  - `PUT /api/blood-bank/bookings/:id`
  - `GET /api/blood-bank/low-stock`
  - `GET /api/blood-bank/analytics`
  - `GET /api/admin/stats`
  - `GET /api/admin/low-stock`
  - `GET /api/admin/analytics/summary`

- Notifications:
  - `GET /api/notifications/my`
  - `GET /api/notifications/unread-count`
  - `PUT /api/notifications/:id/read`
  - `PUT /api/notifications/read-all`

## Notes

- `node:sqlite` is currently experimental in Node.js.
- Set a strong `JWT_SECRET` in production.

