import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
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
  Loader2
} from 'lucide-react';

/**
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - V2.8 (NOTEBOOK OPTIMIZED)
 * แก้ไข: 1. ปัญหา Input พิมพ์ได้ทีละตัว (Focus Loss Fix)
 * 2. เพิ่มปุ่มเลื่อนวันที่ ซ้าย-ขวา สำหรับการใช้งานบน Notebook
 */

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'superstore-stable-v1';

const DUTY_DEFINITIONS = [
  { id: 'D1', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน' },
  { id: 'D2', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)' },
  { id: 'D3', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Service Station /เคลียร์โต๊ะ' },
  { id: 'D4', jobA: 'พนักงานจัดอาหารเตรียมเสิร์ฟ/ทำขนมหวาน', jobB: '-' },
  { id: 'D5', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Service Station' },
  { id: 'D6', jobA: 'พนักงานเตรียม Service Station', jobB: 'พนักงานจัดอาหารเตรียมเสิร์ฟ/ทำขนมหวาน' },
];

const LEAVE_TYPES = [
  { id: 'OFF', label: 'หยุดประจำสัปดาห์', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'CO', label: 'หยุดชดเชย', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'SO', label: 'เปลี่ยนหยุด', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'AL', label: 'หยุดพักร้อน', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'SL', label: 'ลาป่วย', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'PL', label: 'ลากิจ', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'USL', label: 'ลาป่วย (ไม่รับเงิน)', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'UPL', label: 'ลากิจ (ไม่รับเงิน)', color: 'bg-amber-100 text-amber-800 border-amber-200' },
];

const INITIAL_MASTER_DATA = {
  dayTypes: {
    weekday: { name: "วันธรรมดา (จ-พฤ)", duties: {} },
    friday: { name: "วันศุกร์", duties: {} },
    weekend: { name: "วันหยุด / นักขัตฤกษ์", duties: {} }
  },
  staff: [{ id: 's1', name: 'พนักงานเริ่มต้น' }],
  holidays: [] 
};

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

export default function App() {
  const [view, setView] = useState('manager'); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [selectedDateStr, setSelectedDateStr] = useState('2026-03-01');
  const [schedule, setSchedule] = useState({}); 
  const [newStaffName, setNewStaffName] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const dateBarRef = useRef(null);

  // --- Sync Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error(error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Real-time Data Sync ---
  useEffect(() => {
    if (!user) return;
    const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master');
    const unsubMaster = onSnapshot(masterDocRef, (docSnap) => {
      if (docSnap.exists()) setMasterData(docSnap.data());
      else setDoc(masterDocRef, INITIAL_MASTER_DATA);
      setLoading(false);
    });

    const scheduleDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main');
    const unsubSched = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) setSchedule(docSnap.data().records || {});
    });

    return () => { unsubMaster(); unsubSched(); };
  }, [user]);

  const MARCH_DAYS = useMemo(() => getMarch2026Days(masterData.holidays || []), [masterData.holidays]);
  const activeDay = useMemo(() => MARCH_DAYS.find(d => d.dateStr === selectedDateStr) || MARCH_DAYS[0], [selectedDateStr, MARCH_DAYS]);

  const handleGlobalSave = async () => {
    if (!user) return;
    try {
      setSaveStatus('saving');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), masterData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main'), { records: schedule });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { setSaveStatus('error'); }
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

  const scrollDates = (dir) => {
    if (dateBarRef.current) {
      const amt = dir === 'left' ? -300 : 300;
      dateBarRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  const reportData = useMemo(() => {
    const stats = { totalOt: 0, totalLeaves: 0, totalShifts: 0, staffStats: [], dutyStats: [] };
    const staffMap = {};
    const dutyMap = {};
    (masterData.staff || []).forEach(s => staffMap[s.id] = { name: s.name, ot: 0, shifts: 0, leaves: 0 });
    DUTY_DEFINITIONS.forEach(d => dutyMap[d.id] = { name: d.jobA, ot: 0 });
    Object.keys(schedule).forEach(date => {
      const day = schedule[date];
      if (day.duties) {
        Object.keys(day.duties).forEach(dId => {
          (day.duties[dId] || []).forEach(slot => {
            if (slot.staffId && staffMap[slot.staffId]) {
              staffMap[slot.staffId].ot += (slot.otHours || 0);
              staffMap[slot.staffId].shifts += 1;
              stats.totalOt += (slot.otHours || 0);
              if (dutyMap[dId]) dutyMap[dId].ot += (slot.otHours || 0);
            }
          });
        });
      }
      if (day.leaves) { day.leaves.forEach(l => { if (l.staffId && staffMap[l.staffId]) { staffMap[l.staffId].leaves += 1; stats.totalLeaves += 1; } }); }
    });
    stats.staffStats = Object.values(staffMap).sort((a,b) => b.ot - a.ot);
    stats.dutyStats = Object.values(dutyMap);
    return stats;
  }, [schedule, masterData.staff]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="font-black text-slate-400 uppercase tracking-widest text-sm">กำลังเชื่อมต่อฐานข้อมูล Superstore...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {saveStatus === 'success' && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4">
          <div className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-slate-700 ring-8 ring-indigo-500/10">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <span className="font-black text-lg uppercase tracking-tight">Database Updated!</span>
          </div>
        </div>
      )}

      {/* Navbar Optimized for Notebook */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 print:hidden h-20 shadow-sm px-6">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-slate-900 p-2 rounded-xl shadow-xl"><LayoutDashboard className="w-5 h-5 text-white" /></div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter uppercase leading-none">Staff<span className="text-indigo-600">Sync</span></span>
              <span className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1">Live Connection</span>
            </div>
          </div>
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
            {[ 
              { id: 'manager', label: 'MANAGER', icon: Users }, 
              { id: 'admin', label: 'ADMIN', icon: Settings }, 
              { id: 'report', label: 'REPORT', icon: BarChart3 } 
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${view === v.id ? 'bg-white text-indigo-600 shadow-md border border-indigo-50' : 'text-slate-500 hover:text-slate-800'}`}><v.icon className="w-4 h-4" /> {v.label}</button>
            ))}
          </div>
        </div>
      </nav>

      <main className="min-h-[calc(100vh-5rem)]">
        {view === 'admin' && (
          <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-2xl"><Settings className="w-6 h-6 text-indigo-600" /></div>
                <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Admin Center</h1><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Manage Staff & Matrix</p></div>
              </div>
              <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 active:scale-95">
                {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกโครงสร้าง
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter"><Users className="w-5 h-5 text-indigo-500" /> รายชื่อพนักงาน</h2>
                <div className="flex gap-2 mb-6">
                  {/* Fixed: Input defined directly in main render to keep focus */}
                  <input 
                    type="text" 
                    placeholder="ชื่อพนักงานใหม่..." 
                    className="flex-grow border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm outline-none focus:border-indigo-500 transition shadow-sm font-bold" 
                    value={newStaffName} 
                    onChange={(e) => setNewStaffName(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newStaffName.trim()) {
                        setMasterData(p => ({...p, staff: [...p.staff, {id: 's' + Date.now(), name: newStaffName.trim()}]}));
                        setNewStaffName('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (newStaffName.trim()) {
                        setMasterData(p => ({...p, staff: [...p.staff, {id: 's' + Date.now(), name: newStaffName.trim()}]}));
                        setNewStaffName('');
                      }
                    }} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-md active:scale-95 transition"
                  >เพิ่ม</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                  {(masterData.staff || []).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 transition group shadow-sm">
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{s.name}</span>
                      <button onClick={() => setMasterData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
                <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-center gap-2 uppercase tracking-tighter"><Coffee className="w-5 h-5 text-red-500" /> วันหยุดพิเศษ / นักขัตฤกษ์</h2>
                <div className="grid grid-cols-7 gap-2">
                  {MARCH_DAYS.map(d => (
                    <button key={d.dateStr} onClick={() => setMasterData(p=>({...p, holidays: (p.holidays || []).includes(d.dateStr) ? p.holidays.filter(x=>x!==d.dateStr) : [...(p.holidays || []), d.dateStr]}))} className={`w-full aspect-square rounded-xl text-xs font-black transition-all border-2 flex items-center justify-center ${masterData.holidays?.includes?.(d.dateStr) ? 'bg-red-500 text-white border-red-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}>{d.dayNum}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Matrix Config Restored */}
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-widest px-2"><Clock className="text-indigo-600"/> การตั้งค่า SLOT งานและเวลา</h2>
              {Object.entries(masterData.dayTypes || {}).map(([key, data]) => (
                <div key={key} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                  <div className={`px-8 py-5 font-black text-sm text-white flex justify-between items-center ${key==='weekday' ? 'bg-slate-900' : key==='friday' ? 'bg-sky-700' : 'bg-orange-600'}`}>
                    <span className="uppercase tracking-widest">{data.name}</span>
                    <span className="text-[10px] opacity-60">MASTER MATRIX</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b">
                        <tr><th className="px-8 py-4 w-1/3">JOB STATION</th><th className="px-8 py-4">SLOTS & OT QUOTA</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {DUTY_DEFINITIONS.map(duty => (
                          <tr key={duty.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-8 py-6">
                              <div className="font-black text-slate-800 text-base tracking-tight leading-tight">{duty.jobA}</div>
                              <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter italic">Job B: {duty.jobB}</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-wrap gap-3">
                                {(data.duties?.[duty.id] || []).map((slot, idx) => (
                                  <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm transition-all hover:border-indigo-100">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[8px] font-black text-slate-400 uppercase">เริ่ม</span>
                                      <input type="time" className="border rounded-xl p-1.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" value={slot.startTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].startTime = e.target.value; setMasterData(nd); }} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[8px] font-black text-slate-400 uppercase">เลิก</span>
                                      <input type="time" className="border rounded-xl p-1.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" value={slot.endTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].endTime = e.target.value; setMasterData(nd); }} />
                                    </div>
                                    <div className="flex flex-col gap-1 border-l pl-3 border-slate-100">
                                      <span className="text-[8px] font-black text-indigo-500 uppercase">โควตา OT</span>
                                      <input type="number" step="0.5" className="w-16 border rounded-xl p-1.5 text-center font-black text-indigo-700 bg-indigo-50/30" value={slot.maxOtHours} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setMasterData(nd); }} />
                                    </div>
                                    <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id].splice(idx,1); setMasterData(nd); }} className="mt-4 text-slate-300 hover:text-red-500 transition p-1"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                                ))}
                                <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); if(!nd.dayTypes[key].duties[duty.id]) nd.dayTypes[key].duties[duty.id] = []; nd.dayTypes[key].duties[duty.id].push({startTime:"09:00", endTime:"18:00", otMultiplier:1.5, maxOtHours:4.0}); setMasterData(nd); }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-5 py-3 rounded-2xl text-[10px] font-black text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition self-center">+ เพิ่ม</button>
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
          <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Date Bar with Scroll Buttons for Notebook Users */}
            <div className="flex items-center gap-3 relative">
              <button 
                onClick={() => scrollDates('left')} 
                className="hidden lg:flex flex-shrink-0 w-10 h-10 bg-white border border-slate-200 rounded-full items-center justify-center shadow-md hover:bg-indigo-50 text-indigo-600 z-10 transition-all active:scale-90"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div 
                ref={dateBarRef}
                className="flex gap-3 overflow-x-auto pb-4 pt-2 scrollbar-hide px-2 select-none touch-pan-x snap-x flex-grow"
              >
                {MARCH_DAYS.map(d => {
                  const isSelected = selectedDateStr === d.dateStr;
                  const isHoliday = masterData.holidays?.includes?.(d.dateStr);
                  return (
                    <button 
                      key={d.dateStr} 
                      onClick={() => setSelectedDateStr(d.dateStr)} 
                      className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all border-2 snap-center ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl scale-110 z-20 ring-4 ring-indigo-50' 
                          : isHoliday 
                            ? 'bg-red-500 text-white border-red-600 opacity-90' 
                            : d.type === 'weekend' 
                              ? 'bg-orange-500 text-white border-orange-600 opacity-90' 
                              : d.type === 'friday' 
                                ? 'bg-sky-500 text-white border-sky-600 opacity-90' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-100' : ''}`}>{d.dayLabel}</span>
                      <span className="text-2xl font-black mt-1 leading-none">{d.dayNum}</span>
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => scrollDates('right')} 
                className="hidden lg:flex flex-shrink-0 w-10 h-10 bg-white border border-slate-200 rounded-full items-center justify-center shadow-md hover:bg-indigo-50 text-indigo-600 z-10 transition-all active:scale-90"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight mb-2">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}</h2>
                <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border uppercase tracking-[0.2em] shadow-sm ${activeDay.type === 'weekday' ? 'bg-slate-100 text-slate-600 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{masterData.dayTypes?.[activeDay.type]?.name || 'Weekday'}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setView('print')} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-200 transition shadow-sm border border-slate-200 active:scale-95"><Printer className="w-5 h-5" /> พิมพ์เดือนนี้</button>
                <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 shadow-xl transition active:scale-95">
                  {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  บันทึกตาราง
                </button>
              </div>
            </div>

            {/* Leaves Section */}
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 uppercase tracking-tighter text-indigo-600"><PlaneTakeoff className="w-5 h-5" /> การลางาน / สถิติหยุด</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(schedule[selectedDateStr]?.leaves || []).map((l, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl flex gap-3 items-center border border-slate-100 shadow-sm transition hover:bg-white hover:border-indigo-100">
                    <select 
                      value={l.staffId} 
                      onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'staffId', e.target.value)} 
                      className="flex-[2] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner text-slate-800"
                    >
                      <option value="">-- เลือกชื่อ --</option>
                      {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select 
                      value={l.type} 
                      onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'type', e.target.value)} 
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none shadow-inner text-slate-800"
                    >
                      {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
                    </select>
                    <button onClick={() => updateLeaves(selectedDateStr, 'remove', idx)} className="text-slate-300 hover:text-red-500 transition p-1"><Trash2 className="w-5 h-5"/></button>
                  </div>
                ))}
                <button onClick={() => updateLeaves(selectedDateStr, 'add')} className="border-2 border-dashed border-indigo-100 text-indigo-500 p-4 rounded-2xl font-black text-xs hover:bg-indigo-50 transition uppercase tracking-widest shadow-sm active:scale-95">+ เพิ่มรายการลา</button>
              </div>
            </div>

            {/* Shift Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {DUTY_DEFINITIONS.map(duty => {
                const slots = masterData.dayTypes?.[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                return (
                  <div key={duty.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-xl hover:border-indigo-100 group">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center group-hover:bg-indigo-50 transition-colors">
                      <div><h3 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tighter group-hover:text-indigo-900">{duty.jobA}</h3><p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest italic leading-none">{duty.jobB}</p></div>
                      <div className="bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-700 shadow-sm border border-indigo-200">{assigned.filter(x => !!x?.staffId).length} / {slots.length}</div>
                    </div>
                    <div className="p-6 space-y-5 flex-grow">
                      {slots.map((slot, idx) => {
                        const data = assigned[idx] || { staffId: "", otHours: 0 };
                        const conflict = (data.staffId && (schedule[selectedDateStr]?.leaves || []).some(l => l.staffId === data.staffId));
                        const isOver = (data.otHours || 0) > (slot.maxOtHours || 0);
                        return (
                          <div key={idx} className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-4 ${!data.staffId ? 'border-dashed border-slate-200 bg-white/50' : conflict || isOver ? 'border-red-400 bg-red-50 shadow-inner scale-95' : 'border-indigo-50 bg-white shadow-sm'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-sans"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {slot.startTime}-{slot.endTime}</span>
                              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">Quota: {slot.maxOtHours}H</span>
                            </div>
                            <div className="flex gap-3">
                              <select 
                                value={data.staffId} 
                                onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'staffId', e.target.value)} 
                                className="flex-[3] bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition shadow-sm font-sans text-slate-800"
                              >
                                <option value="">-- ว่าง --</option>
                                {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <div className={`flex-1 flex flex-col justify-center items-center border-2 rounded-2xl bg-white shadow-sm transition-all ${isOver ? 'border-red-300 ring-4 ring-red-100' : 'border-slate-50 focus-within:border-indigo-200'}`}>
                                <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">OT</span>
                                <input type="number" step="0.5" value={data.otHours} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'otHours', e.target.value)} className={`w-full text-center font-black text-lg outline-none bg-transparent ${isOver ? 'text-red-600' : 'text-slate-800'}`} />
                              </div>
                            </div>
                            {conflict && <p className="text-[9px] text-red-600 font-bold flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-red-100 animate-pulse uppercase"><AlertCircle className="w-3.5 h-3.5"/> รายการซ้ำหรือพนักงานลา</p>}
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
          <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 overflow-hidden">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
              <div className="flex items-center gap-5">
                <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-100"><BarChart3 className="w-10 h-10 text-white" /></div>
                <div><h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Manpower Dashboard</h1><p className="text-slate-500 font-bold text-sm uppercase tracking-[0.2em] opacity-60">Analytics • March 2026</p></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sans">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                <TrendingUp className="absolute top-4 right-4 w-20 h-20 text-indigo-50 group-hover:scale-110 transition duration-700" />
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] leading-none mb-4">Gross Overtime</p>
                <h3 className="text-5xl font-black text-indigo-600 tracking-tighter leading-none">{(reportData?.totalOt || 0).toFixed(1)} <span className="text-lg uppercase opacity-30 tracking-widest font-black">Hrs</span></h3>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                <PlaneTakeoff className="absolute top-4 right-4 w-20 h-20 text-orange-50 group-hover:scale-110 transition duration-700" />
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] leading-none mb-4">Total Absences</p>
                <h3 className="text-5xl font-black text-orange-600 tracking-tighter leading-none">{reportData?.totalLeaves || 0} <span className="text-lg uppercase opacity-30 tracking-widest font-black">Days</span></h3>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-center">
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] leading-none mb-6">Staff Performance Scorecard</p>
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-4xl font-black text-slate-800 tracking-tighter">{(reportData?.staffStats || []).filter(s=>s.shifts>0).length} <span className="text-xs uppercase opacity-30">Active</span></h3>
                    <div className="w-full h-2 bg-slate-100 rounded-full mt-2 overflow-hidden shadow-inner"><div className="h-full bg-emerald-500" style={{ width: `${((reportData?.staffStats || []).filter(s=>s.shifts>0).length / (masterData.staff.length || 1)) * 100}%` }}></div></div>
                  </div>
                  <div className="flex-1 flex flex-col border-l border-slate-100 pl-4">
                     <h3 className="text-4xl font-black text-slate-400 tracking-tighter">{masterData.staff.length} <span className="text-xs uppercase opacity-30">Total</span></h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { @page { size: A4 landscape; margin: 10mm; } body { background: white !important; -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } table { width: 100% !important; border-collapse: collapse !important; border: 2px solid #000 !important; } th, td { border: 1px solid #ddd !important; } .bg-slate-900 { background-color: #0f172a !important; color: white !important; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 50px; border: 3px solid #f8fafc; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .touch-pan-x { touch-action: pan-x; }
        .snap-x { scroll-snap-type: x mandatory; }
        .snap-center { scroll-snap-align: center; }
      `}} />
    </div>
  );
}