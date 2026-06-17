import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const fetchClassDataDirectly = async (className: string) => {
  if (!className) return { exams: [], knowledges: [] };
  className = className.trim();

  try {
    let block = className.match(/^(\d+)/)?.[1] || '';
    const classQ = query(collection(db, 'classes'), where('name', '==', className));
    const classDocs = await getDocs(classQ);
    if (!classDocs.empty) {
      block = classDocs.docs[0].data().block || block;
    }

    const qExams = query(
      collection(db, 'exams'),
      where('status', '==', 'published'),
      where('assignedClasses', 'array-contains', className)
    );
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs.map(doc => {
      const data = doc.data();
      delete data.questions;
      return { id: doc.id, ...data };
    });

    const qKnowledges = collection(db, 'knowledges');
    const knowledgeSnap = await getDocs(qKnowledges);
    const knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const filteredKnowledges = knowledgesList.filter((k: any) => {
      const kClass = (k.className || '').trim().toLowerCase();
      const sClass = (className || '').trim().toLowerCase();
      const matchClass = !kClass || kClass === sClass;
      const matchBlock = !k.block || String(k.block).trim() === String(block).trim();
      if (kClass) return matchClass;
      return matchBlock;
    });

    return {
      exams: examsList,
      knowledges: filteredKnowledges
    };
  } catch (error) {
    console.error("Error fetching class data directly:", error);
    return { exams: [], knowledges: [] };
  }
};
export const syncClassSummary = async (className: string) => {
  if (!className) return;
  className = className.trim();

  try {
    // 1. Fetch exams for this class
    const qExams = query(
      collection(db, 'exams'),
      where('status', '==', 'published'),
      where('assignedClasses', 'array-contains', className)
    );
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs.map(doc => {
      const data = doc.data();
      delete data.questions; // Ensure payload stays small
      return { id: doc.id, ...data };
    });

    // 2. Fetch knowledge for this class
    let block = className.match(/^(\d+)/)?.[1] || '';
    const classQ = query(collection(db, 'classes'), where('name', '==', className));
    const classDocs = await getDocs(classQ);
    if (!classDocs.empty) {
      block = classDocs.docs[0].data().block || block;
    }

    const qKnowledges = collection(db, 'knowledges');
    const knowledgeSnap = await getDocs(qKnowledges);
    const knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const filteredKnowledges = knowledgesList.filter((k: any) => {
      const kClass = (k.className || '').trim().toLowerCase();
      const sClass = (className || '').trim().toLowerCase();
      const matchClass = !kClass || kClass === sClass;
      const matchBlock = !k.block || String(k.block).trim() === String(block).trim();
      if (kClass) return matchClass;
      return matchBlock;
    });

    // 3. Keep exams lightweight (omit heavy questions arrays maybe? Actually for now keep them since StudentDashboard expects the whole doc or we can omit questions to save quota size. StudentDashboard currently needs exam metadata. ExamResults and ExamTaking will need questions). 
    // Wait, StudentDashboard needs id, title, duration, createdAt, endTime, status, submissionSummary. 
    // It's better to keep it the same structure as before.
    
    // Write to document
    const summaryRef = doc(db, 'class_summaries', className);
    await setDoc(summaryRef, {
      className,
      exams: examsList,
      knowledges: filteredKnowledges,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`Synced class_summaries for ${className} successfully`);
  } catch (error) {
    console.error("Error syncing class_summary:", error);
  }
};
