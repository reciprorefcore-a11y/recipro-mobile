import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const APP_NAME = "recipro";

const existing = getApps().find((a) => a.name === APP_NAME);

const reciproApp =
  existing ??
  initializeApp(
    {
      apiKey: process.env.NEXT_PUBLIC_RECIPRO_FIREBASE_API_KEY!,
      authDomain: "recipro-project-fafd0.firebaseapp.com",
      projectId: "recipro-project-fafd0",
    },
    APP_NAME
  );

export const reciproAuth = getAuth(reciproApp);
