const { Groq } = require('groq-sdk');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
require('dotenv').config();

// Initialize Groq Client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Initialize Firebase
let db;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('../serviceAccountKey.json');
  }
  initializeApp({
    credential: cert(serviceAccount)
  });
  db = getFirestore();
  console.log("Firebase Firestore connected successfully!");
} catch (error) {
  console.warn("Firebase initialization skipped or failed. Running in memory-only mode. Details:", error.message);
}

module.exports = {
  groq,
  db,
  FieldValue,
  primaryModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  fallbackModel: 'llama-3.1-8b-instant',
  maxTokens: 1024,
  cooldownMs: 3000,
  maxMemoryLimit: 20
};
