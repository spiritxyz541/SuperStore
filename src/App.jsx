import React, { useState, useEffect, useMemo } from 'react';
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
  Coffee,
  UserPlus,
  Briefcase,
  BarChart3,
  TrendingUp,
  Award,
  ArrowUpRight,
  PlaneTakeoff,
  Loader2,
  FileText
} from 'lucide-react';

/**
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - FIREBASE EDITION V2.6 (STABLE & AUTO-FIX)
 * แก้ไข: เพิ่มระบบ Bypass Loading (Timeout 5s) และแสดง Error รายละเอียดการเชื่อมต่อ
 */

// --- 1. Firebase Configuration ---
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
  const [authError, setAuthError] = useState(null);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [selectedDateStr, setSelectedDateStr] = useState('2026-03-01');
  const [schedule, setSchedule] = useState({}); 
  const [newStaffName, setNewStaffName] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  // --- Authentication (Rule 3) ---
  useEffect(() => {
    // Safety Timeout: หากโหลดค้างเกิน 5 วินาที ให้ปิด Loading และเข้าใช้งานแบบ Offline mode
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn("Connection timeout: Switching to limited mode.");
        setLoading(false);
      }
    }, 5000);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { 
        console.error("Auth Error:", error);
        setAuthError(error.message); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // หากไม่มี User ให้รันข้อมูลเริ่มต้นไปก่อนเพื่อให้หน้าจอไม่ค้าง
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  // --- Real-time Data Sync (Rule 1) ---
  useEffect(() => {
    if (!user) return;
    
    const masterDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master');
    const unsubMaster = onSnapshot(masterDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setMasterData(docSnap.data());
      } else {
        setDoc(masterDocRef, INITIAL_MASTER_DATA).catch(e => console.error("Initial doc set failed:", e));
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Master Error:", err);
      setLoading(false); // ปิด Loading เมื่อเกิด Error เพื่อให้ User เข้าหน้าจัดการได้
    });

    const scheduleDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main');
    const unsubSched = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) setSchedule(docSnap.data().records || {});
    }, (err) => {
      console.error("Firestore Schedule Error:", err);
    });

    return () => { unsubMaster(); unsubSched(); };
  }, [user]);

  const MARCH_DAYS = useMemo(() => getMarch2026Days(masterData.holidays || []), [masterData.holidays]);
  const activeDay = useMemo(() => MARCH_DAYS.find(d => d.dateStr === selectedDateStr) || MARCH_DAYS[0], [selectedDateStr, MARCH_DAYS]);

  const handleGlobalSave = async () => {
    if (!user) {
      alert("ไม่สามารถบันทึกได้เนื่องจากไม่ได้เชื่อมต่อ Cloud (กรุณาลองรีเฟรชหน้าจอ)");
      return;
    }
    try {
      setSaveStatus('saving');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), masterData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', 'main'), { records: schedule });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) { 
      setSaveStatus('error');
      alert("บันทึกล้มเหลว: " + err.message);
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
      {authError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl max-w-xs text-center">
          <p className="text-[10px] text-red-500 font-bold uppercase mb-1">แจ้งเตือนข้อผิดพลาด</p>
          <p className="text-xs text-red-700 font-black">{authError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-[10px] bg-red-600 text-white px-4 py-1 rounded-full font-bold">ลองใหม่</button>
        </div>
      )}
    </div>
  );

  const AdminPanel = () => (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 p-3 rounded-2xl"><Settings className="w-6 h-6 text-indigo-600" /></div>
          <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Admin Center</h1><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Master Configuration</p></div>
        </div>
        <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition flex items-center gap-2">
          {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกโครงสร้างทั้งหมด
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter"><Users className="w-5 h-5 text-indigo-500" /> รายชื่อพนักงาน</h2>
          <div className="flex gap-2 mb-6">
            <input type="text" placeholder="ชื่อพนักงานใหม่..." className="flex-grow border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm outline-none focus:border-indigo-500 transition shadow-sm" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (()=>{ if(!newStaffName.trim()) return; setMasterData(p=>({...p, staff:[...p.staff, {id:'s'+Date.now(), name:newStaffName.trim()}]})); setNewStaffName(''); })()} />
            <button onClick={() => { if(!newStaffName.trim()) return; setMasterData(p=>({...p, staff:[...p.staff, {id:'s'+Date.now(), name:newStaffName.trim()}]})); setNewStaffName(''); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black transition active:scale-95 shadow-md">เพิ่ม</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
            {(masterData.staff || []).map(s => (
              <div key={s.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition group shadow-sm">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">{s.name}</span>
                <button onClick={() => setMasterData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter"><Coffee className="w-5 h-5 text-red-500" /> วันหยุดพิเศษ</h2>
          <div className="grid grid-cols-7 gap-2">
            {MARCH_DAYS.map(d => (
              <button key={d.dateStr} onClick={() => setMasterData(p=>({...p, holidays: (p.holidays || []).includes(d.dateStr) ? p.holidays.filter(x=>x!==d.dateStr) : [...(p.holidays || []), d.dateStr]}))} className={`w-full aspect-square rounded-2xl text-xs font-black transition-all border-2 flex items-center justify-center ${masterData.holidays?.includes?.(d.dateStr) ? 'bg-red-500 text-white border-red-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}>{d.dayNum}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-widest px-2"><Clock className="text-indigo-600"/> ตั้งค่า Slot งานและเวลา (Job Matrix)</h2>
        {Object.entries(masterData.dayTypes || {}).map(([key, data]) => (
          <div key={key} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className={`px-8 py-5 font-black text-sm text-white flex justify-between items-center ${key==='weekday' ? 'bg-slate-900' : key==='friday' ? 'bg-sky-700' : 'bg-orange-600'}`}>
              <span className="uppercase tracking-widest">{data.name}</span>
              <span className="text-[10px] opacity-60">MASTER SCHEDULE CONFIG</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b">
                  <tr><th className="px-8 py-4 w-1/3">หน้าที่ / STATION</th><th className="px-8 py-4">Slot และโควตา OT สะสม</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DUTY_DEFINITIONS.map(duty => (
                    <tr key={duty.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-8 py-6">
                        <div className="font-black text-slate-800 text-base tracking-tight">{duty.jobA}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter italic">Job B: {duty.jobB}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-3">
                          {(data.duties?.[duty.id] || []).map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm transition-all hover:border-indigo-100">
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Start</span>
                                <input type="time" className="border rounded-xl p-1.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" value={slot.startTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].startTime = e.target.value; setMasterData(nd); }} />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] font-black text-slate-400 uppercase">End</span>
                                <input type="time" className="border rounded-xl p-1.5 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none" value={slot.endTime} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].endTime = e.target.value; setMasterData(nd); }} />
                              </div>
                              <div className="flex flex-col gap-1 border-l pl-3 border-slate-100">
                                <span className="text-[8px] font-black text-indigo-500 uppercase">Max OT (Hr)</span>
                                <input type="number" step="0.5" className="w-16 border rounded-xl p-1.5 text-center font-black text-indigo-700 bg-indigo-50/30" value={slot.maxOtHours} onChange={(e) => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setMasterData(nd); }} />
                              </div>
                              <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); nd.dayTypes[key].duties[duty.id].splice(idx,1); setMasterData(nd); }} className="mt-4 text-slate-300 hover:text-red-500 transition p-1"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          ))}
                          <button onClick={() => { const nd = JSON.parse(JSON.stringify(masterData)); if(!nd.dayTypes[key].duties[duty.id]) nd.dayTypes[key].duties[duty.id] = []; nd.dayTypes[key].duties[duty.id].push({startTime:"09:00", endTime:"18:00", otMultiplier:1.5, maxOtHours:4.0}); setMasterData(nd); }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-5 py-3 rounded-2xl text-[10px] font-black text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition self-center">+ เพิ่ม SLOT ใหม่</button>
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
  );

  const ManagerPanel = () => (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-1">
        {MARCH_DAYS.map(d => (
          <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${selectedDateStr === d.dateStr ? 'ring-4 ring-indigo-50 scale-105 shadow-xl z-10' : 'opacity-90'} ${masterData.holidays?.includes?.(d.dateStr) ? 'bg-red-500 text-white border-red-600' : d.type === 'weekend' ? 'bg-orange-50 text-white border-orange-600' : d.type === 'friday' ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}>
            <span className="text-[10px] font-black uppercase tracking-widest">{d.dayLabel}</span><span className="text-2xl font-black mt-1">{d.dayNum}</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-3">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}</h2>
          <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border uppercase tracking-[0.2em] shadow-sm ${activeDay.type === 'weekday' ? 'bg-slate-100 text-slate-600 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{masterData.dayTypes?.[activeDay.type]?.name || 'Weekday'}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView('print')} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-200 transition shadow-sm border border-slate-200"><Printer className="w-5 h-5" /> พิมพ์เดือนนี้</button>
          <button onClick={handleGlobalSave} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-700 shadow-xl transition active:scale-95">
             {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
             บันทึกตาราง
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 shadow-sm">
        <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 uppercase tracking-tighter text-indigo-600"><PlaneTakeoff className="w-5 h-5" /> พนักงานที่หยุด / ลางาน</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(schedule[selectedDateStr]?.leaves || []).map((l, idx) => (
            <div key={idx} className="bg-slate-50 p-4 rounded-2xl flex gap-3 items-center border border-slate-100 shadow-sm transition hover:bg-white hover:border-indigo-100">
              <select value={l.staffId} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'staffId', e.target.value)} className="flex-[2] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-sans">
                <option value="">-- เลือกชื่อ --</option>
                {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={l.type} onChange={(e) => updateLeaves(selectedDateStr, 'update', idx, 'type', e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none shadow-inner font-sans">
                {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
              </select>
              <button onClick={() => updateLeaves(selectedDateStr, 'remove', idx)} className="text-slate-300 hover:text-red-500 transition"><Trash2 className="w-5 h-5"/></button>
            </div>
          ))}
          <button onClick={() => updateLeaves(selectedDateStr, 'add')} className="border-2 border-dashed border-indigo-100 text-indigo-500 p-4 rounded-2xl font-black text-xs hover:bg-indigo-50 transition uppercase tracking-widest shadow-sm">+ เพิ่มรายการลางาน</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {DUTY_DEFINITIONS.map(duty => {
          const slots = masterData.dayTypes?.[activeDay.type]?.duties?.[duty.id] || [];
          const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
          return (
            <div key={duty.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-xl hover:border-indigo-100 group">
              <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center group-hover:bg-indigo-50 transition-colors">
                <div><h3 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tighter group-hover:text-indigo-900">{duty.jobA}</h3><p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest italic tracking-tighter">{duty.jobB}</p></div>
                <div className="bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-700 shadow-sm">{assigned.filter(x => !!x?.staffId).length} / {slots.length}</div>
              </div>
              <div className="p-6 space-y-5 flex-grow">
                {slots.map((slot, idx) => {
                  const data = assigned[idx] || { staffId: "", otHours: 0 };
                  const conflict = isConflict(selectedDateStr, data.staffId, duty.id, idx);
                  const isOver = (data.otHours || 0) > (slot.maxOtHours || 0);
                  return (
                    <div key={idx} className={`p-5 rounded-2xl border-2 transition-all flex flex-col gap-4 ${!data.staffId ? 'border-dashed border-slate-100 bg-slate-50/20' : conflict || isOver ? 'border-red-400 bg-red-50 shadow-inner scale-95' : 'border-indigo-50 bg-white shadow-sm'}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-sans"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {slot.startTime}-{slot.endTime}</span>
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">Quota: {slot.maxOtHours}H</span>
                      </div>
                      <div className="flex gap-3">
                        <select value={data.staffId} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'staffId', e.target.value)} className="flex-[3] bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition shadow-sm font-sans">
                          <option value="">-- พนักงาน --</option>
                          {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <div className={`flex-1 flex flex-col justify-center items-center border-2 rounded-2xl bg-white shadow-sm transition-all ${isOver ? 'border-red-300 ring-4 ring-red-100' : 'border-slate-50 focus-within:border-indigo-200'}`}>
                          <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">OT</span>
                          <input type="number" step="0.5" value={data.otHours} onChange={(e) => updateSchedule(selectedDateStr, duty.id, idx, 'otHours', e.target.value)} className={`w-full text-center font-black text-lg outline-none bg-transparent ${isOver ? 'text-red-600' : 'text-slate-800'}`} />
                        </div>
                      </div>
                      {conflict && <p className="text-[9px] text-red-600 font-bold flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-red-100 animate-pulse uppercase"><AlertCircle className="w-3.5 h-3.5"/> Conflict detected</p>}
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

  const ReportDashboard = () => (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-sans">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 font-black text-slate-800 flex justify-between items-center bg-slate-50/40 uppercase tracking-tighter"><div className="flex items-center gap-3 font-sans"><Award className="w-6 h-6 text-yellow-500" /> Top Performer Leaderboard</div></div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm">
              <thead className="bg-white text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                <tr><th className="px-8 py-5 text-left">พนักงาน</th><th className="px-8 py-5 text-center">เข้างาน (กะ)</th><th className="px-8 py-5 text-center">ลาสะสม</th><th className="px-8 py-5 text-center bg-indigo-50/30 text-indigo-600">OT รวม (ชม.)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                {(reportData?.staffStats || []).map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition duration-300">
                    <td className="px-8 py-5 font-black text-slate-900 uppercase leading-none">{s.name}</td>
                    <td className="px-8 py-5 text-center">{s.shifts}</td>
                    <td className="px-8 py-5 text-center"><span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black border border-orange-100">{s.leaves}</span></td>
                    <td className="px-8 py-5 text-center font-black text-indigo-700 bg-indigo-50/20 text-lg tracking-tighter">{(s.ot || 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col hover:shadow-xl transition-all duration-500">
          <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tighter border-b border-slate-100 pb-5"><TrendingUp className="w-6 h-6 text-indigo-500" /> Workload Mix</h3>
          <div className="space-y-8 flex-grow">
            {(reportData?.dutyStats || []).map((d, idx) => {
              const perc = (reportData?.totalOt || 0) > 0 ? (d.ot / reportData.totalOt) * 100 : 0;
              const colors = ['bg-indigo-500', 'bg-sky-500', 'bg-orange-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
              return (
                <div key={idx} className="space-y-3 group/item">
                  <div className="flex justify-between text-[10px] font-black uppercase leading-none tracking-tight"><span className="text-slate-600 truncate w-40 font-sans">{d.name}</span><span className="text-indigo-600 font-black text-xs font-sans">{(d.ot || 0).toFixed(1)} HR</span></div>
                  <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 shadow-inner"><div className={`h-full transition-all duration-1000 rounded-full ${colors[idx % colors.length]}`} style={{ width: `${perc}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const PrintView = () => {
    const getStaffDayInfo = (staffId, dateStr) => {
      const dayData = schedule[dateStr];
      if (!dayData) return null;
      const leave = (dayData.leaves || []).find(l => l.staffId === staffId);
      if (leave) return { type: 'leave', info: LEAVE_TYPES.find(x => x.id === leave.type) };
      for (const dId of DUTY_DEFINITIONS.map(d=>d.id)) {
        const sIdx = (dayData.duties?.[dId] || []).findIndex(s => s.staffId === staffId);
        if (sIdx !== -1 && sIdx !== undefined) {
          const dayConfig = MARCH_DAYS.find(d => d.dateStr === dateStr);
          const type = dayConfig ? dayConfig.type : 'weekday';
          const duty = DUTY_DEFINITIONS.find(d => d.id === dId);
          const slots = masterData.dayTypes[type]?.duties?.[dId] || [];
          const slot = slots[sIdx] || {startTime: '00:00'};
          const actual = dayData.duties[dId][sIdx];
          return { type: 'work', duty, slot, actual };
        }
      }
      return null;
    };

    return (
      <div className="p-8 bg-white min-h-screen font-sans">
        <div className="max-w-full mx-auto">
          <div className="flex justify-between items-center mb-12 print:hidden border-b pb-6">
            <button onClick={() => setView('manager')} className="flex items-center gap-3 text-slate-600 font-black bg-slate-100 px-6 py-3 rounded-2xl hover:bg-slate-200 transition shadow-sm uppercase text-xs tracking-widest"><ChevronLeft className="w-5 h-5" /> Back to Dashboard</button>
            <button onClick={() => window.print()} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition active:scale-95 uppercase text-xs tracking-widest flex items-center gap-3 font-sans"><Printer className="w-5 h-5" /> Export PDF (A4 Landscape)</button>
          </div>

          <div className="text-center mb-12 uppercase">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter font-sans">Manpower Production: March 2026</h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.5em] italic mt-4 font-sans">Cloud Managed System V2.5</p>
          </div>

          <div className="overflow-x-auto border-4 border-slate-900 rounded-2xl shadow-2xl">
            <table className="w-full border-collapse text-[7px] table-fixed">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border-r border-slate-700 p-3 text-left sticky left-0 bg-slate-900 z-10 w-40 font-black uppercase border-b-2 border-slate-600">Employee Name</th>
                  {MARCH_DAYS.map(day => (
                    <th key={day.dateStr} className={`border-r border-slate-700 p-2 min-w-[35px] text-center border-b-2 border-slate-600 ${day.type === 'weekend' || (masterData.holidays || []).includes(day.dateStr) ? 'bg-slate-800 text-indigo-300' : ''}`}>
                      <div className="font-black text-[12px] mb-1">{day.dayNum}</div><div className="text-[7px] opacity-70 uppercase tracking-tighter">{day.dayLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(masterData.staff || []).map(s => (
                  <tr key={s.id} className="hover:bg-indigo-50/50 h-16 transition-colors border-b border-slate-100 font-sans">
                    <td className="border-r-4 border-slate-900 p-3 font-black sticky left-0 bg-white z-10 text-[10px] uppercase leading-none truncate">{s.name}</td>
                    {MARCH_DAYS.map(day => {
                      const info = getStaffDayInfo(s.id, day.dateStr);
                      return (
                        <td key={day.dateStr} className={`border-r border-slate-100 p-1 text-center group ${!info ? 'bg-slate-50/30' : ''}`}>
                          {info?.type === 'work' ? (
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className="font-black text-indigo-700 text-[10px]">{info.slot.startTime}</span>
                              <div className="text-[6px] font-black text-slate-400 truncate w-full px-1 uppercase tracking-tighter mt-0.5 opacity-60">{info.duty.jobA.substring(0, 8)}</div>
                              {info.actual.otHours > 0 && <span className="bg-orange-500 text-white px-1 rounded-[3px] font-black text-[7px] mt-1 shadow-sm font-sans">OT:{info.actual.otHours}</span>}
                            </div>
                          ) : info?.type === 'leave' ? (
                            <div className={`w-full h-full flex items-center justify-center font-black ${info.info.color} rounded-lg border-2 border-white shadow-inner`}><span className="text-[7px] text-center leading-none uppercase p-1">{info.info.label.substring(0, 3)}</span></div>
                          ) : <span className="text-[6px] font-black opacity-5 uppercase tracking-widest font-sans">EMPTY</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-20 flex justify-between text-center px-16">
            <div className="w-80 border-t-4 border-slate-900 pt-6 font-sans"><p className="text-sm font-black uppercase text-slate-900 tracking-[0.4em]">Store Manager</p><div className="h-20"></div><p className="text-[11px] text-slate-400 font-bold uppercase underline underline-offset-8 decoration-dotted">Date: ____/____/____</p></div>
            <div className="w-80 border-t-4 border-slate-900 pt-6 font-sans"><p className="text-sm font-black uppercase text-slate-900 tracking-[0.4em]">Director</p><div className="h-20"></div><p className="text-[11px] text-slate-400 font-bold uppercase underline underline-offset-8 decoration-dotted">Date: ____/____/____</p></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {saveStatus === 'success' && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-500">
          <div className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-slate-700 ring-8 ring-indigo-500/10 font-sans">
            <div className="bg-green-500 p-2 rounded-full shadow-lg"><CheckCircle className="w-6 h-6 text-white" /></div>
            <span className="font-black text-lg uppercase tracking-tight">Cloud Database Synced!</span>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 print:hidden h-24 shadow-sm px-8">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-slate-900 p-3 rounded-[1.25rem] shadow-2xl transition-all group-hover:rotate-12 duration-500"><LayoutDashboard className="w-7 h-7 text-white" /></div>
            <div className="flex flex-col font-sans">
              <span className="font-black text-3xl tracking-tighter uppercase leading-none group-hover:text-indigo-600 transition-colors">Staff<span className="text-indigo-600">Sync</span></span>
              <div className="flex items-center gap-2 mt-1.5"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Connected to Production Node</span></div>
            </div>
          </div>
          <div className="flex gap-3 bg-slate-100 p-2 rounded-[1.8rem] shadow-inner border border-slate-200 font-sans">
            {[ 
              { id: 'manager', label: 'MANAGER', icon: Users }, 
              { id: 'admin', label: 'ADMIN', icon: Settings }, 
              { id: 'report', label: 'REPORT', icon: BarChart3 } 
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} className={`flex items-center gap-2.5 px-8 py-3.5 rounded-[1.4rem] text-xs font-black transition-all duration-300 ${view === v.id ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-50 translate-y-[-2px]' : 'text-slate-500 hover:text-slate-800'}`}><v.icon className="w-4 h-4" /> {v.label}</button>
            ))}
          </div>
        </div>
      </nav>

      <main className="min-h-[calc(100vh-6rem)]">
        {view === 'admin' ? <AdminPanel /> : view === 'manager' ? <ManagerPanel /> : view === 'report' ? <ReportDashboard /> : <PrintView />}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { @page { size: A4 landscape; margin: 10mm; } body { background: white !important; -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } table { width: 100% !important; border-collapse: collapse !important; border: 2px solid #000 !important; } th, td { border: 1px solid #ddd !important; } .bg-slate-900 { background-color: #0f172a !important; color: white !important; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 50px; border: 3px solid #f8fafc; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
}