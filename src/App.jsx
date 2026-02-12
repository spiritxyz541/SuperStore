import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Settings, 
  Users, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Save, 
  Plus, 
  Trash2, 
  LayoutDashboard,
  Printer,
  ChevronLeft,
  ChevronRight,
  Coffee, 
  BarChart3,
  TrendingUp,
  Award,
  PlaneTakeoff,
  Loader2,
  RefreshCw,
  Store,
  ArrowLeftRight,
  Sparkles,
  Zap,
  UtensilsCrossed,
  ConciergeBell,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays as CalendarDaysIcon,
  LogIn,
  ShieldCheck,
  UserCheck,
  Bot
} from 'lucide-react';

/**
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - V8.9 (RESPONSIVE UI/UX)
 * อัปเดต:
 * 1. Redesign หน้า Login แบบ Split-Screen สำหรับ Desktop และ Card สำหรับ Mobile
 * 2. ปรับ Responsive Navbar และขนาด Font/Padding ให้รองรับ Mobile 100%
 * 3. เพิ่มแนวนอน Scroll (overflow-x-auto) ให้ตารางต่างๆ ป้องกันการบีบอัดบนจอมือถือ
 * 4. คงระบบแยกแผนก (บริการ/ครัว), รายงาน OT, และ AI Suggestion ไว้สมบูรณ์
 */

