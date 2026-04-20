import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc } from 'firebase/firestore';
import { 
  Users, AlertCircle, Clock, Save, Plus, Trash2, LayoutDashboard, Printer, ChevronLeft, ChevronRight, 
  Coffee, BarChart3, TrendingUp, Award, PlaneTakeoff, Loader2, Store, ArrowLeftRight, Sparkles, Wand2, Bold, Italic, Underline, Link as LinkIcon, BookOpen,
  Eraser, Filter, ChevronDown, Download, MessageCircle, Bell, UserCircle, SaveAll, FolderOpen, CheckCircle2, Edit2, X, Check, List, TableProperties, GripVertical, LogIn, ShieldCheck, Megaphone,
  UtensilsCrossed, ConciergeBell, UserPlus, ArrowUpRight, ArrowDownRight, CalendarDays as CalendarDaysIcon, Calendar as CalendarIcon
} from 'lucide-react';

/**
 * SUPER STORE Manager Assistant - V15.7 (ULTIMATE STABILITY FIX)
 * อัปเดต:
 * 1. ขจัดปัญหา ReferenceError 100% ด้วยการทำ Function Declaration ให้อยู่ใน Scope อย่างถูกต้อง
 * 2. โครงสร้างเมนู ADMIN: รวบรวม "จัดการพนักงาน", "จัดการหน้าที่", "วันหยุดสาขา", "แม่แบบ" และ "โครงสร้างกะงาน" ครบถ้วน
 * 3. หน้าจัดกะแบบรายเดือน (Monthly): เพิ่มระบบบันทึกวันลาหยุด พร้อมตัวเลือกวันที่แบบเจาะจง
 * 4. หน้า Print (รายเดือน): ลบงานรอง (Job B) ออก จัด Layout สะอาดตา
 */

