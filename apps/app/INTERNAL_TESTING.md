# Internal testing (EAS Build)

Use the **`preview`** profile for builds you share with testers before a public store release. It uses **`distribution: "internal"`** and the EAS **`preview`** environment for variables.

## One-time setup

1. **Install / login**

   ```bash
   cd apps/app
   npx eas-cli login
   npx eas-cli init
   ```

   `eas init` links the app to an Expo project and stores `extra.eas.projectId` (usually in `app.json`).

2. **Secrets for cloud builds**  
   Local `.env` is not sent to EAS. Create the same keys for the **`preview`** environment (repeat for **`production`** when you are ready):

   ```bash
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co" --environment preview --visibility plaintext
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY" --environment preview --visibility sensitive
   ```

   Optionally mirror the same for **`development`** if you use the dev-client profile.

3. **Apple (iOS)**  
   Configure your Apple Developer team in EAS (first iOS build walks through credentials). Internal installs are typically **TestFlight** (add internal testers) or ad hoc–style flows depending on your EAS options.

4. **Google (Android)**  
   The **`preview`** profile builds an **APK** for easier sideloading. Play Console **internal testing** track is optional; use `eas submit` with the included **`submit.production`** config when you want to push an AAB to the internal track (you may switch the build profile to produce an AAB for store upload).

## Commands

```bash
npm run build:internal              # both platforms (interactive platform choice)
npm run build:internal:ios
npm run build:internal:android
npm run build:dev-client            # Expo dev client + internal distribution
```

## Profiles (see `eas.json`)

| Profile       | Use |
|---------------|-----|
| `development` | Dev client, `development` env, internal distribution, Android APK |
| `preview`     | **Default for internal QA**, `preview` env, internal distribution, Android APK |
| `production`  | Store-style builds, `production` env, auto-increment version |

## Still to validate before wider testing

- Supabase **RLS** on tables the app reads/writes (`quiz_events`, `venues`, packs).
- **Redirect URLs** for Google auth include your production scheme and any EAS deep links you use.
