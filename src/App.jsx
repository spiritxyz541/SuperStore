import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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
  Coffee,
  Briefcase,
  BarChart3,
  TrendingUp,
  Award,
  ArrowUpRight,
  PlaneTakeoff,
  Loader2
} from 'lucide-react';

/**
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - FINAL STABLE EDITION
 * Features:
 * - Real-time Database (Firebase Firestore)
 * - Global Save System (Edit all days, save once)
 * - 8 Full Thai Leave Types
 * - Admin OT Controls (0.5 step increments)
 * - Professional Report Dashboard
 * - A4 Landscape Print View
 */

// --- 1. Firebase Configuration (From Superstore Project) ---
const firebaseConfig = {
  apiKey: "AIzaSyBJEmXAPWUKafwutEg8TRUBQkIOP5TV0o",
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
// appId สำหรับแบ่ง Namespace ใน Firestore (ต้องเป็น String)
const appId = "superstore-production-v1";

// --- Constants ---
const DUTY_DEFINITIONS = [
  { id: 'D1', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน' },
  { id: 'D2', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)' },
  { id: 'D3', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Service Station /เคลียร์โต๊ะ' },
  { id: 'D4', jobA: 'พนักงานจัดอาหารเตรียมเสิร์ฟ/ทำขนมหวาน', jobB: '-' },
  { id: 'D5', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Service Station' },
  { id: 'D6', jobA: 'พนักงานเตรียม Service Station', jobB: 'พนักงานจัดอาหารเตรียมเสิร์ฟ/ทำขนมหวาน' },
];

const LEAVE_TYPES = [
  { id: 'OFF', label: 'หยุดประจำสัปดาห์', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { id: 'CO', label: 'หยุดชดเชย', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  { id: 'SO', label: 'เปลี่ยนหยุด', color: 'bg-indigo-100 text-indigo-600 border-indigo-200' },
  { id: 'AL', label: 'หยุดพักร้อน', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  { id: 'SL', label: 'ลาป่วย', color: 'bg-red-100 text-red-600 border-red-200' },
  { id: 'PL', label: 'ลากิจ', color: 'bg-orange-100 text-orange-600 border-orange-200' },
  { id: 'USL', label: 'ลาป่วย ไม่รับเงิน', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'UPL', label: 'ลากิจ ไม่รับเงิน', color: 'bg-amber-100 text-amber-800 border-amber-200' },
];

const INITIAL_MASTER_DATA = {
  dayTypes: {
    weekday: { name: "วันธรรมดา (จ-พฤ)", duties: {} },
    friday: { name: "วันศุกร์", duties: {} },
    weekend: { name: "วันเสาร์-อาทิตย์ / นักขัตฤกษ์", duties: {} }
  },
  staff: [],
  holidays: [] 
};

// Seed initial values for all positions
DUTY_DEFINITIONS.forEach(duty => {
  ['weekday', 'friday', 'weekend'].forEach(dt => {
    INITIAL_MASTER_DATA.dayTypes[dt].duties[duty.id] = [
      { startTime: "09:00", endTime: "18:00", otMultiplier: 1.5, maxOtHours: 4.0 }
    ];
  });
});

const getMarch2026Days = (holidays = []) => {
  const days = [];
  const date = new Date(2026, 2, 1);
  while (date.getMonth() === 2) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${d}`;
    const dayOfWeek = date.getDay();
    let type = 'weekday';
    if (holidays?.includes?.(dateStr) || dayOfWeek === 0 || dayOfWeek === 6) type = 'weekend';
    else if (dayOfWeek === 5) type = 'friday';
    days.push({ 
      dateStr, 
      dayNum: date.getDate(), 
      dayLabel: date.toLocaleDateString('th-TH', { weekday: 'short' }), 
      type 
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState('manager'); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [selectedDateStr, setSelectedDateStr] = useState('2026-03-01');
  const [schedule, setSchedule] = useState({}); 
  const [newStaffName, setNewStaffName] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  // 1. Auth Setup (Anonymous)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Firestore Sync (Fixed Path Segments: Collection(artifacts)/Doc(appId)/Collection(public)/Doc(data)/Collection(configs)/Doc(master) = 6 Segments)
  useEffect(() => {
    if (!user) return;

    // Sync Master Data
    const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master');
    const unsubMaster = onSnapshot(masterDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setMasterData(docSnap.data());
      } else {
        setDoc(masterDocRef, INITIAL_MASTER_DATA);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    // Sync Schedule Records
    const scheduleDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main');
    const unsubSched = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().records || {});
      }
    }, (err) => console.error("Firestore Sched Error:", err));

    return () => { unsubMaster(); unsubSched(); };
  }, [user]);

  const MARCH_DAYS = useMemo(() => getMarch2026Days(masterData.holidays || []), [masterData.holidays]);
  const activeDay = useMemo(() => MARCH_DAYS.find(d => d.dateStr === selectedDateStr) || MARCH_DAYS[0], [selectedDateStr, MARCH_DAYS]);

  const handleGlobalSave = async () => {
    if (!user) return;
    try {
      setSaveStatus('saving');
      const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master');
      const scheduleDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main');
      
      await setDoc(masterDocRef, masterData);
      await setDoc(scheduleDocRef, { records: schedule });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Save Error:", err);
      setSaveStatus('error');
    }
  };

  const updateSchedule = (dateStr, dutyId, slotIndex, field, value) => {
    setSchedule(prev => {
      const newSched = { ...prev };
      if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
      if (!newSched[dateStr].duties[dutyId]) newSched[dateStr].duties[dutyId] = [];
      const updatedSlots = [...newSched[dateStr].duties[dutyId]];
      if (!updatedSlots[slotIndex]) updatedSlots[slotIndex] = { staffId: "", otHours: 0 };
      updatedSlots[slotIndex] = { ...updatedSlots[slotIndex], [field]: field === 'otHours' ? parseFloat(value) || 0 : value };
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

  const isConflict = (dateStr, staffId, currentDutyId, currentSlotIndex) => {
    if (!staffId) return false;
    const dayData = schedule[dateStr];
    if (!dayData) return false;
    const onLeave = dayData.leaves?.some(l => l.staffId === staffId);
    if (onLeave) return true;
    return Object.keys(dayData.duties || {}).some(dutyId => 
      (dayData.duties[dutyId] || []).some((slot, idx) => slot?.staffId === staffId && (dutyId !== currentDutyId || idx !== currentSlotIndex))
    );
  };

  const reportData = useMemo(() => {
    const stats = { totalOt: 0, totalLeaves: 0, totalShifts: 0, staffStats: [], dutyStats: [], leaveStats: [] };
    if (!masterData.staff) return stats;

    const staffMap = {};
    const dutyMap = {};
    const leaveMap = {};

    masterData.staff.forEach(s => staffMap[s.id] = { name: s.name.toString(), ot: 0, shifts: 0, leaves: 0 });
    DUTY_DEFINITIONS.forEach(d => dutyMap[d.id] = { name: d.jobA, ot: 0 });
    LEAVE_TYPES.forEach(l => leaveMap[l.id] = { label: l.label, count: 0 });

    Object.keys(schedule).forEach(date => {
      const day = schedule[date];
      if (day.duties) {
        Object.keys(day.duties).forEach(dId => {
          (day.duties[dId] || []).forEach(slot => {
            if (slot.staffId && staffMap[slot.staffId]) {
              staffMap[slot.staffId].ot += (slot.otHours || 0);
              staffMap[slot.staffId].shifts += 1;
              stats.totalOt += (slot.otHours || 0);
              stats.totalShifts += 1;
              if (dutyMap[dId]) dutyMap[dId].ot += (slot.otHours || 0);
            }
          });
        });
      }
      if (day.leaves) {
        day.leaves.forEach(l => {
          if (l.staffId && staffMap[l.staffId]) {
            staffMap[l.staffId].leaves += 1;
            stats.totalLeaves += 1;
            if (leaveMap[l.type]) leaveMap[l.type].count += 1;
          }
        });
      }
    });

    stats.staffStats = Object.values(staffMap);
    stats.dutyStats = Object.values(dutyMap);
    stats.leaveStats = Object.values(leaveMap);
    return stats;
  }, [schedule, masterData.staff]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 font-sans">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="font-black text-slate-400 uppercase tracking-widest text-sm">กำลังเชื่อมต่อฐานข้อมูล Superstore...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-100">
      {/* Toast Notification */}
      {saveStatus === 'success' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 border border-slate-700 ring-4 ring-indigo-500/20">
            <div className="bg-green-500 p-1.5 rounded-full"><CheckCircle className="w-5 h-5 text-white" /></div>
            <span className="font-black text-base uppercase tracking-tighter">ซิงค์ข้อมูลลงคลาวด์เรียบร้อย!</span>
          </div>
        </div>
      )}

      {/* Nav Bar */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden h-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-2xl shadow-xl transition transform hover:rotate-6 active:scale-95 cursor-pointer">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tighter uppercase leading-none">Staff<span className="text-indigo-600">Sync</span></span>
              <span className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1 animate-pulse">● Cloud Active</span>
            </div>
          </div>
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-3xl shadow-inner">
            {[
              { id: 'manager', label: 'MANAGER', icon: Users },
              { id: 'admin', label: 'ADMIN', icon: Settings },
              { id: 'report', label: 'REPORT', icon: BarChart3 }
            ].map(v => (
              <button 
                key={v.id} onClick={() => setView(v.id)} 
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black transition-all active:scale-95 ${
                  view === v.id ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-50 border border-indigo-100' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <v.icon className="w-4 h-4" /> {v.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="min-h-[calc(100vh-5rem)]">
        {view === 'admin' && (
          <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Settings className="w-6 h-6 text-indigo-600" /> ตั้งค่าระบบหลังบ้าน</h1>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Configuration Management</p>
              </div>
              <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
                {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการตั้งค่า
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> พนักงาน</h2>
                <div className="flex gap-2 mb-6">
                  <input type="text" placeholder="ชื่อพนักงานใหม่..." className="flex-grow border rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (()=>{ if(!newStaffName.trim()) return; setMasterData(p=>({...p, staff:[...p.staff, {id:'s'+Date.now(), name:newStaffName.trim()}]})); setNewStaffName(''); })()} />
                  <button onClick={() => { if(!newStaffName.trim()) return; setMasterData(p=>({...p, staff:[...p.staff, {id:'s'+Date.now(), name:newStaffName.trim()}]})); setNewStaffName(''); }} className="bg-indigo-600 text-white px-6 py-2 rounded-2xl font-black">เพิ่ม</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {(masterData.staff || []).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl group border border-transparent hover:border-indigo-100 hover:bg-white transition">
                      <span className="text-sm font-bold text-slate-700">{s.name}</span>
                      <button onClick={() => setMasterData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Coffee className="w-5 h-5 text-red-500" /> วันหยุด</h2>
                <div className="grid grid-cols-7 gap-1.5">
                  {MARCH_DAYS.map(d => (
                    <button key={d.dateStr} onClick={() => setMasterData(p=>({...p, holidays: (p.holidays || []).includes(d.dateStr) ? p.holidays.filter(x=>x!==d.dateStr) : [...(p.holidays || []), d.dateStr]}))} className={`p-2 rounded-xl text-xs font-black transition-all ${masterData.holidays?.includes?.(d.dateStr) ? 'bg-red-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{d.dayNum}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {Object.entries(masterData.dayTypes || {}).map(([key, data]) => (
                <div key={key} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className={`px-6 py-4 font-black text-sm text-white ${key==='weekday' ? 'bg-slate-800' : key==='friday' ? 'bg-sky-600' : 'bg-orange-600'}`}>{data.name}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px]"><tr><th className="px-6 py-4">หน้าที่ (Job A / Job B)</th><th className="px-6 py-4">Slot เวลา และโควตา OT (เพิ่มทีละ 0.5)</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {DUTY_DEFINITIONS.map(duty => (
                          <tr key={duty.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 w-1/3">
                              <div className="font-black text-slate-800 text-sm">Job A: {duty.jobA}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-tighter">Job B: {duty.jobB}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                {(data.duties?.[duty.id] || []).map((slot, idx) => (
                                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shadow-sm">
                                    <input type="time" className="border rounded-lg p-1 text-[10px] font-bold" value={slot.startTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].startTime = e.target.value; setMasterData(nd); }} />
                                    <input type="time" className="border rounded-lg p-1 text-[10px] font-bold" value={slot.endTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].endTime = e.target.value; setMasterData(nd); }} />
                                    <div className="flex items-center gap-1 border-l pl-2 border-slate-200 ml-1 font-black text-indigo-600 uppercase text-[9px]">Max OT:<input type="number" step="0.5" className="w-14 border rounded-lg px-2 py-1 text-center font-black text-indigo-700 bg-white" value={slot.maxOtHours} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setMasterData(nd); }} /></div>
                                    <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id].splice(idx,1); setMasterData(nd); }} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                                ))}
                                <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); if(!nd.dayTypes[key].duties[duty.id]) nd.dayTypes[key].duties[duty.id] = []; nd.dayTypes[key].duties[duty.id].push({startTime:"09:00", endTime:"18:00", otMultiplier:1.5, maxOtHours:4.0}); setMasterData(nd); }} className="bg-white border-2 border-dashed border-slate-200 px-4 py-2 rounded-2xl text-[11px] font-black text-slate-400 hover:border-indigo-400 transition hover:bg-indigo-50/50">+ เพิ่ม Slot</button>
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
        )}

        {view === 'manager' && (
          <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 pb-20">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-1">
              {MARCH_DAYS.map(d => (
                <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${selectedDateStr === d.dateStr ? 'ring-4 ring-indigo-50 scale-105 shadow-xl z-10' : 'opacity-90 hover:translate-y-[-2px]'} ${masterData.holidays?.includes?.(d.dateStr) ? 'bg-red-500 text-white border-red-600' : d.type === 'weekend' ? 'bg-orange-500 text-white border-orange-600' : d.type === 'friday' ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{d.dayLabel}</span><span className="text-2xl font-black mt-1">{d.dayNum}</span>
                </button>
              ))}
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                <div className="mt-2"><span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${activeDay.type === 'weekday' ? 'bg-slate-100 text-slate-600 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-600' : 'bg-orange-50 text-orange-600'}`}>{masterData.dayTypes?.[activeDay.type]?.name || 'Unknown'}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setView('print')} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-200 transition"><Printer className="w-5 h-5" /> พิมพ์สรุป</button>
                <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 shadow-lg transition active:scale-95">
                  {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  บันทึกทั้งหมด
                </button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4 uppercase tracking-tighter text-indigo-500"><PlaneTakeoff className="w-5 h-5" /> พนักงานที่หยุด / ลางาน</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(schedule[selectedDateStr]?.leaves || []).map((l, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-2xl flex gap-2 items-center border border-slate-100 shadow-sm animate-in zoom-in-95">
                    <select value={l.staffId} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'staffId', e.target.value)} className="flex-[2] bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">-- ชื่อ --</option>
                      {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={l.type} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'type', e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none">
                      {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
                    </select>
                    <button onClick={() => updateLeaves(selectedDateStr, 'remove', idx)} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                <button onClick={() => updateLeaves(selectedDateStr, 'add')} className="border-2 border-dashed border-indigo-100 text-indigo-500 p-3 rounded-2xl font-black text-xs hover:bg-indigo-50 transition uppercase">+ เพิ่มรายการลา</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DUTY_DEFINITIONS.map(duty => {
                const slots = masterData.dayTypes?.[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                return (
                  <div key={duty.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-md">
                    <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center font-black uppercase text-slate-800 tracking-tighter"><span>{duty.jobA}</span><span className="text-xs text-indigo-600">{assigned.filter(x => !!x?.staffId).length}/{slots.length} Slots</span></div>
                    <div className="p-5 space-y-4">
                      {slots.map((slot, idx) => {
                        const data = assigned[idx] || { staffId: "", otHours: 0 };
                        const conflict = isConflict(selectedDateStr, data.staffId, duty.id, idx);
                        const isOver = (data.otHours || 0) > (slot.maxOtHours || 0);
                        return (
                          <div key={idx} className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${!data.staffId ? 'border-dashed border-slate-100 bg-slate-50/20' : conflict || isOver ? 'border-red-400 bg-red-50 shadow-inner' : 'border-indigo-50 bg-white shadow-sm'}`}>
                            <div className="flex justify-between items-center uppercase text-[10px] font-black text-slate-400"><span>Slot {idx+1} • {slot.startTime}-{slot.endTime}</span><span>Limit: {slot.maxOtHours} HR</span></div>
                            <div className="flex gap-2">
                              <select value={data.staffId} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'staffId', e.target.value)} className="flex-[3] bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm">
                                <option value="">-- พนักงาน --</option>
                                {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <div className={`flex-1 flex flex-col justify-center items-center border rounded-xl bg-white shadow-sm ${isOver ? 'border-red-300 ring-2' : 'border-slate-200'}`}><span className="text-[8px] font-black text-slate-400 uppercase">OT จริง</span><input type="number" step="0.5" value={data.otHours} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'otHours', e.target.value)} className={`w-full text-center font-black text-base outline-none bg-transparent ${isOver ? 'text-red-600' : 'text-slate-800'}`} /></div>
                            </div>
                            {conflict && <p className="text-[9px] text-red-600 font-bold flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3"/> ติดกะอื่นหรือลาหยุด</p>}
                            {isOver && <p className="text-[9px] text-red-600 font-bold flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3"/> เกินโควตา OT ที่ตั้งไว้</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><div className="flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl shadow-indigo-200 shadow-lg"><BarChart3 className="w-8 h-8 text-white" /></div><div><h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Monthly Analytics</h1><p className="text-slate-500 font-bold text-sm uppercase tracking-widest leading-none">Real-time Data Sync</p></div></div></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition"><TrendingUp className="absolute top-2 right-2 w-16 h-16 text-indigo-50 group-hover:text-indigo-100 transition duration-500" /><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Total OT</p><h3 className="text-4xl font-black text-indigo-600 mt-2">{(reportData?.totalOt || 0).toFixed(1)} <span className="text-sm">HR</span></h3></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition"><PlaneTakeoff className="absolute top-2 right-2 w-16 h-16 text-orange-50 group-hover:text-orange-100 transition duration-500" /><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Total Leave</p><h3 className="text-4xl font-black text-orange-600 mt-2">{reportData?.totalLeaves || 0} <span className="text-sm">DAYS</span></h3></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Active Staff</p><h3 className="text-4xl font-black text-slate-800 mt-2">{(reportData?.staffStats || []).filter(s=>s.shifts>0).length} / {(masterData.staff || []).length}</h3></div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Avg OT/Staff</p><h3 className="text-4xl font-black text-emerald-600 mt-2">{( (reportData?.totalOt || 0) / ( (reportData?.staffStats || []).filter(s=>s.shifts>0).length || 1)).toFixed(1)}</h3></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-6 border-b border-slate-100 font-black text-slate-800 flex justify-between items-center bg-slate-50/30 uppercase tracking-tighter"><Award className="w-5 h-5 text-yellow-500" /> Leaderboard</div><div className="overflow-x-auto scrollbar-hide"><table className="w-full text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b"><tr><th className="px-6 py-4 text-left">ชื่อ</th><th className="px-6 py-4 text-center">กะงาน</th><th className="px-6 py-4 text-center">ลา (วัน)</th><th className="px-6 py-4 text-center">OT (ชม.)</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-600">{(reportData?.staffStats || []).sort((a,b)=>b.ot - a.ot).map((s, idx) => (<tr key={idx} className="hover:bg-indigo-50/30 transition"><td className="px-6 py-4 font-black text-slate-800 uppercase">{s.name}</td><td className="px-6 py-4 text-center">{s.shifts}</td><td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-xs font-black">{s.leaves}</span></td><td className="px-6 py-4 text-center font-black text-indigo-600 bg-indigo-50/20">{(s.ot || 0).toFixed(1)}</td></tr>))}</tbody></table></div></div>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col hover:shadow-lg transition"><h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter border-b pb-4"><TrendingUp className="w-5 h-5 text-indigo-500" /> OT Distribution</h3><div className="space-y-6 flex-grow">{(reportData?.dutyStats || []).map((d, idx) => { const perc = (reportData?.totalOt || 0) > 0 ? (d.ot / reportData.totalOt) * 100 : 0; return (<div key={idx} className="space-y-2 group"><div className="flex justify-between text-[10px] font-black uppercase leading-none"><span className="text-slate-600 truncate w-32">{d.name}</span><span className="text-indigo-600 font-black">{(d.ot || 0).toFixed(1)} HR</span></div><div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner"><div className={`h-full transition-all duration-1000 ${idx === 0 ? 'bg-indigo-500' : idx === 1 ? 'bg-sky-500' : idx === 2 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${perc}%` }} /></div></div>); })}</div></div>
            </div>
          </div>
        )}

        {view === 'print' && (
          <div className="p-4 bg-white min-h-screen font-sans">
            <div className="max-w-full mx-auto">
              <div className="flex justify-between items-center mb-10 print:hidden">
                <button onClick={() => setView('manager')} className="flex items-center gap-2 text-slate-600 font-bold bg-slate-100 px-5 py-2.5 rounded-2xl hover:bg-slate-200 transition active:scale-95"><ChevronLeft className="w-4 h-4" /> กลับสู่หน้าจัดการ</button>
                <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl active:scale-95 transition"><Printer className="w-5 h-5" /> พิมพ์หรือเซฟ PDF</button>
              </div>
              <div className="text-center mb-8 uppercase"><h1 className="text-4xl font-black text-slate-900 tracking-tighter">Staff Schedule: March 2026</h1><p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] mt-2 italic font-black">MP26 Cloud Architecture • Landscape View</p></div>
              <div className="overflow-x-auto border-2 border-slate-900 rounded-lg">
                <table className="w-full border-collapse text-[7px]">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="border-r border-slate-700 p-2 text-left sticky left-0 bg-slate-900 z-10 w-32 font-black uppercase tracking-tighter leading-none">Employee Name</th>
                      {MARCH_DAYS.map(day => (
                        <th key={day.dateStr} className={`border-r border-slate-700 p-1 min-w-[32px] text-center ${day.type === 'weekend' || (masterData.holidays || []).includes(day.dateStr) ? 'bg-slate-800' : ''}`}><div className="font-black text-[10px] leading-none mb-1">{day.dayNum}</div><div className="text-[6px] opacity-70 uppercase font-black">{day.dayLabel}</div></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(masterData.staff || []).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 h-14 transition-colors">
                        <td className="border-r-2 border-slate-900 border-b border-slate-200 p-2 font-black sticky left-0 bg-white z-10 text-[9px] uppercase leading-none truncate max-w-[120px]">{s.name}</td>
                        {MARCH_DAYS.map(day => {
                          const dayData = schedule[day.dateStr];
                          let info = null;
                          const leave = (dayData?.leaves || []).find(l => l.staffId === s.id);
                          if (leave) info = { type: 'leave', info: LEAVE_TYPES.find(x => x.id === leave.type) };
                          else {
                            for (const dId of DUTY_DEFINITIONS.map(d=>d.id)) {
                              const sIdx = (dayData?.duties?.[dId] || []).findIndex(slot => slot.staffId === s.id);
                              if (sIdx !== -1) {
                                const slots = masterData.dayTypes?.[day.type]?.duties?.[dId] || [];
                                info = { type: 'work', duty: DUTY_DEFINITIONS.find(d => d.id === dId), slot: slots[sIdx] || {startTime: '00:00'}, actual: dayData.duties[dId][sIdx] };
                                break;
                              }
                            }
                          }
                          return (
                            <td key={day.dateStr} className={`border-r border-b border-slate-200 p-0.5 text-center ${!info ? 'bg-slate-50 opacity-20' : ''}`}>
                              {info?.type === 'work' ? (
                                <div className="flex flex-col items-center justify-center leading-tight"><span className="font-black text-indigo-700 text-[9px]">{info.slot.startTime}</span><div className="text-[6px] font-black text-slate-500 truncate w-full px-0.5 uppercase tracking-tighter leading-none">{info.duty.jobA.substring(0, 7)}..</div>{info.actual.otHours > 0 && <span className="bg-orange-100 text-orange-700 px-0.5 rounded-[1px] font-black text-[6px] mt-0.5">OT:{info.actual.otHours}</span>}</div>
                              ) : info?.type === 'leave' ? (
                                <div className={`w-full h-full flex flex-col items-center justify-center font-black ${info.info?.color} border-t border-b border-slate-200 shadow-inner`}><span className="text-[6px] text-center leading-none p-0.5 uppercase tracking-tighter">{info.info?.label}</span></div>
                              ) : <span className="text-[6px] font-black opacity-10 uppercase italic">OFF</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-16 flex justify-between text-center px-16"><div className="w-72 border-t-2 border-slate-900 pt-5"><p className="text-xs font-black uppercase text-slate-900 tracking-[0.2em]">Store Manager</p><div className="h-16"></div><p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Date: ____/____/____</p></div><div className="w-72 border-t-2 border-slate-900 pt-5"><p className="text-xs font-black uppercase text-slate-900 tracking-[0.2em]">Director</p><div className="h-16"></div><p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Date: ____/____/____</p></div></div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { 
          @page { size: A4 landscape; margin: 5mm; } 
          body { background: white !important; -webkit-print-color-adjust: exact; } 
          .print:hidden { display: none !important; } 
          table { width: 100% !important; border-collapse: collapse !important; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
}