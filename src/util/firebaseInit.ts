import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

export const FIREBASE_CONFIG: FirebaseOptions = {
	apiKey: 'AIzaSyDxfjmcTIbZJSprVUcbt4oTmRD_8DEBxGE',
	authDomain: 'webrtc-chat-d039c.firebaseapp.com',
	projectId: 'webrtc-chat-d039c',
	storageBucket: 'webrtc-chat-d039c.appspot.com',
	messagingSenderId: '997832726742',
	appId: '1:997832726742:web:0a9ce65a31b9430f4e9177',
	databaseURL: 'https://webrtc-chat-d039c-default-rtdb.asia-southeast1.firebasedatabase.app',
}
export const app = initializeApp(FIREBASE_CONFIG)
export const db = getDatabase(app)
