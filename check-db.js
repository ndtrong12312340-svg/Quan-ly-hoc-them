import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const rawConfig = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(rawConfig);
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const users = await getDocs(collection(db, 'users'));
  users.forEach(u => {
    console.log(u.id, u.data().role, u.data().email);
  });
  
  // also check pending students
  const pending = await getDocs(collection(db, 'pending_students'));
  pending.forEach(u => {
    console.log("PENDING:", u.id, u.data().name, u.data().email, u.data().role, u.data().className, u.data().createdAt);
  });
  process.exit(0);
}
check();
