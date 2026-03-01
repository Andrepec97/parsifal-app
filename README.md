# parsifal-app

Deploy GitHub Pages:

1. Su GitHub vai in `Settings > Pages`.
2. In `Build and deployment`, imposta `Source: GitHub Actions`.
3. Fai push su `master`: il workflow `.github/workflows/deploy-pages.yml` builda e pubblica automaticamente.
4. URL pubblica: `https://andrepec97.github.io/parsifal-app/`.

Deploy manuale alternativo (da locale):

1. `npm run deploy`
