import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { BookOpen, Mail, Lock, LogIn, AlertCircle, Calculator, Sigma, Pi, FunctionSquare, Binary, Ruler, X, CheckCircle } from 'lucide-react';

export default function Login() {
  const { user, appUser, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Registration states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regSuccess, setRegSuccess] = useState<{email: string, password: string, phone: string} | null>(null);
  const [regForm, setRegForm] = useState({
    fullName: '', dob: '', schoolInfo: '', address: '', zalo: '', personalEmail: '', facebook: '',
    parentName: '', parentRelation: '', parentPhone: '', block: '10', classSelected: ''
  });
  
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);

  React.useEffect(() => {
    if (showRegisterModal) {
      const fetchClasses = async () => {
        try {
          const q = query(collection(db, 'classes'));
          const snap = await getDocs(q);
          const classes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAvailableClasses(classes);
        } catch (error) {
          console.error("Lỗi khi tải danh sách lớp:", error);
        }
      };
      fetchClasses();
    }
  }, [showRegisterModal]);

  if (user && appUser) {
    return <Navigate to="/" />;
  }

  const handleTeacherLogin = async () => {
    try {
      setError('');
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        setError('Lỗi kết nối mạng hoặc trình duyệt chặn popup/cookie. Vui lòng thử mở ứng dụng trong tab mới (nhấn vào biểu tượng mở tab mới ở góc trên bên phải) hoặc tắt trình chặn quảng cáo.');
      } else {
        setError(err.message || 'Lỗi đăng nhập Google');
      }
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      
      // Check if status is pending
      const docRef = doc(db, 'users', cred.user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().status === 'pending') {
        await signOut(auth);
        setError('Tài khoản của bạn chưa được thầy xác nhận. Vui lòng liên hệ Thầy Trọng sđt: 0352445795 để được xác nhận!');
        return;
      }
      
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          const q = query(collection(db, 'pending_students'), where('email', '==', email.trim()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            setError('Tài khoản của bạn đang chờ phê duyệt. Vui lòng liên hệ Thầy Nguyễn Đình Trọng SĐT/Zalo: 0352445795 để được kích hoạt!');
            return;
          }
        } catch (dbErr) {
          console.error("Pending lookup error:", dbErr);
        }
      }

      if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        setError('Lỗi kết nối mạng. Vui lòng thử mở ứng dụng trong tab mới hoặc tắt trình chặn quảng cáo.');
      } else {
        setError(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Email hoặc mật khẩu không chính xác.' 
          : err.message || 'Lỗi đăng nhập Học sinh');
      }
    }
  };

  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setError('');
    try {
      const nameClean = removeAccents(regForm.fullName).toLowerCase().replace(/\s+/g, '');
      let generatedEmail = `${nameClean}@gmail.com`;
      
      const nameParts = regForm.fullName.trim().split(' ');
      const firstName = nameParts[nameParts.length - 1];
      const firstNameClean = removeAccents(firstName);
      const capitalizedFirst = firstNameClean.charAt(0).toUpperCase() + firstNameClean.slice(1).toLowerCase();
      
      const dobParts = regForm.dob.split('-');
      const dobString = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`; // DDMMYYYY
      
      const generatedPassword = `${capitalizedFirst}${dobString}@`;

      // Check if already registered or exists in users
      let alreadyExists = false;
      const qUser = query(collection(db, 'users'), where('email', '==', generatedEmail));
      const userSnap = await getDocs(qUser).catch(() => null);
      if (userSnap && !userSnap.empty) {
        alreadyExists = true;
      } else {
        const qPending = query(collection(db, 'pending_students'), where('email', '==', generatedEmail));
        const pendingSnap = await getDocs(qPending).catch(() => null);
        if (pendingSnap && !pendingSnap.empty) {
          alreadyExists = true;
        }
      }

      if (alreadyExists) {
        generatedEmail = `${nameClean}${Math.floor(Math.random() * 1000)}@gmail.com`;
      }

      await addDoc(collection(db, 'pending_students'), {
        name: regForm.fullName,
        email: generatedEmail,
        personalEmail: regForm.personalEmail,
        role: 'student',
        status: 'pending',
        dob: regForm.dob,
        className: regForm.classSelected || regForm.schoolInfo, // fallback if they don't select
        schoolInfo: regForm.schoolInfo,
        address: regForm.address,
        zalo: regForm.zalo,
        facebook: regForm.facebook,
        parentName: regForm.parentName,
        parentRelation: regForm.parentRelation,
        parentPhone: regForm.parentPhone,
        block: regForm.block,
        plainPassword: generatedPassword,
        createdAt: new Date().toISOString()
      });

      setRegSuccess({ email: generatedEmail, password: generatedPassword, phone: '0352445795' });
      
    } catch (err: any) {
      console.error(err);
      setError('Đã xảy ra lỗi khi đăng ký. Vui lòng thử lại.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center relative overflow-hidden selection:bg-indigo-500/30">
      {/* Math Floating Icons */}
      <div className="absolute top-10 left-10 text-indigo-200/50 animate-[pulse_4s_ease-in-out_infinite] transform -rotate-12">
        <Calculator size={120} strokeWidth={1} />
      </div>
      <div className="absolute bottom-10 right-10 text-purple-200/50 animate-[pulse_5s_ease-in-out_infinite] transform rotate-12">
        <Sigma size={160} strokeWidth={1} />
      </div>
      <div className="absolute top-40 right-20 text-teal-200/50 animate-[bounce_6s_ease-in-out_infinite] transform rotate-45">
        <Pi size={100} strokeWidth={1} />
      </div>
      <div className="absolute bottom-32 left-20 text-indigo-300/30 animate-[bounce_5s_ease-in-out_infinite_reverse] transform -rotate-45">
        <FunctionSquare size={130} strokeWidth={1} />
      </div>
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '4s' }}></div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-[480px] px-4 sm:px-0">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-xl shadow-indigo-500/30 mb-8 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <BookOpen className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
          <h2 
            className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 via-purple-700 to-indigo-800 pb-2 tracking-tighter drop-shadow-sm leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            TOÁN THẦY TRỌNG 3T
          </h2>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <div className="h-px w-8 bg-indigo-200"></div>
            <p className="text-sm sm:text-base text-indigo-600 font-bold tracking-[0.3em] uppercase drop-shadow-sm" style={{ fontFamily: 'var(--font-display)' }}>
              Quản lí học thêm
            </p>
            <div className="h-px w-8 bg-indigo-200"></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl py-10 px-6 shadow-[0_8px_40px_rgb(0,0,0,0.08)] sm:rounded-[2.5rem] sm:px-12 border border-white/60">
          {error && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-medium flex items-start shadow-sm">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
          
          <div className="mb-8">
            <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-5 text-center">Dành cho Giáo viên</h3>
            <button
              onClick={handleTeacherLogin}
              className="w-full flex items-center justify-center py-4 px-4 border-2 border-indigo-50 rounded-2xl shadow-sm bg-white hover:bg-indigo-50/50 hover:border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 transform hover:-translate-y-1 group"
            >
              <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-base font-bold text-slate-700">Đăng nhập tài khoản Google</span>
            </button>
          </div>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-6 bg-white/80 backdrop-blur-xl text-slate-300 font-black uppercase tracking-widest text-xs">Phần của Học sinh</span>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleStudentLogin}>
            <div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white sm:text-sm font-medium transition-all"
                  placeholder="Email đăng nhập"
                />
              </div>
            </div>

            <div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white sm:text-sm font-medium transition-all"
                  placeholder="Mật khẩu"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-indigo-500/30 text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:-translate-y-1"
              >
                <LogIn className="w-5 h-5 mr-3" />
                Vào Lớp Học
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
             <p className="text-sm text-slate-500">
               Bạn là học viên mới?{' '}
               <button onClick={() => setShowRegisterModal(true)} className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                 Đăng ký học ngay
               </button>
             </p>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-[#0A1128]/80 backdrop-blur-sm flex items-start justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-2xl w-full shadow-2xl transform transition-all border border-slate-100 my-4 md:my-8 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-800 to-purple-700 tracking-tight">PHIẾU ĐĂNG KÝ HỌC THÊM</h3>
              <button onClick={() => { setShowRegisterModal(false); setRegSuccess(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {regSuccess ? (
              <div className="text-center py-8 overflow-y-auto flex-1 pr-2">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-6">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h4 className="text-2xl font-bold text-slate-800 mb-4">Đăng ký thành công!</h4>
                <div className="bg-indigo-50 rounded-2xl p-6 text-left mb-6 border border-indigo-100/50 inline-block w-full max-w-md mx-auto">
                   <p className="text-sm text-indigo-600 font-bold uppercase tracking-wider mb-4">Thông tin đăng nhập của bạn</p>
                   <div className="space-y-3">
                     <div>
                       <span className="text-slate-500 text-sm block mb-1">Tài khoản (Email)</span>
                       <span className="font-mono text-lg font-bold text-slate-800">{regSuccess.email}</span>
                     </div>
                     <div>
                       <span className="text-slate-500 text-sm block mb-1">Mật khẩu</span>
                       <span className="font-mono text-lg font-bold text-slate-800">{regSuccess.password}</span>
                     </div>
                   </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl max-w-md mx-auto mb-2">
                   <p className="text-amber-800 text-sm font-medium">
                     Hãy liên hệ với giáo viên: <strong className="font-bold text-amber-900">Thầy Trọng</strong> qua SĐT/Zalo: <strong className="font-bold text-amber-900">{regSuccess.phone}</strong> để được xác nhận đăng ký và kích hoạt tài khoản!
                   </p>
                </div>
                <button
                  onClick={() => { setShowRegisterModal(false); setRegSuccess(null); }}
                  className="mt-6 px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <form onSubmit={handleStudentRegister} className="flex flex-col flex-1 overflow-hidden">
                <div className="overflow-y-auto flex-1 pr-2 space-y-8 pb-4">
                  <p className="text-slate-500 text-sm">Vui lòng điền đầy đủ và chính xác thông tin bên dưới để hoàn tất thủ tục nhập học.</p>
                  
                  {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-medium flex items-start shadow-sm">
                      <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  )}
                  
                  {/* 1. Thông tin học sinh */}
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-800 pb-2 mb-4 inline-block">1. Thông tin học sinh</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Họ và tên</label>
                         <input type="text" required value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Ngày sinh</label>
                         <input type="date" required value={regForm.dob} onChange={e => setRegForm({...regForm, dob: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Lớp - Trường đang học</label>
                         <input type="text" required value={regForm.schoolInfo} onChange={e => setRegForm({...regForm, schoolInfo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="VD: 10A1 - THPT A" />
                      </div>
                      <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Địa chỉ</label>
                         <input type="text" value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Số điện thoại dùng Zalo</label>
                         <input type="tel" required value={regForm.zalo} onChange={e => setRegForm({...regForm, zalo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Email cá nhân</label>
                         <input type="email" value={regForm.personalEmail} onChange={e => setRegForm({...regForm, personalEmail: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">ID Facebook cá nhân</label>
                         <input type="text" value={regForm.facebook} onChange={e => setRegForm({...regForm, facebook: e.target.value})} placeholder="VD: facebook.com/nguyenvanan" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                    </div>
                  </div>

                  {/* 2. Thông tin phụ huynh */}
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-800 pb-2 mb-4 inline-block">2. Thông tin phụ huynh <span className="text-slate-400 font-medium normal-case">(Nếu học viên là học sinh)</span></h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Họ tên phụ huynh</label>
                         <input type="text" value={regForm.parentName} onChange={e => setRegForm({...regForm, parentName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Quan hệ với học sinh</label>
                         <input type="text" value={regForm.parentRelation} onChange={e => setRegForm({...regForm, parentRelation: e.target.value})} placeholder="VD: Cha, Mẹ" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Số điện thoại liên hệ</label>
                         <input type="tel" value={regForm.parentPhone} onChange={e => setRegForm({...regForm, parentPhone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" />
                      </div>
                    </div>
                  </div>

                  {/* 3. Nội dung đăng ký */}
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-800 pb-2 mb-4 inline-block">3. Nội dung đăng ký</h4>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <label className="block text-sm font-bold text-slate-800 mb-3">Chọn khối lớp:</label>
                      <div className="flex space-x-3 mb-5">
                        {['10', '11', '12'].map((b) => (
                          <button
                            type="button"
                            key={b}
                            onClick={() => setRegForm({...regForm, block: b, classSelected: ''})}
                            className={`px-6 py-2.5 rounded-xl font-bold transition-all ${regForm.block === b ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                          >
                            Khối {b}
                          </button>
                        ))}
                      </div>

                      <label className="block text-sm font-bold text-slate-800 mb-3">Chọn lớp học:</label>
                      <select 
                        required={availableClasses.filter(c => c.block === regForm.block).length > 0}
                        value={regForm.classSelected} 
                        onChange={(e) => setRegForm({...regForm, classSelected: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition font-semibold text-slate-700"
                      >
                        <option value="" disabled>-- Vui lòng chọn lớp học --</option>
                        {availableClasses.filter(c => c.block === regForm.block).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      {availableClasses.filter(c => c.block === regForm.block).length === 0 && (
                        <p className="text-xs text-amber-600 mt-2 mt-2 bg-amber-50 rounded-lg p-3">* Chưa có danh sách lớp cho khối này. Bạn có thể bỏ qua và tiếp tục nộp đơn.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 shrink-0">
                   <button type="button" onClick={() => setShowRegisterModal(false)} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">Hủy</button>
                   <button type="submit" disabled={isRegistering} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50">
                     {isRegistering ? 'Đang đăng ký...' : 'Hoàn tất đăng ký'}
                   </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
