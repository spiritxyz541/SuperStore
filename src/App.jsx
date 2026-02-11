import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Settings, Users, Calendar, CheckCircle, AlertCircle, Clock, Save, Plus, Trash2, 
  LayoutDashboard, Printer, ChevronLeft, Coffee, BarChart3, TrendingUp, Award, 
  ArrowUpRight, PlaneTakeoff, Loader2, FileText
} from 'lucide-react';

/**
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - V3.1 ULTIMATE
 * เวอร์ชันที่สวยที่สุดและฟีเจอร์ครบถ้วนที่สุด (Real-time Cloud Sync)
 */

// --- 1. Firebase Configuration (ห้ามแก้ไข) ---
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
const appId = "superstore-v1-production"; 

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
  { id: 'AL', label: 'หยุดพักร้อน', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  { id: 'SL', label: 'ลาป่วย', color: 'bg-red-100 text-red-600 border-red-200' },
  { id: 'PL', label: 'ลากิจ', color: 'bg-orange-100 text-orange-600 border-orange-200' },
];

const INITIAL_MASTER_DATA = {
  dayTypes: { weekday: { name: "วันธรรมดา", duties: {} }, friday: { name: "วันศุกร์", duties: {} }, weekend: { name: "วันหยุด", duties: {} } },
  staff: [{ id: 's1', name: 'พนักงานทดสอบ' }],
  holidays: [] 
};

DUTY_DEFINITIONS.forEach(duty => {
  ['weekday', 'friday', 'weekend'].forEach(dt => {
    INITIAL_MASTER_DATA.dayTypes[dt].duties[duty.id] = [{ startTime: "09:00", endTime: "18:00", maxOtHours: 4.0 }];
  });
});

