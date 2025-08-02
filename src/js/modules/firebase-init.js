// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDsmwKc7mw11sUPCn39OrJ7WWdij24AWDs",
  authDomain: "river-winner.firebaseapp.com",
  projectId: "river-winner",
  storageBucket: "river-winner.firebasestorage.app",
  messagingSenderId: "847634086851",
  appId: "1:847634086851:web:c606fcc3219a82dac65b76"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline persistence. This is the magic that makes it work offline!
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Firestore persistence failed: likely due to multiple tabs open.');
    } else if (err.code == 'unimplemented') {
      console.warn('Firestore persistence is not available in this browser.');
    }
  });

// Export the db instance to be used by other modules
export { db };