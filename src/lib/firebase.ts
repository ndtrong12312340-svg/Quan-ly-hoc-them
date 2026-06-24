import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocs, collection, query, where, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const syncTeacherSummary = async (teacherId: string) => {
  if (!teacherId) return;
  try {
    const examsRef = collection(db, 'exams');
    const qExams = query(examsRef, where('teacherId', '==', teacherId));
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        status: data.status || 'draft',
        duration: data.duration || 50,
        assignedClasses: data.assignedClasses || [],
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        createdAt: data.createdAt || ''
      };
    });

    const knowledgeRef = collection(db, 'knowledges');
    const qKnowledge = query(knowledgeRef, where('teacherId', '==', teacherId));
    const knowledgeSnap = await getDocs(qKnowledge);
    const knowledgeList = knowledgeSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        block: data.block || '',
        className: data.className || '',
        fileUrl: data.fileUrl || '',
        createdAt: data.createdAt || ''
      };
    });

    const summaryRef = doc(db, 'teacher_summaries', teacherId);
    await setDoc(summaryRef, {
      exams: examsList,
      knowledges: knowledgeList,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error syncing teacher summary:", error);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
