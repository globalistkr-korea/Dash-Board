import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAqFSkIKxrMe6eSHc58WF07k1clWlpA-PM',
  authDomain: 'vn-buk-dashboard.firebaseapp.com',
  projectId: 'vn-buk-dashboard',
  storageBucket: 'vn-buk-dashboard.firebasestorage.app',
  messagingSenderId: '1038039402368',
  appId: '1:1038039402368:web:3430a972e2e9d7eff76365',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
