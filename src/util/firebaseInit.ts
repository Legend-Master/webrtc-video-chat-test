import { FirebaseOptions, initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

export const FIREBASE_CONFIG: FirebaseOptions = {
	apiKey: 'AIzaSyBna2gAHgoYLH-h-PRdsCCrwRNSVcUn5RY',
	authDomain: 'test-firebase-project-f4801.firebaseapp.com',
	projectId: 'test-firebase-project-f4801',
	storageBucket: 'test-firebase-project-f4801.appspot.com',
	messagingSenderId: '883293604490',
	appId: '1:883293604490:web:2c142e4d142871f432bb73',
	databaseURL:
		'https://test-firebase-project-f4801-default-rtdb.asia-southeast1.firebasedatabase.app/',
}
export const app = initializeApp(FIREBASE_CONFIG)
export const db = getDatabase(app)
