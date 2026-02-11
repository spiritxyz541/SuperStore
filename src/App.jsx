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
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - V2.9 (NOTEBOOK & INPUT FIX)
 * แก้ไข: 1. ปัญหาพิมพ์ชื่อพนักงานหลุดโฟกัส (Fixed Focus Loss)
 * 2. เพิ่ม Scrollbar และปรับปรุงการเลื่อนวันที่สำหรับ Notebook
 * 3. ปรับ Contrast สีฟอนต์ให้มองเห็นชัดเจน 100%
 */

// --- 1. Firebase Config ---
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
  { id: 'OFF', label: 'หยุดประจำสัปดาห์', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { id: 'CO', label: 'หยุดชดเชย', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'SO', label: 'เปลี่ยนหยุด', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'AL', label: 'หยุดพักร้อน', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'SL', label: 'ลาป่วย', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'PL', label: 'ลากิจ', color: 'bg-orange-100 text-orange-800 border-orange-200' },
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

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error(e); }
    };
    init();
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubMaster = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), (snap) => {
      if (snap.exists()) setMasterData(snap.data());
      else setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), INITIAL_MASTER_DATA);
      setLoading(false);
    });
    const unsubSched = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main'), (snap) => {
      if (snap.exists()) setSchedule(snap.data().records || {});
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
    } catch (e) { setSaveStatus('error'); }
  };

  const scrollDates = (dir) => {
    if (dateBarRef.current) {
      const amt = dir === 'left' ? -350 : 350;
      dateBarRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  const reportData = useMemo(() => {
    const stats = { totalOt: 0, totalLeaves: 0, staffStats: [] };
    const staffMap = {};
    (masterData.staff || []).forEach(s => staffMap[s.id] = { name: s.name, ot: 0, shifts: 0, leaves: 0 });
    Object.keys(schedule).forEach(date => {
      const day = schedule[date];
      if (day.duties) {
        Object.keys(day.duties).forEach(dId => {
          (day.duties[dId] || []).forEach(slot => {
            if (slot.staffId && staffMap[slot.staffId]) {
              staffMap[slot.staffId].ot += (slot.otHours || 0);
              staffMap[slot.staffId].shifts += 1;
              stats.totalOt += (slot.otHours || 0);
            }
          });
        });
      }
      if (day.leaves) {
        day.leaves.forEach(l => { if (l.staffId && staffMap[l.staffId]) { staffMap[l.staffId].leaves += 1; stats.totalLeaves += 1; } });
      }
    });
    stats.staffStats = Object.values(staffMap).sort((a,b) => b.ot - a.ot);
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
      {/* Toast Notification */}
      {saveStatus === 'success' && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
          <div className="bg-slate-900 text-white px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-4 border border-slate-700 ring-8 ring-indigo-500/10">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <span className="font-black text-lg uppercase tracking-tight">บันทึกข้อมูลลง Cloud สำเร็จ!</span>
          </div>
        </div>
      )}

      {/* Navbar - Notebook Optimized */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden h-16 shadow-sm px-6">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg"><LayoutDashboard className="w-5 h-5 text-white" /></div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tighter uppercase leading-none">Staff<span className="text-indigo-600">Sync</span></span>
              <span className="text-[8px] font-black text-green-500 uppercase tracking-widest mt-0.5">● Connected</span>
            </div>
          </div>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {[ 
              { id: 'manager', label: 'MANAGER', icon: Users }, 
              { id: 'admin', label: 'ADMIN', icon: Settings }, 
              { id: 'report', label: 'REPORT', icon: BarChart3 } 
            ].map(v => (
              <button 
                key={v.id} onClick={() => setView(v.id)} 
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black transition-all ${view === v.id ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            ))}
          </div>
          <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-indigo-700 shadow-md active:scale-95 transition">
             {saveStatus === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึก
          </button>
        </div>
      </nav>

      <main className="min-h-[calc(100vh-4rem)]">
        {view === 'admin' ? (
          <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* รายชื่อพนักงาน Section */}
              <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight"><Users className="w-6 h-6 text-indigo-500" /> จัดการรายชื่อพนักงาน</h2>
                <div className="flex gap-3 mb-8">
                  {/* ช่องพิมพ์ชื่อ - ย้ายมาอยู่ใน Component หลักเพื่อกัน Focus Loss */}
                  <input 
                    type="text" 
                    placeholder="พิมพ์ชื่อพนักงานใหม่..." 
                    className="flex-grow border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm" 
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
                    className="bg-slate-900 text-white px-8 rounded-2xl font-black text-xs hover:bg-indigo-600 transition shadow-lg active:scale-95"
                  >เพิ่ม</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {(masterData.staff || []).map(s => (
                    <div key={s.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition group shadow-sm">
                      <span className="text-sm font-bold text-slate-700 uppercase">{s.name}</span>
                      <button onClick={() => setMasterData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* วันหยุด Section */}
              <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tight"><Coffee className="w-6 h-6 text-red-500" /> วันหยุดนักขัตฤกษ์</h2>
                <div className="grid grid-cols-7 gap-2">
                  {MARCH_DAYS.map(d => (
                    <button 
                      key={d.dateStr} 
                      onClick={() => setMasterData(p=>({...p, holidays: (p.holidays || []).includes(d.dateStr) ? p.holidays.filter(x=>x!==d.dateStr) : [...(p.holidays || []), d.dateStr]}))} 
                      className={`w-full aspect-square rounded-2xl text-[11px] font-black transition-all border-2 flex items-center justify-center ${masterData.holidays?.includes?.(d.dateStr) ? 'bg-red-500 text-white border-red-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
                    >
                      {d.dayNum}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Matrix Setting */}
            <div className="space-y-6">
               <h2 className="text-xl font-black text-slate-800 px-2 uppercase tracking-widest flex items-center gap-3"><Clock className="text-indigo-600" /> การตั้งค่ากะงานและเวลา</h2>
               {Object.entries(masterData.dayTypes || {}).map(([key, data]) => (
                <div key={key} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                  <div className={`px-8 py-5 font-black text-sm text-white flex justify-between items-center ${key==='weekday' ? 'bg-slate-900' : key==='friday' ? 'bg-sky-700' : 'bg-orange-600'}`}>
                    <span className="uppercase tracking-widest">{data.name}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b">
                        <tr><th className="px-8 py-5">ตำแหน่งงาน (STATION)</th><th className="px-8 py-5">ช่วงเวลาเข้างาน และโควตา OT</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {DUTY_DEFINITIONS.map(duty => (
                          <tr key={duty.id} className="hover:bg-slate-50 transition">
                            <td className="px-8 py-6 w-1/3">
                              <div className="font-black text-slate-900 text-base leading-tight mb-1">{duty.jobA}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase italic">{duty.jobB}</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-wrap gap-4">
                                {(data.duties?.[duty.id] || []).map((slot, idx) => (
                                  <div key={idx} className="flex items-center gap-4 bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">เข้า</span>
                                      <input type="time" className="border rounded-xl p-2 text-xs font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" value={slot.startTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].startTime = e.target.value; setMasterData(nd); }} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">เลิก</span>
                                      <input type="time" className="border rounded-xl p-2 text-xs font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" value={slot.endTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].endTime = e.target.value; setMasterData(nd); }} />
                                    </div>
                                    <div className="flex flex-col gap-1 border-l pl-4 border-slate-100">
                                      <span className="text-[9px] font-black text-indigo-500 uppercase">QUOTA OT</span>
                                      <input type="number" step="0.5" className="w-16 border rounded-xl p-2 text-center font-black text-indigo-700 bg-indigo-50/50" value={slot.maxOtHours} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setMasterData(nd); }} />
                                    </div>
                                    <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id].splice(idx,1); setMasterData(nd); }} className="text-slate-300 hover:text-red-500 transition mt-4"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                                ))}
                                <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); if(!nd.dayTypes[key].duties[duty.id]) nd.dayTypes[key].duties[duty.id] = []; nd.dayTypes[key].duties[duty.id].push({startTime:"09:00", endTime:"18:00", otMultiplier:1.5, maxOtHours:4.0}); setMasterData(nd); }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-6 py-4 rounded-2xl text-[10px] font-black text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition self-center">+ เพิ่ม Slot</button>
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
        ) : view === 'manager' ? (
          <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* Date Selection Area - Notebook Optimized with Visible Scrollbar */}
            <div className="relative flex items-center gap-3">
              <button onClick={() => scrollDates('left')} className="hidden lg:flex flex-shrink-0 w-12 h-12 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg hover:bg-indigo-50 text-indigo-600 transition-all active:scale-90 z-10"><ChevronLeft className="w-7 h-7" /></button>
              
              <div 
                ref={dateBarRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-2 custom-scrollbar px-2 select-none touch-pan-x snap-x flex-grow"
              >
                {MARCH_DAYS.map(d => {
                  const isSelected = selectedDateStr === d.dateStr;
                  const isHoliday = masterData.holidays?.includes?.(d.dateStr);
                  return (
                    <button 
                      key={d.dateStr} 
                      onClick={() => setSelectedDateStr(d.dateStr)} 
                      className={`flex-shrink-0 w-20 h-24 rounded-[1.8rem] flex flex-col items-center justify-center transition-all border-2 snap-center ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xl scale-105 z-20 ring-4 ring-indigo-50' 
                          : isHoliday 
                            ? 'bg-red-500 text-white border-red-600 opacity-90' 
                            : d.type === 'weekend' 
                              ? 'bg-orange-500 text-white border-orange-600 opacity-90' 
                              : d.type === 'friday' 
                                ? 'bg-sky-500 text-white border-sky-600 opacity-90' 
                                : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400 hover:scale-105 shadow-sm'
                      }`}
                    >
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-100 opacity-80' : 'opacity-40'}`}>{d.dayLabel}</span>
                      <span className="text-3xl font-black mt-1 leading-none">{d.dayNum}</span>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => scrollDates('right')} className="hidden lg:flex flex-shrink-0 w-12 h-12 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg hover:bg-indigo-50 text-indigo-600 transition-all active:scale-90 z-10"><ChevronRight className="w-7 h-7" /></button>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-full bg-indigo-600"></div>
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-none mb-4">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}</h2>
                <span className={`text-xs font-black px-6 py-2 rounded-full border uppercase tracking-widest shadow-sm ${activeDay.type === 'weekday' ? 'bg-slate-100 text-slate-700 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                  {masterData.dayTypes?.[activeDay.type]?.name || 'Weekday Settings'}
                </span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setView('print')} className="bg-slate-50 text-slate-900 px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-white border border-slate-200 transition-all shadow-sm active:scale-95"><Printer className="w-5 h-5 text-indigo-600" /> พิมพ์รายงานประจำวัน</button>
              </div>
            </div>

            {/* Leave Section */}
            <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-10 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-4 mb-8 uppercase tracking-tighter text-indigo-600"><PlaneTakeoff className="w-7 h-7" /> รายการลางาน / พนักงานที่หยุด</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(schedule[selectedDateStr]?.leaves || []).map((l, idx) => (
                  <div key={idx} className="bg-slate-50 p-5 rounded-[1.8rem] flex gap-4 items-center border border-slate-100 group shadow-sm transition-all hover:bg-white hover:border-indigo-100 hover:shadow-md">
                    <select value={l.staffId} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'staffId', e.target.value)} className="flex-[2.5] bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-100 text-slate-900 shadow-inner">
                      <option value="">-- เลือกพนักงาน --</option>
                      {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={l.type} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'type', e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-2xl px-3 py-3 text-xs font-black outline-none shadow-inner text-indigo-600">
                      {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
                    </select>
                    <button onClick={() => updateLeaves(selectedDateStr, 'remove', idx)} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-5 h-5"/></button>
                  </div>
                ))}
                <button onClick={() => updateLeaves(selectedDateStr, 'add')} className="border-3 border-dashed border-indigo-100 text-indigo-500 p-6 rounded-[1.8rem] font-black text-sm hover:bg-indigo-50 transition-all uppercase tracking-widest shadow-sm active:scale-95 group"><span className="flex items-center justify-center gap-3"> <Plus className="w-5 h-5" /> เพิ่มรายการลา </span></button>
              </div>
            </div>

            {/* Assignment Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {DUTY_DEFINITIONS.map(duty => {
                const slots = masterData.dayTypes?.[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                return (
                  <div key={duty.id} className="bg-white rounded-[2.8rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-2xl hover:border-indigo-200 group/card">
                    <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center group-hover/card:bg-indigo-50/50 transition-colors">
                      <div><h3 className="font-black text-slate-900 text-xl leading-tight uppercase tracking-tighter group-hover/card:text-indigo-900">{duty.jobA}</h3><p className="text-[11px] text-slate-400 font-bold mt-1 uppercase italic leading-none">{duty.jobB}</p></div>
                      <div className="bg-white border border-slate-100 px-4 py-2 rounded-2xl text-[11px] font-black text-indigo-700 shadow-sm">{assigned.filter(x => !!x?.staffId).length} / {slots.length}</div>
                    </div>
                    <div className="p-8 space-y-6">
                      {slots.map((slot, idx) => {
                        const data = assigned[idx] || { staffId: "", otHours: 0 };
                        const conflict = (data.staffId && (schedule[selectedDateStr]?.leaves || []).some(l => l.staffId === data.staffId));
                        const isOver = (data.otHours || 0) > (slot.maxOtHours || 0);
                        return (
                          <div key={idx} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-5 ${!data.staffId ? 'border-dashed border-slate-100 bg-slate-50/20' : conflict || isOver ? 'border-red-400 bg-red-50 shadow-inner' : 'border-indigo-50 bg-white shadow-md'}`}>
                            <div className="flex justify-between items-center px-1">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-sans"><Clock className="w-4 h-4 text-indigo-400" /> {slot.startTime} - {slot.endTime}</span>
                              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase">Quota: {slot.maxOtHours}H</span>
                            </div>
                            <div className="flex gap-4">
                              <select value={data.staffId} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'staffId', e.target.value)} className="flex-[3] bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-100 transition shadow-sm text-slate-900">
                                <option value="">-- เลือกพนักงาน --</option>
                                {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <div className={`flex-1 flex flex-col justify-center items-center border-2 rounded-2xl bg-white shadow-sm transition-all ${isOver ? 'border-red-300 ring-4 ring-red-100' : 'border-slate-50 focus-within:border-indigo-200'}`}>
                                <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">OT HR</span>
                                <input type="number" step="0.5" value={data.otHours} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'otHours', e.target.value)} className={`w-full text-center font-black text-xl outline-none bg-transparent ${isOver ? 'text-red-600' : 'text-slate-900'}`} />
                              </div>
                            </div>
                            {conflict && <p className="text-[10px] text-red-600 font-bold flex items-center gap-2 bg-white/50 p-2 rounded-xl border border-red-100 animate-pulse uppercase"><AlertCircle className="w-4 h-4"/> ตารางซ้ำหรือลางาน</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                  <TrendingUp className="absolute top-4 right-4 w-24 h-24 text-indigo-50 group-hover:scale-110 transition duration-700" />
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] leading-none mb-6">Gross OT Hours</p>
                  <h3 className="text-6xl font-black text-indigo-600 tracking-tighter leading-none">{(reportData?.totalOt || 0).toFixed(1)}</h3>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                  <PlaneTakeoff className="absolute top-4 right-4 w-24 h-24 text-orange-50 group-hover:scale-110 transition duration-700" />
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] leading-none mb-6">Staff Absences</p>
                  <h3 className="text-6xl font-black text-orange-600 tracking-tighter leading-none">{reportData?.totalLeaves || 0}</h3>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-center">
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] leading-none mb-8">Active Staff Count</p>
                  <div className="flex gap-6 items-end">
                    <h3 className="text-7xl font-black text-slate-900 tracking-tighter">{(reportData?.staffStats || []).filter(s=>s.shifts>0).length}</h3>
                    <div className="flex-grow pb-2">
                       <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">From total of {masterData.staff.length} staff members</p>
                       <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${((reportData?.staffStats || []).filter(s=>s.shifts>0).length / (masterData.staff.length || 1)) * 100}%` }}></div></div>
                    </div>
                  </div>
                </div>
             </div>

             <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-50 font-black text-slate-900 flex justify-between items-center bg-slate-50/50 uppercase tracking-tight text-xl"><div className="flex items-center gap-4"><Award className="w-8 h-8 text-yellow-500" /> Employee Performance Index</div></div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b">
                      <tr><th className="px-10 py-6 text-left">พนักงาน</th><th className="px-10 py-6 text-center">เข้างาน (กะ)</th><th className="px-10 py-6 text-center">ลาสะสม</th><th className="px-10 py-6 text-center bg-indigo-50/50 text-indigo-700">OT สะสม (ชม.)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {(reportData?.staffStats || []).map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition duration-300">
                          <td className="px-10 py-6 font-black text-slate-900 uppercase text-base">{s.name}</td>
                          <td className="px-10 py-6 text-center text-lg">{s.shifts}</td>
                          <td className="px-10 py-6 text-center"><span className="px-5 py-2 bg-orange-50 text-orange-600 rounded-full text-xs font-black border border-orange-100 shadow-sm">{s.leaves}</span></td>
                          <td className="px-10 py-6 text-center font-black text-indigo-800 bg-indigo-50/20 text-2xl tracking-tighter">{(s.ot || 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Visible Scrollbar for Notebook Users */
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        /* Hide default scrollbar but keep functionality */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          nav, button { display: none !important; }
        }
        
        .touch-pan-x { touch-action: pan-x; }
        .snap-x { scroll-snap-type: x mandatory; }
        .snap-center { scroll-snap-align: center; }
      `}} />
    </div>
  );
}