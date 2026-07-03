import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCROIVNtSVs408loP0AJT24Oe26OrunlHQ",
  authDomain: "beachbingo.firebaseapp.com",
  projectId: "beachbingo",
  storageBucket: "beachbingo.firebasestorage.app",
  messagingSenderId: "711820565541",
  appId: "1:711820565541:web:925fc92e21c22784f7b3cc",
  measurementId: "G-882Y02HJ82",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
