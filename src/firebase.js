// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCIBZiQV9b3jjdDxZl5HTEGuGo9Qy8Z628",
  authDomain: "resonancefield.firebaseapp.com",
  databaseURL: "https://resonancefield-default-rtdb.firebaseio.com",
  projectId: "resonancefield",
  storageBucket: "resonancefield.firebasestorage.app",
  messagingSenderId: "902374308200",
  appId: "1:902374308200:web:298a6133c1f34c21dd3edd",
  measurementId: "G-6DVX6SN8CL"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
