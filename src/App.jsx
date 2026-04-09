import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc } from 'firebase/firestore';
import { 
  Users, AlertCircle, Clock, Save, Plus, Trash2, LayoutDashboard, Printer, ChevronLeft, ChevronRight, 
  Coffee, BarChart3, TrendingUp, Award, PlaneTakeoff, Loader2, Store, ArrowLeftRight, Sparkles, Wand2, 
  Eraser, Filter, ChevronDown, Download, MessageCircle, Bell, UserCircle, SaveAll, FolderOpen, CheckCircle2, Edit2, X, Check, List, TableProperties, GripVertical, LogIn, ShieldCheck,
  UtensilsCrossed, ConciergeBell, UserPlus, ArrowUpRight, ArrowDownRight, CalendarDays as CalendarDaysIcon, Calendar as CalendarIcon, ArrowRightLeft
} from 'lucide-react';

/**
 * SUPER STORE Manager Assistant - V10.39 (STABLE FIX & CHART OPTIMIZATION)
 * อัปเดต:
 * 1. ปรับโครงสร้าง Render Component ใหม่ทั้งหมด แก้ปัญหา Unexpected Closing Tag แบบถาวร
 * 2. หน้า Duty Roster Chart (รายวัน): กะงานไหนที่ยังไม่ได้ใส่ชื่อพนักงาน จะไม่ถูกนำมาแสดงและไม่นับยอดรวม
 */

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

const appId = "staffsync-v8-stable-prod-final"; 
const geminiApiKey = ""; 

const POSITIONS = {
  service: ["OC", "AOC", "SH", "SSD", "FD", "SD+", "EDC+", "DVT+", "PT+", "SD", "EDC", "DVT", "PT"],
  kitchen: ["KH", "SKD", "KD+", "EDC ครัว+", "DVT ครัว+", "PT ครัว+", "KD", "EDC ครัว", "DVT ครัว", "PT ครัว"]
};

const DAYS_OF_WEEK = [{id:0,label:'อาทิตย์'},{id:1,label:'จันทร์'},{id:2,label:'อังคาร'},{id:3,label:'พุธ'},{id:4,label:'พฤหัสบดี'},{id:5,label:'ศุกร์'},{id:6,label:'เสาร์'}];
const DEFAULT_SERVICE_DUTIES = [
  { id: 'D1', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน', reqPos: ['ALL'] },
  { id: 'D2', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)', reqPos: ['ALL'] },
  { id: 'D3', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Station /เคลียร์โต๊ะ', reqPos: ['ALL'] },
  { id: 'D4', jobA: 'พนักงานจัดอาหาร/ทำขนมหวาน', jobB: '-', reqPos: ['ALL'] },
  { id: 'D5', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Station', reqPos: ['ALL'] },
  { id: 'D6', jobA: 'พนักงานเตรียม Station', jobB: 'พนักงานจัดอาหาร/ทำขนมหวาน', reqPos: ['ALL'] },
];
const DEFAULT_KITCHEN_DUTIES = [
  { id: 'K1', jobA: 'CHECKER', jobB: 'ครัวร้อน', reqPos: ['ALL'] },
  { id: 'K2', jobA: 'CHECKER', jobB: 'สไลซ์/ซีฟู้ด', reqPos: ['ALL'] },
  { id: 'K3', jobA: 'ทอด/ผัด', jobB: 'PREP สไลซ์ ซีฟู้ด', reqPos: ['ALL'] },
  { id: 'K4', jobA: 'อ่างกระทะ', jobB: 'PREP', reqPos: ['ALL'] },
];
const LEAVE_TYPES = [
  { id: 'OFF', label: 'หยุดประจำสัปดาห์', shortLabel: 'ย', color: 'bg-slate-100 text-slate-800' },
  { id: 'CO', label: 'หยุดชดเชย', shortLabel: 'ชช', color: 'bg-blue-100 text-blue-800' },
  { id: 'AL', label: 'หยุดพักร้อน', shortLabel: 'พร', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'SL', label: 'ลาป่วย', shortLabel: 'ป่วย', color: 'bg-red-100 text-red-800' },
  { id: 'PL', label: 'ลากิจ', shortLabel: 'กิจ', color: 'bg-orange-100 text-orange-800' },
];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const checkPositionEligibility = (staffPos, reqPosArr) => {
  if (!reqPosArr || reqPosArr.length === 0 || reqPosArr.includes('ALL')) return true;
  let staffRank = -1;
  let targetDept = 'service';
  if(POSITIONS.kitchen.includes(staffPos)) { targetDept = 'kitchen'; staffRank = POSITIONS.kitchen.indexOf(staffPos); }
  else { staffRank = POSITIONS.service.indexOf(staffPos); }
  if (staffRank === -1) return false; 
  return reqPosArr.some(reqPos => {
    const reqRank = POSITIONS[targetDept].indexOf(reqPos);
    return reqRank !== -1 && staffRank <= reqRank;
  });
};

const generateDefaultMatrix = (svc = DEFAULT_SERVICE_DUTIES, ktn = DEFAULT_KITCHEN_DUTIES) => {
  const m = {};
  ['weekday', 'friday', 'weekend'].forEach(dt => {
    m[dt] = { duties: {} };
    svc.forEach(d => m[dt].duties[d.id] = [{ startTime: "10:00", endTime: "19:00", maxOtHours: 4.0 }]);
    ktn.forEach(k => m[dt].duties[k.id] = [{ startTime: "09:00", endTime: "18:00", maxOtHours: 4.0 }]);
  });
  return m;
};

const getDaysInMonth = (year, month, holidays = []) => {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dOW = date.getDay();
    let type = 'weekday';
    if (holidays?.includes?.(ds) || dOW === 0 || dOW === 6) type = 'weekend';
    else if (dOW === 5) type = 'friday';
    days.push({ dateStr: ds, dayNum: date.getDate(), dayLabel: date.toLocaleDateString('th-TH', { weekday: 'short' }), type });
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const formatTimeAbbreviation = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    return `${parseInt(h, 10)}.${m ? m.charAt(0) : '0'}`;
};

const callGemini = async (prompt, systemInstruction = "") => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } }) });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI ไม่สามารถประมวลผลข้อมูลได้";
  } catch (e) { return "ระบบ AI ขัดข้อง"; }
};

