# FOLJE EXPRESS

Premium Next.js + Vercel website for decorative automotive foil/vinyl design.

ROUTES
- / public 3D website
- /admin private design manager
- /api/designs public published-design API
- /api/admin/designs protected admin CRUD API

VERCEL SETUP
1. Import this GitHub repository into Vercel.
2. Let Vercel detect Next.js automatically.
3. Add a Vercel Blob store to the project. The app uses Blob for public design images and private design metadata.
4. Add ADMIN_PASSWORD in Vercel Project Settings -> Environment Variables.
5. Redeploy.
6. Open /admin and use the password you configured.

The admin password is checked server-side and the session cookie is HttpOnly. Do not commit environment files or passwords.
