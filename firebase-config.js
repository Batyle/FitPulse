import { initializeApp }
    from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics }
    from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
    getDatabase, ref, set, push, update, remove,
    onValue, get, child, query, orderByChild, limitToLast
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
    apiKey:            "AIzaSyAEH-oRAeOx4mFxkOIT6l9W8ZKGhtUvxvw",
    authDomain:        "fitpulse-bca3b.firebaseapp.com",
    databaseURL:       "https://fitpulse-bca3b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "fitpulse-bca3b",
    storageBucket:     "fitpulse-bca3b.firebasestorage.app",
    messagingSenderId: "773895407287",
    appId:             "1:773895407287:web:9ad0f8cb2982372313af32",
    measurementId:     "G-PFF3REWM9N"
};

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db        = getDatabase(app);

export {
    app, analytics, db,
    ref, set, push, update, remove,
    onValue, get, child, query, orderByChild, limitToLast
};