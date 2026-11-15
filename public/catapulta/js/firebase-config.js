// Configuração do Firebase (Plano Spark Gratuito: Authentication Anônimo + Realtime Database).
// Quando preenchido com apiKey e databaseURL, o jogo usa o Firebase automaticamente (ideal para Vercel).
// Quando vazio (""), o jogo conecta via WebSocket no servidor Node local (npm start).

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCXJHoO5Q9Cqljkh6nAJIxSniBTW_ur85M',
  authDomain: 'habits-e8eb7.firebaseapp.com',
  databaseURL: 'https://habits-e8eb7-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'habits-e8eb7',
  storageBucket: 'habits-e8eb7.firebasestorage.app',
  messagingSenderId: '862491398796',
  appId: '1:862491398796:web:af8446d5caf30f601f61a9',
};