export default function App() {
  const [view, setView] = useState('manager'); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [selectedDateStr, setSelectedDateStr] = useState('2026-03-01');
  const [schedule, setSchedule] = useState({}); 
  const [newStaffName, setNewStaffName] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  // 1. Auth & Data Sync
  useEffect(() => {
    const init = async () => {
      try { await signInAnonymously(auth); } catch (e) { setUser({ uid: 'offline' }); }
    };
    init();
    onAuthStateChanged(auth, (u) => { if(u) setUser(u); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubMaster = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), (snap) => {
      if (snap.exists()) setMasterData(snap.data());
      else setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), INITIAL_MASTER_DATA);
      setLoading(false);
    });
    const unsubSched = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'records', 'main'), (snap) => {
      if (snap.exists()) setSchedule(snap.data().records || {});
    });
    return () => { unsubMaster(); unsubSched(); };
  }, [user]);

  // 2. Logic & Calculations
  const MARCH_DAYS = useMemo(() => {
    const days = [];
    const date = new Date(2026, 2, 1);
    while (date.getMonth() === 2) {
      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ dateStr: ds, dayNum: date.getDate(), dayLabel: date.toLocaleDateString('th-TH', { weekday: 'short' }), type: (date.getDay() === 0 || date.getDay() === 6) ? 'weekend' : (date.getDay() === 5 ? 'friday' : 'weekday') });
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, []);

  const reportData = useMemo(() => {
    const stats = { totalOt: 0, totalLeaves: 0, staffStats: [], dutyStats: [] };
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
      if (day.leaves) {
        day.leaves.forEach(l => {
          if (l.staffId && staffMap[l.staffId]) {
            staffMap[l.staffId].leaves += 1;
            stats.totalLeaves += 1;
          }
        });
      }
    });

    stats.staffStats = Object.values(staffMap).sort((a,b) => b.ot - a.ot);
    stats.dutyStats = Object.values(dutyMap);
    return stats;
  }, [schedule, masterData.staff]);

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), masterData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'records', 'main'), { records: schedule });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) { alert("Error: " + e.message); }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Superstore Cloud...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Navbar */}
      <nav className="bg-white border-b h-20 px-6 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><LayoutDashboard className="w-6 h-6 text-white" /></div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-tighter uppercase leading-none">Staff<span className="text-indigo-600">Sync</span></span>
            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest mt-1">● Cloud Live</span>
          </div>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-3xl">
          {[
            { id: 'manager', label: 'MANAGER', icon: Users },
            { id: 'admin', label: 'ADMIN', icon: Settings },
            { id: 'report', label: 'REPORT', icon: BarChart3 }
          ].map(v => (
            <button 
              key={v.id} onClick={() => setView(v.id)} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all ${
                view === v.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <v.icon className="w-4 h-4" /> {v.label}
            </button>
          ))}
          <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 hover:bg-indigo-700 shadow-lg">
             {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} บันทึกทั้งหมด
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {view === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-slate-800"><Users className="w-6 h-6 text-indigo-500"/> รายชื่อพนักงานในสังกัด</h2>
              <div className="flex gap-2 mb-6">
                <input type="text" placeholder="ชื่อ-นามสกุล พนักงานใหม่..." className="flex-grow border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm outline-none focus:border-indigo-500 transition" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
                <button onClick={() => { if(newStaffName) setMasterData(p=>({...p, staff:[...p.staff, {id:'s'+Date.now(), name:newStaffName}]})); setNewStaffName(''); }} className="bg-indigo-600 text-white px-8 rounded-2xl font-black">เพิ่มพนักงาน</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(masterData.staff || []).map(s => (
                  <div key={s.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-transparent hover:border-red-100 hover:bg-white transition group">
                    <span className="font-bold text-slate-700">{s.name}</span>
                    <button onClick={() => setMasterData(p=>({...p, staff:p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'manager' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Date Selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-1">
              {MARCH_DAYS.map(d => (
                <button 
                  key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)}
                  className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${
                    selectedDateStr === d.dateStr ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-xl scale-105 z-10' : 'border-slate-200 bg-white text-slate-400 opacity-70'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{d.dayLabel}</span>
                  <span className="text-2xl font-black mt-1">{d.dayNum}</span>
                </button>
              ))}
            </div>

            {/* Shift Editor */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">
                {new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {DUTY_DEFINITIONS.map(duty => (
                  <div key={duty.id} className="group p-6 rounded-[2rem] border-2 border-slate-50 bg-slate-50/30 hover:border-indigo-100 hover:bg-white transition-all duration-300 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest opacity-40">{duty.id} • STATION</h3>
                        <p className="font-black text-slate-900 text-lg leading-tight mt-1">{duty.jobA}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm"><Clock className="w-5 h-5 text-indigo-500" /></div>
                    </div>
                    <select 
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm transition"
                      onChange={(e) => {
                        const newSched = {...schedule};
                        if(!newSched[selectedDateStr]) newSched[selectedDateStr] = { duties: {}, leaves: [] };
                        newSched[selectedDateStr].duties[duty.id] = [{ staffId: e.target.value, otHours: 0 }];
                        setSchedule(newSched);
                      }}
                      value={schedule[selectedDateStr]?.duties?.[duty.id]?.[0]?.staffId || ""}
                    >
                      <option value="">-- ว่าง (คลิกเพื่อเลือกพนักงาน) --</option>
                      {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'report' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
                <TrendingUp className="absolute top-2 right-2 w-12 h-12 text-indigo-50" />
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Total OT Hours</p>
                <h3 className="text-4xl font-black text-indigo-600 mt-2">{reportData.totalOt.toFixed(1)} <span className="text-sm">HR</span></h3>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
                <PlaneTakeoff className="absolute top-2 right-2 w-12 h-12 text-orange-50" />
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Absence Days</p>
                <h3 className="text-4xl font-black text-orange-600 mt-2">{reportData.totalLeaves} <span className="text-sm">DAYS</span></h3>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest leading-none">Active Staff</p>
                <h3 className="text-4xl font-black text-slate-800 mt-2">{reportData.staffStats.filter(s=>s.shifts>0).length} <span className="text-sm">PERSONS</span></h3>
              </div>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-50 font-black uppercase text-slate-800 tracking-tighter flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" /> Employee Performance Ranking
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                  <tr><th className="px-6 py-4">พนักงาน</th><th className="px-6 py-4 text-center">เข้างาน (กะ)</th><th className="px-6 py-4 text-center">OT สะสม (ชม.)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                  {reportData.staffStats.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">{s.name}</td>
                      <td className="px-6 py-4 text-center text-slate-400">{s.shifts}</td>
                      <td className="px-6 py-4 text-center text-indigo-600">{s.ot.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {saveStatus === 'success' && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <span className="font-black uppercase tracking-tighter">Database Updated Successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}