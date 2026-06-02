import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const syncClassSummary = async (className: string) => {
  if (!className) return;

  try {
    // 1. Fetch exams for this class
    const qExams = query(
      collection(db, 'exams'),
      where('status', '==', 'published'),
      where('assignedClasses', 'array-contains', className)
    );
    const examSnap = await getDocs(qExams);
    const examsList = examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch knowledge for this class
    const block = className.match(/^(\d+)/)?.[1] || '';
    const qKnowledges = collection(db, 'knowledges');
    const knowledgeSnap = await getDocs(qKnowledges);
    const knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const filteredKnowledges = knowledgesList.filter((k: any) => {
      const matchClass = !k.className || k.className === className;
      const matchBlock = !k.block || k.block === block;
      if (k.className) return matchClass;
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
