const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getAuth, signInAnonymously } = require("firebase/auth");

const firebaseApp = initializeApp({
    apiKey: process.env.REACT_APP_API_KEY,
    authDomain: process.env.REACT_APP_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_PROJECT_ID,
    storageBucket: process.env.REACT_APP_BUCKET
});

const auth = getAuth();
signInAnonymously(auth).then(() => {
    console.log("logged in");
})
    .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorMessage);
        // ...
    });

async function connectDB() {
    const auth = getAuth();
    await signInAnonymously(auth);
    console.log("Connected to db");
    return getFirestore();
}

const db = getFirestore();

exports.db = db;
exports.connectDB = connectDB;