// --- 1. Configurations ---
const firebaseConfig = {
  apiKey: "AIzaSyBJEmxRAPwUkafwutEg8TRUBqkIOP5tV0o",
  authDomain: "superstore-31f83.firebaseapp.com",
  projectId: "superstore-31f83",
  storageBucket: "superstore-31f83.firebasestorage.app",
  messagingSenderId: "761097159845",
  appId: "1:761097159845:web:07ca08e4854b017976794c",
  measurementId: "G-MCPNHGS2D7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// *** ล็อก appId "staffsync-v8-stable-prod-final" ***
const appId = "staffsync-v8-stable-prod-final"; 
const geminiApiKey = ""; 

// --- Constants ---
const POSITIONS = {
  service: ["OC", "AOC", "SH", "SSD", "FD", "SD", "EDC", "DVT", "PT"],
  kitchen: ["KH", "SKD", "KD", "EDC ครัว", "DVT ครัว", "PT ครัว"]
};

const SERVICE_DUTIES = [
  { id: 'D1', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน' },
  { id: 'D2', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)' },
  { id: 'D3', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Station /เคลียร์โต๊ะ' },
  { id: 'D4', jobA: 'พนักงานจัดอาหาร/ทำขนมหวาน', jobB: '-' },
  { id: 'D5', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Station' },
  { id: 'D6', jobA: 'พนักงานเตรียม Station', jobB: 'พนักงานจัดอาหาร/ทำขนมหวาน' },
];

const KITCHEN_DUTIES = [
  { id: 'K1', jobA: 'CHECKER', jobB: 'ครัวร้อน' },
  { id: 'K2', jobA: 'CHECKER', jobB: 'สไลซ์/ซีฟู้ด' },
  { id: 'K3', jobA: 'ทอด/ผัด', jobB: 'PREP สไลซ์ ซีฟู้ด' },
  { id: 'K4', jobA: 'อ่างกระทะ', jobB: 'PREP' },
];

const LEAVE_TYPES = [
  { id: 'OFF', label: 'หยุดประจำสัปดาห์', shortLabel: 'ย', color: 'bg-slate-100 text-slate-800' },
  { id: 'CO', label: 'หยุดชดเชย', shortLabel: 'ชช', color: 'bg-blue-100 text-blue-800' },
  { id: 'AL', label: 'หยุดพักร้อน', shortLabel: 'พร', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'SL', label: 'ลาป่วย', shortLabel: 'ป่วย', color: 'bg-red-100 text-red-800' },
  { id: 'PL', label: 'ลากิจ', shortLabel: 'กิจ', color: 'bg-orange-100 text-orange-800' },
];

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const generateDefaultMatrix = () => {
  const m = {};
  ['weekday', 'friday', 'weekend'].forEach(dt => {
    m[dt] = { duties: {} };
    SERVICE_DUTIES.forEach(d => m[dt].duties[d.id] = [{ startTime: "10:00", endTime: "19:00", maxOtHours: 4.0 }]);
    KITCHEN_DUTIES.forEach(k => m[dt].duties[k.id] = [{ startTime: "09:00", endTime: "18:00", maxOtHours: 4.0 }]);
  });
  return m;
};

const getDaysInMonth = (year, month, holidays = []) => {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayOfWeek = date.getDay();
    let type = 'weekday';
    if (holidays?.includes?.(ds) || dayOfWeek === 0 || dayOfWeek === 6) type = 'weekend';
    else if (dayOfWeek === 5) type = 'friday';
    days.push({ dateStr: ds, dayNum: date.getDate(), dayLabel: date.toLocaleDateString('th-TH', { weekday: 'short' }), type });
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// --- AI Helper ---
const callGemini = async (prompt, systemInstruction = "") => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI ไม่สามารถประมวลผลข้อมูลได้";
  } catch (e) { return "ระบบ AI ขัดข้อง"; }
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isTimeout, setIsTimeout] = useState(false);
  
  const [authRole, setAuthRole] = useState('guest'); 
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [view, setView] = useState('manager'); 
  const [activeDept, setActiveDept] = useState('service'); 

  const [globalConfig, setGlobalConfig] = useState({ admins: [{ user: 'admin', pass: 'superstore' }], branches: [] });
  const [branchData, setBranchData] = useState({ staff: [], holidays: [], matrix: generateDefaultMatrix() });
  const [schedule, setSchedule] = useState({});
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [saveStatus, setSaveStatus] = useState(null);
  
  const [userInput, setUserInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Staff Admin States
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffDept, setNewStaffDept] = useState('service');
  const [newStaffPos, setNewStaffPos] = useState('OC');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  
  const dateBarRef = useRef(null);
  const selectedYear = 2026;

  // --- Memos ---
  const CURRENT_DUTY_LIST = useMemo(() => activeDept === 'service' ? SERVICE_DUTIES : KITCHEN_DUTIES, [activeDept]);
  const CALENDAR_DAYS = useMemo(() => getDaysInMonth(selectedYear, selectedMonth, branchData.holidays || []), [selectedMonth, selectedYear, branchData.holidays]);
  const activeDay = useMemo(() => CALENDAR_DAYS.find(d => d.dateStr === selectedDateStr) || CALENDAR_DAYS[0], [selectedDateStr, CALENDAR_DAYS]);

  const usedStaffIds = useMemo(() => {
    const dayData = schedule[selectedDateStr];
    if (!dayData) return [];
    const ids = new Set();
    if (dayData.leaves) dayData.leaves.forEach(l => l.staffId && ids.add(l.staffId));
    if (dayData.duties) {
      Object.values(dayData.duties).forEach(slots => {
        slots.forEach(s => s.staffId && ids.add(s.staffId));
      });
    }
    return Array.from(ids);
  }, [schedule, selectedDateStr]);

  // Report Logic: Plan vs Actual
  const reportData = useMemo(() => {
    const staffMap = {};
    (branchData.staff || []).forEach(s => {
      staffMap[s.id] = { 
        id: s.id, name: s.name, dept: s.dept, pos: s.pos, 
        workHours: 0, shifts: 0, actualOT: 0, plannedOT: 0, leaves: 0 
      };
    });

    Object.keys(schedule).forEach(date => {
      const dayData = schedule[date];
      const dayConfig = CALENDAR_DAYS.find(c => c.dateStr === date);
      const dayType = dayConfig ? dayConfig.type : 'weekday';

      if (dayData.duties) {
        Object.keys(dayData.duties).forEach(dutyId => {
          const slots = dayData.duties[dutyId] || [];
          const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
          slots.forEach((slot, idx) => {
            if (slot.staffId && staffMap[slot.staffId]) {
              const mSlot = matrixSlots[idx] || { startTime:'10:00', endTime:'19:00', maxOtHours:0 };
              const [sh, sm] = mSlot.startTime.split(':').map(Number);
              const [eh, em] = mSlot.endTime.split(':').map(Number);
              staffMap[slot.staffId].workHours += (eh + em/60) - (sh + sm/60);
              staffMap[slot.staffId].shifts += 1;
              staffMap[slot.staffId].actualOT += Number(slot.otHours || 0);
              staffMap[slot.staffId].plannedOT += Number(mSlot.maxOtHours || 0);
            }
          });
        });
      }
      if (dayData.leaves) {
        dayData.leaves.forEach(l => { if (l.staffId && staffMap[l.staffId]) staffMap[l.staffId].leaves += 1; });
      }
    });
    return Object.values(staffMap).sort((a,b) => b.workHours - a.workHours);
  }, [schedule, branchData.staff, branchData.matrix, CALENDAR_DAYS]);

  const getStaffDayInfo = useCallback((staffId, dateStr) => {
    const dayData = schedule[dateStr];
    if (!dayData) return null;
    const leave = (dayData.leaves || []).find(l => l.staffId === staffId);
    if (leave) return { type: 'leave', info: LEAVE_TYPES.find(x => x.id === leave.type) };
    
    const allDuties = [...SERVICE_DUTIES, ...KITCHEN_DUTIES];
    for (const d of allDuties) {
      const slots = dayData.duties?.[d.id] || [];
      const sIdx = slots.findIndex(s => s.staffId === staffId);
      if (sIdx !== -1) {
        const dayConfig = CALENDAR_DAYS.find(c => c.dateStr === dateStr);
        const type = dayConfig ? dayConfig.type : 'weekday';
        const matrixSlots = branchData.matrix?.[type]?.duties?.[d.id] || [];
        return { type: 'work', duty: d, slot: matrixSlots[sIdx] || {startTime:'10:00', endTime:'19:00'}, actual: slots[sIdx] };
      }
    }
    return null;
  }, [schedule, CALENDAR_DAYS, branchData.matrix]);

  // Variables for Report
  const totalActualOT = reportData.reduce((acc, curr) => acc + curr.actualOT, 0);
  const totalPlannedOT = reportData.reduce((acc, curr) => acc + curr.plannedOT, 0);
  const deltaOT = totalActualOT - totalPlannedOT;

  // --- Auth & Data Effects ---
  useEffect(() => {
    const timer = setTimeout(() => { if (loading) setIsTimeout(true); }, 8000);
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { await signInAnonymously(auth); }
        } else { await signInAnonymously(auth); }
      } catch (e) { setLoadError(e.message); setLoading(false); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), (snap) => {
      if (snap.exists()) setGlobalConfig(snap.data());
      else setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), { admins: [{ user: 'admin', pass: 'superstore' }], branches: [] });
      setLoading(false);
      setIsTimeout(false);
    }, (err) => { setLoadError(err.message); setLoading(false); });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !activeBranchId) return;
    const unsubBranch = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), (snap) => {
      if (snap.exists()) setBranchData(snap.data());
      else setBranchData({ staff: [], holidays: [], matrix: generateDefaultMatrix() });
    });
    const unsubSched = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), (snap) => {
      if (snap.exists()) setSchedule(snap.data().records || {});
      else setSchedule({});
    });
    return () => { unsubBranch(); unsubSched(); };
  }, [user, activeBranchId]);

  // --- Handlers ---
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const admin = globalConfig.admins?.find(a => a.user === userInput && a.pass === passInput);
    if (admin) { setAuthRole('superadmin'); if (globalConfig.branches?.length > 0) setActiveBranchId(globalConfig.branches[0].id); setView('manager'); return; }
    const branch = globalConfig.branches?.find(b => b.user === userInput && b.pass === passInput);
    if (branch) { setAuthRole('branch'); setActiveBranchId(branch.id); setView('manager'); return; }
    setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  };

  const handleGlobalSave = async () => {
    if (authRole === 'guest') return;
    setSaveStatus('saving');
    try {
      if (authRole === 'superadmin') await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), globalConfig);
      if (activeBranchId) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), { records: schedule });
      }
      setSaveStatus('success'); setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { setSaveStatus('error'); }
  };

  const updateSchedule = (dateStr, dutyId, slotIndex, field, value) => {
    setSchedule(prev => {
      const newSched = { ...prev };
      if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
      if (!newSched[dateStr].duties[dutyId]) newSched[dateStr].duties[dutyId] = [];
      const updatedSlots = [...newSched[dateStr].duties[dutyId]];
      if (!updatedSlots[slotIndex]) updatedSlots[slotIndex] = { staffId: "", otHours: 0 };
      updatedSlots[slotIndex][field] = value;
      newSched[dateStr].duties[dutyId] = updatedSlots;
      return newSched;
    });
  };

  const updateLeaves = (dateStr, action, index, field, value) => {
    setSchedule(prev => {
      const newSched = { ...prev };
      if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
      const currentLeaves = [...(newSched[dateStr].leaves || [])];
      if (action === 'add') currentLeaves.push({ staffId: '', type: 'OFF' });
      else if (action === 'remove') currentLeaves.splice(index, 1);
      else if (action === 'update') currentLeaves[index] = { ...currentLeaves[index], [field]: value };
      newSched[dateStr].leaves = currentLeaves;
      return newSched;
    });
  };

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const avail = branchData.staff.filter(s => s.dept === activeDept && !usedStaffIds.includes(s.id)).map(s => s.name).join(", ");
      const res = await callGemini(`พนักงานที่ว่างในฝั่ง ${activeDept} วันนี้: ${avail}. แนะนำการจัดกะให้เหมาะสมสั้นๆ`, "คุณคือที่ปรึกษา HR");
      setAiMessage({ content: res });
    } catch (e) { setAiMessage({ content: "AI พักผ่อนอยู่" }); }
    finally { setAiLoading(false); }
  };

  const handleAiTeamAnalysis = async () => {
    setAiLoading(true);
    try {
      const summary = reportData.slice(0, 5).map(s => `${s.name}: OT ${s.actualOT}h`).join(", ");
      const res = await callGemini(`สถิติพนักงานเดือนนี้ (Top 5 OT): ${summary}. วิเคราะห์ทีมสั้นๆ`, "คุณคือที่ปรึกษา HR");
      setAiMessage({ content: res });
    } catch (e) { setAiMessage({ content: "วิเคราะห์ล้มเหลว" }); }
    finally { setAiLoading(false); }
  };

  const scrollDates = (dir) => {
    if (dateBarRef.current) {
      const amt = dir === 'left' ? -350 : 350;
      dateBarRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  // --- Rendering ---
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 font-sans">
      <Loader2 className="animate-spin w-12 h-12 sm:w-16 sm:h-16 text-indigo-600 mb-6" />
      <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest text-slate-400 text-center">Syncing with StaffSync...</h2>
      {isTimeout && <button onClick={() => setLoading(false)} className="mt-8 sm:mt-10 text-xs font-bold text-indigo-500 underline uppercase">Bypass connection</button>}
    </div>
  );

  if (authRole === 'guest') return (
    <div className="min-h-screen w-full flex bg-white font-sans">
      {/* Left Side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-emerald-500 rounded-full blur-3xl opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-white p-3 rounded-2xl"><Store className="w-8 h-8 text-slate-900" /></div>
            <span className="text-3xl font-black text-white tracking-tighter uppercase">StaffSync</span>
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-tight mt-10">
            Smart Manpower <br/><span className="text-indigo-400">Management</span>
          </h1>
          <p className="text-slate-400 mt-6 text-lg max-w-md">
            ระบบบริหารจัดการพนักงานและกะงานอัจฉริยะแบบครบวงจร สำหรับงานบริการและงานครัว
          </p>
        </div>
        
        <div className="relative z-10">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Version 8.9 Stable Release</p>
        </div>
      </div>

      {/* Right Side - Login Form (Full width on mobile) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-slate-50 to-slate-200 lg:bg-none lg:bg-white relative">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white lg:bg-transparent p-8 sm:p-10 lg:p-0 rounded-[2rem] sm:rounded-[3rem] lg:rounded-none shadow-2xl lg:shadow-none border border-slate-100 lg:border-none flex flex-col items-center lg:items-start gap-8 animate-in fade-in zoom-in-95 lg:zoom-in-100 duration-500">
          
          <div className="lg:hidden bg-indigo-600 p-4 sm:p-5 rounded-full shadow-xl shadow-indigo-100 mb-2"><Store className="w-8 h-8 sm:w-10 sm:h-10 text-white" /></div>
          
          <div className="text-center lg:text-left w-full">
             <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase">Welcome Back</h2>
             <p className="text-slate-400 text-xs sm:text-sm font-bold mt-2 uppercase tracking-widest">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          </div>

          <div className="w-full space-y-4 sm:space-y-5">
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Username</label>
              <input type="text" placeholder="รหัสพนักงาน / ชื่อผู้ใช้" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] sm:rounded-[2rem] px-5 sm:px-6 py-3 sm:py-4 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none transition" value={userInput} onChange={(e) => setUserInput(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Password</label>
              <input type="password" placeholder="รหัสผ่าน" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] sm:rounded-[2rem] px-5 sm:px-6 py-3 sm:py-4 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none transition" value={passInput} onChange={(e) => setPassInput(e.target.value)} />
            </div>
          </div>
          
          {loginError && <p className="text-xs sm:text-sm text-red-500 font-bold bg-red-50 px-4 py-3 rounded-xl w-full text-center">{loginError}</p>}
          
          <button type="submit" className="w-full bg-slate-900 text-white py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-black text-sm shadow-xl hover:bg-indigo-600 hover:shadow-indigo-200 active:scale-95 transition-all">LOGIN TO SYSTEM</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased overflow-x-hidden">
      {/* AI Modal */}
      {aiMessage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-12 max-w-2xl w-full shadow-2xl relative flex flex-col gap-4 sm:gap-6 animate-in slide-in-from-bottom-8">
             <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 bg-indigo-600 rounded-t-[2rem] sm:rounded-t-[3.5rem]"></div>
             <div className="flex items-center gap-3 sm:gap-4 mt-2 sm:mt-0">
               <div className="bg-indigo-600 p-3 sm:p-4 rounded-2xl sm:rounded-3xl"><Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" /></div>
               <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter uppercase">AI Insights ✨</h3>
             </div>
             <div className="bg-slate-50 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 max-h-[50vh] overflow-y-auto custom-scrollbar text-sm sm:text-base font-medium text-slate-600 whitespace-pre-wrap leading-relaxed">
                {typeof aiMessage.content === 'string' ? aiMessage.content : JSON.stringify(aiMessage.content)}
             </div>
             <button onClick={() => setAiMessage(null)} className="w-full bg-slate-900 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-black transition">ปิดหน้าต่าง</button>
           </div>
        </div>
      )}

      {/* Responsive Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden shadow-sm px-4 sm:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
          
          {/* Top Row on Mobile / Left on Desktop */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-slate-900 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg transition hover:rotate-12 duration-500"><LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div>
              <div className="flex flex-col">
                <span className="font-black text-lg sm:text-xl tracking-tighter uppercase leading-none">StaffSync</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
                   <span className={`text-[8px] sm:text-[9px] font-black uppercase text-slate-400`}>
                     {authRole === 'superadmin' ? 'GLOBAL CONTROL' : 'BRANCH MANAGEMENT'}
                   </span>
                </div>
              </div>
              {authRole === 'superadmin' && (
                <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-1 ml-2 sm:ml-6 border border-slate-200 shadow-inner">
                  <ArrowLeftRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 mx-2 sm:mx-3" />
                  <select value={activeBranchId || ''} onChange={(e) => setActiveBranchId(e.target.value)} className="bg-transparent text-[9px] sm:text-[11px] font-black outline-none py-1 sm:py-2 pr-2 sm:pr-4 text-indigo-600 cursor-pointer uppercase max-w-[120px] sm:max-w-none">
                    <option value="">-- SELECT BRANCH --</option>
                    {globalConfig.branches?.map(b => <option key={b.id} value={b.id}>{b.name.substring(0,15).toUpperCase()}</option>)}
                  </select>
                </div>
              )}
            </div>
            
            {/* Logout icon on mobile */}
            <div className="md:hidden flex items-center gap-2">
               {authRole === 'superadmin' && (
                 <select value={activeBranchId || ''} onChange={(e) => setActiveBranchId(e.target.value)} className="bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-black outline-none py-1.5 px-2 text-indigo-600 max-w-[100px]">
                   <option value="">-- สาขา --</option>
                   {globalConfig.branches?.map(b => <option key={b.id} value={b.id}>{b.name.substring(0,10)}</option>)}
                 </select>
               )}
               <button onClick={() => setAuthRole('guest')} className="text-slate-400 p-2 bg-slate-100 rounded-lg"><LogIn className="w-4 h-4 rotate-180" /></button>
            </div>
          </div>

          {/* Bottom Row on Mobile / Right on Desktop */}
          <div className="flex items-center gap-2 sm:gap-5 w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            <div className="flex-shrink-0 flex items-center bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200">
               <CalendarDaysIcon className="hidden sm:block w-4 h-4 sm:w-5 sm:h-5 text-slate-400 mx-2 sm:mx-3" />
               <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent text-[10px] sm:text-xs font-black outline-none py-1.5 sm:py-2 px-2 sm:pr-3 text-slate-700">
                 {THAI_MONTHS.map((m, i) => <option key={i} value={i}>{m} 2026</option>)}
               </select>
            </div>
            <div className="flex-shrink-0 flex gap-1 sm:gap-2 bg-slate-100 p-1 rounded-xl sm:rounded-2xl border border-slate-200 font-black text-[9px] sm:text-[10px]">
              <button onClick={() => setView('manager')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'manager' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>MANAGER</button>
              <button onClick={() => setView('report')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>REPORT</button>
              <button onClick={() => setView('admin')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'admin' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>ADMIN</button>
              {authRole === 'superadmin' && (
                <button onClick={() => setView('branches')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'branches' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-50' : 'text-slate-500'}`}>BRANCHES</button>
              )}
            </div>
            <div className="hidden md:flex flex-shrink-0 items-center gap-3 ml-2 pl-5 border-l border-slate-200">
               <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs hover:bg-indigo-700 active:scale-95 transition flex items-center gap-2">
                 {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
               </button>
               <button onClick={() => setAuthRole('guest')} className="text-slate-400 hover:text-red-500 transition"><LogIn className="w-6 h-6 rotate-180" /></button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile Save Button (Floating) */}
      <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="md:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl active:scale-90 transition-transform">
         {saveStatus === 'saving' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
      </button>

      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto w-full">
        {view === 'manager' || view === 'admin' ? (
          <div className="mb-6 sm:mb-10 flex flex-wrap gap-2 sm:gap-4 bg-white p-2 sm:p-3 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 w-full md:w-fit shadow-sm">
            <button onClick={() => setActiveDept('service')} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-[1rem] sm:rounded-[2rem] font-black text-[10px] sm:text-xs transition-all ${activeDept === 'service' ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><ConciergeBell className="w-4 h-4 sm:w-5 sm:h-5"/> ฝั่งงานบริการ</button>
            <button onClick={() => setActiveDept('kitchen')} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-[1rem] sm:rounded-[2rem] font-black text-[10px] sm:text-xs transition-all ${activeDept === 'kitchen' ? 'bg-orange-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5"/> ฝั่งงานครัว</button>
          </div>
        ) : null}

        {view === 'branches' && authRole === 'superadmin' ? (
          /* SYSTEM ADMIN - BRANCH MGMT */
          <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24">
             <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="bg-emerald-100 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem]"><Store className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" /></div>
                  <div>
                     <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter uppercase">Global Admin</h2>
                     <p className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-widest mt-1">จัดการรายชื่อสาขาและสิทธิ์เข้าระบบ</p>
                  </div>
                </div>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
                <div className="lg:col-span-1 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm h-fit">
                   <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3 uppercase tracking-tighter"><Plus className="text-emerald-500 w-5 h-5 sm:w-6 sm:h-6" /> สร้างสาขาใหม่</h3>
                   <div className="space-y-4 sm:space-y-5">
                      <div><span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1.5 sm:mb-2">ชื่อสาขา</span><input type="text" id="bn" className="w-full border-2 border-slate-50 bg-slate-50/50 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" /></div>
                      <div><span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1.5 sm:mb-2">Username</span><input type="text" id="bu" className="w-full border-2 border-slate-50 bg-slate-50/50 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" /></div>
                      <div><span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1.5 sm:mb-2">Password</span><input type="text" id="bp" className="w-full border-2 border-slate-50 bg-slate-50/50 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" /></div>
                      <button onClick={() => {
                        const n = document.getElementById('bn').value;
                        const u = document.getElementById('bu').value;
                        const p = document.getElementById('bp').value;
                        if(n && u && p) {
                          setGlobalConfig(prev => ({...prev, branches: [...(prev.branches || []), {id: 'b'+Date.now(), name: n, user: u, pass: p}]}));
                          document.getElementById('bn').value = ''; document.getElementById('bu').value = ''; document.getElementById('bp').value = '';
                        }
                      }} className="w-full bg-emerald-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-3xl font-black text-xs sm:text-sm hover:bg-emerald-700 shadow-xl mt-2 sm:mt-4 uppercase transition-colors">บันทึกสาขา</button>
                   </div>
                </div>
                <div className="lg:col-span-2 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm">
                   <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3 uppercase tracking-tighter"><ShieldCheck className="text-indigo-500 w-5 h-5 sm:w-6 sm:h-6" /> รายชื่อสาขาทั้งหมด</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      {globalConfig.branches?.map((b) => (
                        <div key={b.id} className="p-5 sm:p-8 bg-slate-50 rounded-[1.5rem] sm:rounded-[2.5rem] border border-transparent hover:border-indigo-100 transition shadow-sm flex justify-between items-start">
                           <div className="pr-4">
                              <h4 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tighter truncate max-w-[150px] sm:max-w-[200px]">{b.name}</h4>
                              <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold mt-1.5 sm:mt-2 uppercase truncate">USER: {b.user} | PWD: {b.pass}</p>
                           </div>
                           <button onClick={() => setGlobalConfig(prev => ({...prev, branches: prev.branches.filter(x => x.id !== b.id)}))} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-5 h-5 sm:w-6 sm:h-6"/></button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        ) : view === 'admin' ? (
          /* BRANCH ADMIN VIEW */
          !activeBranchId ? (
            <div className="h-[60vh] sm:h-[70vh] flex flex-col items-center justify-center gap-4 sm:gap-6 text-slate-300 font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-center px-4">
              <Store className="w-16 h-16 sm:w-24 sm:h-24 opacity-10" />
              <p className="text-sm sm:text-base">กรุณาเลือกสาขาที่ต้องการจัดการจากแถบด้านบน</p>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                  {/* พนักงาน: MANAGER สามารถเพิ่มแผนกและตำแหน่งได้ */}
                  <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
                    <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Users className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการพนักงาน ({globalConfig.branches?.find(b=>b.id===activeBranchId)?.name})</h2>
                    
                    <div className="space-y-4 mb-6 sm:mb-10 w-full">
                      <input type="text" placeholder={`ชื่อพนักงานใหม่ (${newStaffDept === 'service' ? 'บริการ' : 'ครัว'})...`} className="w-full border-2 border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none transition shadow-sm" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                         <div className="flex gap-2 sm:gap-4 flex-1">
                           <select value={newStaffDept} onChange={(e) => { setNewStaffDept(e.target.value); setNewStaffPos(POSITIONS[e.target.value][0]); }} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500">
                              <option value="service">งานบริการ</option>
                              <option value="kitchen">งานครัว</option>
                           </select>
                           <select value={newStaffPos} onChange={(e) => setNewStaffPos(e.target.value)} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500">
                              {POSITIONS[newStaffDept].map(p => <option key={p} value={p}>{p}</option>)}
                           </select>
                         </div>
                         <button onClick={() => { if(newStaffName.trim()){ setBranchData(p => ({...p, staff: [...(p.staff || []), {id: 's' + Date.now(), name: newStaffName.trim(), dept: newStaffDept, pos: newStaffPos}]})); setNewStaffName(''); } }} className="w-full sm:w-auto bg-slate-900 text-white px-6 sm:px-8 py-3 rounded-xl sm:rounded-2xl font-black text-xs hover:bg-indigo-600 transition uppercase flex items-center justify-center"><UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-0 sm:mr-0"/><span className="sm:hidden ml-2">เพิ่มพนักงาน</span></button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-2 sm:pr-3 custom-scrollbar">
                      {branchData.staff?.filter(s => s.dept === activeDept).length === 0 ? (
                        <div className="text-center py-8 sm:py-10 text-slate-400 font-bold text-[10px] sm:text-sm uppercase tracking-widest border-2 border-dashed rounded-[1.5rem] sm:rounded-[2rem]">ไม่มีพนักงานในแผนกนี้</div>
                      ) : branchData.staff?.filter(s => s.dept === activeDept).map(s => (
                        <div key={s.id} className="flex justify-between items-center p-4 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition group shadow-sm">
                          <div>
                             <span className="text-sm sm:text-base font-black text-slate-800 uppercase">{s.name}</span>
                             <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                                <span className={`text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border uppercase ${s.dept === 'service' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>{s.dept}</span>
                                <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 uppercase">{s.pos}</span>
                             </div>
                          </div>
                          <button onClick={() => setBranchData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* วันหยุด: Read-only สำหรับ Manager */}
                  <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm">
                    <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center justify-center gap-2 sm:gap-4 uppercase tracking-tighter"><Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" /> วันหยุดประจำสาขา</h2>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
                      {CALENDAR_DAYS.map(d => {
                        const isHoliday = branchData.holidays?.includes?.(d.dateStr);
                        return (
                          <button 
                            key={d.dateStr} 
                            disabled={authRole === 'branch'}
                            onClick={() => { if(authRole === 'superadmin') setBranchData(p=>({...p, holidays: isHoliday ? p.holidays.filter(x=>x!==d.dateStr) : [...(p.holidays || []), d.dateStr]})) }} 
                            className={`w-full aspect-square rounded-[0.8rem] sm:rounded-[1.5rem] text-[10px] sm:text-[12px] font-black transition-all border-2 flex items-center justify-center ${isHoliday ? 'bg-red-500 text-white border-red-600 shadow-lg sm:shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'} ${authRole === 'branch' ? 'cursor-not-allowed opacity-80' : ''}`}
                          >
                            {d.dayNum}
                          </button>
                        );
                      })}
                    </div>
                    {authRole === 'branch' && <p className="text-[8px] sm:text-[10px] text-red-400 font-bold mt-6 sm:mt-8 text-center uppercase tracking-widest leading-relaxed">* เฉพาะ Admin ส่วนกลางเท่านั้นที่แก้ไขวันหยุดและกะงานได้</p>}
                  </div>
               </div>

               {/* กะงาน (Matrix): Read-only สำหรับ Manager */}
               <div className="space-y-6 sm:space-y-8">
                 <h2 className="text-xl sm:text-2xl font-black text-slate-800 px-2 uppercase tracking-tighter flex items-center gap-3 sm:gap-4"><Clock className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" /> โครงสร้างกะงานฝั่ง: {activeDept === 'service' ? 'บริการ' : 'ครัว'}</h2>
                 {Object.entries(branchData.matrix || {}).map(([key, data]) => (
                  <div key={key} className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm mb-6 sm:mb-10 w-full">
                    <div className={`px-6 sm:px-10 py-4 sm:py-6 font-black text-base sm:text-lg text-white ${key==='weekday' ? 'bg-slate-900' : key==='friday' ? 'bg-sky-700' : 'bg-orange-600'}`}>{key.toUpperCase()} CYCLE {authRole === 'branch' ? '(VIEW ONLY)' : ''}</div>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-xs text-left min-w-[800px]">
                        <tbody className="divide-y divide-slate-100">
                          {CURRENT_DUTY_LIST.map(duty => (
                            <tr key={duty.id}>
                              <td className="px-6 sm:px-10 py-6 sm:py-8 w-[30%]"><div className="font-black text-slate-900 text-sm sm:text-lg mb-1 leading-tight">{duty.jobA}</div><div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic leading-tight">{duty.jobB}</div></td>
                              <td className="px-6 sm:px-10 py-6 sm:py-8">
                                <div className="flex flex-wrap gap-4 sm:gap-6">
                                  {(data.duties?.[duty.id] || []).map((slot, idx) => (
                                    <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5 bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border-2 border-slate-50 shadow-sm transition hover:border-indigo-100">
                                      <div className="flex flex-col gap-1 w-[45%] sm:w-auto"><span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">เริ่ม</span><input type="text" disabled={authRole === 'branch'} className="border rounded-xl p-1.5 sm:p-2 text-[10px] sm:text-xs font-black text-center w-full sm:w-24 disabled:bg-slate-50 disabled:text-slate-300 outline-none focus:border-indigo-500" value={slot.startTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id][idx].startTime = e.target.value; setBranchData(nd); }} /></div>
                                      <div className="flex flex-col gap-1 w-[45%] sm:w-auto"><span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">เลิก</span><input type="text" disabled={authRole === 'branch'} className="border rounded-xl p-1.5 sm:p-2 text-[10px] sm:text-xs font-black text-center w-full sm:w-24 disabled:bg-slate-50 disabled:text-slate-300 outline-none focus:border-indigo-500" value={slot.endTime || ""} onChange={(e) => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id][idx].endTime = e.target.value; setBranchData(nd); }} /></div>
                                      <div className="flex flex-col gap-1 sm:border-l pl-0 sm:pl-5 w-[80%] sm:w-auto mt-2 sm:mt-0"><span className="text-[8px] sm:text-[9px] font-black text-indigo-500 uppercase">MAX OT</span><input type="number" disabled={authRole === 'branch'} step="0.5" className="w-full sm:w-20 border rounded-xl p-1.5 sm:p-2 text-center font-black bg-indigo-50/50 disabled:opacity-50 outline-none focus:border-indigo-500 text-[10px] sm:text-xs" value={slot.maxOtHours} onChange={(e) => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setBranchData(nd); }} /></div>
                                      {authRole === 'superadmin' && <button onClick={() => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id].splice(idx,1); setBranchData(nd); }} className="text-slate-300 hover:text-red-500 transition mt-0 sm:mt-4 p-2 sm:p-0"><Trash2 className="w-4 h-4 sm:w-5 h-5"/></button>}
                                    </div>
                                  ))}
                                  {authRole === 'superadmin' && <button onClick={() => { const nd = JSON.parse(JSON.stringify(branchData)); if(!nd.matrix[key].duties[duty.id]) nd.matrix[key].duties[duty.id] = []; nd.matrix[key].duties[duty.id].push({startTime:"10:00", endTime:"19:00", maxOtHours:4.0}); setBranchData(nd); }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-4 sm:px-6 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2rem] text-[9px] sm:text-[11px] font-black text-slate-400 hover:border-indigo-500 transition self-stretch sm:self-center">+ SLOT</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
             </div>
            </div>
          )
        ) : view === 'manager' ? (
          /* BRANCH MANAGER VIEW */
          <div className="space-y-6 sm:space-y-10 animate-in slide-in-from-bottom-6 duration-500 pb-24">
             <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10">
               <div className="relative flex items-center gap-2 sm:gap-4 w-full xl:w-auto">
                <button onClick={() => scrollDates('left')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronLeft className="w-5 h-5 sm:w-8 sm:h-8" /></button>
                <div ref={dateBarRef} className="flex gap-3 sm:gap-5 overflow-x-auto pb-4 sm:pb-6 pt-2 sm:pt-3 custom-scrollbar px-2 sm:px-3 select-none touch-pan-x snap-x w-full">
                  {CALENDAR_DAYS.map(d => {
                    const isSelected = selectedDateStr === d.dateStr;
                    const isHoliday = branchData.holidays?.includes?.(d.dateStr);
                    return (
                      <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 sm:w-24 sm:h-28 rounded-[1.5rem] sm:rounded-[2.2rem] flex flex-col items-center justify-center transition-all border-2 snap-center ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl sm:shadow-2xl scale-105 sm:scale-110 z-20 ring-4 sm:ring-8 ring-indigo-50' : isHoliday ? 'bg-red-500 text-white border-red-600 shadow-sm sm:shadow-md' : d.type === 'weekend' ? 'bg-orange-500 text-white border-orange-600 shadow-sm sm:shadow-md' : d.type === 'friday' ? 'bg-sky-500 text-white border-sky-600 shadow-sm sm:shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400 shadow-sm'}`}>
                        <span className={`text-[9px] sm:text-[11px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-100 opacity-80' : 'opacity-40'}`}>{d.dayLabel}</span>
                        <span className="text-2xl sm:text-4xl font-black mt-1 sm:mt-2 leading-none">{d.dayNum}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => scrollDates('right')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronRight className="w-5 h-5 sm:w-8 sm:h-8" /></button>
              </div>
              <button onClick={handleAiSuggest} disabled={aiLoading} className="bg-slate-900 text-white px-6 sm:px-10 py-4 sm:py-6 rounded-[1.5rem] sm:rounded-[2.5rem] font-black flex justify-center items-center gap-3 sm:gap-4 hover:bg-black shadow-xl sm:shadow-2xl active:scale-95 transition-all w-full xl:w-auto text-sm sm:text-lg">
                 {aiLoading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-indigo-400" /> : <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 animate-pulse" />} AI แนะนำพนักงาน ✨
              </button>
            </div>

            <div className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 sm:w-4 h-full bg-indigo-600"></div>
              <div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-tight sm:leading-none mb-3 sm:mb-5">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                   <div className="flex items-center gap-2 bg-slate-900 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg"><Store className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" /> <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest sm:tracking-[0.1em] truncate max-w-[150px] sm:max-w-none">{globalConfig.branches?.find(b=>b.id===activeBranchId)?.name}</span></div>
                   <span className={`text-[9px] sm:text-[11px] font-black px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 uppercase tracking-widest shadow-sm ${activeDay.type === 'weekday' ? 'bg-slate-100 text-slate-700 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                    {branchData.matrix?.[activeDay.type]?.name || activeDay.type.toUpperCase()}
                   </span>
                </div>
              </div>
              <button onClick={() => setView('print')} className="w-full xl:w-auto bg-slate-50 text-slate-900 px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-3xl font-black flex justify-center items-center gap-3 sm:gap-4 hover:bg-white border border-slate-200 shadow-sm active:scale-95 transition-all text-xs sm:text-base"><Printer className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" /> พิมพ์รายงานวันนี้ </button>
            </div>

            <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] border-2 border-dashed border-slate-200 p-6 sm:p-12 shadow-sm">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3 sm:gap-5 mb-6 sm:mb-10 uppercase tracking-tighter text-indigo-600"><PlaneTakeoff className="w-6 h-6 sm:w-8 sm:h-8" /> บันทึกการลาหยุดงานวันนี้ </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {(schedule[selectedDateStr]?.leaves || []).map((l, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-wrap sm:flex-nowrap gap-3 sm:gap-4 items-center border border-slate-100 shadow-sm hover:bg-white transition-all">
                    <select value={l.staffId} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'staffId', e.target.value)} className="flex-[2.5] w-full sm:w-auto bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-black outline-none shadow-inner text-slate-800 focus:border-indigo-500">
                      <option value="">-- เลือกพนักงาน --</option>
                      {branchData.staff?.filter(s => s.dept === activeDept).map(s => {
                        const isUsed = usedStaffIds.includes(s.id) && l.staffId !== s.id;
                        return isUsed ? null : <option key={s.id} value={s.id}>{s.name} ({s.pos})</option>
                      })}
                    </select>
                    <div className="flex gap-2 sm:gap-4 flex-1 w-full sm:w-auto">
                        <select value={l.type} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'type', e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2 sm:px-3 py-3 sm:py-4 text-[10px] sm:text-xs font-black outline-none shadow-inner text-indigo-600 focus:border-indigo-500">
                        {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
                        </select>
                        <button onClick={() => updateLeaves(selectedDateStr, 'remove', idx)} className="text-slate-300 hover:text-red-500 transition p-2 bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-sm"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => updateLeaves(selectedDateStr, 'add')} className="border-3 border-dashed border-indigo-100 text-indigo-400 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] font-black text-xs sm:text-sm hover:bg-indigo-50 transition-all uppercase tracking-widest active:scale-95 group flex items-center justify-center gap-2"><Plus className="w-5 h-5 sm:w-6 sm:h-6" /> เพิ่มคนลา </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-10">
              {CURRENT_DUTY_LIST.map(duty => {
                const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                return (
                  <div key={duty.id} className="bg-white rounded-[2rem] sm:rounded-[3.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-xl w-full">
                    <div className="p-6 sm:p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-3 sm:gap-0">
                      <div><h3 className="font-black text-slate-900 text-base sm:text-xl uppercase tracking-tighter leading-tight max-w-[200px] sm:max-w-none break-words">{duty.jobA}</h3><p className="text-[9px] sm:text-[11px] text-slate-400 font-bold mt-1 uppercase italic leading-tight max-w-[200px] sm:max-w-none">{duty.jobB}</p></div>
                      <div className="bg-white border border-slate-100 px-4 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-[1.2rem] text-[9px] sm:text-[11px] font-black text-indigo-700 shadow-sm self-end sm:self-auto">{assigned.filter(x => !!x?.staffId).length} / {slots.length}</div>
                    </div>
                    <div className="p-4 sm:p-10 space-y-4 sm:space-y-8 bg-white">
                      {slots.map((slot, idx) => {
                        const data = assigned[idx] || { staffId: "", otHours: 0 };
                        return (
                          <div key={idx} className={`p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 transition-all flex flex-col gap-4 sm:gap-6 ${!data.staffId ? 'border-dashed border-slate-200 bg-slate-50/20' : 'border-indigo-50 bg-white shadow-md sm:shadow-lg shadow-slate-100'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] sm:text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2"><Clock className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400" /> {slot.startTime} - {slot.endTime}</span>
                              <span className={`text-[8px] sm:text-[10px] font-black px-2 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase ${data.otHours >= slot.maxOtHours ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>Q: {slot.maxOtHours}H</span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                              <select 
                                value={data.staffId} 
                                onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'staffId', e.target.value)} 
                                className="w-full sm:flex-[3] bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-black outline-none shadow-sm text-slate-900 focus:border-indigo-500"
                              >
                                <option value="">-- เลือกพนักงาน --</option>
                                {branchData.staff?.filter(s => s.dept === activeDept).map(s => {
                                  const isUsed = usedStaffIds.includes(s.id) && data.staffId !== s.id;
                                  return isUsed ? null : <option key={s.id} value={s.id}>{s.name} ({s.pos})</option>
                                })}
                              </select>
                              <div className={`w-full sm:flex-1 flex flex-row sm:flex-col justify-between sm:justify-center items-center border-2 rounded-xl sm:rounded-[1.5rem] bg-white transition-all px-4 sm:px-0 py-2 sm:py-0 ${data.otHours >= slot.maxOtHours ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100'}`}>
                                <span className="text-[9px] sm:text-[8px] font-black text-slate-300 uppercase sm:mb-1">OT</span>
                                <input type="number" step="0.5" value={data.otHours} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'otHours', e.target.value)} className="w-16 sm:w-full text-right sm:text-center font-black text-lg sm:text-xl outline-none bg-transparent focus:text-indigo-600" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'print' ? (
          <PrintMonthlyView CALENDAR_DAYS={CALENDAR_DAYS} branchData={branchData} globalConfig={globalConfig} activeBranchId={activeBranchId} THAI_MONTHS={THAI_MONTHS} selectedMonth={selectedMonth} getStaffDayInfo={getStaffDayInfo} setView={setView} />
        ) : (
          /* REPORT VIEW - V8.9 */
          <div className="space-y-6 sm:space-y-12 animate-in fade-in duration-500 pb-24 w-full">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="bg-yellow-400 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl sm:shadow-2xl shadow-yellow-100"><TrendingUp className="w-6 h-6 sm:w-10 sm:h-10 text-white" /></div>
                  <div>
                    <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter uppercase">Analytical Insight</h2>
                    <p className="text-slate-400 font-bold uppercase text-[10px] sm:text-sm tracking-widest mt-0.5 sm:mt-1">Performance & OT Efficiency Report</p>
                  </div>
                </div>
                <button onClick={handleAiTeamAnalysis} disabled={aiLoading} className="w-full sm:w-auto bg-slate-900 text-white px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-3 sm:gap-4 hover:bg-black shadow-xl sm:shadow-2xl active:scale-95 transition text-sm sm:text-lg">
                  {aiLoading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-yellow-400" /> : <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 animate-pulse" />} วิเคราะห์ภาพรวมด้วย AI ✨
                </button>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                   <p className="text-slate-400 font-black text-[9px] sm:text-[10px] uppercase tracking-widest mb-2 sm:mb-6">Total Actual OT</p>
                   <h3 className="text-4xl sm:text-6xl font-black text-indigo-600 tracking-tighter">{totalActualOT.toFixed(1)} <span className="text-xs sm:text-sm">HR</span></h3>
                </div>
                <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                   <p className="text-slate-400 font-black text-[9px] sm:text-[10px] uppercase tracking-widest mb-2 sm:mb-6">Planned OT Quota</p>
                   <h3 className="text-4xl sm:text-6xl font-black text-slate-400 tracking-tighter">{totalPlannedOT.toFixed(1)} <span className="text-xs sm:text-sm">HR</span></h3>
                </div>
                <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm sm:col-span-2 lg:col-span-2 flex flex-col justify-center">
                   <p className="text-slate-400 font-black text-[9px] sm:text-[10px] uppercase tracking-widest mb-4 sm:mb-6 text-center sm:text-left">OT Efficiency Delta</p>
                   <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-3 sm:gap-6">
                        <h3 className={`text-5xl sm:text-7xl font-black tracking-tighter ${deltaOT > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                           {deltaOT > 0 ? '+' : ''}{deltaOT.toFixed(1)}
                        </h3>
                        <div className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl ${deltaOT > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                           {deltaOT > 0 ? <ArrowUpRight className="w-6 h-6 sm:w-10 sm:h-10"/> : <ArrowDownRight className="w-6 h-6 sm:w-10 sm:h-10"/>}
                        </div>
                      </div>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 sm:max-w-[150px] leading-relaxed text-center sm:text-left">ส่วนต่างการใช้งาน OT จริงเทียบกับโควตาจากส่วนกลาง</p>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden w-full">
                <div className="p-6 sm:p-12 border-b border-slate-50 font-black text-slate-900 bg-slate-50/30 uppercase tracking-tighter text-lg sm:text-2xl"><div className="flex items-center gap-3 sm:gap-5"><BarChart3 className="w-6 h-6 sm:w-10 sm:h-10 text-indigo-500" /> Employee Workload Summary</div></div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs sm:text-base min-w-[700px]">
                    <thead className="bg-white text-[9px] sm:text-[12px] font-black uppercase text-slate-400 tracking-widest border-b">
                      <tr>
                        <th className="px-6 sm:px-12 py-4 sm:py-8 text-left sticky left-0 bg-white z-10">Staff Name</th>
                        <th className="px-4 sm:px-12 py-4 sm:py-8 text-center">Shifts</th>
                        <th className="px-4 sm:px-12 py-4 sm:py-8 text-center">Hours</th>
                        <th className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/30 text-indigo-600">Plan OT</th>
                        <th className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/50 text-indigo-800">Actual OT</th>
                        <th className="px-4 sm:px-12 py-4 sm:py-8 text-center">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {reportData.map((s, idx) => {
                        const delta = s.actualOT - s.plannedOT;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition duration-300">
                            <td className="px-6 sm:px-12 py-4 sm:py-8 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 border-r border-slate-50">
                               <p className="font-black text-slate-900 uppercase text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">{s.name}</p>
                               <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase">{s.dept} - {s.pos}</span>
                            </td>
                            <td className="px-4 sm:px-12 py-4 sm:py-8 text-center text-sm sm:text-xl">{s.shifts}</td>
                            <td className="px-4 sm:px-12 py-4 sm:py-8 text-center text-sm sm:text-xl">{s.workHours.toFixed(1)}</td>
                            <td className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/10 text-slate-500">{s.plannedOT.toFixed(1)}</td>
                            <td className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/30 text-indigo-700 text-lg sm:text-2xl font-black">{s.actualOT.toFixed(1)}</td>
                            <td className={`px-4 sm:px-12 py-4 sm:py-8 text-center text-sm sm:text-lg font-black ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                               {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        @media (min-width: 640px) {
           .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 10px; }
        }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; border: 3px solid #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .touch-pan-x { touch-action: pan-x; }
        .snap-x { scroll-snap-type: x mandatory; }
        .snap-center { scroll-snap-align: center; }
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; }
          .print\\:hidden { display: none !important; }
          nav, button, footer { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; min-height: auto !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 2px solid #000 !important; font-size: 7px !important; }
          th, td { border: 1px solid #000 !important; padding: 2px !important; }
        }
      `}} />
    </div>
  );
}

function PrintMonthlyView({ CALENDAR_DAYS, branchData, globalConfig, activeBranchId, THAI_MONTHS, selectedMonth, getStaffDayInfo, setView }) {
  return (
    <div className="p-4 sm:p-10 bg-white min-h-screen animate-in fade-in w-full overflow-x-hidden">
      <div className="max-w-full mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-16 print:hidden border-b pb-6 sm:pb-8 gap-4 sm:gap-0">
          <button onClick={() => setView('manager')} className="flex items-center gap-2 sm:gap-4 text-slate-600 font-black bg-slate-100 px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-3xl hover:bg-slate-200 transition shadow-sm uppercase text-xs sm:text-sm tracking-widest w-full sm:w-auto justify-center"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /> ย้อนกลับ </button>
          <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 sm:px-12 py-4 sm:py-5 rounded-xl sm:rounded-3xl font-black shadow-xl sm:shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 sm:gap-4 uppercase text-xs sm:text-sm tracking-widest w-full sm:w-auto"><Printer className="w-5 h-5 sm:w-6 sm:h-6" /> สั่งพิมพ์รายงาน </button>
        </div>
        <div className="text-center mb-10 sm:mb-16 uppercase">
          <h1 className="text-3xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-2 sm:mb-4">MANPOWER REPORT: {THAI_MONTHS[selectedMonth]} 2026</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-[0.3em] sm:tracking-[0.6em] italic">{globalConfig.branches?.find(b=>b.id===activeBranchId)?.name || 'BRANCH NODE'}</p>
        </div>
        <div className="overflow-x-auto border-2 sm:border-4 border-slate-900 rounded-xl sm:rounded-[2.5rem] shadow-lg sm:shadow-2xl overflow-hidden w-full custom-scrollbar pb-2 sm:pb-0">
          <table className="w-full border-collapse text-[6px] sm:text-[8px] table-fixed min-w-[800px] sm:min-w-none">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border-r border-slate-700 p-3 sm:p-5 text-left sticky left-0 bg-slate-900 z-10 w-24 sm:w-48 font-black uppercase border-b-2 border-slate-600">Employee (Pos)</th>
                {CALENDAR_DAYS.map(day => (
                  <th key={day.dateStr} className={`border-r border-slate-700 p-1.5 sm:p-3 min-w-[30px] sm:min-w-[45px] text-center border-b-2 border-slate-600 ${day.type === 'weekend' || branchData.holidays?.includes?.(day.dateStr) ? 'bg-slate-800 text-indigo-300' : ''}`}>
                    <div className="font-black text-[10px] sm:text-sm mb-0.5 sm:mb-1">{day.dayNum}</div><div className="text-[6px] sm:text-[8px] opacity-70 uppercase tracking-tighter">{day.dayLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branchData.staff?.map(s => (
                <tr key={s.id} className="h-12 sm:h-20 transition-colors border-b border-slate-100">
                  <td className="border-r-2 sm:border-r-4 border-slate-900 p-2 sm:p-5 font-black sticky left-0 bg-white z-10 text-[9px] sm:text-[12px] uppercase leading-tight truncate max-w-[100px] sm:max-w-[150px]">
                     {s.name}
                     <div className="text-[5px] sm:text-[7px] text-slate-400 font-bold">({s.pos})</div>
                  </td>
                  {CALENDAR_DAYS.map(day => {
                    const info = getStaffDayInfo(s.id, day.dateStr);
                    return (
                      <td key={day.dateStr} className={`border-r border-b border-slate-100 p-1 sm:p-2 text-center ${!info ? 'bg-slate-50/40' : ''}`}>
                        {info?.type === 'work' ? (
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="font-black text-indigo-700 text-[8px] sm:text-[10px] leading-none">{info.slot.startTime}</span>
                            <div className="text-[4px] sm:text-[5px] font-bold text-slate-400 truncate w-full px-0.5 sm:px-1 uppercase tracking-tighter mt-0.5 sm:mt-1 opacity-80">OT:{info.actual?.otHours || 0}</div>
                          </div>
                        ) : info?.type === 'leave' ? (
                          <div className={`w-full h-full flex items-center justify-center font-black ${info.info.color} rounded-md sm:rounded-xl border sm:border-2 border-white shadow-inner text-[8px] sm:text-[10px]`}><span className="text-center leading-none uppercase p-0.5 sm:p-1">{info.info.shortLabel}</span></div>
                        ) : <span className="text-[5px] sm:text-[7px] font-black opacity-10 uppercase tracking-widest">OFF</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}