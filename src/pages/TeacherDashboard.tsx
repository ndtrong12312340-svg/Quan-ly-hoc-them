import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType, syncTeacherSummary } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, deleteUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Link } from 'react-router-dom';
import { Plus, Users, FileText, LogOut, Edit, Trash2, Upload, X, AlertTriangle, Clock, MessageCircle, RefreshCw, AlertCircle, CheckCircle, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { syncClassSummary } from '../lib/syncUtils';

// Secondary app for creating users without logging out the main user
const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

export default function TeacherDashboard() {
  const { appUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'exams' | 'students' | 'facebook' | 'knowledge' | 'classes'>('exams');
  
  // Classes state
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [newClass, setNewClass] = useState({ name: '', block: '10' });
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);

  // Exams state
  const [exams, setExams] = useState<any[]>([]);
  
  // Knowledge state
  const [knowledges, setKnowledges] = useState<any[]>([]);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', block: '10', className: '', fileUrl: '' });
  const [isCreatingKnowledge, setIsCreatingKnowledge] = useState(false);
  const [knowledgeToDelete, setKnowledgeToDelete] = useState<string | null>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<any>(null);
  const [isUpdatingKnowledge, setIsUpdatingKnowledge] = useState(false);

  // Students state
  const [students, setStudents] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', password: '', className: '', facebook: '' });
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [studentError, setStudentError] = useState('');
  
  const [isImporting, setIsImporting] = useState(false);
  const [viewingStudentExams, setViewingStudentExams] = useState<any>(null);
  const [viewingStudentDetails, setViewingStudentDetails] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editStudentData, setEditStudentData] = useState({ name: '', className: '', email: '', password: '' });
  const [updateStudentError, setUpdateStudentError] = useState('');
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [editingFbStudent, setEditingFbStudent] = useState<any>(null);
  const [editFbData, setEditFbData] = useState({ facebook: '', zalo: '' });
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [examToExtend, setExamToExtend] = useState<any>(null);
  const [newEndTime, setNewEndTime] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acceptingStudentId, setAcceptingStudentId] = useState<string | null>(null);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);

  const [isSyncingClass, setIsSyncingClass] = useState(false);

  const handleManualSyncClass = async () => {
    if (!activeClass) return;
    setIsSyncingClass(true);
    try {
      await syncClassSummary(activeClass);
      alert(`Đã làm mới dữ liệu tờ tóm tắt cho lớp ${activeClass} thành công! Học sinh đã có thể thấy được bài thi.`);
    } catch (err) {
      console.error(err);
      alert('Đồng bộ thất bại.');
    } finally {
      setIsSyncingClass(false);
    }
  };

  const fetchData = async () => {
    if (!appUser?.uid) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const summaryRef = doc(db, 'teacher_summaries', appUser.uid);
      const summarySnap = await getDoc(summaryRef);
      
      let examsList = [];
      let knowledgesList = [];

      if (summarySnap.exists()) {
        const data = summarySnap.data();
        examsList = data.exams || [];
        knowledgesList = data.knowledges || [];
        
        // Check if old knowledges are missing fileUrl, repair them
        const needsRepair = knowledgesList.some((k: any) => k.fileUrl === undefined);
        if (needsRepair) {
           const qKnowledges = query(collection(db, 'knowledges'), where('teacherId', '==', appUser.uid));
           const knowledgeSnap = await getDocs(qKnowledges);
           knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           await syncTeacherSummary(appUser.uid);
        }
      } else {
        // Fallback or first load: fetch everything and create summary
        const qExams = query(collection(db, 'exams'), where('teacherId', '==', appUser.uid));
        const examSnap = await getDocs(qExams);
        examsList = examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const qKnowledges = query(collection(db, 'knowledges'), where('teacherId', '==', appUser.uid));
        const knowledgeSnap = await getDocs(qKnowledges);
        knowledgesList = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        await syncTeacherSummary(appUser.uid);
      }
      
      // Sort exams by number in title
      examsList.sort((a: any, b: any) => {
        const titleA = a.title || '';
        const titleB = b.title || '';
        
        const matchA = titleA.match(/\d+/);
        const matchB = titleB.match(/\d+/);
        
        if (matchA && matchB) {
          const numA = parseInt(matchA[0], 10);
          const numB = parseInt(matchB[0], 10);
          if (numA !== numB) {
            return numA - numB;
          }
        }
        
        return titleA.localeCompare(titleB);
      });
      
      setExams(examsList);

      knowledgesList.sort((a: any, b: any) => {
        const blockA = parseInt(a.block || '0', 10);
        const blockB = parseInt(b.block || '0', 10);
        if (blockA !== blockB) return blockA - blockB;

        const titleA = a.title || '';
        const titleB = b.title || '';
        
        const getChapter = (title: string) => {
          const match = title.match(/chương\s*(\d+|[IVXLCDM]+)/i);
          if (!match) return 0;
          const val = match[1].toUpperCase();
          if (/^\d+$/.test(val)) return parseInt(val, 10);
          
          const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
          let result = 0;
          for (let i = 0; i < val.length; i++) {
              const curr = romanMap[val[i]];
              const next = romanMap[val[i + 1]];
              if (next > curr) {
                  result += next - curr;
                  i++;
              } else {
                  result += curr;
              }
          }
          return result;
        };
      
        const getLesson = (title: string) => {
          const match = title.match(/bài\s*(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        const chapterA = getChapter(titleA);
        const chapterB = getChapter(titleB);
        
        if (chapterA !== chapterB) {
          return chapterA - chapterB;
        }
        
        const lessonA = getLesson(titleA);
        const lessonB = getLesson(titleB);
        
        if (lessonA !== lessonB) {
          return lessonA - lessonB;
        }
        
        return titleA.localeCompare(titleB, 'vi', { numeric: true, sensitivity: 'base' });
      });
      setKnowledges(knowledgesList);

      // Derive available classes from explicitly created classes only
      const classes = new Set<string>();
      
      // Fetch classes
      const qClasses = query(collection(db, 'classes'), where('teacherId', '==', appUser.uid));
      const classesSnap = await getDocs(qClasses);
      const classesList = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      classesList.sort((a: any, b: any) => {
        if (a.block !== b.block) return a.block.localeCompare(b.block);
        return a.name.localeCompare(b.name);
      });
      setTeacherClasses(classesList);
      
      classesList.forEach(cls => classes.add(cls.name));
      const classesArray = Array.from(classes).sort();
      setAvailableClasses(classesArray);
      
      if (classesArray.length > 0 && !activeClass) {
        setActiveClass(classesArray[0]);
      }

      // Removed global students fetch to save Firebase Quota
      // We will only fetch students per-class when a specific class is selected
      // setStudents(studentsList);
      
      // Removed global submissions fetch to save Firebase Quota
      // Submissions will only be fetched per-exam in ExamResults.tsx
      setSubmissions([]);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      if (err.message && err.message.includes('Quota')) {
        setError('Hệ thống đang quá tải (vượt quá giới hạn truy cập miễn phí của Firebase). Vui lòng thử lại sau.');
      } else {
        // Do not display generic error to user
        // setError('Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [appUser?.uid]);

  const fetchStudentsForClass = async (className: string) => {
    if (!className) return;
    setIsFetchingStudents(true);
    try {
      const qStudents = query(collection(db, 'users'), where('role', '==', 'student'), where('className', '==', className));
      const studentSnap = await getDocs(qStudents);
      const activeStudentsList = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), status: doc.data().status || 'active' }));

      let pendingStudentsList: any[] = [];
      try {
        const qPending = query(collection(db, 'pending_students'), where('className', '==', className));
        const pendingSnap = await getDocs(qPending);
        pendingStudentsList = pendingSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), status: 'pending' }));
      } catch (pendingErr) {
        console.error("Error fetching pending students:", pendingErr);
      }

      const studentsList = [...activeStudentsList, ...pendingStudentsList];
      studentsList.sort((a: any, b: any) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        const getFirstName = (fullName: string) => {
          const parts = fullName.trim().split(' ');
          return parts[parts.length - 1] || '';
        };
        const fnameA = getFirstName(nameA);
        const fnameB = getFirstName(nameB);
        const comp = fnameA.localeCompare(fnameB, 'vi');
        if (comp !== 0) return comp;
        return nameA.localeCompare(nameB, 'vi');
      });
      setStudents(studentsList);
    } catch (error) {
      console.error("Error fetching students for class:", error);
    } finally {
      setIsFetchingStudents(false);
    }
  };

  useEffect(() => {
    if (activeClass && (activeTab === 'students' || activeTab === 'facebook')) {
      fetchStudentsForClass(activeClass);
    }
  }, [activeClass, activeTab]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStudent(true);
    setStudentError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStudent.email, newStudent.password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: newStudent.email,
        name: newStudent.name,
        className: newStudent.className,
        password: newStudent.password,
        role: 'student',
        createdAt: new Date().toISOString()
      });
      await signOut(secondaryAuth);
      if (newStudent.className === activeClass) {
        fetchStudentsForClass(activeClass);
      }
      setNewStudent({ name: '', email: '', password: '', className: '', facebook: '' });
      alert('Tạo học sinh thành công!');
    } catch (error: any) {
      console.error("Error creating student:", error);
      if (error.code === 'auth/email-already-in-use') {
        try {
          // Attempt to recover by signing in if the account exists but Firestore doc was deleted
          const signInCredential = await signInWithEmailAndPassword(secondaryAuth, newStudent.email, newStudent.password);
          await setDoc(doc(db, 'users', signInCredential.user.uid), {
            uid: signInCredential.user.uid,
            email: newStudent.email,
            name: newStudent.name,
            className: newStudent.className,
            password: newStudent.password,
            role: 'student',
            createdAt: new Date().toISOString()
          });
          await signOut(secondaryAuth);
          if (newStudent.className === activeClass) {
            fetchStudentsForClass(activeClass);
          }
          setNewStudent({ name: '', email: '', password: '', className: '', facebook: '' });
          alert('Tài khoản đã tồn tại trong hệ thống. Đã khôi phục và cập nhật hồ sơ học sinh thành công!');
        } catch (signInError) {
          setStudentError('Email này đã được sử dụng và mật khẩu không khớp để khôi phục.');
        }
      } else if (error.code === 'auth/operation-not-allowed') {
        setStudentError('LỖI NGHIÊM TRỌNG: Bạn CHƯA BẬT chức năng đăng nhập bằng Email/Mật khẩu trên Firebase! Vui lòng vào Firebase Console -> Authentication -> Sign-in method -> Bật "Email/Password".');
        alert('LỖI NGHIÊM TRỌNG: Bạn CHƯA BẬT chức năng đăng nhập bằng Email/Mật khẩu trên Firebase!\n\nVui lòng làm theo hướng dẫn:\n1. Vào Firebase Console\n2. Chọn Authentication -> Sign-in method\n3. Bật "Email/Password"\n4. Lưu lại và thử lại.');
      } else if (error.code === 'auth/invalid-email') {
        setStudentError('Địa chỉ email không hợp lệ (phải có dạng ten@mien.com).');
      } else if (error.code === 'auth/weak-password') {
        setStudentError('Mật khẩu quá yếu (phải có ít nhất 6 ký tự).');
      } else if (error.code === 'auth/invalid-credential') {
        setStudentError('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại email và mật khẩu.');
      } else {
        setStudentError('Lỗi: ' + error.message);
      }
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStudentError('');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        let successCount = 0;
        let errorCount = 0;
        let isOperationNotAllowed = false;
        let emailInUseCount = 0;
        let invalidEmailCount = 0;
        let weakPasswordCount = 0;
        let missingDataCount = 0;
        let wrongPasswordCount = 0;
        let otherErrorMessages: string[] = [];

        for (const row of json) {
          const name = row['FullName'] || row['Họ và tên'];
          const className = row['Class'] || row['Lớp'];
          const email = row['Email']?.toString().trim();
          const password = row['Password'] || row['Mật khẩu'];
          const facebook = row['Facebook'] || row['FB'] || row['Link Facebook'] || '';
          const zalo = row['Zalo'] || row['SĐT Zalo'] || row['Số điện thoại'] || row['Phone'] || '';
          const role = row['Role'];

          // Skip if role is explicitly set to something other than student
          if (role && String(role).toLowerCase() !== 'student') {
            continue;
          }

          if (name && className && email && password) {
            try {
              const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, String(password));
              await setDoc(doc(db, 'users', userCredential.user.uid), {
                uid: userCredential.user.uid,
                email: email,
                name: String(name).trim(),
                className: String(className).trim(),
                password: String(password),
                facebook: String(facebook).trim(),
                zalo: String(zalo).trim(),
                role: 'student',
                createdAt: new Date().toISOString()
              });
              await signOut(secondaryAuth);
              successCount++;
            } catch (err: any) {
              if (err.code === 'auth/email-already-in-use') {
                try {
                  // Attempt to recover by signing in
                  const signInCredential = await signInWithEmailAndPassword(secondaryAuth, email, String(password));
                  await setDoc(doc(db, 'users', signInCredential.user.uid), {
                    uid: signInCredential.user.uid,
                    email: email,
                    name: String(name).trim(),
                    className: String(className).trim(),
                    password: String(password),
                    facebook: String(facebook).trim(),
                    zalo: String(zalo).trim(),
                    role: 'student',
                    createdAt: new Date().toISOString()
                  });
                  await signOut(secondaryAuth);
                  successCount++;
                } catch (signInErr: any) {
                  console.error("Lỗi khôi phục tài khoản cho", email, signInErr);
                  if (signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential') {
                    wrongPasswordCount++;
                  } else {
                    emailInUseCount++;
                  }
                  errorCount++;
                }
              } else {
                console.error("Lỗi tạo tài khoản cho", email, err);
                if (err.code === 'auth/operation-not-allowed') {
                  isOperationNotAllowed = true;
                } else if (err.code === 'auth/invalid-email') {
                  invalidEmailCount++;
                } else if (err.code === 'auth/weak-password') {
                  weakPasswordCount++;
                } else {
                  otherErrorMessages.push(`${email}: ${err.message}`);
                }
                errorCount++;
              }
            }
          } else {
            missingDataCount++;
            errorCount++;
          }
        }
        
        if (isOperationNotAllowed) {
          alert('LỖI NGHIÊM TRỌNG: Bạn CHƯA BẬT chức năng đăng nhập bằng Email/Mật khẩu trên Firebase!\n\nVui lòng làm theo hướng dẫn:\n1. Vào Firebase Console\n2. Chọn Authentication -> Sign-in method\n3. Bật "Email/Password"\n4. Lưu lại và thử lại.');
          setStudentError('Vui lòng bật Email/Password trong Firebase Console (Authentication -> Sign-in method).');
        } else {
          let msg = `Nhập thành công: ${successCount} học sinh.\n`;
          if (errorCount > 0) {
            msg += `Thất bại: ${errorCount} dòng.\nChi tiết lỗi:\n`;
            if (emailInUseCount > 0) msg += `- ${emailInUseCount} email đã tồn tại.\n`;
            if (wrongPasswordCount > 0) msg += `- ${wrongPasswordCount} email đã tồn tại nhưng sai mật khẩu (không thể cập nhật).\n`;
            if (invalidEmailCount > 0) msg += `- ${invalidEmailCount} email không hợp lệ (sai định dạng).\n`;
            if (weakPasswordCount > 0) msg += `- ${weakPasswordCount} mật khẩu quá yếu (dưới 6 ký tự).\n`;
            if (missingDataCount > 0) msg += `- ${missingDataCount} dòng thiếu dữ liệu (tên, lớp, email hoặc mật khẩu).\n`;
            if (otherErrorMessages.length > 0) {
              msg += `- Lỗi khác:\n  + ${otherErrorMessages.slice(0, 3).join('\n  + ')}`;
              if (otherErrorMessages.length > 3) msg += `\n  + ... và ${otherErrorMessages.length - 3} lỗi khác.`;
            }
          }
          alert(msg);
          if (activeClass) {
            fetchStudentsForClass(activeClass);
          }
        }
      } catch (err: any) {
        setStudentError('Lỗi đọc file Excel: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset file input
      }
    };
    reader.onerror = () => {
      setStudentError('Lỗi đọc file.');
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAcceptStudent = async (studentId: string) => {
    if (acceptingStudentId) return;
    setAcceptingStudentId(studentId);
    try {
      // Find the student in the students state
      const pendingStudent = students.find(s => s.id === studentId);
      if (!pendingStudent) {
        alert('Không tìm thấy thông tin đăng ký!');
        setAcceptingStudentId(null);
        return;
      }

      const rawPassword = pendingStudent.plainPassword || pendingStudent.password || '123456@';

      let uid = '';
      try {
        // Create authentication in Firebase Auth using the global secondaryAuth
        const cred = await createUserWithEmailAndPassword(secondaryAuth, pendingStudent.email, rawPassword);
        uid = cred.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          try {
            // Retrieve existing credentials by signing in
            const cred = await signInWithEmailAndPassword(secondaryAuth, pendingStudent.email, rawPassword);
            uid = cred.user.uid;
          } catch (signInErr: any) {
            console.error("Auth merge error:", signInErr);
            throw new Error(`Email này (${pendingStudent.email}) đã được sử dụng ở tài khoản khác và mật khẩu không trùng khớp để tự động liên kết.`);
          }
        } else {
          throw authError;
        }
      }

      // Safe truncate to match Firestore security rules length
      const safeName = (pendingStudent.name || '').substring(0, 95);
      const safeClassName = (pendingStudent.className || '').substring(0, 140);
      const safeSchoolInfo = (pendingStudent.schoolInfo || '').substring(0, 140);

      // Create user document in 'users' collection with the same UID
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        name: safeName,
        email: pendingStudent.email,
        personalEmail: pendingStudent.personalEmail || '',
        role: 'student',
        status: 'active',
        dob: pendingStudent.dob || '',
        className: safeClassName,
        schoolInfo: safeSchoolInfo,
        address: pendingStudent.address || '',
        zalo: pendingStudent.zalo || '',
        facebook: pendingStudent.facebook || '',
        parentName: pendingStudent.parentName || '',
        parentRelation: pendingStudent.parentRelation || '',
        parentPhone: pendingStudent.parentPhone || '',
        block: pendingStudent.block || '10',
        password: rawPassword, // Keep password for reference
        createdAt: pendingStudent.createdAt || new Date().toISOString()
      });

      // Sign out from the secondary app authentication state safely
      await signOut(secondaryAuth);

      // Delete from pending_students
      await deleteDoc(doc(db, 'pending_students', studentId));

      // Refresh local state list
      const updatedList = students.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            id: uid,
            uid: uid,
            status: 'active'
          };
        }
        return s;
      });
      setStudents(updatedList);
      alert('Đã duyệt học sinh thành công! Tài khoản và mật khẩu đã được tạo và kích hoạt.');
    } catch (error: any) {
      console.error(error);
      alert('Lỗi xác nhận học sinh: ' + error.message);
    } finally {
      setAcceptingStudentId(null);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    
    setIsUpdatingStudent(true);
    setUpdateStudentError('');
    
    try {
      const emailChanged = editStudentData.email !== editingStudent.email;
      const passwordChanged = editStudentData.password !== editingStudent.password;

      if (emailChanged || passwordChanged) {
        if (!editingStudent.password) {
          setUpdateStudentError("Không thể đổi Email/Mật khẩu vì mật khẩu cũ không được lưu trong hệ thống (tài khoản cũ). Vui lòng tạo tài khoản mới.");
          setIsUpdatingStudent(false);
          return;
        }
        
        if (passwordChanged && editStudentData.password.length < 6) {
          setUpdateStudentError("Mật khẩu mới phải có ít nhất 6 ký tự.");
          setIsUpdatingStudent(false);
          return;
        }

        try {
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(secondaryAuth, editingStudent.email, editingStudent.password);
          } catch (signInErr: any) {
            // Recovery: If email or password was previously updated in Auth but not Firestore
            if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/wrong-password') {
              let recovered = false;
              
              // Try 1: Old email, New password
              if (!recovered && passwordChanged) {
                try {
                  userCredential = await signInWithEmailAndPassword(secondaryAuth, editingStudent.email, editStudentData.password);
                  recovered = true;
                } catch (e) {}
              }
              
              // Try 2: New email, Old password
              if (!recovered && emailChanged) {
                try {
                  userCredential = await signInWithEmailAndPassword(secondaryAuth, editStudentData.email, editingStudent.password);
                  recovered = true;
                } catch (e) {}
              }
              
              // Try 3: New email, New password
              if (!recovered && emailChanged && passwordChanged) {
                try {
                  userCredential = await signInWithEmailAndPassword(secondaryAuth, editStudentData.email, editStudentData.password);
                  recovered = true;
                } catch (e) {}
              }
              
              if (!recovered) {
                throw signInErr; // Throw original error if all recovery attempts fail
              }
            } else {
              throw signInErr;
            }
          }
          
          if (emailChanged && userCredential.user.email !== editStudentData.email) {
            await updateEmail(userCredential.user, editStudentData.email);
          }
          if (passwordChanged) {
            // Only update password if we didn't just use it to recover the account
            const usedNewPasswordToRecover = userCredential && userCredential.user && 
              (editStudentData.password !== editingStudent.password); // We can't easily check what password was used to sign in, but if we reached here and passwordChanged is true, we should just update it to be safe.
            // Actually, updatePassword doesn't hurt if it's the same password.
            await updatePassword(userCredential.user, editStudentData.password);
          }
          
          await signOut(secondaryAuth);
        } catch (authError: any) {
          console.error("Auth update error:", authError);
          if (authError.code === 'auth/weak-password') {
            setUpdateStudentError("Mật khẩu mới quá yếu (phải có ít nhất 6 ký tự).");
          } else if (authError.code === 'auth/invalid-email') {
            setUpdateStudentError("Email mới không hợp lệ.");
          } else if (authError.code === 'auth/email-already-in-use') {
            setUpdateStudentError("Email mới đã được sử dụng bởi một tài khoản khác.");
          } else if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
            setUpdateStudentError("Không thể xác thực. Mật khẩu cũ lưu trong hệ thống không khớp với mật khẩu thực tế của tài khoản.");
          } else if (authError.code === 'auth/too-many-requests') {
            setUpdateStudentError("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
          } else {
            setUpdateStudentError("Lỗi hệ thống xác thực: " + authError.message);
          }
          setIsUpdatingStudent(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', editingStudent.id), {
        name: editStudentData.name,
        className: editStudentData.className,
        email: editStudentData.email,
        password: editStudentData.password
      });
      setEditingStudent(null);
    } catch (error: any) {
      console.error("Firestore update error:", error);
      setUpdateStudentError("Lỗi cập nhật dữ liệu: " + (error.message || "Không xác định"));
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFbStudent) return;
    try {
      await updateDoc(doc(db, 'users', editingFbStudent.id), {
        facebook: editFbData.facebook,
        zalo: editFbData.zalo
      });
      setEditingFbStudent(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingFbStudent.id}`);
    }
  };

  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteStudentError, setDeleteStudentError] = useState('');

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    setDeleteStudentError('');
    try {
      const student = students.find(s => s.id === studentToDelete);
      if (student) {
        if (student.status === 'pending') {
          await deleteDoc(doc(db, 'pending_students', studentToDelete));
          setStudents(students.filter(s => s.id !== studentToDelete));
          setStudentToDelete(null);
          return;
        }

        try {
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, student.email, student.password);
          await deleteUser(userCredential.user);
          await signOut(secondaryAuth);
        } catch (authError: any) {
          console.warn("Auth delete error (ignoring to allow Firestore deletion):", authError);
          // We ignore the auth error so the teacher can at least remove the student from the class list.
          // The Auth user might be orphaned, but without a Firestore doc, they have no access.
        }
      }

      await deleteDoc(doc(db, 'users', studentToDelete));
      setStudents(students.filter(s => s.id !== studentToDelete));
      setStudentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${studentToDelete}`);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleDeleteAllStudents = async () => {
    try {
      // In a real app, you might want to do this in batches if there are many students
      const deletePromises = students.map(student => deleteDoc(doc(db, 'users', student.id)));
      await Promise.all(deletePromises);
      setIsDeletingAll(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users`);
    }
  };

  const handleDeleteExam = async () => {
    if (!examToDelete || !appUser) return;
    try {
      const exam = exams.find(e => e.id === examToDelete);
      const classesToSync = exam?.assignedClasses || [];
      
      await deleteDoc(doc(db, 'exams', examToDelete));
      setExamToDelete(null);
      
      // Update local state first to make it visually faster
      const newExams = exams.filter(e => e.id !== examToDelete);
      setExams(newExams);
      
      for (const className of classesToSync) {
        await syncClassSummary(className);
      }
      
      await syncTeacherSummary(appUser.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exams/${examToDelete}`);
    }
  };

  const handleSyncOldData = async (examId: string) => {
    setSyncingExamId(examId);
    try {
      // 1. Fetch all submissions for this exam
      const qSubmissions = query(collection(db, 'submissions'), where('examId', '==', examId));
      const subSnap = await getDocs(qSubmissions);
      const subs = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // 2. Get unique submissions (latest per student)
      const map = new Map();
      subs.forEach(sub => {
        if (!map.has(sub.studentId)) {
          map.set(sub.studentId, sub);
        } else {
          const existing = map.get(sub.studentId);
          if (new Date(sub.submittedAt).getTime() > new Date(existing.submittedAt).getTime()) {
            map.set(sub.studentId, sub);
          }
        }
      });
      const uniqueSubs = Array.from(map.values());

      // 3. Build summary
      const summary = uniqueSubs.map(s => {
        const student = students.find(st => st.uid === s.studentId);
        return {
          submissionId: s.id,
          studentId: s.studentId,
          studentName: student ? student.name : 'Học sinh',
          score: s.score,
          incorrectQuestions: s.incorrectQuestions || [],
          submittedAt: s.submittedAt
        };
      });

      // 4. Update exam document
      await updateDoc(doc(db, 'exams', examId), {
        submissionSummary: summary
      });

      // 5. Update local state
      setExams(exams.map(e => e.id === examId ? { ...e, submissionSummary: summary } : e));
      alert('Đồng bộ dữ liệu cũ thành công!');
    } catch (error) {
      console.error("Error syncing old data:", error);
      alert('Có lỗi xảy ra khi đồng bộ dữ liệu.');
    } finally {
      setSyncingExamId(null);
    }
  };

  const handleExtendTime = async () => {
    if (!examToExtend || !newEndTime) return;
    try {
      const examRef = doc(db, 'exams', examToExtend.id);
      await updateDoc(examRef, { endTime: newEndTime });
      
      const classesToSync = examToExtend.assignedClasses || [];
      for (const cls of classesToSync) {
         await syncClassSummary(cls);
      }
      
      setExamToExtend(null);
      setNewEndTime('');
      
      // update local
      setExams(exams.map(e => e.id === examToExtend.id ? { ...e, endTime: newEndTime } : e));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exams/${examToExtend.id}`);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser?.uid || !newClass.name || !newClass.block) return;
    setIsCreatingClass(true);
    try {
      const docRef = await addDoc(collection(db, 'classes'), {
        name: newClass.name.trim(),
        block: newClass.block,
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      });
      
      const newClassData = {
        id: docRef.id,
        name: newClass.name.trim(),
        block: newClass.block,
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      };
      
      const updatedList = [...teacherClasses, newClassData];
      updatedList.sort((a: any, b: any) => {
        if (a.block !== b.block) return a.block.localeCompare(b.block);
        return a.name.localeCompare(b.name);
      });
      setTeacherClasses(updatedList);
      
      if (!availableClasses.includes(newClass.name.trim())) {
        const newAvailable = [...availableClasses, newClass.name.trim()].sort();
        setAvailableClasses(newAvailable);
      }
      
      setNewClass({ name: '', block: '10' });
      alert('Tạo lớp thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi tạo lớp.');
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      const classObj = teacherClasses.find(c => c.id === classToDelete);
      await deleteDoc(doc(db, 'classes', classToDelete));
      const newTeacherClasses = teacherClasses.filter(c => c.id !== classToDelete);
      setTeacherClasses(newTeacherClasses);
      
      if (classObj) {
        setAvailableClasses(prev => prev.filter(name => name !== classObj.name));
        if (activeClass === classObj.name) {
           setActiveClass(newTeacherClasses.length > 0 ? newTeacherClasses[0].name : '');
        }
      }

      setClassToDelete(null);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xóa lớp.');
    }
  };

  const handleCreateKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser?.uid || !newKnowledge.title || !newKnowledge.fileUrl) return;
    setIsCreatingKnowledge(true);
    try {
      const docRef = await addDoc(collection(db, 'knowledges'), {
        title: newKnowledge.title,
        block: newKnowledge.block,
        className: newKnowledge.className ? newKnowledge.className.trim() : '',
        fileUrl: newKnowledge.fileUrl,
        teacherId: appUser.uid,
        createdAt: new Date().toISOString()
      });
      setKnowledges([{ id: docRef.id, ...newKnowledge, teacherId: appUser.uid, createdAt: new Date().toISOString() }, ...knowledges]);
      
      // Update class summaries
      const targetClass = newKnowledge.className ? newKnowledge.className.trim() : '';
      if (targetClass) {
        await syncClassSummary(targetClass);
      } else if (newKnowledge.block) {
        // Sync all available classes in this block
        const blockClasses = teacherClasses.filter(c => c.block === newKnowledge.block).map(c => c.name);
        for (const cls of blockClasses) {
          await syncClassSummary(cls);
        }
      }
      
      await syncTeacherSummary(appUser.uid);
      
      setNewKnowledge({ title: '', block: '10', className: '', fileUrl: '' });
      alert('Tạo kiến thức thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi khi tạo kiến thức.');
    } finally {
      setIsCreatingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async () => {
    if (!knowledgeToDelete || !appUser) return;
    try {
      const knowledge = knowledges.find(k => k.id === knowledgeToDelete);
      
      await deleteDoc(doc(db, 'knowledges', knowledgeToDelete));
      setKnowledges(knowledges.filter(k => k.id !== knowledgeToDelete));
      setKnowledgeToDelete(null);
      
      if (knowledge?.className) {
        await syncClassSummary(knowledge.className);
      } else if (knowledge?.block) {
        const blockClasses = teacherClasses.filter(c => c.block === knowledge.block).map(c => c.name);
        for (const cls of blockClasses) {
          await syncClassSummary(cls);
        }
      }
      
      await syncTeacherSummary(appUser.uid);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi xóa kiến thức.');
    }
  };

  const handleUpdateKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKnowledge || !appUser?.uid) return;
    setIsUpdatingKnowledge(true);
    
    try {
      const oldKnowledge = knowledges.find(k => k.id === editingKnowledge.id);
      
      await updateDoc(doc(db, 'knowledges', editingKnowledge.id), {
        title: editingKnowledge.title,
        block: editingKnowledge.block,
        className: editingKnowledge.className ? editingKnowledge.className.trim() : '',
        fileUrl: editingKnowledge.fileUrl,
      });
      
      setKnowledges(knowledges.map(k => k.id === editingKnowledge.id ? { ...k, ...editingKnowledge, className: editingKnowledge.className ? editingKnowledge.className.trim() : '' } : k));
      setEditingKnowledge(null);
      
      // Update class summaries for both old and new classes to remove/add knowledge correctly
      const classTitlesToSync = new Set<string>();
      if (editingKnowledge.className) classTitlesToSync.add(editingKnowledge.className.trim());
      else {
         const blockClasses = teacherClasses.filter(c => c.block === editingKnowledge.block).map(c => c.name);
         blockClasses.forEach(cls => classTitlesToSync.add(cls));
      }

      if (oldKnowledge?.className) classTitlesToSync.add(oldKnowledge.className.trim());
      else if (oldKnowledge?.block) {
         const blockClasses = teacherClasses.filter(c => c.block === oldKnowledge.block).map(c => c.name);
         blockClasses.forEach(cls => classTitlesToSync.add(cls));
      }

      for (const cls of classTitlesToSync) {
        if (cls) await syncClassSummary(cls);
      }
      
      await syncTeacherSummary(appUser.uid);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi cập nhật tài liệu.');
    } finally {
      setIsUpdatingKnowledge(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0A1128] border-r border-[#1a2238] flex flex-col fixed inset-y-0 left-0 z-50">
        <div className="p-6 pb-2">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-[1rem] bg-indigo-600 flex flex-col items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <BookOpen className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <span className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>TỔNG QUAN</span>
          </div>

          <h3 className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            MENU GIÁO VIÊN
          </h3>
          
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('exams')}
              className={`w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'exams'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <FileText className="w-5 h-5 mr-3" strokeWidth={activeTab === 'exams' ? 2.5 : 1.5} />
              Quản lí Đề thi
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'knowledge'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <BookOpen className="w-5 h-5 mr-3" strokeWidth={activeTab === 'knowledge' ? 2.5 : 1.5} />
              Hệ thống kiến thức
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'students'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <Users className="w-5 h-5 mr-3" strokeWidth={activeTab === 'students' ? 2.5 : 1.5} />
              Học sinh
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'classes'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <FileText className="w-5 h-5 mr-3" strokeWidth={activeTab === 'classes' ? 2.5 : 1.5} />
              Quản lý Lớp
            </button>
            <button
              onClick={() => setActiveTab('facebook')}
              className={`w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                activeTab === 'facebook'
                  ? 'bg-indigo-600/10 text-indigo-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <MessageCircle className="w-5 h-5 mr-3" strokeWidth={activeTab === 'facebook' ? 2.5 : 1.5} />
              Liên hệ (Facebook)
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 m-4 bg-[#111827] border border-[#1f2937] rounded-3xl">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
              {appUser?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{appUser?.name}</p>
              <p className="text-xs text-slate-400 truncate">Giáo viên</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-2xl transition-colors font-semibold">
            <LogOut className="w-4 h-4 mr-3" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-72">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'exams' && 'Quản lí Đề thi'}
              {activeTab === 'knowledge' && 'Hệ thống kiến thức'}
              {activeTab === 'students' && 'Quản lý Học sinh & Lớp học'}
              {activeTab === 'facebook' && 'Thông tin Liên hệ (Facebook/Zalo)'}
            </h2>
            <div className="flex items-center space-x-4">
              {activeTab === 'exams' && (
                <Link to="/teacher/exam/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold flex items-center hover:bg-indigo-700 transition-colors shadow-sm text-sm">
                  <Plus className="w-5 h-5 mr-1.5" strokeWidth={2.5} /> Tạo đề thi mới
                </Link>
              )}
              <button onClick={fetchData} disabled={isRefreshing} className="flex items-center px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start">
              <AlertCircle className="w-5 h-5 text-rose-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-rose-700 font-medium">{error}</div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-2">
              <ul className="divide-y divide-gray-100">
                {exams.length === 0 ? (
                  <li className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium">Chưa có đề thi nào.</p>
                    <p className="text-sm mt-1">Hãy tạo đề thi đầu tiên của bạn!</p>
                  </li>
                ) : exams.map((exam, index) => (
                  <li key={exam.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                    <div className="px-6 py-5 flex justify-between items-center">
                      <div className="flex items-start">
                        <span className="text-xl font-black text-indigo-200 w-8 flex-shrink-0 mt-0.5">{index + 1}.</span>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{exam.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center bg-gray-100 px-2.5 py-1 rounded-md font-medium">
                              <Clock className="w-4 h-4 mr-1.5 text-gray-500" /> {exam.duration} phút
                            </span>
                            <span className={`px-2.5 py-1 rounded-md font-medium ${exam.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {exam.status === 'published' ? 'Đã giao' : 'Bản nháp'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600 flex items-center">
                            <span className="font-medium mr-1">Lớp được giao:</span> {exam.assignedClasses?.join(', ') || 'Chưa giao'}
                          </p>
                          {(exam.startTime || exam.endTime) && (
                            <p className="mt-1 text-sm text-gray-500">
                              Thời gian mở: {exam.startTime ? new Date(exam.startTime).toLocaleString('vi-VN') : 'Không giới hạn'} - {exam.endTime ? new Date(exam.endTime).toLocaleString('vi-VN') : 'Không giới hạn'}
                            </p>
                          )}
                          <div className="mt-1 flex items-center space-x-3">
                            <p className="text-sm font-semibold text-indigo-600">
                              Đã nộp: {exam.submissionSummary ? (() => {
                                const uniqueStudents = new Set(exam.submissionSummary.map((s: any) => s.studentId));
                                return uniqueStudents.size;
                              })() : 0} học sinh
                            </p>
                            {exam.submissionSummary === undefined && (
                              <button
                                onClick={() => handleSyncOldData(exam.id)}
                                disabled={syncingExamId === exam.id}
                                className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors flex items-center"
                              >
                                {syncingExamId === exam.id ? (
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                Đồng bộ dữ liệu cũ
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {exam.status === 'published' && (
                          <>
                            <button
                              onClick={() => {
                                const message = `🚨 BÀI TẬP MỚI 🚨\n\n📌 ${exam.title || 'Bài tập'}\n⏱️ Thời gian: ${exam.duration} phút\n${exam.startTime ? `⏰ Mở: ${new Date(exam.startTime).toLocaleString('vi-VN')}\n` : ''}${exam.endTime ? `⏳ Hạn chót: ${new Date(exam.endTime).toLocaleString('vi-VN')}\n` : ''}\n👉 Các em chú ý đăng nhập vào hệ thống để làm bài đúng hạn nhé!\n🔗 Link: ${window.location.origin}`;
                                navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy message:", err));
                                window.open('https://chat.zalo.me/', '_blank', 'noopener,noreferrer');
                              }}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium text-sm transition-colors flex items-center"
                              title="Mở Zalo và Copy thông báo"
                            >
                              <MessageCircle className="w-4 h-4 mr-1.5" /> Báo bài
                            </button>
                            <button
                              onClick={() => {
                                setExamToExtend(exam);
                                setNewEndTime(exam.endTime || '');
                              }}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium text-sm transition-colors"
                            >
                              Gia hạn
                            </button>
                            <Link to={`/teacher/exam/${exam.id}/results`} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors">
                              Xem kết quả
                            </Link>
                          </>
                        )}
                        <Link to={`/teacher/exam/${exam.id}/edit`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chỉnh sửa">
                          <Edit className="w-5 h-5" />
                        </Link>
                        <button 
                          onClick={() => setExamToDelete(exam.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                          title="Xóa"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Thêm bài mới</h3>
                <form onSubmit={handleCreateKnowledge} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tên bài học</label>
                    <input type="text" required value={newKnowledge.title} onChange={e => setNewKnowledge({...newKnowledge, title: e.target.value})} placeholder="Vd: Bài 1: Hàm số lượng giác" className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Khối</label>
                    <select value={newKnowledge.block} onChange={e => setNewKnowledge({...newKnowledge, block: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                      <option value="10">Khối 10</option>
                      <option value="11">Khối 11</option>
                      <option value="12">Khối 12</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Lớp (Tùy chọn)</label>
                    <select value={newKnowledge.className} onChange={e => setNewKnowledge({...newKnowledge, className: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                      <option value="">-- Dành cho tất cả các lớp trong khối --</option>
                      {teacherClasses.filter(c => c.block === newKnowledge.block).map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Link tài liệu (Hình ảnh / PDF / Drive)</label>
                    <input type="url" required value={newKnowledge.fileUrl} onChange={e => setNewKnowledge({...newKnowledge, fileUrl: e.target.value})} placeholder="https://..." className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <button type="submit" disabled={isCreatingKnowledge} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5">
                    {isCreatingKnowledge ? 'Đang thêm...' : 'Thêm bài học'}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">Danh sách bài học</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tên bài học</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Khối</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {knowledges.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                            Chưa có bài học nào được thêm.
                          </td>
                        </tr>
                      ) : (
                        [...new Set(knowledges.map(k => k.block || '10'))].sort((a,b) => parseInt(a||'0') - parseInt(b||'0')).map(block => (
                          <React.Fragment key={block}>
                            <tr className="bg-gray-100/80 border-y border-gray-200">
                              <td colSpan={4} className="px-6 py-3 text-left text-sm font-black text-indigo-800 uppercase tracking-wider bg-indigo-50/50">
                                Khối {block}
                              </td>
                            </tr>
                            {knowledges.filter(k => (k.block || '10') === block).map((k) => (
                              <tr key={k.id} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  <a href={k.fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline">
                                    {k.title}
                                  </a>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  Khối {k.block || '10'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {k.className || <span className="text-gray-400 italic">Tất cả</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                                  <button
                                    onClick={() => setEditingKnowledge(k)}
                                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    onClick={() => setKnowledgeToDelete(k.id)}
                                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                                  >
                                    Xóa
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Tạo tài khoản học sinh</h3>
                <form onSubmit={handleCreateStudent} className="space-y-5">
                  {studentError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700 font-medium">{studentError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và tên</label>
                    <input type="text" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Lớp</label>
                    <input type="text" required value={newStudent.className} onChange={e => setNewStudent({...newStudent, className: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <input type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu</label>
                    <input type="password" required minLength={6} value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <button type="submit" disabled={creatingStudent} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5">
                    {creatingStudent ? 'Đang tạo...' : 'Tạo tài khoản'}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Hoặc nhập từ file Excel</h4>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    File Excel cần có các cột: <strong>FullName</strong>, <strong>Class</strong>, <strong>Email</strong>, <strong>Password</strong>, <strong>Facebook</strong> (có thể thêm cột <strong>Role</strong> là "student").
                  </p>
                  <label className="w-full flex justify-center items-center py-3 px-4 border-2 border-dashed border-indigo-300 rounded-xl shadow-sm text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors">
                    {isImporting ? <span className="animate-pulse">Đang nhập...</span> : <><Upload className="w-5 h-5 mr-2" /> Chọn file Excel</>}
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} disabled={isImporting} />
                  </label>
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      Danh sách học sinh
                      {activeClass && (
                        <div className="ml-4 flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-sm">
                            Sĩ số: {students.filter(s => s.status === 'active').length}
                          </span>
                          {students.filter(s => s.status === 'pending').length > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm animate-pulse">
                              Chờ duyệt: {students.filter(s => s.status === 'pending').length}
                            </span>
                          )}
                        </div>
                      )}
                    </h3>
                    <select
                      value={activeClass}
                      onChange={(e) => setActiveClass(e.target.value)}
                      className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="">-- Chọn Cấp Lớp --</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          Lớp {cls}
                        </option>
                      ))}
                    </select>
                    {activeClass && (
                      <button 
                        onClick={handleManualSyncClass}
                        disabled={isSyncingClass}
                        className="text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-md flex items-center font-semibold transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${isSyncingClass ? 'animate-spin' : ''}`} />
                        Đồng bộ
                      </button>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    {isFetchingStudents && <span className="text-sm text-gray-500">Đang tải...</span>}
                    {students.length > 0 && (
                      <button 
                        onClick={() => setIsDeletingAll(true)}
                        className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg flex items-center font-bold transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Xóa toàn bộ
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-[22%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Họ tên</th>
                        <th className="w-[8%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp</th>
                        <th className="w-[24%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="w-[12%] px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mật khẩu</th>
                        <th className="w-[24%] px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Tiến độ làm bài</th>
                        <th className="w-[10%] px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {!activeClass ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            Vui lòng chọn một lớp học ở góc trên để xem danh sách học sinh.
                          </td>
                        </tr>
                      ) : students.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            Lớp này hiện chưa có học sinh nào.
                          </td>
                        </tr>
                      ) : (
                        students.map((student) => {
                          const now = new Date();
                        
                        const assignedExamsList = exams.filter(exam => 
                          exam.status === 'published' && 
                          exam.assignedClasses && 
                          exam.assignedClasses.includes(student.className)
                        );
                        
                        const totalAssignedExams = assignedExamsList.length;
                        
                        const openedExams = assignedExamsList.filter(exam => 
                          (!exam.startTime || new Date(exam.startTime) <= now)
                        ).length;

                        // Calculate completed exams using submissionSummary
                        const completedExams = assignedExamsList.filter(exam => {
                          if (!exam.submissionSummary) return false;
                          return exam.submissionSummary.some((s: any) => s.studentId === student.uid);
                        }).length;
                        
                        return (
                        <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${student.status === 'pending' ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-3 py-3 text-sm font-semibold text-gray-900" title={student.name}>
                            <div 
                              className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer inline-block" 
                              onClick={() => setViewingStudentDetails(student)}
                            >
                              {student.name}
                            </div>
                            {student.status === 'pending' && (
                              <span className="mt-1 ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                CHỜ PHÊ DUYỆT
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {student.className}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 truncate" title={student.email}>{student.email}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                            <span className="font-mono bg-gray-50 rounded px-1.5 py-1">{student.plainPassword || student.password || '***'}</span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium">
                            {student.status === 'pending' ? (
                               <span className="text-xs text-amber-600 font-medium">Chưa cấp quyền</span>
                            ) : (
                                <div 
                                  className="flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 p-2 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                  onClick={() => setViewingStudentExams(student)}
                                  title="Xem chi tiết bài làm của học sinh này"
                                >
                                  <span className="text-base font-bold text-emerald-600">
                                    {completedExams} <span className="text-gray-400 text-xs font-normal">/ {openedExams} / {totalAssignedExams}</span>
                                  </span>
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Đã làm / Đã mở / Đã giao</span>
                                </div>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end items-center space-x-2">
                              {student.status === 'pending' && (
                                <button 
                                  onClick={() => handleAcceptStudent(student.id)}
                                  disabled={acceptingStudentId === student.id}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                                  title="Duyệt"
                                >
                                  {acceptingStudentId === student.id ? 'Đang duyệt...' : 'Duyệt'}
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  setEditingStudent(student);
                                  setEditStudentData({ name: student.name, className: student.className || '', email: student.email || '', password: student.plainPassword || student.password || '' });
                                  setUpdateStudentError('');
                                }}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setStudentToDelete(student.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'facebook' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Danh sách liên hệ Học sinh</h3>
                <p className="text-sm text-gray-500 mt-1">Quản lý link Facebook và số Zalo để gửi thông báo cho học sinh</p>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={activeClass}
                  onChange={(e) => setActiveClass(e.target.value)}
                  className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="">-- Chọn Cấp Lớp --</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Lớp {cls}
                    </option>
                  ))}
                </select>
                {isFetchingStudents && <span className="text-sm text-gray-500">Đang tải...</span>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Họ tên</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Facebook</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Zalo</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {!activeClass ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Vui lòng chọn một lớp học ở góc trên để xem danh sách liên hệ.
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Lớp này hiện chưa có học sinh nào.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const now = new Date();
                    const assignedExamsList = exams.filter(exam => 
                      exam.status === 'published' && 
                      exam.assignedClasses && 
                      exam.assignedClasses.includes(student.className)
                    );
                    const incompleteExams = assignedExamsList.filter(exam => {
                      const isOpened = (!exam.startTime || new Date(exam.startTime) <= now);
                      if (!isOpened) return false;
                      if (!exam.submissionSummary) return true;
                      return !exam.submissionSummary.some((s: any) => s.studentId === student.uid);
                    });

                    const handleContactClick = (e: React.MouseEvent) => {
                      if (incompleteExams.length > 0) {
                        const listString = incompleteExams.map((ex, idx) => `📌 ${idx + 1}. ${ex.title || 'Bài tập'}`).join('\n');
                        const message = `🚨 NHẮC NHỞ LÀM BÀI TẬP 🚨\n\nChào ${student.name}, hệ thống ghi nhận em còn các bài tập sau chưa hoàn thành (hoặc giáo viên chưa đồng bộ điểm):\n${listString}\n\n👉 Em vui lòng đăng nhập vào hệ thống để kiểm tra và làm bài nhé!\n🔗 Link: ${window.location.origin}`;
                        
                        navigator.clipboard.writeText(message).catch(err => {
                          console.error("Failed to copy message:", err);
                        });
                      } else {
                        const message = `Chào ${student.name}, em đã hoàn thành tất cả bài tập được giao. Chúc em học tập tốt!`;
                        navigator.clipboard.writeText(message).catch(err => console.error(err));
                      }
                    };

                    return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                         <div 
                           className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer inline-block" 
                           onClick={() => setViewingStudentDetails(student)}
                         >
                           {student.name}
                         </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {student.className}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.facebook ? (
                          <a 
                            href={student.facebook} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={handleContactClick}
                            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                            title="Mở Facebook và Copy tin nhắn nhắc nhở"
                          >
                            <MessageCircle className="w-4 h-4 mr-1.5" /> Nhắn tin
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.zalo ? (
                          <a 
                            href={`https://chat.zalo.me/?phone=${student.zalo}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={handleContactClick}
                            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                            title="Mở Zalo và Copy tin nhắn nhắc nhở"
                          >
                            <MessageCircle className="w-4 h-4 mr-1.5" />
                            {student.zalo}
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingFbStudent(student);
                            setEditFbData({ facebook: student.facebook || '', zalo: student.zalo || '' });
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Cập nhật Liên hệ"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Thêm lớp mới</h3>
                <form onSubmit={handleCreateClass} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Khối</label>
                    <select value={newClass.block} onChange={e => setNewClass({...newClass, block: e.target.value})} className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                      <option value="10">Khối 10</option>
                      <option value="11">Khối 11</option>
                      <option value="12">Khối 12</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tên lớp</label>
                    <input type="text" required value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} placeholder="Vd: 10A1" className="block w-full border border-gray-300 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                  </div>
                  <button type="submit" disabled={isCreatingClass} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5">
                    {isCreatingClass ? 'Đang thêm...' : 'Tạo lớp'}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                    Danh sách các lớp đã tạo
                  </h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {teacherClasses.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-1">Chưa có lớp nào</p>
                      <p className="text-sm">Hãy tạo lớp học đầu tiên của bạn ở form bên cạnh.</p>
                    </div>
                  ) : (
                    teacherClasses.map((cls) => (
                      <div key={cls.id} className="p-6 hover:bg-gray-50 transition-colors duration-150 flex justify-between items-start group">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 mb-1">{cls.name}</h4>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Khối {cls.block}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setClassToDelete(cls.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Xóa lớp"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingFbStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cập nhật Liên hệ</h3>
            <p className="text-sm text-gray-600 mb-4">Học sinh: <span className="font-semibold">{editingFbStudent.name}</span></p>
            <form onSubmit={handleUpdateContact}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Đường link Facebook</label>
                  <input type="url" value={editFbData.facebook} onChange={e => setEditFbData({...editFbData, facebook: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="https://facebook.com/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Số điện thoại Zalo</label>
                  <input type="tel" value={editFbData.zalo} onChange={e => setEditFbData({...editFbData, zalo: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="0912..." />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingFbStudent(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Student Details Modal */}
      {viewingStudentDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">Thông tin chi tiết Học sinh</h3>
              <button 
                onClick={() => setViewingStudentDetails(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Thông tin cá nhân</h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Họ và tên</span>
                      <span className="text-gray-900 font-medium">{viewingStudentDetails.name}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Ngày sinh</span>
                      <span className="text-gray-900">{viewingStudentDetails.dob ? viewingStudentDetails.dob.split('-').reverse().join('/') : <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Lớp</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {viewingStudentDetails.className}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Trường</span>
                      <span className="text-gray-900">{viewingStudentDetails.schoolInfo || <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Địa chỉ</span>
                      <span className="text-gray-900">{viewingStudentDetails.address || <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Thông tin liên hệ</h4>
                  <div className="space-y-4">
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Email đăng nhập</span>
                      <span className="text-gray-900">{viewingStudentDetails.email}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Số Zalo/SĐT Học sinh</span>
                      <span className="text-gray-900">{viewingStudentDetails.zalo || <span className="text-gray-400 italic">Chưa cập nhật</span>}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Facebook cá nhân</span>
                      {viewingStudentDetails.facebook ? (
                        <a 
                          href={viewingStudentDetails.facebook.startsWith('http') ? viewingStudentDetails.facebook : `https://${viewingStudentDetails.facebook}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                        >
                          {viewingStudentDetails.facebook}
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">Chưa cập nhật</span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <span className="block text-xs font-semibold text-indigo-500 mb-1">Phụ huynh (Họ tên)</span>
                      <span className="text-gray-900 font-medium">{viewingStudentDetails.parentName || <span className="text-gray-400 italic text-sm">Chưa cập nhật</span>}</span>
                      {viewingStudentDetails.parentRelation && <span className="ml-2 text-xs text-gray-500">({viewingStudentDetails.parentRelation})</span>}
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-indigo-500 mb-1">Số điện thoại Phụ huynh</span>
                      <span className="text-gray-900 font-medium">{viewingStudentDetails.parentPhone || <span className="text-gray-400 italic text-sm">Chưa cập nhật</span>}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Student Exams Modal */}
      {viewingStudentExams && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bài làm của học sinh</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-semibold text-indigo-600">{viewingStudentExams.name}</span> - Lớp {viewingStudentExams.className}
                </p>
              </div>
              <button onClick={() => setViewingStudentExams(null)} className="text-gray-400 hover:text-gray-500 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {(() => {
                const assignedExamsList = exams.filter(exam => 
                  exam.status === 'published' && 
                  exam.assignedClasses && 
                  exam.assignedClasses.includes(viewingStudentExams.className)
                );

                if (assignedExamsList.length === 0) {
                  return <div className="text-center py-8 text-gray-500">Chưa có bài thi nào được giao cho lớp này.</div>;
                }

                return (
                  <div className="space-y-4">
                    {assignedExamsList.map(exam => {
                      const submission = exam.submissionSummary?.find((s: any) => s.studentId === viewingStudentExams.uid);
                      const isCompleted = !!submission;
                      
                      return (
                        <div key={exam.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">{exam.title}</h4>
                            <div className="flex items-center text-sm text-gray-500 mt-1 space-x-4">
                              <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {exam.duration} phút</span>
                              {isCompleted ? (
                                <span className="flex items-center text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Đã nộp bài
                                </span>
                              ) : (
                                <span className="flex items-center text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
                                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> Chưa làm
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[140px]">
                            {isCompleted && (
                              <div className="text-right">
                                <div className="text-2xl font-black text-indigo-600 leading-none">{submission.score}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-1">Điểm số</div>
                              </div>
                            )}
                            
                            {isCompleted && (
                              <button
                                onClick={() => {
                                  // Navigate to the result page
                                  window.open(`/teacher/exam/${exam.id}/result/${viewingStudentExams.uid}`, '_blank');
                                }}
                                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                              >
                                Xem chi tiết
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Viewing Student Exams Modal */}
      {viewingStudentExams && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bài làm của học sinh</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-semibold text-indigo-600">{viewingStudentExams.name}</span> - Lớp {viewingStudentExams.className}
                </p>
              </div>
              <button onClick={() => setViewingStudentExams(null)} className="text-gray-400 hover:text-gray-500 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {(() => {
                const assignedExamsList = exams.filter(exam => 
                  exam.status === 'published' && 
                  exam.assignedClasses && 
                  exam.assignedClasses.includes(viewingStudentExams.className)
                );

                if (assignedExamsList.length === 0) {
                  return <div className="text-center py-8 text-gray-500">Chưa có bài thi nào được giao cho lớp này.</div>;
                }

                return (
                  <div className="space-y-4">
                    {assignedExamsList.map(exam => {
                      const submission = exam.submissionSummary?.find((s: any) => s.studentId === viewingStudentExams.uid);
                      const isCompleted = !!submission;
                      
                      return (
                        <div key={exam.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">{exam.title}</h4>
                            <div className="flex items-center text-sm text-gray-500 mt-1 space-x-4">
                              <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {exam.duration} phút</span>
                              {isCompleted ? (
                                <span className="flex items-center text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Đã nộp bài
                                </span>
                              ) : (
                                <span className="flex items-center text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
                                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> Chưa làm
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[140px]">
                            {isCompleted && (
                              <div className="text-right">
                                <div className="text-2xl font-black text-indigo-600 leading-none">{submission.score}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-1">Điểm số</div>
                              </div>
                            )}
                            
                            {isCompleted && (
                              <button
                                onClick={() => {
                                  // Navigate to the result page
                                  window.open(`/teacher/exam/${exam.id}/result/${viewingStudentExams.uid}`, '_blank');
                                }}
                                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                              >
                                Xem chi tiết
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Chỉnh sửa Học sinh</h3>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {updateStudentError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                {updateStudentError}
              </div>
            )}
            <form onSubmit={handleUpdateStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Họ và tên</label>
                <input type="text" required value={editStudentData.name} onChange={e => setEditStudentData({...editStudentData, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lớp</label>
                <input type="text" required value={editStudentData.className} onChange={e => setEditStudentData({...editStudentData, className: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" required value={editStudentData.email} onChange={e => setEditStudentData({...editStudentData, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
                <input type="text" required value={editStudentData.password} onChange={e => setEditStudentData({...editStudentData, password: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                <p className="mt-1 text-xs text-gray-500">Lưu ý: Thay đổi email hoặc mật khẩu ở đây sẽ cập nhật trực tiếp tài khoản đăng nhập của học sinh.</p>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingStudent(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" disabled={isUpdatingStudent}>
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center" disabled={isUpdatingStudent}>
                  {isUpdatingStudent ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirm Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa học sinh</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa học sinh này không? Hành động này không thể hoàn tác và sẽ xóa cả tài khoản đăng nhập của học sinh.
            </p>
            {deleteStudentError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                {deleteStudentError}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button onClick={() => {
                setStudentToDelete(null);
                setDeleteStudentError('');
              }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" disabled={isDeletingStudent}>
                Hủy
              </button>
              <button onClick={handleDeleteStudent} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center" disabled={isDeletingStudent}>
                {isDeletingStudent ? 'Đang xóa...' : 'Xóa học sinh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Students Confirm Modal */}
      {isDeletingAll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa TOÀN BỘ học sinh</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa <strong>tất cả {students.length} học sinh</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setIsDeletingAll(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteAllStudents} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Xóa toàn bộ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Knowledge Confirm Modal */}
      {knowledgeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa tài liệu</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa tài liệu này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setKnowledgeToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteKnowledge} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center">
                Xóa tài liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Knowledge Modal */}
      {editingKnowledge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Sửa thông tin tài liệu</h3>
            <form onSubmit={handleUpdateKnowledge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tên bài học</label>
                <input type="text" required value={editingKnowledge.title} onChange={e => setEditingKnowledge({...editingKnowledge, title: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Khối</label>
                <select value={editingKnowledge.block} onChange={e => setEditingKnowledge({...editingKnowledge, block: e.target.value, className: ''})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lớp (Tùy chọn)</label>
                <select value={editingKnowledge.className} onChange={e => setEditingKnowledge({...editingKnowledge, className: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="">-- Dành cho tất cả các lớp trong khối --</option>
                  {teacherClasses.filter(c => c.block === editingKnowledge.block).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Link tài liệu</label>
                <input type="url" required value={editingKnowledge.fileUrl} onChange={e => setEditingKnowledge({...editingKnowledge, fileUrl: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingKnowledge(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" disabled={isUpdatingKnowledge}>
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center" disabled={isUpdatingKnowledge}>
                  {isUpdatingKnowledge ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Exam Confirm Modal */}
      {examToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa đề thi</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa đề thi này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setExamToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteExam} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                Xóa đề thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Time Modal */}
      {examToExtend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Gia hạn thời gian</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc mới</label>
              <input 
                type="datetime-local" 
                value={newEndTime} 
                onChange={(e) => setNewEndTime(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setExamToExtend(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleExtendTime} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirm Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa lớp học</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xóa lớp này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setClassToDelete(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleDeleteClass} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center">
                Xóa lớp
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
