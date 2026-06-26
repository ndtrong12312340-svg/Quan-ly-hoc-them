import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { fetchClassDataDirectly } from '../lib/syncUtils';
import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { LogOut, PlayCircle, CheckCircle, RefreshCw, MessageCircle, AlertCircle, BookOpen, User, Calendar, Settings, LayoutDashboard, Database } from 'lucide-react';

export default function StudentDashboard() {
  const { appUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'knowledge' | 'exams'>('profile');
  
  const [exams, setExams] = useState<any[]>([]);
  const [knowledges, setKnowledges] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [fbLink, setFbLink] = useState(appUser?.facebook || '');
  const [zaloPhone, setZaloPhone] = useState(appUser?.zalo || '');
  const [isUpdatingContact, setIsUpdatingContact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appUser && (!appUser.facebook || !appUser.zalo)) {
      setShowContactModal(true);
    } else {
      setShowContactModal(false);
    }
  }, [appUser]);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser?.uid) return;
    setIsUpdatingContact(true);
    try {
      await updateDoc(doc(db, 'users', appUser.uid), {
        facebook: fbLink,
        zalo: zaloPhone
      });
      setShowContactModal(false);
      alert('Cập nhật liên hệ thành công!');
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${appUser.uid}`);
    } finally {
      setIsUpdatingContact(false);
    }
  };

  const [hasFetchedSummary, setHasFetchedSummary] = useState(false);

  const fetchClassSummary = async (forceDirect = false) => {
    if (!appUser?.className || hasFetchedSummary) return;
    setIsRefreshing(true);
    try {
      const data = await fetchClassDataDirectly(appUser.className);
      
      const knowledgesList = data.knowledges || [];
      knowledgesList.sort((a: any, b: any) => {
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

      const examsList = data.exams || [];
      examsList.sort((a: any, b: any) => {
        const titleA = a.title || '';
        const titleB = b.title || '';
        const matchA = titleA.match(/\d+/);
        const matchB = titleB.match(/\d+/);
        if (matchA && matchB) {
          const numA = parseInt(matchA[0], 10);
          const numB = parseInt(matchB[0], 10);
          if (numA !== numB) return numA - numB;
        }
        return titleA.localeCompare(titleB);
      });
      setExams(examsList);
      setHasFetchedSummary(true);
    } catch (err: any) {
      console.error("Error fetching class summary:", err);
      if (err.message && err.message.includes('Quota')) {
        setError('Hệ thống đang tải (vượt quá giới hạn quota).');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (appUser?.completedExams && Array.isArray(appUser.completedExams)) {
      setSubmissions(appUser.completedExams);
    } else {
      setSubmissions([]);
    }
  }, [appUser?.completedExams]);

  useEffect(() => {
    if (activeTab === 'knowledge' || activeTab === 'exams') {
      fetchClassSummary();
    }
  }, [activeTab, appUser?.uid, appUser?.className]);

  const handleRefresh = () => {
    if (activeTab === 'knowledge' || activeTab === 'exams') {
      setHasFetchedSummary(false);
      setTimeout(() => {
        fetchClassSummary(true);
      }, 0);
    }
  };

  const getSubmission = (examId: string) => {
    return submissions.find(s => s.examId === examId);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Sidebar / Topbar */}
      <aside className="w-full md:w-72 bg-[#0d1326] border-b md:border-b-0 md:border-r border-[#1a2238] flex md:flex-col fixed top-0 left-0 z-50 md:inset-y-0 h-auto md:h-full items-center md:items-stretch">
        <div className="flex-1 flex md:flex-col overflow-x-auto overflow-y-hidden md:overflow-visible p-3 md:p-6 md:pb-2 scrollbar-hide items-center md:items-stretch">
          <div className="flex items-center space-x-3 md:mb-8 shrink-0 mr-6 md:mr-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-[1rem] bg-blue-600 flex flex-col items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.5} />
            </div>
            <span className="text-xl md:text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>TỔNG QUAN</span>
          </div>

          <h3 className="hidden md:block px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            MENU HỌC SINH
          </h3>
          
          <nav className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-blue-600/10 text-blue-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <User className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'profile' ? 2.5 : 1.5} />
              Thông tin cá nhân
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'knowledge'
                  ? 'bg-blue-600/10 text-blue-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <BookOpen className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'knowledge' ? 2.5 : 1.5} />
              Hệ thống kiến thức
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`flex items-center px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl transition-all duration-200 whitespace-nowrap ${
                activeTab === 'exams'
                  ? 'bg-blue-600/10 text-blue-400 font-bold'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 font-medium'
              }`}
            >
              <CheckCircle className="w-5 h-5 mr-2 md:mr-3" strokeWidth={activeTab === 'exams' ? 2.5 : 1.5} />
              Làm bài & Kết quả
            </button>
          </nav>
        </div>

        <div className="shrink-0 p-3 md:mt-auto md:p-4 md:m-4 md:bg-[#111827] md:border md:border-[#1f2937] md:rounded-3xl flex md:block items-center">
          <div className="hidden md:flex items-center space-x-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
              {appUser?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{appUser?.name}</p>
              <p className="text-xs text-slate-400 truncate">Học Sinh</p>
            </div>
          </div>
          <button onClick={logout} className="md:w-full flex items-center px-3 md:px-4 py-2 md:py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-xl md:rounded-2xl transition-colors font-semibold" title="Đăng xuất">
            <LogOut className="w-5 h-5 md:w-4 md:h-4 md:mr-3" />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 mt-[72px] md:mt-0 md:ml-72">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-slate-200">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">
              {activeTab === 'profile' && 'Thông tin cá nhân học sinh'}
              {activeTab === 'knowledge' && 'Hệ thống kiến thức'}
              {activeTab === 'exams' && 'Làm bài & Kết quả'}
            </h2>
            <div className="flex items-center space-x-4">
               <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm">
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

          {activeTab === 'profile' && (
            <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-6 md:p-8 max-w-3xl">
              <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 mb-8 pb-8 border-b border-slate-100">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-100">
                  {appUser?.name?.[0]?.toUpperCase()}
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">{appUser?.name}</h3>
                  <p className="text-blue-600 font-bold mt-1 text-sm bg-blue-50 px-3 py-1 rounded-full inline-block">
                    Học sinh lớp: {appUser?.className}
                  </p>
                  {appUser?.schoolInfo && (
                    <p className="text-slate-500 text-sm mt-1.5 font-medium">🏫 Trường: {appUser.schoolInfo}</p>
                  )}
                </div>
              </div>

              {/* Grid Layout of Blocks */}
              <div className="space-y-8">
                {/* 1. Personal Information */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
                    1. Thông tin cá nhân học sinh
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email đăng nhập</span>
                      <span className="text-slate-700 font-bold flex items-center gap-2">
                        📧 {appUser?.email}
                      </span>
                    </div>

                    {appUser?.personalEmail && (
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email cá nhân</span>
                        <span className="text-slate-700 font-medium flex items-center gap-2">
                          ✉️ {appUser.personalEmail}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Ngày sinh</span>
                      <span className="text-slate-700 font-medium flex items-center gap-2">
                        🎂 {appUser?.dob ? appUser.dob.split('-').reverse().join('/') : 'Chưa cập nhật'}
                      </span>
                    </div>

                    {appUser?.address && (
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Địa chỉ thường trú</span>
                        <span className="text-slate-700 font-medium flex items-center gap-2 truncate" title={appUser.address}>
                          📍 {appUser.address}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Số điện thoại Zalo</span>
                      <span className="text-slate-700 font-bold flex items-center gap-2 text-blue-600">
                        💬 {appUser?.zalo || 'Chưa cập nhật'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Liên kết Facebook</span>
                      {appUser?.facebook ? (
                        <a 
                          href={appUser.facebook.startsWith('http') ? appUser.facebook : `https://${appUser.facebook}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-indigo-600 font-semibold hover:underline block truncate"
                          title={appUser.facebook}
                        >
                          🔗 {appUser.facebook}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Chưa cập nhật</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Parent Information */}
                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-100">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60 pb-2 mb-4">
                    2. Thông tin phụ huynh liên hệ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Họ tên phụ huynh</span>
                      <span className="text-slate-800 font-bold">
                        👤 {appUser?.parentName || 'Chưa cập nhật'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Quan hệ với học sinh</span>
                      <span className="text-slate-700 font-semibold">
                        👪 {appUser?.parentRelation || 'Chưa cập nhật'}
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Số điện thoại liên hệ</span>
                      {appUser?.parentPhone ? (
                        <a 
                          href={`tel:${appUser.parentPhone}`} 
                          className="text-indigo-600 font-bold text-lg hover:underline inline-flex items-center gap-1.5"
                        >
                          📞 {appUser.parentPhone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Chưa cập nhật</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <p className="text-xs text-slate-400 italic">Tài khoản đăng ký lúc: {appUser?.createdAt ? new Date(appUser.createdAt).toLocaleDateString('vi-VN') : 'Không rõ'}</p>
                  <button onClick={() => setShowContactModal(true)} className="px-6 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold transition-colors text-sm">
                    Cập nhật liên hệ
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 flex flex-col p-2">
               <ul className="divide-y divide-gray-100">
                {knowledges.length === 0 && !isRefreshing && !error ? (
                  <li className="px-6 py-12 text-center text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-lg font-medium">Chưa có bài học nào được đăng cho bạn.</p>
                  </li>
                ) : knowledges.map((k) => (
                  <li key={k.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    <div className="px-6 py-5 sm:flex sm:justify-between sm:items-center">
                      <div className="mb-4 sm:mb-0">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{k.title}</h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                           <span className="font-medium bg-gray-100 px-2.5 py-1 rounded-md">Khối {k.block}</span>
                           {k.className && <span className="font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">Lớp {k.className}</span>}
                        </div>
                      </div>
                      <div>
                        <a
                          href={k.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          Xem tài liệu
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-2">
          <ul className="divide-y divide-gray-100">
            {exams.length === 0 && !isRefreshing && !error ? (
              <li className="px-6 py-12 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-lg font-medium">Chưa có đề thi nào được giao.</p>
                <p className="text-sm mt-1">Hãy quay lại sau nhé!</p>
              </li>
            ) : exams.map((exam) => {
              const sub = getSubmission(exam.id);
              const now = new Date().getTime();
              const startTime = exam.startTime ? new Date(exam.startTime).getTime() : null;
              const endTime = exam.endTime ? new Date(exam.endTime).getTime() : null;
              
              const isBeforeStart = startTime && now < startTime;
              const isAfterEnd = endTime && now > endTime;
              
              return (
                <li key={exam.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                  <div className="px-6 py-5 sm:flex sm:justify-between sm:items-center">
                    <div className="mb-4 sm:mb-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{exam.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center bg-gray-100 px-2.5 py-1 rounded-md font-medium">
                          Thời gian làm bài: {exam.duration} phút
                        </span>
                      </div>
                      {(exam.startTime || exam.endTime) && (
                        <p className="mt-2 text-sm text-gray-600">
                          <span className="font-medium mr-1">Mở:</span> {exam.startTime ? new Date(exam.startTime).toLocaleString('vi-VN') : 'Không giới hạn'} - {exam.endTime ? new Date(exam.endTime).toLocaleString('vi-VN') : 'Không giới hạn'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      {sub ? (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center text-emerald-600 font-semibold text-sm mb-2 bg-emerald-50 px-3 py-1 rounded-full">
                            <CheckCircle className="w-4 h-4 mr-1.5" />
                            Đã hoàn thành
                          </div>
                          <Link
                            to={`/student/exam/${exam.id}/result`}
                            className="inline-flex items-center px-5 py-2.5 border border-gray-200 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all transform hover:-translate-y-0.5"
                          >
                            Xem kết quả
                          </Link>
                        </div>
                      ) : isBeforeStart ? (
                        <div className="text-gray-500 font-semibold bg-gray-100 px-5 py-2.5 rounded-xl border border-gray-200">
                          Chưa mở
                        </div>
                      ) : isAfterEnd ? (
                        <Link
                          to={`/student/exam/${exam.id}`}
                          className="inline-flex items-center px-5 py-2.5 border border-gray-200 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all transform hover:-translate-y-0.5"
                        >
                          Xem lại bài
                        </Link>
                      ) : (
                        <Link
                          to={`/student/exam/${exam.id}`}
                          className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-xl shadow-md text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:-translate-y-0.5"
                        >
                          <PlayCircle className="w-5 h-5 mr-2" /> Vào bài
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
          )}
        </div>
      </main>

      {/* Update Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-[#0A1128]/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl transform transition-all border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Thông tin liên hệ</h3>
            </div>
            <p className="text-sm font-medium text-rose-600 mb-6 bg-rose-50 p-4 rounded-2xl border border-rose-100/50 flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <span>Bắt buộc cập nhật Link Facebook và SĐT Zalo để hệ thống sử dụng bình thường.</span>
            </p>
            <form onSubmit={handleUpdateContact} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Đường link ID Facebook</label>
                <input 
                  type="url" 
                  value={fbLink} 
                  onChange={e => setFbLink(e.target.value)} 
                  className="block w-full border border-slate-200 bg-slate-50 rounded-2xl shadow-sm py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white text-sm font-medium transition-all" 
                  placeholder="https://facebook.com/..." 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại Zalo</label>
                <input 
                  type="tel" 
                  value={zaloPhone} 
                  onChange={e => setZaloPhone(e.target.value)} 
                  className="block w-full border border-slate-200 bg-slate-50 rounded-2xl shadow-sm py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white text-sm font-medium transition-all" 
                  placeholder="0912..." 
                  required
                />
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isUpdatingContact || !fbLink || !zaloPhone} className="w-full px-4 py-3.5 border border-transparent rounded-2xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors">
                  {isUpdatingContact ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
