# Moving the Platform OS One database to Sydney

The live database (Supabase project `wai2much`, ref `ysavtiiezxbqcnkkjnjo`) is in Tokyo. Moving it to Sydney makes every screen faster for a Melbourne workshop, and keeps customer details in Australia.

Supabase can't move a project to another region, so we create a new project in Sydney and copy everything into it. **Tokyo is only ever read from.** If anything looks wrong after the switch, we point the app back at Tokyo and it is exactly as it was.

## How the copying works

The **Region move** workflow in GitHub (the Actions tab) does the copying, one step at a time. It needs one secret, a Supabase access token, which Wai pastes into GitHub's secrets page himself, so nobody else ever sees it. With the token, the workflow asks Supabase for a temporary login to each database, the same way Supabase's own command line tool does when it has no database password, and removes those logins again before each step finishes.

This repo is public, so the workflow's logs are public too. The helper only ever prints ticks, crosses and names: never data, row counts, passwords or keys, and it uploads nothing. The copy passes through GitHub's servers for a few minutes on its way to Sydney; nothing is kept there.

The helper is `scripts/region-move/run.sh`. It refuses to copy if the Sydney database isn't empty, if Supabase hands it a database address that isn't a supabase.com one, if database secrets (when they're used) are swapped, or if a database extension Tokyo uses isn't switched on in Sydney. It writes the whole database in one go, so a failure leaves Sydney empty and safe to try again.

## What moves

| What | How |
| --- | --- |
| All tables, data and logins | `copy-database` |
| The sign-up trigger that gives each new Google login its own business | `copy-database` puts it back |
| Edge Functions `mercedesChat`, `mercedes` and `zellerPayments` | `copy-functions`, taken exactly as they run in Tokyo today |
| Site URL, redirect URLs and Google sign-in | `copy-auth-settings` |
| Edge Function secrets (for example `ANTHROPIC_API_KEY`) | Pasted into Sydney once by hand. Supabase never shows a saved secret again, so it can't be copied |
| The app's three Vercel settings | Changed by hand at the switch |

The app doesn't use Supabase file storage or realtime, so there is nothing else to move. The newer Mercedes (`mercedes`) isn't on `main` yet; that doesn't matter, because the copy takes the live version straight from Tokyo.

## Part 1: get ready (any time, about 10 minutes, the shop can stay open)

1. **Create the Sydney project.** In Vercel: Storage, then Create Database, then Supabase. Region: **Oceania (Sydney), ap-southeast-2**. Name it `platform-os-one-sydney`. Don't connect it to the `platform-os-one` project yet. This keeps it in the same Supabase organisation and bill as Tokyo.
2. **Make an access token.** Go to supabase.com/dashboard/account/tokens, click Generate new token, name it `region move`, and copy it.
3. **Paste the token into GitHub.** On github.com/wai2much/platform-os-One go to Settings, then Secrets and variables, then Actions. Click New repository secret, name it `SUPABASE_ACCESS_TOKEN`, and paste the token from step 2. That's the only secret the move needs: no connection strings, and no database passwords to reset.

   If `OLD_DB_URL`, `NEW_DB_URL` or their password secrets are already there from before, they still work and are used instead. Deleting them is fine too.
4. **Run `check`.** Tell Claude the Sydney project's ref (the 20 letters in its dashboard address). Claude runs the `check` step. It changes nothing. It confirms the new project really is in Sydney, that both databases are reachable, that Sydney is empty and will accept the copy, that every Edge Function can be copied, and which secrets Sydney will need.

## Part 2: the move (about an hour, with nobody using the app)

From step 5 until the switch in step 9, nobody should use the app. Anything typed into Tokyo after the copy wouldn't come across.

5. **Claude runs `copy-database`.** At the end it compares every table with Tokyo, row for row.
6. **Claude runs `copy-functions`, then `copy-auth-settings`.**
7. **Wai adds the Edge Function secrets in Sydney.** Go to Edge Functions, then Secrets, and add the ones the workflow listed, usually `ANTHROPIC_API_KEY`, `ZELLER_API_KEY` and `ZELLER_API_BASE`. If the workflow said Google's client secret didn't come across, paste it under Authentication, then Sign In / Providers, then Google.
8. **Wai adds Sydney to Google sign-in.** In Google Cloud console go to APIs and Services, then Credentials, then the OAuth client used for sign-in. Under Authorized redirect URIs add `https://<sydney-ref>.supabase.co/auth/v1/callback`. Keep the Tokyo one there for now.
9. **The switch.** In Vercel open `platform-os-one`, then Settings, then Environment Variables. Change these three to Sydney's values from Supabase (Sydney), Project Settings, then API Keys:
    - `VITE_SUPABASE_URL`: `https://<sydney-ref>.supabase.co`
    - `VITE_SUPABASE_ANON_KEY`: Sydney's anon key
    - `SUPABASE_SERVICE_ROLE_KEY`: Sydney's service_role key

    Then go to Deployments and Redeploy the latest production deployment.
10. **Test together.**
    - Sign in with Google.
    - The dashboard shows the same invoice count and year to date as before the move.
    - Edit a customer, refresh, and check the change stuck.
    - Raise a test invoice.
    - Ask Mercedes a question.
    - Run a rego check.

## If something's wrong after the switch

Put Tokyo's three values back in Vercel and redeploy. The app is back on Tokyo exactly as before. Anything entered during the test would need entering again.

## A week after the move

- Delete the Tokyo project (Wai's click, in Supabase).
- Remove Tokyo's redirect URI from the Google sign-in client.
- Delete the `SUPABASE_ACCESS_TOKEN` secret in GitHub (and any `OLD_DB_` or `NEW_DB_` ones), then the access token itself in Supabase.
- Update the project ref in `.mcp.json` and `supabase/.temp/linked-project.json`.

## Coming up: Supabase's older keys

Supabase is phasing out the older `anon` and `service_role` keys by the end of 2026, and the app and its Edge Functions use them. The `check` step reports whether the new Sydney project still has them.

- **If it has them:** the move goes ahead as written. The keys still need switching before the end of the year, in Tokyo or Sydney alike.
- **If it doesn't:** the switch needs a small change first. The app takes the new publishable and secret keys as drop-in values for the same three Vercel settings. The Edge Functions need to read the new key names.