// --- 1. Configurations ---
const firebaseConfig = {
  apiKey: "AIzaSyBJEmxRAPwUkafwutEg8TRUBqkIOP5tV0o",
  authDomain: "superstore-31f83.firebaseapp.com",
  projectId: "superstore-31f83",
  storageBucket: "superstore-31f83.firebasestorage.app",
  messagingSenderId: "761097159845",
  appId: "1:761097159845:web:07ca08e4854b017976794c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "staffsync-v8-stable-prod-final"; 

// --- Constants & Layers ---
const POSITIONS = {
  service: ["OC", "AOC", "SH", "SSD", "FD", "SD+", "EDC+", "DVT+", "PT+", "SD", "EDC", "DVT", "PT"],
  kitchen: ["OC", "AOC", "KH", "SKD", "KD+", "EDC ครัว+", "DVT ครัว+", "PT ครัว+", "KD", "EDC ครัว", "DVT ครัว", "PT ครัว"]
};

const LONG_HOUR_POSITIONS = ["OC", "AOC", "SH", "SSD", "FD", "SD+", "SD", "KH", "SKD", "KD+", "KD"];
const SHORT_HOUR_POSITIONS = ["EDC+", "DVT+", "PT+", "EDC", "DVT", "PT", "EDC ครัว+", "DVT ครัว+", "PT ครัว+", "EDC ครัว", "DVT ครัว", "PT ครัว"];

const DEFAULT_SHIFT_PRESETS = [
  { id: 'S1', name: 'กะเช้า', timings: { long: { startTime: '10:00', endTime: '19:30' }, short: { startTime: '10:00', endTime: '19:00' } } },
  { id: 'S2', name: 'กะบ่าย', timings: { long: { startTime: '12:00', endTime: '21:30' }, short: { startTime: '12:00', endTime: '21:00' } } },
  { id: 'S3', name: 'กะครัวเช้า', timings: { long: { startTime: '09:00', endTime: '18:30' }, short: { startTime: '09:00', endTime: '18:00' } } },
];

const DUTY_CATEGORIES = {
  service: [
    { id: 'FOH_HEAD', label: 'Customer Service Head Team', color: 'bg-[#4B7A47] text-white border-white/20' },
    { id: 'FOH_STAFF', label: 'Customer Service Staff Team', color: 'bg-[#89C579] text-slate-900 border-black/20' },
    { id: 'FOH_SUPPORT', label: 'Service Support Team', color: 'bg-[#D9E1D8] text-slate-800 border-black/20' }
  ],
  kitchen: [
    { id: 'BOH_HEAD', label: 'Kitchen Head Team', color: 'bg-[#1D4A7A] text-white border-white/20' },
    { id: 'BOH_STAFF', label: 'Kitchen Staff Team', color: 'bg-[#76B2D6] text-slate-900 border-black/20' },
    { id: 'BOH_SUPPORT', label: 'Kitchen Support Team', color: 'bg-[#D3E5F0] text-slate-800 border-black/20' }
  ]
};

const LEAVE_TYPES = [
  { id: 'OFF', label: 'หยุดประจำสัปดาห์', shortLabel: 'ย', color: 'bg-slate-100 text-slate-800' },
  { id: 'CO', label: 'หยุดชดเชย', shortLabel: 'ชช', color: 'bg-blue-100 text-blue-800' },
  { id: 'AL', label: 'หยุดพักร้อน', shortLabel: 'พร', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'SL', label: 'ลาป่วย', shortLabel: 'ป่วย', color: 'bg-red-100 text-red-800' },
  { id: 'PL', label: 'ลากิจ', shortLabel: 'กิจ', color: 'bg-orange-100 text-orange-800' },
];

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DAYS_OF_WEEK = [{id:0,label:'อาทิตย์'},{id:1,label:'จันทร์'},{id:2,label:'อังคาร'},{id:3,label:'พุธ'},{id:4,label:'พฤหัสบดี'},{id:5,label:'ศุกร์'},{id:6,label:'เสาร์'}];

const DEFAULT_SERVICE_DUTIES = [
  { id: 'D1', category: 'FOH_HEAD', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน', xpDna: '', reqPos: ["OC", "AOC", "SH", "SSD"] },
  { id: 'D2', category: 'FOH_HEAD', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)', xpDna: '', reqPos: ["OC", "AOC", "SH", "SSD"] },
  { id: 'D3', category: 'FOH_STAFF', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Station /เคลียร์โต๊ะ', xpDna: '', reqPos: ["FD", "SD+", "EDC+", "DVT+"] },
  { id: 'D4', category: 'FOH_STAFF', jobA: 'พนักงานจัดอาหาร/ทำขนมหวาน', jobB: '-', xpDna: '', reqPos: ["FD", "SD+", "EDC+", "DVT+"] },
  { id: 'D5', category: 'FOH_SUPPORT', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Station', xpDna: '', reqPos: ["PT+", "SD", "EDC", "DVT", "PT"] },
  { id: 'D6', category: 'FOH_SUPPORT', jobA: 'พนักงานเตรียม Station', jobB: 'พนักงานจัดอาหาร/ทำขนมหวาน', xpDna: '', reqPos: ["PT+", "SD", "EDC", "DVT", "PT"] },
];

const DEFAULT_KITCHEN_DUTIES = [
  { id: 'K1', category: 'BOH_HEAD', jobA: 'CHECKER', jobB: 'ครัวร้อน', xpDna: '', reqPos: ["OC", "AOC", "KH", "SKD"] },
  { id: 'K2', category: 'BOH_HEAD', jobA: 'CHECKER', jobB: 'สไลซ์/ซีฟู้ด', xpDna: '', reqPos: ["OC", "AOC", "KH", "SKD"] },
  { id: 'K3', category: 'BOH_STAFF', jobA: 'ทอด/ผัด', jobB: 'PREP สไลซ์ ซีฟู้ด', xpDna: '', reqPos: ["KD+", "EDC ครัว+", "DVT ครัว+"] },
  { id: 'K4', category: 'BOH_SUPPORT', jobA: 'อ่างกระทะ', jobB: 'PREP', xpDna: '', reqPos: ["PT ครัว+", "KD", "EDC ครัว", "DVT ครัว", "PT ครัว"] },
];

const DEFAULT_GUIDE_STEPS = [
  {
     id: 'G1',
     title: "รายเดือน: ADMIN (อัปเดตข้อมูลพนักงาน)",
     content: "เริ่มต้นการจัดกะรายเดือน ผู้จัดการมีหน้าที่อัปเดตข้อมูลรายชื่อและวันหยุดประจำสัปดาห์ให้เป็นปัจจุบันที่สุดในเมนู <b>ADMIN</b>:<br><br>• <b>เพิ่ม/ลดพนักงาน:</b> เลื่อนไปที่ตารางจัดการพนักงาน กรอกรหัส ชื่อ แผนก ตำแหน่ง และวันหยุดประจำสัปดาห์ (ถ้ามี) แล้วกด เพิ่มพนักงาน หรือลบออก<br>• <b>ดูโควตาวันหยุด:</b> ระบบจะแสดงโควตาวันหยุด (จันทร์-อาทิตย์) ที่แอดมินกำหนดไว้ หากวันไหนขึ้นเต็มจะไม่สามารถให้หยุดเพิ่มได้<br>• <b>จัดวันหยุดอัตโนมัติ:</b> กดปุ่ม จัดวันหยุด Auto เพื่อให้ระบบสุ่มใส่วันหยุดประจำสัปดาห์ให้พนักงาน",
     image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
     color: "bg-emerald-500",
     stepNum: "1"
  },
  {
     id: 'G2',
     title: "รายเดือน: MANAGER (ใส่วันหยุดชดเชย ลาพักร้อน & จัดกะ Auto)",
     content: "ไปที่เมนู <b>MANAGER</b> และเลือกมุมมอง <b>จัดกะแบบรายเดือน</b> เพื่อจัดการวันลาก่อนรันระบบ:<br><br>• <b>บันทึกวันลาหยุด:</b> ใส่วันหยุดชดเชย (CO) หรือ ลาพักร้อน (AL) ล่วงหน้าในปฏิทินรายเดือนให้เรียบร้อย<br>• <b>จัดกะอัตโนมัติ:</b> กดปุ่ม จัดกะอัตโนมัติ (ทั้งเดือน) เพื่อให้ AI นำข้อมูลทั้งหมดมาจ่ายงานเข้ากะรายวันให้ครบถ้วน",
     image: "https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=1200&q=80",
     color: "bg-indigo-600",
     stepNum: "2"
  },
  {
     id: 'G3',
     title: "รายเดือน: EUNITE (ทำข้อมูลบนระบบ Eunite)",
     content: "หลังจาก AI จัดตารางงานเรียบร้อยและผู้จัดการได้รีวิวข้อมูลครบถ้วนแล้ว:<br><br>• <b>เชื่อมโยงระบบ:</b> นำข้อมูลตารางการทำงานที่ได้ ไปดำเนินการทำข้อมูลต่อบน <b>ระบบ Eunite</b><br>• <b>ส่งออกข้อมูล:</b> สามารถไปที่เมนู <b>REPORT</b> เพื่อกด Export CSV นำข้อมูลชั่วโมงทำงานและ OT ไปตรวจเช็คหรือใช้งานต่อได้",
     image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
     color: "bg-orange-500",
     stepNum: "3"
  },
  {
     id: 'G4',
     title: "รายวัน: MANAGER (ใช้ บทบาทหน้าที่ประจำวัน)",
     content: "สำหรับการดำเนินงานหน้าสาขารายวัน จะใช้ตารางรายวันเพื่อจัดการหน้าร้าน (Operation):<br><br>• <b>บทบาทหน้าที่ประจำวัน (Duty Roster Chart):</b> กดเปลี่ยนมุมมองเพื่อดูตารางสรุปหน้าที่ของวันนี้ ว่าพนักงานแต่ละคนต้องทำงานหลัก/งานรองอะไร เข้ากะเวลาไหน และมีรอบพักเบรคช่วงไหนบ้าง<br>• <b>พิมพ์ตาราง (Print):</b> กดสั่งพิมพ์ตารางนี้เพื่อนำไปแปะบอร์ดที่ร้านสำหรับบรีฟพนักงานก่อนเริ่มงานทุกวัน",
     image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=1200&q=80",
     color: "bg-sky-500",
     stepNum: "4"
  }
];

const DEFAULT_SITE_MAP = [
  { id: 'SM1', title: '1. ADMIN (จัดการพนักงาน)', color: 'text-emerald-400', items: ['เพิ่ม/ลบ/แก้ไขพนักงาน', 'กำหนดวันหยุดประจำสัปดาห์'] },
  { id: 'SM2', title: '2. MANAGER (จัดแผนงาน)', color: 'text-indigo-400', items: ['จัดแผนงานประจำเดือน', 'จัดกะรายเดือนอัตโนมัติ (AI)', 'จัดกะรายวันอัตโนมัติ (AI)', 'จัดการวันลา', 'บทบาทหน้าที่ประจำวัน (Duty Roster Chart)', 'พิมพ์ตาราง (Print)'] },
  { id: 'SM3', title: '3. REPORT (สรุปผล)', color: 'text-orange-400', items: ['สรุปชั่วโมงทำงานและ OT', 'Export CSV นำไปทำเงินเดือน'] }
];

const DEFAULT_WORKFLOW = {
    monthly: [
        { id: 'WM1', text: 'ADMIN\nอัปเดตข้อมูลคน', theme: 'emerald' },
        { id: 'WM2', text: 'MANAGER\nใส่วันหยุดชดเชย / ลาพักร้อน', theme: 'indigo' },
        { id: 'WM3', text: 'MANAGER\nจัดกะประจำเดือน Auto', theme: 'indigo' },
        { id: 'WM4', text: 'EUNITE\nทำข้อมูลบนระบบ Eunite', theme: 'orange' }
    ],
    daily: [
        { id: 'WD1', text: 'MANAGER\nใช้ บทบาทหน้าที่ประจำวัน\n(Duty Roster Chart)', theme: 'sky' }
    ]
};

const DEFAULT_GUIDE_HEADER = {
  title: "Site Map & Workflow",
  subtitle: "โครงสร้างระบบและลำดับขั้นตอนการทำงาน",
  journeyTitle: "Manager Journey Guide",
  journeySubtitle: "คู่มือสรุปขั้นตอนการทำงานสำหรับผู้จัดการสาขา"
};

// --- Helper Functions (Hoisted) ---
function checkPositionEligibility(staffPos, reqPosArr, dept) {
  if (!reqPosArr || reqPosArr.length === 0 || reqPosArr.includes('ALL')) return true;
  let targetDept = 'service';
  if(POSITIONS.kitchen.includes(staffPos)) targetDept = 'kitchen';
  const deptPositions = POSITIONS[targetDept] || [];
  const staffRank = deptPositions.indexOf(staffPos);
  if (staffRank === -1) return false; 
  return reqPosArr.some(reqPos => {
    const reqRank = deptPositions.indexOf(reqPos);
    return reqRank !== -1 && staffRank <= reqRank;
  });
}

function generateDefaultMatrix(svc = DEFAULT_SERVICE_DUTIES, ktn = DEFAULT_KITCHEN_DUTIES) {
  const m = {};
  ['weekday', 'friday', 'weekend'].forEach(dt => {
    m[dt] = { duties: {} };
    svc.forEach(d => m[dt].duties[d.id] = [{ shiftPresetId: 'S1', maxOtHours: 4.0 }]);
    ktn.forEach(k => m[dt].duties[k.id] = [{ shiftPresetId: 'S3', maxOtHours: 4.0 }]);
  });
  return m;
}

function getDaysInMonth(year, month, holidays = []) {
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
}

function formatTimeAbbreviation(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    return `${parseInt(h, 10)}.${m ? m.charAt(0) : '0'}`;
}

function getShiftTimesForStaff(staffPos, shiftPreset) {
    if (!shiftPreset) return { startTime: '??:??', endTime: '??:??' };
    
    const isLongHour = LONG_HOUR_POSITIONS.includes(staffPos);
    const timings = isLongHour ? shiftPreset.timings.long : shiftPreset.timings.short;
    
    return { startTime: timings.startTime, endTime: timings.endTime };
}

function getStaffLayer(dept, pos) {
  if (dept === 'service') {
    if (["OC", "AOC", "SH", "SSD"].includes(pos)) return DUTY_CATEGORIES.service[0];
    if (["FD", "SD+", "EDC+", "DVT+"].includes(pos)) return DUTY_CATEGORIES.service[1];
    return DUTY_CATEGORIES.service[2];
  } else {
    if (["OC", "AOC", "KH", "SKD"].includes(pos)) return DUTY_CATEGORIES.kitchen[0];
    if (["KD+", "EDC ครัว+", "DVT ครัว+"].includes(pos)) return DUTY_CATEGORIES.kitchen[1];
    return DUTY_CATEGORIES.kitchen[2];
  }
}

function getWorkflowTheme(theme) {
  switch(theme) {
      case 'emerald': return { wrap: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-500 text-slate-900' };
      case 'indigo': return { wrap: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-500 text-white' };
      case 'orange': return { wrap: 'bg-orange-500/20 text-orange-300 border-orange-500/30', dot: 'bg-orange-500 text-slate-900' };
      case 'sky': return { wrap: 'bg-sky-500/20 text-sky-300 border-sky-500/30', dot: 'bg-sky-500 text-slate-900' };
      default: return { wrap: 'bg-slate-500/20 text-slate-300 border-slate-500/30', dot: 'bg-slate-500 text-white' };
  }
}

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
      <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`p-2 sm:p-2.5 text-center font-black bg-emerald-50/50 text-[10px] sm:text-xs truncate cursor-pointer rounded-xl border ${disabled ? 'opacity-50' : 'hover:border-emerald-500'}`}>
        {valArray.join(', ')}
      </div>
      {isOpen && !disabled && (
        <React.Fragment>
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
        </React.Fragment>
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
          <React.Fragment>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar py-2">
              {options.length === 0 ? (<div className="px-4 py-3 text-[10px] text-slate-400 text-center font-bold">ไม่มีพนักงานว่างให้เลือก</div>) : options.map(o => {
                const layer = getStaffLayer(o.dept, o.pos);
                return (
                  <div key={o.id} className={`px-4 py-2.5 text-[10px] sm:text-xs font-bold cursor-pointer hover:bg-slate-50 flex items-center gap-3 transition-colors ${valArray.includes(o.id) ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`} onClick={() => toggle(o.id)}>
                    <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border flex flex-shrink-0 items-center justify-center transition-colors ${valArray.includes(o.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>{valArray.includes(o.id) && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}</div>
                    <span className="truncate">{o.name}</span>
                    <span className={`text-[8px] sm:text-[9px] ml-auto px-1.5 py-0.5 rounded border shadow-sm flex-shrink-0 ${layer.color}`}>{o.pos}</span>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        )}
     </div>
  );
};

// === UPDATED PrintMonthlyView Component ===
// Drop-in replacement for the existing PrintMonthlyView in your codebase.
//
// Structure per row:
//   [Duty Layer] | [Job Duty] | [Staff Name (Position)] | [Day1] [Day2] ... [DayN]
//
// Each day cell shows:
//   - Shift time e.g. "10-19" + OT badge if otHours > 0  → staff is working
//   - Leave short label e.g. "ย", "พร", "ป่วย"           → staff is on leave
//   - "-"                                                  → no data

const PrintMonthlyView = ({ CALENDAR_DAYS, branchData, globalConfig, activeBranchId, THAI_MONTHS, selectedMonth, getStaffDayInfo, setView, activeDept, CURRENT_DUTY_LIST }) => {
  const filteredStaff = branchData.staff?.filter(s => s.dept === activeDept) || [];
  const sortedStaff = [...filteredStaff].sort((a, b) => {
      const rankA = POSITIONS[activeDept].indexOf(a.pos);
      const rankB = POSITIONS[activeDept].indexOf(b.pos);
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
  });

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
        <div className="overflow-x-auto border-2 sm:border-4 border-slate-900 rounded-xl sm:rounded-[2.5rem] shadow-lg sm:shadow-2xl overflow-hidden w-full custom-scrollbar pb-2 sm:pb-0 print:border-none print:shadow-none print:overflow-visible">
          <table className="w-full border-collapse text-[6px] sm:text-[8px] table-fixed min-w-[800px] sm:min-w-none bg-white print:border-2 print:border-black">
            <thead>
              <tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                <th className="border-r border-slate-700 p-2 sm:p-3 text-center sticky left-0 bg-slate-900 z-30 w-16 sm:w-20 font-black uppercase border-b-2 border-slate-600 print:border-black print:bg-transparent">Duty Layer</th>
                <th className="border-r border-slate-700 p-2 sm:p-3 text-center sticky left-[4rem] sm:left-[5rem] bg-slate-900 z-30 w-12 sm:w-16 font-black uppercase border-b-2 border-slate-600 print:border-black print:bg-transparent">Pos</th>
                <th className="border-r border-slate-700 p-2 sm:p-3 text-left sticky left-[7rem] sm:left-[9rem] bg-slate-900 z-30 w-24 sm:w-40 font-black uppercase border-b-2 border-slate-600 print:border-black print:bg-transparent">Employee Name</th>
                {CALENDAR_DAYS.map(day => (
                  <th key={day.dateStr} className={`border-r border-slate-700 p-1.5 sm:p-3 min-w-[30px] sm:min-w-[45px] text-center border-b-2 border-slate-600 print:border-black ${day.type === 'weekend' || branchData.holidays?.includes?.(day.dateStr) ? 'bg-slate-800 text-indigo-300 print:text-black print:bg-slate-100' : ''}`}>
                    <div className="font-black text-[10px] sm:text-sm mb-0.5 sm:mb-1">{day.dayNum}</div><div className="text-[6px] sm:text-[8px] opacity-70 uppercase tracking-tighter">{day.dayLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DUTY_CATEGORIES[activeDept].map(cat => {
                 const catStaff = sortedStaff.filter(s => getStaffLayer(s.dept, s.pos).id === cat.id);
                 if (catStaff.length === 0) return null;
                 return (
                   <React.Fragment key={cat.id}>
                     {catStaff.map((s, dIdx) => (
                        <tr key={s.id} className="h-10 sm:h-14 transition-colors border-b border-slate-200 print:border-black">
                          {dIdx === 0 && (
                            <td rowSpan={catStaff.length} className={`border-r border-slate-900 p-1 font-black sticky left-0 z-10 text-[5px] sm:text-[7px] uppercase leading-tight text-center print:border-black print:bg-transparent ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>
                               {cat.label.replace('Customer Service ', '').replace('Kitchen ', '')}
                            </td>
                          )}
                          <td className="border-r-2 sm:border-r-4 border-slate-900 p-1 sm:p-2 font-black sticky left-[4rem] sm:left-[5rem] bg-white z-10 text-[7px] sm:text-[9px] uppercase leading-tight text-center print:border-black print:bg-transparent">
                             {s.pos}
                          </td>
                          <td className="border-r-2 sm:border-r-4 border-slate-900 p-2 sm:p-3 font-black sticky left-[7rem] sm:left-[9rem] bg-white z-10 text-[8px] sm:text-[10px] uppercase leading-tight truncate max-w-[100px] sm:max-w-[150px] print:border-black print:bg-transparent">
                             {s.name}
                          </td>
                          {CALENDAR_DAYS.map(day => {
                             const info = getStaffDayInfo(s.id, day.dateStr, CURRENT_DUTY_LIST);
                             return (
                               <td key={day.dateStr} className={`border-r border-b border-slate-200 p-0.5 sm:p-1 text-center print:border-black ${!info ? 'bg-slate-50/40 print:bg-transparent' : ''}`}>
                                 {info?.type === 'work' ? (
                                   <div className="flex flex-col items-center justify-center leading-tight w-full h-full">
                                     <span className="font-black text-slate-800 text-[8px] sm:text-[10px] leading-none tracking-tighter print:text-black">{formatTimeAbbreviation(info.slot.startTime)}</span>
                                     {info.actual?.otHours > 0 && <div className="text-[6px] sm:text-[7px] font-black text-rose-600 truncate w-full px-0.5 uppercase tracking-tighter mt-0.5 print:text-black">O{info.actual.otHours}</div>}
                                   </div>
                                 ) : info?.type === 'leave' ? (
                                   <div className={`w-full h-full flex items-center justify-center font-black ${info.info.color} rounded-md sm:rounded-xl border sm:border-2 border-white shadow-inner text-[8px] sm:text-[10px] print:bg-transparent print:text-black print:border-none`}><span className="text-center leading-none uppercase p-0.5 sm:p-1">{info.info.shortLabel}</span></div>
                                 ) : <span className="text-[5px] sm:text-[7px] font-black opacity-10 uppercase tracking-widest print:text-transparent">OFF</span>}
                               </td>
                             );
                          })}
                        </tr>
                     ))}
                   </React.Fragment>
                 );
              })}
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
  const [newDutyXpDna, setNewDutyXpDna] = useState(''); 
  const [newDutyReqPos, setNewDutyReqPos] = useState(['ALL']); 
  const [newDutyCategory, setNewDutyCategory] = useState('FOH_STAFF');
  const [newDutyIsBackup, setNewDutyIsBackup] = useState(false);
  const [editingDutyId, setEditingDutyId] = useState(null);
  const [editDutyData, setEditDutyData] = useState({});
  const [editingShiftPresetId, setEditingShiftPresetId] = useState(null);
  const [editShiftPresetData, setEditShiftPresetData] = useState(null);


  const [draggedDutyIdx, setDraggedDutyIdx] = useState(null);
  const [draggedShiftPresetIdx, setDraggedShiftPresetIdx] = useState(null);
  
  const [staffFilterPos, setStaffFilterPos] = useState('ALL'); 
  const [templateName, setTemplateName] = useState('');

  const [reportFilterMode, setReportFilterMode] = useState('month'); 
  const [reportFilterMonth, setReportFilterMonth] = useState(new Date().getMonth());
  const [reportFilterStart, setReportFilterStart] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [reportFilterEnd, setReportFilterEnd] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`);

  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [editGuideSteps, setEditGuideSteps] = useState([]);
  const [editSiteMap, setEditSiteMap] = useState([]);
  const [editWorkflow, setEditWorkflow] = useState({ monthly: [], daily: [] });
  const [editGuideHeader, setEditGuideHeader] = useState({});
  const [zoomedImage, setZoomedImage] = useState(null);

  // Landing Page States
  const [hasSeenLanding, setHasSeenLanding] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [landingIndex, setLandingIndex] = useState(0);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnImage, setNewAnnImage] = useState('');
  const [newAnnStartDate, setNewAnnStartDate] = useState('');
  const [newAnnEndDate, setNewAnnEndDate] = useState('');

  const [aiMessage, setAiMessage] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const dateBarRef = useRef(null);
  const selectedYear = 2026;
  const autoAssignedDates = useRef(new Set()); 
  const scheduleRef = useRef();
  scheduleRef.current = schedule;

  // Data Inspector State
  const [showDataInspector, setShowDataInspector] = useState(false);
  const [inspectorBranchId, setInspectorBranchId] = useState(null);
  const [inspectedData, setInspectedData] = useState({ branch: null, schedule: null, loading: false, error: null });
  const [inspectorTab, setInspectorTab] = useState('staff');
  const [inspectorBackups, setInspectorBackups] = useState([]);
  const [inspectorRestoreMode, setInspectorRestoreMode] = useState('all');

  const CURRENT_DUTY_LIST = useMemo(() => {
    let list = branchData.duties && branchData.duties[activeDept] ? branchData.duties[activeDept] : (activeDept === 'service' ? DEFAULT_SERVICE_DUTIES : DEFAULT_KITCHEN_DUTIES);
    return list.map(d => ({
        ...d,
        category: d.category || (activeDept === 'service' ? 'FOH_STAFF' : 'BOH_STAFF'),
        xpDna: d.xpDna || ''
    }));
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
              const mSlot = matrixSlots[idx];
              const shiftPreset = branchData.shiftPresets?.find(p => p.id === mSlot?.shiftPresetId);
              const staffPos = staffMap[slot.staffId].pos;
              const { startTime, endTime } = getShiftTimesForStaff(staffPos, shiftPreset);
              const [sh, sm] = startTime.split(':').map(Number);
              const [eh, em] = endTime.split(':').map(Number);
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
    }); // This might have issues if staff position changes.
    return Object.values(staffMap).sort((a,b) => b.workHours - a.workHours);
  }, [schedule, branchData.staff, branchData.matrix, branchData.holidays, reportFilterMode, reportFilterMonth, reportFilterStart, reportFilterEnd, selectedYear]);

  const totalActualOT = reportData.reduce((acc, curr) => acc + curr.actualOT, 0);
  const totalPlannedOT = reportData.reduce((acc, curr) => acc + curr.plannedOT, 0);
  const deltaOT = totalActualOT - totalPlannedOT;

  const activeDayShiftVisibilities = useMemo(() => {
      let hasMorning = false, hasLateMorning = false, hasAfternoon = false, hasEvening = false, hasNight = false;
      if (branchData.matrix && activeDay) {
          CURRENT_DUTY_LIST.forEach(duty => {
              const slots = branchData.matrix[activeDay.type]?.duties?.[duty.id] || [];
              slots.forEach(matrixSlot => {
                  const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);
                  if (!shiftPreset) return;
                  // Use long hours as a representative time for column visibility
                  const startTime = shiftPreset.timings.long.startTime;
                  const stHour = parseInt(startTime.split(':')[0]) || 0;
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
  }, [branchData.matrix, activeDay, CURRENT_DUTY_LIST, branchData.shiftPresets]);

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
        const dayType = dayConfig ? dayConfig.type : 'weekday';
        const matrixSlots = branchData.matrix?.[dayType]?.duties?.[d.id] || [];
        const matrixSlot = matrixSlots[sIdx];

        if (!matrixSlot || !matrixSlot.shiftPresetId) {
            return { type: 'work', duty: d, slot: {startTime:'??:??', endTime:'??:??'}, actual: slots[sIdx] };
        }

        const staffInfo = branchData.staff?.find(s => s.id === staffId);
        const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);

        if (!shiftPreset || !staffInfo) {
            return { type: 'work', duty: d, slot: {startTime:'??:??', endTime:'??:??'}, actual: slots[sIdx] };
        }

        const effectiveTimings = getShiftTimesForStaff(staffInfo.pos, shiftPreset);
        const effectiveSlot = { ...matrixSlot, ...effectiveTimings };

        return { type: 'work', duty: d, slot: effectiveSlot, actual: slots[sIdx] };
      }
    }
    return null;
  }, [schedule, CALENDAR_DAYS, branchData.matrix, branchData.staff, branchData.shiftPresets]);

  // === EFFECTS ===
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
        if (!data.shiftPresets || !Array.isArray(data.shiftPresets) || data.shiftPresets.length === 0) {
            data.shiftPresets = DEFAULT_SHIFT_PRESETS;
        }
        if (!data.duties) data.duties = { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES };
        if (!data.templates) data.templates = [];
        if (!data.rosterStyle) {
            data.rosterStyle = { 
                fontSize: 10, headerBg: '#f1f5f9', shiftHeaderBg: '#e0f2fe', 
                colDuty: 8, colXpDna: 10, colJobA: 15, colJobB: 10, colCount: 4, colName: 15, colShift: 7, colBreak: 8,
                headlineSize: 24, subHeadlineSize: 14, headerFontSize: 10,
                fontDuty: 10, fontXpDna: 8, fontJobA: 10, fontJobB: 8, fontCount: 12, fontName: 10, fontShift: 10, fontBreak: 10
            };
        }
        // Migration for dayOffLimits from old format to new { service: ..., kitchen: ... } format
        if (!data.dayOffLimits || !data.dayOffLimits.service || !data.dayOffLimits.kitchen) {
            const defaultLimits = { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99 };
            // If dayOffLimits exists but is in the old format, use it as the base for both departments
            const baseLimits = (data.dayOffLimits && !data.dayOffLimits.service) ? data.dayOffLimits : defaultLimits;
            data.dayOffLimits = {
                service: { ...defaultLimits, ...baseLimits },
                kitchen: { ...defaultLimits, ...baseLimits }
            };
        }
        if (!data.matrix) {
            data.matrix = generateDefaultMatrix(data.duties.service, data.duties.kitchen);
        } else {
            let needsMigration = false;
            ['weekday', 'friday', 'weekend'].forEach(dt => {
                if (data.matrix[dt]?.duties) {
                    Object.values(data.matrix[dt].duties).forEach(slots => {
                        if (slots && slots.length > 0 && slots[0] && slots[0].startTime) {
                            needsMigration = true;
                        }
                    });
                }
            });

            if (needsMigration) {
                ['weekday', 'friday', 'weekend'].forEach(dt => {
                    if (data.matrix[dt]?.duties) {
                        Object.keys(data.matrix[dt].duties).forEach(dutyId => {
                            data.matrix[dt].duties[dutyId] = data.matrix[dt].duties[dutyId].map(oldSlot => {
                                const defaultShift = (dutyId.startsWith('K') ? 'S3' : 'S1');
                                return { shiftPresetId: data.shiftPresets?.find(p => p.name.includes('เช้า'))?.id || defaultShift, maxOtHours: oldSlot.maxOtHours || 4.0 };
                            });
                        });
                    }
                });
            }

            ['weekday', 'friday', 'weekend'].forEach(dt => {
                if (!data.matrix[dt]) data.matrix[dt] = { duties: {} };
                if (!data.matrix[dt].duties) data.matrix[dt].duties = {};
                ['service', 'kitchen'].forEach(dept => {
                    (data.duties[dept] || []).forEach(duty => {
                        if (!data.matrix[dt].duties[duty.id]) {
                            const defaultShift = dept === 'service' ? 'S1' : 'S3';
                            data.matrix[dt].duties[duty.id] = [{ shiftPresetId: defaultShift, maxOtHours: 4.0 }];
                        }
                    });
                });
            });
        }
        setBranchData(data);
      } else { setBranchData({ staff: [], holidays: [], duties: { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES }, matrix: generateDefaultMatrix(), shiftPresets: DEFAULT_SHIFT_PRESETS, templates: [] }); }
    });
    const unsubSched = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), (snap) => {
      if (snap.exists()) setSchedule(snap.data().records || {}); else setSchedule({});
    });
    const unsubReq = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), (snap) => {
      if (snap.exists()) setPendingRequests(snap.data().list || []); else setPendingRequests([]);
    });
    return () => { unsubBranch(); unsubSched(); unsubReq(); };
  }, [user, activeBranchId]);

  // Reset Landing Page view when branch changes
  useEffect(() => {
      setHasSeenLanding(false);
  }, [activeBranchId]);

  // Trigger Landing Page
  useEffect(() => {
      if (activeBranchId && branchData && branchData.announcements && !hasSeenLanding && authRole !== 'guest' && authRole !== 'superadmin') {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const activeAnnouncements = branchData.announcements.filter(a => {
              if (!a.isActive) return false;
              if (a.startDate && a.startDate > todayStr) return false;
              if (a.endDate && a.endDate < todayStr) return false;
              return true;
          });
          if (activeAnnouncements.length > 0) {
              setShowLanding(true); setLandingIndex(0);
          }
          setHasSeenLanding(true);
      }
  }, [activeBranchId, branchData, hasSeenLanding, authRole]);

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
        const isHoliday = branchData.holidays?.includes?.(selectedDateStr);
        const regularOffStaff = isHoliday ? [] : branchData.staff.filter(s => s.regularDayOff === dayOfWeek);
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
                const matrixSlot = branchData.matrix[dayType]?.duties?.[duty.id]?.[idx];
                if (matrixSlot && !assigned[idx].otUpdated && (!assigned[idx].otHours || assigned[idx].otHours === 0) && matrixSlot.maxOtHours > 0) {
                    assigned[idx].otHours = matrixSlot.maxOtHours; 
                    assigned[idx].otUpdated = true; 
                    hasChanges = true;
                }
             }
          });
        });
    });
    if (hasChanges) setSchedule(newSched);
  }, [schedule, branchData.matrix, CURRENT_DUTY_LIST, branchData.holidays, branchData.shiftPresets]);

  useEffect(() => {
      if (selectedDateStr) {
          const dateMonth = parseInt(selectedDateStr.split('-')[1], 10) - 1;
          if (dateMonth !== selectedMonth) {
              setSelectedMonth(dateMonth);
          }
      }
  }, [selectedDateStr, selectedMonth]);

  useEffect(() => {
      setNewDutyCategory(activeDept === 'service' ? 'FOH_STAFF' : 'BOH_STAFF');
  }, [activeDept]);

  // === HANDLERS ===
  const handleManagerLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const admin = globalConfig.admins?.find(a => a.user === userInput && a.pass === passInput);
    if (admin) { setAuthRole('superadmin'); if (globalConfig.branches?.length > 0) setActiveBranchId(globalConfig.branches[0].id); setView('manager'); setHasSeenLanding(false); return; }
    const branch = globalConfig.branches?.find(b => b.user === userInput && b.pass === passInput);
    if (branch) { setAuthRole('branch'); setActiveBranchId(branch.id); setView('manager'); setHasSeenLanding(false); return; }
    setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  };

  const handleOpenInspector = () => {
      const pwd = window.prompt("กรุณาใส่รหัสผ่าน Admin เพื่อเข้าสู่ Data Inspector:");
      if (!pwd) return;
      const isAdmin = globalConfig.admins?.some(a => a.pass === pwd);
      if (isAdmin || pwd === "superstore") {
          setShowDataInspector(true);
      } else {
          window.alert("Access Denied: รหัสผ่านไม่ถูกต้อง");
      }
  };

  // === GLOBAL AUTO BACKUP SYSTEM (แบคอัปทุกสาขา) ===
  useEffect(() => {
      if (!user || !globalConfig || !globalConfig.branches || globalConfig.branches.length === 0) return;

      const checkAndBackupAll = async () => {
          const now = new Date();
          if (now.getHours() >= 9) {
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const dayOfMonth = now.getDate(); // 1-31 (ใช้สำหรับเวียนทับทุก 30/31 วัน)
              
              if (globalConfig.lastGlobalBackupDate !== todayStr) {
                  try {
                      console.log("Starting Global Auto Backup for all branches...");
                      
                      for (const b of globalConfig.branches) {
                          const branchRef = doc(db, 'artifacts', appId, 'public', 'data', 'branches', b.id);
                          const schedRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', b.id);
                          const [bSnap, sSnap] = await Promise.all([getDoc(branchRef), getDoc(schedRef)]);
                          
                          if (bSnap.exists() && sSnap.exists()) {
                              const backupRef = doc(db, 'artifacts', appId, 'public', 'data', 'backups', `${b.id}_day_${dayOfMonth}`);
                              await setDoc(backupRef, { backupDate: todayStr, timestamp: Date.now(), branchData: bSnap.data(), schedule: sSnap.data().records || {} });
                          }
                      }
                      
                      const newConfig = { ...globalConfig, lastGlobalBackupDate: todayStr };
                      setGlobalConfig(newConfig);
                      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), { lastGlobalBackupDate: todayStr }, { merge: true });
                      console.log(`Global Auto Backup completed on ${todayStr} (Slot: day_${dayOfMonth})`);
                  } catch (e) {
                      console.error("Global Auto backup failed:", e);
                  }
              }
          }
      };
      
      checkAndBackupAll();
      const intervalId = setInterval(checkAndBackupAll, 60000); // Check every minute
      return () => clearInterval(intervalId);
  }, [user, globalConfig.lastGlobalBackupDate, globalConfig.branches]);

  const autoSaveSchedule = useCallback(async (scheduleData) => {
    const dataToSave = scheduleData || scheduleRef.current;
    if (!activeBranchId) return;
    setSaveStatus('saving');
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), { records: dataToSave });
      setSaveStatus('success');
      setTimeout(() => { setSaveStatus(null); }, 1500);
    } catch (err) {
      setSaveStatus('error');
    }
  }, [activeBranchId]);

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

  const handleScheduleUpdate = (dateStr, dutyId, slotIndex, field, value, defaultOt = 0) => {
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
         // Auto-save on staff change
         if (activeBranchId) autoSaveSchedule(newSched);
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
        if (activeBranchId) autoSaveSchedule(newSched);
        return newSched;
    });
  }, [activeBranchId, autoSaveSchedule]);

  const handleAddDuty = () => {
    if (!newDutyJobA.trim()) return;
    const newId = (activeDept === 'service' ? 'D' : 'K') + Date.now();
    const newDuty = { id: newId, category: newDutyCategory, jobA: newDutyJobA.trim(), jobB: newDutyJobB.trim() || '-', xpDna: newDutyXpDna.trim(), reqPos: newDutyReqPos, isBackup: newDutyIsBackup };
    setBranchData(prev => {
      const nd = JSON.parse(JSON.stringify(prev));
      if (!nd.duties) nd.duties = { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES };
      if (!nd.duties[activeDept]) nd.duties[activeDept] = activeDept === 'service' ? DEFAULT_SERVICE_DUTIES : DEFAULT_KITCHEN_DUTIES;
      nd.duties[activeDept].push(newDuty);
      if(!nd.matrix) nd.matrix = generateDefaultMatrix();
      ['weekday', 'friday', 'weekend'].forEach(dt => { // This part might need adjustment for new shift preset logic
        if(!nd.matrix[dt].duties[newId]) nd.matrix[dt].duties[newId] = [{ shiftPresetId: 'S1', maxOtHours: 4.0 }];
      });
      return nd;
    });
    setNewDutyJobA(''); setNewDutyJobB(''); setNewDutyXpDna(''); setNewDutyReqPos(['ALL']); setNewDutyIsBackup(false);
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

  const handleDropDuty = async (dropIdx) => {
     if (draggedDutyIdx === null || draggedDutyIdx === dropIdx) return;
     const nd = JSON.parse(JSON.stringify(branchData));
     const dutiesList = nd.duties[activeDept];
     const draggedItem = dutiesList[draggedDutyIdx];
     dutiesList.splice(draggedDutyIdx, 1);
     dutiesList.splice(dropIdx, 0, draggedItem);
     setBranchData(nd);
     setDraggedDutyIdx(null);
     if (activeBranchId) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
     }
  };

  const startEditStaff = (staff) => { setEditingStaffId(staff.id); setEditStaffData({ ...staff }); };
  const saveEditStaff = () => { setBranchData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === editingStaffId ? editStaffData : s) })); setEditingStaffId(null); };
  const startEditBranch = (branch) => { setEditingBranchId(branch.id); setEditBranchData({ ...branch }); };
  const saveEditBranch = () => { setGlobalConfig(prev => ({ ...prev, branches: prev.branches.map(b => b.id === editingBranchId ? editBranchData : b) })); setEditingBranchId(null); };

  const handleUpdateDayOffLimit = async (dayId, limit) => {
      const newLimit = limit === '' ? 99 : parseInt(limit);
      const nd = JSON.parse(JSON.stringify(branchData));
      if (!nd.dayOffLimits) nd.dayOffLimits = {};
      if (!nd.dayOffLimits.service) nd.dayOffLimits.service = { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99 };
      if (!nd.dayOffLimits.kitchen) nd.dayOffLimits.kitchen = { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99 };
      nd.dayOffLimits[activeDept][dayId] = newLimit;
      setBranchData(nd);
      if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
  };

  const handleUpdateStaffLimit = async (catId, limit) => {
      const newLimit = limit === '' ? null : parseInt(limit);
      const nd = JSON.parse(JSON.stringify(branchData));
      if (!nd.staffLimits) nd.staffLimits = {};
      nd.staffLimits[catId] = newLimit;
      setBranchData(nd);
      if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
  };

  const handleAutoAssignDayOffs = async () => {
      const nd = JSON.parse(JSON.stringify(branchData));
      const limits = nd.dayOffLimits; // Now { service: {...}, kitchen: {...} }
      const counts = { service: {}, kitchen: {} };
      (nd.staff || []).forEach(s => {
          if (s.regularDayOff !== null && s.regularDayOff !== undefined) {
              const dept = s.dept || 'service';
              counts[dept][s.regularDayOff] = (counts[dept][s.regularDayOff] || 0) + 1;
          }
      });
      let changed = false;
      (nd.staff || []).forEach(s => {
          if (s.regularDayOff === null || s.regularDayOff === undefined || s.regularDayOff === '') {
              const dept = s.dept || 'service';
              const deptLimits = limits[dept];
              const deptCounts = counts[dept];
              const daysOrder = [1, 2, 3, 4, 5, 6, 0];
              for (let dayId of daysOrder) {
                  if ((deptCounts[dayId] || 0) < deptLimits[dayId]) {
                      s.regularDayOff = dayId;
                      deptCounts[dayId] = (deptCounts[dayId] || 0) + 1;
                      changed = true; break;
                  }
              }
          }
      });
      if (changed) {
          setBranchData(nd);
          if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
          setConfirmModal({ message: 'จัดวันหยุดอัตโนมัติสำเร็จ!' });
      } else setConfirmModal({ message: 'ไม่มีพนักงานที่ต้องการจัดวันหยุด หรือโควตาวันหยุดเต็มทั้งหมดแล้ว' });
  };

  const handleDropShiftPreset = async (dropIdx) => {
    if (draggedShiftPresetIdx === null || draggedShiftPresetIdx === dropIdx) return;
    const nd = JSON.parse(JSON.stringify(branchData));
    const presetsList = nd.shiftPresets || [];
    const draggedItem = presetsList[draggedShiftPresetIdx];
    presetsList.splice(draggedShiftPresetIdx, 1);
    presetsList.splice(dropIdx, 0, draggedItem);
    setBranchData(nd);
    setDraggedShiftPresetIdx(null);
    if (activeBranchId) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
    }
  };

  const handleAddShiftPreset = () => {
      const newPreset = {
          id: 'S' + Date.now(),
          name: 'กะใหม่',
          timings: { long: { startTime: '10:00', endTime: '19:30' }, short: { startTime: '10:00', endTime: '19:00' } }
      };
      setBranchData(prev => ({...prev, shiftPresets: [...(prev.shiftPresets || []), newPreset]}));
  };

  const handleUpdateShiftPreset = (id, field, value, group = null) => {
      setBranchData(prev => {
          const nd = JSON.parse(JSON.stringify(prev));
          if (!nd.shiftPresets) nd.shiftPresets = [];
          const preset = nd.shiftPresets.find(p => p.id === id);
          if (preset) {
              if (group) {
                  if (!preset.timings) preset.timings = { long: {}, short: {} };
                  if (!preset.timings[group]) preset.timings[group] = {};
                  preset.timings[group][field] = value;
              } else {
                  preset[field] = value;
              }
          }
          return nd;
      });
  };

  const handleDeleteShiftPreset = async (id) => {
      if (branchData.shiftPresets?.length <= 1) {
          setConfirmModal({ message: "ไม่สามารถลบกะสุดท้ายได้ ต้องมีอย่างน้อย 1 กะในระบบ" });
          return;
      }
      let isUsed = Object.values(branchData.matrix || {}).some(dayType => 
          dayType?.duties && Object.values(dayType.duties).some(slots => 
              Array.isArray(slots) && slots.some(s => s.shiftPresetId === id)
          )
      );
      if (isUsed) {
          setConfirmModal({ message: "ไม่สามารถลบกะนี้ได้ เนื่องจากมีการใช้งานอยู่ในโครงสร้างกะงาน (CYCLE)" });
          return;
      }
      const nd = { ...branchData, shiftPresets: (branchData.shiftPresets || []).filter(p => p.id !== id) };
      setBranchData(nd);
      if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
  };

  const handleAddAnnouncement = async () => {
      if (!newAnnTitle.trim()) return;
      const newAnn = { id: 'A'+Date.now(), title: newAnnTitle, content: newAnnContent, imageUrl: newAnnImage, isActive: true, startDate: newAnnStartDate, endDate: newAnnEndDate };
      const nd = {...branchData, announcements: [...(branchData.announcements || []), newAnn]};
      setBranchData(nd);
      if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
      setNewAnnTitle(''); setNewAnnContent(''); setNewAnnImage(''); setNewAnnStartDate(''); setNewAnnEndDate('');
  };

  const handleDeleteAnnouncement = async (id) => {
      const nd = {...branchData, announcements: branchData.announcements.filter(a => a.id !== id)};
      setBranchData(nd);
      if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
  };

  const handleToggleAnnouncement = async (id, isActive) => {
      const nd = {...branchData, announcements: branchData.announcements.map(a => a.id === id ? {...a, isActive} : a)};
      setBranchData(nd);
      if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
  };

  const handleFormatContent = (tagStart, tagEnd, editorId, textValue, setTextValue) => {
      const textarea = document.getElementById(editorId);
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textValue.substring(0, start);
      const selected = textValue.substring(start, end);
      const after = textValue.substring(end, textValue.length);
      
      setTextValue(before + tagStart + selected + tagEnd + after);
      
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tagStart.length, end + tagStart.length);
      }, 0);
  };

  const renderRichTextToolbar = (editorId, textValue, setTextValue) => (
      <div className="flex flex-wrap gap-1 bg-slate-100 p-2 rounded-t-xl border border-slate-200 border-b-0 items-center">
          <button type="button" onClick={() => handleFormatContent('<b>', '</b>', editorId, textValue, setTextValue)} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="ตัวหนา"><Bold className="w-4 h-4"/></button>
          <button type="button" onClick={() => handleFormatContent('<i>', '</i>', editorId, textValue, setTextValue)} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="ตัวเอียง"><Italic className="w-4 h-4"/></button>
          <button type="button" onClick={() => handleFormatContent('<u>', '</u>', editorId, textValue, setTextValue)} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="ขีดเส้นใต้"><Underline className="w-4 h-4"/></button>
          <div className="w-px h-5 bg-slate-300 mx-1"></div>
          <button type="button" onClick={() => handleFormatContent('<span style="color: #ef4444;">', '</span>', editorId, textValue, setTextValue)} className="w-5 h-5 rounded-md bg-red-500 hover:scale-110 transition shadow-sm" title="สีแดง"></button>
          <button type="button" onClick={() => handleFormatContent('<span style="color: #f59e0b;">', '</span>', editorId, textValue, setTextValue)} className="w-5 h-5 rounded-md bg-amber-500 hover:scale-110 transition shadow-sm" title="สีส้ม"></button>
          <button type="button" onClick={() => handleFormatContent('<span style="color: #10b981;">', '</span>', editorId, textValue, setTextValue)} className="w-5 h-5 rounded-md bg-emerald-500 hover:scale-110 transition shadow-sm" title="สีเขียว"></button>
          <button type="button" onClick={() => handleFormatContent('<span style="color: #3b82f6;">', '</span>', editorId, textValue, setTextValue)} className="w-5 h-5 rounded-md bg-blue-500 hover:scale-110 transition shadow-sm" title="สีน้ำเงิน"></button>
          <button type="button" onClick={() => handleFormatContent('<span style="color: #8b5cf6;">', '</span>', editorId, textValue, setTextValue)} className="w-5 h-5 rounded-md bg-indigo-500 hover:scale-110 transition shadow-sm" title="สีม่วง"></button>
          <div className="w-px h-5 bg-slate-300 mx-1"></div>
          <button type="button" onClick={() => handleFormatContent('<span style="font-size: 24px; font-weight: 900;">', '</span>', editorId, textValue, setTextValue)} className="px-2 py-1 text-slate-700 hover:bg-white hover:shadow-sm rounded text-[11px] font-black transition" title="หัวข้อใหญ่">H1</button>
          <button type="button" onClick={() => handleFormatContent('<span style="font-size: 20px; font-weight: 800;">', '</span>', editorId, textValue, setTextValue)} className="px-2 py-1 text-slate-700 hover:bg-white hover:shadow-sm rounded text-[11px] font-bold transition" title="หัวข้อกลาง">H2</button>
          <div className="w-px h-5 bg-slate-300 mx-1"></div>
          <button type="button" onClick={() => {
              const url = window.prompt('ใส่ URL ที่ต้องการลิงก์ไป (เช่น https://google.com):');
              if (url) handleFormatContent(`<a href="${url}" target="_blank" class="text-blue-600 underline hover:text-blue-800">`, '</a>', editorId, textValue, setTextValue);
          }} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="แทรกลิงก์"><LinkIcon className="w-4 h-4"/></button>
          <div className="w-px h-5 bg-slate-300 mx-1"></div>
          <button type="button" onClick={() => handleFormatContent('<br>', '', editorId, textValue, setTextValue)} className="px-2 py-1 text-slate-700 hover:bg-white hover:shadow-sm rounded text-[10px] font-bold transition" title="ขึ้นบรรทัดใหม่">↵ ปัดบรรทัด</button>
      </div>
  );

  const handleSaveGuide = async () => {
      const nc = { ...globalConfig, guideSteps: editGuideSteps, siteMap: editSiteMap, workflow: editWorkflow, guideHeader: editGuideHeader };
      setGlobalConfig(nc);
      setSaveStatus('saving');
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc);
          setIsEditingGuide(false);
          setSaveStatus('success');
          setTimeout(() => setSaveStatus(null), 1500);
      } catch (err) {
          setSaveStatus('error');
      }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { setConfirmModal({ message: "กรุณาตั้งชื่อแม่แบบ (Template Name) ก่อนบันทึก" }); return; }
    const newTemplate = { 
        id: 'T'+Date.now(), 
        name: `${templateName.trim()} (${globalConfig.branches?.find(b=>b.id===activeBranchId)?.name || 'Unknown'})`, 
        duties: branchData.duties,
        matrix: branchData.matrix,
        shiftPresets: branchData.shiftPresets,
        holidays: branchData.holidays,
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
    const tpl = globalTemplates.find(t => t.id === tplId);
    if (tpl) {
        setConfirmModal({ 
            message: `ยืนยันการโหลดแม่แบบ "${tpl.name}" ใช่หรือไม่? (โครงสร้างปัจจุบันจะถูกเขียนทับทั้งหมด)`, 
            action: () => { setBranchData(prev => ({ 
                ...prev, 
                duties: tpl.duties, 
                matrix: tpl.matrix,
                shiftPresets: tpl.shiftPresets || DEFAULT_SHIFT_PRESETS, // Fallback for old templates
                holidays: tpl.holidays || [] // Fallback for old templates
            })); }
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
               const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot?.shiftPresetId);
               const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);
               dutyTxt += `  - ${staff?.name} (${formatTimeAbbreviation(startTime)}-${formatTimeAbbreviation(endTime)})\n`;
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
               const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot?.shiftPresetId);
               const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);
               dutyTxt += `  - ${staff?.name} (${formatTimeAbbreviation(startTime)}-${formatTimeAbbreviation(endTime)})\n`;
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
      if (branchData.holidays?.includes?.(dateStr)) {
          setConfirmModal({ message: 'ระบบไม่อนุญาตให้ลาหยุดในวันหยุดประจำสาขาได้' });
          return;
      }
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
              const mSlot = matrixSlots[idx];
              const shiftPreset = branchData.shiftPresets?.find(p => p.id === mSlot?.shiftPresetId);
              if (staff && shiftPreset) {
                  const { startTime, endTime } = getShiftTimesForStaff(staff.pos, shiftPreset);
                  rows.push([ dateStr, staff.empId || '-', staff.name, staff.dept, staff.pos, startTime, endTime, assigned.otHours || 0 ]);
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

  const handleExportMonthlyRoster = () => {
    const headers = ['แผนก', 'ตำแหน่ง', 'ชื่อพนักงาน', ...CALENDAR_DAYS.map(d => `${d.dayNum} ${d.dayLabel}`)];
    const rows = [];
    const filteredStaff = branchData.staff?.filter(s => s.dept === activeDept) || [];
    const sortedStaff = [...filteredStaff].sort((a, b) => {
        const rankA = POSITIONS[activeDept].indexOf(a.pos);
        const rankB = POSITIONS[activeDept].indexOf(b.pos);
        return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    });

    DUTY_CATEGORIES[activeDept].forEach(cat => {
        const catStaff = sortedStaff.filter(s => getStaffLayer(s.dept, s.pos).id === cat.id);
        catStaff.forEach(s => {
            const rowData = [cat.label.replace('Customer Service ', '').replace('Kitchen ', ''), s.pos, s.name];
            CALENDAR_DAYS.forEach(day => {
                const info = getStaffDayInfo(s.id, day.dateStr, CURRENT_DUTY_LIST);
                if (info?.type === 'work') rowData.push(`${formatTimeAbbreviation(info.slot.startTime)}${info.actual?.otHours > 0 ? ` (O${info.actual.otHours})` : ''}`);
                else if (info?.type === 'leave') rowData.push(info.info.shortLabel);
                else rowData.push('OFF');
            });
            rows.push(rowData);
        });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `Roster_Schedule_${activeDept}_${THAI_MONTHS[selectedMonth]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleAutoAssign = (mode = 'daily') => {
    setAiLoading(true);
    setTimeout(() => {
        setSchedule(prevSched => {
            const newSched = JSON.parse(JSON.stringify(prevSched));
            const datesToProcess = mode === 'daily' ? [selectedDateStr] : CALENDAR_DAYS.map(d => d.dateStr);

            const staffOTCount = {};
            const staffDutyCounts = {};
            branchData.staff?.forEach(s => { staffOTCount[s.id] = 0; staffDutyCounts[s.id] = {}; });
            
            Object.keys(newSched).forEach(d => {
                if (datesToProcess.includes(d)) return;
                const dayData = newSched[d];
                if (dayData.duties) {
                    Object.entries(dayData.duties).forEach(([dutyId, slots]) => {
                        // หา Category ของหน้าที่นี้ เพื่อใช้นับรอบการหมุนเวียนในระดับเดียวกัน
                        const dObj = CURRENT_DUTY_LIST.find(x => x.id === dutyId);
                        const dCat = dObj ? dObj.category : 'OTHER';
                        slots.forEach(s => {
                            if (s.staffId) {
                                staffOTCount[s.staffId] += (s.otHours || 0);
                                if (!staffDutyCounts[s.staffId]) staffDutyCounts[s.staffId] = {};
                                staffDutyCounts[s.staffId][dCat] = (staffDutyCounts[s.staffId][dCat] || 0) + 1;
                            }
                        });
                    });
                }
            });

            datesToProcess.forEach(dateStr => {
                const dayConfig = CALENDAR_DAYS.find(c => c.dateStr === dateStr);
                const dayType = dayConfig ? dayConfig.type : 'weekday';
                if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
                const dayData = newSched[dateStr];
                
                // 1. Clear previous duty assignments for this day (เฉพาะแผนกที่เลือก)
                if (!dayData.duties) dayData.duties = {};
                CURRENT_DUTY_LIST.forEach(d => {
                    delete dayData.duties[d.id];
                });

                // 2. Consolidate leaves, including regular days off
                const [y, m, d] = dateStr.split('-').map(Number);
                const dateObj = new Date(y, m - 1, d);
                const dayOfWeek = dateObj.getDay();
                
                const manuallyOnLeaveIds = new Set((dayData.leaves || []).map(l => l.staffId));
                const isHoliday = branchData.holidays?.includes?.(dateStr);
                const regularOffStaff = isHoliday ? [] : branchData.staff?.filter(s => s.regularDayOff === dayOfWeek) || [];
                
                let finalLeaves = [...(dayData.leaves || [])];
                regularOffStaff.forEach(staff => {
                    if (!manuallyOnLeaveIds.has(staff.id)) {
                        if (!finalLeaves.some(l => l.staffId === staff.id)) {
                           finalLeaves.push({ staffId: staff.id, type: 'OFF' });
                        }
                    }
                });
                dayData.leaves = finalLeaves;
                dayData.autoLeavesAssigned = true; 

                const onLeaveIds = new Set(finalLeaves.map(l => l.staffId));
                const workingStaffIds = new Set(); 

                // 3. Sort duties by priority: HEAD > STAFF > SUPPORT, then by highest required position
                const dutyPriority = { 'HEAD': 1, 'STAFF': 2, 'SUPPORT': 3 };
                const sortedDuties = [...CURRENT_DUTY_LIST].sort((a, b) => {
                    // Priority 0: Primary Duties first, Backup Duties last
                    const aBackup = a.isBackup ? 1 : 0;
                    const bBackup = b.isBackup ? 1 : 0;
                    if (aBackup !== bBackup) return aBackup - bBackup;

                    const getCat = (catStr) => (catStr || '').split('_')[1] || 'OTHER';
                    const priorityA = dutyPriority[getCat(a.category)] || 99;
                    const priorityB = dutyPriority[getCat(b.category)] || 99;
                    if (priorityA !== priorityB) return priorityA - priorityB;

                    // Secondary sort: prioritize duties that require higher-ranked staff
                    const getHighestRank = (reqPosArr) => {
                        if (!reqPosArr || reqPosArr.length === 0 || reqPosArr.includes('ALL')) return 999;
                        const posList = POSITIONS[activeDept] || [];
                        const ranks = reqPosArr.map(p => posList.indexOf(p)).filter(r => r !== -1);
                        return ranks.length > 0 ? Math.min(...ranks) : 999;
                    };

                    const rankA = getHighestRank(a.reqPos);
                    const rankB = getHighestRank(b.reqPos);
                    return rankA - rankB;
                });

                // 4. Get available staff, sorted by rank (highest first)
                const availableStaff = (branchData.staff || [])
                    .filter(s => s.dept === activeDept && !onLeaveIds.has(s.id))
                    .sort((a, b) => {
                        const posList = POSITIONS[activeDept] || [];
                        const rankA = posList.indexOf(a.pos);
                        const rankB = posList.indexOf(b.pos);
                        return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
                    });

                // 5. Iterate through sorted duties and assign the best available staff
                sortedDuties.forEach(duty => {
                    const slots = branchData.matrix?.[dayType]?.duties?.[duty.id] || [];
                    if (!dayData.duties[duty.id]) dayData.duties[duty.id] = [];

                    slots.forEach((slot, slotIdx) => {
                        if (!dayData.duties[duty.id][slotIdx]) {
                            dayData.duties[duty.id][slotIdx] = { staffId: "", otHours: 0 };
                        }
                        if (dayData.duties[duty.id][slotIdx].staffId) return; 

                        const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                        
                        let candidate = null;
                        
                        const potentialCandidates = availableStaff.filter(s => 
                            !workingStaffIds.has(s.id) && 
                            checkPositionEligibility(s.pos, reqArr, activeDept)
                        );

                        if (potentialCandidates.length > 0) {
                            const isOTSlot = (slot.maxOtHours || 0) > 0;
                            let validCandidates = potentialCandidates;
                            
                            // Exclude HEAD team from OT slots entirely
                            if (isOTSlot) {
                                validCandidates = potentialCandidates.filter(p => {
                                    const layer = getStaffLayer(activeDept, p.pos);
                                    return !layer.id.includes('HEAD');
                                });
                            }
                            
                            if (validCandidates.length > 0) {
                                // Sort candidates
                                validCandidates.sort((a, b) => {
                                    if (isOTSlot) {
                                        const otDiff = staffOTCount[a.id] - staffOTCount[b.id];
                                        if (otDiff !== 0) return otDiff; // Priority 1: Least accumulated OT (หมุนเวียน OT ให้เท่ากัน)
                                    }

                                    const aDirect = reqArr.includes(a.pos) ? 1 : 0;
                                    const bDirect = reqArr.includes(b.pos) ? 1 : 0;
                                    
                                    const aIsFixed = ["OC", "AOC"].includes(a.pos);
                                    const bIsFixed = ["OC", "AOC"].includes(b.pos);

                                    // Priority 2: Fix Logic (Direct Match) for OC/AOC
                                    if (aIsFixed || bIsFixed) {
                                        if (aDirect !== bDirect) return bDirect - aDirect;
                                    } else {
                                        // Priority 2: Duty Category Rotation for others (Least assigned to THIS CATEGORY)
                                        const countA = staffDutyCounts[a.id]?.[duty.category] || 0;
                                        const countB = staffDutyCounts[b.id]?.[duty.category] || 0;
                                        if (countA !== countB) return countA - countB;
                                    }

                                    // Priority 3: Fallback to Direct Match for non-fixed if rotation is tied
                                    if (!aIsFixed && !bIsFixed) {
                                        if (aDirect !== bDirect) return bDirect - aDirect;
                                    }
                                    
                                    // Priority 4: Rank
                                    const posList = POSITIONS[activeDept] || [];
                                    const rankA = posList.indexOf(a.pos);
                                    const rankB = posList.indexOf(b.pos);
                                    if (aDirect && bDirect) {
                                        if (rankA !== rankB) return rankA - rankB; // Highest rank first
                                    } else {
                                        if (rankA !== rankB) return rankB - rankA; // Lowest rank first
                                    }
                                    
                                    // Priority 5: Random Rotation (สุ่มคนลงเมื่อเงื่อนไขทั้งหมดเท่ากัน)
                                    return Math.random() - 0.5;
                                });

                                candidate = validCandidates[0];
                            }
                        }

                        if (candidate) {
                            dayData.duties[duty.id][slotIdx].staffId = candidate.id;
                            
                            const layer = getStaffLayer(activeDept, candidate.pos);
                            const giveOT = !layer.id.includes('HEAD') && (slot.maxOtHours || 0) > 0;
                            const assignedOT = giveOT ? slot.maxOtHours : 0;
                            
                            dayData.duties[duty.id][slotIdx].otHours = assignedOT;
                            dayData.duties[duty.id][slotIdx].otUpdated = true;
                            workingStaffIds.add(candidate.id);
                            
                            if (assignedOT > 0) {
                                staffOTCount[candidate.id] += assignedOT;
                            }

                            if (!staffDutyCounts[candidate.id]) staffDutyCounts[candidate.id] = {};
                            staffDutyCounts[candidate.id][duty.category] = (staffDutyCounts[candidate.id][duty.category] || 0) + 1;
                        }
                    });
                });
            });
            setAiLoading(false);
            if (activeBranchId) autoSaveSchedule(newSched);
            return newSched;
        });
    }, 500); 
  };

  const handleClearSchedule = (mode = 'daily') => {
      setSchedule(prevSched => {
          const newSched = JSON.parse(JSON.stringify(prevSched));
          const datesToProcess = mode === 'daily' ? [selectedDateStr] : CALENDAR_DAYS.map(d => d.dateStr);
          datesToProcess.forEach(dateStr => { 
              if (newSched[dateStr] && newSched[dateStr].duties) {
                  CURRENT_DUTY_LIST.forEach(d => {
                      delete newSched[dateStr].duties[d.id];
                  });
              } 
          });
          if (activeBranchId) autoSaveSchedule(newSched);
          return newSched;
      });
  };

  const handleInspectBranch = async (branchId) => {
    setInspectorBranchId(branchId);
    setInspectorBackups([]);
    if (!branchId) {
        setInspectedData({ branch: null, schedule: null, loading: false, error: null });
        return;
    }
    if (branchId === 'GLOBAL') {
        setInspectedData({ branch: null, schedule: null, loading: false, error: null });
        setInspectorTab('guides');
        return;
    }
    setInspectorTab('staff');
    setInspectedData({ branch: null, schedule: null, loading: true, error: null });
    try {
        const branchDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'branches', branchId);
        const scheduleDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', branchId);
        
        const branchSnap = await getDoc(branchDocRef);
        const scheduleSnap = await getDoc(scheduleDocRef);

        setInspectedData({
            branch: branchSnap.exists() ? branchSnap.data() : { error: 'No branch data found.' },
            schedule: scheduleSnap.exists() ? scheduleSnap.data() : { error: 'No schedule data found.' },
            loading: false,
            error: null
        });
    } catch (e) {
        setInspectedData({ branch: null, schedule: null, loading: false, error: e.message });
    }
  };

  const handleResetBranchData = async (branchId) => {
    if (!branchId) return;
    const branchToReset = globalConfig.branches.find(b => b.id === branchId);
    const originalStaff = inspectedData.branch?.staff || [];
    const resetData = { 
        staff: originalStaff, holidays: [], duties: { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES }, 
        matrix: generateDefaultMatrix(), templates: [], dayOffLimits: { 
            service: { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99 },
            kitchen: { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99 }
        },
        staffLimits: {}
    };
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', branchId), resetData);
        setConfirmModal({ message: `Branch data for "${branchToReset?.name}" has been reset successfully (staff list was preserved).` });
        handleInspectBranch(branchId);
    } catch (e) { setConfirmModal({ message: `Error resetting branch data: ${e.message}` }); }
  };

  const handleClearScheduleData = async (branchId) => {
    if (!branchId) return;
    const branchToReset = globalConfig.branches.find(b => b.id === branchId);
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', branchId), { records: {} });
        setConfirmModal({ message: `Schedule data for "${branchToReset?.name}" has been cleared.` });
        handleInspectBranch(branchId);
    } catch (e) { setConfirmModal({ message: `Error clearing schedule data: ${e.message}` }); }
  };

  const loadBackups = async (branchId) => {
      if (!branchId) return;
      setInspectedData(prev => ({ ...prev, loadingBackups: true }));
      try {
          const promises = [];
          for(let i=1; i<=31; i++) {
              promises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'backups', `${branchId}_day_${i}`)));
          }
          const snaps = await Promise.all(promises);
          const backups = snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })).sort((a,b) => b.timestamp - a.timestamp);
          setInspectorBackups(backups);
      } catch (e) {
          console.error("Error loading backups", e);
      } finally {
          setInspectedData(prev => ({ ...prev, loadingBackups: false }));
      }
  };

  const handleRestoreBackup = async (backup, mode) => {
      if(!backup || !backup.branchData || !backup.schedule) return;
      try {
          if (mode === 'all' || mode === 'branch') {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', inspectorBranchId), backup.branchData);
          }
          if (mode === 'all' || mode === 'schedule') {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', inspectorBranchId), { records: backup.schedule });
          }
          setConfirmModal({ message: `กู้คืนข้อมูล (${mode === 'all' ? 'ทั้งหมด' : mode === 'schedule' ? 'เฉพาะกะงาน' : 'เฉพาะข้อมูลสาขา'}) ของวันที่ ${backup.backupDate} สำเร็จแล้ว!` });
          handleInspectBranch(inspectorBranchId);
      } catch(e) { setConfirmModal({ message: `การกู้คืนล้มเหลว: ${e.message}` }); }
  };

  const scrollDates = (dir) => {
    if (dateBarRef.current) {
      const amt = dir === 'left' ? -350 : 350;
      dateBarRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  // === RENDER DECLARATION HELPER COMPONENTS ===

  function renderDataInspectorModal() {
    const activeTabs = inspectorBranchId === 'GLOBAL' ? ['guides', 'templates', 'raw_global'] : ['staff', 'duties', 'holidays', 'announcements', 'schedule', 'backups', 'raw'];

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300 font-sans">
            <div className="bg-slate-800 text-white rounded-2xl p-6 max-w-6xl w-full shadow-2xl flex flex-col gap-4 max-h-[90vh]">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-black uppercase tracking-wider">Server Data Inspector</h3>
                    <button onClick={() => setShowDataInspector(false)} className="text-slate-400 hover:bg-slate-700 p-2 rounded-full transition"><X className="w-6 h-6"/></button>
                </div>
                <div className="flex gap-4 items-center">
                    <select onChange={(e) => handleInspectBranch(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm font-bold outline-none flex-1">
                        <option value="">-- Select a Branch to Inspect --</option>
                        <option value="GLOBAL">🌐 GLOBAL DATA (Guides, Configs, Templates)</option>
                        {globalConfig.branches?.map(b => <option key={b.id} value={b.id}>🏠 {b.name}</option>)}
                    </select>
                    {inspectorBranchId && inspectorBranchId !== 'GLOBAL' && (
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmModal({ message: 'This will ERASE and RESET the main data (duties, matrix) for this branch, keeping only the staff list. Are you sure?', action: () => handleResetBranchData(inspectorBranchId) })} className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-xs font-black hover:bg-yellow-400 transition">Reset Branch Data</button>
                            <button onClick={() => setConfirmModal({ message: 'This will ERASE ALL schedule entries for this branch. Are you sure?', action: () => handleClearScheduleData(inspectorBranchId) })} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-black hover:bg-red-500 transition">Clear Schedule</button>
                        </div>
                    )}
                </div>
                
                {inspectorBranchId && (
                <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto custom-scrollbar flex-shrink-0">
                    {activeTabs.map(tab => (
                        <button key={tab} onClick={() => { 
                            setInspectorTab(tab); 
                            if (tab === 'backups' && inspectorBackups.length === 0) loadBackups(inspectorBranchId);
                        }} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition whitespace-nowrap ${inspectorTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>
                )}

                <div className="flex-1 overflow-hidden flex flex-col">
                    {inspectedData.loading ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin"/></div>
                    ) : inspectedData.error ? (
                        <div className="flex-1 flex items-center justify-center text-red-400">Error: {inspectedData.error}</div>
                    ) : !inspectorBranchId ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest">Please select a branch to view data.</div>
                    ) : inspectorBranchId === 'GLOBAL' ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900 rounded-xl border border-slate-700 p-0 sm:p-4">
                            {inspectorTab === 'guides' && (
                                <div className="flex flex-col gap-6 p-4">
                                    <div className="bg-black/20 p-4 rounded-xl border border-slate-700">
                                        <h4 className="font-black text-emerald-400 mb-3 uppercase tracking-widest text-xs border-b border-slate-700 pb-2">Guide Steps (Manager Journey)</h4>
                                        <table className="w-full text-left text-xs border-collapse">
                                           <thead>
                                              <tr><th className="p-2 border-b border-slate-600 w-12">Step</th><th className="p-2 border-b border-slate-600">Title</th><th className="p-2 border-b border-slate-600">Color</th><th className="p-2 border-b border-slate-600">Has Image</th></tr>
                                           </thead>
                                           <tbody>
                                              {(globalConfig.guideSteps || []).map(g => (
                                                  <tr key={g.id} className="hover:bg-slate-800/50">
                                                      <td className="p-2 border-b border-slate-700/50 font-black text-slate-300">{g.stepNum}</td>
                                                      <td className="p-2 border-b border-slate-700/50 font-bold text-sky-300">{g.title}</td>
                                                      <td className="p-2 border-b border-slate-700/50"><span className={`px-2 py-0.5 rounded text-[9px] ${g.color}`}>{g.color}</span></td>
                                                      <td className="p-2 border-b border-slate-700/50 text-slate-400">{g.image ? 'Yes' : 'No'}</td>
                                                  </tr>
                                              ))}
                                           </tbody>
                                        </table>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-slate-700">
                                        <h4 className="font-black text-orange-400 mb-3 uppercase tracking-widest text-xs border-b border-slate-700 pb-2">Site Map</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {(globalConfig.siteMap || []).map(sm => (
                                                <div key={sm.id} className="bg-slate-800 p-3 rounded-lg border border-slate-600">
                                                    <div className={`font-black text-sm mb-2 ${sm.color}`}>{sm.title}</div>
                                                    <ul className="list-disc list-inside text-[10px] text-slate-300 space-y-1">
                                                        {(sm.items || []).map((it, i) => <li key={i}>{it}</li>)}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-slate-700">
                                        <h4 className="font-black text-indigo-400 mb-3 uppercase tracking-widest text-xs border-b border-slate-700 pb-2">Workflow</h4>
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Monthly</span>
                                                <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                                                    {(globalConfig.workflow?.monthly || []).map(w => <span key={w.id} className="bg-slate-700 px-2 py-1 rounded text-slate-300 whitespace-pre-wrap">{w.text}</span>)}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Daily</span>
                                                <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                                                    {(globalConfig.workflow?.daily || []).map(w => <span key={w.id} className="bg-slate-700 px-2 py-1 rounded text-slate-300 whitespace-pre-wrap">{w.text}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {inspectorTab === 'templates' && (
                                <table className="w-full text-left text-xs border-collapse">
                                   <thead className="sticky top-0 bg-slate-800 shadow-md">
                                      <tr><th className="p-3 border-b border-slate-600 w-24">ID</th><th className="p-3 border-b border-slate-600">Template Name</th><th className="p-3 border-b border-slate-600 text-center">Duties</th><th className="p-3 border-b border-slate-600 text-center">Presets</th></tr>
                                   </thead>
                                   <tbody>
                                      {globalTemplates?.length ? globalTemplates.map(t => (
                                          <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                                              <td className="p-3 border-b border-slate-700/50 text-slate-400">{t.id}</td>
                                              <td className="p-3 border-b border-slate-700/50 font-black text-emerald-300">{t.name}</td>
                                              <td className="p-3 border-b border-slate-700/50 text-center font-bold text-slate-300">S: {t.duties?.service?.length||0} / K: {t.duties?.kitchen?.length||0}</td>
                                              <td className="p-3 border-b border-slate-700/50 text-center font-bold text-slate-300">{t.shiftPresets?.length||0}</td>
                                          </tr>
                                      )) : <tr><td colSpan="4" className="p-4 text-center text-slate-500">No templates found</td></tr>}
                                   </tbody>
                                </table>
                            )}
                            {inspectorTab === 'raw_global' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full p-4">
                                    <div className="flex flex-col h-full"><h4 className="font-bold text-slate-400 mb-2">Master Config Document</h4><pre className="text-[10px] text-slate-300 overflow-auto custom-scrollbar bg-black/30 p-4 rounded-xl flex-1">{JSON.stringify(globalConfig, null, 2)}</pre></div>
                                    <div className="flex flex-col h-full"><h4 className="font-bold text-slate-400 mb-2">Templates Document</h4><pre className="text-[10px] text-slate-300 overflow-auto custom-scrollbar bg-black/30 p-4 rounded-xl flex-1">{JSON.stringify(globalTemplates, null, 2)}</pre></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900 rounded-xl border border-slate-700 p-0 sm:p-4">
                            {inspectorTab === 'staff' && (
                                <table className="w-full text-left text-xs border-collapse">
                                   <thead className="sticky top-0 bg-slate-800 shadow-md">
                                      <tr><th className="p-3 border-b border-slate-600">ID</th><th className="p-3 border-b border-slate-600">Emp ID</th><th className="p-3 border-b border-slate-600">Name</th><th className="p-3 border-b border-slate-600">Dept</th><th className="p-3 border-b border-slate-600">Position</th><th className="p-3 border-b border-slate-600">Day Off</th></tr>
                                   </thead>
                                   <tbody>
                                      {inspectedData.branch?.staff?.length ? inspectedData.branch.staff.map(s => (
                                          <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                                              <td className="p-3 border-b border-slate-700/50 text-slate-400">{s.id}</td>
                                              <td className="p-3 border-b border-slate-700/50">{s.empId || '-'}</td>
                                              <td className="p-3 border-b border-slate-700/50 font-black text-indigo-300">{s.name}</td>
                                              <td className="p-3 border-b border-slate-700/50">{s.dept === 'service' ? 'FOH' : 'BOH'}</td>
                                              <td className="p-3 border-b border-slate-700/50"><span className="bg-slate-700 px-2 py-1 rounded font-bold">{s.pos}</span></td>
                                              <td className="p-3 border-b border-slate-700/50">{s.regularDayOff !== null && s.regularDayOff !== undefined ? ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][s.regularDayOff] : '-'}</td>
                                          </tr>
                                      )) : <tr><td colSpan="6" className="p-4 text-center text-slate-500">No staff data</td></tr>}
                                   </tbody>
                                </table>
                            )}
                            {inspectorTab === 'duties' && (
                                <table className="w-full text-left text-xs border-collapse">
                                   <thead className="sticky top-0 bg-slate-800 shadow-md">
                                      <tr><th className="p-3 border-b border-slate-600">Dept</th><th className="p-3 border-b border-slate-600">ID</th><th className="p-3 border-b border-slate-600">Category</th><th className="p-3 border-b border-slate-600">Job A</th><th className="p-3 border-b border-slate-600">Job B</th><th className="p-3 border-b border-slate-600">Req Pos</th></tr>
                                   </thead>
                                   <tbody>
                                      {['service', 'kitchen'].flatMap(dept => 
                                          (inspectedData.branch?.duties?.[dept] || []).map(d => (
                                              <tr key={d.id} className="hover:bg-slate-800/50 transition-colors">
                                                  <td className="p-3 border-b border-slate-700/50 uppercase text-slate-400 font-bold">{dept}</td>
                                                  <td className="p-3 border-b border-slate-700/50 text-slate-400">{d.id}</td>
                                                  <td className="p-3 border-b border-slate-700/50"><span className="bg-slate-700 px-2 py-1 rounded text-[10px] font-bold">{d.category.replace('FOH_', '').replace('BOH_', '')}</span></td>
                                                  <td className="p-3 border-b border-slate-700/50 font-black text-emerald-300">{d.jobA}</td>
                                                  <td className="p-3 border-b border-slate-700/50 text-slate-300">{d.jobB}</td>
                                                  <td className="p-3 border-b border-slate-700/50 text-slate-400 text-[10px]">{(d.reqPos || []).join(', ')}</td>
                                              </tr>
                                          ))
                                      )}
                                   </tbody>
                                </table>
                            )}
                            {inspectorTab === 'holidays' && (
                                <table className="w-full text-left text-xs border-collapse">
                                   <thead className="sticky top-0 bg-slate-800 shadow-md">
                                      <tr><th className="p-3 border-b border-slate-600 w-16">#</th><th className="p-3 border-b border-slate-600">Holiday Date</th></tr>
                                   </thead>
                                   <tbody>
                                      {inspectedData.branch?.holidays?.length ? inspectedData.branch.holidays.sort().map((h, i) => (
                                          <tr key={h} className="hover:bg-slate-800/50 transition-colors">
                                              <td className="p-3 border-b border-slate-700/50 text-slate-500 font-bold">{i + 1}</td>
                                              <td className="p-3 border-b border-slate-700/50 font-black text-orange-300">{h}</td>
                                          </tr>
                                      )) : <tr><td colSpan="2" className="p-4 text-center text-slate-500">No holidays assigned</td></tr>}
                                   </tbody>
                                </table>
                            )}
                            {inspectorTab === 'announcements' && (
                                <table className="w-full text-left text-xs border-collapse">
                                   <thead className="sticky top-0 bg-slate-800 shadow-md">
                                      <tr><th className="p-3 border-b border-slate-600 w-24">ID</th><th className="p-3 border-b border-slate-600 min-w-[150px]">Title</th><th className="p-3 border-b border-slate-600 text-center w-24">Status</th><th className="p-3 border-b border-slate-600 w-32">Duration</th><th className="p-3 border-b border-slate-600">Content (Excerpt)</th></tr>
                                   </thead>
                                   <tbody>
                                      {inspectedData.branch?.announcements?.length ? inspectedData.branch.announcements.map(a => (
                                          <tr key={a.id} className="hover:bg-slate-800/50 transition-colors">
                                              <td className="p-3 border-b border-slate-700/50 text-slate-400">{a.id}</td>
                                              <td className="p-3 border-b border-slate-700/50 font-black text-indigo-300 truncate max-w-[150px]">{a.title}</td>
                                              <td className="p-3 border-b border-slate-700/50 text-center">
                                                  <span className={`px-2 py-1 rounded font-bold text-[9px] ${a.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>{a.isActive ? 'ACTIVE' : 'HIDDEN'}</span>
                                              </td>
                                              <td className="p-3 border-b border-slate-700/50 text-slate-400 text-[9px]">{a.startDate || 'Any'} <br/> {a.endDate || 'Any'}</td>
                                              <td className="p-3 border-b border-slate-700/50 text-slate-400 truncate max-w-[200px] text-[10px]">{a.content?.replace(/<[^>]*>?/gm, '')}</td>
                                          </tr>
                                      )) : <tr><td colSpan="5" className="p-4 text-center text-slate-500">No announcements data</td></tr>}
                                   </tbody>
                                </table>
                            )}
                            {inspectorTab === 'backups' && (
                                <div className="p-4 h-full flex flex-col">
                                   <div className="flex justify-between items-center mb-4">
                                      <h4 className="font-black text-amber-400 uppercase tracking-widest text-xs">Available Backups (Last 31 Days)</h4>
                                      <div className="flex items-center gap-2">
                                          <select value={inspectorRestoreMode} onChange={e => setInspectorRestoreMode(e.target.value)} className="bg-slate-700 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold outline-none border border-slate-600">
                                              <option value="all">กู้คืนทั้งหมด (All Data)</option>
                                              <option value="schedule">เฉพาะตารางกะงาน (Schedule)</option>
                                              <option value="branch">เฉพาะสาขา/พนักงาน (Branch)</option>
                                          </select>
                                          <button onClick={() => loadBackups(inspectorBranchId)} className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-600 transition">🔄 Refresh</button>
                                      </div>
                                   </div>
                                   <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded-xl border border-slate-700">
                                       {inspectedData.loadingBackups ? (
                                           <div className="flex justify-center items-center h-32 text-slate-400"><Loader2 className="w-8 h-8 animate-spin"/></div>
                                       ) : inspectorBackups.length === 0 ? (
                                           <div className="text-center p-8 text-slate-500 font-bold text-xs uppercase">No backups found for this branch.</div>
                                       ) : (
                                           <table className="w-full text-left text-xs border-collapse">
                                              <thead className="sticky top-0 bg-slate-800 shadow-md">
                                                 <tr><th className="p-3 border-b border-slate-600">Backup Date</th><th className="p-3 border-b border-slate-600">Timestamp</th><th className="p-3 border-b border-slate-600">Size (Approx)</th><th className="p-3 border-b border-slate-600 text-right">Actions</th></tr>
                                              </thead>
                                              <tbody>
                                                 {inspectorBackups.map(b => (
                                                     <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                                                         <td className="p-3 border-b border-slate-700/50 font-black text-amber-300">{b.backupDate}</td>
                                                         <td className="p-3 border-b border-slate-700/50 text-slate-400">{new Date(b.timestamp).toLocaleString('th-TH')}</td>
                                                         <td className="p-3 border-b border-slate-700/50 text-slate-500 font-bold">{Object.keys(b.schedule || {}).length} Schedule Days, {b.branchData?.staff?.length || 0} Staff</td>
                                                         <td className="p-3 border-b border-slate-700/50 text-right">
                                                             <button onClick={() => {
                                                                 const modeText = inspectorRestoreMode === 'all' ? 'ทั้งหมด (ข้อมูลพนักงาน + กะงาน)' : inspectorRestoreMode === 'schedule' ? 'เฉพาะตารางกะงาน (Schedule Only)' : 'เฉพาะข้อมูลสาขา/พนักงาน (Branch Data Only)';
                                                                 setConfirmModal({ message: `คุณต้องการ RESTORE ข้อมูลกลับไปยังวันที่ ${b.backupDate} ใช่หรือไม่?\n\nโหมดที่เลือก: ${modeText}\n\nคำเตือน: ข้อมูลปัจจุบันในส่วนที่เลือกจะถูกเขียนทับ!`, action: () => handleRestoreBackup(b, inspectorRestoreMode) });
                                                             }} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors shadow-lg">Restore Data</button>
                                                         </td>
                                                     </tr>
                                                 ))}
                                              </tbody>
                                           </table>
                                       )}
                                   </div>
                                </div>
                            )}
                            {inspectorTab === 'schedule' && (
                                <table className="w-full text-left text-xs border-collapse">
                                   <thead className="sticky top-0 bg-slate-800 shadow-md">
                                      <tr><th className="p-3 border-b border-slate-600">Date</th><th className="p-3 border-b border-slate-600 text-center">Assigned Duties (Slots)</th><th className="p-3 border-b border-slate-600 text-center">Leaves</th></tr>
                                   </thead>
                                   <tbody>
                                      {Object.keys(inspectedData.schedule?.records || {}).length ? Object.entries(inspectedData.schedule.records).sort(([a],[b])=>a.localeCompare(b)).map(([date, data]) => {
                                          const assignedCount = Object.values(data.duties || {}).flat().filter(s => s.staffId).length;
                                          const leaveCount = data.leaves?.length || 0;
                                          return (
                                          <tr key={date} className="hover:bg-slate-800/50 transition-colors">
                                              <td className="p-3 border-b border-slate-700/50 font-black text-sky-300">{date}</td>
                                              <td className="p-3 border-b border-slate-700/50 text-center"><span className="bg-slate-700 px-3 py-1 rounded-full font-bold">{assignedCount}</span></td>
                                              <td className="p-3 border-b border-slate-700/50 text-center"><span className={`px-3 py-1 rounded-full font-bold ${leaveCount > 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-700 text-slate-300'}`}>{leaveCount}</span></td>
                                          </tr>
                                      )}) : <tr><td colSpan="3" className="p-4 text-center text-slate-500">No schedule records found</td></tr>}
                                   </tbody>
                                </table>
                            )}
                            {inspectorTab === 'raw' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full p-4">
                                    <div className="flex flex-col h-full"><h4 className="font-bold text-slate-400 mb-2">Branch Document</h4><pre className="text-[10px] text-slate-300 overflow-auto custom-scrollbar bg-black/30 p-4 rounded-xl flex-1">{JSON.stringify(inspectedData.branch, null, 2)}</pre></div>
                                    <div className="flex flex-col h-full"><h4 className="font-bold text-slate-400 mb-2">Schedule Document</h4><pre className="text-[10px] text-slate-300 overflow-auto custom-scrollbar bg-black/30 p-4 rounded-xl flex-1">{JSON.stringify(inspectedData.schedule, null, 2)}</pre></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  }

  function renderModals() {
    return (
      <React.Fragment>
        {zoomedImage && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
             <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/50 hover:text-white transition bg-white/10 hover:bg-white/20 p-2 sm:p-3 rounded-full"><X className="w-6 h-6 sm:w-8 sm:h-8"/></button>
             <img src={zoomedImage} alt="Zoomed View" className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 cursor-default" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
             <div className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
                <div className="bg-green-500 p-4 rounded-full shadow-xl shadow-green-200 animate-bounce"><CheckCircle2 className="w-12 h-12 text-white" /></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-2">Saved Successfully</h3>
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
                                   <React.Fragment>
                                     <p className="text-xs font-bold text-slate-500 mt-1">ขอหยุดวันที่: <span className="text-indigo-600">{dateObj.toLocaleDateString('th-TH', { dateStyle: 'medium'})}</span></p>
                                     <p className="text-xs font-bold text-slate-500">ประเภท: <span className={`px-1.5 rounded ${lType?.color}`}>{lType?.label}</span></p>
                                   </React.Fragment>
                                 );
                              }
                              return (
                                  <div key={req.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                                      <div>
                                          <h4 className="font-black text-slate-800">{staff?.name || 'Unknown Staff'} <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border ml-2">{staff?.pos}</span></h4>
                                          {detailHtml}
                                      </div>
                                      <div className="flex gap-2 w-full sm:w-auto">
                                          <button onClick={() => handleManagerApproveRequest(req)} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-500 hover:text-white transition shadow-sm border border-emerald-200">อนุมัติ</button>
                                          <button onClick={() => handleRejectRequest(req.id)} className="flex-1 sm:flex-none bg-slate-50 text-slate-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-500 hover:text-white transition border border-slate-200">ปฏิเสธ</button>
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
        {showDataInspector && renderDataInspectorModal()}
      </React.Fragment>
    );
  }

  function renderLandingModal() {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const actives = (branchData.announcements || []).filter(a => {
          if (!a.isActive) return false;
          if (a.startDate && a.startDate > todayStr) return false;
          if (a.endDate && a.endDate < todayStr) return false;
          return true;
      });
      if (!showLanding || actives.length === 0) return null;
      const a = actives[landingIndex];

      return (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 sm:p-8 animate-in fade-in zoom-in duration-500">
              <div className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
                  <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-shrink-0 z-10">
                      <div className="flex gap-2">
                          {actives.map((_, i) => (
                              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i === landingIndex ? 'bg-indigo-600 w-6' : 'bg-slate-300'}`}></div>
                          ))}
                      </div>
                      <div className="flex gap-3">
                          {landingIndex > 0 && (
                              <button onClick={() => setLandingIndex(i => i - 1)} className="bg-slate-200 text-slate-700 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm hover:bg-slate-300 active:scale-95 transition shadow-sm">ก่อนหน้า</button>
                          )}
                          {landingIndex < actives.length - 1 ? (
                              <button onClick={() => setLandingIndex(i => i + 1)} className="bg-indigo-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm hover:bg-indigo-700 active:scale-95 transition shadow-lg">ถัดไป (Next)</button>
                          ) : (
                              <button onClick={() => setShowLanding(false)} className="bg-emerald-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm hover:bg-emerald-700 active:scale-95 transition shadow-lg">เข้าสู่ระบบ (Enter)</button>
                          )}
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
                      {a.imageUrl && (
                          <div className="w-full aspect-video max-h-[40vh] sm:max-h-[50vh] lg:max-h-[720px] bg-slate-100 flex-shrink-0 relative">
                              <img src={a.imageUrl} alt={a.title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          </div>
                      )}
                      <div className="p-6 sm:p-12 flex-1 flex flex-col">
                          <div className="text-slate-600 text-sm sm:text-lg whitespace-pre-wrap leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: a.content }}></div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  function renderGuestLogin() {
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
          <div className="hidden lg:block absolute bottom-8 text-center w-full z-10">
            <p className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">Powered by Super Store Team</p>
            <button onClick={handleOpenInspector} className="mt-2 bg-slate-800 text-slate-400 text-xs font-bold py-1 px-3 rounded-md hover:bg-slate-700 transition">Server Data Inspector</button>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white">
          <div className="w-full max-w-md p-8 sm:p-12 rounded-[2rem] sm:rounded-[3rem] shadow-xl sm:shadow-2xl border border-slate-100 bg-white flex flex-col gap-6 sm:gap-8 animate-in slide-in-from-right-8 duration-500 z-10">
            <div className="text-center w-full">
               <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase">Welcome Back</h2>
               <p className="text-slate-400 text-xs sm:text-sm font-bold mt-2">Sign in to your management account</p>
            </div>
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
          </div>
          <div className="lg:hidden mt-12 text-center w-full z-0">
            <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">Powered by Super Store Team</p>
                <button onClick={handleOpenInspector} className="mt-4 bg-slate-200 text-slate-600 text-xs font-bold py-1 px-3 rounded-md hover:bg-slate-300 transition">Server Data Inspector</button>
          </div>
        </div>
      </div>
    );
  }


  function renderGlobalAdmin() {
    return (
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
    );
  }

  function renderShiftPresetManager() {
    if (authRole === 'branch') return null;

    return (
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full mt-6 sm:mt-10">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Clock className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการชื่อกะ (Shift Presets)</h2>
            <div className="space-y-4">
                {(branchData.shiftPresets || []).map((p, idx) => (
                    <div 
                        key={p.id} 
                        draggable={authRole === 'superadmin'}
                        onDragStart={() => setDraggedShiftPresetIdx(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleDropShiftPreset(idx); }}
                        onDragEnd={() => setDraggedShiftPresetIdx(null)}
                        className={`bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3 transition-all ${draggedShiftPresetIdx === idx ? 'opacity-40 ring-2 ring-indigo-400' : ''} ${authRole === 'superadmin' ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                        <div className="flex items-center gap-4">
                            {authRole === 'superadmin' && <div className="text-slate-300 hover:text-indigo-500 flex-shrink-0 touch-none"><GripVertical className="w-5 h-5" /></div>}
                            <input type="text" value={p.name} onChange={(e) => handleUpdateShiftPreset(p.id, 'name', e.target.value)} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="flex-1 font-black text-sm text-indigo-700 bg-transparent outline-none focus:bg-white p-2 rounded-lg"/>
                            <button onClick={() => handleDeleteShiftPreset(p.id)} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">กลุ่ม 9.5 ชั่วโมง (OC, SH...)</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={p.timings.long.startTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'startTime', e.target.value, 'long')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold"/>
                                    <span>-</span>
                                    <input type="text" value={p.timings.long.endTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'endTime', e.target.value, 'long')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold"/>
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">กลุ่ม 9 ชั่วโมง (EDC, PT...)</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={p.timings.short.startTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'startTime', e.target.value, 'short')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold"/>
                                    <span>-</span>
                                    <input type="text" value={p.timings.short.endTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'endTime', e.target.value, 'short')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold"/>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                <button onClick={handleAddShiftPreset} className="w-full bg-slate-100 text-slate-600 border-2 border-dashed border-slate-200 py-3 rounded-2xl text-xs font-black hover:border-indigo-500 hover:text-indigo-600 transition">+ เพิ่มกะใหม่</button>
            </div>
        </div>
    );
  }

  function renderEmptyBranchAdmin() {
    return (
     <div className="flex-1 h-[60vh] sm:h-[70vh] flex flex-col items-center justify-center gap-4 sm:gap-6 text-slate-300 font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-center px-4 w-full">
       <Store className="w-16 h-16 sm:w-24 sm:h-24 opacity-10" />
       <p className="text-sm sm:text-base">กรุณาเลือกสาขาที่ต้องการจัดการจากแถบด้านบน</p>
     </div>
    );
  }

  function renderBranchAdmin() {
    const dayOffCounts = { service: {}, kitchen: {} };
    (branchData.staff || []).forEach(s => {
       if (s.regularDayOff !== null && s.regularDayOff !== undefined) {
           const dept = s.dept || 'service';
           if (!dayOffCounts[dept]) dayOffCounts[dept] = {};
           dayOffCounts[dept][s.regularDayOff] = (dayOffCounts[dept][s.regularDayOff] || 0) + 1;
       }
    });
    const activeDeptDayOffCounts = dayOffCounts[activeDept] || {};

    return (
     <div className="flex-1 space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24 w-full">
        <div className={`grid grid-cols-1 ${authRole === 'superadmin' ? 'lg:grid-cols-2' : ''} gap-6 sm:gap-10`}>
           <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
             <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Users className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการพนักงาน ({globalConfig.branches?.find(b=>b.id===activeBranchId)?.name})</h2>
             
             <div className="flex flex-col gap-4 mb-6 sm:mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                    <span>สรุปพนักงาน ({branchData.staff?.filter(s => s.dept === activeDept).length || 0} คน)</span>
                    <button onClick={() => setStaffFilterPos('ALL')} className={`px-3 py-1 rounded-lg transition-all shadow-sm ${staffFilterPos === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>ดูทั้งหมด</button>
                 </div>
                 {DUTY_CATEGORIES[activeDept].map(cat => {
                    const layerPositions = POSITIONS[activeDept].filter(p => getStaffLayer(activeDept, p).id === cat.id);
                    const catStaffCount = (branchData.staff || []).filter(s => getStaffLayer(s.dept, s.pos).id === cat.id).length;
                    const catLimit = branchData.staffLimits?.[cat.id];
                    const isFull = catLimit !== undefined && catLimit !== null && catStaffCount >= catLimit;

                    return (
                       <div key={cat.id} className="flex flex-col gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <div className="flex justify-between items-center">
                             <div className={`text-[10px] font-black px-3 py-1.5 rounded uppercase w-fit ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>{cat.label}</div>
                             <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold ${isFull ? 'text-red-500' : 'text-slate-500'}`}>จำนวน {catStaffCount}/{catLimit !== undefined && catLimit !== null ? catLimit : '∞'}</span>
                                <input 
                                   type="number" min="0" disabled={authRole !== 'superadmin'}
                                   value={catLimit === undefined || catLimit === null ? '' : catLimit}
                                   onChange={(e) => handleUpdateStaffLimit(cat.id, e.target.value)}
                                   className="w-12 text-center border rounded p-1 text-[10px] font-bold outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                                   placeholder="∞" title="ตั้งค่าจำนวนสูงสุด"
                                />
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                             {layerPositions.map(p => {
                                 const count = (branchData.staff || []).filter(s => s.dept === activeDept && s.pos === p).length;
                                 const isSelected = staffFilterPos === p;
                                 return (
                                    <button key={p} onClick={() => setStaffFilterPos(isSelected ? 'ALL' : p)} className={`text-[10px] font-black border px-3 py-1.5 rounded-lg transition-all shadow-sm ${isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 scale-105' : 'hover:opacity-80'} ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]} ${count === 0 ? 'opacity-40' : ''}`}>
                                       {p}: {count}
                                    </button>
                                 )
                             })}
                          </div>
                       </div>
                    )
                 })}
             </div>

             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 mt-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest">โควตาวันหยุด: {activeDept === 'service' ? 'ฝั่งบริการ' : 'ฝั่งครัว'}</h3>
                    <button onClick={handleAutoAssignDayOffs} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-indigo-700 transition flex items-center gap-1"><Wand2 className="w-3 h-3"/> จัดวันหยุด Auto</button>
                </div>
                <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map(d => {
                        const limit = branchData.dayOffLimits?.[activeDept]?.[d.id] ?? 99;
                        const current = activeDeptDayOffCounts[d.id] || 0;
                        return (
                            <div key={d.id} className="bg-white p-2 rounded-xl border border-slate-200 flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-500 mb-1">{d.label}</span>
                                <div className="flex items-center gap-1 w-full">
                                    <input type="number" min="0" value={limit === 99 ? '' : limit} placeholder="∞" onChange={(e) => handleUpdateDayOffLimit(d.id, e.target.value)} disabled={authRole === 'branch'} className="w-full text-center border bg-slate-50 rounded p-1 text-xs font-black outline-none focus:border-indigo-500" />
                                </div>
                                <span className={`text-[8px] mt-1 font-bold ${current >= limit && limit !== 99 ? 'text-red-500' : 'text-emerald-500'}`}>ใช้ {current}/{limit === 99 ? '∞' : limit}</span>
                            </div>
                        )
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
                        <option value="">- วันหยุด -</option>
                        {DAYS_OF_WEEK.map(d => {
                            const deptCounts = dayOffCounts[newStaffDept] || {};
                            const limit = branchData.dayOffLimits?.[newStaffDept]?.[d.id] ?? 99;
                            const current = deptCounts[d.id] || 0;
                            const isFull = current >= limit;
                            return <option key={d.id} value={d.id} disabled={isFull}>{d.label} {isFull ? '(เต็ม)' : ''}</option>
                        })}
                    </select>
                  </div>
                  <button onClick={() => { 
                      if(newStaffName.trim()){ 
                          const layer = getStaffLayer(newStaffDept, newStaffPos);
                          const limit = branchData.staffLimits?.[layer.id];
                          const currentCount = (branchData.staff || []).filter(s => getStaffLayer(s.dept, s.pos).id === layer.id).length;
                          if (limit !== undefined && limit !== null && currentCount >= limit) {
                              setConfirmModal({ message: `เพิ่มพนักงานไม่ได้ เนื่องจากกลุ่ม ${layer.label} เต็มแล้ว (รับได้สูงสุด ${limit} คน)` });
                              return;
                          }
                          setBranchData(p => ({...p, staff: [...(p.staff || []), {id: 's' + Date.now(), empId: newStaffEmpId.trim(), name: newStaffName.trim(), dept: newStaffDept, pos: newStaffPos, regularDayOff: newStaffDayOff === '' ? null : parseInt(newStaffDayOff)}]})); 
                          setNewStaffName(''); setNewStaffEmpId(''); setNewStaffDayOff(''); 
                      } 
                  }} className="w-full xl:w-auto bg-slate-900 text-white px-6 sm:px-8 py-3 rounded-xl sm:rounded-2xl font-black text-xs hover:bg-indigo-600 transition uppercase flex items-center justify-center"><UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-0 sm:mr-0"/><span className="xl:hidden ml-2">เพิ่มพนักงาน</span></button>
               </div>
             </div>
             <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[400px] overflow-y-auto pr-2 sm:pr-3 custom-scrollbar">
               {branchData.staff?.filter(s => s.dept === activeDept && (staffFilterPos === 'ALL' || s.pos === staffFilterPos)).length === 0 ? (
                 <div className="text-center py-8 sm:py-10 text-slate-400 font-bold text-[10px] sm:text-sm uppercase tracking-widest border-2 border-dashed rounded-[1.5rem] sm:rounded-[2rem]">ไม่มีพนักงานในแผนก/ตำแหน่งนี้</div>
               ) : branchData.staff?.filter(s => s.dept === activeDept && (staffFilterPos === 'ALL' || s.pos === staffFilterPos)).map(s => {
                 const layer = getStaffLayer(s.dept, s.pos);
                 return (
                 <div key={s.id} className="flex justify-between items-center p-4 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition group shadow-sm">
                    {editingStaffId === s.id ? (
                       <div className="flex-1 flex gap-2 items-center flex-wrap">
                          <input type="text" placeholder="รหัส" value={editStaffData.empId || ''} onChange={e => setEditStaffData({...editStaffData, empId: e.target.value})} className="border rounded px-2 py-1 text-xs w-full sm:w-16"/>
                          <input type="text" value={editStaffData.name} onChange={e => setEditStaffData({...editStaffData, name: e.target.value})} className="border rounded px-2 py-1 text-xs w-full sm:w-auto flex-1 min-w-[100px]"/>
                          <select value={editStaffData.pos} onChange={e => setEditStaffData({...editStaffData, pos: e.target.value})} className="border rounded px-2 py-1 text-[10px]">
                              {POSITIONS[s.dept].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <select value={editStaffData.regularDayOff ?? ''} onChange={e => setEditStaffData({...editStaffData, regularDayOff: e.target.value === '' ? null : parseInt(e.target.value)})} className="border rounded px-2 py-1 text-[10px]">
                                    <option value="">- วันหยุด -</option>
                                    {DAYS_OF_WEEK.map(d => {
                                        const deptCounts = dayOffCounts[s.dept] || {};
                                        const limit = branchData.dayOffLimits?.[s.dept]?.[d.id] ?? 99;
                                        const current = deptCounts[d.id] || 0;
                                        const isFull = current >= limit;
                                        const isThisStaffsDayOff = s.regularDayOff === d.id;
                                        return <option key={d.id} value={d.id} disabled={isFull && !isThisStaffsDayOff}>{d.label} {isFull && !isThisStaffsDayOff ? '(เต็ม)' : ''}</option>
                                    })}
                          </select>
                          <button onClick={() => {
                              const s = branchData.staff.find(x => x.id === editingStaffId);
                              if (editStaffData.pos !== s.pos || editStaffData.dept !== s.dept) {
                                  const layer = getStaffLayer(editStaffData.dept, editStaffData.pos);
                                  const limit = branchData.staffLimits?.[layer.id];
                                  const currentCount = (branchData.staff || []).filter(x => x.id !== editingStaffId && getStaffLayer(x.dept, x.pos).id === layer.id).length;
                                  if (limit !== undefined && limit !== null && currentCount >= limit) {
                                      setConfirmModal({ message: `เปลี่ยนตำแหน่งไม่ได้ เนื่องจากกลุ่ม ${layer.label} เต็มแล้ว (รับได้สูงสุด ${limit} คน)` });
                                      return;
                                  }
                              }
                              saveEditStaff();
                          }} className="bg-green-500 text-white p-1.5 rounded"><Check className="w-3 h-3"/></button>
                          <button onClick={() => setEditingStaffId(null)} className="bg-red-500 text-white p-1.5 rounded"><X className="w-3 h-3"/></button>
                       </div>
                    ) : (
                       <React.Fragment>
                         <div className="flex-1 min-w-0 pr-4">
                            <span className="text-sm sm:text-base font-black text-slate-800 uppercase truncate block">
                               {s.empId && <span className="text-slate-400 mr-2 text-xs">[{s.empId}]</span>} {s.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 items-center">
                               <span className={`text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border uppercase ${layer.color.split(' ')[0]} ${layer.color.split(' ')[1]}`}>{s.pos}</span>
                               <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 uppercase truncate">หยุด: {s.regularDayOff !== undefined && s.regularDayOff !== null ? DAYS_OF_WEEK.find(d => d.id === s.regularDayOff)?.label : '-'}</span>
                               <button onClick={() => startEditStaff(s)} className="text-slate-300 hover:text-indigo-500"><Edit2 className="w-3 h-3"/></button>
                            </div>
                         </div>
                         <button onClick={() => setBranchData(p=>({...p, staff: p.staff.filter(x=>x.id!==s.id)}))} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                       </React.Fragment>
                    )}
                 </div>
               )})}
             </div>
           </div>
           
           {authRole === 'superadmin' && (
           <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
             <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><List className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการหน้าที่งาน (Duties)</h2>
               <div className="space-y-4 mb-6 sm:mb-10 w-full">
                 <div className="flex flex-col gap-2 sm:gap-4">
                    <div className="flex flex-col xl:flex-row gap-2 sm:gap-4">
                      <input type="text" placeholder="หน้าที่หลัก (เช่น ต้อนรับหน้าร้าน)" className="flex-[2] border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" value={newDutyJobA} onChange={e => setNewDutyJobA(e.target.value)} />
                      <input type="text" placeholder="หน้าที่รอง (เช่น เคลียร์โต๊ะ)" className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" value={newDutyJobB} onChange={e => setNewDutyJobB(e.target.value)} />
                    </div>
                    <div className="flex flex-col xl:flex-row gap-2 sm:gap-4">
                      <input type="text" placeholder="XP-DNA SOP" className="flex-[2] border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" value={newDutyXpDna} onChange={e => setNewDutyXpDna(e.target.value)} />
                      <select value={newDutyCategory} onChange={e => setNewDutyCategory(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none">
                         {DUTY_CATEGORIES[activeDept]?.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                      </select>
                      <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 cursor-pointer select-none whitespace-nowrap transition hover:border-indigo-200">
                         <input type="checkbox" checked={newDutyIsBackup} onChange={e => setNewDutyIsBackup(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                         กะสำรอง
                      </label>
                      <PositionSelector disabled={false} value={newDutyReqPos} options={POSITIONS[activeDept]} onChange={setNewDutyReqPos} className="w-full xl:min-w-[80px]" />
                      <button onClick={handleAddDuty} className="w-full xl:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-indigo-600 transition flex items-center justify-center"><Plus className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    </div>
                 </div>
               </div>
             <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[400px] overflow-y-auto pr-2 sm:pr-3 custom-scrollbar">
               {CURRENT_DUTY_LIST.length === 0 ? (
                 <div className="text-center py-8 sm:py-10 text-slate-400 font-bold text-[10px] sm:text-sm uppercase tracking-widest border-2 border-dashed rounded-[1.5rem]">ไม่มีข้อมูลหน้าที่</div>
               ) : CURRENT_DUTY_LIST.map((duty, idx) => {
                 const catInfo = DUTY_CATEGORIES[activeDept]?.find(c => c.id === duty.category);
                 return (
                  <div key={duty.id} draggable={authRole === 'superadmin' && editingDutyId === null} onDragStart={() => setDraggedDutyIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleDropDuty(idx); }} onDragEnd={() => setDraggedDutyIdx(null)} className={`flex justify-between items-center p-3 sm:p-4 rounded-2xl border ${draggedDutyIdx === idx ? 'opacity-40 border-indigo-400 bg-indigo-50' : 'bg-slate-50 border-slate-100'} shadow-sm transition hover:bg-white hover:border-indigo-100`}>
                    {authRole === 'superadmin' && editingDutyId === null && (
                       <div className="cursor-grab active:cursor-grabbing mr-2 sm:mr-3 text-slate-300 hover:text-indigo-500 flex-shrink-0 touch-none"><GripVertical className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                    )}
                    {editingDutyId === duty.id ? (
                       <div className="flex-1 flex flex-col gap-2">
                          <div className="flex gap-2">
                             <input type="text" value={editDutyData.jobA} onChange={e => setEditDutyData({...editDutyData, jobA: e.target.value})} className="border rounded px-2 py-1 text-[10px] sm:text-xs flex-1 font-bold outline-none focus:border-indigo-500 min-w-[100px]"/>
                             <input type="text" value={editDutyData.jobB} onChange={e => setEditDutyData({...editDutyData, jobB: e.target.value})} className="border rounded px-2 py-1 text-[10px] sm:text-xs flex-1 font-bold outline-none focus:border-indigo-500 min-w-[100px]"/>
                          </div>
                          <div className="flex gap-2 items-center">
                             <input type="text" placeholder="XP-DNA SOP" value={editDutyData.xpDna || ''} onChange={e => setEditDutyData({...editDutyData, xpDna: e.target.value})} className="border rounded px-2 py-1 text-[10px] sm:text-xs flex-1 font-bold outline-none focus:border-indigo-500 min-w-[100px]"/>
                             <select value={editDutyData.category} onChange={e => setEditDutyData({...editDutyData, category: e.target.value})} className="border rounded px-2 py-1 text-[10px] sm:text-xs font-bold outline-none focus:border-indigo-500">
                                {DUTY_CATEGORIES[activeDept]?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                             </select>
                             <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-white border rounded px-2 py-1 cursor-pointer select-none whitespace-nowrap">
                                <input type="checkbox" checked={editDutyData.isBackup || false} onChange={e => setEditDutyData({...editDutyData, isBackup: e.target.checked})} className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                กะสำรอง
                             </label>
                             <PositionSelector disabled={false} value={editDutyData.reqPos || ['ALL']} options={POSITIONS[activeDept]} onChange={(val) => setEditDutyData({...editDutyData, reqPos: val})} className="w-full sm:min-w-[80px]" />
                             <button onClick={handleEditDutySave} className="bg-green-500 text-white p-1.5 rounded-lg"><Check className="w-3 h-3"/></button>
                             <button onClick={() => setEditingDutyId(null)} className="bg-red-500 text-white p-1.5 rounded-lg"><X className="w-3 h-3"/></button>
                          </div>
                       </div>
                    ) : (
                       <React.Fragment>
                         <div className="flex-1 min-w-0 pr-4">
                           <div className="flex items-center gap-2">
                              <div className="font-black text-xs sm:text-sm text-slate-800 truncate">{duty.jobA}</div>
                              {duty.isBackup && <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">กะสำรอง</span>}
                              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate max-w-[80px] sm:max-w-[120px]" title={(duty.reqPos || ['ALL']).join(', ')}>{(duty.reqPos || ['ALL']).join(', ')}</span>
                           </div>
                           <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate mt-0.5 flex items-center gap-2">
                              {catInfo && <div className={`w-2 h-2 rounded-full ${catInfo.color.split(' ')[0]}`} title={catInfo.label}></div>}
                              {duty.jobB}
                              {duty.xpDna && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">XP-DNA</span>}
                           </div>
                         </div>
                         {authRole === 'superadmin' && (
                           <div className="flex gap-1 sm:gap-2">
                             <button onClick={() => { setEditingDutyId(duty.id); setEditDutyData(duty); }} className="text-slate-300 hover:text-indigo-500 p-2"><Edit2 className="w-4 h-4"/></button>
                             <button onClick={() => handleDeleteDuty(duty.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                           </div>
                         )}
                       </React.Fragment>
                    )}
                  </div>
               )})}
             </div>
           </div>
           )}
        </div>

        {authRole === 'superadmin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 w-full mt-6 sm:mt-10">
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
           </div>
           
           <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full mt-6 sm:mt-10 lg:mt-0">
             <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Megaphone className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการหน้าประกาศ (Landing Pages)</h2>
             <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-[2] space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {(branchData.announcements || []).map(a => (
                        <div key={a.id} className={`flex flex-col sm:flex-row gap-4 bg-slate-50 border p-4 rounded-2xl transition-all ${a.isActive ? 'border-indigo-200 shadow-sm' : 'border-slate-200 opacity-60'}`}>
                            {a.imageUrl && <img src={a.imageUrl} alt="img" className="w-full sm:w-32 h-24 object-cover rounded-xl border border-slate-200" />}
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm">{a.title}</h4>
                                  <div className="text-xs text-slate-500 line-clamp-2 mt-1" dangerouslySetInnerHTML={{ __html: a.content }}></div>
                                    <div className="mt-2 text-[10px] font-bold text-slate-500 flex gap-2">
                                        {a.startDate || a.endDate ? (
                                            <span className="bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                                                🗓️ {a.startDate ? new Date(a.startDate).toLocaleDateString('th-TH', {month:'short', day:'numeric'}) : 'เริ่มต้น'} - {a.endDate ? new Date(a.endDate).toLocaleDateString('th-TH', {month:'short', day:'numeric'}) : 'ไม่มีกำหนด'}
                                            </span>
                                        ) : (
                                            <span className="bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">🗓️ แสดงตลอด (ไม่มีกำหนด)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={a.isActive} onChange={e => handleToggleAnnouncement(a.id, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                        <span className="text-xs font-bold text-slate-600">เปิดใช้งาน (Active)</span>
                                    </label>
                                    <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase flex items-center gap-1"><Trash2 className="w-3 h-3"/> ลบ</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {!(branchData.announcements?.length > 0) && <div className="text-center py-10 text-slate-400 font-bold text-xs border-2 border-dashed border-slate-200 rounded-2xl">ยังไม่มีประกาศ/หน้า Landing Page</div>}
                </div>
                <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-200 h-fit space-y-4">
                    <h3 className="font-black text-slate-700 text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500"/> เพิ่มหน้าประกาศใหม่</h3>
                    <input type="text" placeholder="ชื่อ Content (สำหรับดูหลังบ้าน)" value={newAnnTitle} onChange={e=>setNewAnnTitle(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"/>
                    <div className="flex flex-col shadow-sm rounded-xl">
                        {renderRichTextToolbar('branch-ann-editor', newAnnContent, setNewAnnContent)}
                        <div className="flex flex-col md:flex-row border border-slate-200 border-t-0 rounded-b-xl overflow-hidden min-h-[150px]">
                           <textarea id="branch-ann-editor" placeholder="พิมพ์เนื้อหารายละเอียดที่นี่... (รองรับ HTML หรือกดปุ่มด้านบน)" value={newAnnContent} onChange={e=>setNewAnnContent(e.target.value)} className="w-full md:w-1/2 p-3 text-xs font-medium outline-none focus:border-indigo-500 resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[150px]"></textarea>
                           <div className="w-full md:w-1/2 p-3 bg-slate-50 text-xs text-slate-600 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: newAnnContent || '<span class="text-slate-400 italic font-bold">แสดงผลตัวอย่าง (Preview)...</span>' }}></div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-1 block">เริ่มแสดง (Start)</span>
                            <input type="date" value={newAnnStartDate} onChange={e=>setNewAnnStartDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"/>
                        </div>
                        <div className="flex-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-1 block">สิ้นสุด (End)</span>
                            <input type="date" value={newAnnEndDate} onChange={e=>setNewAnnEndDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"/>
                        </div>
                    </div>
                    <div>
                        <input type="text" placeholder="URL รูปภาพ (ถ้ามี)" value={newAnnImage} onChange={e=>setNewAnnImage(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"/>
                      <p className="text-[9px] text-slate-400 font-bold mt-1.5 ml-1">* แนะนำรูปภาพขนาด 1280 x 720 px (สัดส่วน 16:9)</p>
                    </div>
                    <button onClick={handleAddAnnouncement} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs hover:bg-indigo-700 transition shadow-sm">บันทึกประกาศ</button>
                </div>
             </div>
           </div>

           {renderTemplatesCard()}
        </div>
        )}

        {authRole === 'superadmin' && renderShiftPresetManager()}

        {authRole === 'superadmin' && renderMatrixSettings()}

        {renderRosterStyleSettings()}

     </div>
    );
  }

  function renderManagerDailyCards() {
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
                const isHoliday = branchData.holidays?.includes?.(selectedDateStr);
                const isBlocked = isHoliday && lt.id === 'OFF';
                return (
                   <div key={lt.id} className={`bg-slate-50 p-4 sm:p-5 rounded-[1.5rem] flex flex-col gap-4 border border-slate-100 shadow-sm transition-all ${isBlocked ? 'opacity-50 pointer-events-none grayscale' : 'hover:bg-white hover:border-indigo-100'}`}>
                      <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${lt.color} border border-white shadow-sm flex-shrink-0`}>{lt.shortLabel}</span>
                            <span className="text-xs sm:text-sm font-black text-slate-700 truncate">{lt.label} {isBlocked && '(ห้ามหยุด)'}</span>
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
                   unassignedStaffDaily.map(s => {
                      const layer = getStaffLayer(s.dept, s.pos);
                      return (
                      <span key={s.id} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black shadow-sm flex items-center gap-2 ${layer.color.split(' ')[0]} ${layer.color.split(' ')[1]}`}>
                         <span className="w-1.5 h-1.5 rounded-full bg-white opacity-50"></span>{s.name} ({s.pos})
                      </span>
                      );
                   })
                )}
             </div>
          </div>
  
          <div className="space-y-10 w-full print:hidden">
             {DUTY_CATEGORIES[activeDept].map(cat => {
                const catDuties = CURRENT_DUTY_LIST.filter(d => d.category === cat.id);
                if (catDuties.length === 0) return null; // This might be wrong, should be CURRENT_DUTY_LIST

                return (
                   <div key={cat.id} className="bg-white rounded-[2rem] sm:rounded-[3.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col w-full">
                      <div className={`p-4 sm:p-6 text-center sm:text-left ${cat.color}`}>
                         <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest">{cat.label}</h2> 
                      </div>
                      <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-10 bg-slate-50/50">
                         {catDuties.map(duty => {
                            const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                            const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                            const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                            const displayPos = (reqArr.includes('ALL') || reqArr.length === 0) ? 'ALL POS' : reqArr.join(', ');

                            if (slots.length === 0) return null; // Should not happen with current logic

                            return (
                               <div key={duty.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-xl w-full">
                                  <div className="p-5 sm:p-6 bg-white border-b border-slate-100 flex justify-between items-start flex-col gap-2">
                                     <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tighter leading-tight break-words">{duty.jobA}</h3>
                                     <div className="flex items-center gap-2 opacity-90 w-full justify-between">
                                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic leading-tight">{duty.jobB}</span>
                                        <div className="flex items-center gap-2">
                                            {duty.xpDna && <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-600 uppercase bg-indigo-50">XP-DNA</span>}
                                            <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 uppercase bg-slate-50">{displayPos}</span>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="p-4 sm:p-6 space-y-4 bg-slate-50/30">
                                     {slots.map((slot, idx) => {
                                        const data = assigned[idx] || { staffId: "", otHours: 0 };
                                        const currentShiftPreset = branchData.shiftPresets?.find(p => p.id === slot?.shiftPresetId);
                                        const currentShiftName = currentShiftPreset ? currentShiftPreset.name : 'N/A';
                                        return (
                                           <div key={idx} className={`p-4 sm:p-5 rounded-[1.2rem] sm:rounded-[1.5rem] border-2 transition-all flex flex-col gap-3 ${!data.staffId ? 'border-dashed border-slate-200 bg-white' : 'border-indigo-100 bg-white shadow-sm'}`}>
                                              <div className="flex justify-between items-center">                                                
                                                <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400" /> 
                                                    {currentShiftName}
                                                </span>
                                              <div className="flex gap-1.5">
                                                 <span className={`text-[8px] sm:text-[9px] font-black px-2 py-1 rounded-full uppercase ${data.otHours >= slot.maxOtHours ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>Q: {slot.maxOtHours}H</span>
                                              </div>
                                              </div>
                                              <div className="flex flex-col sm:flex-row gap-2">
                                              <select value={data.staffId} onChange={(e) => handleScheduleUpdate(selectedDateStr, duty.id, idx, 'staffId', e.target.value, slot.maxOtHours)} className="w-full sm:flex-[3] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none shadow-sm text-slate-900 focus:border-indigo-500">
                                                 <option value="">-- เลือกพนักงาน --</option>
                                                 {branchData.staff?.filter(s => s.dept === activeDept).map(s => {
                                                    const isUsed = usedStaffIds.includes(s.id) && data.staffId !== s.id;
                                                    const wrongPos = !checkPositionEligibility(s.pos, reqArr, activeDept) && data.staffId !== s.id;
                                                    return (isUsed || wrongPos) ? null : <option key={s.id} value={s.id}>{s.name} ({s.pos})</option>
                                                 })}
                                              </select>
                                              <div className={`w-full sm:flex-1 flex flex-row sm:flex-col justify-between sm:justify-center items-center border rounded-xl bg-white transition-all px-3 py-1 ${data.otHours >= slot.maxOtHours ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200'}`}>
                                                 <span className="text-[8px] font-black text-slate-300 uppercase sm:mb-0.5">OT</span>
                                                 <input type="number" step="0.5" value={data.otHours} onChange={(e) => handleScheduleUpdate(selectedDateStr, duty.id, idx, 'otHours', parseFloat(e.target.value) || 0)} onBlur={() => autoSaveSchedule()} className="w-12 sm:w-full text-right sm:text-center font-black text-sm outline-none bg-transparent focus:text-indigo-600" />
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
             })}
          </div>
       </div>
    );
  }

  function renderManagerDailyTable() {
    const categories = DUTY_CATEGORIES[activeDept] || [];
    let totalAssignedAll = 0;
    const rs = branchData.rosterStyle || {
        fontSize: 10, headerBg: '#f1f5f9', shiftHeaderBg: '#e0f2fe', 
        colDuty: 8, colXpDna: 10, colJobA: 15, colJobB: 10, colCount: 4, colName: 15, colShift: 7, colBreak: 8,
        headlineSize: 24, subHeadlineSize: 14, headerFontSize: 10,
        fontDuty: 10, fontXpDna: 8, fontJobA: 10, fontJobB: 8, fontCount: 12, fontName: 10, fontShift: 10, fontBreak: 10
    };

    const allTrs = [];
    categories.forEach(cat => {
       const catDuties = CURRENT_DUTY_LIST.filter(d => d.category === cat.id);
       let catSlotCount = 0;
       const catRows = [];

       catDuties.forEach((duty) => {
          const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
          const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];

          const activeSlots = slots.map((slot, sIdx) => ({
             slot,
             assignedData: assigned[sIdx] || { staffId: "", otHours: 0 },
             originalIdx: sIdx
          })).filter(item => item.assignedData.staffId !== "");

          if (activeSlots.length > 0) {
             catRows.push({ duty, activeSlots });
             catSlotCount += activeSlots.length;
             totalAssignedAll += activeSlots.length;
          }
       });

       if (catSlotCount > 0) {
           catRows.forEach((row, rowLocalIdx) => {
               row.activeSlots.forEach((slotItem, slotLocalIdx) => {
                   allTrs.push({
                       cat,
                       duty: row.duty,
                       slotItem,
                       isFirstOfCat: rowLocalIdx === 0 && slotLocalIdx === 0,
                       catSlotCount,
                       isFirstOfDuty: slotLocalIdx === 0,
                       dutySlotCount: row.activeSlots.length,
                       originalIdx: slotItem.originalIdx
                   });
               });
           });
       }
    });

    const xpDnaRowSpans = {}; 
    let currentXpDna = null;
    let currentXpDnaStartIdx = -1;

    allTrs.forEach((tr, idx) => {
        const xpDnaText = (tr.duty.xpDna || '-').trim();
        if (xpDnaText !== currentXpDna) {
            if (currentXpDnaStartIdx !== -1) {
                xpDnaRowSpans[currentXpDnaStartIdx] = idx - currentXpDnaStartIdx;
            }
            currentXpDna = xpDnaText;
            currentXpDnaStartIdx = idx;
            tr.isFirstOfXpDna = true;
        } else {
            tr.isFirstOfXpDna = false;
        }
    });
    if (currentXpDnaStartIdx !== -1) {
        xpDnaRowSpans[currentXpDnaStartIdx] = allTrs.length - currentXpDnaStartIdx;
    }

    const tableBodyRows = allTrs.map((tr, idx) => {
         const { cat, duty, slotItem, isFirstOfCat, catSlotCount, isFirstOfDuty, dutySlotCount, originalIdx, isFirstOfXpDna } = tr;
         const { slot, assignedData } = slotItem;
         
         const staff = branchData.staff?.find(s => s.id === assignedData.staffId);
         const staffName = staff ? staff.name : '-';
         const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot.shiftPresetId);
         const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);

         const stHour = parseInt(startTime.split(':')[0]) || 0;

         const isMorning = stHour < 11;
         const isLateMorning = stHour === 11;
         const isAfternoon = stHour >= 12 && stHour < 16;
         const isEvening = stHour >= 16 && stHour < 19;
         const isNight = stHour >= 19;
         const timeText = `${formatTimeAbbreviation(startTime)}-${formatTimeAbbreviation(endTime)}`;
         const otBadge = assignedData.otHours > 0 ? ` (O${assignedData.otHours})` : '';

         return (
            <tr key={`${duty.id}-${originalIdx}`} className={`text-center h-10 sm:h-12 border border-slate-800 ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>
               {isFirstOfCat && (
                  <td rowSpan={catSlotCount} className="border border-slate-800 p-2 font-black uppercase leading-tight bg-black/10" style={{ fontSize: `${rs.fontDuty || rs.fontSize}px` }}>{cat.label}</td>
               )}
               {isFirstOfXpDna && (
                  <td rowSpan={xpDnaRowSpans[idx]} className="border border-slate-800 p-2 text-left whitespace-pre-wrap leading-tight opacity-90" style={{ fontSize: `${rs.fontXpDna || (rs.fontSize * 0.8)}px` }}>{duty.xpDna || '-'}</td>
               )}
               {isFirstOfDuty && (
                  <React.Fragment>
                     <td rowSpan={dutySlotCount} className="border border-slate-800 p-2 font-black text-left leading-tight" style={{ fontSize: `${rs.fontJobA || rs.fontSize}px` }}>{duty.jobA}</td>
                     <td rowSpan={dutySlotCount} className="border border-slate-800 p-2 text-left leading-tight opacity-80" style={{ fontSize: `${rs.fontJobB || (rs.fontSize * 0.8)}px` }}>{duty.jobB}</td>
                     <td rowSpan={dutySlotCount} className="border border-slate-800 p-2 font-black" style={{ fontSize: `${rs.fontCount || (rs.fontSize * 1.2)}px` }}><u className="underline-offset-2">{dutySlotCount}</u></td>
                  </React.Fragment>
               )}
               <td className="border border-slate-800 p-2 text-left font-bold" style={{ fontSize: `${rs.fontName || rs.fontSize}px` }}>
                   <div className="flex justify-between items-center">
                       <span>{staffName}<span className="opacity-80 ml-1 font-black">{otBadge}</span></span>
                       {staff && <span className={`px-1.5 py-0.5 rounded font-black uppercase bg-black/10 border border-current opacity-80`} style={{ fontSize: `${(rs.fontName || rs.fontSize) * 0.8}px` }}>{staff.pos}</span>}
                   </div>
               </td>
               {activeDayShiftVisibilities.hasMorning && <td className={`border border-slate-800 p-2 font-bold ${isMorning ? 'shadow-inner' : 'opacity-30'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isMorning ? timeText : ''}</td>}
               {activeDayShiftVisibilities.hasLateMorning && <td className={`border border-slate-800 p-2 font-bold ${isLateMorning ? 'shadow-inner' : 'opacity-30'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isLateMorning ? timeText : ''}</td>}
               {activeDayShiftVisibilities.hasAfternoon && <td className={`border border-slate-800 p-2 font-bold ${isAfternoon ? 'shadow-inner' : 'opacity-30'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isAfternoon ? timeText : ''}</td>}
               {activeDayShiftVisibilities.hasEvening && <td className={`border border-slate-800 p-2 font-bold ${isEvening ? 'shadow-inner' : 'opacity-30'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isEvening ? timeText : ''}</td>}
               {activeDayShiftVisibilities.hasNight && <td className={`border border-slate-800 p-2 font-bold ${isNight ? 'shadow-inner' : 'opacity-30'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isNight ? timeText : ''}</td>}
               <td className="border border-slate-800 p-2 bg-black/10" style={{ fontSize: `${rs.fontBreak || rs.fontSize}px` }}></td>
            </tr>
         );
    });

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
                   <h1 className="font-black uppercase tracking-tighter" style={{ fontSize: `${rs.headlineSize || 24}px` }}>แผนงานประจำวัน{activeDept === 'service' ? 'แผนกบริการ (FOH)' : 'แผนกครัว (BOH)'}</h1>
                   <p className="font-bold text-slate-600 mt-2" style={{ fontSize: `${rs.subHeadlineSize || 14}px` }}>วัน{activeDay.dayLabel} ที่ <span className="underline underline-offset-4">{activeDay.dayNum}</span> เดือน <span className="underline underline-offset-4">{THAI_MONTHS[selectedMonth]}</span> พ.ศ. <span className="underline underline-offset-4">{selectedYear + 543}</span></p>
                </div>
                <table className="w-full border-collapse border-2 border-slate-800 min-w-[1100px] bg-white print:min-w-0" style={{ fontSize: `${rs.fontSize}px` }}>
                   <thead>
                      <tr className="text-center font-black" style={{ backgroundColor: rs.headerBg, color: '#0f172a', fontSize: `${rs.headerFontSize || 10}px` }}>
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colDuty}%` }}>กลุ่มงาน (DUTY)</th>
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colXpDna}%` }}>XP-DNA SOP</th>
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colJobA}%` }}>รายละเอียดงานหลัก (JOB A)</th>
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colJobB}%` }}>งานรอง (JOB B)</th>
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colCount}%` }}>จำนวน</th>
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colName}%` }}>ชื่อพนักงาน</th>
                         {activeDayShiftVisibilities.hasMorning && <th className="border border-slate-800 p-2" style={{ width: `${rs.colShift}%`, backgroundColor: rs.shiftHeaderBg }}>เช้า(เปิด)</th>}
                         {activeDayShiftVisibilities.hasLateMorning && <th className="border border-slate-800 p-2" style={{ width: `${rs.colShift}%`, backgroundColor: rs.shiftHeaderBg }}>สาย</th>}
                         {activeDayShiftVisibilities.hasAfternoon && <th className="border border-slate-800 p-2" style={{ width: `${rs.colShift}%`, backgroundColor: rs.shiftHeaderBg }}>บ่าย</th>}
                         {activeDayShiftVisibilities.hasEvening && <th className="border border-slate-800 p-2" style={{ width: `${rs.colShift}%`, backgroundColor: rs.shiftHeaderBg }}>เย็น</th>}
                         {activeDayShiftVisibilities.hasNight && <th className="border border-slate-800 p-2" style={{ width: `${rs.colShift}%`, backgroundColor: rs.shiftHeaderBg }}>ดึก(ปิด)</th>}
                         <th className="border border-slate-800 p-2" style={{ width: `${rs.colBreak}%` }}>รอบพัก</th>
                      </tr>
                   </thead>
                   <tbody>
                      {tableBodyRows}
                      <tr className="text-center bg-slate-50 print:bg-slate-100 font-black h-10 sm:h-12">
                         <td colSpan={4} className="border border-slate-800 p-2 text-right pr-6 uppercase tracking-widest text-slate-800" style={{ fontSize: `${rs.headerFontSize || 10}px` }}>Total Staff (เฉพาะที่มีรายชื่อ)</td>
                         <td className="border border-slate-800 p-2 text-indigo-600" style={{ fontSize: `${rs.fontCount || 12}px` }}><u className="underline-offset-2">{totalAssignedAll}</u></td>
                         <td colSpan={activeDayShiftVisibilities.bottomColSpan + 1} className="border border-slate-800 p-2"></td>
                      </tr>
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    );
  }

  function renderManagerMonthly() {
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
                   <button onClick={handleExportMonthlyRoster} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex justify-center items-center gap-2 shadow-md active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
                      <Download className="w-4 h-4" /> Export CSV
                   </button>
                </div>
             </div>
             
             {/* ส่วนบันทึกการลาหยุดในหน้ารายเดือน */}
             <div className="bg-slate-50 p-6 sm:p-8 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                   <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-3"><PlaneTakeoff className="w-5 h-5 text-indigo-600" /> บันทึกการลาหยุดงาน (เลือกวันที่ต้องการ)</h3>
                   <input type="date" value={selectedDateStr} onChange={(e) => setSelectedDateStr(e.target.value)} className="border-2 border-slate-200 rounded-xl px-4 py-2 font-bold text-sm text-indigo-700 outline-none focus:border-indigo-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                   {LEAVE_TYPES.map(lt => {
                      const selectedStaffIds = (schedule[selectedDateStr]?.leaves || []).filter(l => l.type === lt.id).map(l => l.staffId);
                      const staffOptions = branchData.staff?.filter(s => { if (s.dept !== activeDept) return false; return !(usedStaffIds.includes(s.id) && !selectedStaffIds.includes(s.id)); }) || [];
                      const isHoliday = branchData.holidays?.includes?.(selectedDateStr);
                      const isBlocked = isHoliday && lt.id === 'OFF';
                      return (
                         <div key={lt.id} className={`bg-white p-4 rounded-[1.5rem] flex flex-col gap-3 border border-slate-200 shadow-sm ${isBlocked ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                            <div className="flex items-center gap-2">
                               <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${lt.color} border border-white shadow-sm flex-shrink-0`}>{lt.shortLabel}</span>
                               <span className="text-xs font-black text-slate-700 truncate">{lt.label} {isBlocked && '(ห้าม)'}</span>
                            </div>
                            <StaffMultiSelector value={selectedStaffIds} options={staffOptions} onChange={(newIds) => handleLeaveChange(selectedDateStr, lt.id, newIds)} placeholder="เลือกพนักงาน..." />
                         </div>
                      );
                   })}
                </div>
             </div>

             <div className="overflow-auto custom-scrollbar" style={{ maxHeight: '60vh' }}>
                <table className="w-full border-collapse text-left min-w-[1200px]">
                   <thead className="bg-white sticky top-0 z-20 shadow-sm">
                   <tr>
                      <th className="p-4 sm:p-6 border-b border-r border-slate-200 min-w-[150px] sticky left-0 bg-white z-30 font-black text-[10px] text-slate-500 uppercase tracking-widest">กลุ่มงาน (DUTY)</th>
                      <th className="p-4 sm:p-6 border-b border-r border-slate-200 min-w-[250px] sticky left-[150px] bg-white z-30 font-black text-[10px] text-slate-500 uppercase tracking-widest">รายละเอียดงาน</th>
                      {CALENDAR_DAYS.map(day => (
                         <th key={day.dateStr} className="p-3 border-b border-r border-slate-100 text-center min-w-[120px]">
                             <div className="text-lg font-black text-slate-800">{day.dayNum}</div>
                             <div className="text-[9px] font-bold text-slate-400 uppercase">{day.dayLabel}</div>
                         </th>
                      ))}
                   </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                   {DUTY_CATEGORIES[activeDept].map(cat => {
                       const catDuties = CURRENT_DUTY_LIST.filter(d => d.category === cat.id);
                       if (catDuties.length === 0) return null;
                       return catDuties.map((duty, dIdx) => {
                           const reqArr = Array.isArray(duty.reqPos) ? duty.reqPos : [duty.reqPos || 'ALL'];
                           return (
                               <tr key={duty.id} className="hover:bg-slate-50 transition-colors">
                                   {dIdx === 0 && (
                                       <td rowSpan={catDuties.length} className={`p-4 border-r border-slate-200 sticky left-0 z-10 align-top ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>
                                           <div className="font-black text-[10px] sm:text-xs uppercase leading-tight">{cat.label}</div>
                                       </td>
                                   )}
                                   <td className="p-4 border-r border-slate-200 sticky left-[150px] bg-white z-10 align-top">
                                       <div className="font-black text-sm text-slate-800 leading-tight mb-1">{duty.jobA}</div>
                                       <div className="font-bold text-[9px] text-slate-500 leading-tight">{duty.jobB}</div>
                                       <div className="mt-2 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase bg-slate-50 text-slate-500 inline-block">{(duty.reqPos || ['ALL']).join(', ')}</div>
                                   </td>
                                   {CALENDAR_DAYS.map(day => {
                                       const slots = branchData.matrix?.[day.type]?.duties?.[duty.id] || [];
                                       const assigned = schedule[day.dateStr]?.duties?.[duty.id] || [];
                                       const dayUsedStaffIds = new Set();
                                       (schedule[day.dateStr]?.leaves || []).forEach(l => l.staffId && dayUsedStaffIds.add(l.staffId));
                                       Object.values(schedule[day.dateStr]?.duties || {}).forEach(sls => sls.forEach(s => s.staffId && dayUsedStaffIds.add(s.staffId)));

                                       return (
                                           <td key={day.dateStr} className="p-2 border-r border-slate-100 align-top bg-white">
                                               <div className="space-y-2">
                                                  {slots.map((matrixSlot, idx) => {
                                                      const data = assigned[idx] || { staffId: "", otHours: 0 };
                                                      const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);
                                                      const shiftName = shiftPreset ? shiftPreset.name : 'N/A';
                                                      return (
                                                          <div key={idx} className={`p-2 rounded-lg border ${!data.staffId ? 'border-dashed border-slate-200 bg-slate-50/50' : 'border-indigo-200 bg-indigo-50/30'}`}>
                                                             <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[8px] font-bold text-slate-400">{shiftName}</span>
                                                                {data.otHours > 0 && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1 rounded">OT:{data.otHours}</span>}
                                                             </div>
                                                             <select value={data.staffId} onChange={(e) => handleScheduleUpdate(day.dateStr, duty.id, idx, 'staffId', e.target.value, matrixSlot.maxOtHours)} className="w-full text-[10px] font-bold bg-transparent outline-none text-slate-800 truncate">
                                                                <option value="">-- ว่าง --</option>
                                                                {branchData.staff?.filter(s => s.dept === activeDept).map(s => {
                                                                   const isUsed = dayUsedStaffIds.has(s.id) && data.staffId !== s.id;
                                                                   const wrongPos = !checkPositionEligibility(s.pos, reqArr, activeDept) && data.staffId !== s.id;
                                                                   return (isUsed || wrongPos) ? null : <option key={s.id} value={s.id}>{s.name}</option>
                                                                })}
                                                             </select>
                                                          </div>
                                                      )
                                                  })}
                                               </div>
                                           </td>
                                       )
                                   })}
                               </tr>
                           )
                       })
                   })}
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    );
  }

  function renderReportView() {
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
                      const layer = getStaffLayer(s.dept, s.pos);
                      return (
                      <tr key={idx} className="hover:bg-slate-50 transition duration-300">
                         <td className="px-6 sm:px-12 py-4 sm:py-8 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 border-r border-slate-50">
                            <p className="font-black text-slate-900 uppercase text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">{s.name}</p>
                            <span className={`mt-1 inline-block text-[8px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded ${layer.color.split(' ')[0]} ${layer.color.split(' ')[1]}`}>{s.dept} - {s.pos}</span>
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
  }

  function renderTemplatesCard() {
    return (
       <div className="bg-emerald-50 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-emerald-100 shadow-sm w-full flex flex-col h-full print:hidden">
          <h2 className="text-lg sm:text-xl font-black text-emerald-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><SaveAll className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" /> จัดการแม่แบบ (Templates)</h2>
          <p className="text-xs font-bold text-emerald-600 mb-4">บันทึกการตั้งค่าทั้งหมด (หน้าที่งาน, โครงสร้างกะ, ชื่อกะ, วันหยุดสาขา) ของ <span className="uppercase font-black text-emerald-800">"ทั้งสองแผนก"</span> ไว้ใช้ในภายหลัง</p>
          {authRole === 'superadmin' ? (
              <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-white p-4 rounded-2xl border border-emerald-200">
                 <input type="text" placeholder="ตั้งชื่อแม่แบบใหม่" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-emerald-500" />
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
    );
  }

  function renderRosterStyleSettings() {
      const rs = branchData.rosterStyle || {
          fontSize: 10, headerBg: '#f1f5f9', shiftHeaderBg: '#e0f2fe',
          colDuty: 8, colXpDna: 10, colJobA: 15, colJobB: 10, colCount: 4, colName: 15, colShift: 7, colBreak: 8,
          headlineSize: 24, subHeadlineSize: 14, headerFontSize: 10,
          fontDuty: 10, fontXpDna: 8, fontJobA: 10, fontJobB: 8, fontCount: 12, fontName: 10, fontShift: 10, fontBreak: 10
      };
      const handleChange = async (field, value) => {
          const nd = JSON.parse(JSON.stringify(branchData));
          if (!nd.rosterStyle) nd.rosterStyle = { ...rs };
          nd.rosterStyle[field] = value;
          setBranchData(nd);
          if (activeBranchId) {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
          }
      };

      return (
         <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full flex flex-col h-full print:hidden mt-6 sm:mt-10">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter">
                <Printer className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> ตั้งค่าหน้าตาตาราง Duty Roster (รายวัน)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 md:col-span-3">
                    <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest border-b border-slate-200 pb-2">1. สีและหัวข้อ (Colors & Headers)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ขนาดหัวข้อหลัก (px)</label>
                            <input type="number" value={rs.headlineSize} onChange={(e) => handleChange('headlineSize', parseInt(e.target.value) || 24)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ขนาดวันที่ (px)</label>
                            <input type="number" value={rs.subHeadlineSize} onChange={(e) => handleChange('subHeadlineSize', parseInt(e.target.value) || 14)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ขนาดฟอนต์ตารางเริ่มต้น</label>
                            <input type="number" value={rs.fontSize} onChange={(e) => handleChange('fontSize', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ขนาดฟอนต์หัวตาราง</label>
                            <input type="number" value={rs.headerFontSize} onChange={(e) => handleChange('headerFontSize', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">สีพื้นหลังหัวตาราง</label>
                            <div className="flex gap-2">
                               <input type="color" value={rs.headerBg} onChange={(e) => handleChange('headerBg', e.target.value)} className="h-8 w-8 rounded cursor-pointer flex-shrink-0" />
                               <input type="text" value={rs.headerBg} onChange={(e) => handleChange('headerBg', e.target.value)} className="flex-1 border rounded-xl px-2 py-1 text-xs font-bold outline-none min-w-0" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">สีพื้นหลังกะทำงาน</label>
                            <div className="flex gap-2">
                               <input type="color" value={rs.shiftHeaderBg} onChange={(e) => handleChange('shiftHeaderBg', e.target.value)} className="h-8 w-8 rounded cursor-pointer flex-shrink-0" />
                               <input type="text" value={rs.shiftHeaderBg} onChange={(e) => handleChange('shiftHeaderBg', e.target.value)} className="flex-1 border rounded-xl px-2 py-1 text-xs font-bold outline-none min-w-0" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3 space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                    <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest border-b border-slate-200 pb-2">2. ความกว้างคอลัมน์ (%, รวมควรใกล้เคียง 100%)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">กลุ่มงาน (DUTY)</label>
                            <input type="number" value={rs.colDuty} onChange={(e) => handleChange('colDuty', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">XP-DNA SOP</label>
                            <input type="number" value={rs.colXpDna} onChange={(e) => handleChange('colXpDna', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">งานหลัก (JOB A)</label>
                            <input type="number" value={rs.colJobA} onChange={(e) => handleChange('colJobA', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">งานรอง (JOB B)</label>
                            <input type="number" value={rs.colJobB} onChange={(e) => handleChange('colJobB', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">จำนวนคน</label>
                            <input type="number" value={rs.colCount} onChange={(e) => handleChange('colCount', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ชื่อพนักงาน</label>
                            <input type="number" value={rs.colName} onChange={(e) => handleChange('colName', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">กะเวลา (ต่อ 1 ช่อง)</label>
                            <input type="number" value={rs.colShift} onChange={(e) => handleChange('colShift', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">รอบพัก</label>
                            <input type="number" value={rs.colBreak} onChange={(e) => handleChange('colBreak', parseInt(e.target.value) || 0)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3 space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                    <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest border-b border-slate-200 pb-2">3. ขนาดฟอนต์แต่ละคอลัมน์ (px)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">กลุ่มงาน (DUTY)</label>
                            <input type="number" value={rs.fontDuty} onChange={(e) => handleChange('fontDuty', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">XP-DNA SOP</label>
                            <input type="number" value={rs.fontXpDna} onChange={(e) => handleChange('fontXpDna', parseInt(e.target.value) || 8)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">งานหลัก (JOB A)</label>
                            <input type="number" value={rs.fontJobA} onChange={(e) => handleChange('fontJobA', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">งานรอง (JOB B)</label>
                            <input type="number" value={rs.fontJobB} onChange={(e) => handleChange('fontJobB', parseInt(e.target.value) || 8)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">จำนวนคน</label>
                            <input type="number" value={rs.fontCount} onChange={(e) => handleChange('fontCount', parseInt(e.target.value) || 12)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">ชื่อพนักงาน</label>
                            <input type="number" value={rs.fontName} onChange={(e) => handleChange('fontName', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">กะเวลา</label>
                            <input type="number" value={rs.fontShift} onChange={(e) => handleChange('fontShift', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">รอบพัก</label>
                            <input type="number" value={rs.fontBreak} onChange={(e) => handleChange('fontBreak', parseInt(e.target.value) || 10)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                </div>
            </div>
         </div>
      );
  }

  function renderMatrixSettings() {
    if (!branchData.matrix) return null;

    return (
       <div className="space-y-6 sm:space-y-8 w-full mt-6 sm:mt-10 print:hidden">
         <h2 className="text-xl sm:text-2xl font-black text-slate-800 px-2 uppercase tracking-tighter flex items-center gap-3 sm:gap-4"><Clock className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" /> โครงสร้างกะงานฝั่ง: {activeDept === 'service' ? 'บริการ' : 'ครัว'}</h2>
         {Object.entries(branchData.matrix || {}).map(([key, data]) => (
           <div key={key} className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm mb-6 sm:mb-10 w-full">
             <div className={`px-6 sm:px-10 py-4 sm:py-6 font-black text-base sm:text-lg text-white ${key==='weekday' ? 'bg-slate-900' : key==='friday' ? 'bg-sky-700' : 'bg-orange-600'}`}>{key.toUpperCase()} CYCLE {authRole === 'branch' ? '(VIEW ONLY)' : ''}</div>
             <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-xs text-left min-w-[800px]">
                 <tbody className="divide-y divide-slate-100">
                   {CURRENT_DUTY_LIST.map(duty => {
                     const catInfo = DUTY_CATEGORIES[activeDept]?.find(c => c.id === duty.category);
                     return (
                     <tr key={duty.id}>
                       <td className="px-6 sm:px-10 py-6 sm:py-8 w-[30%]">
                          <div className="font-black text-slate-900 text-sm sm:text-lg mb-1 leading-tight flex items-center gap-2">
                             {catInfo && <div className={`w-3 h-3 rounded-full ${catInfo.color.split(' ')[0]}`} title={catInfo.label}></div>}
                             {duty.jobA}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic leading-tight mt-1 sm:ml-5">{duty.jobB}</div>
                       </td>
                       <td className="px-6 sm:px-10 py-6 sm:py-8">
                         <div className="flex flex-wrap gap-4 sm:gap-6">
                           {(data.duties?.[duty.id] || []).map((matrixSlot, idx) => (
                              <div key={idx} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.2rem] border-2 border-slate-50 shadow-sm transition hover:border-indigo-100 relative w-60">
                                  <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 w-full">
                                      <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">กะ</span>
                                      <select disabled={authRole === 'branch'} value={matrixSlot.shiftPresetId || ''}
                                          onChange={(e) => {
                                              const nd = JSON.parse(JSON.stringify(branchData));
                                              if (nd.matrix?.[key]?.duties?.[duty.id]?.[idx]) { nd.matrix[key].duties[duty.id][idx].shiftPresetId = e.target.value; setBranchData(nd); }
                                          }}
                                          onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }}
                                          className="w-full border rounded-xl p-1.5 sm:p-2 text-[10px] sm:text-xs font-black disabled:bg-slate-50 disabled:text-slate-300 outline-none focus:border-indigo-500">
                                          <option value="" disabled>-- เลือกกะ --</option>
                                          {(branchData.shiftPresets || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>

                                      <span className="text-[8px] sm:text-[9px] font-black text-indigo-500 uppercase">MAX OT</span>
                                      <input type="number" disabled={authRole === 'branch'} step="0.5" className="w-full border rounded-xl p-1.5 sm:p-2 text-center font-black bg-indigo-50/50 disabled:opacity-50 outline-none focus:border-indigo-500 text-[10px] sm:text-xs" value={matrixSlot.maxOtHours}
                                          onChange={(e) => {
                                              const nd = JSON.parse(JSON.stringify(branchData));
                                              if (nd.matrix?.[key]?.duties?.[duty.id]?.[idx]) { nd.matrix[key].duties[duty.id][idx].maxOtHours = parseFloat(e.target.value) || 0; setBranchData(nd); }
                                          }} 
                                          onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} />
                                  </div>
                                  {authRole === 'superadmin' && <button onClick={async () => {
                                      const nd = JSON.parse(JSON.stringify(branchData));
                                      if (Array.isArray(nd.matrix?.[key]?.duties?.[duty.id])) {
                                          nd.matrix[key].duties[duty.id].splice(idx, 1);
                                          setBranchData(nd);
                                          if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
                                      }
                                  }} className="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full p-1.5 transition"><X className="w-3 h-3"/></button>}
                              </div>
                           ))}
                           {authRole === 'superadmin' && <button onClick={async () => { 
                               const nd = JSON.parse(JSON.stringify(branchData)); 
                               if(!nd.matrix[key].duties[duty.id]) nd.matrix[key].duties[duty.id] = []; 
                               const defaultPresetId = branchData.shiftPresets?.[0]?.id || 'S1';
                               nd.matrix[key].duties[duty.id].push({shiftPresetId: defaultPresetId, maxOtHours:4.0}); 
                               setBranchData(nd); 
                               if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd); 
                           }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-4 sm:px-6 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2.2rem] text-[9px] sm:text-[11px] font-black text-slate-400 hover:border-indigo-500 transition self-stretch sm:self-center">+ SLOT</button>}
                         </div>
                       </td>
                     </tr>
                   )})}
                 </tbody>
               </table>
             </div>
           </div>
         ))}
       </div>
    );
  }

  function renderGuideView() {
    const guideSteps = globalConfig.guideSteps || DEFAULT_GUIDE_STEPS;
    const siteMapData = isEditingGuide ? editSiteMap : (globalConfig.siteMap || DEFAULT_SITE_MAP);
    const workflowData = isEditingGuide ? editWorkflow : (globalConfig.workflow || DEFAULT_WORKFLOW);
    const headerData = isEditingGuide ? editGuideHeader : (globalConfig.guideHeader || DEFAULT_GUIDE_HEADER);

    const toggleGuideEdit = () => {
        if (isEditingGuide) { 
            handleSaveGuide(); 
        } else { 
            setEditGuideSteps(guideSteps); 
            setEditSiteMap(globalConfig.siteMap || DEFAULT_SITE_MAP);
            setEditWorkflow(globalConfig.workflow || DEFAULT_WORKFLOW);
            setEditGuideHeader(globalConfig.guideHeader || DEFAULT_GUIDE_HEADER);
            setIsEditingGuide(true); 
        }
    };

    return (
       <div className="flex-1 space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-24 w-full max-w-5xl mx-auto">
          {/* Site Map & Workflow Card */}
          <div className="bg-slate-900 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-800 shadow-xl text-white flex flex-col gap-6">
             <div className="flex items-center justify-between border-b border-slate-700 pb-6">
                <div className="flex items-center gap-4 sm:gap-6 flex-1 pr-4">
                    <div className="bg-white/10 p-4 rounded-[1.5rem]"><LayoutDashboard className="w-8 h-8 text-white" /></div>
                    {isEditingGuide ? (
                       <div className="space-y-2 w-full max-w-md">
                          <input type="text" value={headerData.title} onChange={e => setEditGuideHeader({...editGuideHeader, title: e.target.value})} className="w-full bg-slate-800 text-white font-black text-xl sm:text-2xl border border-slate-600 rounded-lg px-3 py-1 outline-none focus:border-emerald-500" placeholder="หัวข้อหลัก..." />
                          <input type="text" value={headerData.subtitle} onChange={e => setEditGuideHeader({...editGuideHeader, subtitle: e.target.value})} className="w-full bg-slate-800 text-slate-300 font-bold text-xs sm:text-sm border border-slate-600 rounded-lg px-3 py-1 outline-none focus:border-emerald-500" placeholder="คำอธิบาย..." />
                       </div>
                    ) : (
                       <div>
                          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase">{headerData.title}</h2>
                          <p className="text-slate-400 text-xs sm:text-sm font-bold mt-1">{headerData.subtitle}</p>
                       </div>
                    )}
                </div>
                {authRole === 'superadmin' && (
                   <button onClick={toggleGuideEdit} className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-sm ${isEditingGuide ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'}`}>
                      {isEditingGuide ? <><Save className="w-4 h-4"/> บันทึกภาพรวม</> : <><Edit2 className="w-4 h-4"/> แก้ไขภาพรวม</>}
                   </button>
                )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {siteMapData.map((col, cIdx) => (
                    <div key={col.id} className="bg-white/5 p-5 rounded-2xl border border-white/10">
                       {isEditingGuide ? (
                           <div className="space-y-3">
                               <input type="text" value={col.title} onChange={e => { const n = [...editSiteMap]; n[cIdx].title = e.target.value; setEditSiteMap(n); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm font-black outline-none focus:border-emerald-500 text-white" placeholder="ชื่อหมวดหมู่..." />
                               <textarea value={(col.items || []).join('\n')} onChange={e => { const n = [...editSiteMap]; n[cIdx].items = e.target.value.split('\n'); setEditSiteMap(n); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs font-bold outline-none focus:border-emerald-500 text-white resize-y" rows={6} placeholder="รายละเอียด (ขึ้นบรรทัดใหม่ = 1 รายการ)"></textarea>
                           </div>
                       ) : (
                           <React.Fragment>
                               <h3 className={`font-black ${col.color || 'text-white'} mb-3 flex items-center gap-2`}><LayoutDashboard className="w-4 h-4"/> {col.title}</h3>
                               <ul className="text-xs font-bold text-slate-300 space-y-2 list-disc list-inside whitespace-pre-wrap">
                                  {(col.items || []).map((item, i) => item.trim() ? <li key={i}>{item}</li> : null)}
                               </ul>
                           </React.Fragment>
                       )}
                    </div>
                ))}
             </div>

             <div className="mt-2 bg-white/5 p-5 rounded-2xl border border-white/10 overflow-x-auto custom-scrollbar pb-4 sm:pb-6">
                <h3 className="font-black text-sky-400 mb-4 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4"/> Manager Workflow (รายเดือน)</h3>
                <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-black text-slate-300 w-max mb-6">
                   {workflowData.monthly.map((step, sIdx) => {
                       const theme = getWorkflowTheme(step.theme);
                       return (
                           <React.Fragment key={step.id}>
                               {isEditingGuide ? (
                                   <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-600">
                                       <textarea value={step.text} onChange={e => { const n = {...editWorkflow}; n.monthly[sIdx].text = e.target.value; setEditWorkflow(n); }} className="bg-transparent outline-none w-32 text-[10px] resize-none text-white" rows={2} />
                                       <select value={step.theme} onChange={e => { const n = {...editWorkflow}; n.monthly[sIdx].theme = e.target.value; setEditWorkflow(n); }} className="bg-slate-700 text-[10px] outline-none rounded p-1 text-white"><option value="emerald">เขียว</option><option value="indigo">ม่วง</option><option value="orange">ส้ม</option><option value="sky">ฟ้า</option></select>
                                       <button onClick={() => { const n = {...editWorkflow}; n.monthly.splice(sIdx, 1); setEditWorkflow(n); }} className="text-red-400 hover:text-red-300"><X className="w-3 h-3"/></button>
                                   </div>
                               ) : (
                                   <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 whitespace-pre-wrap ${theme.wrap}`}>
                                       <span className={`w-5 h-5 rounded-full flex items-center justify-center ${theme.dot}`}>{sIdx + 1}</span>
                                       {step.text}
                                   </div>
                               )}
                               {(sIdx < workflowData.monthly.length - 1 || isEditingGuide) && <span className="text-slate-600">→</span>}
                           </React.Fragment>
                       )
                   })}
                   {isEditingGuide && (
                       <button onClick={() => { const n = {...editWorkflow}; n.monthly.push({ id: 'WM'+Date.now(), text: 'NEW\nSTEP', theme: 'indigo' }); setEditWorkflow(n); }} className="bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 transition">+ เพิ่ม</button>
                   )}
                </div>
                <div className="h-px w-full bg-white/10 mb-6"></div>
                <h3 className="font-black text-amber-400 mb-4 flex items-center gap-2"><CalendarDaysIcon className="w-4 h-4"/> Manager Workflow (รายวัน)</h3>
                <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-black text-slate-300 w-max">
                   {workflowData.daily.map((step, sIdx) => {
                       const theme = getWorkflowTheme(step.theme);
                       return (
                           <React.Fragment key={step.id}>
                               {isEditingGuide ? (
                                   <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-600">
                                       <textarea value={step.text} onChange={e => { const n = {...editWorkflow}; n.daily[sIdx].text = e.target.value; setEditWorkflow(n); }} className="bg-transparent outline-none w-32 text-[10px] resize-none text-white" rows={2} />
                                       <select value={step.theme} onChange={e => { const n = {...editWorkflow}; n.daily[sIdx].theme = e.target.value; setEditWorkflow(n); }} className="bg-slate-700 text-[10px] outline-none rounded p-1 text-white"><option value="emerald">เขียว</option><option value="indigo">ม่วง</option><option value="orange">ส้ม</option><option value="sky">ฟ้า</option></select>
                                       <button onClick={() => { const n = {...editWorkflow}; n.daily.splice(sIdx, 1); setEditWorkflow(n); }} className="text-red-400 hover:text-red-300"><X className="w-3 h-3"/></button>
                                   </div>
                               ) : (
                                   <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 whitespace-pre-wrap ${theme.wrap}`}>
                                       <span className={`w-5 h-5 rounded-full flex items-center justify-center ${theme.dot}`}>{sIdx + 1}</span>
                                       {step.text}
                                   </div>
                               )}
                               {(sIdx < workflowData.daily.length - 1 || isEditingGuide) && <span className="text-slate-600">→</span>}
                           </React.Fragment>
                       )
                   })}
                   {isEditingGuide && (
                       <button onClick={() => { const n = {...editWorkflow}; n.daily.push({ id: 'WD'+Date.now(), text: 'NEW\nSTEP', theme: 'sky' }); setEditWorkflow(n); }} className="bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 transition">+ เพิ่ม</button>
                   )}
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col gap-6">
             <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4 sm:gap-6 flex-1 pr-4">
                   <div className="bg-indigo-100 p-4 rounded-[1.5rem]"><BookOpen className="w-8 h-8 text-indigo-600" /></div>
                   {isEditingGuide ? (
                       <div className="space-y-2 w-full max-w-md">
                          <input type="text" value={headerData.journeyTitle} onChange={e => setEditGuideHeader({...editGuideHeader, journeyTitle: e.target.value})} className="w-full bg-slate-50 text-slate-800 font-black text-xl sm:text-2xl border border-slate-200 rounded-lg px-3 py-1 outline-none focus:border-indigo-500" placeholder="หัวข้อ Journey..." />
                          <input type="text" value={headerData.journeySubtitle} onChange={e => setEditGuideHeader({...editGuideHeader, journeySubtitle: e.target.value})} className="w-full bg-slate-50 text-slate-500 font-bold text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-1 outline-none focus:border-indigo-500" placeholder="คำอธิบาย..." />
                       </div>
                   ) : (
                       <div>
                          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter uppercase">{headerData.journeyTitle}</h2>
                          <p className="text-slate-400 text-xs sm:text-sm font-bold mt-1">{headerData.journeySubtitle}</p>
                       </div>
                   )}
                </div>
                {authRole === 'superadmin' && (
                   <button onClick={toggleGuideEdit} className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-sm ${isEditingGuide ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {isEditingGuide ? <><Save className="w-4 h-4"/> บันทึกคู่มือ</> : <><Edit2 className="w-4 h-4"/> แก้ไขคู่มือ</>}
                   </button>
                )}
             </div>

             <div className="space-y-8 mt-2">
                {isEditingGuide ? (
                   <React.Fragment>
                       {editGuideSteps.map((step, idx) => (
                           <div key={step.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                               <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                                  <div className={`w-10 h-10 rounded-xl text-white font-black flex items-center justify-center flex-shrink-0 ${step.color}`}>
                                      <input type="text" value={step.stepNum} onChange={e => { const n = [...editGuideSteps]; n[idx].stepNum = e.target.value; setEditGuideSteps(n); }} className="w-full text-center bg-transparent outline-none text-white placeholder-white/50" placeholder="#" />
                                  </div>
                                  <input type="text" value={step.title} onChange={e => {
                                      const n = [...editGuideSteps]; n[idx].title = e.target.value; setEditGuideSteps(n);
                                  }} className="flex-1 w-full sm:w-auto border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-500" placeholder="หัวข้อ..." />
                                  <select value={step.color} onChange={e => { const n = [...editGuideSteps]; n[idx].color = e.target.value; setEditGuideSteps(n); }} className="border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold outline-none text-slate-600">
                                      <option value="bg-emerald-500">เขียว</option><option value="bg-indigo-600">ม่วง</option><option value="bg-orange-500">ส้ม</option><option value="bg-sky-500">ฟ้า</option><option value="bg-rose-500">แดง</option><option value="bg-slate-900">ดำ</option>
                                  </select>
                                  <button onClick={() => { setEditGuideSteps(editGuideSteps.filter(s => s.id !== step.id)); }} className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition shadow-sm"><Trash2 className="w-4 h-4"/></button>
                               </div>
                               <div className="flex flex-col shadow-sm rounded-xl">
                                   {renderRichTextToolbar(`guide-editor-${step.id}`, step.content, (val) => {
                                       const n = [...editGuideSteps]; n[idx].content = val; setEditGuideSteps(n);
                                   })}
                                   <div className="flex flex-col md:flex-row border border-slate-200 border-t-0 rounded-b-xl overflow-hidden min-h-[150px]">
                                       <textarea id={`guide-editor-${step.id}`} value={step.content} onChange={e => { const n = [...editGuideSteps]; n[idx].content = e.target.value; setEditGuideSteps(n); }} className="w-full md:w-1/2 p-4 text-xs font-medium outline-none focus:border-indigo-500 resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[150px]" placeholder="รายละเอียด... (รองรับ HTML)"></textarea>
                                       <div className="w-full md:w-1/2 p-4 bg-slate-50 text-xs text-slate-600 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: step.content || '<span class="text-slate-400 italic font-bold">แสดงผลตัวอย่าง (Preview)...</span>' }}></div>
                                   </div>
                               </div>
                               <div>
                                   <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">URL รูปภาพอ้างอิง:</span>
                                   <input type="text" value={step.image} onChange={e => {
                                      const n = [...editGuideSteps]; n[idx].image = e.target.value; setEditGuideSteps(n);
                                  }} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="https://..." />
                               </div>
                           </div>
                       ))}
                       <button onClick={() => {
                           setEditGuideSteps([...editGuideSteps, { id: 'G'+Date.now(), title: 'หัวข้อใหม่', content: '', image: '', color: 'bg-indigo-600', stepNum: String(editGuideSteps.length + 1) }]);
                       }} className="w-full border-2 border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 py-4 rounded-2xl font-black transition flex items-center justify-center gap-2">
                           <Plus className="w-5 h-5"/> เพิ่มหัวข้อใหม่ (Add Step)
                       </button>
                   </React.Fragment>
                ) : (
                   guideSteps.map((step) => (
                       <div key={step.id} className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl text-white font-black text-lg sm:text-xl flex items-center justify-center flex-shrink-0 shadow-md ${step.color}`}>{step.stepNum}</div>
                          <div className="flex-1 w-full min-w-0">
                             <h3 className="text-base sm:text-lg font-black text-slate-800 mb-2">{step.title}</h3>
                             <div className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: step.content }} onClick={(e) => { if (e.target.tagName === 'IMG') setZoomedImage(e.target.src); }}></div>
                             {step.image && (
                                <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-slate-50 mt-2 cursor-zoom-in aspect-video relative group" onClick={() => setZoomedImage(step.image)}>
                                   <img src={step.image} alt={step.title} className="w-full h-full object-cover object-center opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
                                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                       <span className="bg-black/60 text-white px-4 py-2 rounded-xl text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md shadow-xl flex items-center gap-2">🔍 ขยายรูปภาพ</span>
                                   </div>
                                </div>
                             )}
                          </div>
                       </div>
                   ))
                )}
             </div>
          </div>
       </div>
    );
  }

  let mainContent = null;
  if (view === 'branches' && authRole === 'superadmin') {
    mainContent = renderGlobalAdmin();
  } else if (view === 'admin') {
    mainContent = activeBranchId ? renderBranchAdmin() : renderEmptyBranchAdmin();
  } else if (view === 'manager') {
    mainContent = (
       <div className="flex flex-col w-full gap-0">
          {managerViewMode === 'daily' && renderManagerDailyCards()}
          {managerViewMode === 'daily_table' && renderManagerDailyTable()}
          {managerViewMode === 'monthly' && renderManagerMonthly()}
       </div>
    );
  } else if (view === 'report') {
    mainContent = renderReportView();
  } else if (view === 'guide') {
    mainContent = renderGuideView();
  } else if (view === 'print') {
    mainContent = <PrintMonthlyView CALENDAR_DAYS={CALENDAR_DAYS} branchData={branchData} globalConfig={globalConfig} activeBranchId={activeBranchId} THAI_MONTHS={THAI_MONTHS} selectedMonth={selectedMonth} getStaffDayInfo={getStaffDayInfo} setView={setView} activeDept={activeDept} CURRENT_DUTY_LIST={CURRENT_DUTY_LIST} schedule={schedule} />;
  }

  return (
    <React.Fragment>
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
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background: white !important; -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; width: 100% !important; height: 100% !important; display: block !important; }
          .print\\:hidden { display: none !important; }
          nav, button, footer { display: none !important; }
          #root { display: block !important; height: 100% !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; height: 100% !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; }
              .print-roster-wrapper {
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: center !important;
                  align-items: center !important;
              width: 100% !important;
                  page-break-inside: avoid !important;
              }
          .print-roster-wrapper > div { width: 100% !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 2px solid #000 !important; margin: 0 auto !important; }
          th, td { border: 1px solid #000 !important; padding: 4px !important; }
        }
      `}} />

      {renderModals()}
      {renderLandingModal()}
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
                         <span className={`text-[8px] sm:text-[9px] font-black uppercase text-slate-400`}>{authRole === 'superadmin' ? 'BAR B Q PLAZA' : 'BRANCH MANAGEMENT'}</span>
                      </div>
                   </div>
                   {authRole === 'superadmin' && (
                      <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-1 ml-2 sm:ml-6 border border-slate-200 shadow-inner">
                         <ArrowLeftRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 mx-2 sm:mx-3" />
                         <select value={activeBranchId || ''} onChange={(e) => setActiveBranchId(e.target.value)} className="bg-transparent text-[9px] sm:text-[11px] font-black outline-none py-1 sm:py-2 pr-2 sm:pr-4 text-indigo-600 cursor-pointer uppercase max-w-[120px] sm:max-w-none">
                              <option value="">-- SELECT BRANCH --</option>{globalConfig.branches?.map(b => <option key={b.id} value={b.id}>{b.name.substring(0,40).toUpperCase()}</option>)}
                         </select>
                      </div>
                   )}
                   </div>
                   <div className="lg:hidden flex items-center gap-2">
                      <button onClick={() => {setAuthRole('guest'); setView('manager');}} className="text-slate-400 p-2 bg-slate-100 rounded-lg"><LogIn className="w-4 h-4 rotate-180" /></button>
                   </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-5 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-1 lg:pb-0 mt-4 lg:mt-0">
                   <div className="flex-shrink-0 flex items-center bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200">
                      <CalendarDaysIcon className="hidden sm:block w-4 h-4 sm:w-5 sm:h-5 text-slate-400 mx-2 sm:mx-3" />
                      <select value={selectedMonth} onChange={(e) => {
                          const m = parseInt(e.target.value);
                          setSelectedMonth(m);
                          setSelectedDateStr(`${selectedYear}-${String(m + 1).padStart(2, '0')}-01`);
                      }} className="bg-transparent text-[10px] sm:text-xs font-black outline-none py-1.5 sm:py-2 px-2 sm:pr-3 text-slate-700">
                         {THAI_MONTHS.map((m, i) => <option key={i} value={i}>{m} 2026</option>)}
                      </select>
                   </div>
                   <div className="flex-shrink-0 flex gap-1 sm:gap-2 bg-slate-100 p-1 rounded-xl sm:rounded-2xl border border-slate-200 font-black text-[9px] sm:text-[10px]">
                      <button onClick={() => setView('manager')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'manager' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>MANAGER</button>
                      <button onClick={() => setView('report')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>REPORT</button>
                      <button onClick={() => setView('admin')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'admin' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>ADMIN</button>
                      <button onClick={() => setView('guide')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'guide' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>GUIDE</button>
                      {authRole === 'superadmin' && <button onClick={() => setView('branches')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'branches' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-50' : 'text-slate-500'}`}>BRANCHES</button>}
                   </div>
                   <div className="hidden lg:flex flex-shrink-0 items-center gap-3 ml-2 pl-5 border-l border-slate-200">
                      <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl font-black text-xs hover:bg-indigo-700 active:scale-95 transition flex items-center gap-2 w-32 justify-center">
                         {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                         <span className="ml-1">{saveStatus === 'saving' ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}</span>
                      </button>
                      {saveStatus === 'error' && <div className="text-red-500 text-xs font-bold ml-2">บันทึกไม่สำเร็จ กรุณาลองใหม่</div>}
                      <button onClick={() => {setAuthRole('guest'); setView('manager');}} className="text-slate-400 hover:text-red-500 transition"><LogIn className="w-6 h-6 rotate-180" /></button>
                   </div>
                </div>
             </div>
          </nav>

              <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="lg:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl active:scale-90 transition-transform">
                 {saveStatus === 'saving' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              </button>
          {saveStatus === 'error' && <div className="lg:hidden fixed bottom-20 right-6 z-50 bg-red-500 text-white px-4 py-2 rounded-xl shadow-2xl text-xs font-bold">บันทึกไม่สำเร็จ</div>}

          <main className="flex-1 flex flex-col p-4 sm:p-8 max-w-[1600px] mx-auto w-full print:p-0 print:m-0 relative">
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

             {mainContent}

             <footer className="flex-none mt-auto pt-8 text-center pb-8 print:hidden opacity-60 hover:opacity-100 transition-opacity flex flex-col items-center w-full">
                <div className="flex items-center justify-center gap-3 mb-3"><div className="h-px w-12 bg-slate-300"></div><Award className="w-5 h-5 text-slate-400" /><div className="h-px w-12 bg-slate-300"></div></div>
                <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Powered by Super Store Team</p>
             </footer>
          </main>
        </div>
      )}
    </React.Fragment>
  );
}