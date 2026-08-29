# Intervals.icu Performance Dashboard

Dashboard local, fără framework și fără dependențe NPM.

## Ce afișează

- Fitness / CTL
- Fatigue / ATL
- Form = CTL - ATL
- Ramp Rate
- Weight (wellness, cu fallback la profil)
- PMC pe 90 de zile
- Form pe 90 de zile
- Ramp Rate
- Ultimele 10 activități

Cheia Intervals.icu este folosită doar în backend-ul Node și nu este trimisă în browser.

## Pornire pe Windows PowerShell

1. Copiază `.env.example` în `.env`:

```powershell
Copy-Item .env.example .env
```

2. Deschide `.env` și pune cheia API reală:

```text
INTERVALS_API_KEY=cheia-ta
PORT=3000
```

3. Rulează:

```powershell
node --env-file=.env server.mjs
```

4. Deschide:

```text
http://localhost:3000
```

Necesită Node.js 18+; Node 22 este perfect.

## Securitate

`.env` este în `.gitignore`. Nu publica cheia API în GitHub.

Dacă o cheie a fost postată într-un chat sau într-un repository, regenereaz-o.