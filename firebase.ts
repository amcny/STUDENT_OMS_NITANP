import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDYwa8CFx1eiGBpdfWP5OaFyD_Sq07Sh7Y",
  authDomain: "somnitanp.firebaseapp.com",
  projectId: "somnitanp",
  storageBucket: "somnitanp.firebasestorage.app",
  messagingSenderId: "1072085106820",
  appId: "1:1072085106820:web:898f64557be5ebb0b702d1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
