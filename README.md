# AgroClimate

AgroClimate is an agricultural and climate intelligence application developed by Amineva Global. It brings together climate and crop intelligence, satellite and geospatial tools, farm operations, produce safety, aerial operations, logistics and market services.

AgroClimate is an independently developed solution in the Amineva ecosystem. Its application interface, Supabase backend, database, operational workflows and device integrations remain owned by this repository. Integration with Amineva Global must not replace or duplicate those application services.

## Technology

- React 18 and TypeScript
- Vite
- Supabase (authentication, database, storage and Edge Functions)
- Tailwind CSS and shadcn/ui
- Vite PWA / Workbox for the application-specific offline shell

## Requirements

- Node.js 20 or later
- npm

## Local development

1. Clone the repository:
   `git clone https://github.com/Phoxtra1/agroclimate.git`
2. Enter the project:
   `cd agroclimate`
3. Install dependencies:
   `npm install`
4. Create a local environment file:
   `cp .env.example .env`
5. Fill in the environment values from the authorised project configuration.
6. Start the development server:
   `npm run dev`

## Environment configuration

Use `.env.example` as the variable-name reference. Never commit `.env`, production credentials, service-role keys, provider secrets or private tokens.

The browser application may use only publishable/anonymous Supabase credentials. Supabase service-role keys and third-party provider secrets must remain in Supabase Edge Function secrets or another trusted server-side secret store. Any provider key exposed through a `VITE_*` variable is bundled into the public browser application and must be treated as public.

## Validation

```sh
npm run lint
npm test
npm run build
```

The GitHub Actions workflow also runs TypeScript checks, tests and a production build for changes targeting `main`.

## Architecture and integration

- Keep AgroClimate's own backend, schema, Edge Functions and application workflows in this repository.
- Keep hardware/device protocols and their server-side gateways within the AgroClimate/device integration boundary.
- Amineva Global provides the central software environment and launch/integration point; it must not impose a replacement application menu or require the AgroClimate UI to be rebuilt inside the core shell.
- Preserve standalone development and deployment capability unless an explicit integration decision changes it.

## Ownership

AgroClimate is developed by **Amineva Global**.
