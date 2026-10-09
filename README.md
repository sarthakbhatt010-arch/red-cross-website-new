# Youth Red Cross · Doon University

Static site pages and a Supabase-backed YRC application form.

## Supabase setup

1. Create or select a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). This creates the `yrc_applications` table, enables row-level security without public policies, and creates the private `yrc-application-documents` Storage bucket.
3. Copy `.env.example` to `.env` for local development and fill in the project URL and server-only service role key.
4. Install dependencies and run the site:

   ```powershell
   npm install
   npm start
   ```

5. Open `http://127.0.0.1:3000/join-yrc.html` and check `http://127.0.0.1:3000/api/health` reports `configured`.

Applications are inserted into `public.yrc_applications`. Uploaded academic images go into the private `yrc-application-documents` bucket. The API accepts JPG, PNG, and WebP images up to 4 MB to stay below Vercel's request-size limit.

## Vercel deployment

Add these environment variables in the Vercel project settings for Production (and Preview if required):

- `SUPABASE_URL`: the project URL from Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key from Supabase API settings.

Never add the service role key to frontend HTML, commit it, or expose it using a `NEXT_PUBLIC_` or `VITE_` variable. Redeploy after saving the environment variables. Vercel serves the static pages and the `/api/applications` serverless function from `api/applications.js`.

The `mongodb://127.0.0.1:27017/` URI is not used. It refers only to a database running on the same computer as a local process and cannot be reached by the Vercel deployment.
