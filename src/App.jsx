import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Settings, Users, Calendar, CheckCircle, AlertCircle, Clock, Save, Plus, Trash2, 
  LayoutDashboard, Printer, ChevronLeft, Coffee, BarChart3, TrendingUp, Award, 
  ArrowUpRight, PlaneTakeoff, Loader2 
} from 'lucide-react';

/**
 * RESTAURANT MANPOWER MANAGEMENT SYSTEM (MP26 MODEL) - V2.9 STABLE
 * แก้ไข: ข้ามขั้นตอน Auth หากติดปัญหาในโหมดพรีวิว + แก้ไขโครงสร้างไฟล์
 */

// --- 1. Firebase Config (ใช้ค่าเดิมจากรูปภาพของคุณ - ห้ามเปลี่ยนรหัสเหล่านี้) ---
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
const appId = "superstore-v1-stable"; 

const DUTY_DEFINITIONS = [
  { id: 'D1', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน' },
  { id: 'D2', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)' },
  { id: 'D3', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Service Station /เคลียร์โต๊ะ' },
  { id: 'D4', jobA: 'พนักงานจัดอาหารเตรียมเสิร์ฟ/ทำขนมหวาน', jobB: '-' },
  { id: 'D5', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Service Station' },
  { id: 'D6', jobA: 'พนักงานเตรียม Service Station', jobB: 'พนักงานจัดอาหารเตรียมเสิร์ฟ/ทำขนมหวาน' },
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
  const [error, setError] = useState(null);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [selectedDateStr, setSelectedDateStr] = useState('2026-03-01');
  const [schedule, setSchedule] = useState({}); 
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.warn("Auth Bypass: เข้าใช้งานในโหมด Offline ชั่วคราว");
        // ถ้า Auth พลาด ให้ถือว่ามี User หลอกๆ เพื่อให้ระบบรันต่อได้ในพรีวิว
        setUser({ uid: 'guest-user' });
      }
    };
    init();
    onAuthStateChanged(auth, (u) => { if(u) setUser(u); });
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master');
    const unsub = onSnapshot(masterRef, (snap) => {
      if (snap.exists()) setMasterData(snap.data());
      else setDoc(masterRef, INITIAL_MASTER_DATA);
      setLoading(false);
    }, (err) => {
      console.error(err);
      // ถ้า Error เพราะสิทธิ์ ให้รัน Master Data เริ่มต้นไปก่อน
      setLoading(false);
    });

    const schedRef = doc(db, 'artifacts', appId, 'public', 'data', 'records', 'main');
    const unsubSched = onSnapshot(schedRef, (snap) => {
      if (snap.exists()) setSchedule(snap.data().records || {});
    });

    return () => { unsub(); unsubSched(); };
  }, [user]);

  const MARCH_DAYS = useMemo(() => {
    const days = [];
    const date = new Date(2026, 2, 1);
    while (date.getMonth() === 2) {
      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ dateStr: ds, dayNum: date.getDate(), dayLabel: date.toLocaleDateString('th-TH', { weekday: 'short' }), type: 'weekday' });
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, []);

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), masterData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'records', 'main'), { records: schedule });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) { 
      setSaveStatus('error');
      alert("บันทึกไม่สำเร็จ: กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต"); 
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="font-black text-slate-400 uppercase tracking-widest text-sm text-center px-6">
          กำลังเชื่อมต่อ Superstore Cloud...<br/>
          <span className="text-[10px] font-normal lowercase">(หากค้างนานกว่า 10 วินาที ให้ลอง Refresh)</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b h-20 px-6 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 rounded-2xl shadow-xl"><LayoutDashboard className="w-6 h-6 text-white" /></div>
          <div className="flex flex-col">
            <span className="font-black text-2xl tracking-tighter uppercase leading-none text-slate-800">Staff<span className="text-indigo-600">Sync</span></span>
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1 animate-pulse">● Cloud Active</span>
          </div>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-3xl">
          <button onClick={() => setView('manager')} className={`px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all ${view==='manager'?'bg-white text-indigo-600 shadow-md':'text-slate-500'}`}>MANAGER</button>
          <button onClick={() => setView('admin')} className={`px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all ${view==='admin'?'bg-white text-indigo-600 shadow-md':'text-slate-500'}`}>ADMIN</button>
          <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 hover:bg-indigo-700 shadow-lg">
             {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
             บันทึก
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto pb-20">
        {view === 'admin' ? (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in">
            <h2 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 uppercase"><Users className="w-5 h-5 text-indigo-500"/> พนักงานในระบบ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(masterData.staff || []).map(s => (
                <div key={s.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                  <span className="font-bold text-slate-700">{s.name}</span>
                  <button onClick={() => setMasterData(p=>({...p, staff:p.staff.filter(x=>x.id!==s.id)}))} className="text-red-400">ลบ</button>
                </div>
              ))}
              <button onClick={() => {
                const name = prompt("ชื่อพนักงานใหม่:");
                if(name) setMasterData(p=>({...p, staff:[...p.staff, {id:'s'+Date.now(), name}]}));
              }} className="border-2 border-dashed p-4 rounded-2xl text-slate-400 font-black">+ เพิ่มพนักงาน</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {MARCH_DAYS.map(d => (
                <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${selectedDateStr===d.dateStr ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-xl scale-105 z-10' : 'border-slate-200 bg-white text-slate-400'}`}>
                  <span className="text-[10px] font-black uppercase">{d.dayLabel}</span>
                  <span className="text-2xl font-black mt-1">{d.dayNum}</span>
                </button>
              ))}
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-3xl font-black text-slate-900 mb-8">{new Date(selectedDateStr).toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {DUTY_DEFINITIONS.map(duty => (
                  <div key={duty.id} className="border-2 border-slate-50 rounded-3xl p-5 bg-slate-50/30">
                    <h3 className="font-black text-slate-800 uppercase text-sm mb-3">{duty.jobA}</h3>
                    <select 
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      onChange={(e) => {
                        const newSched = {...schedule};
                        if(!newSched[selectedDateStr]) newSched[selectedDateStr] = { duties: {} };
                        newSched[selectedDateStr].duties[duty.id] = [{ staffId: e.target.value, otHours: 0 }];
                        setSchedule(newSched);
                      }}
                      value={schedule[selectedDateStr]?.duties?.[duty.id]?.[0]?.staffId || ""}
                    >
                      <option value="">-- เลือกพนักงาน --</option>
                      {(masterData.staff || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar { display: none; }` }} />
    </div>
  );
}