// --- Custom Components ---
const PositionSelector = ({ value, options, onChange, disabled, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const valArray = Array.isArray(value) ? value : [value || 'ALL'];
  const toggle = (opt) => {
    let next = [...valArray];
    if (opt === 'ALL') next = ['ALL'];
    else {
      next = next.filter(x => x !== 'ALL');
      if (next.includes(opt)) next = next.filter(x => x !== opt); else next.push(opt);
      if (next.length === 0) next = ['ALL'];
    }
    onChange(next);
  };
  return (
    <div className={`relative ${className || 'w-full sm:w-24'}`}>
      <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`border-xl p-2 sm:p-2.5 text-center font-black bg-emerald-50/50 text-[10px] sm:text-xs truncate cursor-pointer rounded-xl border ${disabled ? 'opacity-50' : 'hover:border-emerald-500'}`}>
        {valArray.join(', ')}
      </div>
      {isOpen && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto text-left py-1">
            <div className={`px-3 py-2 text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-2 ${valArray.includes('ALL') ? 'text-emerald-600' : 'text-slate-600'}`} onClick={() => toggle('ALL')}>
              <div className={`w-3 h-3 rounded border flex flex-shrink-0 items-center justify-center ${valArray.includes('ALL') ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{valArray.includes('ALL') && <Check className="w-2 h-2 text-white" />}</div> ALL
            </div>
            {options.map(o => (
              <div key={o} className={`px-3 py-2 text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-2 ${valArray.includes(o) ? 'text-emerald-600' : 'text-slate-600'}`} onClick={() => toggle(o)}>
                <div className={`w-3 h-3 rounded border flex flex-shrink-0 items-center justify-center ${valArray.includes(o) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{valArray.includes(o) && <Check className="w-2 h-2 text-white" />}</div> {o}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const StaffMultiSelector = ({ value, options, onChange, disabled, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const valArray = Array.isArray(value) ? value : [];
  const toggle = (optId) => {
    let next = [...valArray];
    if (next.includes(optId)) next = next.filter(x => x !== optId); else next.push(optId);
    onChange(next);
  };
  const selectedNames = valArray.map(id => options.find(o => o.id === id)?.name).filter(Boolean);
  return (
     <div className="relative flex-1 w-full">
        <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`border-2 border-slate-100 rounded-xl p-2.5 sm:p-3 text-left font-bold text-[10px] sm:text-xs bg-white cursor-pointer flex justify-between items-center ${disabled ? 'opacity-50' : 'hover:border-indigo-400'} ${selectedNames.length > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
          <span className="truncate pr-2">{selectedNames.length > 0 ? selectedNames.join(', ') : placeholder}</span><ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </div>
        {isOpen && !disabled && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar py-2">
              {options.length === 0 ? (<div className="px-4 py-3 text-[10px] text-slate-400 text-center font-bold">ไม่มีพนักงานว่างให้เลือก</div>) : options.map(o => (
                <div key={o.id} className={`px-4 py-2.5 text-[10px] sm:text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-3 transition-colors ${valArray.includes(o.id) ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`} onClick={() => toggle(o.id)}>
                  <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border flex flex-shrink-0 items-center justify-center transition-colors ${valArray.includes(o.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>{valArray.includes(o.id) && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}</div>
                  <span className="truncate">{o.name}</span><span className="text-[8px] sm:text-[9px] text-slate-400 ml-auto bg-white px-1.5 py-0.5 rounded border shadow-sm flex-shrink-0">{o.pos}</span>
                </div>
              ))}
            </div>
          </>
        )}
     </div>
  );
};

const PrintMonthlyView = ({ CALENDAR_DAYS, branchData, globalConfig, activeBranchId, THAI_MONTHS, selectedMonth, getStaffDayInfo, setView, activeDept, CURRENT_DUTY_LIST }) => {
  const filteredStaff = branchData.staff?.filter(s => s.dept === activeDept) || [];
  return (
    <div className="p-4 sm:p-10 bg-white animate-in fade-in w-full overflow-x-hidden flex-1">
      <div className="max-w-full mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-16 print:hidden border-b pb-6 sm:pb-8 gap-4 sm:gap-0">
          <button onClick={() => setView('manager')} className="flex items-center gap-2 sm:gap-4 text-slate-600 font-black bg-slate-100 px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-3xl hover:bg-slate-200 transition shadow-sm uppercase text-xs sm:text-sm tracking-widest w-full sm:w-auto justify-center"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /> ย้อนกลับ </button>
          <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 sm:px-12 py-4 sm:py-5 rounded-xl sm:rounded-3xl font-black shadow-xl sm:shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 sm:gap-4 uppercase text-xs sm:text-sm tracking-widest w-full sm:w-auto"><Printer className="w-5 h-5 sm:w-6 sm:h-6" /> สั่งพิมพ์รายงาน </button>
        </div>
        <div className="text-center mb-10 sm:mb-16 uppercase">
          <h1 className="text-3xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-2 sm:mb-4">ROSTER SCHEDULE: {THAI_MONTHS[selectedMonth]} 2026</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-[0.3em] sm:tracking-[0.6em] italic">{globalConfig.branches?.find(b=>b.id===activeBranchId)?.name || 'BRANCH NODE'} - {activeDept.toUpperCase()} DEPT</p>
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
              {filteredStaff.map(s => (
                <tr key={s.id} className="h-12 sm:h-20 transition-colors border-b border-slate-100">
                  <td className="border-r-2 sm:border-r-4 border-slate-900 p-2 sm:p-5 font-black sticky left-0 bg-white z-10 text-[9px] sm:text-[12px] uppercase leading-tight truncate max-w-[100px] sm:max-w-[150px]">{s.name}<div className="text-[5px] sm:text-[7px] text-slate-400 font-bold">({s.pos})</div></td>
                  {CALENDAR_DAYS.map(day => {
                    const info = getStaffDayInfo(s.id, day.dateStr, CURRENT_DUTY_LIST);
                    return (
                      <td key={day.dateStr} className={`border-r border-b border-slate-100 p-1 sm:p-2 text-center ${!info ? 'bg-slate-50/40' : ''}`}>
                        {info?.type === 'work' ? (
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="font-black text-indigo-700 text-[8px] sm:text-[10px] leading-none tracking-tighter">{formatTimeAbbreviation(info.slot.startTime)}</span>
                            {info.actual?.otHours > 0 && <div className="text-[6px] sm:text-[7px] font-black text-rose-500 truncate w-full px-0.5 sm:px-1 uppercase tracking-tighter mt-0.5 sm:mt-1">O{info.actual.otHours}</div>}
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
  const [managerViewMode, setManagerViewMode] = useState('daily'); 

  const [globalConfig, setGlobalConfig] = useState({ admins: [{ user: 'admin', pass: 'superstore' }], branches: [] });
  const [globalTemplates, setGlobalTemplates] = useState([]);
  
  const [branchData, setBranchData] = useState({ staff: [], holidays: [], matrix: generateDefaultMatrix(), duties: { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES }, templates: [] });
  const [schedule, setSchedule] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]); 
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  
  const [loginMode, setLoginMode] = useState('manager'); 
  const [staffLoginBranch, setStaffLoginBranch] = useState('');
  const [staffLoginInput, setStaffLoginInput] = useState('');
  const [userInput, setUserInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmpId, setNewStaffEmpId] = useState(''); 
  const [newStaffDept, setNewStaffDept] = useState('service');
  const [newStaffPos, setNewStaffPos] = useState('OC');
  const [newStaffDayOff, setNewStaffDayOff] = useState(''); 

  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editStaffData, setEditStaffData] = useState({});
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [editBranchData, setEditBranchData] = useState({});

  const [newDutyJobA, setNewDutyJobA] = useState('');
  const [newDutyJobB, setNewDutyJobB] = useState('');
  const [newDutyReqPos, setNewDutyReqPos] = useState(['ALL']); 
  const [editingDutyId, setEditingDutyId] = useState(null);
  const [editDutyData, setEditDutyData] = useState({});
  const [draggedDutyIdx, setDraggedDutyIdx] = useState(null);
  
  const [staffFilterPos, setStaffFilterPos] = useState('ALL'); 
  const [templateName, setTemplateName] = useState('');

  const [reportFilterMode, setReportFilterMode] = useState('month'); 
  const [reportFilterMonth, setReportFilterMonth] = useState(new Date().getMonth());
  const [reportFilterStart, setReportFilterStart] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [reportFilterEnd, setReportFilterEnd] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);

  const [essTabMode, setEssTabMode] = useState('leave'); 
  const [swapDateMy, setSwapDateMy] = useState('');
  const [swapDatePeer, setSwapDatePeer] = useState('');
  const [swapPeerId, setSwapPeerId] = useState('');
  
  const dateBarRef = useRef(null);
  const selectedYear = 2026;
  const autoAssignedDates = useRef(new Set()); 

  const CURRENT_DUTY_LIST = useMemo(() => {
    if (branchData.duties && branchData.duties[activeDept]) return branchData.duties[activeDept];
    return activeDept === 'service' ? DEFAULT_SERVICE_DUTIES : DEFAULT_KITCHEN_DUTIES;
  }, [activeDept, branchData.duties]);

  const CALENDAR_DAYS = useMemo(() => getDaysInMonth(selectedYear, selectedMonth, branchData.holidays || []), [selectedMonth, selectedYear, branchData.holidays]);
  const activeDay = useMemo(() => CALENDAR_DAYS.find(d => d.dateStr === selectedDateStr) || CALENDAR_DAYS[0], [selectedDateStr, CALENDAR_DAYS]);

  const usedStaffIds = useMemo(() => {
    const dayData = schedule[selectedDateStr];
    if (!dayData) return [];
    const ids = new Set();
    if (dayData.leaves) dayData.leaves.forEach(l => l.staffId && ids.add(l.staffId));
    if (dayData.duties) Object.values(dayData.duties).forEach(slots => { slots.forEach(s => s.staffId && ids.add(s.staffId)); });
    return Array.from(ids);
  }, [schedule, selectedDateStr]);

  const unassignedStaffDaily = useMemo(() => {
    return branchData.staff?.filter(s => s.dept === activeDept && !usedStaffIds.includes(s.id)) || [];
  }, [branchData.staff, activeDept, usedStaffIds]);

  const reportData = useMemo(() => {
    const staffMap = {};
    (branchData.staff || []).forEach(s => {
      staffMap[s.id] = { id: s.id, name: s.name, dept: s.dept, pos: s.pos, empId: s.empId, workHours: 0, shifts: 0, actualOT: 0, plannedOT: 0, leaves: 0 };
    });

    Object.keys(schedule).forEach(dateStr => {
      if (reportFilterMode === 'month') {
          const [yStr, mStr] = dateStr.split('-');
          if (parseInt(mStr, 10) - 1 !== reportFilterMonth || parseInt(yStr, 10) !== selectedYear) return;
      } else {
          if (dateStr < reportFilterStart || dateStr > reportFilterEnd) return;
      }
      const dayData = schedule[dateStr];
      const dateObj = new Date(parseInt(dateStr.split('-')[0]), parseInt(dateStr.split('-')[1]) - 1, parseInt(dateStr.split('-')[2]));
      const dOW = dateObj.getDay();
      let dayType = 'weekday';
      if (branchData.holidays?.includes?.(dateStr) || dOW === 0 || dOW === 6) dayType = 'weekend';
      else if (dOW === 5) dayType = 'friday';

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
  }, [schedule, branchData.staff, branchData.matrix, branchData.holidays, reportFilterMode, reportFilterMonth, reportFilterStart, reportFilterEnd, selectedYear]);

  const totalActualOT = reportData.reduce((acc, curr) => acc + curr.actualOT, 0);
  const totalPlannedOT = reportData.reduce((acc, curr) => acc + curr.plannedOT, 0);
  const deltaOT = totalActualOT - totalPlannedOT;

  const getStaffDayInfo = useCallback((staffId, dateStr, currentDutyList) => {
    const dayData = schedule[dateStr];
    if (!dayData) return null;
    const leave = (dayData.leaves || []).find(l => l.staffId === staffId);
    if (leave) {
        const typeInfo = LEAVE_TYPES.find(x => x.id === leave.type);
        return { type: 'leave', info: typeInfo || { shortLabel: '?', color: 'bg-gray-100' } };
    }
    for (const d of currentDutyList) {
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

  const activeDayShiftVisibilities = useMemo(() => {
      let hasMorning = false, hasLateMorning = false, hasAfternoon = false, hasEvening = false, hasNight = false;
      if (branchData.matrix && activeDay) {
          CURRENT_DUTY_LIST.forEach(duty => {
              const slots = branchData.matrix[activeDay.type]?.duties?.[duty.id] || [];
              slots.forEach(slot => {
                  const stHour = parseInt(slot.startTime.split(':')[0]) || 0;
                  if (stHour < 11) hasMorning = true;
                  else if (stHour === 11) hasLateMorning = true;
                  else if (stHour >= 12 && stHour < 16) hasAfternoon = true;
                  else if (stHour >= 16 && stHour < 19) hasEvening = true;
                  else if (stHour >= 19) hasNight = true;
              });
          });
      }
      const shiftColCount = (hasMorning ? 1 : 0) + (hasLateMorning ? 1 : 0) + (hasAfternoon ? 1 : 0) + (hasEvening ? 1 : 0) + (hasNight ? 1 : 0);
      return { hasMorning, hasLateMorning, hasAfternoon, hasEvening, hasNight, bottomColSpan: 1 + shiftColCount + 1 };
  }, [branchData.matrix, activeDay, CURRENT_DUTY_LIST]);

  // --- Effects ---
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
    return () => { unsub(); clearTimeout(timer); };
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), (snap) => {
      if (snap.exists()) setGlobalConfig(snap.data());
      else setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), { admins: [{ user: 'admin', pass: 'superstore' }], branches: [] });
      setLoading(false); setIsTimeout(false);
    }, (err) => { setLoadError(err.message); setLoading(false); });
    
    const unsubTpl = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), (snap) => {
        if (snap.exists()) setGlobalTemplates(snap.data().list || []);
        else setGlobalTemplates([]);
    });

    return () => { unsub(); unsubTpl(); };
  }, [user]);

  useEffect(() => {
    if (!user || !activeBranchId) return;
    const unsubBranch = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (!data.duties) data.duties = { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES };
        if (!data.templates) data.templates = [];
        setBranchData(data);
      } else { setBranchData({ staff: [], holidays: [], duties: { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES }, matrix: generateDefaultMatrix(), templates: [] }); }
    });
    const unsubSched = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), (snap) => {
      if (snap.exists()) setSchedule(snap.data().records || {}); else setSchedule({});
    });
    const unsubReq = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), (snap) => {
      if (snap.exists()) setPendingRequests(snap.data().list || []); else setPendingRequests([]);
    });
    return () => { unsubBranch(); unsubSched(); unsubReq(); };
  }, [user, activeBranchId]);

  useEffect(() => {
    if (!branchData.staff || branchData.staff.length === 0) return;
    if (autoAssignedDates.current.has(selectedDateStr)) return;
    autoAssignedDates.current.add(selectedDateStr);
    setSchedule(prev => {
        const dayData = prev[selectedDateStr];
        if (dayData && dayData.autoLeavesAssigned) return prev; 
        const [y, m, d] = selectedDateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeek = dateObj.getDay();
        const regularOffStaff = branchData.staff.filter(s => s.regularDayOff === dayOfWeek);
        const newSched = { ...prev };
        if (!newSched[selectedDateStr]) newSched[selectedDateStr] = { duties: {}, leaves: [] };
        const currentLeaves = newSched[selectedDateStr].leaves || [];
        const currentDuties = newSched[selectedDateStr].duties || {};
        const workingStaffIds = new Set();
        Object.values(currentDuties).forEach(slots => { slots.forEach(slot => { if(slot.staffId) workingStaffIds.add(slot.staffId); }); });
        let updatedLeaves = [...currentLeaves];
        regularOffStaff.forEach(staff => {
            if (!updatedLeaves.some(l => l.staffId === staff.id) && !workingStaffIds.has(staff.id)) { updatedLeaves.push({ staffId: staff.id, type: 'OFF' }); }
        });
        newSched[selectedDateStr] = { ...newSched[selectedDateStr], leaves: updatedLeaves, autoLeavesAssigned: true };
        return newSched;
    });
  }, [selectedDateStr, branchData.staff]);

  useEffect(() => {
    if (!branchData.matrix || Object.keys(schedule).length === 0) return;
    let hasChanges = false;
    const newSched = JSON.parse(JSON.stringify(schedule));
    Object.keys(newSched).forEach(dateStr => {
        const dayData = newSched[dateStr];
        if (!dayData || !dayData.duties) return;
        const dateObj = new Date(parseInt(dateStr.split('-')[0]), parseInt(dateStr.split('-')[1]) - 1, parseInt(dateStr.split('-')[2]));
        const dayOfWeek = dateObj.getDay();
        let dayType = 'weekday';
        if (branchData.holidays?.includes?.(dateStr) || dayOfWeek === 0 || dayOfWeek === 6) dayType = 'weekend';
        else if (dayOfWeek === 5) dayType = 'friday';

        CURRENT_DUTY_LIST.forEach(duty => {
          const slots = branchData.matrix[dayType]?.duties?.[duty.id] || [];
          const assigned = dayData.duties[duty.id] || [];
          slots.forEach((slot, idx) => {
             if (assigned[idx] && assigned[idx].staffId) {
                if (!assigned[idx].otUpdated && (!assigned[idx].otHours || assigned[idx].otHours === 0) && slot.maxOtHours > 0) {
                    assigned[idx].otHours = slot.maxOtHours; 
                    assigned[idx].otUpdated = true; 
                    hasChanges = true;
                }
             }
          });
        });
    });
    if (hasChanges) setSchedule(newSched);
  }, [schedule, branchData.matrix, CURRENT_DUTY_LIST, branchData.holidays]);

  // --- Handlers ---
  const handleManagerLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const admin = globalConfig.admins?.find(a => a.user === userInput && a.pass === passInput);
    if (admin) { setAuthRole('superadmin'); if (globalConfig.branches?.length > 0) setActiveBranchId(globalConfig.branches[0].id); setView('manager'); return; }
    const branch = globalConfig.branches?.find(b => b.user === userInput && b.pass === passInput);
    if (branch) { setAuthRole('branch'); setActiveBranchId(branch.id); setView('manager'); return; }
    setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!staffLoginBranch || !staffLoginInput.trim()) { setLoginError('กรุณาเลือกร้านและกรอกรหัสพนักงานให้ครบถ้วน'); return; }
    try {
        const branchSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', staffLoginBranch));
        if (branchSnap.exists()) {
            const bData = branchSnap.data();
            const staffMatch = bData.staff?.find(s => s.empId === staffLoginInput.trim() || s.name === staffLoginInput.trim());
            if (staffMatch) {
                setAuthRole('staff'); setActiveBranchId(staffLoginBranch); setStaffFilterPos(staffMatch.id); setView('staff_portal');
            } else { setLoginError('ไม่พบข้อมูลพนักงานในสาขานี้'); }
        } else { setLoginError('ไม่พบข้อมูลสาขา'); }
    } catch (err) { setLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อ'); }
  };

  const handleGlobalSave = async () => {
    if (authRole === 'guest' || authRole === 'staff') return;
    setSaveStatus('saving');
    try {
      if (authRole === 'superadmin') await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), globalConfig);
      if (activeBranchId) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), { records: schedule });
      }
      setSaveStatus('success'); setShowSuccessModal(true); 
      setTimeout(() => { setSaveStatus(null); setShowSuccessModal(false); }, 2000);
    } catch (err) { setSaveStatus('error'); }
  };

  const updateSchedule = (dateStr, dutyId, slotIndex, field, value, defaultOt = 0) => {
    setSchedule(prev => {
      const newSched = JSON.parse(JSON.stringify(prev));
      if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
      if (!newSched[dateStr].duties) newSched[dateStr].duties = {};
      if (!newSched[dateStr].duties[dutyId]) newSched[dateStr].duties[dutyId] = [];
      const currentSlots = newSched[dateStr].duties[dutyId];
      if (!currentSlots[slotIndex]) currentSlots[slotIndex] = { staffId: "", otHours: 0 };
      
      currentSlots[slotIndex][field] = value;
      currentSlots[slotIndex].otUpdated = true; 
      if (field === 'staffId') {
         if (value !== "") currentSlots[slotIndex].otHours = parseFloat(defaultOt) || 0;
         else currentSlots[slotIndex].otHours = 0;
      }
      return newSched;
    });
  };

  const handleLeaveChange = useCallback((dateStr, leaveType, selectedStaffIds) => {
      setSchedule(prev => {
          const newSched = JSON.parse(JSON.stringify(prev));
          if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [], autoLeavesAssigned: true };
          let updatedLeaves = (newSched[dateStr].leaves || []).filter(l => l.type !== leaveType);
          selectedStaffIds.forEach(staffId => { updatedLeaves.push({ staffId, type: leaveType }); });
          newSched[dateStr].leaves = updatedLeaves;
          return newSched;
      });
  }, []);

  const handleAddDuty = () => {
    if (!newDutyJobA.trim()) return;
    const newId = (activeDept === 'service' ? 'D' : 'K') + Date.now();
    const newDuty = { id: newId, jobA: newDutyJobA.trim(), jobB: newDutyJobB.trim() || '-', reqPos: newDutyReqPos };
    setBranchData(prev => {
      const nd = JSON.parse(JSON.stringify(prev));
      if (!nd.duties) nd.duties = { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES };
      if (!nd.duties[activeDept]) nd.duties[activeDept] = activeDept === 'service' ? DEFAULT_SERVICE_DUTIES : DEFAULT_KITCHEN_DUTIES;
      nd.duties[activeDept].push(newDuty);
      if(!nd.matrix) nd.matrix = generateDefaultMatrix();
      ['weekday', 'friday', 'weekend'].forEach(dt => {
        if(!nd.matrix[dt].duties[newId]) nd.matrix[dt].duties[newId] = [{ startTime: "10:00", endTime: "19:00", maxOtHours: 4.0 }];
      });
      return nd;
    });
    setNewDutyJobA(''); setNewDutyJobB(''); setNewDutyReqPos(['ALL']);
  };

  const handleEditDutySave = () => {
     setBranchData(prev => {
        const nd = JSON.parse(JSON.stringify(prev));
        const idx = nd.duties[activeDept].findIndex(d => d.id === editingDutyId);
        if(idx > -1) nd.duties[activeDept][idx] = editDutyData;
        return nd;
     });
     setEditingDutyId(null);
  };

  const handleDeleteDuty = (dutyId) => {
     setBranchData(prev => {
        const nd = JSON.parse(JSON.stringify(prev));
        nd.duties[activeDept] = nd.duties[activeDept].filter(d => d.id !== dutyId);
        if (nd.matrix) {
          ['weekday', 'friday', 'weekend'].forEach(dt => {
             if (nd.matrix[dt] && nd.matrix[dt].duties) delete nd.matrix[dt].duties[dutyId];
          });
        }
        return nd;
     });
  };

  const handleDropDuty = (dropIdx) => {
     if (draggedDutyIdx === null || draggedDutyIdx === dropIdx) return;
     setBranchData(prev => {
        const nd = JSON.parse(JSON.stringify(prev));
        const dutiesList = nd.duties[activeDept];
        const draggedItem = dutiesList[draggedDutyIdx];
        dutiesList.splice(draggedDutyIdx, 1);
        dutiesList.splice(dropIdx, 0, draggedItem);
        return nd;
     });
     setDraggedDutyIdx(null);
  };

  const startEditStaff = (staff) => { setEditingStaffId(staff.id); setEditStaffData({ ...staff }); };
  const saveEditStaff = () => { setBranchData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === editingStaffId ? editStaffData : s) })); setEditingStaffId(null); };
  const startEditBranch = (branch) => { setEditingBranchId(branch.id); setEditBranchData({ ...branch }); };
  const saveEditBranch = () => { setGlobalConfig(prev => ({ ...prev, branches: prev.branches.map(b => b.id === editingBranchId ? editBranchData : b) })); setEditingBranchId(null); };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { setConfirmModal({ message: "กรุณาตั้งชื่อแม่แบบ (Template Name) ก่อนบันทึก" }); return; }
    const newTemplate = { 
        id: 'T'+Date.now(), 
        name: `${templateName.trim()} (${globalConfig.branches?.find(b=>b.id===activeBranchId)?.name || 'Unknown'})`, 
        duties: branchData.duties, 
        matrix: branchData.matrix,
        branchId: activeBranchId 
    };
    try {
       const newList = [...globalTemplates, newTemplate];
       await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), { list: newList });
       setTemplateName('');
       setConfirmModal({ message: 'บันทึกแม่แบบไปยังส่วนกลางสำเร็จ! (สาขาอื่นสามารถโหลดใช้งานได้)' });
    } catch(e) { setConfirmModal({ message: "บันทึกแม่แบบล้มเหลว" }); }
  };
  
  const handleLoadTemplate = (tplId) => {
    if(!tplId) return;
    const tpl = globalTemplates.find(t => t.id === tplId);
    if (tpl) {
        setConfirmModal({ 
            message: `ยืนยันการโหลดแม่แบบ "${tpl.name}" ใช่หรือไม่? (โครงสร้างปัจจุบันจะถูกเขียนทับทั้งหมด)`, 
            action: () => { setBranchData(prev => ({ ...prev, duties: tpl.duties, matrix: tpl.matrix })); }
        });
    }
  };

  const handleDeleteTemplate = async (tplId) => {
    const newList = globalTemplates.filter(t => t.id !== tplId);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), { list: newList });
  };

  const handleShareToLine = () => {
      let txt = `📅 *ตารางงานวันที่ ${activeDay.dayNum} ${THAI_MONTHS[selectedMonth]}*\n📍 สาขา: ${globalConfig.branches?.find(b=>b.id===activeBranchId)?.name || ''}\n\n`;
      txt += `*--- ฝั่งบริการ ---*\n`;
      let svcHasStaff = false;
      (branchData.duties?.service || []).forEach(duty => {
          const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
          const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
          let dutyTxt = `🔥 ${duty.jobA}\n`;
          let hasAssigned = false;
          assigned.forEach((data, idx) => {
             if(data.staffId) {
               hasAssigned = true; svcHasStaff = true;
               const staff = branchData.staff?.find(s=>s.id===data.staffId);
               const slot = slots[idx];
               dutyTxt += `  - ${staff?.name} (${formatTimeAbbreviation(slot.startTime)}-${formatTimeAbbreviation(slot.endTime)})\n`;
             }
          });
          if(hasAssigned) txt += dutyTxt;
      });
      if(!svcHasStaff) txt += `(ยังไม่ได้จัดกะ)\n`;
      
      txt += `\n*--- ฝั่งครัว ---*\n`;
      let kitHasStaff = false;
      (branchData.duties?.kitchen || []).forEach(duty => {
          const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
          const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
          let dutyTxt = `🔪 ${duty.jobA}\n`;
          let hasAssigned = false;
          assigned.forEach((data, idx) => {
             if(data.staffId) {
               hasAssigned = true; kitHasStaff = true;
               const staff = branchData.staff?.find(s=>s.id===data.staffId);
               const slot = slots[idx];
               dutyTxt += `  - ${staff?.name} (${formatTimeAbbreviation(slot.startTime)}-${formatTimeAbbreviation(slot.endTime)})\n`;
             }
          });
          if(hasAssigned) txt += dutyTxt;
      });
      if(!kitHasStaff) txt += `(ยังไม่ได้จัดกะ)\n`;

      const leaves = schedule[selectedDateStr]?.leaves || [];
      if(leaves.length > 0) {
         txt += `\n✈️ *ลาหยุด / พาร์ทไทม์:*\n`;
         leaves.forEach(l => {
            if(l.staffId) {
               const staff = branchData.staff?.find(s=>s.id===l.staffId);
               const lType = LEAVE_TYPES.find(t=>t.id===l.type);
               if(staff) txt += `  - ${staff.name} (${lType?.shortLabel})\n`;
            }
         });
      }

      const textArea = document.createElement("textarea");
      textArea.value = txt;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setConfirmModal({ message: 'คัดลอกข้อความสำหรับส่งเข้า LINE เรียบร้อยแล้ว! (สามารถกด Paste ได้เลย)' });
      } catch (err) { setConfirmModal({ message: "ไม่สามารถคัดลอกข้อความได้" }); }
      document.body.removeChild(textArea);
  };

  const handleSubmitLeaveRequest = async (dateStr, leaveTypeId) => {
      const newReq = { id: 'R'+Date.now(), reqType: 'LEAVE', staffId: staffFilterPos, dateStr: dateStr, type: leaveTypeId, status: 'PENDING_MANAGER', timestamp: Date.now() };
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId);
      try {
          const snap = await getDoc(docRef);
          const currentList = snap.exists() ? (snap.data().list || []) : [];
          await setDoc(docRef, { list: [...currentList, newReq] });
          setConfirmModal({ message: 'ส่งคำขออนุมัติวันหยุดเรียบร้อยแล้ว!' });
      } catch (e) { setConfirmModal({ message: 'เกิดข้อผิดพลาดในการส่งคำขอ' }); }
  };

  const handleSubmitSwapRequest = async () => {
     if (!swapDateMy || !swapPeerId || !swapDatePeer) return setConfirmModal({ message: "กรุณาระบุข้อมูลการสลับกะให้ครบถ้วน" });
     const me = branchData.staff?.find(s => s.id === staffFilterPos);
     const peer = branchData.staff?.find(s => s.id === swapPeerId);
     if (!me || !peer) return setConfirmModal({ message: "ไม่พบข้อมูลพนักงาน" });
     
     const newReq = { 
         id: 'R'+Date.now(), reqType: 'SWAP', staffId: me.id, targetStaffId: peer.id, 
         dateMy: swapDateMy, datePeer: swapDatePeer, status: 'PENDING_PEER', timestamp: Date.now() 
     };
     const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId);
     try {
         const snap = await getDoc(docRef);
         const currentList = snap.exists() ? (snap.data().list || []) : [];
         await setDoc(docRef, { list: [...currentList, newReq] });
         setSwapDateMy(''); setSwapDatePeer(''); setSwapPeerId('');
         setConfirmModal({ message: 'ส่งคำขอสลับกะให้เพื่อนยืนยันแล้ว!' });
     } catch (e) { setConfirmModal({ message: 'เกิดข้อผิดพลาดในการส่งคำขอ' }); }
  };

  const handlePeerAcceptSwap = async (reqId) => {
      const newList = pendingRequests.map(r => r.id === reqId ? { ...r, status: 'PENDING_MANAGER' } : r);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
  };

  const handleManagerApproveRequest = async (req) => {
      setSchedule(prev => {
          const newSched = JSON.parse(JSON.stringify(prev));
          
          if (req.reqType === 'LEAVE') {
              if (!newSched[req.dateStr]) newSched[req.dateStr] = { duties: {}, leaves: [] };
              if (!newSched[req.dateStr].leaves) newSched[req.dateStr].leaves = [];
              newSched[req.dateStr].leaves = newSched[req.dateStr].leaves.filter(l => l.staffId !== req.staffId);
              newSched[req.dateStr].leaves.push({ staffId: req.staffId, type: req.type });
          } 
          else if (req.reqType === 'SWAP') {
              const d1 = req.dateMy;
              const d2 = req.datePeer;
              const id1 = req.staffId;
              const id2 = req.targetStaffId;

              const swapStaffInDay = (dateStr, oldId, newId) => {
                  if (!newSched[dateStr]) return;
                  if (newSched[dateStr].duties) {
                      Object.values(newSched[dateStr].duties).forEach(slots => {
                          slots.forEach(slot => { if (slot.staffId === oldId) slot.staffId = newId; });
                      });
                  }
                  if (newSched[dateStr].leaves) {
                      const l = newSched[dateStr].leaves.find(x => x.staffId === oldId);
                      if (l) l.staffId = newId;
                  }
              };

              if (d1 === d2) { 
                  if (newSched[d1]) {
                      if (newSched[d1].duties) {
                          Object.values(newSched[d1].duties).forEach(slots => {
                              slots.forEach(slot => {
                                  if (slot.staffId === id1) slot.staffId = "TEMP_SWAP";
                                  else if (slot.staffId === id2) slot.staffId = id1;
                              });
                              slots.forEach(slot => { if (slot.staffId === "TEMP_SWAP") slot.staffId = id2; });
                          });
                      }
                      if (newSched[d1].leaves) {
                         const l1 = newSched[d1].leaves.find(x => x.staffId === id1);
                         const l2 = newSched[d1].leaves.find(x => x.staffId === id2);
                         if (l1) l1.staffId = "TEMP_SWAP";
                         if (l2) l2.staffId = id1;
                         const tempL = newSched[d1].leaves.find(x => x.staffId === "TEMP_SWAP");
                         if(tempL) tempL.staffId = id2;
                      }
                  }
              } else { 
                  swapStaffInDay(d1, id1, id2);
                  swapStaffInDay(d2, id2, id1);
              }
          }
          return newSched;
      });
      
      const newList = pendingRequests.filter(r => r.id !== req.id);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
  };

  const handleRejectRequest = async (reqId) => {
      const newList = pendingRequests.filter(r => r.id !== reqId);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
  };

  const handleExportExcel = () => {
    const headers = ['วันที่', 'รหัสพนักงาน', 'ชื่อพนักงาน', 'แผนก', 'ตำแหน่ง', 'เวลาเข้า', 'เวลาออก', 'OT (ชั่วโมง)'];
    const rows = [];
    Object.keys(schedule).sort().forEach(dateStr => {
      if (reportFilterMode === 'month') {
          const [yStr, mStr] = dateStr.split('-');
          if (parseInt(mStr, 10) - 1 !== reportFilterMonth || parseInt(yStr, 10) !== selectedYear) return;
      } else {
          if (dateStr < reportFilterStart || dateStr > reportFilterEnd) return;
      }

      const dayData = schedule[dateStr];
      const dateObj = new Date(parseInt(dateStr.split('-')[0]), parseInt(dateStr.split('-')[1]) - 1, parseInt(dateStr.split('-')[2]));
      const dayOfWeek = dateObj.getDay();
      let dayType = 'weekday';
      if (branchData.holidays?.includes?.(dateStr) || dayOfWeek === 0 || dayOfWeek === 6) dayType = 'weekend';
      else if (dayOfWeek === 5) dayType = 'friday';

      if (dayData.duties) {
        Object.keys(dayData.duties).forEach(dutyId => {
          const assignedSlots = dayData.duties[dutyId] || [];
          const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
          assignedSlots.forEach((assigned, idx) => {
            if (assigned.staffId) {
              const staff = branchData.staff?.find(s => s.id === assigned.staffId);
              if (staff) {
                  const mSlot = matrixSlots[idx] || { startTime: '-', endTime: '-' };
                  rows.push([ dateStr, staff.empId || '-', staff.name, staff.dept, staff.pos, mSlot.startTime, mSlot.endTime, assigned.otHours || 0 ]);
              }
            }
          });
        });
      }
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StaffSync_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleAutoAssign = (mode = 'daily') => {
    setAiLoading(true);
    setTimeout(() => {
        setSchedule(prevSched => {
            const newSched = JSON.parse(JSON.stringify(prevSched));
            const datesToProcess = mode === 'daily' ? [selectedDateStr] : CALENDAR_DAYS.map(d => d.dateStr);

            datesToProcess.forEach(dateStr => {
                const dayConfig = CALENDAR_DAYS.find(c => c.dateStr === dateStr);
                const dayType = dayConfig ? dayConfig.type : 'weekday';
                if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
                const dayData = newSched[dateStr];
                
                dayData.duties = {};
                const [y, m, d] = dateStr.split('-').map(Number);
                const dateObj = new Date(y, m - 1, d);
                const dayOfWeek = dateObj.getDay();
                const regularOffStaff = branchData.staff?.filter(s => s.regularDayOff === dayOfWeek) || [];
                
                let currentLeaves = dayData.leaves || [];
                regularOffStaff.forEach(staff => {
                    const alreadyInLeave = currentLeaves.some(l => l.staffId === staff.id);
                    let alreadyWorking = false;
                    Object.values(dayData.duties).forEach(slots => { slots.forEach(slot => { if(slot.staffId === staff.id) alreadyWorking = true; }); });
                    if (!alreadyInLeave && !alreadyWorking) currentLeaves.push({ staffId: staff.id, type: 'OFF' });
                });
                dayData.leaves = currentLeaves;
                dayData.autoLeavesAssigned = true;

                const onLeaveIds = currentLeaves.map(l => l.staffId);
                const deptStaff = branchData.staff?.filter(s => s.dept === activeDept) || [];
                const sortedDeptStaff = [...deptStaff].sort((a, b) => {
                    const posList = POSITIONS[activeDept] || [];
                    const idxA = posList.indexOf(a.pos);
                    const idxB = posList.indexOf(b.pos);
                    const rankA = idxA !== -1 ? idxA : 999;
                    const rankB = idxB !== -1 ? idxB : 999;
                    return rankA - rankB; 
                });

                CURRENT_DUTY_LIST.forEach(duty => {
                    const slots = branchData.matrix?.[dayType]?.duties?.[duty.id] || [];
                    if (!dayData.duties[duty.id]) dayData.duties[duty.id] = [];
                    slots.forEach((slot, slotIdx) => {
                        if (!dayData.duties[duty.id][slotIdx]) dayData.duties[duty.id][slotIdx] = { staffId: "", otHours: 0 };
                        if (dayData.duties[duty.id][slotIdx].staffId) return; 

                        const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                        const isAll = reqArr.includes('ALL') || reqArr.length === 0;

                        const workingStaffIds = new Set();
                        Object.values(dayData.duties).forEach(ds => { ds.forEach(s => { if(s && s.staffId) workingStaffIds.add(s.staffId); }); });

                        const candidate = sortedDeptStaff.find(s => {
                            if (onLeaveIds.includes(s.id)) return false; 
                            if (workingStaffIds.has(s.id)) return false; 
                            if (!checkPositionEligibility(s.pos, reqArr)) return false; 
                            return true;
                        });

                        if (candidate) {
                            dayData.duties[duty.id][slotIdx].staffId = candidate.id;
                            dayData.duties[duty.id][slotIdx].otHours = slot.maxOtHours || 0;
                            dayData.duties[duty.id][slotIdx].otUpdated = true;
                        }
                    });
                });
            });
            setAiLoading(false);
            return newSched;
        });
    }, 500); 
  };

  const handleClearSchedule = (mode = 'daily') => {
      setSchedule(prevSched => {
          const newSched = JSON.parse(JSON.stringify(prevSched));
          const datesToProcess = mode === 'daily' ? [selectedDateStr] : CALENDAR_DAYS.map(d => d.dateStr);
          datesToProcess.forEach(dateStr => { if (newSched[dateStr]) newSched[dateStr].duties = {}; });
          return newSched;
      });
  };

  const scrollDates = (dir) => {
    if (dateBarRef.current) {
      const amt = dir === 'left' ? -350 : 350;
      dateBarRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  // --- Renders ---
  const renderModals = () => {
    return (
      <>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
             <div className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
                <div className="bg-green-500 p-4 rounded-full shadow-xl shadow-green-200 animate-bounce"><CheckCircle2 className="w-12 h-12 text-white" /></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-2">Saved Successfully</h3>
                <p className="text-slate-400 text-sm font-bold">บันทึกข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว</p>
             </div>
          </div>
        )}
        {confirmModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 font-sans p-4">
             <div className="bg-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center animate-in zoom-in-95">
                <div className="bg-indigo-100 p-4 rounded-full text-indigo-500"><AlertCircle className="w-10 h-10" /></div>
                <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">{confirmModal.action ? 'ยืนยันการทำรายการ' : 'แจ้งเตือน'}</h3><p className="text-slate-500 text-sm font-bold">{confirmModal.message}</p></div>
                <div className="flex gap-3 w-full mt-2">
                   <button onClick={() => setConfirmModal(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-black hover:bg-slate-200 transition-colors">ตกลง / ปิด</button>
                   {confirmModal.action && <button onClick={() => { confirmModal.action(); setConfirmModal(null); }} className="flex-1 bg-indigo-500 text-white py-3 rounded-xl font-black hover:bg-indigo-600 shadow-lg shadow-indigo-200 transition-colors">ดำเนินการ</button>}
                </div>
             </div>
          </div>
        )}
        {showRequestsModal && authRole !== 'staff' && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
             <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 max-w-2xl w-full shadow-2xl relative flex flex-col gap-4 sm:gap-6 animate-in zoom-in-95 font-sans max-h-[80vh] overflow-hidden">
               <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                   <div className="flex items-center gap-3">
                      <div className="bg-orange-100 p-3 rounded-full"><Bell className="w-6 h-6 text-orange-500"/></div>
                      <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">การอนุมัติคำขอ</h3><p className="text-[10px] sm:text-xs font-bold text-slate-400">รายการลาหยุด และ สลับกะที่รอตรวจสอบ</p></div>
                   </div>
                   <button onClick={() => setShowRequestsModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-6 h-6"/></button>
               </div>
               <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {pendingRequests.filter(r => r.reqType !== 'SWAP' || r.status === 'PENDING_MANAGER').length === 0 ? (
                      <div className="text-center py-10 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-100">ไม่มีคำขอที่รอการอนุมัติ 🎉</div>
                  ) : (
                      <div className="space-y-3">
                          {pendingRequests.filter(r => r.reqType !== 'SWAP' || r.status === 'PENDING_MANAGER').map(req => {
                              const staff = branchData.staff?.find(s => s.id === req.staffId);
                              const isSwap = req.reqType === 'SWAP';
                              let detailHtml = null;
                              if (isSwap) {
                                 const targetStaff = branchData.staff?.find(s => s.id === req.targetStaffId);
                                 detailHtml = (
                                   <div className="mt-2 text-xs font-bold text-slate-600 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                     ขอสลับกะกับ <span className="text-indigo-700">{targetStaff?.name || 'Unknown'}</span> <br/>
                                     วันที่ <span className="text-indigo-700">{req.dateMy}</span> <ArrowRightLeft className="w-3 h-3 inline mx-1"/> วันที่ <span className="text-indigo-700">{req.datePeer}</span>
                                   </div>
                                 );
                              } else {
                                 const lType = LEAVE_TYPES.find(t => t.id === req.type);
                                 const dateObj = new Date(req.dateStr);
                                 detailHtml = (
                                   <>
                                     <p className="text-xs font-bold text-slate-500 mt-1">ขอหยุดวันที่: <span className="text-indigo-600">{dateObj.toLocaleDateString('th-TH', { dateStyle: 'medium'})}</span></p>
                                     <p className="text-xs font-bold text-slate-500">ประเภท: <span className={`px-1.5 rounded ${lType?.color}`}>{lType?.label}</span></p>
                                   </>
                                 );
                              }
                              return (
                                  <div key={req.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                                      <div>
                                          <h4 className="font-black text-slate-800">{staff?.name || 'Unknown Staff'} <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border ml-2">{staff?.pos}</span></h4>
                                          {detailHtml}
                                      </div>
                                      <div className="flex gap-2 w-full sm:w-auto">
                                          <button onClick={() => handleManagerApproveRequest(req)} className="flex-1 sm:flex-none bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-600 transition shadow-sm">อนุมัติ</button>
                                          <button onClick={() => handleRejectRequest(req.id)} className="flex-1 sm:flex-none bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-100 hover:text-red-500 transition">ปฏิเสธ</button>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
               </div>
             </div>
          </div>
        )}
        {aiMessage && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
             <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-12 max-w-2xl w-full shadow-2xl relative flex flex-col gap-4 sm:gap-6 animate-in slide-in-from-bottom-8 font-sans">
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
      </>
    );
  };

  const renderGuestLogin = () => {
    return (
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 font-sans overflow-hidden">
        <div className="w-full lg:w-1/2 min-h-[40vh] lg:min-h-screen bg-slate-900 relative flex flex-col justify-center items-center p-8 sm:p-12 overflow-hidden shadow-2xl z-10">
          <div className="absolute top-[-10%] left-[-10%] w-64 h-64 sm:w-96 sm:h-96 bg-indigo-600 rounded-full blur-[100px] sm:blur-[120px] opacity-40"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 sm:w-96 sm:h-96 bg-emerald-600 rounded-full blur-[100px] sm:blur-[120px] opacity-30"></div>
          <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in zoom-in duration-700">
            <img src="https://img2.pic.in.th/gon-logo.png" alt="GON SUPER STORE" className="w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 rounded-full shadow-2xl object-cover border-4 sm:border-8 border-slate-800 bg-white mb-6 sm:mb-8 transition-transform hover:scale-105 duration-500" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/300?text=GON"; }} />
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter uppercase mb-2 sm:mb-4">GON SUPER STORE</h1>
            <p className="text-sm sm:text-lg lg:text-xl text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.4em]">Manager Assistant</p>
          </div>
          <div className="hidden lg:block absolute bottom-8 text-center w-full z-10"><p className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">Powered by Super Store Team</p></div>
        </div>
        <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white">
          <div className="w-full max-w-md p-8 sm:p-12 rounded-[2rem] sm:rounded-[3rem] shadow-xl sm:shadow-2xl border border-slate-100 bg-white flex flex-col gap-6 sm:gap-8 animate-in slide-in-from-right-8 duration-500 z-10">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 mb-2">
              <button onClick={() => { setLoginMode('manager'); setLoginError(''); }} className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black transition-all ${loginMode === 'manager' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Manager Login</button>
              <button onClick={() => { setLoginMode('staff'); setLoginError(''); }} className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black transition-all ${loginMode === 'staff' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Staff Portal</button>
            </div>
            <div className="text-center w-full">
               <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase">{loginMode === 'manager' ? 'Welcome Back' : 'Employee Self-Service'}</h2>
               <p className="text-slate-400 text-xs sm:text-sm font-bold mt-2">{loginMode === 'manager' ? 'Sign in to your management account' : 'ลงชื่อเข้าใช้ด้วยรหัสพนักงานของคุณ'}</p>
            </div>
            {loginMode === 'manager' ? (
                <form onSubmit={handleManagerLogin} className="w-full space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-4">Username</label>
                    <input type="text" placeholder="ชื่อผู้ใช้ระบบ" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 py-3 sm:py-4 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none transition" value={userInput} onChange={(e) => setUserInput(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-4">Password</label>
                    <input type="password" placeholder="รหัสผ่าน" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 py-3 sm:py-4 text-sm font-bold focus:border-indigo-500 focus:bg-white outline-none transition" value={passInput} onChange={(e) => setPassInput(e.target.value)} />
                  </div>
                  {loginError && <p className="text-xs sm:text-sm text-red-500 font-bold bg-red-50 px-4 py-3 rounded-xl w-full text-center">{loginError}</p>}
                  <button type="submit" className="w-full bg-indigo-600 text-white py-4 sm:py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-95 transition-all mt-4">LOGIN TO SYSTEM</button>
                </form>
            ) : (
                <form onSubmit={handleStaffLogin} className="w-full space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-4">Select Branch</label>
                    <select value={staffLoginBranch} onChange={(e) => setStaffLoginBranch(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 py-3 sm:py-4 text-sm font-bold focus:border-emerald-500 focus:bg-white outline-none transition text-slate-700">
                       <option value="">-- เลือกสาขาของคุณ --</option>
                       {globalConfig.branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-4">Employee ID / Name</label>
                    <input type="text" placeholder="รหัสพนักงาน หรือ ชื่อที่ระบบบันทึกไว้" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-5 py-3 sm:py-4 text-sm font-bold focus:border-emerald-500 focus:bg-white outline-none transition" value={staffLoginInput} onChange={(e) => setStaffLoginInput(e.target.value)} />
                  </div>
                  {loginError && <p className="text-xs sm:text-sm text-red-500 font-bold bg-red-50 px-4 py-3 rounded-xl w-full text-center">{loginError}</p>}
                  <button type="submit" className="w-full bg-emerald-600 text-white py-4 sm:py-5 rounded-[1.5rem] font-black text-sm shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:shadow-emerald-300 active:scale-95 transition-all mt-4">ACCESS STAFF PORTAL</button>
                </form>
            )}
          </div>
          <div className="lg:hidden mt-12 text-center w-full z-0"><p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">Powered by Super Store Team</p></div>
        </div>
      </div>
    );
  };

  const renderStaffPortal = () => {
    const peerSwapRequests = pendingRequests.filter(r => r.reqType === 'SWAP' && r.targetStaffId === staffFilterPos && r.status === 'PENDING_PEER');
    const myStaffInfo = branchData.staff?.find(s => s.id === staffFilterPos);
    const peerOptions = branchData.staff?.filter(s => s.id !== staffFilterPos && s.pos === myStaffInfo?.pos) || [];
    
    return (
      <div className="w-full animate-in fade-in duration-500 pb-24">
         <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm mb-6 sm:mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4 sm:gap-6 text-center sm:text-left">
               <div className="bg-emerald-100 p-4 sm:p-5 rounded-full"><UserCircle className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" /></div>
               <div>
                  <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter uppercase">{myStaffInfo?.name || 'STAFF'}</h2>
                  <p className="text-slate-500 text-xs sm:text-sm font-bold uppercase tracking-widest mt-1">ตำแหน่ง: {myStaffInfo?.pos || '-'} | สาขา: {globalConfig.branches?.find(b=>b.id===activeBranchId)?.name}</p>
               </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full lg:w-auto">
                <div className="flex bg-white rounded-xl border border-slate-200 mb-3 p-1">
                   <button onClick={() => setEssTabMode('leave')} className={`flex-1 text-[10px] font-black py-1.5 rounded-lg transition ${essTabMode === 'leave' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-400'}`}>ยื่นขอลาหยุด</button>
                   <button onClick={() => setEssTabMode('swap')} className={`flex-1 text-[10px] font-black py-1.5 rounded-lg transition ${essTabMode === 'swap' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-400'}`}>ขอสลับกะเพื่อน</button>
                </div>
                
                {essTabMode === 'leave' ? (
                    <div className="flex flex-col sm:flex-row gap-2 animate-in fade-in">
                        <input type="date" id="staffReqDate" className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500" />
                        <select id="staffReqType" className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500">
                            {LEAVE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <button onClick={() => {
                            const d = document.getElementById('staffReqDate').value; const t = document.getElementById('staffReqType').value;
                            if(d && t) handleSubmitLeaveRequest(d, t); else setConfirmModal({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
                        }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-black text-xs hover:bg-emerald-700 transition shadow-md whitespace-nowrap">ยื่นใบลา</button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 animate-in fade-in">
                        <div className="flex flex-col sm:flex-row gap-2 items-center">
                           <input type="date" value={swapDateMy} onChange={e=>setSwapDateMy(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" title="วันที่ของคุณที่ต้องการสลับ" />
                           <ArrowRightLeft className="w-4 h-4 text-slate-300 hidden sm:block flex-shrink-0" />
                           <input type="date" value={swapDatePeer} onChange={e=>setSwapDatePeer(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" title="วันที่ของเพื่อนที่คุณจะไปทำแทน" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                           <select value={swapPeerId} onChange={e=>setSwapPeerId(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                               <option value="">-- เลือกเพื่อนร่วมงาน (ระดับเดียวกัน) --</option>
                               {peerOptions.length === 0 ? (
                                   <option value="" disabled>ไม่มีพนักงานตำแหน่งเดียวกัน</option>
                               ) : (
                                   peerOptions.map(s => (
                                       <option key={s.id} value={s.id}>{s.name} ({s.pos})</option>
                                   ))
                               )}
                           </select>
                           <button onClick={handleSubmitSwapRequest} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-xs hover:bg-indigo-700 transition shadow-md whitespace-nowrap">ขอสลับกะ</button>
                        </div>
                    </div>
                )}
            </div>
         </div>

         {peerSwapRequests.length > 0 && (
             <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm mb-6 sm:mb-10 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-sm font-black text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Bell className="w-5 h-5"/> คำขอสลับกะจากเพื่อน (ต้องการการยืนยัน)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {peerSwapRequests.map(req => {
                       const requester = branchData.staff?.find(s => s.id === req.staffId);
                       return (
                           <div key={req.id} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-3">
                               <div className="flex items-center gap-2">
                                  <div className="bg-slate-100 p-2 rounded-full"><Users className="w-4 h-4 text-indigo-500"/></div>
                                  <div><p className="text-xs font-black text-slate-800">{requester?.name}</p><p className="text-[9px] font-bold text-slate-400">ขอสลับกะกับคุณ</p></div>
                               </div>
                               <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-600 text-center">
                                  วันที่ <span className="text-indigo-600">{new Date(req.dateMy).toLocaleDateString('th-TH',{month:'short',day:'numeric'})}</span> 
                                  <ArrowRightLeft className="w-3 h-3 inline mx-1 text-slate-400"/> 
                                  วันที่ <span className="text-indigo-600">{new Date(req.datePeer).toLocaleDateString('th-TH',{month:'short',day:'numeric'})}</span>
                               </div>
                               <div className="flex gap-2 mt-1">
                                  <button onClick={() => handlePeerAcceptSwap(req.id)} className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg text-xs font-black transition">ยืนยันสลับ</button>
                                  <button onClick={() => handleRejectRequest(req.id)} className="flex-1 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 py-2 rounded-lg text-xs font-black transition">ปฏิเสธ</button>
                               </div>
                           </div>
                       );
                   })}
                </div>
             </div>
         )}

         <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tighter">ตารางงานของฉัน (My Schedule)</h3>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                    <CalendarDaysIcon className="w-4 h-4 text-slate-400" />
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black outline-none text-slate-700">
                        {THAI_MONTHS.map((m, i) => <option key={i} value={i}>{m} 2026</option>)}
                    </select>
                </div>
            </div>
            <div className="p-4 sm:p-8 overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px] text-sm text-left">
                    <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-400 uppercase tracking-widest text-[10px] sm:text-xs">
                            <th className="p-4 font-black w-32">วันที่</th>
                            <th className="p-4 font-black">สถานะ</th>
                            <th className="p-4 font-black">รายละเอียดกะงาน / หน้าที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {CALENDAR_DAYS.map(day => {
                            const info = getStaffDayInfo(staffFilterPos, day.dateStr, [...DEFAULT_SERVICE_DUTIES, ...DEFAULT_KITCHEN_DUTIES]);
                            return (
                                <tr key={day.dateStr} className={`hover:bg-slate-50 transition-colors ${!info ? 'opacity-50' : ''}`}>
                                    <td className="p-4"><div className="font-black text-slate-800 text-lg">{day.dayNum} <span className="text-[10px] text-slate-400 uppercase ml-1">{day.dayLabel}</span></div></td>
                                    <td className="p-4">
                                        {info?.type === 'work' ? (
                                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-black text-xs uppercase border border-indigo-200 shadow-sm">ทำงาน (Work)</span>
                                        ) : info?.type === 'leave' ? (
                                            <span className={`px-3 py-1 rounded-lg font-black text-xs uppercase border shadow-sm ${info.info.color}`}>{info.info.label}</span>
                                        ) : (
                                            <span className="text-slate-300 font-bold text-xs uppercase">- ว่าง / ยังไม่จัดกะ -</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {info?.type === 'work' ? (
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                                                <div className="flex items-center gap-2 text-slate-700 font-black"><Clock className="w-4 h-4 text-indigo-400" />{info.slot.startTime} - {info.slot.endTime}</div>
                                                <div className="flex flex-col"><span className="font-black text-sm text-slate-800">{info.duty.jobA}</span><span className="text-[10px] font-bold text-slate-400">{info.duty.jobB}</span></div>
                                                {info.actual?.otHours > 0 && <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded font-black text-[10px] sm:ml-auto">OT: {info.actual.otHours} ชม.</span>}
                                            </div>
                                        ) : (<span className="text-slate-300">-</span>)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
         </div>
      </div>
    );
  };

  const renderManagerDailyCards = () => {
    return (
       <div className="w-full animate-in slide-in-from-bottom-6 duration-500">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10 print:hidden w-full mb-6">
             <div className="relative flex items-center gap-2 sm:gap-4 w-full xl:flex-1 min-w-0">
                <button onClick={() => scrollDates('left')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronLeft className="w-5 h-5 sm:w-8 sm:h-8" /></button>
                <div ref={dateBarRef} className="flex-1 flex gap-3 sm:gap-5 overflow-x-auto pb-4 sm:pb-6 pt-2 sm:pt-3 custom-scrollbar px-2 sm:px-3 select-none touch-pan-x snap-x">
                {CALENDAR_DAYS.map(d => {
                   const isSelected = selectedDateStr === d.dateStr;
                   const isHoliday = branchData.holidays?.includes?.(d.dateStr);
                   return (
                      <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 sm:w-24 sm:h-28 rounded-[1.5rem] sm:rounded-[2.2rem] flex flex-col items-center justify-center transition-all border-2 snap-center ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl sm:shadow-2xl scale-105 z-20 ring-4 sm:ring-8 ring-indigo-50' : isHoliday ? 'bg-red-500 text-white border-red-600 shadow-sm sm:shadow-md' : d.type === 'weekend' ? 'bg-orange-500 text-white border-orange-600 shadow-sm sm:shadow-md' : d.type === 'friday' ? 'bg-sky-500 text-white border-sky-600 shadow-sm sm:shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400 shadow-sm'}`}>
                      <span className={`text-[9px] sm:text-[11px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-100 opacity-80' : 'opacity-40'}`}>{d.dayLabel}</span>
                      <span className="text-2xl sm:text-4xl font-black mt-1 sm:mt-2 leading-none">{d.dayNum}</span>
                      </button>
                   );
                })}
                </div>
                <button onClick={() => scrollDates('right')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronRight className="w-5 h-5 sm:w-8 sm:h-8" /></button>
             </div>
             <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                <button onClick={handleShareToLine} className="flex-1 xl:flex-none bg-[#00B900] hover:bg-[#009900] text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 shadow-lg active:scale-95 transition-all text-[10px] sm:text-sm"><MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Copy to LINE</span><span className="sm:hidden">Share</span></button>
                <button onClick={() => handleAutoAssign('daily')} disabled={aiLoading} className="flex-1 xl:flex-none bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 sm:gap-3 hover:bg-black shadow-xl active:scale-95 transition-all text-[10px] sm:text-sm">{aiLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-indigo-400" /> : <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />} จัดกะอัตโนมัติ</button>
                <button onClick={() => setConfirmModal({ message: 'ยืนยันการล้างข้อมูลกะงานของ "วันนี้" ใช่หรือไม่?', action: () => handleClearSchedule('daily') })} className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center shadow-sm active:scale-95 transition-all"><Eraser className="w-5 h-5" /></button>
             </div>
          </div>
  
          <div className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10 relative overflow-hidden print:hidden w-full mb-6">
             <div className="absolute top-0 left-0 w-2 sm:w-4 h-full bg-indigo-600"></div>
             <div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-tight sm:leading-none mb-3 sm:mb-5">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                   <div className="flex items-center gap-2 bg-slate-900 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg"><Store className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" /> <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest sm:tracking-[0.1em] truncate max-w-[150px] sm:max-w-none">{globalConfig.branches?.find(b=>b.id===activeBranchId)?.name}</span></div>
                   <span className={`text-[9px] sm:text-[11px] font-black px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 uppercase tracking-widest shadow-sm ${activeDay.type === 'weekday' ? 'bg-slate-100 text-slate-700 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{branchData.matrix?.[activeDay.type]?.name || activeDay.type.toUpperCase()}</span>
                </div>
             </div>
          </div>
  
          <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] border-2 border-dashed border-slate-200 p-6 sm:p-12 shadow-sm print:hidden w-full mb-6">
             <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3 sm:gap-5 mb-6 sm:mb-10 uppercase tracking-tighter text-indigo-600"><PlaneTakeoff className="w-6 h-6 sm:w-8 sm:h-8" /> บันทึกการลาหยุดงานวันนี้ </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
                {LEAVE_TYPES.map(lt => {
                const selectedStaffIds = (schedule[selectedDateStr]?.leaves || []).filter(l => l.type === lt.id).map(l => l.staffId);
                const staffOptions = branchData.staff?.filter(s => { if (s.dept !== activeDept) return false; return !(usedStaffIds.includes(s.id) && !selectedStaffIds.includes(s.id)); }) || [];
                return (
                   <div key={lt.id} className="bg-slate-50 p-4 sm:p-5 rounded-[1.5rem] flex flex-col gap-4 border border-slate-100 shadow-sm hover:bg-white hover:border-indigo-100 transition-all">
                      <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${lt.color} border border-white shadow-sm flex-shrink-0`}>{lt.shortLabel}</span>
                            <span className="text-xs sm:text-sm font-black text-slate-700 truncate">{lt.label}</span>
                            <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border shadow-sm flex-shrink-0">{selectedStaffIds.length} คน</span>
                      </div>
                      <StaffMultiSelector value={selectedStaffIds} options={staffOptions} onChange={(newIds) => handleLeaveChange(selectedDateStr, lt.id, newIds)} placeholder="เลือกพนักงาน..." />
                   </div>
                );
                })}
             </div>
          </div>
  
          <div className="bg-amber-50 rounded-[2rem] sm:rounded-[3.5rem] border border-amber-200 p-6 sm:p-10 shadow-sm print:hidden w-full mb-6">
             <h3 className="text-lg sm:text-xl font-black text-amber-700 flex items-center gap-2 sm:gap-4 mb-4 uppercase tracking-tighter"><AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" /> พนักงานที่รอจัดกะ / ว่างงาน ({unassignedStaffDaily.length} คน)</h3>
             <div className="flex flex-wrap gap-2 sm:gap-3">
                {unassignedStaffDaily.length === 0 ? (
                   <span className="text-xs sm:text-sm font-bold text-amber-500/70">จัดกะและวันหยุดครบทุกคนแล้ว 🎉</span>
                ) : (
                   unassignedStaffDaily.map(s => (
                      <span key={s.id} className="bg-white text-amber-800 border border-amber-200 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black shadow-sm flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>{s.name} <span className="text-amber-500/70 font-bold">({s.pos})</span>
                      </span>
                   ))
                )}
             </div>
          </div>
  
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-10 print:hidden w-full">
             {CURRENT_DUTY_LIST.map(duty => {
                const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                const isAll = reqArr.includes('ALL') || reqArr.length === 0;
                const displayPos = isAll ? 'ALL POS' : reqArr.join(', ');
                if (slots.length === 0) return null;
                return (
                <div key={duty.id} className="bg-white rounded-[2rem] sm:rounded-[3.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-xl w-full">
                   <div className="p-6 sm:p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-3 sm:gap-0">
                      <div>
                      <h3 className="font-black text-slate-900 text-base sm:text-xl uppercase tracking-tighter leading-tight max-w-[200px] sm:max-w-none break-words">{duty.jobA}</h3>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-[9px] sm:text-[11px] text-slate-400 font-bold uppercase italic leading-tight">{duty.jobB}</span>
                         <span className="text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded border uppercase bg-emerald-50 text-emerald-600 border-emerald-100">{displayPos}</span>
                      </div>
                      </div>
                      <div className="bg-white border border-slate-100 px-4 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-[1.2rem] text-[9px] sm:text-[11px] font-black text-indigo-700 shadow-sm self-end sm:self-auto">{assigned.filter(x => !!x?.staffId).length} / {slots.length}</div>
                   </div>
                   <div className="p-4 sm:p-10 space-y-4 sm:space-y-8 bg-white">
                      {slots.map((slot, idx) => {
                      const data = assigned[idx] || { staffId: "", otHours: 0 };
                      return (
                         <div key={idx} className={`p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 transition-all flex flex-col gap-4 sm:gap-6 ${!data.staffId ? 'border-dashed border-slate-200 bg-slate-50/20' : 'border-indigo-50 bg-white shadow-md sm:shadow-lg shadow-slate-100'}`}>
                            <div className="flex justify-between items-center">
                            <span className="text-[10px] sm:text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2"><Clock className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400" /> {slot.startTime} - {slot.endTime}</span>
                            <div className="flex gap-1.5 sm:gap-2">
                               <span className={`text-[8px] sm:text-[10px] font-black px-2 sm:px-3 py-1 sm:py-1.5 rounded-full uppercase ${data.otHours >= slot.maxOtHours ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>Q: {slot.maxOtHours}H</span>
                            </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <select value={data.staffId} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'staffId', e.target.value, slot.maxOtHours)} className="w-full sm:flex-[3] bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-black outline-none shadow-sm text-slate-900 focus:border-indigo-500">
                               <option value="">-- เลือกพนักงาน --</option>
                               {branchData.staff?.filter(s => s.dept === activeDept).map(s => {
                                  const isUsed = usedStaffIds.includes(s.id) && data.staffId !== s.id;
                                  const wrongPos = !checkPositionEligibility(s.pos, reqArr, activeDept) && data.staffId !== s.id;
                                  return (isUsed || wrongPos) ? null : <option key={s.id} value={s.id}>{s.name} ({s.pos})</option>
                               })}
                            </select>
                            <div className={`w-full sm:flex-1 flex flex-row sm:flex-col justify-between sm:justify-center items-center border-2 rounded-xl sm:rounded-[1.5rem] bg-white transition-all px-4 sm:px-0 py-2 sm:py-0 ${data.otHours >= slot.maxOtHours ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100'}`}>
                               <span className="text-[9px] sm:text-[8px] font-black text-slate-300 uppercase sm:mb-1">OT</span>
                               <input type="number" step="0.5" value={data.otHours} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'otHours', parseFloat(e.target.value) || 0)} className="w-16 sm:w-full text-right sm:text-center font-black text-lg sm:text-xl outline-none bg-transparent focus:text-indigo-600" />
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
    );
  };

  const renderManagerDailyTable = () => {
    return (
       <div className="w-full animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden w-full print:border-none print:shadow-none">
             <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center print:hidden">
                <div className="flex flex-col">
                   <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Duty Roster Chart: {new Date(selectedDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</h2>
                   <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">{activeDept.toUpperCase()} DEPT</div>
                </div>
                <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex items-center gap-2 hover:bg-black shadow-lg active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest"><Printer className="w-4 h-4" /> พิมพ์ตารางนี้</button>
             </div>
             <div className="p-4 sm:p-8 overflow-x-auto w-full">
                <div className="text-center mb-6">
                   <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">แผนงานประจำวัน{activeDept === 'service' ? 'แผนกบริการ' : 'แผนกครัว'}</h1>
                   <p className="text-sm sm:text-base font-bold text-slate-600 mt-2">วัน{activeDay.dayLabel} ที่ <span className="underline underline-offset-4">{activeDay.dayNum}</span> เดือน <span className="underline underline-offset-4">{THAI_MONTHS[selectedMonth]}</span> พ.ศ. <span className="underline underline-offset-4">{selectedYear + 543}</span></p>
                </div>
                <table className="w-full border-collapse border-2 border-slate-800 text-[10px] sm:text-xs min-w-[1000px] print:text-[10px]">
                   <thead>
                      <tr className="bg-slate-100 text-center print:bg-slate-200">
                         <th className="border border-slate-800 p-2 w-[10%]">ตำแหน่ง / ระดับพนักงาน</th>
                         <th className="border border-slate-800 p-2 w-[8%]">JOB CARD No.</th>
                         <th className="border border-slate-800 p-2 w-[15%]">JOB A</th>
                         <th className="border border-slate-800 p-2 w-[15%]">JOB B</th>
                         <th className="border border-slate-800 p-2 w-[5%]">จำนวน</th>
                         <th className="border border-slate-800 p-2 w-[15%]">ชื่อ</th>
                         {activeDayShiftVisibilities.hasMorning && <th className="border border-slate-800 p-2 bg-sky-100 print:bg-sky-100 w-[6%]">เช้า(เปิด)</th>}
                         {activeDayShiftVisibilities.hasLateMorning && <th className="border border-slate-800 p-2 bg-sky-100 print:bg-sky-100 w-[6%]">สาย</th>}
                         {activeDayShiftVisibilities.hasAfternoon && <th className="border border-slate-800 p-2 bg-sky-100 print:bg-sky-100 w-[6%]">บ่าย</th>}
                         {activeDayShiftVisibilities.hasEvening && <th className="border border-slate-800 p-2 bg-sky-100 print:bg-sky-100 w-[6%]">เย็น</th>}
                         {activeDayShiftVisibilities.hasNight && <th className="border border-slate-800 p-2 bg-sky-100 print:bg-sky-100 w-[6%]">ดึก(ปิด)</th>}
                         <th className="border border-slate-800 p-2 w-[5%]">รอบพัก</th>
                      </tr>
                   </thead>
                   <tbody>
                      {CURRENT_DUTY_LIST.map((duty, dIdx) => {
                         const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                         const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                         const reqPosArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                         const posText = reqPosArr.includes('ALL') ? 'ALL POS' : reqPosArr.join(' / ');
  
                         const activeSlots = slots.map((slot, sIdx) => ({
                             slot,
                             assignedData: assigned[sIdx] || { staffId: "", otHours: 0 },
                             originalIdx: sIdx
                         })).filter(item => item.assignedData.staffId !== "");

                         if (activeSlots.length === 0) return null;
  
                         return activeSlots.map((item, localIdx) => {
                            const { slot, assignedData, originalIdx } = item;
                            const staff = branchData.staff?.find(s => s.id === assignedData.staffId);
                            const staffName = staff ? `${staff.name} ${assignedData.otHours > 0 ? `(OT ${assignedData.otHours})` : ''}` : '-';
                            const stHour = parseInt(slot.startTime.split(':')[0]) || 0;
                            const isMorning = stHour < 11;
                            const isLateMorning = stHour === 11;
                            const isAfternoon = stHour >= 12 && stHour < 16;
                            const isEvening = stHour >= 16 && stHour < 19;
                            const isNight = stHour >= 19;
                            const timeText = `${slot.startTime} - ${slot.endTime}`;
  
                            return (
                               <tr key={`${duty.id}-${originalIdx}`} className="text-center h-10">
                                  {localIdx === 0 && (
                                     <>
                                        <td rowSpan={activeSlots.length} className="border border-slate-800 p-2 font-bold uppercase">{posText}</td>
                                        <td rowSpan={activeSlots.length} className="border border-slate-800 p-2 font-bold text-slate-600">CARD #{dIdx + 1}</td>
                                        <td rowSpan={activeSlots.length} className="border border-slate-800 p-2 text-left font-black">{duty.jobA}</td>
                                        <td rowSpan={activeSlots.length} className="border border-slate-800 p-2 text-left text-slate-600 text-[9px] sm:text-[10px]">{duty.jobB}</td>
                                        <td rowSpan={activeSlots.length} className="border border-slate-800 p-2 font-black text-sm sm:text-base"><u className="underline-offset-2">{activeSlots.length}</u></td>
                                     </>
                                  )}
                                  <td className="border border-slate-800 p-2 text-left font-bold">{staffName}</td>
                                  {activeDayShiftVisibilities.hasMorning && <td className={`border border-slate-800 p-2 font-bold text-[9px] sm:text-[10px] ${isMorning ? 'bg-slate-200 print:bg-slate-300' : 'bg-slate-50 print:bg-white'}`}>{isMorning ? timeText : ''}</td>}
                                  {activeDayShiftVisibilities.hasLateMorning && <td className={`border border-slate-800 p-2 font-bold text-[9px] sm:text-[10px] ${isLateMorning ? 'bg-slate-200 print:bg-slate-300' : 'bg-slate-50 print:bg-white'}`}>{isLateMorning ? timeText : ''}</td>}
                                  {activeDayShiftVisibilities.hasAfternoon && <td className={`border border-slate-800 p-2 font-bold text-[9px] sm:text-[10px] ${isAfternoon ? 'bg-slate-200 print:bg-slate-300' : 'bg-slate-50 print:bg-white'}`}>{isAfternoon ? timeText : ''}</td>}
                                  {activeDayShiftVisibilities.hasEvening && <td className={`border border-slate-800 p-2 font-bold text-[9px] sm:text-[10px] ${isEvening ? 'bg-slate-200 print:bg-slate-300' : 'bg-slate-50 print:bg-white'}`}>{isEvening ? timeText : ''}</td>}
                                  {activeDayShiftVisibilities.hasNight && <td className={`border border-slate-800 p-2 font-bold text-[9px] sm:text-[10px] ${isNight ? 'bg-slate-200 print:bg-slate-300' : 'bg-slate-50 print:bg-white'}`}>{isNight ? timeText : ''}</td>}
                                  <td className="border border-slate-800 p-2"></td>
                               </tr>
                            );
                         });
                      })}
                      <tr className="text-center bg-slate-50 print:bg-slate-100 font-black h-12">
                         <td colSpan={4} className="border border-slate-800 p-2 text-right pr-6 uppercase tracking-widest">Total Staff Required</td>
                         <td className="border border-slate-800 p-2 text-base"><u className="underline-offset-2 text-indigo-600">
                            {CURRENT_DUTY_LIST.reduce((acc, duty) => {
                               const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                               const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                               let count = 0;
                               slots.forEach((s, i) => { if(assigned[i] && assigned[i].staffId) count++; });
                               return acc + count;
                            }, 0)}
                         </u></td>
                         <td colSpan={activeDayShiftVisibilities.bottomColSpan + 1} className="border border-slate-800 p-2"></td>
                      </tr>
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    );
  };

  const renderManagerMonthly = () => {
    return (
       <div className="w-full animate-in fade-in duration-500">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden w-full">
             <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                <div className="flex flex-col">
                   <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Monthly Schedule: {THAI_MONTHS[selectedMonth]}</h2>
                   <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">{activeDept.toUpperCase()} DEPT</div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                   <button onClick={() => handleAutoAssign('monthly')} disabled={aiLoading} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-black shadow-lg active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-yellow-400" />} จัดกะอัตโนมัติ (ทั้งเดือน)
                   </button>
                   <button onClick={() => setConfirmModal({ message: 'ยืนยันการล้างข้อมูลกะงานของ "ทั้งเดือนนี้" ใช่หรือไม่?', action: () => handleClearSchedule('monthly') })} className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 px-4 py-2 sm:py-3 rounded-xl flex justify-center items-center shadow-sm active:scale-95 transition-all">
                      <Eraser className="w-4 h-4" />
                   </button>
                   <button onClick={() => setView('print')} className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-slate-50 shadow-sm active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
                      <Printer className="w-4 h-4" /> ไปหน้าพิมพ์
                   </button>
                </div>
             </div>
             <div className="overflow-auto custom-scrollbar" style={{ maxHeight: '80vh' }}>
                <table className="w-full border-collapse text-left min-w-[1200px]">
                   <thead className="bg-white sticky top-0 z-20 shadow-sm">
                   <tr>
                      <th className="p-4 sm:p-6 border-b border-r border-slate-100 min-w-[100px] sticky left-0 bg-white z-30 font-black text-xs sm:text-sm text-slate-400 uppercase tracking-widest">Date</th>
                      {CURRENT_DUTY_LIST.map(duty => {
                         const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                         const isAll = reqArr.includes('ALL') || reqArr.length === 0;
                         const displayPos = isAll ? 'ALL POS' : reqArr.join(', ');
                         return (
                         <th key={duty.id} className="p-4 sm:p-6 border-b border-r border-slate-100 min-w-[250px] last:border-r-0">
                            <div className="font-black text-slate-900 text-xs sm:text-sm uppercase leading-tight">{duty.jobA}</div>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic truncate max-w-[150px]">{duty.jobB}</div>
                               <div className="text-[7px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={displayPos}>{displayPos}</div>
                            </div>
                         </th>
                         )
                      })}
                   </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                   {CALENDAR_DAYS.map(day => {
                      const dayData = schedule[day.dateStr] || {};
                      const dayConfig = CALENDAR_DAYS.find(c => c.dateStr === day.dateStr);
                      const type = dayConfig ? dayConfig.type : 'weekday';
  
                      const dayUsedStaffIds = new Set();
                      if (dayData.leaves) dayData.leaves.forEach(l => l.staffId && dayUsedStaffIds.add(l.staffId));
                      if (dayData.duties) Object.values(dayData.duties).forEach(slots => { slots.forEach(s => s.staffId && dayUsedStaffIds.add(s.staffId)); });
                      
                      const unassignedStaffMonthly = branchData.staff?.filter(s => s.dept === activeDept && !dayUsedStaffIds.has(s.id)) || [];
  
                      return (
                         <tr key={day.dateStr} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 border-r border-slate-100 sticky left-0 bg-white hover:bg-slate-50 z-10 align-top min-w-[120px]">
                               <div className="flex flex-col items-center">
                               <span className="text-xl sm:text-2xl font-black text-slate-900">{day.dayNum}</span>
                               <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded ${day.type === 'weekend' ? 'bg-orange-100 text-orange-600' : 'text-slate-400 bg-slate-100'}`}>{day.dayLabel}</span>
                               </div>
                               <div className="mt-3 space-y-1">
                               {dayData.leaves?.map((l, i) => {
                                  const staff = branchData.staff.find(s => s.id === l.staffId);
                                  if (!staff || staff.dept !== activeDept) return null; 
                                  const lType = LEAVE_TYPES.find(t => t.id === l.type);
                                  return <div key={i} className={`text-[8px] font-bold px-1.5 py-1 rounded border ${lType?.color || 'bg-gray-100'} truncate w-full text-center shadow-sm`}>{staff.name.split(' ')[0]}</div>
                               })}
                               </div>
                               {unassignedStaffMonthly.length > 0 && (
                                  <div className="mt-3 border-t border-slate-100 pt-2 print:hidden">
                                     <div className="text-[8px] font-black text-amber-500 mb-1 text-center bg-amber-50 rounded py-0.5 border border-amber-100">ว่าง ({unassignedStaffMonthly.length})</div>
                                     <div className="space-y-1 flex flex-col items-center">
                                        {unassignedStaffMonthly.map(s => (
                                           <div key={s.id} className="text-[8px] font-bold px-1.5 py-1 rounded border bg-white text-amber-700 border-amber-200 truncate w-full text-center shadow-sm">{s.name.split(' ')[0]}</div>
                                        ))}
                                     </div>
                                  </div>
                               )}
                            </td>
                            {CURRENT_DUTY_LIST.map(duty => {
                            const slots = branchData.matrix?.[type]?.duties?.[duty.id] || [];
                            const assigned = dayData.duties?.[duty.id] || [];
                            const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
  
                            return (
                               <td key={duty.id} className="p-3 align-top border-r border-slate-100 last:border-r-0">
                                  <div className="space-y-3">
                                  {slots.map((slot, idx) => {
                                     const data = assigned[idx] || { staffId: "", otHours: 0 };
                                     return (
                                        <div key={idx} className={`p-2 rounded-xl border ${!data.staffId ? 'border-dashed border-slate-200 bg-slate-50/50' : 'border-indigo-100 bg-white shadow-sm'}`}>
                                        <div className="flex justify-between items-center mb-1.5">
                                           <span className="text-[9px] font-bold text-slate-400">{slot.startTime}-{slot.endTime}</span>
                                           <div className="flex gap-1">
                                              {data.otHours > 0 && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 rounded">OT:{data.otHours}</span>}
                                           </div>
                                        </div>
                                        <select value={data.staffId} onChange={(e) => updateSchedule(day.dateStr, duty.id, idx, 'staffId', e.target.value, slot.maxOtHours)} className="w-full text-[10px] font-bold bg-transparent outline-none text-slate-800 truncate mb-1">
                                           <option value="">-- ว่าง --</option>
                                           {branchData.staff?.filter(s => s.dept === activeDept).map(s => {
                                             const isUsedInThisDay = dayUsedStaffIds.has(s.id) && data.staffId !== s.id;
                                             const wrongPos = !checkPositionEligibility(s.pos, reqArr, activeDept) && data.staffId !== s.id;
                                             return (isUsedInThisDay || wrongPos) ? null : <option key={s.id} value={s.id}>{s.name}</option>
                                           })}
                                        </select>
                                        {data.staffId && (
                                           <div className="flex items-center gap-1 mt-1 border-t border-slate-100 pt-1">
                                              <span className="text-[8px] text-slate-300 font-black">OT</span>
                                              <input type="number" step="0.5" className="w-full text-[10px] font-black text-right outline-none bg-transparent text-indigo-600" value={data.otHours} onChange={(e) => updateSchedule(day.dateStr, duty.id, idx, 'otHours', parseFloat(e.target.value) || 0)} />
                                           </div>
                                        )}
                                        </div>
                                     );
                                  })}
                                  </div>
                               </td>
                            )
                            })}
                         </tr>
                      )
                   })}
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    );
  };

  const renderReportView = () => {
    return (
       <div className="flex-1 space-y-6 sm:space-y-12 animate-in fade-in duration-500 pb-24 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
             <div className="flex items-center gap-4 sm:gap-6">
                <div className="bg-yellow-400 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl sm:shadow-2xl shadow-yellow-100"><TrendingUp className="w-6 h-6 sm:w-10 sm:h-10 text-white" /></div>
                <div>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter uppercase">Analytical Insight</h2>
                <p className="text-slate-400 font-bold uppercase text-[10px] sm:text-sm tracking-widest mt-0.5 sm:mt-1">Performance & OT Efficiency Report</p>
                </div>
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                <div className="flex-1 sm:flex-none bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center shadow-md text-[10px] sm:text-xs uppercase tracking-widest gap-2">
                   <Filter className="w-4 h-4"/> Filtered
                </div>
                <button onClick={handleExportExcel} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center shadow-md text-[10px] sm:text-xs uppercase tracking-widest gap-2 transition-all active:scale-95">
                   <Download className="w-4 h-4"/> Export (CSV)
                </button>
             </div>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-end sm:items-center w-full">
             <div className="flex items-center gap-3">
                <span className="font-black text-slate-700 text-sm uppercase">ตัวกรองเวลา:</span>
                <select value={reportFilterMode} onChange={e => setReportFilterMode(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none text-indigo-700 focus:border-indigo-500">
                   <option value="month">รายเดือน (ตามปฏิทิน)</option>
                   <option value="custom">กำหนดเอง (วันที่ - วันที่)</option>
                </select>
             </div>
             {reportFilterMode === 'month' ? (
                <select value={reportFilterMonth} onChange={e => setReportFilterMonth(parseInt(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-2.5 text-xs font-bold outline-none text-slate-700 focus:border-indigo-500">
                   {THAI_MONTHS.map((m, i) => <option key={i} value={i}>{m} {selectedYear + 543}</option>)}
                </select>
             ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                   <input type="date" value={reportFilterStart} onChange={e => setReportFilterStart(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none w-full sm:w-auto text-slate-700 focus:border-indigo-500" />
                   <span className="font-black text-slate-400">-</span>
                   <input type="date" value={reportFilterEnd} onChange={e => setReportFilterEnd(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none w-full sm:w-auto text-slate-700 focus:border-indigo-500" />
                </div>
             )}
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
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        #root { max-width: none !important; margin: 0 !important; padding: 0 !important; text-align: left !important; width: 100% !important; display: flex !important; flex-direction: column !important; min-height: 100vh !important; }
        html, body { scrollbar-gutter: stable; width: 100%; margin: 0; padding: 0; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        @media (min-width: 640px) { .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 10px; } }
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
      
      {renderModals()}
      {authRole === 'guest' ? renderGuestLogin() : (
        <div className="flex-1 flex flex-col min-h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased overflow-x-hidden">
          <nav className="flex-none sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden shadow-sm px-4 sm:px-8 py-3 w-full">
             <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0 w-full">
                <div className="flex items-center justify-between w-full lg:w-auto">
                   <div className="flex items-center gap-3 sm:gap-4">
                   <img src="https://img2.pic.in.th/gon-logo.png" alt="Logo" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-md object-cover border-2 border-slate-100 bg-white transition hover:scale-105 duration-500" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150?text=GON"; }} />
                   <div className="flex flex-col">
                      <span className="font-black text-lg sm:text-xl tracking-tighter uppercase leading-none">Super Store</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
                         <span className={`text-[8px] sm:text-[9px] font-black uppercase text-slate-400`}>{authRole === 'superadmin' ? 'BAR B Q PLAZA' : authRole === 'staff' ? 'STAFF PORTAL' : 'BRANCH MANAGEMENT'}</span>
                      </div>
                   </div>
                   {authRole === 'superadmin' && (
                      <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-1 ml-2 sm:ml-6 border border-slate-200 shadow-inner">
                         <ArrowLeftRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 mx-2 sm:mx-3" />
                         <select value={activeBranchId || ''} onChange={(e) => setActiveBranchId(e.target.value)} className="bg-transparent text-[9px] sm:text-[11px] font-black outline-none py-1 sm:py-2 pr-2 sm:pr-4 text-indigo-600 cursor-pointer uppercase max-w-[120px] sm:max-w-none">
                         <option value="">-- SELECT BRANCH --</option>{globalConfig.branches?.map(b => <option key={b.id} value={b.id}>{b.name.substring(0,15).toUpperCase()}</option>)}
                         </select>
                      </div>
                   )}
                   </div>
                   <div className="lg:hidden flex items-center gap-2">
                      {authRole !== 'staff' && (
                          <button onClick={() => setShowRequestsModal(true)} className="relative bg-slate-100 p-2 rounded-lg text-slate-500">
                             <Bell className="w-4 h-4" />{pendingRequests.filter(r => authRole === 'staff' ? (r.reqType === 'SWAP' && r.targetStaffId === staffFilterPos && r.status === 'PENDING_PEER') : (r.reqType !== 'SWAP' || r.status === 'PENDING_MANAGER')).length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                          </button>
                      )}
                      <button onClick={() => {setAuthRole('guest'); setView('manager');}} className="text-slate-400 p-2 bg-slate-100 rounded-lg"><LogIn className="w-4 h-4 rotate-180" /></button>
                   </div>
                </div>
                {authRole === 'staff' ? (
                   <div className="flex-1 flex justify-end items-center gap-4 mt-4 lg:mt-0">
                       <button onClick={() => setShowRequestsModal(true)} className="relative bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl text-slate-500 transition cursor-pointer hidden sm:flex">
                          <Bell className="w-5 h-5" />{pendingRequests.filter(r => r.reqType === 'SWAP' && r.targetStaffId === staffFilterPos && r.status === 'PENDING_PEER').length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>}
                       </button>
                       <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 text-emerald-700">
                          <UserCircle className="w-5 h-5"/><span className="font-black text-xs uppercase">{branchData.staff?.find(s=>s.id===staffFilterPos)?.name || 'Staff'}</span>
                       </div>
                       <button onClick={() => {setAuthRole('guest'); setView('manager');}} className="hidden lg:flex text-slate-400 hover:text-red-500 transition items-center gap-2 font-bold text-xs"><LogIn className="w-5 h-5 rotate-180" /> LOGOUT</button>
                   </div>
                ) : (
                <div className="flex items-center gap-2 sm:gap-5 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-1 lg:pb-0 mt-4 lg:mt-0">
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
                      {authRole === 'superadmin' && <button onClick={() => setView('branches')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'branches' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-50' : 'text-slate-500'}`}>BRANCHES</button>}
                   </div>
                   <div className="hidden lg:flex flex-shrink-0 items-center gap-3 ml-2 pl-5 border-l border-slate-200">
                      <button onClick={() => setShowRequestsModal(true)} className="relative bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl text-slate-500 transition cursor-pointer">
                         <Bell className="w-5 h-5" />{pendingRequests.filter(r => r.reqType !== 'SWAP' || r.status === 'PENDING_MANAGER').length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>}
                      </button>
                      <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs hover:bg-indigo-700 active:scale-95 transition flex items-center gap-2">
                         {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
                      </button>
                      <button onClick={() => {setAuthRole('guest'); setView('manager');}} className="text-slate-400 hover:text-red-500 transition"><LogIn className="w-6 h-6 rotate-180" /></button>
                   </div>
                </div>
                )}
             </div>
          </nav>
          {authRole !== 'staff' && (
              <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="lg:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl active:scale-90 transition-transform">
                 {saveStatus === 'saving' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              </button>
          )}
          <main className="flex-1 flex flex-col p-4 sm:p-8 max-w-[1600px] mx-auto w-full print:p-0 print:m-0 relative">
            {authRole === 'staff' ? renderStaffPortal() : (
              <>
                {(view === 'manager' || view === 'admin') && (
                   <div className="flex-none flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-10 print:hidden w-full">
                      <div className="flex flex-wrap gap-2 sm:gap-4 bg-white p-2 sm:p-3 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 w-full md:w-fit shadow-sm">
                         <button onClick={() => { setActiveDept('service'); setStaffFilterPos('ALL'); }} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-[1rem] sm:rounded-[2rem] font-black text-[10px] sm:text-xs transition-all ${activeDept === 'service' ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><ConciergeBell className="w-4 h-4 sm:w-5 sm:h-5"/> ฝั่งงานบริการ</button>
                         <button onClick={() => { setActiveDept('kitchen'); setStaffFilterPos('ALL'); }} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-[1rem] sm:rounded-[2rem] font-black text-[10px] sm:text-xs transition-all ${activeDept === 'kitchen' ? 'bg-orange-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5"/> ฝั่งงานครัว</button>
                      </div>
                      {view === 'manager' && (
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                           <button onClick={() => setManagerViewMode('daily')} className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${managerViewMode === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><CalendarDaysIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2"/><span className="hidden sm:inline">จัดกะแบบรายวัน</span><span className="sm:hidden">รายวัน</span></button>
                           <button onClick={() => setManagerViewMode('monthly')} className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${managerViewMode === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2"/><span className="hidden sm:inline">จัดกะแบบรายเดือน</span><span className="sm:hidden">รายเดือน</span></button>
                           <button onClick={() => setManagerViewMode('daily_table')} className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${managerViewMode === 'daily_table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><TableProperties className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2"/><span className="hidden sm:inline">Duty Roster Chart</span><span className="sm:hidden">Roster</span></button>
                        </div>
                      )}
                   </div>
                )}

                {view === 'branches' && authRole === 'superadmin' ? (
                   <div className="flex-1 space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24 w-full">
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
                                const n = document.getElementById('bn').value; const u = document.getElementById('bu').value; const p = document.getElementById('bp').value;
                                if(n && u && p) { setGlobalConfig(prev => ({...prev, branches: [...(prev.branches || []), {id: 'b'+Date.now(), name: n, user: u, pass: p}]})); document.getElementById('bn').value = ''; document.getElementById('bu').value = ''; document.getElementById('bp').value = ''; }
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
                                       {editingBranchId === b.id ? (
                                          <div className="mt-4 space-y-2">
                                             <input type="text" placeholder="Name" value={editBranchData.name || ''} onChange={e => setEditBranchData({...editBranchData, name: e.target.value})} className="w-full border rounded-lg px-2 py-1 text-xs"/>
                                             <input type="text" placeholder="User" value={editBranchData.user || ''} onChange={e => setEditBranchData({...editBranchData, user: e.target.value})} className="w-full border rounded-lg px-2 py-1 text-xs"/>
                                             <input type="text" placeholder="Pass" value={editBranchData.pass || ''} onChange={e => setEditBranchData({...editBranchData, pass: e.target.value})} className="w-full border rounded-lg px-2 py-1 text-xs"/>
                                             <div className="flex gap-2">
                                                <button onClick={saveEditBranch} className="bg-green-500 text-white px-3 py-1 rounded-lg text-[10px]"><Check className="w-3 h-3"/></button>
                                                <button onClick={() => setEditingBranchId(null)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px]"><X className="w-3 h-3"/></button>
                                             </div>
                                          </div>
                                       ) : (
                                          <button onClick={() => startEditBranch(b)} className="mt-2 text-indigo-500 text-[10px] font-bold flex items-center gap-1 hover:underline"><Edit2 className="w-3 h-3"/> แก้ไขข้อมูล</button>
                                       )}
                                   </div>
                                   <button onClick={() => setGlobalConfig(prev => ({...prev, branches: prev.branches.filter(x => x.id !== b.id)}))} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-5 h-5 sm:w-6 sm:h-6"/></button>
                                </div>
                              ))}
                           </div>
                        </div>
                     </div>
                   </div>
                ) : view === 'admin' ? (
                   !activeBranchId ? (
                     <div className="flex-1 h-[60vh] sm:h-[70vh] flex flex-col items-center justify-center gap-4 sm:gap-6 text-slate-300 font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-center px-4 w-full">
                       <Store className="w-16 h-16 sm:w-24 sm:h-24 opacity-10" />
                       <p className="text-sm sm:text-base">กรุณาเลือกสาขาที่ต้องการจัดการจากแถบด้านบน</p>
                     </div>
                   ) : (
                     <div className="flex-1 space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24 w-full">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                           <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
                             <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Users className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการพนักงาน ({globalConfig.branches?.find(b=>b.id===activeBranchId)?.name})</h2>
                             <div className="flex flex-wrap gap-2 mb-6 sm:mb-8 bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                               <div className="text-[10px] sm:text-xs font-black text-slate-500 w-full mb-1 uppercase tracking-widest">สรุปจำนวนพนักงานแยกตามตำแหน่ง (คลิกเพื่อกรอง)</div>
                               <div className="flex flex-wrap gap-2">
                                  <button onClick={() => setStaffFilterPos('ALL')} className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all shadow-sm ${staffFilterPos === 'ALL' ? 'bg-slate-800 text-white scale-105' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>รวม {branchData.staff?.filter(s => s.dept === activeDept).length || 0} คน</button>
                                  {POSITIONS[activeDept].map(p => {
                                     const count = (branchData.staff || []).filter(s => s.dept === activeDept && s.pos === p).length;
                                     const isSelected = staffFilterPos === p;
                                     if (count === 0) return <button key={p} onClick={() => setStaffFilterPos(isSelected ? 'ALL' : p)} className={`text-[10px] font-bold border px-2.5 py-1 rounded-lg transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>{p}: 0</button>;
                                     return <button key={p} onClick={() => setStaffFilterPos(isSelected ? 'ALL' : p)} className={`text-[10px] font-black border px-2.5 py-1 rounded-lg transition-all shadow-sm ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 scale-105' : 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'}`}>{p}: {count}</button>;
                                  })}
                               </div>
                             </div>
                             <div className="space-y-4 mb-6 sm:mb-10 w-full">
                               <div className="flex flex-col xl:flex-row gap-2 sm:gap-4">
                                  <input type="text" placeholder="รหัสพนง." className="w-full xl:w-24 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none transition shadow-sm" value={newStaffEmpId} onChange={(e) => setNewStaffEmpId(e.target.value)} />
                                  <input type="text" placeholder={`ชื่อพนักงานใหม่ (${newStaffDept === 'service' ? 'บริการ' : 'ครัว'})...`} className="w-full xl:w-auto flex-[2] border-2 border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none transition shadow-sm" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
                                  <div className="flex gap-2 sm:gap-4 flex-1">
                                    <select value={newStaffDept} onChange={(e) => { setNewStaffDept(e.target.value); setNewStaffPos(POSITIONS[e.target.value][0]); }} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500">
                                       <option value="service">งานบริการ</option><option value="kitchen">งานครัว</option>
                                    </select>
                                    <select value={newStaffPos} onChange={(e) => setNewStaffPos(e.target.value)} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500">
                                       {POSITIONS[newStaffDept].map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <select value={newStaffDayOff} onChange={(e) => setNewStaffDayOff(e.target.value)} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500 text-slate-500">
                                       <option value="">- วันหยุด -</option>{DAYS_OF_WEEK.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                    </select>
                                  </div>
                                  <button onClick={() => { if(newStaffName.trim()){ setBranchData(p => ({...p, staff: [...(p.staff || []), {id: 's' + Date.now(), empId: newStaffEmpId.trim(), name: newStaffName.trim(), dept: newStaffDept, pos: newStaffPos, regularDayOff: newStaffDayOff === '' ? null : parseInt(newStaffDayOff)}]})); setNewStaffName(''); setNewStaffEmpId(''); setNewStaffDayOff(''); } }} className="w-full xl:w-auto bg-slate-900 text-white px-6 sm:px-8 py-3 rounded-xl sm:rounded-2xl font-black text-xs hover:bg-indigo-600 transition uppercase flex items-center justify-center"><UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-0 sm:mr-0"/><span className="xl:hidden ml-2">เพิ่มพนักงาน</span></button>
                               </div>
                             </div>
                             <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[400px] overflow-y-auto pr-2 sm:pr-3 custom-scrollbar">
                               {branchData.staff?.filter(s => s.dept === activeDept && (staffFilterPos === 'ALL' || s.pos === staffFilterPos)).length === 0 ? (
                                 <div className="text-center py-8 sm:py-10 text-slate-400 font-bold text-[10px] sm:text-sm uppercase tracking-widest border-2 border-dashed rounded-[1.5rem] sm:rounded-[2rem]">ไม่มีพนักงานในแผนก/ตำแหน่งนี้</div>
                               ) : branchData.staff?.filter(s => s.dept === activeDept && (staffFilterPos === 'ALL' || s.pos === staffFilterPos)).map(s => (
                                 <div key={s.id} className="flex justify-between items-center p-4 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition group shadow-sm">
                                    {editingStaffId === s.id ? (
                                       <div className="flex-1 flex gap-2 items-center flex-wrap">
                                          <input type="text" placeholder="รหัส" value={editStaffData.empId || ''} onChange={e => setEditStaffData({...editStaffData, empId: e.target.value})} className="border rounded px-2 py-1 text-xs w-full sm:w-16"/>
                                          <input type="text" value={editStaffData.name} onChange={e => setEditStaffData({...editStaffData, name: e.target.value})} className="border rounded px-2 py-1 text-xs w-full sm:w-auto flex-1 min-w-[100px]"/>
                                          <select value={editStaffData.pos} onChange={e => setEditStaffData({...editStaffData, pos: e.target.value})} className="border rounded px-2 py-1 text-[10px]">
                                              {POSITIONS[s.dept].map(p => <option key={p} value={p}>{p}</option>)}
                                          </select>
                                          <select value={editStaffData.regularDayOff ?? ''} onChange={e => setEditStaffData({...editStaffData, regularDayOff: e.target.value === '' ? null : parseInt(e.target.value)})} className="border rounded px-2 py-1 text-[10px]">
                                              <option value="">- วันหยุด -</option>{DAYS_OF_WEEK.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                          </select>
                                          <button onClick={saveEditStaff} className="bg-green-500 text-white p-1.5 rounded"><Check className="w-3 h-3"/></button>
                                          <button onClick={() => setEditingStaffId(null)} className="bg-red-500 text-white p-1.5 rounded"><X className="w-3 h-3"/></button>
                                       </div>
                                    ) : (
                                       <>
                                         <div className="flex-1 min-w-0 pr-4">
                                            <span className="text-sm sm:text-base font-black text-slate-800 uppercase truncate block">
                                               {s.empId && <span className="text-slate-400 mr-2 text-xs">[{s.empId}]</span>} {s.name}
                                            </span>
                                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 items-center">
                                               <span className={`text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border uppercase ${s.dept === 'service' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>{s.dept}</span>
                                               <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 uppercase">{s.pos}</span>
                                               <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 uppercase truncate">หยุด: {s.regularDayOff !== undefined && s.regularDayOff !== null ? DAYS_OF_WEEK.find(d => d.id === s.regularDayOff)?.label : '-'}</span>
                                               <button onClick={() => startEditStaff(s)} className="text-slate-300 hover:text-indigo-500"><Edit2 className="w-3 h-3"/></button>
                                            </div>
                                         </div>
                                         <button onClick={() => setBranchData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                                       </>
                                    )}
                                 </div>
                               ))}
                             </div>
                           </div>
                           
                           <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
                             <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><List className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการหน้าที่งาน (Duties)</h2>
                             {authRole === 'superadmin' ? (
                               <div className="space-y-4 mb-6 sm:mb-10 w-full">
                                 <div className="flex flex-col xl:flex-row gap-2 sm:gap-4">
                                   <input type="text" placeholder="หน้าที่หลัก (เช่น ต้อนรับหน้าร้าน)" className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" value={newDutyJobA} onChange={e => setNewDutyJobA(e.target.value)} />
                                   <input type="text" placeholder="หน้าที่รอง (เช่น เคลียร์โต๊ะ)" className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" value={newDutyJobB} onChange={e => setNewDutyJobB(e.target.value)} />
                                   <PositionSelector disabled={false} value={newDutyReqPos} options={POSITIONS[activeDept]} onChange={setNewDutyReqPos} className="w-full xl:min-w-[80px]" />
                                   <button onClick={handleAddDuty} className="w-full xl:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-indigo-600 transition flex items-center justify-center"><Plus className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                                 </div>
                               </div>
                             ) : (
                               <p className="text-[10px] text-orange-500 font-bold mb-6 text-center bg-orange-50 py-2 rounded-xl border border-orange-100 uppercase tracking-widest">* โหมดอ่านอย่างเดียว (เฉพาะ Admin ส่วนกลางที่แก้ไขโครงสร้างได้)</p>
                             )}
                             <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[400px] overflow-y-auto pr-2 sm:pr-3 custom-scrollbar">
                               {CURRENT_DUTY_LIST.length === 0 ? (
                                 <div className="text-center py-8 sm:py-10 text-slate-400 font-bold text-[10px] sm:text-sm uppercase tracking-widest border-2 border-dashed rounded-[1.5rem]">ไม่มีข้อมูลหน้าที่</div>
                               ) : CURRENT_DUTY_LIST.map((duty, idx) => (
                                  <div key={duty.id} draggable={authRole === 'superadmin' && editingDutyId === null} onDragStart={() => setDraggedDutyIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleDropDuty(idx); }} onDragEnd={() => setDraggedDutyIdx(null)} className={`flex justify-between items-center p-3 sm:p-4 rounded-2xl border ${draggedDutyIdx === idx ? 'opacity-40 border-indigo-400 bg-indigo-50' : 'bg-slate-50 border-slate-100'} shadow-sm transition hover:bg-white hover:border-indigo-100`}>
                                    {authRole === 'superadmin' && editingDutyId === null && (
                                       <div className="cursor-grab active:cursor-grabbing mr-2 sm:mr-3 text-slate-300 hover:text-indigo-500 flex-shrink-0 touch-none"><GripVertical className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                                    )}
                                    {editingDutyId === duty.id ? (
                                       <div className="flex-1 flex flex-wrap gap-2 items-center">
                                          <input type="text" value={editDutyData.jobA} onChange={e => setEditDutyData({...editDutyData, jobA: e.target.value})} className="border rounded px-2 py-1 text-[10px] sm:text-xs flex-1 font-bold outline-none focus:border-indigo-500 min-w-[100px]"/>
                                          <input type="text" value={editDutyData.jobB} onChange={e => setEditDutyData({...editDutyData, jobB: e.target.value})} className="border rounded px-2 py-1 text-[10px] sm:text-xs flex-1 font-bold outline-none focus:border-indigo-500 min-w-[100px]"/>
                                          <PositionSelector disabled={false} value={editDutyData.reqPos || ['ALL']} options={POSITIONS[activeDept]} onChange={(val) => setEditDutyData({...editDutyData, reqPos: val})} className="w-full sm:min-w-[80px]" />
                                          <button onClick={handleEditDutySave} className="bg-green-500 text-white p-1.5 rounded-lg"><Check className="w-3 h-3"/></button>
                                          <button onClick={() => setEditingDutyId(null)} className="bg-red-500 text-white p-1.5 rounded-lg"><X className="w-3 h-3"/></button>
                                       </div>
                                    ) : (
                                       <>
                                         <div className="flex-1 min-w-0 pr-4">
                                           <div className="flex items-center gap-2">
                                              <div className="font-black text-xs sm:text-sm text-slate-800 truncate">{duty.jobA}</div>
                                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate max-w-[80px] sm:max-w-[120px]" title={(duty.reqPos || ['ALL']).join(', ')}>{(duty.reqPos || ['ALL']).join(', ')}</span>
                                           </div>
                                           <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate mt-0.5">{duty.jobB}</div>
                                         </div>
                                         {authRole === 'superadmin' && (
                                           <div className="flex gap-1 sm:gap-2">
                                             <button onClick={() => { setEditingDutyId(duty.id); setEditDutyData(duty); }} className="text-slate-300 hover:text-indigo-500 p-2"><Edit2 className="w-4 h-4"/></button>
                                             <button onClick={() => handleDeleteDuty(duty.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                                           </div>
                                         )}
                                       </>
                                    )}
                                  </div>
                               ))}
                             </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 w-full">
                           <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full">
                             <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center justify-center gap-2 sm:gap-4 uppercase tracking-tighter"><Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" /> วันหยุดประจำสาขา</h2>
                             <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
                               {CALENDAR_DAYS.map(d => {
                                 const isHoliday = branchData.holidays?.includes?.(d.dateStr);
                                 return (
                                   <button 
                                     key={d.dateStr} disabled={authRole === 'branch'} onClick={() => { if(authRole === 'superadmin') setBranchData(p=>({...p, holidays: isHoliday ? p.holidays.filter(x=>x!==d.dateStr) : [...(p.holidays || []), d.dateStr]})) }} 
                                     className={`w-full aspect-square rounded-[0.8rem] sm:rounded-[1.5rem] text-[10px] sm:text-[12px] font-black transition-all border-2 flex items-center justify-center ${isHoliday ? 'bg-red-500 text-white border-red-600 shadow-lg sm:shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'} ${authRole === 'branch' ? 'cursor-not-allowed opacity-80' : ''}`}
                                   >{d.dayNum}</button>
                                 );
                               })}
                             </div>
                             {authRole === 'branch' && <p className="text-[8px] sm:text-[10px] text-red-400 font-bold mt-6 sm:mt-8 text-center uppercase tracking-widest leading-relaxed">* เฉพาะ Admin ส่วนกลางเท่านั้นที่แก้ไขวันหยุดได้</p>}
                           </div>
                           
                           <div className="bg-emerald-50 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-emerald-100 shadow-sm w-full flex flex-col">
                             <h2 className="text-lg sm:text-xl font-black text-emerald-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><SaveAll className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" /> จัดการแม่แบบ (Templates)</h2>
                             <p className="text-xs font-bold text-emerald-600 mb-4">บันทึกโครงสร้างกะงาน (เวลาเข้า-ออก/OT) และหน้าที่งานทั้งหมดของแผนก <span className="uppercase font-black text-emerald-800">{activeDept}</span> ไว้ใช้ในภายหลัง</p>
                             {authRole === 'superadmin' ? (
                                 <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-white p-4 rounded-2xl border border-emerald-200">
                                    <input type="text" placeholder="ตั้งชื่อแม่แบบใหม่ (เช่น สัปดาห์สิ้นเดือน)" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500" />
                                    <button onClick={handleSaveTemplate} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-emerald-700 shadow-md transition-all whitespace-nowrap">บันทึกแม่แบบนี้</button>
                                 </div>
                             ) : (
                                 <p className="text-[10px] text-emerald-500 font-bold mb-4 bg-emerald-100/50 py-2 px-4 rounded-xl border border-emerald-200 uppercase tracking-widest">* โหมดอ่านอย่างเดียว (เฉพาะ Admin ส่วนกลางที่บันทึกแม่แบบได้)</p>
                             )}
                             <div className="flex-1 bg-white rounded-2xl border border-emerald-200 p-4 flex flex-col min-h-[150px]">
                                 <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-emerald-500" /> แม่แบบที่บันทึกไว้</h3>
                                 {(!globalTemplates || globalTemplates.length === 0) ? (
                                     <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">ยังไม่มีแม่แบบที่บันทึกไว้</div>
                                 ) : (
                                     <div className="space-y-2 overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                                         {globalTemplates.map(tpl => (
                                             <div key={tpl.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl hover:border-emerald-300 transition-colors">
                                                 <span className="font-black text-xs text-slate-700 truncate mr-4">{tpl.name}</span>
                                                 <div className="flex items-center gap-2 flex-shrink-0">
                                                     {authRole === 'superadmin' && (
                                                         <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white rounded-lg border shadow-sm"><Trash2 className="w-3 h-3" /></button>
                                                     )}
                                                     <button onClick={() => handleLoadTemplate(tpl.id)} disabled={authRole !== 'superadmin'} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors shadow-sm disabled:opacity-50 uppercase border border-emerald-200">Load</button>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 )}
                             </div>
                           </div>
                        </div>

                        <div className="space-y-6 sm:space-y-8 w-full">
                          <h2 className="text-xl sm:text-2xl font-black text-slate-800 px-2 uppercase tracking-tighter flex items-center gap-3 sm:gap-4"><Clock className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" /> โครงสร้างกะงานฝั่ง: {activeDept === 'service' ? 'บริการ' : 'ครัว'}</h2>
                          {Object.entries(branchData.matrix || {}).map(([key, data]) => (
                            <div key={key} className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm mb-6 sm:mb-10 w-full">
                              <div className={`px-6 sm:px-10 py-4 sm:py-6 font-black text-base sm:text-lg text-white ${key==='weekday' ? 'bg-slate-900' : key==='friday' ? 'bg-sky-700' : 'bg-orange-600'}`}>{key.toUpperCase()} CYCLE {authRole === 'branch' ? '(VIEW ONLY)' : ''}</div>
                              <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-xs text-left min-w-[800px]">
                                  <tbody className="divide-y divide-slate-100">
                                    {CURRENT_DUTY_LIST.map(duty => (
                                      <tr key={duty.id}>
                                        <td className="px-6 sm:px-10 py-6 sm:py-8 w-[30%]"><div className="font-black text-slate-900 text-sm sm:text-lg mb-1 leading-tight">{duty.jobA}</div><div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic leading-tight mt-1">{duty.jobB}</div></td>
                                        <td className="px-6 sm:px-10 py-6 sm:py-8">
                                          <div className="flex flex-wrap gap-4 sm:gap-6">
                                            {(data.duties?.[duty.id] || []).map((slot, idx) => (
                                              <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5 bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.2rem] border-2 border-slate-50 shadow-sm transition hover:border-indigo-100 relative">
                                                <div className="flex flex-col gap-1 w-[45%] sm:w-auto"><span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">เริ่ม</span><input type="text" disabled={authRole === 'branch'} className="border rounded-xl p-1.5 sm:p-2 text-[10px] sm:text-xs font-black text-center w-full sm:w-24 disabled:bg-slate-50 disabled:text-slate-300 outline-none focus:border-indigo-500" value={slot.startTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id][idx].startTime = e.target.value; setBranchData(nd); }} /></div>
                                                <div className="flex flex-col gap-1 w-[45%] sm:w-auto"><span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">เลิก</span><input type="text" disabled={authRole === 'branch'} className="border rounded-xl p-1.5 sm:p-2 text-[10px] sm:text-xs font-black text-center w-full sm:w-24 disabled:bg-slate-50 disabled:text-slate-300 outline-none focus:border-indigo-500" value={slot.endTime || ""} onChange={(e) => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id][idx].endTime = e.target.value; setBranchData(nd); }} /></div>
                                                <div className="flex flex-col gap-1 sm:border-l pl-0 sm:pl-4 w-[80%] sm:w-auto mt-2 sm:mt-0"><span className="text-[8px] sm:text-[9px] font-black text-indigo-500 uppercase">MAX OT</span><input type="number" disabled={authRole === 'branch'} step="0.5" className="w-full sm:w-20 border rounded-xl p-1.5 sm:p-2 text-center font-black bg-indigo-50/50 disabled:opacity-50 outline-none focus:border-indigo-500 text-[10px] sm:text-xs" value={slot.maxOtHours} onChange={(e) => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setBranchData(nd); }} /></div>
                                                {authRole === 'superadmin' && <button onClick={() => { const nd = JSON.parse(JSON.stringify(branchData)); nd.matrix[key].duties[duty.id].splice(idx,1); setBranchData(nd); }} className="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full p-1.5 transition"><X className="w-3 h-3"/></button>}
                                              </div>
                                            ))}
                                            {authRole === 'superadmin' && <button onClick={() => { const nd = JSON.parse(JSON.stringify(branchData)); if(!nd.matrix[key].duties[duty.id]) nd.matrix[key].duties[duty.id] = []; nd.matrix[key].duties[duty.id].push({startTime:"10:00", endTime:"19:00", maxOtHours:4.0}); setBranchData(nd); }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-4 sm:px-6 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2.2rem] text-[9px] sm:text-[11px] font-black text-slate-400 hover:border-indigo-500 transition self-stretch sm:self-center">+ SLOT</button>}
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
                   <div className="flex-1 space-y-6 sm:space-y-10 animate-in slide-in-from-bottom-6 duration-500 pb-24 w-full">
                      {managerViewMode === 'daily' ? renderManagerDailyCards() : managerViewMode === 'daily_table' ? renderManagerDailyTable() : renderManagerMonthly()}
                   </div>
                ) : view === 'print' ? (
                   <PrintMonthlyView CALENDAR_DAYS={CALENDAR_DAYS} branchData={branchData} globalConfig={globalConfig} activeBranchId={activeBranchId} THAI_MONTHS={THAI_MONTHS} selectedMonth={selectedMonth} getStaffDayInfo={getStaffDayInfo} setView={setView} activeDept={activeDept} CURRENT_DUTY_LIST={CURRENT_DUTY_LIST} />
                ) : (
                   renderReportView()
                )}
              </>
            )}
            <footer className="flex-none mt-auto pt-8 text-center pb-8 print:hidden opacity-60 hover:opacity-100 transition-opacity flex flex-col items-center w-full">
               <div className="flex items-center justify-center gap-3 mb-3"><div className="h-px w-12 bg-slate-300"></div><Award className="w-5 h-5 text-slate-400" /><div className="h-px w-12 bg-slate-300"></div></div>
               <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Powered by Super Store Team</p>
            </footer>
          </main>
        </div>
      )}
    </>
  );
}