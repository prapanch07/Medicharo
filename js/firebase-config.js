/* =============================================
   MEDICHARO — Firebase Configuration
   ============================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCRillt8M7PSsrEgONTUN7eG7fjGO7gZSw",
  authDomain: "medicharoo.firebaseapp.com",
  projectId: "medicharoo",
  storageBucket: "medicharoo.firebasestorage.app",
  messagingSenderId: "623917553571",
  appId: "1:623917553571:web:14e26d05650fb176c1ec16",
  measurementId: "G-BFTNC087T3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ merge: true });
