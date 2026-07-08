import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAqFSkIKxrMe6eSHc58WF07k1clWlpA-PM',
  // 호스팅 도메인(web.app)과 일치시켜 redirect 로그인이 same-domain으로 처리되게 함
  // (firebaseapp.com이면 iOS Safari/PWA의 서드파티 스토리지 차단으로 로그인 실패 가능)
  authDomain: 'vn-buk-dashboard.web.app',
  projectId: 'vn-buk-dashboard',
  storageBucket: 'vn-buk-dashboard.firebasestorage.app',
  messagingSenderId: '1038039402368',
  appId: '1:1038039402368:web:3430a972e2e9d7eff76365',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// 주의: 이 프로젝트의 Firestore는 '(default)'가 아니라 'default'라는 이름의 DB로
// 생성되어 있다(2026-06). getFirestore(app)는 '(default)'를 찾으므로 반드시 이름 지정.
export const db = getFirestore(app, 'default');
