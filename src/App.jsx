import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, getDoc, getDocs, query, where, deleteDoc, orderBy, limit } from 'firebase/firestore';
import {
    Users, AlertCircle, Clock, Save, Plus, Trash2, LayoutDashboard, Printer, ChevronLeft, ChevronRight,
    Coffee, BarChart3, TrendingUp, Award, PlaneTakeoff, Loader2, Store, ArrowLeftRight, Sparkles, Wand2, Bold, Italic, Underline, Link as LinkIcon, BookOpen,
    Eraser, Filter, ChevronDown, Download, MessageCircle, Bell, UserCircle, SaveAll, FolderOpen, CheckCircle2, Edit2, X, Check, List, TableProperties, GripVertical, LogIn, ShieldCheck, Megaphone, Undo2,
    UtensilsCrossed, ConciergeBell, UserPlus, ArrowUpRight, ArrowDownRight, CalendarDays as CalendarDaysIcon, Calendar as CalendarIcon, CheckSquare, KeyRound, Upload
} from 'lucide-react';

/**
 * SUPER STORE Manager Assistant - V15.8.2 (FIX VERSION HISTORY SIZE)
 * อัปเดต:
 * 1. ขจัดปัญหา ReferenceError 100% ด้วยการทำ Function Declaration ให้อยู่ใน Scope อย่างถูกต้อง
 * 2. โครงสร้างเมนู ADMIN: รวบรวม "จัดการพนักงาน", "จัดการหน้าที่", "วันหยุดสาขา", "แม่แบบ" และ "โครงสร้างกะงาน" ครบถ้วน
 * 3. หน้าจัดกะแบบรายเดือน (Monthly): เพิ่มระบบบันทึกวันลาหยุด พร้อมตัวเลือกวันที่แบบเจาะจง
 * 4. หน้า Print (รายเดือน): ลบงานรอง (Job B) ออก จัด Layout สะอาดตา
 * 5. หน้า Print (รายเดือน/รายสัปดาห์): เพิ่มระบบมอบหมายและล็อกกะงานล่วงหน้า (Fix กะ) พร้อมกัน AI จัดกะทับ
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
const CURRENT_APP_VERSION = "15.8.3"; // เปลี่ยนเลขเวอร์ชันที่นี่ทุกครั้งที่คุณอัปเดตโค้ด

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

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // ตั้งเวลา Auto-logout เมื่อไม่มีการใช้งาน (ค่าเริ่มต้น 15 นาที)

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
    { id: 'SWAP_OFF', label: 'เปลี่ยนวันหยุด', shortLabel: 'ปย', color: 'bg-indigo-100 text-indigo-800' },
    { id: 'SL', label: 'ลาป่วย', shortLabel: 'ป', color: 'bg-red-100 text-red-800' },
    { id: 'SL_UNPAID', label: 'ลาป่วยไม่รับเงิน', shortLabel: 'ปง', color: 'bg-red-50 text-red-600' },
    { id: 'PL', label: 'ลากิจ', shortLabel: 'ก', color: 'bg-orange-100 text-orange-800' },
    { id: 'PL_UNPAID', label: 'ลากิจไม่รับเงิน', shortLabel: 'กง', color: 'bg-orange-50 text-orange-600' },
    { id: 'MATERNITY', label: 'ลาคลอด', shortLabel: 'ลค', color: 'bg-pink-100 text-pink-800' },
    { id: 'MARRIAGE', label: 'ลาแต่งงาน', shortLabel: 'ลต', color: 'bg-rose-100 text-rose-800' },
    { id: 'TRAINING', label: 'อบรม', shortLabel: 'อร', color: 'bg-cyan-100 text-cyan-800' },
    { id: 'MY_DAY', label: 'Myday', shortLabel: 'MD', color: 'bg-purple-100 text-purple-800' },
    { id: 'FAMILY_DAY', label: 'Family Day', shortLabel: 'FD', color: 'bg-fuchsia-100 text-fuchsia-800' },
];

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DAYS_OF_WEEK = [{ id: 0, label: 'อาทิตย์' }, { id: 1, label: 'จันทร์' }, { id: 2, label: 'อังคาร' }, { id: 3, label: 'พุธ' }, { id: 4, label: 'พฤหัสบดี' }, { id: 5, label: 'ศุกร์' }, { id: 6, label: 'เสาร์' }];

const DEFAULT_SERVICE_DUTIES = [
    { id: 'D1', category: 'FOH_HEAD', jobA: 'ดูแลประสบการณ์ลูกค้า', jobB: 'งานบริหารจัดการสาขา/พนักงาน', xpDna: '', reqPos: ["OC", "AOC", "SH", "SSD"] },
    { id: 'D2', category: 'FOH_HEAD', jobA: 'ต้อนรับหน้าร้าน/แคชเชียร์', jobB: 'พนักงานประจำโซน (A,B)', xpDna: '', reqPos: ["OC", "AOC", "SH", "SSD"] },
    { id: 'D3', category: 'FOH_STAFF', jobA: 'พนักงานประจำโซน (A,B,C,D,E,F,G)', jobB: 'พนักงานเตรียม Station /เคลียร์โต๊ะ', xpDna: '', reqPos: ["FD", "SD+", "EDC+", "DVT+", "PT+"] },
    { id: 'D4', category: 'FOH_STAFF', jobA: 'พนักงานจัดอาหาร/ทำขนมหวาน', jobB: '-', xpDna: '', reqPos: ["FD", "SD+", "EDC+", "DVT+", "PT+"] },
    { id: 'D5', category: 'FOH_SUPPORT', jobA: 'ม้าเหล็ก เคลียร์โต๊ะ/เก็บจาน', jobB: 'พนักงานเตรียม Station', xpDna: '', reqPos: ["SD", "EDC", "DVT", "PT"] },
    { id: 'D6', category: 'FOH_SUPPORT', jobA: 'พนักงานเตรียม Station', jobB: 'พนักงานจัดอาหาร/ทำขนมหวาน', xpDna: '', reqPos: ["SD", "EDC", "DVT", "PT"] },
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
        title: "รายเดือน: ตั้งค่า (อัปเดตข้อมูลพนักงาน)",
        content: "เริ่มต้นการจัดกะรายเดือน ผู้จัดการมีหน้าที่อัปเดตข้อมูลรายชื่อและวันหยุดประจำสัปดาห์ให้เป็นปัจจุบันที่สุดในเมนู <b>ตั้งค่า</b>:<br><br>• <b>เพิ่ม/ลดพนักงาน:</b> เลื่อนไปที่ตารางจัดการพนักงาน กรอกรหัส ชื่อ แผนก ตำแหน่ง และวันหยุดประจำสัปดาห์ (ถ้ามี) แล้วกด เพิ่มพนักงาน หรือลบออก<br>• <b>ดูโควตาวันหยุด:</b> ระบบจะแสดงโควตาวันหยุด (จันทร์-อาทิตย์) ที่แอดมินกำหนดไว้ หากวันไหนขึ้นเต็มจะไม่สามารถให้หยุดเพิ่มได้<br>• <b>จัดวันหยุดอัตโนมัติ:</b> กดปุ่ม จัดวันหยุด Auto เพื่อให้ระบบสุ่มใส่วันหยุดประจำสัปดาห์ให้พนักงาน",
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
        title: "รายวัน: HEAD TEAM (ใช้ บทบาทหน้าที่ประจำวัน)",
        content: "สำหรับการดำเนินงานหน้าสาขารายวัน จะใช้ตารางรายวันเพื่อจัดการหน้าร้าน (Operation):<br><br>• <b>บทบาทหน้าที่ประจำวัน (Duty Roster Chart):</b> ไปที่หน้า <b>HEAD TEAM</b> เพื่อดูตารางสรุปหน้าที่ของวันนี้ ว่าพนักงานแต่ละคนต้องทำงานหลัก/งานรองอะไร เข้ากะเวลาไหน และมีรอบพักเบรคช่วงไหนบ้าง<br>• <b>พิมพ์ตาราง (Print):</b> กดสั่งพิมพ์ตารางนี้เพื่อนำไปแปะบอร์ดที่ร้านสำหรับบรีฟพนักงานก่อนเริ่มงานทุกวัน",
        image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=1200&q=80",
        color: "bg-sky-500",
        stepNum: "4"
    }
];

const DEFAULT_SITE_MAP = [
    { id: 'SM1', title: '1. ตั้งค่า (จัดการพนักงาน)', color: 'text-emerald-400', items: ['เพิ่ม/ลบ/แก้ไขพนักงาน', 'กำหนดวันหยุดประจำสัปดาห์'] },
    { id: 'SM2', title: '2. MANAGER (จัดแผนงาน)', color: 'text-indigo-400', items: ['จัดแผนงานประจำเดือน', 'จัดกะรายเดือนอัตโนมัติ (AI)', 'จัดกะรายวันอัตโนมัติ (AI)', 'จัดการวันลา'] },
    { id: 'SM3', title: '3. HEAD TEAM (ปฏิบัติการรายวัน)', color: 'text-sky-400', items: ['บทบาทหน้าที่ประจำวัน (Duty Roster Chart)', 'พิมพ์ตาราง (Print)'] },
    { id: 'SM4', title: '4. REPORT (สรุปผล)', color: 'text-orange-400', items: ['สรุปชั่วโมงทำงานและ OT', 'Export CSV นำไปทำเงินเดือน'] }
];

const DEFAULT_WORKFLOW = {
    monthly: [
        { id: 'WM1', text: 'ตั้งค่า\nอัปเดตข้อมูลคน', theme: 'emerald' },
        { id: 'WM2', text: 'MANAGER\nใส่วันหยุดชดเชย / ลาพักร้อน', theme: 'indigo' },
        { id: 'WM3', text: 'MANAGER\nจัดกะประจำเดือน Auto', theme: 'indigo' },
        { id: 'WM4', text: 'EUNITE\nทำข้อมูลบนระบบ Eunite', theme: 'orange' }
    ],
    daily: [
        { id: 'WD1', text: 'HEAD TEAM\nใช้ บทบาทหน้าที่ประจำวัน\n(Duty Roster Chart)', theme: 'sky' }
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
    if (POSITIONS.kitchen.includes(staffPos)) targetDept = 'kitchen';
    const deptPositions = POSITIONS[targetDept] || [];
    const staffRank = deptPositions.indexOf(staffPos);
    if (staffRank === -1) return false;

    // บังคับให้พนักงานที่เป็น Part-Time (มีคำว่า PT) ทำได้เฉพาะหน้าที่ที่ระบุตำแหน่งของตัวเองเป๊ะๆ เท่านั้น (ไม่อนุญาตให้ไปทำแทนตำแหน่งอื่นแม้ว่า Rank จะสูงกว่า)
    if (staffPos.includes('PT')) {
        return reqPosArr.includes(staffPos);
    }

    return reqPosArr.some(reqPos => {
        // บังคับให้ตำแหน่งที่ต้องการเป็น Part-Time ทำได้เฉพาะผู้ที่มีตำแหน่งนั้นเป๊ะๆ เท่านั้น
        if (reqPos.includes('PT')) {
            return staffPos === reqPos;
        }
        const reqRank = deptPositions.indexOf(reqPos);
        return reqRank !== -1 && staffRank <= reqRank;
    });
}

function isStaffActiveOnDate(staff, dateStr) {
    if (!staff) return false;
    if (staff.isActive === false && !staff.resignDate) return false;
    if (staff.startDate && staff.startDate > dateStr) return false;
    if (staff.resignDate && staff.resignDate < dateStr) return false;
    return true;
}

function generateDefaultMatrix(svc = DEFAULT_SERVICE_DUTIES, ktn = DEFAULT_KITCHEN_DUTIES) {
    const m = {};
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
        m[dt] = { duties: {} };
        svc.forEach(d => m[dt].duties[d.id] = [{ shiftPresetId: 'S1', maxOtHours: 0 }]);
        ktn.forEach(k => m[dt].duties[k.id] = [{ shiftPresetId: 'S3', maxOtHours: 0 }]);
    });
    return m;
}

function isDateHoliday(dateStr, holidays = []) {
    return (holidays || []).some(h => (typeof h === 'object' ? h.date : h) === dateStr);
}

function getDayType(dateStr, holidays = [], holidayCycles = {}) {
    const [yStr, mStr, dStr] = dateStr.split('-');
    const dateObj = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
    const dOW = dateObj.getDay();

    if (isDateHoliday(dateStr, holidays)) return holidayCycles?.[dateStr] || 'saturday';
    if (dOW === 0) return 'sunday';
    if (dOW === 6) return 'saturday';
    if (dOW === 5) return 'friday';
    if (dOW === 1) return 'monday';
    if (dOW === 2) return 'tuesday';
    if (dOW === 3) return 'wednesday';
    if (dOW === 4) return 'thursday';
    return 'monday';
}

function getDaysInWeek(dateStr, holidays = [], holidayCycles = {}) {
    const days = [];
    if (!dateStr) return days;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(dateObj);
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    for (let i = 0; i < 7; i++) {
        const cur = new Date(startOfWeek);
        cur.setDate(cur.getDate() + i);
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        const type = getDayType(ds, holidays, holidayCycles);
        days.push({ dateStr: ds, dayNum: cur.getDate(), dayLabel: cur.toLocaleDateString('th-TH', { weekday: 'short' }), type });
    }
    return days;
}

function getDaysInMonth(year, month, holidays = [], holidayCycles = {}) {
    const days = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const type = getDayType(ds, holidays, holidayCycles);
        days.push({ dateStr: ds, dayNum: date.getDate(), dayLabel: date.toLocaleDateString('th-TH', { weekday: 'short' }), type });
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function formatTimeAbbreviation(timeStr) {
    if (!timeStr) return '';
    if (timeStr === '??:??') return '??.??';
    const [h, m] = timeStr.split(':');
    return `${parseInt(h, 10)}.${m ? m.charAt(0) : '0'}`;
}

function getShiftTimesForStaff(staffPos, shiftPreset) {
    if (!shiftPreset) return { startTime: '??:??', endTime: '??:??' };

    const isLongHour = LONG_HOUR_POSITIONS.includes(staffPos || 'OC');
    const timings = isLongHour ? shiftPreset.timings.long : shiftPreset.timings.short;

    return { startTime: timings.startTime, endTime: timings.endTime };
}

function calculateOtHours(targetEndTime, baseEndTime) {
    if (!targetEndTime || !baseEndTime || baseEndTime === '??:??') return 0;
    const [th, tm] = targetEndTime.split(':').map(Number);
    const [bh, bm] = baseEndTime.split(':').map(Number);
    let tMins = th * 60 + tm;
    let bMins = bh * 60 + bm;
    if (tMins < bMins) tMins += 24 * 60; // รองรับกรณี OT ข้ามวัน
    const diff = (tMins - bMins) / 60;
    return diff > 0 ? diff : 0;
}

function getNetWorkHours(startTime, endTime, staffPos) {
    if (!startTime || startTime === '??:??' || !endTime || endTime === '??:??') return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    let [eh, em] = endTime.split(':').map(Number);
    if (eh < sh) eh += 24; // รองรับกะทำงานข้ามคืน
    let gross = (eh + em / 60) - (sh + sm / 60);

    if (gross >= 6) { // 6 hours or more gets a break
        let breakHours = 1;
        if (LONG_HOUR_POSITIONS.includes(staffPos)) {
            breakHours = 1.5;
        }
        return gross - breakHours;
    }
    return gross;
}

function getStaffLayer(dept, pos) {
    if (dept === 'service') {
        if (["OC", "AOC", "SH", "SSD"].includes(pos)) return DUTY_CATEGORIES.service[0];
        if (["FD", "SD+", "EDC+", "DVT+", "PT+"].includes(pos)) return DUTY_CATEGORIES.service[1];
        return DUTY_CATEGORIES.service[2];
    } else {
        if (["OC", "AOC", "KH", "SKD"].includes(pos)) return DUTY_CATEGORIES.kitchen[0];
        if (["KD+", "EDC ครัว+", "DVT ครัว+", "PT ครัว+"].includes(pos)) return DUTY_CATEGORIES.kitchen[1];
        return DUTY_CATEGORIES.kitchen[2];
    }
}

function getWorkflowTheme(theme) {
    switch (theme) {
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

const DayOffSelector = ({ value, onChange, disabled, dayOffCounts, limits, isPT, className, triggerClassName, placeholder = "- วันหยุด -" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const valArray = Array.isArray(value) ? value : (value !== null && value !== undefined && value !== '' ? [value] : []);

    const toggle = (dayId) => {
        let next = [...valArray];
        if (next.includes(dayId)) {
            next = next.filter(x => x !== dayId);
        } else {
            if (!isPT) {
                next = [dayId];
            } else {
                next.push(dayId);
            }
        }
        onChange(next.length > 0 ? next : null);
    };

    const selectedLabels = valArray.map(dId => DAYS_OF_WEEK.find(d => d.id === dId)?.label).filter(Boolean);
    const defaultTriggerClass = `w-full border bg-white rounded-xl px-3 py-2 text-[10px] sm:text-xs font-black outline-none flex justify-between items-center cursor-pointer transition-colors ${disabled ? 'opacity-50' : 'hover:border-indigo-400'} ${selectedLabels.length > 0 ? 'text-indigo-700 border-indigo-200' : 'text-slate-500 border-slate-200'}`;

    return (
        <div className={`relative flex-1 ${className || ''}`}>
            <div onClick={() => !disabled && setIsOpen(!isOpen)} className={triggerClassName ? `${triggerClassName} ${selectedLabels.length > 0 ? 'text-indigo-700' : 'text-slate-500'}` : defaultTriggerClass}>
                <span className="truncate pr-2">
                    {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
            {isOpen && !disabled && (
                <React.Fragment>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-full min-w-[150px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto custom-scrollbar">
                        {DAYS_OF_WEEK.map(d => {
                            const limit = limits?.[d.id] ?? 99;
                            const current = dayOffCounts?.[d.id] || 0;
                            const isSelected = valArray.includes(d.id);
                            const isFull = current >= limit && !isSelected;

                            return (
                                <div key={d.id} className={`px-3 py-2.5 text-xs font-bold cursor-pointer flex items-center justify-between transition-colors ${isFull ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'} ${isSelected ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`} onClick={() => !isFull && toggle(d.id)}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3.5 h-3.5 rounded border flex flex-shrink-0 items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>{isSelected && <Check className="w-2.5 h-2.5 text-white" />}</div>
                                        <span>{d.label}</span>
                                    </div>
                                    {isFull && <span className="text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">(เต็ม)</span>}
                                </div>
                            );
                        })}
                    </div>
                </React.Fragment>
            )}
        </div>
    );
};

const BreakTimeInput = ({ computedValue, manualValue, onSave, onReset, rsFontSize, staffPos }) => {
    const displayValue = manualValue !== undefined ? manualValue : computedValue;

    const breakDuration = (staffPos && SHORT_HOUR_POSITIONS.includes(staffPos)) ? 60 : 90;

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 10; h <= 20; h++) {
            for (let m of [0, 30]) {
                const startMinutes = h * 60 + m;
                const endMinutes = startMinutes + breakDuration;

                const formatTime = (mins) => {
                    const hh = Math.floor(mins / 60) % 24;
                    const mm = mins % 60;
                    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                };

                options.push(`${formatTime(startMinutes)}-${formatTime(endMinutes)}`);
            }
        }
        return options;
    }, [breakDuration]);

    const isNoBreak = displayValue === 'ไม่มีพัก' || displayValue === 'N/A' || displayValue === '-';

    if (isNoBreak) {
        return (
            <div className="w-full text-center font-bold text-slate-400" style={{ fontSize: `${rsFontSize}px` }}>
                {displayValue}
            </div>
        );
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center group">
            <select
                value={displayValue || ''}
                onChange={(e) => onSave(e.target.value)}
                className="w-full text-center outline-none bg-indigo-50/80 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded py-1 print:hidden transition-all shadow-sm cursor-pointer z-10"
                style={{ fontSize: `${rsFontSize}px` }}
                title="เลือกเวลาพัก"
            >
                <option value="" disabled>--:--</option>
                {displayValue && !timeOptions.includes(displayValue) && (
                    <option value={displayValue}>{displayValue}</option>
                )}
                {timeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {manualValue !== undefined && (
                <button
                    onMouseDown={(e) => {
                        e.preventDefault(); // ป้องกันบั๊กการแย่งโฟกัสตอนกดปุ่มรีเซ็ต
                        onReset();
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition print:hidden bg-white shadow-sm border border-slate-200 rounded-full p-0.5 z-20"
                    title="รีเซ็ตให้ AI คำนวณใหม่"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
            <span className="hidden print:inline font-bold" style={{ fontSize: `${rsFontSize}px` }}>{displayValue}</span>
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

const PrintMonthlyView = ({ CALENDAR_DAYS, branchData, globalConfig, activeBranchId, THAI_MONTHS, selectedMonth, getStaffDayInfo, setView, activeDept, CURRENT_DUTY_LIST, handleToggleLeave, LEAVE_TYPES, onPrint, pendingRequests, isPtPendingApproval, schedule }) => {
    const filteredStaff = branchData.staff?.filter(s => s.dept === activeDept) || [];
    const sortedStaff = [...filteredStaff].sort((a, b) => {
        const rankA = POSITIONS[activeDept].indexOf(a.pos);
        const rankB = POSITIONS[activeDept].indexOf(b.pos);
        return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    }); const isWeeklyPrint = CALENDAR_DAYS.length === 7;
    const printTableFontSize = isWeeklyPrint ? '13px' : '10px';
    const printCellWorkTimeSize = isWeeklyPrint ? '24px' : '16px';
    const printCellLeaveSize = isWeeklyPrint ? '22px' : '14px';
    const printEmployeeNameSize = isWeeklyPrint ? '14px' : '11px';
    const printEmployeePosSize = isWeeklyPrint ? '13px' : '10px';
    const printDutyLayerSize = isWeeklyPrint ? '11px' : '8.5px';
    const printTdPadding = isWeeklyPrint ? '0px' : '0px';
    const printThPadding = isWeeklyPrint ? '10px 4px' : '5px 2px';
    const printRowHeight = isWeeklyPrint ? '60px' : '40px';

    return (
        <div className="p-4 sm:p-10 bg-white animate-in fade-in w-full overflow-x-hidden print:overflow-visible flex-1 print-container">
            <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm 6mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #ffffff !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-header {
            margin-bottom: 12px !important;
          }
          .print-title {
            font-size: 16px !important;
            margin-bottom: 2px !important;
            color: #000000 !important;
          }
          .print-subtitle {
            font-size: 9px !important;
            letter-spacing: 0.2em !important;
            color: #475569 !important;
          }
          table.print-table {
            font-size: ${printTableFontSize} !important;
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border: 2px solid #000000 !important;
          }
          table.print-table th {
            font-size: ${printTableFontSize} !important;
            padding: ${printThPadding} !important;
            font-weight: 900 !important;
            border: 1px solid #000000 !important;
            background-color: #f8fafc !important;
            color: #000000 !important;
          }          table.print-table td {
            padding: ${printTdPadding} !important;
            border: 1px solid #000000 !important;
            height: ${printRowHeight} !important;
            vertical-align: middle !important;
          }
          table.print-table tr {
            page-break-inside: avoid !important;
          }          tr.print-category-last-row td {
            border-bottom: 3.5px solid #000000 !important;
          }
          .print-duty-layer {
            font-size: ${printDutyLayerSize} !important;
            font-weight: 900 !important;
            text-align: center !important;
            border: 1px solid #000000 !important;
            border-right: 2px solid #000000 !important;
            color: #000000 !important;
            position: static !important;
            background-color: transparent !important;
          }
          .print-employee-pos {
            font-size: ${printEmployeePosSize} !important;
            font-weight: 900 !important;
            text-align: center !important;
            background-color: transparent !important;
            color: #000000 !important;
            border-right: 2px solid #000000 !important;
            position: static !important;
          }
          .print-employee-name {
            font-size: ${printEmployeeNameSize} !important;
            font-weight: 900 !important;
            max-width: none !important;
            white-space: nowrap !important;
            background-color: transparent !important;
            color: #000000 !important;
            border-right: 3px solid #000000 !important;
            position: static !important;
          }
          .print-cell-work-time {
            font-size: ${printCellWorkTimeSize} !important;
            font-weight: 900 !important;
            color: #000000 !important;
            line-height: 1 !important;
          }
          .print-cell-ot {
            font-size: 6.5px !important;
            font-weight: 900 !important;
            color: #dc2626 !important;
            margin-top: 1px !important;
          }          .print-cell-leave {
            font-size: ${printCellLeaveSize} !important;
            font-weight: 900 !important;
            border: 1px solid #000000 !important;
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            border-radius: 4px !important;
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .print-cell-off {
            font-size: 6px !important;
            color: #94a3b8 !important;
            opacity: 0.3 !important;
          }
        }
      `}</style>
            <div className="max-w-full mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-16 print:hidden border-b pb-6 sm:pb-8 gap-4 sm:gap-0">
                    <button onClick={() => { try { const sess = JSON.parse(localStorage.getItem('superstore_session') || '{}'); sess.view = 'manager'; localStorage.setItem('superstore_session', JSON.stringify(sess)); } catch (e) { } window.location.reload(); }} className="flex items-center gap-2 sm:gap-4 text-slate-600 font-black bg-slate-100 px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-3xl hover:bg-slate-200 transition shadow-sm uppercase text-xs sm:text-sm tracking-widest w-full sm:w-auto justify-center"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /> ย้อนกลับ </button>
                    <button onClick={onPrint} className="bg-indigo-600 text-white px-8 sm:px-12 py-4 sm:py-5 rounded-xl sm:rounded-3xl font-black shadow-xl sm:shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 sm:gap-4 uppercase text-xs sm:text-sm tracking-widest w-full sm:w-auto"><Printer className="w-5 h-5 sm:w-6 sm:h-6" /> สั่งพิมพ์รายงาน </button>
                </div>
                <div className="text-center mb-10 sm:mb-16 uppercase print-header">
                    <h1 className="text-3xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-2 sm:mb-4 print-title">ROSTER SCHEDULE: {CALENDAR_DAYS.length === 7 ? `WEEK OF ${CALENDAR_DAYS[0].dateStr}` : `${THAI_MONTHS[selectedMonth]} 2026`}</h1>
                    <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-[0.3em] sm:tracking-[0.6em] italic print-subtitle">{globalConfig.branches?.find(b => b.id === activeBranchId)?.name || 'BRANCH NODE'} - {activeDept.toUpperCase()} DEPT</p>
                </div>
                <div className="overflow-x-auto border-2 sm:border-4 border-slate-900 rounded-xl sm:rounded-[2.5rem] shadow-lg sm:shadow-2xl overflow-hidden w-full custom-scrollbar pb-2 sm:pb-0 print:border-none print:shadow-none print:overflow-visible">
                    <table className="w-full border-collapse text-[6px] sm:text-[8px] table-fixed min-w-[800px] sm:min-w-none bg-white print:border-2 print:border-black print-table">
                        <thead>
                            <tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                                <th className="border-r border-slate-700 p-2 sm:p-3 text-center sticky left-0 bg-slate-900 z-30 w-16 sm:w-20 font-black uppercase border-b-2 border-slate-600 print:border-black print:bg-transparent print:text-black">Duty Layer</th>
                                <th className="border-r border-slate-700 p-2 sm:p-3 text-center sticky left-[4rem] sm:left-[5rem] bg-slate-900 z-30 w-12 sm:w-16 font-black uppercase border-b-2 border-slate-600 print:border-black print:bg-transparent print:text-black">Pos</th>
                                <th className="border-r border-slate-700 p-2 sm:p-3 text-left sticky left-[7rem] sm:left-[9rem] bg-slate-900 z-30 w-24 sm:w-40 font-black uppercase border-b-2 border-slate-600 print:border-black print:bg-transparent print:text-black">Employee Name</th>
                                {CALENDAR_DAYS.map(day => (
                                    <th key={day.dateStr} className={`border-r border-slate-700 p-1.5 sm:p-3 min-w-[30px] sm:min-w-[45px] text-center border-b-2 border-slate-600 print:border-black ${(day.type === 'saturday' || day.type === 'sunday') || isDateHoliday(day.dateStr, branchData.holidays) ? 'bg-slate-800 text-indigo-300 print:text-black print:bg-slate-100' : ''}`}>
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
                                            <tr key={s.id} className={`h-10 sm:h-14 transition-colors border-b border-slate-200 print:border-black ${dIdx === catStaff.length - 1 ? 'print-category-last-row' : ''}`}>
                                                {dIdx === 0 && (
                                                    <td rowSpan={catStaff.length} className={`border-r border-slate-900 p-1 font-black sticky left-0 z-10 text-[5px] sm:text-[7px] uppercase leading-tight text-center print:border-black print:bg-transparent print:text-black print-duty-layer ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>
                                                        {cat.label.replace('Customer Service ', '').replace('Kitchen ', '')}
                                                    </td>
                                                )}
                                                <td className="border-r-2 sm:border-r-4 border-slate-900 p-1 sm:p-2 font-black sticky left-[4rem] sm:left-[5rem] bg-white z-10 text-[7px] sm:text-[9px] uppercase leading-tight text-center print:border-black print:bg-transparent print:text-black print-employee-pos">
                                                    {s.pos}
                                                </td>
                                                <td className="border-r-2 sm:border-r-4 border-slate-900 p-2 sm:p-3 font-black sticky left-[7rem] sm:left-[9rem] bg-white z-10 text-[8px] sm:text-[10px] uppercase leading-tight truncate max-w-[100px] sm:max-w-[150px] print:border-black print:bg-transparent print:text-black print-employee-name">
                                                    <div className="flex items-center gap-1">
                                                        <span>{s.name}</span>
                                                        {s.pos.includes('PT') && CALENDAR_DAYS.some(day => pendingRequests.some(r => r.reqType === 'EXTRA_PT' && r.dateStr === day.dateStr && (r.dept || 'service') === (s.dept || 'service') && r.status === 'PENDING_MANAGER')) && (
                                                            <span className="text-[6px] sm:text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 print:text-black print:border-black print:bg-transparent animate-pulse flex-shrink-0" title="มีกะรออนุมัติในสัปดาห์/เดือนนี้">⏳ รออนุมัติ</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {CALENDAR_DAYS.map(day => {
                                                    const info = getStaffDayInfo(s.id, day.dateStr, CURRENT_DUTY_LIST);

                                                    // กำหนดค่าปัจจุบันใน dropdown
                                                    let currentValue = '';
                                                    if (info?.type === 'leave') {
                                                        currentValue = info.info?.id || '';
                                                    } else if (info?.type === 'work' && info.actual?.isFixed) {
                                                        currentValue = `DUTY_ASSIGN_${info.duty.id}_${info.slotIdx}`;
                                                    }

                                                    // คำนวณจำนวนพนักงานประจำที่ยังไม่ถูกจัดหน้าที่ในวันนี้
                                                    const dayData = schedule?.[day.dateStr];
                                                    const usedIds = new Set();
                                                    if (dayData?.leaves) {
                                                        dayData.leaves.forEach(l => l.staffId && usedIds.add(l.staffId));
                                                    }
                                                    if (dayData?.duties) {
                                                        Object.values(dayData.duties).forEach(slots => {
                                                            slots.forEach(sSlot => sSlot && sSlot.staffId && usedIds.add(sSlot.staffId));
                                                        });
                                                    }
                                                    const [y, m, dNum] = day.dateStr.split('-').map(Number);
                                                    const dateObj = new Date(y, m - 1, dNum);
                                                    const dayOfWeek = dateObj.getDay();
                                                    const isHoliday = isDateHoliday(day.dateStr, branchData.holidays);

                                                    let unassignedFTCount = 0;
                                                    (branchData.staff || []).forEach(staff => {
                                                        if (staff.dept === activeDept && !staff.pos.includes('PT') && isStaffActiveOnDate(staff, day.dateStr)) {
                                                            const onLeave = usedIds.has(staff.id);
                                                            const daysOff = Array.isArray(staff.regularDayOff) ? staff.regularDayOff : (staff.regularDayOff !== null && staff.regularDayOff !== undefined && staff.regularDayOff !== '' ? [staff.regularDayOff] : []);
                                                            const isRegularOff = !isHoliday && daysOff.includes(dayOfWeek);
                                                            if (!onLeave && !isRegularOff) {
                                                                unassignedFTCount++;
                                                            }
                                                        }
                                                    });

                                                    // ดึงสิทธิ์ในการทำหน้าที่ต่างๆ ของพนักงานในวันนี้
                                                    const vacantDutiesOptions = [];
                                                    CURRENT_DUTY_LIST.forEach(d => {
                                                        const reqArr = Array.isArray(d.reqPos) ? d.reqPos : [d.reqPos || 'ALL'];
                                                        const isEligible = checkPositionEligibility(s.pos, reqArr, activeDept);
                                                        if (isEligible) {
                                                            const matrixSlots = branchData.matrix?.[day.type]?.duties?.[d.id] || [];
                                                            matrixSlots.forEach((slot, slotIdx) => {
                                                                const assignedSlots = schedule?.[day.dateStr]?.duties?.[d.id] || [];
                                                                const slotData = assignedSlots[slotIdx];
                                                                const isAssignedToOther = slotData && slotData.staffId && slotData.staffId !== s.id;
                                                                if (!isAssignedToOther) {
                                                                    const isCurrentAssignment = slotData && slotData.staffId === s.id;
                                                                    // ในหน้านี้จะไม่ขึ้นกะสำรองให้เลือกจนกว่าจะมีพนักงานประจำที่ยังไม่ได้จัดหน้าที่งาน
                                                                    if (d.isBackup && unassignedFTCount === 0 && !isCurrentAssignment) {
                                                                        return;
                                                                    }
                                                                    const preset = branchData.shiftPresets?.find(p => p.id === slot.shiftPresetId);
                                                                    const times = getShiftTimesForStaff(s.pos, preset);
                                                                    const timeStr = times ? ` (${formatTimeAbbreviation(times.startTime)}-${formatTimeAbbreviation(times.endTime)})` : '';
                                                                    vacantDutiesOptions.push({
                                                                        value: `DUTY_ASSIGN_${d.id}_${slotIdx}`,
                                                                        label: `📌 ${d.jobA}${timeStr}`
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });

                                                    return (
                                                        <td key={day.dateStr} className={`border-r border-b border-slate-200 p-0 relative group print:border-black h-10 sm:h-14 ${info?.actual?.isFixed ? 'bg-indigo-50/40 print:bg-transparent' : !info ? 'bg-slate-50/40 print:bg-transparent' : ''}`}>
                                                            <div className="w-full h-full flex flex-col items-center justify-center p-0.5 sm:p-1 pointer-events-none group-hover:opacity-40 transition-opacity print:group-hover:opacity-100">
                                                                {info?.type === 'work' ? (
                                                                    <div className="flex flex-col items-center justify-center leading-tight w-full h-full">
                                                                        <span className="font-black text-slate-800 text-[8px] sm:text-[10px] leading-none tracking-tighter print:text-black print-cell-work-time">
                                                                            {info.actual?.isFixed && <span className="print:hidden mr-0.5">📌</span>}
                                                                            {formatTimeAbbreviation(info.slot?.startTime)}
                                                                        </span>
                                                                        {s.pos.includes('PT') && pendingRequests.some(r => r.reqType === 'EXTRA_PT' && r.dateStr === day.dateStr && (r.dept || 'service') === (s.dept || 'service') && r.status === 'PENDING_MANAGER') && (
                                                                            <div className="text-[6px] sm:text-[7px] font-black text-amber-600 truncate w-full px-0.5 uppercase tracking-tighter mt-0.5 print:text-black print-cell-ot animate-pulse">⏳ รออนุมัติ</div>
                                                                        )}
                                                                        {info.actual?.otHours > 0 && <div className="text-[6px] sm:text-[7px] font-black text-rose-600 truncate w-full px-0.5 uppercase tracking-tighter mt-0.5 print:text-black print-cell-ot">O{info.actual.otHours}</div>}
                                                                    </div>
                                                                ) : info?.type === 'leave' ? (
                                                                    <div className={`w-full h-full flex items-center justify-center font-black ${info.info?.color || 'bg-slate-100 text-slate-800'} rounded-md sm:rounded-xl border sm:border-2 border-white shadow-inner text-[8px] sm:text-[10px] print:bg-transparent print:text-black print:border-none print-cell-leave`}><span className="text-center leading-none uppercase p-0.5 sm:p-1">{info.info?.shortLabel || 'ย'}</span></div>
                                                                ) : <span className="text-[5px] sm:text-[7px] font-black opacity-10 uppercase tracking-widest print:text-transparent print-cell-off">OFF</span>}
                                                            </div>
                                                            <select
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer print:hidden z-10"
                                                                value={currentValue}
                                                                onChange={(e) => handleToggleLeave && handleToggleLeave(s.id, day.dateStr, e.target.value)}
                                                                title="คลิกเพื่อปรับวันหยุด หรือ มอบหมายหน้าที่ (Fix กะ)"
                                                            >
                                                                <option value="">[ ว่าง / ลบหน้าที่ & วันหยุด ]</option>
                                                                <optgroup label="-- วันหยุด / วันลา --">
                                                                    {(LEAVE_TYPES || []).filter(lt => !(s.pos.includes('PT') && !['OFF', 'SWAP_OFF', 'SL_UNPAID', 'PL_UNPAID'].includes(lt.id))).map(lt => (
                                                                        <option key={lt.id} value={lt.id}>{lt.label}</option>
                                                                    ))}
                                                                </optgroup>
                                                                {vacantDutiesOptions.length > 0 && (
                                                                    <optgroup label="-- มอบหมายหน้าที่ (Fix กะ) --">
                                                                        {vacantDutiesOptions.map(opt => (
                                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </select>
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

    const lastActivityRef = useRef(Date.now());

    const [authRole, setAuthRole] = useState(() => {
        try {
            const savedActivity = localStorage.getItem('superstore_lastActivity');
            if (savedActivity && (Date.now() - parseInt(savedActivity) > INACTIVITY_TIMEOUT_MS)) {
                sessionStorage.setItem('superstore_showTimeoutModal', 'true');
                localStorage.removeItem('superstore_session');
                return 'guest';
            }
            const saved = localStorage.getItem('superstore_session'); if (saved) return JSON.parse(saved).authRole || 'guest';
        } catch (e) { }
        return 'guest';
    });
    const [authUser, setAuthUser] = useState(() => {
        try { const saved = localStorage.getItem('superstore_session'); if (saved) return JSON.parse(saved).authUser || null; } catch (e) { } return null;
    });
    const [activeBranchId, setActiveBranchId] = useState(() => {
        try { const saved = localStorage.getItem('superstore_session'); if (saved) return JSON.parse(saved).activeBranchId || null; } catch (e) { } return null;
    });
    const [view, setView] = useState(() => {
        try { const saved = localStorage.getItem('superstore_session'); if (saved) return JSON.parse(saved).view || 'manager'; } catch (e) { } return 'manager';
    });
    const [dailyViewMode, setDailyViewMode] = useState('roster');
    const [activeDept, setActiveDept] = useState(() => {
        try { const saved = sessionStorage.getItem('superstore_activeDept'); if (saved) return saved; } catch (e) { }
        return 'service';
    });
    const [managerViewMode, setManagerViewMode] = useState(() => {
        try { const saved = sessionStorage.getItem('superstore_managerViewMode'); if (saved) return saved; } catch (e) { }
        return 'daily';
    });

    const [globalConfig, setGlobalConfig] = useState({ admins: [{ user: 'admin', pass: 'superstore' }], branches: [] });
    const [globalTemplates, setGlobalTemplates] = useState([]);
    const [branchData, setBranchData] = useState({ staff: [], holidays: [], matrix: generateDefaultMatrix(), duties: { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES }, templates: [] });
    const [schedule, setSchedule] = useState({});
    const [scheduleHistory, setScheduleHistory] = useState(null);
    const [scheduleVersions, setScheduleVersions] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);

    const [selectedDateStr, setSelectedDateStr] = useState(() => {
        try { const saved = sessionStorage.getItem('superstore_selectedDate'); if (saved) return saved; } catch (e) { }
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });
    const [selectedMonth, setSelectedMonth] = useState(() => {
        try { const saved = sessionStorage.getItem('superstore_selectedDate'); if (saved) return parseInt(saved.split('-')[1], 10) - 1; } catch (e) { }
        return new Date().getMonth();
    });

    const [saveStatus, setSaveStatus] = useState(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requestTab, setRequestTab] = useState('pending');
    const [reqHistoryFilterType, setReqHistoryFilterType] = useState('ALL');
    const [reqHistoryFilterMonth, setReqHistoryFilterMonth] = useState('ALL');
    const [reqHistoryFilterDate, setReqHistoryFilterDate] = useState('');

    const [showExtraOtModal, setShowExtraOtModal] = useState(null);
    const [extraOtReason, setExtraOtReason] = useState('');

    const [showForecastModal, setShowForecastModal] = useState(false);
    const [ptRequestMode, setPtRequestMode] = useState('EVENT'); // 'EVENT' or 'OVER_BUDGET'
    const [forecastTc, setForecastTc] = useState('');
    const [forecastReason, setForecastReason] = useState('');
    const [forecastEvidence, setForecastEvidence] = useState('');
    const [showPtLedgerDetails, setShowPtLedgerDetails] = useState(false);
    const [showOtLedgerDetails, setShowOtLedgerDetails] = useState(false);
    const [ptLedgerActiveTab, setPtLedgerActiveTab] = useState('overview');

    const [newAmName, setNewAmName] = useState('');
    const [newAmUser, setNewAmUser] = useState('');
    const [newAmPass, setNewAmPass] = useState('');
    const [newAmBranches, setNewAmBranches] = useState([]);
    const [amData, setAmData] = useState({});

    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [newPasswordInput, setNewPasswordInput] = useState('');

    const [showImportStaffModal, setShowImportStaffModal] = useState(false);
    const [importStaffText, setImportStaffText] = useState('');

    const [userInput, setUserInput] = useState(() => {
        try { return localStorage.getItem('superstore_savedUsername') || ''; } catch (e) { return ''; }
    });
    const [passInput, setPassInput] = useState('');
    const [rememberMe, setRememberMe] = useState(() => {
        try { return !!localStorage.getItem('superstore_savedUsername'); } catch (e) { return false; }
    });
    const [loginError, setLoginError] = useState('');

    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffEmpId, setNewStaffEmpId] = useState('');
    const [newStaffDept, setNewStaffDept] = useState('service');
    const [newStaffPos, setNewStaffPos] = useState('OC');
    const [newStaffDayOff, setNewStaffDayOff] = useState([]);
    const [newStaffStartDate, setNewStaffStartDate] = useState('');
    const [newStaffWageType, setNewStaffWageType] = useState('MONTHLY');
    const [newStaffBaseWage, setNewStaffBaseWage] = useState('');

    const [editingStaffId, setEditingStaffId] = useState(null);
    const [editStaffData, setEditStaffData] = useState({});
    const [editingBranchId, setEditingBranchId] = useState(null);
    const [editBranchData, setEditBranchData] = useState({});
    const [editingAmId, setEditingAmId] = useState(null);
    const [editAmData, setEditAmData] = useState({});

    const [newDutyJobA, setNewDutyJobA] = useState('');
    const [newDutyJobB, setNewDutyJobB] = useState('');
    const [newDutyXpDna, setNewDutyXpDna] = useState('');
    const [newDutyReqPos, setNewDutyReqPos] = useState(['ALL']);
    const [newDutyCategory, setNewDutyCategory] = useState('FOH_STAFF');
    const [newDutyIsBackup, setNewDutyIsBackup] = useState(false);
    const [newDutyPrepItems, setNewDutyPrepItems] = useState([]);
    const [newPrepName, setNewPrepName] = useState('');
    const [newPrepMultiplier, setNewPrepMultiplier] = useState('');
    const [newPrepUnit, setNewPrepUnit] = useState('กก.');
    const [editPrepName, setEditPrepName] = useState('');
    const [editPrepMultiplier, setEditPrepMultiplier] = useState('');
    const [editPrepUnit, setEditPrepUnit] = useState('กก.');
    const [editPrepTarget, setEditPrepTarget] = useState('ALL');
    const [editingPrepItemId, setEditingPrepItemId] = useState(null);
    const [editPrepMode, setEditPrepMode] = useState('TC');
    const [editingDutyId, setEditingDutyId] = useState(null);
    const [editDutyData, setEditDutyData] = useState({});
    const [editingShiftPresetId, setEditingShiftPresetId] = useState(null);
    const [editShiftPresetData, setEditShiftPresetData] = useState(null);


    const [draggedDutyIdx, setDraggedDutyIdx] = useState(null);
    const [draggedShiftPresetIdx, setDraggedShiftPresetIdx] = useState(null);

    const [staffFilterPos, setStaffFilterPos] = useState('ALL');
    const [templateName, setTemplateName] = useState('');
    const [loadTemplateState, setLoadTemplateState] = useState(null);
    const [loadTemplateOptions, setLoadTemplateOptions] = useState({
        duties: true,
        matrix: true,
        shiftPresets: true,
        holidays: true,
        configs: true,
        rosterStyle: true
    });

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
    const [hasSeenLanding, setHasSeenLanding] = useState(() => {
        return sessionStorage.getItem('superstore_hasSeenLanding') === 'true';
    });
    const [showLanding, setShowLanding] = useState(false);
    const [landingIndex, setLandingIndex] = useState(0);
    const [newAnnTitle, setNewAnnTitle] = useState('');
    const [newAnnContent, setNewAnnContent] = useState('');
    const [newAnnImage, setNewAnnImage] = useState('');
    const [newAnnStartDate, setNewAnnStartDate] = useState('');
    const [newAnnEndDate, setNewAnnEndDate] = useState('');

    const [aiMessage, setAiMessage] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [newVersionAvailable, setNewVersionAvailable] = useState(null);

    const dateBarRef = useRef(null);
    const selectedYear = 2026; const autoAssignedDates = useRef(new Set());
    const scheduleRef = useRef();
    scheduleRef.current = schedule;
    const autoSaveTimerRef = useRef(null);

    // Data Inspector State
    const [showDataInspector, setShowDataInspector] = useState(false);
    const [inspectorBranchId, setInspectorBranchId] = useState(null);
    const [inspectedData, setInspectedData] = useState({ branch: null, schedule: null, loading: false, error: null });
    const [inspectorTab, setInspectorTab] = useState('staff');
    const [inspectorBackups, setInspectorBackups] = useState([]);
    const [inspectorRestoreMode, setInspectorRestoreMode] = useState('all');
    const [manualBranchId, setManualBranchId] = useState('');

    const CURRENT_DUTY_LIST = useMemo(() => {
        let list = branchData.duties && branchData.duties[activeDept] ? branchData.duties[activeDept] : (activeDept === 'service' ? DEFAULT_SERVICE_DUTIES : DEFAULT_KITCHEN_DUTIES);
        return list.map(d => ({
            ...d,
            category: d.category || (activeDept === 'service' ? 'FOH_STAFF' : 'BOH_STAFF'),
            xpDna: d.xpDna || ''
        }));
    }, [activeDept, branchData.duties]);

    const CALENDAR_DAYS = useMemo(() => getDaysInMonth(selectedYear, selectedMonth, branchData.holidays || [], branchData.holidayCycles || {}), [selectedMonth, selectedYear, branchData.holidays, branchData.holidayCycles]);
    const WEEKLY_DAYS = useMemo(() => getDaysInWeek(selectedDateStr, branchData.holidays || [], branchData.holidayCycles || {}), [selectedDateStr, branchData.holidays, branchData.holidayCycles]);
    const activeDay = useMemo(() => CALENDAR_DAYS.find(d => d.dateStr === selectedDateStr) || CALENDAR_DAYS[0], [selectedDateStr, CALENDAR_DAYS]);

    const usedStaffIds = useMemo(() => {
        const dayData = schedule[selectedDateStr];
        if (!dayData) return [];
        const ids = new Set();
        if (dayData.leaves) dayData.leaves.forEach(l => l.staffId && ids.add(l.staffId));
        if (dayData.duties) Object.values(dayData.duties).forEach(slots => { slots.forEach(s => s && s.staffId && ids.add(s.staffId)); });
        return Array.from(ids);
    }, [schedule, selectedDateStr]);

    const unassignedStaffDaily = useMemo(() => {
        return branchData.staff?.filter(s => s.dept === activeDept && !usedStaffIds.includes(s.id) && isStaffActiveOnDate(s, selectedDateStr)) || [];
    }, [branchData.staff, activeDept, usedStaffIds, selectedDateStr]);

    const reportData = useMemo(() => {
        const staffMap = {};
        const payrollConfig = {
            monthlySalaryDivider: 30,
            otRateMonthly: 1.5,
            otRateHolidayMonthly: 3.0,
            otRateFtHourly: 1.5,
            otRatePt: 1.5,
            holidayMultiplierFtHourly: 2.0,
            holidayMultiplierPt: 2.0,
            ...(branchData.payrollConfig || {})
        };
        const ptHourlyRate = branchData.ptConfig?.hourlyRate || 50;

        (branchData.staff || []).forEach(s => {
            staffMap[s.id] = {
                id: s.id, name: s.name, dept: s.dept, pos: s.pos, empId: s.empId,
                wageType: s.wageType || 'MONTHLY', baseWage: s.baseWage || 0,
                workHours: 0, shifts: 0, actualOT: 0, plannedOT: 0, leaves: 0,
                unpaidLeaveDays: 0,
                basePay: 0, otPay: 0, holidayPay: 0, totalPay: 0,
                otHoursByMultiplier: {}
            };
        });

        Object.keys(schedule).forEach(dateStr => {
            if (reportFilterMode === 'month') {
                const [yStr, mStr] = dateStr.split('-');
                if (parseInt(mStr, 10) - 1 !== reportFilterMonth || parseInt(yStr, 10) !== selectedYear) return;
            } else {
                if (dateStr < reportFilterStart || dateStr > reportFilterEnd) return;
            }

            const dayData = schedule[dateStr];
            const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);
            const isPublicHoliday = (branchData.holidays || []).some(h => typeof h === 'object' && h.date === dateStr && h.isPublic);

            if (dayData.leaves) {
                dayData.leaves.forEach(l => {
                    if (l.staffId && staffMap[l.staffId]) {
                        staffMap[l.staffId].leaves += 1;
                        if (['SL_UNPAID', 'PL_UNPAID'].includes(l.type)) {
                            staffMap[l.staffId].unpaidLeaveDays += 1;
                        }
                    }
                });
            }

            if (dayData.duties) {
                Object.keys(dayData.duties).forEach(dutyId => {
                    const slots = dayData.duties[dutyId] || [];
                    const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
                    slots.forEach((slot, idx) => {
                        if (slot && slot.staffId && staffMap[slot.staffId]) {
                            const staff = staffMap[slot.staffId];
                            const mSlot = matrixSlots?.[idx];
                            const shiftPreset = branchData.shiftPresets?.find(p => p.id === mSlot?.shiftPresetId);
                            const { startTime, endTime } = getShiftTimesForStaff(staff.pos, shiftPreset);
                            const workHours = getNetWorkHours(startTime, endTime, staff.pos);
                            const otHours = Number(slot.otHours || 0);

                            staff.workHours += workHours;
                            staff.shifts += 1;
                            staff.actualOT += otHours;

                            let plannedOT = Number(mSlot?.maxOtHours || 0);
                            if (mSlot?.targetEndTime) {
                                plannedOT = calculateOtHours(mSlot.targetEndTime, endTime);
                            }
                            staff.plannedOT += plannedOT;

                            if (staff.wageType === 'MONTHLY') {
                                const monthlyRate = staff.baseWage || 0;
                                const dailyRate = monthlyRate / (payrollConfig.monthlySalaryDivider || 30);
                                const hourlyRate = dailyRate / 8;
                                const effectiveOtMultiplier = isPublicHoliday ? (payrollConfig.otRateHolidayMonthly || 3.0) : (payrollConfig.otRateMonthly || 1.5);

                                if (isPublicHoliday) {
                                    // พนักงานประจำ (รายเดือน) จะได้เป็นวันหยุดชดเชย (CO) แทน ไม่มีการจ่ายค่าแรงวันหยุดเพิ่ม
                                    // staff.holidayPay += dailyRate * (payrollConfig.holidayMultiplierMonthly || 1.0);
                                    staff.otPay += otHours * hourlyRate * effectiveOtMultiplier;
                                } else {
                                    staff.otPay += otHours * hourlyRate * effectiveOtMultiplier;
                                }

                                if (otHours > 0) staff.otHoursByMultiplier[effectiveOtMultiplier] = (staff.otHoursByMultiplier[effectiveOtMultiplier] || 0) + otHours;
                            } else { // HOURLY or PT
                                const isPt = staff.wageType === 'PT';
                                const hourlyRate = isPt ? ptHourlyRate : (staff.baseWage || 0);

                                const holidayMultiplier = isPt ? (payrollConfig.holidayMultiplierPt || 2.0) : (payrollConfig.holidayMultiplierFtHourly || 2.0);
                                const baseOtMultiplier = isPt ? (payrollConfig.otRatePt || 1.5) : (payrollConfig.otRateFtHourly || 1.5);

                                // พนักงานชั่วโมง/PT หากทำ OT ในวันหยุด จะได้ (เรท OT ปกติ * เรทวันหยุด) เช่น 1.5 * 2 = 3.0 เท่า
                                const effectiveOtMultiplier = isPublicHoliday ? (baseOtMultiplier * holidayMultiplier) : baseOtMultiplier;

                                if (isPublicHoliday) {
                                    // ค่าแรงปกติเข้า basePay, ส่วนที่เกินเนื่องจากเป็นวันหยุด (x-1) เข้า holidayPay
                                    staff.basePay += workHours * hourlyRate;
                                    staff.holidayPay += workHours * hourlyRate * (holidayMultiplier - 1);
                                } else {
                                    staff.basePay += workHours * hourlyRate;
                                }
                                staff.otPay += otHours * hourlyRate * effectiveOtMultiplier;

                                if (otHours > 0) staff.otHoursByMultiplier[effectiveOtMultiplier] = (staff.otHoursByMultiplier[effectiveOtMultiplier] || 0) + otHours;
                            }
                        }
                    });
                });
            }
        });

        Object.values(staffMap).forEach(staff => {
            if (staff.wageType === 'MONTHLY') {
                const monthlyRate = staff.baseWage || 0;
                const dailyRate = monthlyRate / (payrollConfig.monthlySalaryDivider || 30);
                staff.basePay = Math.max(0, monthlyRate - (staff.unpaidLeaveDays * dailyRate));
            }
            staff.totalPay = staff.basePay + staff.otPay + staff.holidayPay;
        });

        return Object.values(staffMap).sort((a, b) => b.totalPay - a.totalPay);
    }, [schedule, branchData, reportFilterMode, reportFilterMonth, reportFilterStart, reportFilterEnd, selectedYear, authRole]);

    const totalActualOT = reportData.reduce((acc, curr) => acc + curr.actualOT, 0);
    const totalPlannedOT = reportData.reduce((acc, curr) => acc + curr.plannedOT, 0);
    const deltaOT = totalActualOT - totalPlannedOT;

    const ptLedger = useMemo(() => {
        const hourlyRate = Number(branchData.ptConfig?.hourlyRate || 0);

        const budgetService = branchData.ptConfig?.monthlyBudgetService !== undefined ? Number(branchData.ptConfig.monthlyBudgetService) : null;
        const budgetKitchen = branchData.ptConfig?.monthlyBudgetKitchen !== undefined ? Number(branchData.ptConfig.monthlyBudgetKitchen) : null;

        let baseAllowanceSvc = 0;
        let baseAllowanceKit = 0;

        if (hourlyRate > 0) {
            if (budgetService !== null && budgetKitchen !== null) {
                baseAllowanceSvc = budgetService / hourlyRate;
                baseAllowanceKit = budgetKitchen / hourlyRate;
            } else {
                const legacyBudget = Number(branchData.ptConfig?.monthlyBudget || 0);
                baseAllowanceSvc = (legacyBudget / 2) / hourlyRate;
                baseAllowanceKit = (legacyBudget / 2) / hourlyRate;
            }
        }

        const daysInMonth = CALENDAR_DAYS.length || 30;
        const dailyBaseAvgSvc = baseAllowanceSvc / daysInMonth;
        const dailyBaseAvgKit = baseAllowanceKit / daysInMonth;

        let leaveRefundsSvc = 0;
        let leaveRefundsKit = 0;

        let vacancyCompensationsSvc = 0;
        let vacancyCompensationsKit = 0;

        let eventExtrasSvc = 0;
        let eventExtrasKit = 0;

        let usedBaseHoursSvc = 0;
        let usedBaseHoursKit = 0;

        let usedEventHoursSvc = 0;
        let usedEventHoursKit = 0;

        let dailyEventQuotaSvc = 0;
        let dailyEventQuotaKit = 0;

        let dailyEventUsedSvc = 0;
        let dailyEventUsedKit = 0;

        let staffUsage = {};
        let dailyUsageSvc = {};
        let dailyUsageKit = {};
        let dailyAllowanceSvc = {};
        let dailyAllowanceKit = {};

        const staffMap = {};
        (branchData.staff || []).forEach(s => staffMap[s.id] = s);

        const compHoursPerDayService = branchData.ptConfig?.compHoursPerDayService ?? 8;
        const compHoursPerDayKitchen = branchData.ptConfig?.compHoursPerDayKitchen ?? 8;

        let targetFtHeadcountService = 0;
        const headServiceLimit = branchData.staffLimits?.['FOH_HEAD'];
        if (headServiceLimit) targetFtHeadcountService += parseInt(headServiceLimit, 10);
        const staffSupportServiceLimit = branchData.staffLimits?.['SERVICE_STAFF_SUPPORT_FT'];
        if (staffSupportServiceLimit) targetFtHeadcountService += parseInt(staffSupportServiceLimit, 10);

        let targetFtHeadcountKitchen = 0;
        const headKitchenLimit = branchData.staffLimits?.['BOH_HEAD'];
        if (headKitchenLimit) targetFtHeadcountKitchen += parseInt(headKitchenLimit, 10);
        const staffSupportKitchenLimit = branchData.staffLimits?.['KITCHEN_STAFF_SUPPORT_FT'];
        if (staffSupportKitchenLimit) targetFtHeadcountKitchen += parseInt(staffSupportKitchenLimit, 10);

        CALENDAR_DAYS.forEach(day => {
            let activeFtCountService = 0;
            let activeFtCountKitchen = 0;
            (branchData.staff || []).forEach(s => {
                if (s.pos.includes('PT')) return;
                if (s.isActive === false && !s.resignDate) return;

                const started = !s.startDate || s.startDate <= day.dateStr;
                const notResignedYet = !s.resignDate || s.resignDate >= day.dateStr;

                if (started && notResignedYet) {
                    if (s.dept === 'service') activeFtCountService++;
                    if (s.dept === 'kitchen') activeFtCountKitchen++;
                }
            });
            const gapService = Math.max(0, targetFtHeadcountService - activeFtCountService);
            const gapKitchen = Math.max(0, targetFtHeadcountKitchen - activeFtCountKitchen);

            const dayVacancySvc = gapService * compHoursPerDayService;
            const dayVacancyKit = gapKitchen * compHoursPerDayKitchen;

            vacancyCompensationsSvc += dayVacancySvc;
            vacancyCompensationsKit += dayVacancyKit;

            dailyAllowanceSvc[day.dateStr] = { baseAvg: dailyBaseAvgSvc, leave: 0, vacancy: dayVacancySvc, event: 0, total: dailyBaseAvgSvc + dayVacancySvc };
            dailyAllowanceKit[day.dateStr] = { baseAvg: dailyBaseAvgKit, leave: 0, vacancy: dayVacancyKit, event: 0, total: dailyBaseAvgKit + dayVacancyKit };
        });

        Object.keys(schedule).forEach(dateStr => {
            const [yStr, mStr] = dateStr.split('-');
            if (parseInt(mStr, 10) - 1 !== selectedMonth || parseInt(yStr, 10) !== selectedYear) return;
            const dayData = schedule[dateStr];

            const eventHrsSvc = dayData.eventExtraHoursService !== undefined
                ? dayData.eventExtraHoursService
                : (dayData.eventExtraHoursKitchen !== undefined ? 0 : (dayData.eventExtraHours || 0));
            const eventHrsKit = dayData.eventExtraHoursKitchen || 0;

            if (eventHrsSvc > 0) {
                eventExtrasSvc += eventHrsSvc;
                if (dailyAllowanceSvc[dateStr]) {
                    dailyAllowanceSvc[dateStr].event = eventHrsSvc;
                    dailyAllowanceSvc[dateStr].total += eventHrsSvc;
                }
                if (dateStr === selectedDateStr) {
                    dailyEventQuotaSvc += eventHrsSvc;
                }
            }
            if (eventHrsKit > 0) {
                eventExtrasKit += eventHrsKit;
                if (dailyAllowanceKit[dateStr]) {
                    dailyAllowanceKit[dateStr].event = eventHrsKit;
                    dailyAllowanceKit[dateStr].total += eventHrsKit;
                }
                if (dateStr === selectedDateStr) {
                    dailyEventQuotaKit += eventHrsKit;
                }
            }

            if (dayData.leaves) {
                dayData.leaves.forEach(l => {
                    const staff = staffMap[l.staffId];
                    if (staff && !staff.pos.includes('PT')) {
                        if (['AL', 'SL', 'SL_UNPAID', 'PL', 'PL_UNPAID', 'MATERNITY', 'MARRIAGE', 'TRAINING', 'MY_DAY', 'FAMILY_DAY', 'CO'].includes(l.type)) {
                            if (staff.dept === 'kitchen') {
                                leaveRefundsKit += 8;
                                if (dailyAllowanceKit[dateStr]) {
                                    dailyAllowanceKit[dateStr].leave += 8;
                                    dailyAllowanceKit[dateStr].total += 8;
                                }
                            } else {
                                leaveRefundsSvc += 8;
                                if (dailyAllowanceSvc[dateStr]) {
                                    dailyAllowanceSvc[dateStr].leave += 8;
                                    dailyAllowanceSvc[dateStr].total += 8;
                                }
                            }
                        }
                    }
                });
            }

            const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);

            if (dayData.duties) {
                Object.keys(dayData.duties).forEach(dutyId => {
                    const slots = dayData.duties[dutyId] || [];
                    const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
                    slots.forEach((slot, idx) => {
                        if (slot && slot.staffId) {
                            const isOTCover = slot.staffId.startsWith('COVER_BY_');
                            const actualStaffId = isOTCover ? slot.staffId.replace('COVER_BY_', '') : slot.staffId;
                            const staff = staffMap[actualStaffId];

                            if (staff && staff.pos.includes('PT')) {
                                const mSlot = matrixSlots[idx];
                                const shiftPreset = branchData.shiftPresets?.find(p => p.id === (slot.shiftPresetId || mSlot?.shiftPresetId));
                                const times = getShiftTimesForStaff(staff.pos, shiftPreset);
                                const shiftHrs = getNetWorkHours(times.startTime, times.endTime, staff.pos);
                                const totalSlotHrs = shiftHrs + Number(slot.otHours || 0);

                                if (!staffUsage[staff.id]) {
                                    staffUsage[staff.id] = { name: staff.name, pos: staff.pos, base: 0, event: 0, dept: staff.dept || 'service' };
                                }

                                const isKit = staff.dept === 'kitchen';
                                if (isKit) {
                                    if (!dailyUsageKit[dateStr]) dailyUsageKit[dateStr] = { base: 0, event: 0 };
                                    if (slot.isEventExtra) {
                                        usedEventHoursKit += totalSlotHrs;
                                        staffUsage[staff.id].event += totalSlotHrs;
                                        dailyUsageKit[dateStr].event += totalSlotHrs;
                                        if (dateStr === selectedDateStr) {
                                            dailyEventUsedKit += totalSlotHrs;
                                        }
                                    } else {
                                        usedBaseHoursKit += totalSlotHrs;
                                        staffUsage[staff.id].base += totalSlotHrs;
                                        dailyUsageKit[dateStr].base += totalSlotHrs;
                                    }
                                } else {
                                    if (!dailyUsageSvc[dateStr]) dailyUsageSvc[dateStr] = { base: 0, event: 0 };
                                    if (slot.isEventExtra) {
                                        usedEventHoursSvc += totalSlotHrs;
                                        staffUsage[staff.id].event += totalSlotHrs;
                                        dailyUsageSvc[dateStr].event += totalSlotHrs;
                                        if (dateStr === selectedDateStr) {
                                            dailyEventUsedSvc += totalSlotHrs;
                                        }
                                    } else {
                                        usedBaseHoursSvc += totalSlotHrs;
                                        staffUsage[staff.id].base += totalSlotHrs;
                                        dailyUsageSvc[dateStr].base += totalSlotHrs;
                                    }
                                }
                            }
                        }
                    });
                });
            }
        });

        const baseTotalAllowanceSvc = baseAllowanceSvc + leaveRefundsSvc + vacancyCompensationsSvc;
        const totalAllowanceSvc = baseTotalAllowanceSvc + eventExtrasSvc;
        const usedHoursSvc = usedBaseHoursSvc + usedEventHoursSvc;
        const usagePercentSvc = totalAllowanceSvc > 0 ? (usedHoursSvc / totalAllowanceSvc) * 100 : 0;

        const baseTotalAllowanceKit = baseAllowanceKit + leaveRefundsKit + vacancyCompensationsKit;
        const totalAllowanceKit = baseTotalAllowanceKit + eventExtrasKit;
        const usedHoursKit = usedBaseHoursKit + usedEventHoursKit;
        const usagePercentKit = totalAllowanceKit > 0 ? (usedHoursKit / totalAllowanceKit) * 100 : 0;

        const baseAllowanceGlobal = baseAllowanceSvc + baseAllowanceKit;
        const leaveRefundsGlobal = leaveRefundsSvc + leaveRefundsKit;
        const vacancyCompensationsGlobal = vacancyCompensationsSvc + vacancyCompensationsKit;
        const baseTotalAllowanceGlobal = baseTotalAllowanceSvc + baseTotalAllowanceKit;
        const eventExtrasGlobal = eventExtrasSvc + eventExtrasKit;
        const totalAllowanceGlobal = totalAllowanceSvc + totalAllowanceKit;
        const usedHoursGlobal = usedHoursSvc + usedHoursKit;
        const usedBaseHoursGlobal = usedBaseHoursSvc + usedBaseHoursKit;
        const usedEventHoursGlobal = usedEventHoursSvc + usedEventHoursKit;
        const dailyEventQuotaGlobal = dailyEventQuotaSvc + dailyEventQuotaKit;
        const dailyEventUsedGlobal = dailyEventUsedSvc + dailyEventUsedKit;
        const usagePercentGlobal = totalAllowanceGlobal > 0 ? (usedHoursGlobal / totalAllowanceGlobal) * 100 : 0;

        const dailyUsageGlobal = {};
        const dailyAllowanceGlobal = {};
        CALENDAR_DAYS.forEach(day => {
            const dateStr = day.dateStr;

            const aSvc = dailyAllowanceSvc[dateStr] || { baseAvg: 0, leave: 0, vacancy: 0, event: 0, total: 0 };
            const aKit = dailyAllowanceKit[dateStr] || { baseAvg: 0, leave: 0, vacancy: 0, event: 0, total: 0 };

            dailyAllowanceGlobal[dateStr] = {
                baseAvg: aSvc.baseAvg + aKit.baseAvg,
                leave: aSvc.leave + aKit.leave,
                vacancy: aSvc.vacancy + aKit.vacancy,
                event: aSvc.event + aKit.event,
                total: aSvc.total + aKit.total
            };

            const uSvc = dailyUsageSvc[dateStr] || { base: 0, event: 0 };
            const uKit = dailyUsageKit[dateStr] || { base: 0, event: 0 };

            dailyUsageGlobal[dateStr] = {
                base: uSvc.base + uKit.base,
                event: uSvc.event + uKit.event
            };
        });

        return {
            baseAllowance: baseAllowanceGlobal,
            leaveRefunds: leaveRefundsGlobal,
            vacancyCompensations: vacancyCompensationsGlobal,
            baseTotalAllowance: baseTotalAllowanceGlobal,
            eventExtras: eventExtrasGlobal,
            totalAllowance: totalAllowanceGlobal,
            usedHours: usedHoursGlobal,
            usedBaseHours: usedBaseHoursGlobal,
            usedEventHours: usedEventHoursGlobal,
            dailyEventQuota: dailyEventQuotaGlobal,
            dailyEventUsed: dailyEventUsedGlobal,
            usagePercent: usagePercentGlobal,
            staffUsage,
            dailyUsage: dailyUsageGlobal,
            dailyAllowance: dailyAllowanceGlobal,

            service: {
                baseAllowance: baseAllowanceSvc,
                leaveRefunds: leaveRefundsSvc,
                vacancyCompensations: vacancyCompensationsSvc,
                baseTotalAllowance: baseTotalAllowanceSvc,
                eventExtras: eventExtrasSvc,
                totalAllowance: totalAllowanceSvc,
                usedHours: usedHoursSvc,
                usedBaseHours: usedBaseHoursSvc,
                usedEventHours: usedEventHoursSvc,
                dailyEventQuota: dailyEventQuotaSvc,
                dailyEventUsed: dailyEventUsedSvc,
                usagePercent: usagePercentSvc,
                dailyUsage: dailyUsageSvc,
                dailyAllowance: dailyAllowanceSvc
            },
            kitchen: {
                baseAllowance: baseAllowanceKit,
                leaveRefunds: leaveRefundsKit,
                vacancyCompensations: vacancyCompensationsKit,
                baseTotalAllowance: baseTotalAllowanceKit,
                eventExtras: eventExtrasKit,
                totalAllowance: totalAllowanceKit,
                usedHours: usedHoursKit,
                usedBaseHours: usedBaseHoursKit,
                usedEventHours: usedEventHoursKit,
                dailyEventQuota: dailyEventQuotaKit,
                dailyEventUsed: dailyEventUsedKit,
                usagePercent: usagePercentKit,
                dailyUsage: dailyUsageKit,
                dailyAllowance: dailyAllowanceKit
            }
        };
    }, [schedule, branchData, selectedMonth, selectedYear, selectedDateStr, CALENDAR_DAYS]);

    const isPtPendingApproval = useCallback((staff, dateStr) => {
        if (!staff || !staff.pos) return false;
        const isPt = staff.pos.includes('PT') || staff.pos.includes('PT ครัว');
        if (!isPt) return false;

        const dept = staff.dept || 'service';

        // 1. Check if there is an active pending request for EXTRA_PT on this date and department
        const hasPendingReq = pendingRequests.some(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && (r.dept || 'service') === dept && r.status === 'PENDING_MANAGER');
        if (hasPendingReq) return true;

        // 2. Check if the PT hours scheduled for this department on this date exceed the allowance
        const allowance = dept === 'kitchen'
            ? (ptLedger.kitchen.dailyAllowance[dateStr]?.total || 0)
            : (ptLedger.service.dailyAllowance[dateStr]?.total || 0);

        const usage = dept === 'kitchen'
            ? ((ptLedger.kitchen.dailyUsage[dateStr]?.base || 0) + (ptLedger.kitchen.dailyUsage[dateStr]?.event || 0))
            : ((ptLedger.service.dailyUsage[dateStr]?.base || 0) + (ptLedger.service.dailyUsage[dateStr]?.event || 0));

        const isOverQuota = usage > allowance;

        // 3. Check if there is an approved request for EXTRA_PT on this date and department
        const hasApprovedReq = pendingRequests.some(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && (r.dept || 'service') === dept && r.status === 'APPROVED');

        // If it's over quota and not approved, it is waiting/pending approval!
        if (isOverQuota && !hasApprovedReq) {
            return true;
        }

        return false;
    }, [pendingRequests, ptLedger]);

    const otLedger = useMemo(() => {
        let totalOtHours = 0;
        let dailyOtUsed = {};
        let staffOtUsage = {};
        const staffMap = {};
        (branchData.staff || []).forEach(s => staffMap[s.id] = s);

        Object.keys(schedule).forEach(dateStr => {
            const [yStr, mStr] = dateStr.split('-');
            if (parseInt(mStr, 10) - 1 !== selectedMonth || parseInt(yStr, 10) !== selectedYear) return;

            const dayData = schedule[dateStr];
            if (dayData.duties) {
                Object.keys(dayData.duties).forEach(dutyId => {
                    const slots = dayData.duties[dutyId] || [];
                    slots.forEach(slot => {
                        if (slot && slot.staffId && slot.otHours > 0) {
                            const actualId = slot.staffId.startsWith('COVER_BY_') ? slot.staffId.replace('COVER_BY_', '') : slot.staffId;
                            const staff = staffMap[actualId];
                            if (staff && !staff.pos.includes('PT')) {
                                const ot = Number(slot.otHours);
                                totalOtHours += ot;
                                dailyOtUsed[dateStr] = (dailyOtUsed[dateStr] || 0) + ot;
                                if (!staffOtUsage[staff.id]) staffOtUsage[staff.id] = { name: staff.name, pos: staff.pos, ot: 0 };
                                staffOtUsage[staff.id].ot += ot;
                            }
                        }
                    });
                });
            }
        });

        // คำนวณโควตาจาก โครงสร้างกะงาน (Matrix) ของเดือนที่กำลังเลือกอยู่
        let dynamicBudgetHours = 0;
        let dailyOtBudget = {};
        if (branchData.matrix && CALENDAR_DAYS && CALENDAR_DAYS.length > 0) {
            CALENDAR_DAYS.forEach(day => {
                let dayBudget = 0;
                const dayType = day.type;
                const dayData = schedule[day.dateStr] || { duties: {} };
                ['service', 'kitchen'].forEach(dept => {
                    (branchData.duties?.[dept] || []).forEach(duty => {
                        const matrixSlots = branchData.matrix?.[dayType]?.duties?.[duty.id] || [];
                        const assignedSlots = dayData.duties?.[duty.id] || [];
                        matrixSlots.forEach((mSlot, idx) => {
                            const assigned = assignedSlots[idx];
                            // โควตาจะถูกคิดก็ต่อเมื่อมีการจัดพนักงานลงกะนี้เท่านั้น
                            if (assigned && assigned.staffId) {
                                let ot = Number(mSlot.maxOtHours || 0);
                                if (mSlot.targetEndTime) {
                                    const actualStaffId = assigned.staffId.startsWith('COVER_BY_') ? assigned.staffId.replace('COVER_BY_', '') : assigned.staffId;
                                    const staff = branchData.staff?.find(s => s.id === actualStaffId);
                                    const preset = branchData.shiftPresets?.find(p => p.id === (assigned.shiftPresetId || mSlot.shiftPresetId)) || branchData.shiftPresets?.[0];
                                    const { endTime } = getShiftTimesForStaff(staff?.pos || 'OC', preset);
                                    ot = calculateOtHours(mSlot.targetEndTime, endTime);
                                }
                                dayBudget += ot;
                            }
                        });
                    });
                });
                dailyOtBudget[day.dateStr] = dayBudget;
                dynamicBudgetHours += dayBudget;
            });
        }

        const budgetHours = dynamicBudgetHours;
        const usagePercent = budgetHours > 0 ? (totalOtHours / budgetHours) * 100 : (totalOtHours > 0 ? 100 : 0);

        return { totalOtHours, budgetHours, usagePercent, dailyOtUsed, staffOtUsage, dailyOtBudget };
    }, [schedule, branchData, selectedMonth, selectedYear, CALENDAR_DAYS]);

    const activeDayShiftVisibilities = useMemo(() => {
        let hasMorning = false, hasLateMorning = false, hasAfternoon = false, hasEvening = false, hasNight = false;
        if (branchData.matrix && activeDay) {
            const thresholds = branchData.shiftThresholds || { morningEnd: 11, lateMorningEnd: 12, afternoonEnd: 16, eveningEnd: 19 };
            CURRENT_DUTY_LIST.forEach(duty => {
                const matrixSlots = branchData.matrix[activeDay.type]?.duties?.[duty.id] || [];
                const checkTime = (startTime) => {
                    if (!startTime || startTime === '??:??') return;
                    const stHour = parseInt(startTime.split(':')[0]) || 0;
                    if (stHour < thresholds.morningEnd) hasMorning = true;
                    else if (stHour >= thresholds.morningEnd && stHour < thresholds.lateMorningEnd) hasLateMorning = true;
                    else if (stHour >= thresholds.lateMorningEnd && stHour < thresholds.afternoonEnd) hasAfternoon = true;
                    else if (stHour >= thresholds.afternoonEnd && stHour < thresholds.eveningEnd) hasEvening = true;
                    else if (stHour >= thresholds.eveningEnd) hasNight = true;
                };

                matrixSlots.forEach(matrixSlot => {
                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);
                    if (!shiftPreset) return;
                    checkTime(shiftPreset.timings.long.startTime);
                    checkTime(shiftPreset.timings.short.startTime);
                });

                const assignedSlots = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                assignedSlots.forEach((assignedSlot, idx) => {
                    const shiftPresetId = assignedSlot?.shiftPresetId || matrixSlots[idx]?.shiftPresetId;
                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === shiftPresetId);
                    if (!shiftPreset) return;

                    const staffId = assignedSlot?.staffId?.startsWith('COVER_BY_') ? assignedSlot.staffId.replace('COVER_BY_', '') : assignedSlot?.staffId;
                    if (staffId) {
                        const staff = branchData.staff?.find(s => s.id === staffId);
                        if (staff) {
                            const { startTime } = getShiftTimesForStaff(staff.pos, shiftPreset);
                            checkTime(startTime);
                        }
                    } else {
                        checkTime(shiftPreset.timings.long.startTime);
                        checkTime(shiftPreset.timings.short.startTime);
                    }
                });
            });
        }
        const shiftColCount = (hasMorning ? 1 : 0) + (hasLateMorning ? 1 : 0) + (hasAfternoon ? 1 : 0) + (hasEvening ? 1 : 0) + (hasNight ? 1 : 0);
        return { hasMorning, hasLateMorning, hasAfternoon, hasEvening, hasNight, bottomColSpan: 1 + shiftColCount + 1 };
    }, [branchData.matrix, branchData.staff, activeDay, CURRENT_DUTY_LIST, branchData.shiftPresets, schedule, selectedDateStr]);

    const dailyComputedBreaks = useMemo(() => {
        const breaks = {};
        const dayData = schedule[selectedDateStr];
        if (!dayData || !dayData.duties) return breaks;

        const dayConfig = CALENDAR_DAYS.find(c => c.dateStr === selectedDateStr);
        if (!dayConfig) return breaks;
        const dayType = dayConfig.type;

        for (const dutyId in dayData.duties) {
            if (!breaks[dutyId]) breaks[dutyId] = {};
            const assignedSlots = dayData.duties[dutyId] || [];
            const assignedBreaks = []; // เก็บเวลาพักที่ถูกจัดไปแล้วในหน้าที่นี้เพื่อป้องกันการซ้อนทับ

            // Pre-calculate all start times for this duty to find replacements
            const allShiftTimes = [];
            assignedSlots.forEach((asg, idx) => {
                if (asg && asg.staffId) {
                    const stf = branchData.staff?.find(s => s.id === asg.staffId);
                    const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
                    const matrixSlot = matrixSlots[idx] || { shiftPresetId: asg.shiftPresetId || branchData.shiftPresets?.[0]?.id };
                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);
                    if (stf && shiftPreset) {
                        const { startTime } = getShiftTimesForStaff(stf.pos, shiftPreset);
                        if (startTime && startTime !== '??:??') {
                            const [sh, sm] = startTime.split(':').map(Number);
                            allShiftTimes.push(sh * 60 + sm);
                        }
                    }
                }
            });

            assignedSlots.forEach((assigned, idx) => {
                if (assigned && assigned.staffId) {
                    const staff = branchData.staff?.find(s => s.id === assigned.staffId);
                    const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
                    const matrixSlot = matrixSlots[idx] || { shiftPresetId: assigned.shiftPresetId || branchData.shiftPresets?.[0]?.id };
                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);

                    if (staff && shiftPreset) {
                        const { startTime, endTime } = getShiftTimesForStaff(staff.pos, shiftPreset);

                        if (startTime && endTime && startTime !== '??:??' && endTime !== '??:??') {
                            const [sh, sm] = startTime.split(':').map(Number);
                            let [eh, em] = endTime.split(':').map(Number);
                            if (eh < sh) eh += 24;

                            const myStartTime = sh * 60 + sm;
                            const grossMinutes = (eh * 60 + em) - myStartTime;

                            if (grossMinutes >= 360) { // ทำงาน 6 ชั่วโมงขึ้นไปได้พัก
                                let breakDuration = 60;
                                if (LONG_HOUR_POSITIONS.includes(staff.pos)) {
                                    breakDuration = 90; // พนักงานประจำพัก 1.5 ชม.
                                }

                                // Find replacement (Earliest shift that starts after me)
                                let replacementTime = null;
                                let minDiff = Infinity;
                                allShiftTimes.forEach(t => {
                                    if (t > myStartTime && t < (eh * 60 + em)) {
                                        if (t - myStartTime < minDiff) {
                                            minDiff = t - myStartTime;
                                            replacementTime = t;
                                        }
                                    }
                                });

                                let breakStartMinutes;
                                if (replacementTime !== null) {
                                    breakStartMinutes = replacementTime; // พักทันทีเมื่อมีตัวแทนมาถึง
                                } else {
                                    const midPointMinutes = myStartTime + (grossMinutes / 2);
                                    breakStartMinutes = midPointMinutes - (breakDuration / 2);

                                    // บังคับรอบพักให้เริ่มต้นที่ 12:30 (750 นาที) เป็นต้นไป ถ้าไม่มีคนแทน
                                    if (breakStartMinutes < 750) {
                                        breakStartMinutes = 750;
                                    }
                                }

                                // ปัดเศษเวลาเริ่มพักให้ลงตัวที่หลัก 30 นาทีเสมอ
                                breakStartMinutes = Math.round(breakStartMinutes / 30) * 30;

                                // บังคับไม่ให้มีใครพักตั้งแต่ 17:00 (1020 นาที) เป็นต้นไป ยกเว้นกะที่เข้างาน 15:00 (900 นาที) เป็นต้นไป
                                if (myStartTime < 900 && breakStartMinutes + breakDuration > 1020) {
                                    breakStartMinutes = 1020 - breakDuration;
                                }

                                // หลีกเลี่ยงเวลาพักซ้อนทับกันในหน้าที่เดียวกัน
                                let idealStart = breakStartMinutes;
                                let bestStart = idealStart;
                                let found = false;

                                const offsets = [0, -30, -60, -90, -120, -150, 30, 60, 90, 120];
                                for (const offset of offsets) {
                                    let testStart = idealStart + offset;
                                    let testEnd = testStart + breakDuration;

                                    // ต้องทำงานอย่างน้อย 1 ชั่วโมงก่อนพัก
                                    if (testStart < myStartTime + 60) continue;
                                    // ถ้าเข้างานก่อน 15:00 ต้องพักเสร็จไม่เกิน 17:00
                                    if (myStartTime < 900 && testEnd > 1020) continue;

                                    let overlap = false;
                                    for (const ab of assignedBreaks) {
                                        if (testStart < ab.end && testEnd > ab.start) {
                                            overlap = true;
                                            break;
                                        }
                                    }
                                    if (!overlap) {
                                        bestStart = testStart;
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found) bestStart = idealStart;
                                breakStartMinutes = bestStart;

                                const breakEndMinutes = breakStartMinutes + breakDuration;
                                assignedBreaks.push({ start: breakStartMinutes, end: breakEndMinutes });

                                const format = (totalMinutes) => {
                                    const h = Math.floor(totalMinutes / 60) % 24;
                                    const m = totalMinutes % 60;
                                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                };

                                breaks[dutyId][idx] = `${format(breakStartMinutes)}-${format(breakEndMinutes)}`;
                            } else {
                                breaks[dutyId][idx] = 'ไม่มีพัก';
                            }
                        } else {
                            breaks[dutyId][idx] = 'N/A';
                        }
                    } else {
                        breaks[dutyId][idx] = 'N/A';
                    }
                } else {
                    breaks[dutyId][idx] = '-';
                }
            });
        }
        return breaks;
    }, [schedule, selectedDateStr, branchData, CALENDAR_DAYS]);

    const getBaseManHours = useCallback((dayType, deptFilter) => {
        let total = 0;
        const depts = deptFilter ? [deptFilter] : ['service', 'kitchen'];
        depts.forEach(dept => {
            const list = branchData.duties?.[dept] || [];
            list.forEach(duty => {
                const slots = branchData.matrix?.[dayType]?.duties?.[duty.id] || [];
                slots.forEach(slot => {
                    const preset = branchData.shiftPresets?.find(p => p.id === slot.shiftPresetId);
                    if (preset) {
                        const { startTime, endTime } = preset.timings.long;
                        total += getNetWorkHours(startTime, endTime);
                    }
                    total += Number(slot.maxOtHours || 0);
                });
            });
        });
        return total;
    }, [branchData]);

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
            const sIdx = slots.findIndex(s => s && s.staffId === staffId);
            if (sIdx !== -1) {
                const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);
                const matrixSlots = branchData.matrix?.[dayType]?.duties?.[d.id] || [];
                const matrixSlot = matrixSlots[sIdx] || { shiftPresetId: slots[sIdx]?.shiftPresetId || branchData.shiftPresets?.[0]?.id };

                if (!matrixSlot || !matrixSlot.shiftPresetId) {
                    return { type: 'work', duty: d, slot: { startTime: '??:??', endTime: '??:??' }, actual: slots[sIdx], slotIdx: sIdx };
                }

                const staffInfo = branchData.staff?.find(s => s.id === staffId);
                const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);

                if (!shiftPreset || !staffInfo) {
                    return { type: 'work', duty: d, slot: { startTime: '??:??', endTime: '??:??' }, actual: slots[sIdx], slotIdx: sIdx };
                }

                const effectiveTimings = getShiftTimesForStaff(staffInfo.pos, shiftPreset);
                const effectiveSlot = { ...matrixSlot, ...effectiveTimings };

                return { type: 'work', duty: d, slot: effectiveSlot, actual: slots[sIdx], slotIdx: sIdx };
            }
        }
        return null;
    }, [schedule, branchData, LEAVE_TYPES]);

    // === EFFECTS ===
    // ดักจับกรณีโหลดหน้าเว็บใหม่ แล้วพบว่าหมดอายุ (Session โดนล้างไปแล้วจาก useState)
    useEffect(() => {
        if (sessionStorage.getItem('superstore_showTimeoutModal') === 'true') {
            sessionStorage.removeItem('superstore_showTimeoutModal');
            setConfirmModal({ message: 'ระบบได้ทำการออกจากระบบอัตโนมัติ เนื่องจากไม่ได้เปิดใช้งานหรือทิ้งไว้นานเกินเวลาที่กำหนด เพื่อความปลอดภัย' });
        }
    }, []);

    // ระบบ Auto Logout เมื่อไม่มีการใช้งานเกินเวลาที่กำหนด
    useEffect(() => {
        if (authRole === 'guest') return;

        const updateActivity = () => {
            const now = Date.now();
            lastActivityRef.current = now;
            localStorage.setItem('superstore_lastActivity', now.toString());
        };

        updateActivity();

        let throttleTimer = null;
        const throttledUpdateActivity = () => {
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => { updateActivity(); throttleTimer = null; }, 1000);
            }
        };

        // ตรวจจับการขยับเมาส์, เลื่อนจอ, พิมพ์คีย์บอร์ด, หรือแตะหน้าจอ (มือถือ)
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        events.forEach(e => window.addEventListener(e, throttledUpdateActivity));

        const intervalId = setInterval(() => {
            const storedActivity = parseInt(localStorage.getItem('superstore_lastActivity') || '0');
            const maxActivity = Math.max(lastActivityRef.current, storedActivity);

            if (Date.now() - maxActivity > INACTIVITY_TIMEOUT_MS) {
                setAuthRole('guest');
                setView('manager');
                setConfirmModal({ message: 'ระบบได้ทำการออกจากระบบอัตโนมัติ เนื่องจากไม่มีการใช้งานเกิน 15 นาที เพื่อความปลอดภัย' });
            }
        }, 60000); // เช็คทุกๆ 1 นาที

        return () => {
            events.forEach(e => window.removeEventListener(e, throttledUpdateActivity));
            clearInterval(intervalId);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [authRole]);

    // Persist Auth Session to LocalStorage
    useEffect(() => {
        if (authRole === 'guest') {
            localStorage.removeItem('superstore_session');
        } else {
            localStorage.setItem('superstore_session', JSON.stringify({ authRole, activeBranchId, view, authUser }));
        }
    }, [authRole, activeBranchId, view, authUser]);

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
            if (snap.exists()) {
                const data = snap.data();
                // ระบบตรวจจับเวอร์ชัน: ถ้าระบบมีเวอร์ชันใหม่กว่า ให้บังคับเบราว์เซอร์รีเฟรช 1 ครั้งเพื่อโหลดอัปเดต
                if (data.latestVersion && data.latestVersion !== CURRENT_APP_VERSION && sessionStorage.getItem('reloadedVersion') !== data.latestVersion) {
                    setNewVersionAvailable(data.latestVersion); // เปลี่ยนเป็นเก็บ State แจ้งเตือน แทนการรีเฟรชทันที
                }
                setGlobalConfig(data);
            }
            else setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), { admins: [{ user: 'admin', pass: 'superstore' }], branches: [], latestVersion: CURRENT_APP_VERSION });
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
                if (!data.shiftThresholds) {
                    data.shiftThresholds = { morningEnd: 11, lateMorningEnd: 12, afternoonEnd: 16, eveningEnd: 19 };
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
                if (!data.payrollConfig) { // Initialize new structure
                    data.payrollConfig = { monthlySalaryDivider: 30, otRateMonthly: 1.5, otRateHolidayMonthly: 3.0, otRateFtHourly: 1.5, otRatePt: 1.5, holidayMultiplierFtHourly: 2.0, holidayMultiplierPt: 2.0 };
                } else { // Migrate old structure
                    if (data.payrollConfig.otRateHourly) {
                        data.payrollConfig.otRateFtHourly = data.payrollConfig.otRateHourly;
                        data.payrollConfig.otRatePt = data.payrollConfig.otRateHourly;
                        delete data.payrollConfig.otRateHourly;
                    }
                    if (data.payrollConfig.holidayMultiplierHourly) {
                        data.payrollConfig.holidayMultiplierFtHourly = data.payrollConfig.holidayMultiplierHourly;
                        data.payrollConfig.holidayMultiplierPt = data.payrollConfig.holidayMultiplierHourly;
                        delete data.payrollConfig.holidayMultiplierHourly;
                    }
                    if (data.payrollConfig.monthlySalaryDivider === undefined) data.payrollConfig.monthlySalaryDivider = 30;
                    if (data.payrollConfig.otRateHolidayMonthly === undefined) data.payrollConfig.otRateHolidayMonthly = 3.0;
                    if (data.payrollConfig.otRateFtHourly === undefined) data.payrollConfig.otRateFtHourly = 1.5;
                    if (data.payrollConfig.otRatePt === undefined) data.payrollConfig.otRatePt = 1.5;
                    if (data.payrollConfig.holidayMultiplierFtHourly === undefined) data.payrollConfig.holidayMultiplierFtHourly = 2.0;
                    if (data.payrollConfig.holidayMultiplierPt === undefined) data.payrollConfig.holidayMultiplierPt = 2.0;
                }
                if (!data.matrix) {
                    data.matrix = generateDefaultMatrix(data.duties.service, data.duties.kitchen);
                } else {
                    if (data.matrix.weekday) {
                        ['monday', 'tuesday', 'wednesday', 'thursday'].forEach(day => {
                            if (!data.matrix[day]) {
                                data.matrix[day] = JSON.parse(JSON.stringify(data.matrix.weekday));
                            }
                        });
                    }

                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                        if (!data.matrix[dt]) {
                            data.matrix[dt] = { duties: {} };
                        }
                    });

                    let needsMigration = false;
                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                        if (data.matrix[dt]?.duties) {
                            Object.values(data.matrix[dt].duties).forEach(slots => {
                                if (slots && slots.length > 0 && slots[0] && slots[0].startTime) {
                                    needsMigration = true;
                                }
                            });
                        }
                    });

                    if (needsMigration) {
                        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                            if (data.matrix[dt]?.duties) {
                                Object.keys(data.matrix[dt].duties).forEach(dutyId => {
                                    data.matrix[dt].duties[dutyId] = data.matrix[dt].duties[dutyId].map(oldSlot => {
                                        const defaultShift = (dutyId.startsWith('K') ? 'S3' : 'S1');
                                        return { shiftPresetId: data.shiftPresets?.find(p => p.name.includes('เช้า'))?.id || defaultShift, maxOtHours: oldSlot.maxOtHours || 0 };
                                    });
                                });
                            }
                        });
                    }

                    if (data.matrix.weekend) {
                        if (!data.matrix.saturday) data.matrix.saturday = JSON.parse(JSON.stringify(data.matrix.weekend));
                        if (!data.matrix.sunday) data.matrix.sunday = JSON.parse(JSON.stringify(data.matrix.weekend));
                        delete data.matrix.weekend;
                    }

                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                        if (!data.matrix[dt]) data.matrix[dt] = { duties: {} };
                        if (!data.matrix[dt].duties) data.matrix[dt].duties = {};
                        ['service', 'kitchen'].forEach(dept => {
                            (data.duties[dept] || []).forEach(duty => {
                                if (!data.matrix[dt].duties[duty.id]) {
                                    const defaultShift = dept === 'service' ? 'S1' : 'S3';
                                    data.matrix[dt].duties[duty.id] = [{ shiftPresetId: defaultShift, maxOtHours: 0 }];
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
        const versionsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'schedule_versions', activeBranchId, 'items');
        const versionsQuery = query(versionsColRef, orderBy('timestamp', 'desc'), limit(5));
        const unsubVersions = onSnapshot(versionsQuery, (snap) => {
            setScheduleVersions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubReq = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), (snap) => {
            if (snap.exists()) setPendingRequests(snap.data().list || []); else setPendingRequests([]);
        });
        return () => { unsubBranch(); unsubSched(); unsubReq(); unsubVersions(); };
    }, [user, activeBranchId]);

    // Reset Landing Page view when branch changes
    const prevBranchRef = useRef(activeBranchId);
    useEffect(() => {
        if (prevBranchRef.current !== activeBranchId) {
            setHasSeenLanding(false);
            sessionStorage.removeItem('superstore_hasSeenLanding');
        }
        prevBranchRef.current = activeBranchId;
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
            sessionStorage.setItem('superstore_hasSeenLanding', 'true');
        }
    }, [activeBranchId, branchData, hasSeenLanding, authRole]);

    // ดักจับการเปลี่ยนเมนู (view) ถ้าระบบมีเวอร์ชันใหม่ ให้ทำการรีเฟรชอัตโนมัติอย่างปลอดภัย
    const prevViewRef = useRef(view);
    useEffect(() => {
        if (prevViewRef.current !== view && newVersionAvailable) {
            sessionStorage.setItem('reloadedVersion', newVersionAvailable);
            window.location.reload();
        }
        prevViewRef.current = view;
    }, [view, newVersionAvailable]);

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
            const isHoliday = isDateHoliday(selectedDateStr, branchData.holidays);
            const regularOffStaff = isHoliday ? [] : branchData.staff.filter(s => {
                if (!isStaffActiveOnDate(s, selectedDateStr)) return false;
                const daysOff = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
                return daysOff.includes(dayOfWeek);
            });
            const newSched = { ...prev };
            if (!newSched[selectedDateStr]) newSched[selectedDateStr] = { duties: {}, leaves: [] };
            const currentLeaves = newSched[selectedDateStr].leaves || [];
            const currentDuties = newSched[selectedDateStr].duties || {};
            const workingStaffIds = new Set();
            Object.values(currentDuties).forEach(slots => { slots.forEach(slot => { if (slot && slot.staffId) workingStaffIds.add(slot.staffId); }); });
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
            const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);

            CURRENT_DUTY_LIST.forEach(duty => {
                const slots = branchData.matrix[dayType]?.duties?.[duty.id] || [];
                const assigned = dayData.duties[duty.id] || [];
                slots.forEach((slot, idx) => {
                    if (assigned[idx] && assigned[idx].staffId) {
                        const matrixSlot = branchData.matrix[dayType]?.duties?.[duty.id]?.[idx];
                        if (matrixSlot && !assigned[idx].otUpdated && (!assigned[idx].otHours || assigned[idx].otHours === 0)) {
                            let targetOT = matrixSlot.maxOtHours || 0;
                            if (matrixSlot.targetEndTime) {
                                const actualStaffId = assigned[idx].staffId.startsWith('COVER_BY_') ? assigned[idx].staffId.replace('COVER_BY_', '') : assigned[idx].staffId;
                                const staff = branchData.staff?.find(s => s.id === actualStaffId);
                                const preset = branchData.shiftPresets?.find(p => p.id === (assigned[idx].shiftPresetId || matrixSlot.shiftPresetId));
                                const { endTime } = getShiftTimesForStaff(staff?.pos, preset);
                                targetOT = calculateOtHours(matrixSlot.targetEndTime, endTime);
                            }
                            if (targetOT > 0) {
                                assigned[idx].otHours = targetOT;
                                assigned[idx].otUpdated = true;
                                hasChanges = true;
                            }
                        }
                    }
                });
            });
        });
        if (hasChanges) setSchedule(newSched);
    }, [schedule, branchData.matrix, CURRENT_DUTY_LIST, branchData.holidays, branchData.shiftPresets, branchData.staff]);

    useEffect(() => {
        sessionStorage.setItem('superstore_activeDept', activeDept);
    }, [activeDept]);

    useEffect(() => {
        sessionStorage.setItem('superstore_managerViewMode', managerViewMode);
    }, [managerViewMode]);

    useEffect(() => {
        if (selectedDateStr) {
            sessionStorage.setItem('superstore_selectedDate', selectedDateStr);
            const dateMonth = parseInt(selectedDateStr.split('-')[1], 10) - 1;
            if (dateMonth !== selectedMonth) {
                setSelectedMonth(dateMonth);
            }
        }
    }, [selectedDateStr, selectedMonth]);

    useEffect(() => {
        if (view === 'area_dashboard' && authRole === 'areamanager') {
            const fetchData = async () => {
                const data = {};
                const am = globalConfig.areaManagers?.find(a => a.user === authUser);
                if (am && am.branches) {
                    for (const bId of am.branches) {
                        try {
                            const bSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', bId));
                            const sSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', bId));
                            data[bId] = {
                                branch: bSnap.exists() ? bSnap.data() : null,
                                schedule: sSnap.exists() ? sSnap.data().records : {}
                            };
                        } catch (e) { }
                    }
                }
                setAmData(data);
            };
            fetchData();
        }
    }, [view, authRole, authUser, globalConfig.areaManagers]);

    useEffect(() => {
        setNewDutyCategory(activeDept === 'service' ? 'FOH_STAFF' : 'BOH_STAFF');
    }, [activeDept]);

    const handleDownloadTemplate = () => {
        const headers = ['รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก (บริการ/ครัว)', 'ตำแหน่ง (เช่น OC, PT)', 'ประเภทจ้าง (รายเดือน/รายชั่วโมง/PT)', 'ฐานเงินเดือน/ค่าแรง', 'วันหยุดประจำสัปดาห์ (0=อาทิตย์, 1=จันทร์... 6=เสาร์)'];
        const sample1 = ['10001', 'สมชาย ใจดี', 'บริการ', 'OC', 'รายเดือน', '15000', '1'];
        const sample2 = ['10002', 'สมหญิง รักงาน', 'ครัว', 'PT ครัว', 'PT', '50', '2,4'];
        const csvContent = [headers.join(','), sample1.join(','), sample2.join(',')].join('\n');

        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'Staff_Import_Template.csv');
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => { setImportStaffText(evt.target.result); };
        reader.readAsText(file, 'UTF-8');
    };

    const handleImportStaff = () => {
        if (!importStaffText.trim()) return;
        const rows = importStaffText.split('\n');
        const newStaffs = [];
        let skipped = 0;
        rows.forEach((row, index) => {
            if (!row.trim()) return;
            if (index === 0 && (row.includes('ชื่อ') || row.includes('รหัส') || row.includes('Name'))) return;
            const cols = row.split('\t');
            const finalCols = cols.length > 1 ? cols : row.split(',');
            const empId = finalCols[0]?.trim() || '';
            const name = finalCols[1]?.trim() || '';
            const deptRaw = (finalCols[2] || '').trim().toLowerCase();
            const posRaw = (finalCols[3] || '').trim();
            const wageTypeRaw = (finalCols[4] || '').trim().toLowerCase();
            const baseWage = parseFloat(finalCols[5]?.trim() || '0') || 0;
            const dayOffRaw = finalCols[6]?.trim() || '';
            if (!name) { skipped++; return; }
            let dept = 'service';
            if (deptRaw.includes('ครัว') || deptRaw.includes('kitchen') || deptRaw.includes('boh')) dept = 'kitchen';
            let pos = 'OC';
            const validPositions = POSITIONS[dept];
            if (validPositions.includes(posRaw)) { pos = posRaw; } else if (validPositions.includes(posRaw.toUpperCase())) { pos = posRaw.toUpperCase(); } else { const match = validPositions.find(p => posRaw.toUpperCase().includes(p) || p.includes(posRaw.toUpperCase())); if (match) pos = match; }
            let wageType = 'MONTHLY';
            if (wageTypeRaw.includes('ชั่วโมง') || wageTypeRaw.includes('hourly')) wageType = 'HOURLY';
            if (wageTypeRaw.includes('pt') || wageTypeRaw.includes('พาร์ทไทม์') || wageTypeRaw.includes('พาสทาม')) wageType = 'PT';
            if (!wageTypeRaw) { if (pos.includes('PT')) wageType = 'PT'; else if (['DVT', 'EDC'].some(p => pos.includes(p))) wageType = 'HOURLY'; else wageType = 'MONTHLY'; }

            let regularDayOff = [];
            if (dayOffRaw !== '') {
                const parts = dayOffRaw.split(/[,|]/).map(p => p.trim());
                parts.forEach(part => {
                    const dayOffInt = parseInt(part, 10);
                    if (!isNaN(dayOffInt) && dayOffInt >= 0 && dayOffInt <= 6) {
                        regularDayOff.push(dayOffInt);
                    } else {
                        const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
                        const matchedIdx = dayNames.findIndex(d => part.includes(d));
                        if (matchedIdx !== -1) regularDayOff.push(matchedIdx);
                    }
                });
            }
            newStaffs.push({ id: 's' + Date.now() + index + Math.random().toString(36).substring(2, 9), empId: empId, name: name, dept: dept, pos: pos, regularDayOff: regularDayOff.length > 0 ? regularDayOff : null, startDate: new Date().toISOString().slice(0, 10), wageType: wageType, baseWage: baseWage, isActive: true });
        });
        if (newStaffs.length > 0) {
            setBranchData(p => { const nd = { ...p, staff: [...(p.staff || []), ...newStaffs] }; if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error); return nd; });
            setConfirmModal({ message: `นำเข้าพนักงานสำเร็จ ${newStaffs.length} คน` + (skipped > 0 ? ` (ข้ามข้อมูลที่ไม่มีชื่อ ${skipped} แถว)` : '') });
            setShowImportStaffModal(false); setImportStaffText('');
        } else { setConfirmModal({ message: 'ไม่พบข้อมูลที่สามารถนำเข้าได้ กรุณาตรวจสอบรูปแบบข้อมูลอีกครั้ง' }); }
    };

    // === HANDLERS ===
    const handleManagerLogin = (e) => {
        e.preventDefault();
        setLoginError('');

        const saveRememberMe = () => {
            try {
                if (rememberMe) {
                    localStorage.setItem('superstore_savedUsername', userInput);
                } else {
                    localStorage.removeItem('superstore_savedUsername');
                }
            } catch (e) { }
        };

        const admin = globalConfig.admins?.find(a => a.user === userInput && a.pass === passInput);
        if (admin) { saveRememberMe(); setAuthRole('superadmin'); setAuthUser(userInput); if (globalConfig.branches?.length > 0) setActiveBranchId(globalConfig.branches[0].id); setView('manager'); setHasSeenLanding(false); sessionStorage.removeItem('superstore_hasSeenLanding'); return; }

        const am = globalConfig.areaManagers?.find(a => a.user === userInput && a.pass === passInput);
        if (am) { saveRememberMe(); setAuthRole('areamanager'); setAuthUser(userInput); setActiveBranchId(am.branches[0] || null); setView('area_dashboard'); setHasSeenLanding(false); sessionStorage.removeItem('superstore_hasSeenLanding'); return; }

        const branch = globalConfig.branches?.find(b => b.user === userInput && b.pass === passInput);
        if (branch) { saveRememberMe(); setAuthRole('branch'); setAuthUser(userInput); setActiveBranchId(branch.id); setView('manager'); setHasSeenLanding(false); sessionStorage.removeItem('superstore_hasSeenLanding'); return; }
        setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    };

    const handleMenuChange = (newView, overrideBranchId = activeBranchId) => {
        localStorage.setItem('superstore_session', JSON.stringify({ authRole, activeBranchId: overrideBranchId, view: newView, authUser }));
        setTimeout(() => {
            window.location.reload();
        }, 150);
    };

    const handleBranchChange = (e) => {
        const newBranchId = e.target.value;
        setActiveBranchId(newBranchId);
        localStorage.setItem('superstore_session', JSON.stringify({ authRole, activeBranchId: newBranchId, view, authUser }));
        setTimeout(() => window.location.reload(), 150);
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
                            const reqRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', b.id);

                            const [bSnap, sSnap, rSnap] = await Promise.all([getDoc(branchRef), getDoc(schedRef), getDoc(reqRef)]);

                            if (bSnap.exists() && sSnap.exists()) {
                                const backupRef = doc(db, 'artifacts', appId, 'public', 'data', 'backups', `${b.id}_day_${dayOfMonth}`);
                                await setDoc(backupRef, {
                                    backupDate: todayStr,
                                    timestamp: Date.now(),
                                    branchData: bSnap.data(),
                                    schedule: sSnap.data().records || {},
                                    requests: rSnap.exists() ? rSnap.data().list || [] : []
                                });
                            }
                        }

                        // แบคอัปข้อมูลส่วนกลาง (Global Config & Templates)
                        const masterRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master');
                        const templatesRef = doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates');
                        const [mSnap, tSnap] = await Promise.all([getDoc(masterRef), getDoc(templatesRef)]);

                        const globalBackupRef = doc(db, 'artifacts', appId, 'public', 'data', 'backups', `GLOBAL_day_${dayOfMonth}`);
                        await setDoc(globalBackupRef, {
                            backupDate: todayStr,
                            timestamp: Date.now(),
                            masterConfig: mSnap.exists() ? mSnap.data() : {},
                            templates: tSnap.exists() ? tSnap.data().list || [] : []
                        });

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

    // OPTIMIZED: Day-Level Merge Auto Save
    // changedDateStr = null means save entire schedule (for multi-day ops like auto-assign)
    // changedDateStr = 'YYYY-MM-DD' means only save that specific day (fast, ~1-5KB)
    const autoSaveSchedule = useCallback((scheduleData, immediate = false, changedDateStr = null) => {
        const fullSchedule = scheduleData || scheduleRef.current;
        if (!activeBranchId) return Promise.resolve();

        setSaveStatus('saving');

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        return new Promise((resolve, reject) => {
            const performSave = async () => {
                try {
                    if (changedDateStr) {
                        // Fast path: merge only the changed day (payload ~1-5KB instead of ~300KB+)
                        const dayData = fullSchedule[changedDateStr] || null;
                        await setDoc(
                            doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId),
                            { records: { [changedDateStr]: dayData } },
                            { merge: true }
                        );
                    } else {
                        // Full save: for multi-day changes (auto-assign, undo, clear all)
                        await setDoc(
                            doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId),
                            { records: fullSchedule }
                        );
                    }
                    setSaveStatus('success');
                    setTimeout(() => { setSaveStatus(null); }, 1500);
                    resolve();
                } catch (err) {
                    setSaveStatus('error');
                    reject(err);
                }
            };

            if (immediate) {
                performSave();
            } else {
                // Increased debounce: 2000ms to reduce Firestore writes when editing multiple cells quickly
                autoSaveTimerRef.current = setTimeout(performSave, 2000);
                resolve();
            }
        });
    }, [activeBranchId]);

    const saveScheduleVersion = async (type, scheduleData) => {
        if (!activeBranchId) return;
        try {
            // Write each version as its own document in a sub-collection to avoid the 1MB Firestore limit
            const versionId = 'v' + Date.now();
            const versionsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'schedule_versions', activeBranchId, 'items');
            const newVersionRef = doc(versionsColRef, versionId);
            await setDoc(newVersionRef, {
                id: versionId,
                timestamp: Date.now(),
                type: type,
                schedule: scheduleData
            });

            // Prune: delete versions older than the 5 most recent
            const allVersionsQuery = query(versionsColRef, orderBy('timestamp', 'desc'));
            const allSnap = await getDocs(allVersionsQuery);
            const toDelete = allSnap.docs.slice(5); // keep first 5 (newest), delete the rest
            await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
        } catch (e) {
            console.error("Failed to save schedule version:", e);
        }
    };

    const handleRestoreVersion = (versionToRestore) => {
        if (!versionToRestore || !versionToRestore.schedule) return;
        setConfirmModal({
            message: `คุณต้องการกู้คืนตารางกะงานของเวอร์ชันที่บันทึกไว้เมื่อ ${new Date(versionToRestore.timestamp).toLocaleString('th-TH')} ใช่หรือไม่? ข้อมูลปัจจุบันจะถูกเขียนทับ`,
            action: async () => {
                setSchedule(versionToRestore.schedule);
                await autoSaveSchedule(versionToRestore.schedule, true);
                setShowHistoryModal(false);
                setConfirmModal({ message: 'กู้คืนข้อมูลสำเร็จ!' });
            }
        });
    };

    const handlePrintMonthly = () => {
        window.print();
    }; const handleGlobalSave = async () => {
        if (authRole === 'guest' || authRole === 'staff') return;

        // Validation: ป้องกันการเซฟข้อมูลว่างเปล่าไปทับฐานข้อมูล
        if (authRole === 'superadmin') {
            if (!globalConfig || !globalConfig.admins || globalConfig.admins.length === 0) {
                setConfirmModal({ message: '❌ ไม่สามารถบันทึกข้อมูลส่วนกลางได้ เนื่องจากข้อมูลส่วนกลาง (Master Config) ยังโหลดไม่สมบูรณ์' });
                return;
            }
        }
        if (activeBranchId) {
            if (!branchData || !branchData.matrix || !branchData.duties) {
                setConfirmModal({ message: '❌ ไม่สามารถบันทึกข้อมูลสาขาได้ เนื่องจากข้อมูลสาขายังโหลดไม่สมบูรณ์' });
                return;
            }
        }

        setSaveStatus('saving');
        try {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const dayOfMonth = now.getDate();

            // OPTIMIZED: Build parallel save tasks (only critical data, backup runs in background)
            const saveTasks = [];

            if (authRole === 'superadmin') {
                saveTasks.push(
                    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), globalConfig, { merge: true })
                );
            }
            if (activeBranchId) {
                saveTasks.push(
                    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData, { merge: true }),
                    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), { records: schedule }, { merge: true })
                );
            }

            // Run all critical saves in PARALLEL (not sequential)
            await Promise.all(saveTasks);

            // Show success immediately - user doesn't need to wait for backups
            setSaveStatus('success');
            setShowSuccessModal(true);
            setTimeout(() => { setSaveStatus(null); setShowSuccessModal(false); }, 2000);

            // Backups run in BACKGROUND (fire-and-forget, non-blocking)
            const runBackups = async () => {
                const backupTasks = [];
                if (authRole === 'superadmin') {
                    backupTasks.push(
                        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'backups', `GLOBAL_day_${dayOfMonth}`), {
                            backupDate: todayStr,
                            timestamp: Date.now(),
                            masterConfig: globalConfig,
                            templates: globalTemplates
                        }, { merge: true })
                    );
                }
                if (activeBranchId) {
                    backupTasks.push(
                        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'backups', `${activeBranchId}_day_${dayOfMonth}`), {
                            backupDate: todayStr,
                            timestamp: Date.now(),
                            branchData: branchData,
                            schedule: schedule,
                            requests: pendingRequests || []
                        }, { merge: true })
                    );
                }
                await Promise.all(backupTasks);
            };
            runBackups().catch(err => console.warn('Background backup failed (non-critical):', err));

        } catch (err) {
            setSaveStatus('error');
        }
    };

    const handleScheduleUpdate = (dateStr, dutyId, slotIndex, field, value, defaultOt = 0) => {
        let newSchedToSave = null;
        setSchedule(prev => {
            const newSched = JSON.parse(JSON.stringify(prev));
            if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
            if (!newSched[dateStr].duties) newSched[dateStr].duties = {};
            if (!newSched[dateStr].duties[dutyId]) newSched[dateStr].duties[dutyId] = [];
            const currentSlots = newSched[dateStr].duties[dutyId];
            if (!currentSlots[slotIndex]) currentSlots[slotIndex] = { staffId: "", otHours: 0 };

            if (field === 'breakTime' && value === undefined) {
                delete currentSlots[slotIndex].breakTime; // ถ้าส่ง undefined มา (จากการกดปุ่ม X) ให้ลบทิ้งเพื่อกลับไปใช้ AI
            } else {
                currentSlots[slotIndex][field] = value;
            }
            currentSlots[slotIndex].otUpdated = true;
            if (field === 'staffId') {
                currentSlots[slotIndex].otHours = parseFloat(defaultOt) || 0;
            }

            newSchedToSave = newSched;
            return newSched;
        }); setTimeout(() => {
            if ((field === 'staffId' || field === 'breakTime') && activeBranchId && newSchedToSave) {
                autoSaveSchedule(newSchedToSave, false, dateStr);
            }
        }, 0);
    };

    const handleAddExtraSlot = (dateStr, dutyId, matrixSlots, isEventExtra) => {
        setSchedule(prev => {
            const newSched = JSON.parse(JSON.stringify(prev));
            if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
            if (!newSched[dateStr].duties) newSched[dateStr].duties = {};
            if (!newSched[dateStr].duties[dutyId]) newSched[dateStr].duties[dutyId] = [];

            const currentAssigned = newSched[dateStr].duties[dutyId];

            // เติมช่องว่างให้ครบตามโครงสร้างกะงาน (Matrix) ก่อนเพิ่ม Extra
            while (currentAssigned.length < matrixSlots.length) {
                currentAssigned.push({ staffId: "", otHours: 0 });
            }

            currentAssigned.push({
                staffId: "",
                otHours: 0,
                isEventExtra: isEventExtra,
                shiftPresetId: branchData.shiftPresets?.[0]?.id || 'S1'
            }); if (activeBranchId) autoSaveSchedule(newSched, false, dateStr);
            return newSched;
        });
    }; const handleRemoveExtraSlot = (dateStr, dutyId, slotIdx) => {
        setSchedule(prev => {
            const newSched = JSON.parse(JSON.stringify(prev));
            if (newSched[dateStr] && newSched[dateStr].duties && newSched[dateStr].duties[dutyId]) {
                newSched[dateStr].duties[dutyId].splice(slotIdx, 1);
            }
            if (activeBranchId) autoSaveSchedule(newSched, false, dateStr);
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

            // หากมีการบันทึกวันลา/วันหยุดแบบกลุ่ม ให้ถอดชื่อพนักงานเหล่านั้นออกจากกะงานวันนั้นโดยอัตโนมัติ
            if (newSched[dateStr].duties) {
                Object.values(newSched[dateStr].duties).forEach(slots => {
                    slots.forEach(slot => {
                        if (slot && selectedStaffIds.includes(slot.staffId)) {
                            slot.staffId = "";
                            slot.otHours = 0;
                        }
                    });
                });
            } if (activeBranchId) autoSaveSchedule(newSched, false, dateStr);
            return newSched;
        });
    }, [activeBranchId, autoSaveSchedule]);

    const handleToggleLeave = useCallback((staffId, dateStr, leaveTypeId) => {
        setSchedule(prev => {
            const newSched = JSON.parse(JSON.stringify(prev));
            if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [], autoLeavesAssigned: true };
            if (!newSched[dateStr].leaves) newSched[dateStr].leaves = [];

            // ลบสถานะวันหยุดเดิมของพนักงานคนนี้ในวันนั้นๆ ออกก่อน
            newSched[dateStr].leaves = newSched[dateStr].leaves.filter(l => l.staffId !== staffId);

            // หากพนักงานถูกจัดงานอยู่แล้ว ให้ถอดชื่อเขาออกจากกะงานวันนั้นโดยอัตโนมัติ และเคลียร์ isFixed
            if (newSched[dateStr].duties) {
                Object.values(newSched[dateStr].duties).forEach(slots => {
                    slots.forEach(slot => {
                        if (slot && slot.staffId === staffId) {
                            slot.staffId = "";
                            slot.otHours = 0;
                            delete slot.isFixed;
                        }
                    });
                });
            }

            if (leaveTypeId) {
                if (leaveTypeId.startsWith('DUTY_ASSIGN_')) {
                    // รูปแบบ: DUTY_ASSIGN_{dutyId}_{slotIdx}
                    const parts = leaveTypeId.split('_');
                    const dutyId = parts[2];
                    const slotIdx = parseInt(parts[3], 10);

                    if (!newSched[dateStr].duties) {
                        newSched[dateStr].duties = {};
                    }
                    if (!newSched[dateStr].duties[dutyId]) {
                        newSched[dateStr].duties[dutyId] = [];
                    }

                    // เติมช่องว่างให้ครบตามโครงสร้างกะงาน (Matrix)
                    const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);
                    const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
                    while (newSched[dateStr].duties[dutyId].length < matrixSlots.length) {
                        newSched[dateStr].duties[dutyId].push({ staffId: "", otHours: 0 });
                    }

                    if (newSched[dateStr].duties[dutyId][slotIdx]) {
                        newSched[dateStr].duties[dutyId][slotIdx].staffId = staffId;
                        newSched[dateStr].duties[dutyId][slotIdx].isFixed = true;

                        // คำนวณชั่วโมง OT
                        const staffObj = branchData.staff?.find(s => s.id === staffId);
                        if (staffObj) {
                            const matrixSlot = matrixSlots[slotIdx] || { shiftPresetId: 'S1' };
                            const preset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);
                            if (preset) {
                                const { endTime } = getShiftTimesForStaff(staffObj.pos, preset);
                                let assignedOT = 0;
                                if (matrixSlot.targetEndTime) {
                                    assignedOT = calculateOtHours(matrixSlot.targetEndTime, endTime);
                                } else {
                                    assignedOT = matrixSlot.maxOtHours || 0;
                                }
                                const layer = getStaffLayer(activeDept, staffObj.pos);
                                const giveOT = !layer.id.includes('HEAD') && assignedOT > 0;
                                newSched[dateStr].duties[dutyId][slotIdx].otHours = giveOT ? assignedOT : 0;
                                newSched[dateStr].duties[dutyId][slotIdx].otUpdated = true;
                            }
                        }
                    }
                } else {
                    // บันทึกวันหยุดปกติ
                    newSched[dateStr].leaves.push({ staffId, type: leaveTypeId });
                }
            } if (activeBranchId) autoSaveSchedule(newSched, false, dateStr);
            return newSched;
        });
    }, [activeBranchId, autoSaveSchedule, branchData, activeDept]);

    const handleUpdatePtConfig = (field, value) => {
        setBranchData(prev => {
            return {
                ...prev,
                ptConfig: {
                    ...(prev.ptConfig || { monthlyBudget: '', hourlyRate: '' }),
                    [field]: value
                }
            };
        });
    };

    const handleSavePtConfig = async (field, value) => {
        if (!activeBranchId) return;
        const parsedValue = parseFloat(value) || 0;
        setBranchData(prev => {
            const nd = { ...prev, ptConfig: { ...(prev.ptConfig || { monthlyBudget: 0, hourlyRate: 50 }), [field]: parsedValue } };
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
    };

    const handleUpdateOtConfig = (field, value) => {
        setBranchData(prev => {
            return {
                ...prev,
                otConfig: {
                    ...(prev.otConfig || { monthlyBudgetHours: '' }),
                    [field]: value
                }
            };
        });
    };

    const handleSaveOtConfig = async (field, value) => {
        if (!activeBranchId) return;
        const parsedValue = parseFloat(value) || 0;
        setBranchData(prev => {
            const nd = { ...prev, otConfig: { ...(prev.otConfig || { monthlyBudgetHours: 0 }), [field]: parsedValue } };
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
    };

    const handleUpdatePayrollConfig = (field, value) => {
        setBranchData(prev => ({
            ...prev,
            payrollConfig: { ...(prev.payrollConfig || {}), [field]: value }
        }));
    };

    const handleSavePayrollConfig = async (field, value) => {
        if (!activeBranchId) return;
        const parsedValue = parseFloat(value) || 0;
        setBranchData(prev => {
            const nd = { ...prev, payrollConfig: { ...(prev.payrollConfig || {}), [field]: parsedValue } };
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
    };

    const handleAddDuty = () => {
        if (!newDutyJobA.trim()) return;
        const newId = (activeDept === 'service' ? 'D' : 'K') + Date.now();
        const newDuty = { id: newId, category: newDutyCategory, jobA: newDutyJobA.trim(), jobB: newDutyJobB.trim() || '-', xpDna: newDutyXpDna.trim(), reqPos: newDutyReqPos, isBackup: newDutyIsBackup, prepItems: newDutyPrepItems };
        setBranchData(prev => {
            const nd = JSON.parse(JSON.stringify(prev));
            if (!nd.duties) nd.duties = { service: DEFAULT_SERVICE_DUTIES, kitchen: DEFAULT_KITCHEN_DUTIES };
            if (!nd.duties[activeDept]) nd.duties[activeDept] = activeDept === 'service' ? DEFAULT_SERVICE_DUTIES : DEFAULT_KITCHEN_DUTIES;
            nd.duties[activeDept].push(newDuty);
            if (!nd.matrix) nd.matrix = generateDefaultMatrix();
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                if (!nd.matrix[dt].duties[newId]) nd.matrix[dt].duties[newId] = [{ shiftPresetId: 'S1', maxOtHours: 0 }];
            });
            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
        setNewDutyJobA(''); setNewDutyJobB(''); setNewDutyXpDna(''); setNewDutyReqPos(['ALL']); setNewDutyIsBackup(false); setNewDutyPrepItems([]); setNewPrepName(''); setNewPrepMultiplier(''); setNewPrepUnit('กก.');
    };

    const handleEditDutySave = () => {
        setBranchData(prev => {
            const nd = JSON.parse(JSON.stringify(prev));
            const idx = nd.duties[activeDept].findIndex(d => d.id === editingDutyId);
            if (idx > -1) nd.duties[activeDept][idx] = editDutyData;
            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
        setEditingDutyId(null);
    };

    const handleDeleteDuty = (dutyId) => {
        setBranchData(prev => {
            const nd = JSON.parse(JSON.stringify(prev));
            nd.duties[activeDept] = nd.duties[activeDept].filter(d => d.id !== dutyId);
            if (nd.matrix) {
                ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                    if (nd.matrix[dt] && nd.matrix[dt].duties) delete nd.matrix[dt].duties[dutyId];
                });
            }
            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
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
    const saveEditStaff = () => {
        setBranchData(prev => {
            const nd = { ...prev, staff: prev.staff.map(s => s.id === editingStaffId ? editStaffData : s) };
            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
        setEditingStaffId(null);
    };
    const startEditBranch = (branch) => { setEditingBranchId(branch.id); setEditBranchData({ ...branch }); };
    const saveEditBranch = () => {
        setGlobalConfig(prev => {
            const nc = { ...prev, branches: prev.branches.map(b => b.id === editingBranchId ? editBranchData : b) };
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc).catch(console.error);
            return nc;
        });
        setEditingBranchId(null);
    };
    const startEditAm = (am) => { setEditingAmId(am.id); setEditAmData({ ...am }); };
    const saveEditAm = () => {
        setGlobalConfig(prev => {
            const nc = { ...prev, areaManagers: prev.areaManagers.map(a => a.id === editingAmId ? editAmData : a) };
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc).catch(console.error);
            return nc;
        });
        setEditingAmId(null);
    };

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

    const handleUpdateHourlyTc = (cycleKey, hour, value) => {
        setBranchData(prev => {
            const nd = JSON.parse(JSON.stringify(prev));
            if (!nd.matrix[cycleKey]) nd.matrix[cycleKey] = { duties: {} };
            if (!nd.matrix[cycleKey].hourlyTc) {
                nd.matrix[cycleKey].hourlyTc = {};
            }
            nd.matrix[cycleKey].hourlyTc[hour] = parseInt(value) || 0;
            return nd;
        });
    };

    const handleUpdatePrepGoal = async (cycleKey, action, payload) => {
        let nd = JSON.parse(JSON.stringify(branchData));
        if (!nd.matrix[cycleKey]) nd.matrix[cycleKey] = { duties: {} };

        let currentGoals = nd.matrix[cycleKey].prepGoals;
        if (!currentGoals) {
            currentGoals = [
                { id: 'prep_1', name: 'กะเช้า', start: '09', end: '12' },
                { id: 'prep_2', name: 'กะบ่าย', start: '13', end: '22' }
            ];
        } else if (!Array.isArray(currentGoals)) {
            currentGoals = [
                { id: 'prep_1', name: 'กะเช้า', start: currentGoals.morning?.start || '09', end: currentGoals.morning?.end || '12' },
                { id: 'prep_2', name: 'กะบ่าย', start: currentGoals.afternoon?.start || '13', end: currentGoals.afternoon?.end || '22' }
            ];
        }

        if (action === 'add') {
            currentGoals.push({ id: 'prep_' + Date.now(), name: 'กะใหม่', start: '00', end: '00' });
        } else if (action === 'update') {
            const { id, field, value } = payload;
            const idx = currentGoals.findIndex(g => g.id === id);
            if (idx > -1) currentGoals[idx][field] = value;
        } else if (action === 'delete') {
            currentGoals = currentGoals.filter(g => g.id !== payload.id);
        }

        nd.matrix[cycleKey].prepGoals = currentGoals;
        setBranchData(nd);

        if (activeBranchId && (action === 'add' || action === 'delete')) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
        }
    };

    const handleAutoAssignDayOffs = async () => {
        const nd = JSON.parse(JSON.stringify(branchData));
        const limits = nd.dayOffLimits; // Now { service: {...}, kitchen: {...} }
        const counts = { service: {}, kitchen: {} };

        const teamCounts = { service: {}, kitchen: {} };
        DUTY_CATEGORIES.service.forEach(cat => teamCounts.service[cat.id] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
        DUTY_CATEGORIES.kitchen.forEach(cat => teamCounts.kitchen[cat.id] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });

        (nd.staff || []).forEach(s => {
            if (s.isActive !== false) {
                const daysOff = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
                const dept = s.dept || 'service';
                daysOff.forEach(dOff => {
                    counts[dept][dOff] = (counts[dept][dOff] || 0) + 1;
                    const layer = getStaffLayer(dept, s.pos);
                    if (teamCounts[dept][layer.id]) {
                        teamCounts[dept][layer.id][dOff]++;
                    }
                });
            }
        });
        let changed = false;
        (nd.staff || []).filter(s => s.isActive !== false).forEach(s => {
            const daysOff = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
            if (daysOff.length === 0) {
                const dept = s.dept || 'service';
                const deptLimits = limits[dept];
                const deptCounts = counts[dept];
                const layer = getStaffLayer(dept, s.pos);
                const layerCounts = teamCounts[dept][layer.id];

                const daysOrder = [1, 2, 3, 4, 5, 6, 0];
                let validDays = daysOrder.filter(dayId => (deptCounts[dayId] || 0) < deptLimits[dayId]);

                if (validDays.length > 0) {
                    validDays.sort((a, b) => {
                        const teamDiff = (layerCounts[a] || 0) - (layerCounts[b] || 0);
                        if (teamDiff !== 0) return teamDiff;
                        return (deptCounts[a] || 0) - (deptCounts[b] || 0);
                    });

                    const bestDay = validDays[0];
                    s.regularDayOff = [bestDay];
                    deptCounts[bestDay] = (deptCounts[bestDay] || 0) + 1;
                    layerCounts[bestDay] = (layerCounts[bestDay] || 0) + 1;
                    changed = true;
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
        setBranchData(prev => {
            const nd = { ...prev, shiftPresets: [...(prev.shiftPresets || []), newPreset] };
            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });
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
        const newAnn = { id: 'A' + Date.now(), title: newAnnTitle, content: newAnnContent, imageUrl: newAnnImage, isActive: true, startDate: newAnnStartDate, endDate: newAnnEndDate };
        const nd = { ...branchData, announcements: [...(branchData.announcements || []), newAnn] };
        setBranchData(nd);
        if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
        setNewAnnTitle(''); setNewAnnContent(''); setNewAnnImage(''); setNewAnnStartDate(''); setNewAnnEndDate('');
    };

    const handleDeleteAnnouncement = async (id) => {
        const nd = { ...branchData, announcements: branchData.announcements.filter(a => a.id !== id) };
        setBranchData(nd);
        if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
    };

    const handleToggleAnnouncement = async (id, isActive) => {
        const nd = { ...branchData, announcements: branchData.announcements.map(a => a.id === id ? { ...a, isActive } : a) };
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
            <button type="button" onClick={() => handleFormatContent('<b>', '</b>', editorId, textValue, setTextValue)} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="ตัวหนา"><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleFormatContent('<i>', '</i>', editorId, textValue, setTextValue)} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="ตัวเอียง"><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => handleFormatContent('<u>', '</u>', editorId, textValue, setTextValue)} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="ขีดเส้นใต้"><Underline className="w-4 h-4" /></button>
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
            }} className="p-1.5 text-slate-700 hover:bg-white hover:shadow-sm rounded transition" title="แทรกลิงก์"><LinkIcon className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-slate-300 mx-1"></div>
            <button type="button" onClick={() => handleFormatContent('\n', '', editorId, textValue, setTextValue)} className="px-2 py-1 text-slate-700 hover:bg-white hover:shadow-sm rounded text-[10px] font-bold transition" title="ขึ้นบรรทัดใหม่">↵ ปัดบรรทัด</button>
        </div>
    );

    const handleSaveGuide = async () => {
        if (authRole !== 'superadmin') return;
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

        const matrixCopy = JSON.parse(JSON.stringify(branchData.matrix || {}));
        Object.keys(matrixCopy).forEach(dayType => {
            if (matrixCopy[dayType]) {
                delete matrixCopy[dayType].hourlyTc;
            }
        });

        const { staff, matrix, ...otherConfig } = branchData;

        const newTemplate = {
            id: 'T' + Date.now(),
            name: `${templateName.trim()} (${globalConfig.branches?.find(b => b.id === activeBranchId)?.name || 'Unknown'})`,
            ...otherConfig,
            matrix: matrixCopy,
            branchId: activeBranchId
        };
        try {
            const newList = [...globalTemplates, newTemplate];
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), { list: newList });
            setTemplateName('');
            setConfirmModal({ message: 'บันทึกแม่แบบไปยังส่วนกลางสำเร็จ! (สาขาอื่นสามารถโหลดใช้งานได้)' });
        } catch (e) { setConfirmModal({ message: "บันทึกแม่แบบล้มเหลว" }); }
    };

    const handleLoadTemplate = (tplId) => {
        const tpl = globalTemplates.find(t => t.id === tplId);
        if (tpl) {
            setLoadTemplateState(tpl);
            setLoadTemplateOptions({
                duties: true,
                matrix: true,
                shiftPresets: true,
                holidays: true,
                configs: true,
                rosterStyle: true
            });
        }
    };

    const confirmLoadTemplate = () => {
        if (!loadTemplateState) return;
        const tpl = loadTemplateState;
        setBranchData(prev => {
            const newData = { ...prev };

            if (loadTemplateOptions.duties && tpl.duties) newData.duties = tpl.duties;
            if (loadTemplateOptions.shiftPresets) {
                if (tpl.shiftPresets) newData.shiftPresets = tpl.shiftPresets;
                if (tpl.shiftThresholds) newData.shiftThresholds = tpl.shiftThresholds;
            }
            if (loadTemplateOptions.holidays) {
                if (tpl.holidays) newData.holidays = tpl.holidays;
                if (tpl.holidayCycles) newData.holidayCycles = tpl.holidayCycles;
            }
            if (loadTemplateOptions.configs) {
                if (tpl.ptConfig) newData.ptConfig = tpl.ptConfig;
                if (tpl.otConfig) newData.otConfig = tpl.otConfig;
                if (tpl.payrollConfig) newData.payrollConfig = tpl.payrollConfig;
                if (tpl.staffLimits) newData.staffLimits = tpl.staffLimits;
                if (tpl.dayOffLimits) newData.dayOffLimits = tpl.dayOffLimits;
                if (tpl.totalTables !== undefined) newData.totalTables = tpl.totalTables;
            }
            if (loadTemplateOptions.rosterStyle && tpl.rosterStyle) newData.rosterStyle = tpl.rosterStyle;

            if (loadTemplateOptions.matrix && tpl.matrix) {
                const newMatrix = JSON.parse(JSON.stringify(tpl.matrix));
                if (prev.matrix) {
                    Object.keys(prev.matrix).forEach(dayType => {
                        if (prev.matrix[dayType]?.hourlyTc) {
                            if (!newMatrix[dayType]) newMatrix[dayType] = {};
                            newMatrix[dayType].hourlyTc = prev.matrix[dayType].hourlyTc;
                        }
                    });
                }
                newData.matrix = newMatrix;
            }

            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), newData).catch(console.error);

            return newData;
        });
        setLoadTemplateState(null);
        setConfirmModal({ message: `โหลดแม่แบบ "${tpl.name}" สำเร็จ!` });
    };
    const handleDeleteTemplate = async (tplId) => {
        const newList = globalTemplates.filter(t => t.id !== tplId);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), { list: newList });
    };

    const handleShareToLine = () => {
        let txt = `📅 *ตารางงานวันที่ ${activeDay.dayNum} ${THAI_MONTHS[selectedMonth]}*\n📍 สาขา: ${globalConfig.branches?.find(b => b.id === activeBranchId)?.name || ''}\n\n`;
        txt += `*--- ฝั่งบริการ ---*\n`;
        let svcHasStaff = false;
        (branchData.duties?.service || []).forEach(duty => {
            const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
            const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
            let dutyTxt = `🔥 ${duty.jobA}\n`;
            let hasAssigned = false;
            assigned.forEach((data, idx) => {
                if (data && data.staffId) {
                    hasAssigned = true; svcHasStaff = true;
                    const staff = branchData.staff?.find(s => s.id === data.staffId);
                    const slot = slots[idx];
                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot?.shiftPresetId);
                    const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);
                    dutyTxt += `  - ${staff?.name} (${formatTimeAbbreviation(startTime)}-${formatTimeAbbreviation(endTime)})\n`;
                }
            });
            if (hasAssigned) txt += dutyTxt;
        });
        if (!svcHasStaff) txt += `(ยังไม่ได้จัดกะ)\n`;

        txt += `\n*--- ฝั่งครัว ---*\n`;
        let kitHasStaff = false;
        (branchData.duties?.kitchen || []).forEach(duty => {
            const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
            const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
            let dutyTxt = `🔪 ${duty.jobA}\n`;
            let hasAssigned = false;
            assigned.forEach((data, idx) => {
                if (data && data.staffId) {
                    hasAssigned = true; kitHasStaff = true;
                    const staff = branchData.staff?.find(s => s.id === data.staffId);
                    const slot = slots[idx];
                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot?.shiftPresetId);
                    const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);
                    dutyTxt += `  - ${staff?.name} (${formatTimeAbbreviation(startTime)}-${formatTimeAbbreviation(endTime)})\n`;
                }
            });
            if (hasAssigned) txt += dutyTxt;
        });
        if (!kitHasStaff) txt += `(ยังไม่ได้จัดกะ)\n`;

        const leaves = schedule[selectedDateStr]?.leaves || [];
        if (leaves.length > 0) {
            txt += `\n✈️ *ลาหยุด / พาร์ทไทม์:*\n`;
            leaves.forEach(l => {
                if (l.staffId) {
                    const staff = branchData.staff?.find(s => s.id === l.staffId);
                    const lType = LEAVE_TYPES.find(t => t.id === l.type);
                    if (staff) txt += `  - ${staff.name} (${lType?.shortLabel})\n`;
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
        if (isDateHoliday(dateStr, branchData.holidays)) {
            setConfirmModal({ message: 'ระบบไม่อนุญาตให้ลาหยุดในวันหยุดประจำสาขาได้' });
            return;
        }
        const newReq = { id: 'R' + Date.now(), reqType: 'LEAVE', staffId: staffFilterPos, dateStr: dateStr, type: leaveTypeId, status: 'PENDING_MANAGER', timestamp: Date.now() };
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
            id: 'R' + Date.now(), reqType: 'SWAP', staffId: me.id, targetStaffId: peer.id,
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

    const handleSubmitForecastRequest = async (dateStr, fTc, diffMh, dept, mode = ptRequestMode) => {
        const newReq = {
            id: 'R' + Date.now(),
            reqType: 'EXTRA_PT',
            staffId: 'MANAGER',
            dateStr: dateStr,
            forecastTc: mode === 'OVER_BUDGET' ? 0 : fTc,
            requestedHours: diffMh,
            reason: forecastReason.trim(),
            evidence: mode === 'OVER_BUDGET' ? '' : forecastEvidence.trim(),
            status: 'PENDING_MANAGER',
            timestamp: Date.now(),
            dept: dept || activeDept,
            mode: mode
        };
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId);
        try {
            const snap = await getDoc(docRef);
            const currentList = snap.exists() ? (snap.data().list || []) : [];
            await setDoc(docRef, { list: [...currentList, newReq] });
            setShowForecastModal(false);
            const confirmMsg = mode === 'OVER_BUDGET'
                ? 'ส่งคำขออนุมัติชั่วโมงเกินโควตาเรียบร้อยแล้ว รอการตรวจสอบจาก Area Manager'
                : 'ส่งคำขออนุมัติชั่วโมงพิเศษ (Event) เรียบร้อยแล้ว รอการตรวจสอบจาก Coach';
            setConfirmModal({ message: confirmMsg });
        } catch (e) {
            setConfirmModal({ message: 'เกิดข้อผิดพลาดในการส่งคำขอ' });
        }
    };

    const handleSubmitExtraOtRequest = async (dateStr, dutyId, slotIdx, staffId, baseOt, requestedOt, reason) => {
        const newReq = {
            id: 'R' + Date.now(),
            reqType: 'EXTRA_OT',
            staffId: staffId,
            dateStr: dateStr,
            dutyId: dutyId,
            slotIdx: slotIdx,
            baseOt: baseOt,
            requestedOt: requestedOt,
            reason: reason,
            status: 'PENDING_MANAGER',
            timestamp: Date.now()
        };
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId);
        try {
            const snap = await getDoc(docRef);
            const currentList = snap.exists() ? (snap.data().list || []) : [];
            await setDoc(docRef, { list: [...currentList, newReq] });
            setConfirmModal({ message: 'ส่งคำขออนุมัติ OT ส่วนเกิน เรียบร้อยแล้ว รอการตรวจสอบจาก Coach' });
        } catch (e) {
            setConfirmModal({ message: 'เกิดข้อผิดพลาดในการส่งคำขอ' });
        }
    };

    const handleOtBlur = (dateStr, dutyId, idx, val, maxOtHours, staffId) => {
        const parsed = parseFloat(val) || 0;
        setSchedule(prev => {
            const newSched = JSON.parse(JSON.stringify(prev));
            if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
            if (!newSched[dateStr].duties) newSched[dateStr].duties = {};
            if (!newSched[dateStr].duties[dutyId]) newSched[dateStr].duties[dutyId] = [];
            if (!newSched[dateStr].duties[dutyId][idx]) newSched[dateStr].duties[dutyId][idx] = { staffId: "", otHours: 0 };

            if (parsed > maxOtHours && authRole === 'branch' && staffId) {
                newSched[dateStr].duties[dutyId][idx].otHours = maxOtHours;
            } else {
                newSched[dateStr].duties[dutyId][idx].otHours = parsed;
            }
            newSched[dateStr].duties[dutyId][idx].otUpdated = true; if (activeBranchId) autoSaveSchedule(newSched, false, dateStr);
            return newSched;
        });

        if (parsed > maxOtHours && authRole === 'branch' && staffId) {
            setShowExtraOtModal({ dateStr, dutyId, slotIdx: idx, staffId, baseOt: maxOtHours, requestedOt: parsed });
        }
    };

    const handlePeerAcceptSwap = async (reqId) => {
        const newList = pendingRequests.map(r => r.id === reqId ? { ...r, status: 'PENDING_MANAGER' } : r);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
    };

    const handleManagerApproveRequest = async (req) => {
        let newSchedToSave = null;
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
                            slots.forEach(slot => { if (slot && slot.staffId === oldId) slot.staffId = newId; });
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
                                    if (slot && slot.staffId === id1) slot.staffId = "TEMP_SWAP";
                                    else if (slot && slot.staffId === id2) slot.staffId = id1;
                                });
                                slots.forEach(slot => { if (slot && slot.staffId === "TEMP_SWAP") slot.staffId = id2; });
                            });
                        }
                        if (newSched[d1].leaves) {
                            const l1 = newSched[d1].leaves.find(x => x.staffId === id1);
                            const l2 = newSched[d1].leaves.find(x => x.staffId === id2);
                            if (l1) l1.staffId = "TEMP_SWAP";
                            if (l2) l2.staffId = id1;
                            const tempL = newSched[d1].leaves.find(x => x.staffId === "TEMP_SWAP");
                            if (tempL) tempL.staffId = id2;
                        }
                    }
                } else {
                    swapStaffInDay(d1, id1, id2);
                    swapStaffInDay(d2, id2, id1);
                }
            }
            else if (req.reqType === 'EXTRA_PT') {
                if (!newSched[req.dateStr]) newSched[req.dateStr] = { duties: {}, leaves: [] };
                const dept = req.dept || 'service';
                if (dept === 'kitchen') {
                    newSched[req.dateStr].eventExtraHoursKitchen = (newSched[req.dateStr].eventExtraHoursKitchen || 0) + req.requestedHours;
                } else {
                    newSched[req.dateStr].eventExtraHoursService = (newSched[req.dateStr].eventExtraHoursService || 0) + req.requestedHours;
                }
                newSched[req.dateStr].eventExtraHours = (newSched[req.dateStr].eventExtraHours || 0) + req.requestedHours;
            }
            else if (req.reqType === 'EXTRA_OT') {
                if (!newSched[req.dateStr]) newSched[req.dateStr] = { duties: {}, leaves: [] };
                if (!newSched[req.dateStr].duties) newSched[req.dateStr].duties = {};
                if (!newSched[req.dateStr].duties[req.dutyId]) newSched[req.dateStr].duties[req.dutyId] = [];
                if (!newSched[req.dateStr].duties[req.dutyId][req.slotIdx]) {
                    newSched[req.dateStr].duties[req.dutyId][req.slotIdx] = { staffId: req.staffId, otHours: req.requestedOt, otUpdated: true };
                } else {
                    newSched[req.dateStr].duties[req.dutyId][req.slotIdx].otHours = req.requestedOt;
                    newSched[req.dateStr].duties[req.dutyId][req.slotIdx].otUpdated = true;
                }
            }
            newSchedToSave = newSched;
            return newSched;
        }); setTimeout(() => {
            if (activeBranchId && newSchedToSave) {
                autoSaveSchedule(newSchedToSave, true);
            }
        }, 0);

        const newList = pendingRequests.map(r => r.id === req.id ? { ...r, status: 'APPROVED', updatedTimestamp: Date.now() } : r);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
    };

    const handleRejectRequest = async (reqId, reason = '') => {
        const req = pendingRequests.find(r => r.id === reqId);
        let newSchedToSave = null;
        if (req) {
            if (req.reqType === 'EXTRA_PT') {
                setSchedule(prev => {
                    const newSched = JSON.parse(JSON.stringify(prev));
                    const dateStr = req.dateStr;
                    const dept = req.dept || 'service';
                    if (newSched[dateStr] && newSched[dateStr].duties) {
                        Object.keys(newSched[dateStr].duties).forEach(dutyId => {
                            const slots = newSched[dateStr].duties[dutyId];
                            if (Array.isArray(slots)) {
                                slots.forEach(slot => {
                                    if (slot && slot.staffId) {
                                        const staff = branchData.staff?.find(s => s.id === slot.staffId);
                                        if (staff && staff.pos.includes('PT') && (staff.dept || 'service') === dept) {
                                            slot.staffId = "";
                                        }
                                    }
                                });
                            }
                        });
                    }
                    newSchedToSave = newSched;
                    return newSched;
                });
                setTimeout(() => {
                    if (activeBranchId && newSchedToSave) {
                        autoSaveSchedule(newSchedToSave, true, req.dateStr);
                    }
                }, 0);
            } else if (req.reqType === 'EXTRA_OT') {
                setSchedule(prev => {
                    const newSched = JSON.parse(JSON.stringify(prev));
                    const dateStr = req.dateStr;
                    const dutyId = req.dutyId;
                    const slotIdx = req.slotIdx;
                    if (newSched[dateStr] && newSched[dateStr].duties && newSched[dateStr].duties[dutyId] && newSched[dateStr].duties[dutyId][slotIdx]) {
                        newSched[dateStr].duties[dutyId][slotIdx].staffId = "";
                        newSched[dateStr].duties[dutyId][slotIdx].otHours = 0;
                        newSched[dateStr].duties[dutyId][slotIdx].otUpdated = true;
                    }
                    newSchedToSave = newSched;
                    return newSched;
                });
                setTimeout(() => {
                    if (activeBranchId && newSchedToSave) {
                        autoSaveSchedule(newSchedToSave, true, req.dateStr);
                    }
                }, 0);
            }
        }

        const newList = pendingRequests.map(r => r.id === reqId ? { ...r, status: 'REJECTED', rejectReason: reason, updatedTimestamp: Date.now() } : r);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
    };

    const handleExportExcel = () => {
        const headers = ['วันที่', 'รหัสพนักงาน', 'ชื่อพนักงาน', 'แผนก', 'ตำแหน่ง', 'เวลาเข้า', 'เวลาออก', 'OT (ชั่วโมง)', 'เรท OT (เท่า)'];
        const rows = [];
        Object.keys(schedule).sort().forEach(dateStr => {
            if (reportFilterMode === 'month') {
                const [yStr, mStr] = dateStr.split('-');
                if (parseInt(mStr, 10) - 1 !== reportFilterMonth || parseInt(yStr, 10) !== selectedYear) return;
            } else {
                if (dateStr < reportFilterStart || dateStr > reportFilterEnd) return;
            }

            const dayData = schedule[dateStr];
            const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);
            const isPublicHoliday = (branchData.holidays || []).some(h => typeof h === 'object' && h.date === dateStr && h.isPublic);

            if (dayData.duties) {
                Object.keys(dayData.duties).forEach(dutyId => {
                    const assignedSlots = dayData.duties[dutyId] || [];
                    const matrixSlots = branchData.matrix?.[dayType]?.duties?.[dutyId] || [];
                    assignedSlots.forEach((assigned, idx) => {
                        if (assigned && assigned.staffId) {
                            const staff = branchData.staff?.find(s => s.id === assigned.staffId);
                            const mSlot = matrixSlots[idx];
                            const shiftPreset = branchData.shiftPresets?.find(p => p.id === mSlot?.shiftPresetId);
                            if (staff && shiftPreset) {
                                const { startTime, endTime } = getShiftTimesForStaff(staff.pos, shiftPreset);

                                let effectiveOtMultiplier = 1.0;
                                if (staff.wageType === 'MONTHLY') {
                                    effectiveOtMultiplier = isPublicHoliday ? (branchData.payrollConfig?.otRateHolidayMonthly || 3.0) : (branchData.payrollConfig?.otRateMonthly || 1.5);
                                } else {
                                    const isPt = staff.wageType === 'PT';
                                    const holidayMultiplier = isPt ? (branchData.payrollConfig?.holidayMultiplierPt || 2.0) : (branchData.payrollConfig?.holidayMultiplierFtHourly || 2.0);
                                    const baseOtMultiplier = isPt ? (branchData.payrollConfig?.otRatePt || 1.5) : (branchData.payrollConfig?.otRateFtHourly || 1.5);
                                    effectiveOtMultiplier = isPublicHoliday ? (baseOtMultiplier * holidayMultiplier) : baseOtMultiplier;
                                }

                                rows.push([dateStr, staff.empId || '-', staff.name, staff.dept, staff.pos, startTime, endTime, assigned.otHours || 0, effectiveOtMultiplier]);
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
        link.setAttribute('download', `StaffSync_Export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleExportMonthlyRoster = () => {
        const exportDays = managerViewMode === 'weekly' ? WEEKLY_DAYS : CALENDAR_DAYS;
        const headers = ['แผนก', 'ตำแหน่ง', 'ชื่อพนักงาน', ...exportDays.map(d => `${d.dayNum} ${d.dayLabel}`)];
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
                exportDays.forEach(day => {
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

    const requestAutoAssign = (mode = 'daily') => {
        const lastTime = branchData.lastAutoAssign ? new Date(branchData.lastAutoAssign).toLocaleString('th-TH') : 'ยังไม่เคยใช้งาน';
        const modeText = mode === 'daily' ? 'วันนี้' : mode === 'weekly' ? 'ทั้งสัปดาห์นี้' : 'ทั้งเดือนนี้';
        setConfirmModal({
            message: `ใช้งานจัดกะอัตโนมัติครั้งล่าสุดเมื่อ: ${lastTime}\n\nระบบจะทำการจัดกะอัตโนมัติสำหรับ${modeText} ข้อมูลกะเดิมจะถูกล้างและเขียนทับใหม่ทั้งหมด (ไม่กระทบกับวันหยุดและวันลาที่บันทึกไว้)\n\nคุณยืนยันที่จะทำรายการนี้หรือไม่?`,
            action: () => handleAutoAssign(mode)
        });
    };

    const handleAutoAssign = (mode = 'daily') => {
        saveScheduleVersion(`AUTO_ASSIGN_${mode.toUpperCase()}`, scheduleRef.current);
        setAiLoading(true);

        // อัปเดตเวลาใช้งานล่าสุด
        setBranchData(prev => {
            const nd = { ...prev, lastAutoAssign: Date.now() };
            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
            return nd;
        });

        setTimeout(() => {
            setSchedule(prevSched => {
                const newSched = JSON.parse(JSON.stringify(prevSched));
                const datesToProcess = mode === 'daily' ? [selectedDateStr] : mode === 'weekly' ? WEEKLY_DAYS.map(d => d.dateStr) : CALENDAR_DAYS.map(d => d.dateStr);

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
                                if (s && s.staffId) {
                                    staffOTCount[s.staffId] += (s.otHours || 0);
                                    if (!staffDutyCounts[s.staffId]) staffDutyCounts[s.staffId] = {};
                                    staffDutyCounts[s.staffId][dCat] = (staffDutyCounts[s.staffId][dCat] || 0) + 1;
                                }
                            });
                        });
                    }
                });

                datesToProcess.forEach(dateStr => {
                    const dayType = getDayType(dateStr, branchData.holidays, branchData.holidayCycles);
                    if (!newSched[dateStr]) newSched[dateStr] = { duties: {}, leaves: [] };
                    const dayData = newSched[dateStr];

                    // 1. Clear previous duty assignments for this day (เฉพาะแผนกที่เลือก) but PRESERVE fixed ones
                    if (!dayData.duties) dayData.duties = {};
                    const fixedSlotsByDuty = {}; // dutyId -> array of { idx, slot }
                    CURRENT_DUTY_LIST.forEach(d => {
                        const existingSlots = dayData.duties[d.id];
                        if (Array.isArray(existingSlots)) {
                            existingSlots.forEach((slot, idx) => {
                                if (slot && slot.isFixed && slot.staffId) {
                                    if (!fixedSlotsByDuty[d.id]) fixedSlotsByDuty[d.id] = [];
                                    fixedSlotsByDuty[d.id].push({ idx, slot });
                                }
                            });
                        }
                        delete dayData.duties[d.id];
                    });

                    // 2. Consolidate leaves, including regular days off
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    const dayOfWeek = dateObj.getDay();

                    const manuallyOnLeaveIds = new Set((dayData.leaves || []).map(l => l.staffId));
                    const isHoliday = isDateHoliday(dateStr, branchData.holidays);
                    const regularOffStaff = isHoliday ? [] : branchData.staff?.filter(s => {
                        if (!isStaffActiveOnDate(s, dateStr)) return false;
                        const daysOff = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
                        return daysOff.includes(dayOfWeek);
                    }) || [];

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

                    // Reconstruct duty slot arrays, restoring any fixed slots
                    CURRENT_DUTY_LIST.forEach(d => {
                        const matrixSlots = branchData.matrix?.[dayType]?.duties?.[d.id] || [];
                        dayData.duties[d.id] = matrixSlots.map((mSlot, idx) => {
                            const fixedInfo = fixedSlotsByDuty[d.id]?.find(f => f.idx === idx);
                            if (fixedInfo) {
                                const staffObj = branchData.staff?.find(s => s.id === fixedInfo.slot.staffId);
                                if (staffObj && isStaffActiveOnDate(staffObj, dateStr) && !onLeaveIds.has(staffObj.id)) {
                                    workingStaffIds.add(staffObj.id);
                                    return { ...fixedInfo.slot };
                                }
                            }
                            return { staffId: "", otHours: 0 };
                        });
                    });

                    // 3. Prepare all slots to assign and sort them
                    const dutyPriority = { 'HEAD': 1, 'STAFF': 2, 'SUPPORT': 3 };
                    const allSlotsToAssign = [];

                    CURRENT_DUTY_LIST.forEach(duty => {
                        const slots = branchData.matrix?.[dayType]?.duties?.[duty.id] || [];
                        slots.forEach((slot, slotIdx) => {
                            allSlotsToAssign.push({ duty, slot, slotIdx });
                        });
                    });

                    allSlotsToAssign.sort((a, b) => {
                        // Priority 0: Slots with OT first
                        const aIsOT = a.slot.targetEndTime ? true : (a.slot.maxOtHours || 0) > 0;
                        const bIsOT = b.slot.targetEndTime ? true : (b.slot.maxOtHours || 0) > 0;
                        if (aIsOT !== bIsOT) return aIsOT ? -1 : 1;

                        // Priority 1: Primary Duties first, Backup Duties last
                        const aBackup = a.duty.isBackup ? 1 : 0;
                        const bBackup = b.duty.isBackup ? 1 : 0;
                        if (aBackup !== bBackup) return aBackup - bBackup;

                        const getCat = (catStr) => (catStr || '').split('_')[1] || 'OTHER';
                        const priorityA = dutyPriority[getCat(a.duty.category)] || 99;
                        const priorityB = dutyPriority[getCat(b.duty.category)] || 99;
                        if (priorityA !== priorityB) return priorityA - priorityB;

                        const getHighestRank = (reqPosArr) => {
                            if (!reqPosArr || reqPosArr.length === 0 || reqPosArr.includes('ALL')) return 999;
                            const posList = POSITIONS[activeDept] || [];
                            const ranks = reqPosArr.map(p => posList.indexOf(p)).filter(r => r !== -1);
                            return ranks.length > 0 ? Math.min(...ranks) : 999;
                        };

                        const rankA = getHighestRank(a.duty.reqPos);
                        const rankB = getHighestRank(b.duty.reqPos);
                        return rankA - rankB;
                    });

                    // 4. Get available staff, sorted by rank (highest first)
                    const availableStaff = (branchData.staff || [])
                        .filter(s => s.dept === activeDept && !onLeaveIds.has(s.id) && isStaffActiveOnDate(s, dateStr))
                        .sort((a, b) => {
                            const posList = POSITIONS[activeDept] || [];
                            const rankA = posList.indexOf(a.pos);
                            const rankB = posList.indexOf(b.pos);
                            return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
                        });

                    // 5. Iterate through sorted slots and assign the best available staff
                    allSlotsToAssign.forEach(({ duty, slot, slotIdx }) => {
                        if (!dayData.duties[duty.id]) dayData.duties[duty.id] = [];

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
                            const isOTSlot = slot.targetEndTime ? true : (slot.maxOtHours || 0) > 0;
                            let validCandidates = potentialCandidates;

                            if (isOTSlot) {
                                // ตัด PT ออกจากกะที่มี OT อย่างเด็ดขาด
                                validCandidates = potentialCandidates.filter(p => !p.pos.includes('PT'));

                                // ให้สิทธิ์พนักงานที่ไม่ใช่ HEAD ก่อนสำหรับกะที่มี OT
                                const preferredCandidates = validCandidates.filter(p => {
                                    const layer = getStaffLayer(activeDept, p.pos);
                                    return !layer.id.includes('HEAD');
                                });
                                // หากมีคนที่เหมาะสม ให้ใช้กลุ่มนี้ แต่ถ้าไม่มี ให้ยอมใช้ HEAD แทน (แต่ PT ถูกตัดออกไปแล้ว)
                                if (preferredCandidates.length > 0) {
                                    validCandidates = preferredCandidates;
                                }
                            }

                            if (validCandidates.length > 0) {
                                // Sort candidates
                                validCandidates.sort((a, b) => {
                                    // Priority 0.5: PT is least prioritized
                                    const aIsPT = a.pos.includes('PT') ? 1 : 0;
                                    const bIsPT = b.pos.includes('PT') ? 1 : 0;
                                    if (aIsPT !== bIsPT) return aIsPT - bIsPT;

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
                                    if (rankA !== rankB) return rankA - rankB; // วิ่งจากตำแหน่งใหญ่สุดก่อนเสมอ ตามที่กำหนด

                                    // Priority 5: Random Rotation (สุ่มคนลงเมื่อเงื่อนไขทั้งหมดเท่ากัน)
                                    return Math.random() - 0.5;
                                });

                                candidate = validCandidates[0];
                            }
                        }

                        if (candidate) {
                            dayData.duties[duty.id][slotIdx].staffId = candidate.id;

                            const layer = getStaffLayer(activeDept, candidate.pos);
                            const preset = branchData.shiftPresets?.find(p => p.id === slot.shiftPresetId);
                            const { endTime } = getShiftTimesForStaff(candidate.pos, preset);

                            let assignedOT = 0;
                            if (slot.targetEndTime) {
                                assignedOT = calculateOtHours(slot.targetEndTime, endTime);
                            } else {
                                assignedOT = slot.maxOtHours || 0;
                            }

                            const giveOT = !layer.id.includes('HEAD') && assignedOT > 0;
                            assignedOT = giveOT ? assignedOT : 0;

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
                }); setAiLoading(false); if (activeBranchId) autoSaveSchedule(newSched, true, mode === 'daily' ? activeDay.dateStr : null);
                return newSched;
            });
        }, 500);
    };

    const handleUndoSchedule = () => {
        if (scheduleHistory) {
            setConfirmModal({
                message: 'ยืนยันการยกเลิก (Undo) การจัดกะครั้งล่าสุดและกลับไปใช้ข้อมูลก่อนหน้าใช่หรือไม่?',
                action: () => {
                    setSchedule(scheduleHistory);
                    if (activeBranchId) autoSaveSchedule(scheduleHistory, true);
                    setScheduleHistory(null);
                    setConfirmModal({ message: 'ยกเลิกการจัดกะและกู้คืนข้อมูลสำเร็จ!' });
                }
            });
        }
    };

    const handleClearSchedule = (mode = 'daily') => {
        // บันทึกสถานะก่อนหน้าเพื่อใช้สำหรับ Undo ในกรณีที่เผลอกดล้างข้อมูล
        setScheduleHistory(JSON.parse(JSON.stringify(scheduleRef.current)));

        let newSchedToSave = null;
        setSchedule(prevSched => {
            const newSched = JSON.parse(JSON.stringify(prevSched));
            const datesToProcess = mode === 'daily' ? [selectedDateStr] : mode === 'weekly' ? WEEKLY_DAYS.map(d => d.dateStr) : CALENDAR_DAYS.map(d => d.dateStr);
            datesToProcess.forEach(dateStr => {
                if (newSched[dateStr] && newSched[dateStr].duties) {
                    CURRENT_DUTY_LIST.forEach(d => {
                        delete newSched[dateStr].duties[d.id];
                    });
                }
            }); if (activeBranchId) autoSaveSchedule(newSched, false, mode === 'daily' ? selectedDateStr : null);
            newSchedToSave = newSched;
            return newSched;
        }); setTimeout(() => {
            if (activeBranchId && newSchedToSave) autoSaveSchedule(newSchedToSave, true, mode === 'daily' ? selectedDateStr : null);
        }, 0);
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

            if (!branchSnap.exists() && !scheduleSnap.exists()) {
                window.alert(`ไม่พบข้อมูลของสาขารหัส: ${branchId} ในฐานข้อมูล\n\nคำแนะนำ:\n1. ตรวจสอบว่าคัดลอก Branch ID มาถูกต้องหรือไม่ (ห้ามมีช่องว่าง)\n2. ลองค้นหาในแท็บ BACKUPS แทน`);
            }

            setInspectedData({
                branch: branchSnap.exists() ? branchSnap.data() : { error: 'No branch data found.' },
                schedule: scheduleSnap.exists() ? scheduleSnap.data() : { error: 'No schedule data found.' },
                loading: false,
                error: null
            });
        } catch (e) {
            setInspectedData({ branch: null, schedule: null, loading: false, error: e.message });
            window.alert(`เกิดข้อผิดพลาดในการดึงข้อมูล: ${e.message}`);
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
            for (let i = 1; i <= 31; i++) {
                promises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'backups', `${branchId}_day_${i}`)));
            }
            const snaps = await Promise.all(promises);
            const backups = snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })).sort((a, b) => b.timestamp - a.timestamp);
            setInspectorBackups(backups);
        } catch (e) {
            console.error("Error loading backups", e);
        } finally {
            setInspectedData(prev => ({ ...prev, loadingBackups: false }));
        }
    };

    const handleRestoreBackup = async (backup, mode) => {
        if (!backup || !backup.branchData || !backup.schedule) return;
        try {
            if (mode === 'all' || mode === 'branch') {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', inspectorBranchId), backup.branchData);
            }
            if (mode === 'all' || mode === 'schedule') {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', inspectorBranchId), { records: backup.schedule });
            }
            if (mode === 'all' && backup.requests) {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', inspectorBranchId), { list: backup.requests });
            }

            const isBranchInGlobal = globalConfig.branches?.some(b => b.id === inspectorBranchId);
            if (!isBranchInGlobal && (mode === 'all' || mode === 'branch')) {
                const newConfig = { ...globalConfig };
                if (!newConfig.branches) newConfig.branches = [];
                newConfig.branches.push({
                    id: inspectorBranchId,
                    name: backup.branchData?.name || `Branch ${inspectorBranchId}`,
                    user: backup.branchData?.user || inspectorBranchId,
                    pass: backup.branchData?.pass || '1234'
                });
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), newConfig);
                setGlobalConfig(newConfig);
            }

            setConfirmModal({ message: `กู้คืนข้อมูล (${mode === 'all' ? 'ทั้งหมด' : mode === 'schedule' ? 'เฉพาะกะงาน' : 'เฉพาะข้อมูลสาขา'}) ของวันที่ ${backup.backupDate} สำเร็จแล้ว!` });
            handleInspectBranch(inspectorBranchId);
        } catch (e) { setConfirmModal({ message: `การกู้คืนล้มเหลว: ${e.message}` }); }
    };

    const handleGlobalRestore = async (dateStr) => {
        if (!dateStr) return;
        const confirmed = window.confirm(`คำเตือน: การกู้คืนข้อมูลทั้งหมดของวันที่ ${dateStr}\n\nระบบจะทำการค้นหาข้อมูล Backup ของ "ทุกสาขา" ในวันดังกล่าว และนำกลับมาทับข้อมูลปัจจุบัน รวมถึงกู้รายชื่อสาขากลับคืนให้อัตโนมัติ\n\nคุณแน่ใจหรือไม่?`);
        if (!confirmed) return;

        try {
            const backupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'backups');
            const q = query(backupsRef, where('backupDate', '==', dateStr));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setConfirmModal({ message: `ไม่พบข้อมูล Backup ของสาขาใดๆ ในวันที่ ${dateStr} เลยครับ` });
                return;
            }

            const newBranches = [];
            let restoreCount = 0;

            for (const documentSnapshot of querySnapshot.docs) {
                const data = documentSnapshot.data();
                if (documentSnapshot.id.startsWith('GLOBAL_day_')) {
                    if (data.masterConfig) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), data.masterConfig);
                    if (data.templates) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), { list: data.templates });
                    continue;
                }
                if (data.branchData) {
                    const bId = documentSnapshot.id.split('_day_')[0];
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', bId), data.branchData);
                    if (data.schedule) {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', bId), { records: data.schedule });
                    }
                    if (data.requests) {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', bId), { list: data.requests });
                    }

                    newBranches.push({ id: bId, name: data.branchData.name || `Branch ${bId}`, user: data.branchData.user || bId, pass: data.branchData.pass || '1234' });
                    restoreCount++;
                }
            }

            if (newBranches.length > 0) {
                const newConfig = { ...globalConfig };
                const existingMap = new Map((newConfig.branches || []).map(b => [b.id, b]));
                newBranches.forEach(b => existingMap.set(b.id, b));
                newConfig.branches = Array.from(existingMap.values());

                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), newConfig);
                setGlobalConfig(newConfig);
            }

            setConfirmModal({ message: `✅ กู้คืนข้อมูลสำเร็จทั้งหมด ${restoreCount} สาขา!\nรายชื่อสาขาได้ถูกเพิ่มกลับเข้าสู่ระบบ และนำข้อมูลพนักงาน/กะงานกลับมาเรียบร้อยแล้ว` });
        } catch (e) {
            setConfirmModal({ message: `เกิดข้อผิดพลาดในการดึงข้อมูลทั้งหมด: ${e.message}` });
        }
    };

    const handleMasterConfigRestore = async (dateStr) => {
        if (!dateStr) return;
        const confirmed = window.confirm(`คำเตือน: การกู้คืนเฉพาะ "ข้อมูลส่วนกลาง (Master Config & Templates)" ของวันที่ ${dateStr}\n\nระบบจะเขียนทับข้อมูลส่วนกลางด้วยข้อมูล Backup ของวันที่เลือก โดยไม่กระทบข้อมูลสาขา\n\nคุณแน่ใจหรือไม่?`);
        if (!confirmed) return;

        try {
            const backupsRef = collection(db, 'artifacts', appId, 'public', 'data', 'backups');
            const q = query(backupsRef, where('backupDate', '==', dateStr));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setConfirmModal({ message: `ไม่พบข้อมูล Backup ของวันที่ ${dateStr} เลยครับ` });
                return;
            }

            let restored = false;
            for (const documentSnapshot of querySnapshot.docs) {
                const data = documentSnapshot.data();
                // ค้นหาเฉพาะ Backup ส่วนกลาง
                if (documentSnapshot.id.startsWith('GLOBAL_day_')) {
                    if (data.masterConfig) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), data.masterConfig);
                    if (data.templates) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'templates'), { list: data.templates });
                    restored = true;
                    break;
                }
            }

            if (restored) {
                setConfirmModal({ message: `✅ กู้คืนข้อมูลส่วนกลางสำเร็จ!\nระบบได้นำข้อมูล Master Config และ Templates กลับมาเรียบร้อยแล้ว` });
            } else {
                setConfirmModal({ message: `ไม่พบข้อมูล Backup ส่วนกลาง (GLOBAL) ในวันที่ ${dateStr}` });
            }
        } catch (e) {
            setConfirmModal({ message: `เกิดข้อผิดพลาดในการดึงข้อมูลส่วนกลาง: ${e.message}` });
        }
    };

    const scrollDates = (dir) => {
        if (dateBarRef.current) {
            const amt = dir === 'left' ? -350 : 350;
            dateBarRef.current.scrollBy({ left: amt, behavior: 'smooth' });
        }
    };

    // === RENDER DECLARATION HELPER COMPONENTS ===

    function renderDataInspectorModal() {
        const activeTabs = inspectorBranchId === 'GLOBAL' ? ['guides', 'templates', 'global_restore', 'raw_global'] : ['staff', 'duties', 'holidays', 'announcements', 'schedule', 'backups', 'raw'];

        return (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300 font-sans">
                <div className="bg-slate-800 text-white rounded-2xl p-6 max-w-6xl w-full shadow-2xl flex flex-col gap-4 max-h-[90vh]">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                        <h3 className="text-xl font-black uppercase tracking-wider">Server Data Inspector</h3>
                        <button onClick={() => setShowDataInspector(false)} className="text-slate-400 hover:bg-slate-700 p-2 rounded-full transition"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="flex gap-4 items-center flex-wrap">
                        <select value={globalConfig.branches?.some(b => b.id === inspectorBranchId) || inspectorBranchId === 'GLOBAL' ? inspectorBranchId : ''} onChange={(e) => handleInspectBranch(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm font-bold outline-none flex-1 min-w-[200px]">
                            <option value="">-- Select a Branch to Inspect --</option>
                            <option value="GLOBAL">🌐 GLOBAL DATA (Guides, Configs, Templates)</option>
                            {globalConfig.branches?.map(b => <option key={b.id} value={b.id}>🏠 {b.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <input type="text" value={manualBranchId} onChange={e => setManualBranchId(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && manualBranchId.trim()) handleInspectBranch(manualBranchId.trim()); }} placeholder="ระบุ Branch ID (เช่น b170...)" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm font-bold outline-none text-white placeholder-slate-400 w-48" />
                            <button onClick={() => { if (manualBranchId.trim()) handleInspectBranch(manualBranchId.trim()); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-black hover:bg-indigo-500 transition shadow-sm">ค้นหาข้อมูล</button>
                        </div>
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
                            <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
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
                                                    <td className="p-3 border-b border-slate-700/50 text-center font-bold text-slate-300">S: {t.duties?.service?.length || 0} / K: {t.duties?.kitchen?.length || 0}</td>
                                                    <td className="p-3 border-b border-slate-700/50 text-center font-bold text-slate-300">{t.shiftPresets?.length || 0}</td>
                                                </tr>
                                            )) : <tr><td colSpan="4" className="p-4 text-center text-slate-500">No templates found</td></tr>}
                                        </tbody>
                                    </table>
                                )}
                                {inspectorTab === 'global_restore' && (
                                    <div className="flex flex-col gap-6 p-6 items-center justify-center text-center h-full max-w-2xl mx-auto mt-10">
                                        <div className="bg-red-500/20 p-6 rounded-full text-red-400">
                                            <AlertCircle className="w-16 h-16" />
                                        </div>
                                        <h3 className="text-2xl font-black text-white uppercase tracking-wider">กู้คืนข้อมูลทุกสาขา (Global Restore)</h3>
                                        <p className="text-slate-400 text-sm font-bold leading-relaxed">
                                            ฟังก์ชันนี้จะทำการดึงข้อมูล Backup ของ "ทุกสาขา" ตามวันที่เลือก<br />
                                            แล้วนำกลับมาเขียนทับข้อมูลปัจจุบัน และสร้างรายชื่อสาขากลับเข้าหน้า Login ทันที
                                        </p>
                                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full flex flex-col gap-4 mt-4 shadow-xl">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">เลือกวันที่ต้องการกู้คืน (Backup Date)</label>
                                                <input type="date" id="global_restore_date" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-base font-bold text-white outline-none focus:border-indigo-500 text-center" defaultValue={new Date().toISOString().split('T')[0]} />
                                            </div>
                                            <button onClick={() => {
                                                const d = document.getElementById('global_restore_date').value;
                                                if (d) handleGlobalRestore(d);
                                            }} className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg mt-2 text-sm">
                                                🚨 กู้คืนข้อมูลทุกสาขาทันที
                                            </button>
                                            <button onClick={() => {
                                                const d = document.getElementById('global_restore_date').value;
                                                if (d) handleMasterConfigRestore(d);
                                            }} className="w-full bg-amber-600 hover:bg-amber-500 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg mt-2 text-sm">
                                                ⚙️ กู้คืนเฉพาะข้อมูลส่วนกลาง (Master Config &amp; Templates)
                                            </button>
                                        </div>
                                    </div>
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
                                                    <td className="p-3 border-b border-slate-700/50">{
                                                        (() => {
                                                            const dOffs = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
                                                            return dOffs.length > 0 ? dOffs.map(d => ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][d]).join(', ') : '-';
                                                        })()
                                                    }</td>
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
                                                    <td className="p-3 border-b border-slate-700/50 text-slate-400 text-[9px]">{a.startDate || 'Any'} <br /> {a.endDate || 'Any'}</td>
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
                                                <div className="flex justify-center items-center h-32 text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
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
                                                                <td className="p-3 border-b border-slate-700/50 text-slate-500 font-bold">{Object.keys(b.schedule || {}).length} Schedule Days, {b.branchData?.staff?.length || 0} Staff, {b.requests?.length || 0} Requests</td>
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
                                            {Object.keys(inspectedData.schedule?.records || {}).length ? Object.entries(inspectedData.schedule.records).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => {
                                                const assignedCount = Object.values(data.duties || {}).flat().filter(s => s && s.staffId).length;
                                                const leaveCount = data.leaves?.length || 0;
                                                return (
                                                    <tr key={date} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-3 border-b border-slate-700/50 font-black text-sky-300">{date}</td>
                                                        <td className="p-3 border-b border-slate-700/50 text-center"><span className="bg-slate-700 px-3 py-1 rounded-full font-bold">{assignedCount}</span></td>
                                                        <td className="p-3 border-b border-slate-700/50 text-center"><span className={`px-3 py-1 rounded-full font-bold ${leaveCount > 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-700 text-slate-300'}`}>{leaveCount}</span></td>
                                                    </tr>
                                                )
                                            }) : <tr><td colSpan="3" className="p-4 text-center text-slate-500">No schedule records found</td></tr>}
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
                        <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/50 hover:text-white transition bg-white/10 hover:bg-white/20 p-2 sm:p-3 rounded-full"><X className="w-6 h-6 sm:w-8 sm:h-8" /></button>
                        <img src={zoomedImage} alt="Zoomed View" className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 cursor-default" onClick={(e) => e.stopPropagation()} />
                    </div>
                )}
                {showSuccessModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
                        <div className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
                            <div className="bg-green-500 p-4 rounded-full shadow-xl shadow-green-200 animate-bounce"><CheckCircle2 className="w-12 h-12 text-white" /></div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-2">Saved Successfully</h3>
                        </div>
                    </div>
                )}
                {confirmModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 font-sans p-4">
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
                                    <div className="bg-orange-100 p-3 rounded-full"><Bell className="w-6 h-6 text-orange-500" /></div>
                                    <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">การอนุมัติคำขอ</h3><p className="text-[10px] sm:text-xs font-bold text-slate-400">รายการลาหยุด, OT และใบงาน</p></div>
                                </div>
                                <button onClick={() => setShowRequestsModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-6 h-6" /></button>
                            </div>

                            <div className="flex gap-2 border-b border-slate-100 pb-2 flex-shrink-0">
                                <button onClick={() => setRequestTab('pending')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition ${requestTab === 'pending' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>รออนุมัติ</button>
                                <button onClick={() => setRequestTab('history')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition ${requestTab === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>ประวัติใบงาน</button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                {requestTab === 'pending' ? (
                                    pendingRequests.filter(r => r.status === 'PENDING_MANAGER').length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-100">ไม่มีคำขอที่รอการอนุมัติ 🎉</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {pendingRequests.filter(r => r.status === 'PENDING_MANAGER').map(req => {
                                                const staff = branchData.staff?.find(s => s.id === req.staffId);
                                                const isSwap = req.reqType === 'SWAP';
                                                let detailHtml = null;
                                                if (isSwap) {
                                                    const targetStaff = branchData.staff?.find(s => s.id === req.targetStaffId);
                                                    detailHtml = (
                                                        <div className="mt-2 text-xs font-bold text-slate-600 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                                            ขอสลับกะกับ <span className="text-indigo-700">{targetStaff?.name || 'Unknown'}</span> <br />
                                                            วันที่ <span className="text-indigo-700">{req.dateMy}</span> <ArrowLeftRight className="w-3 h-3 inline mx-1" /> วันที่ <span className="text-indigo-700">{req.datePeer}</span>
                                                        </div>
                                                    );
                                                } else if (req.reqType === 'EXTRA_OT') {
                                                    detailHtml = (
                                                        <div className="mt-2 text-xs font-bold text-slate-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
                                                            ขออนุมัติ OT เกินโควตา: <span className="text-rose-700 font-black">{req.requestedOt} ชม.</span> (จากเดิม {req.baseOt} ชม.) <br />
                                                            ประจำวันที่: <span className="text-rose-700">{req.dateStr}</span> <br />
                                                            เหตุผล: <span className="text-rose-700">{req.reason || '-'}</span>
                                                        </div>
                                                    );
                                                } else if (req.reqType === 'EXTRA_PT') {
                                                    const isOverBudget = req.mode === 'OVER_BUDGET' || (!req.forecastTc && !req.evidence);
                                                    detailHtml = (
                                                        <div className="mt-2 text-xs font-bold text-slate-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                                            {isOverBudget ? 'ขออนุมัติชั่วโมงเกินโควตา:' : 'ขอโควตาพิเศษ (Event):'} <span className="text-emerald-700 font-black">+{req.requestedHours.toFixed(1)} ชม.</span> <br />
                                                            แผนก: <span className="text-indigo-700 font-black">{(req.dept === 'kitchen' ? 'ครัว (BOH)' : 'บริการ (FOH)')}</span> <br />
                                                            ประจำวันที่: <span className="text-emerald-700">{req.dateStr}</span> <br />
                                                            เหตุผล: <span className="text-emerald-700">{req.reason}</span> <br />
                                                            {!isOverBudget && (
                                                                <>
                                                                    หลักฐาน: <span className="text-emerald-700">{req.evidence || '-'}</span> <br />
                                                                    <span className="text-[10px] text-slate-400 font-normal">(อ้างอิง Forecast: {req.forecastTc} บิล)</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                } else {
                                                    const lType = LEAVE_TYPES.find(t => t.id === req.type);
                                                    const dateObj = new Date(req.dateStr);
                                                    detailHtml = (
                                                        <React.Fragment>
                                                            <p className="text-xs font-bold text-slate-500 mt-1">ขอหยุดวันที่: <span className="text-indigo-600">{dateObj.toLocaleDateString('th-TH', { dateStyle: 'medium' })}</span></p>
                                                            <p className="text-xs font-bold text-slate-500">ประเภท: <span className={`px-1.5 rounded ${lType?.color}`}>{lType?.label}</span></p>
                                                        </React.Fragment>
                                                    );
                                                }
                                                return (
                                                    <div key={req.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                                                        <div>
                                                            <h4 className="font-black text-slate-800">{staff?.name || (['EXTRA_PT', 'EXTRA_OT'].includes(req.reqType) && !staff ? 'ผู้จัดการสาขา (Manager)' : 'Unknown Staff')} {staff && <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border ml-2">{staff.pos}</span>}</h4>
                                                            {detailHtml}
                                                        </div>
                                                        {['EXTRA_PT', 'EXTRA_OT'].includes(req.reqType) && authRole === 'branch' ? (
                                                            <div className="flex gap-2 w-full sm:w-auto">
                                                                <span className="flex-1 sm:flex-none text-xs font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 flex items-center justify-center whitespace-nowrap">รอ AM อนุมัติ</span>
                                                                <button onClick={() => handleRejectRequest(req.id, 'Manager Cancelled')} className="flex-1 sm:flex-none bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-500 hover:text-white transition border border-red-200">ยกเลิก</button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2 w-full sm:w-auto">
                                                                <button onClick={() => handleManagerApproveRequest(req)} className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-500 hover:text-white transition shadow-sm border border-emerald-200">อนุมัติ</button>
                                                                <button onClick={() => handleRejectRequest(req.id)} className="flex-1 sm:flex-none bg-slate-50 text-slate-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-500 hover:text-white transition border border-slate-200">ปฏิเสธ</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    (() => {
                                        let historyList = pendingRequests.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED');

                                        if (reqHistoryFilterType !== 'ALL') {
                                            historyList = historyList.filter(r => r.reqType === reqHistoryFilterType || (reqHistoryFilterType === 'LEAVE' && !['SWAP', 'EXTRA_OT', 'EXTRA_PT'].includes(r.reqType)));
                                        }
                                        if (reqHistoryFilterMonth !== 'ALL') {
                                            historyList = historyList.filter(r => {
                                                if (!r.dateStr) return false;
                                                const m = parseInt(r.dateStr.split('-')[1], 10) - 1;
                                                return m === parseInt(reqHistoryFilterMonth, 10);
                                            });
                                        }
                                        if (reqHistoryFilterDate !== '') {
                                            historyList = historyList.filter(r => r.dateStr === reqHistoryFilterDate);
                                        }

                                        historyList = historyList.sort((a, b) => (b.updatedTimestamp || 0) - (a.updatedTimestamp || 0));

                                        return (
                                            <div className="flex flex-col gap-3 h-full">
                                                <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 flex-shrink-0">
                                                    <select value={reqHistoryFilterType} onChange={e => setReqHistoryFilterType(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-white text-slate-700 font-bold">
                                                        <option value="ALL">ทุกประเภท</option>
                                                        <option value="LEAVE">ลาหยุด</option>
                                                        <option value="SWAP">สลับกะ</option>
                                                        <option value="EXTRA_PT">โควตาพิเศษ (Event)</option>
                                                        <option value="EXTRA_OT">OT ส่วนเกิน</option>
                                                    </select>
                                                    <select value={reqHistoryFilterMonth} onChange={e => setReqHistoryFilterMonth(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-white text-slate-700 font-bold">
                                                        <option value="ALL">ทุกเดือน</option>
                                                        {THAI_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                                    </select>
                                                    <input type="date" value={reqHistoryFilterDate} onChange={e => setReqHistoryFilterDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-white text-slate-700 font-bold w-full sm:w-auto" />
                                                    {(reqHistoryFilterType !== 'ALL' || reqHistoryFilterMonth !== 'ALL' || reqHistoryFilterDate !== '') && (
                                                        <button onClick={() => { setReqHistoryFilterType('ALL'); setReqHistoryFilterMonth('ALL'); setReqHistoryFilterDate(''); }} className="text-[10px] text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition font-black ml-auto border border-transparent hover:border-rose-100">ล้างตัวกรอง</button>
                                                    )}
                                                </div>

                                                {historyList.length === 0 ? (
                                                    <div className="text-center py-10 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-100">ไม่พบประวัติใบงานที่ตรงกับตัวกรอง</div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {historyList.map(req => {
                                                            const staff = branchData.staff?.find(s => s.id === req.staffId);
                                                            const isSwap = req.reqType === 'SWAP';
                                                            let detailHtml = null;
                                                            if (isSwap) {
                                                                const targetStaff = branchData.staff?.find(s => s.id === req.targetStaffId);
                                                                detailHtml = (
                                                                    <div className="mt-1 text-xs font-bold text-slate-500">
                                                                        สลับกะกับ <span className="text-indigo-600">{targetStaff?.name || 'Unknown'}</span> ({req.dateMy} <ArrowLeftRight className="w-3 h-3 inline mx-1" /> {req.datePeer})
                                                                    </div>
                                                                );
                                                            } else if (req.reqType === 'EXTRA_OT') {
                                                                detailHtml = (
                                                                    <div className="mt-1 text-xs font-bold text-slate-500">
                                                                        ขอ OT เกินโควตา: <span className="text-rose-600 font-black">{req.requestedOt} ชม.</span> (วันที่: {req.dateStr})
                                                                    </div>
                                                                );
                                                            } else if (req.reqType === 'EXTRA_PT') {
                                                                detailHtml = (
                                                                    <div className="mt-1 text-xs font-bold text-slate-500">
                                                                        {(req.mode === 'OVER_BUDGET' || (!req.forecastTc && !req.evidence)) ? 'ขออนุมัติชั่วโมงเกินโควตา:' : 'โควตาพิเศษ (Event):'} <span className="text-emerald-600 font-black">+{req.requestedHours.toFixed(1)} ชม.</span> (วันที่: {req.dateStr})
                                                                    </div>
                                                                );
                                                            } else {
                                                                const lType = LEAVE_TYPES.find(t => t.id === req.type);
                                                                detailHtml = (
                                                                    <div className="mt-1 text-xs font-bold text-slate-500">
                                                                        ขอหยุดวันที่: <span className="text-indigo-600">{req.dateStr}</span> ประเภท: {lType?.label}
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div key={req.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center gap-4">
                                                                    <div>
                                                                        <h4 className="font-black text-slate-700">{staff?.name || (['EXTRA_PT', 'EXTRA_OT'].includes(req.reqType) && !staff ? 'ผู้จัดการสาขา' : 'Unknown Staff')}</h4>
                                                                        {detailHtml}
                                                                        <p className="text-[9px] text-slate-400 mt-1">{new Date(req.updatedTimestamp || req.timestamp).toLocaleString('th-TH')}</p>
                                                                    </div>
                                                                    <div>
                                                                        {req.status === 'APPROVED' ? (
                                                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">อนุมัติแล้ว</span>
                                                                        ) : (
                                                                            <span className="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">ไม่อนุมัติ</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
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
                {showExtraOtModal && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><Clock className="w-6 h-6 text-rose-500" /> ขออนุมัติ OT เกินโควตา</h3>
                                <button onClick={() => { setShowExtraOtModal(null); setExtraOtReason(''); }} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs sm:text-sm text-slate-600 font-bold space-y-2">
                                    <p>พนักงาน: <span className="text-indigo-700">{branchData.staff?.find(s => s.id === showExtraOtModal.staffId)?.name || 'N/A'}</span></p>
                                    <p>วันที่: <span className="text-indigo-700">{showExtraOtModal.dateStr}</span></p>
                                    <p>OT ขออนุมัติ: <span className="text-rose-600 font-black">{showExtraOtModal.requestedOt} ชม.</span> (จากโควตาเดิม {showExtraOtModal.baseOt} ชม.)</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">เหตุผลการขอ OT (จำเป็นต้องกรอก)</label>
                                    <textarea
                                        value={extraOtReason}
                                        onChange={(e) => setExtraOtReason(e.target.value)}
                                        placeholder="เช่น ลูกค้าเยอะช่วงท้ายกะ, ต้องอยู่ช่วยปิดร้าน"
                                        className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 bg-white shadow-sm min-h-[100px] resize-y"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        handleSubmitExtraOtRequest(showExtraOtModal.dateStr, showExtraOtModal.dutyId, showExtraOtModal.slotIdx, showExtraOtModal.staffId, showExtraOtModal.baseOt, showExtraOtModal.requestedOt, extraOtReason);
                                        setShowExtraOtModal(null);
                                        setExtraOtReason('');
                                    }}
                                    disabled={!extraOtReason.trim()}
                                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs sm:text-sm hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg mt-2 uppercase tracking-widest"
                                >
                                    ส่งคำขออนุมัติ
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showForecastModal && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><TrendingUp className="w-6 h-6 text-indigo-500" /> {ptRequestMode === 'OVER_BUDGET' ? 'ขออนุมัติชั่วโมงเกินโควตา' : 'ขอจัดกะพิเศษ (Event)'}</h3>
                                <button onClick={() => setShowForecastModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            {(() => {
                                const pendingExtraPtReq = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === activeDay.dateStr && (r.dept || 'service') === activeDept && r.status === 'PENDING_MANAGER');
                                const alreadyApprovedHours = activeDept === 'kitchen' ? (schedule[activeDay.dateStr]?.eventExtraHoursKitchen || 0) : (schedule[activeDay.dateStr]?.eventExtraHoursService || schedule[activeDay.dateStr]?.eventExtraHours || 0);

                                if (pendingExtraPtReq) {
                                    return (
                                        <div className="space-y-4">
                                            <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center flex flex-col items-center gap-3">
                                                <Clock className="w-10 h-10 text-amber-500" />
                                                <div>
                                                    <p className="text-sm font-black text-amber-700">มีคำขอรอผู้จัดการเขต (AM) อนุมัติ</p>
                                                    <p className="text-xs font-bold text-amber-600 mt-1">คุณได้ส่งคำขอของวันที่ {activeDay.dateStr} ไปแล้ว ไม่สามารถขอซ้ำได้<br />กรุณารอ AM อนุมัติ หรือยกเลิกคำขอเดิมเพื่อสร้างใหม่</p>
                                                </div>
                                            </div>
                                            <button onClick={() => { handleRejectRequest(pendingExtraPtReq.id); setShowForecastModal(false); }} className="w-full bg-red-50 text-red-500 py-3.5 rounded-xl font-black text-xs sm:text-sm hover:bg-red-500 hover:text-white transition border border-red-200 shadow-sm mt-2 uppercase tracking-widest">ยกเลิกคำขอเดิม</button>
                                        </div>
                                    );
                                }

                                if (alreadyApprovedHours > 0) {
                                    const approvedReqInModal = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === activeDay.dateStr && (r.dept || 'service') === activeDept && r.status === 'APPROVED');
                                    return (
                                        <div className="space-y-4">
                                            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl text-center flex flex-col items-center gap-3">
                                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                                <div>
                                                    <p className="text-sm font-black text-emerald-700">คำขอของวันนี้ได้รับการอนุมัติแล้ว</p>
                                                    <p className="text-xs font-bold text-emerald-600 mt-1">ได้รับโควตาพิเศษเพิ่ม +{alreadyApprovedHours.toFixed(1)} ชั่วโมง<br />(บันทึกเป็นประวัติใบงานเรียบร้อยแล้ว ไม่สามารถขอซ้ำได้)</p>
                                                    {approvedReqInModal?.reason && (
                                                        <div className="mt-3 text-left p-3 rounded bg-white/60 border border-emerald-100 text-[11px] text-emerald-700 font-bold">
                                                            <span className="text-[10px] text-emerald-600 block mb-0.5 font-bold">เหตุผลที่ขออนุมัติ:</span>
                                                            “{approvedReqInModal.reason}”
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full mt-2">
                                                <button onClick={() => {
                                                    setConfirmModal({
                                                        message: `ยืนยันการยกเลิกใบงานพิเศษของวันที่ ${activeDay.dateStr} และคืนโควตา ${alreadyApprovedHours.toFixed(1)} ชม. กลับคืนระบบหรือไม่?`,
                                                        action: () => {
                                                            setSchedule(prev => {
                                                                const newSched = JSON.parse(JSON.stringify(prev)); if (newSched[activeDay.dateStr]) { if (activeDept === "kitchen") { newSched[activeDay.dateStr].eventExtraHoursKitchen = 0; } else { newSched[activeDay.dateStr].eventExtraHoursService = 0; newSched[activeDay.dateStr].eventExtraHours = 0; } }
                                                                if (activeBranchId) autoSaveSchedule(newSched, true);
                                                                return newSched;
                                                            });
                                                            const req = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === activeDay.dateStr && (r.dept || 'service') === activeDept && r.status === 'APPROVED');
                                                            if (req) {
                                                                const newList = pendingRequests.map(r => r.id === req.id ? { ...r, status: 'REJECTED', rejectReason: 'Manager Cancelled', updatedTimestamp: Date.now() } : r);
                                                                setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', activeBranchId), { list: newList });
                                                            }
                                                            setShowForecastModal(false);
                                                        }
                                                    });
                                                }} className="flex-1 bg-red-50 text-red-500 py-3.5 rounded-xl font-black text-[10px] sm:text-xs hover:bg-red-500 hover:text-white transition border border-red-200 shadow-sm uppercase tracking-widest">ยกเลิกใบงาน</button>
                                                <button onClick={() => setShowForecastModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs sm:text-sm hover:bg-slate-200 transition border shadow-sm uppercase tracking-widest">ปิดหน้าต่าง</button>
                                            </div>
                                        </div>
                                    );
                                }

                                if (ptRequestMode === 'OVER_BUDGET') {
                                    const allowance = activeDept === 'kitchen'
                                        ? (ptLedger.kitchen.dailyAllowance[activeDay.dateStr] || { total: 0 })
                                        : (ptLedger.service.dailyAllowance[activeDay.dateStr] || { total: 0 });
                                    const usage = activeDept === 'kitchen'
                                        ? (ptLedger.kitchen.dailyUsage[activeDay.dateStr] || { base: 0, event: 0 })
                                        : (ptLedger.service.dailyUsage[activeDay.dateStr] || { base: 0, event: 0 });
                                    const usedTotal = usage.base + usage.event;
                                    const excessHours = Math.max(0, usedTotal - allowance.total);

                                    return (
                                        <div className="space-y-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                                                <div className="text-slate-500 font-bold col-span-2">ประเภทคำขอ: <span className="text-red-600 font-black">ขออนุมัติชั่วโมงเกินโควตาประจำวัน</span></div>
                                                <div className="text-slate-500 font-bold">วันที่ขอ: <span className="text-slate-800 font-black">{activeDay.dateStr}</span></div>
                                                <div className="text-slate-500 font-bold">แผนก: <span className="text-indigo-600 font-black">{activeDept === 'kitchen' ? 'ครัว (BOH)' : 'บริการ (FOH)'}</span></div>
                                                <div className="text-slate-500 font-bold">โควตาปัจจุบัน: <span className="text-slate-800">{allowance.total.toFixed(1)} ชม.</span></div>
                                                <div className="text-slate-500 font-bold">ชั่วโมงใช้งานจริง: <span className="text-slate-800">{usedTotal.toFixed(1)} ชม.</span></div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">เหตุผลการขออนุมัติชั่วโมงเกินโควตา (จำเป็นต้องกรอก)</label>
                                                <input type="text" value={forecastReason} onChange={(e) => setForecastReason(e.target.value)} placeholder="ระบุเหตุผล เช่น ลูกค้าเยอะกว่าปกติ..." className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 bg-white shadow-sm" />
                                            </div>
                                            <div className="p-4 rounded-xl border flex flex-col items-center justify-center gap-1 bg-red-50 border-red-200 shadow-inner">
                                                <span className="text-[10px] font-bold text-red-500 uppercase">ชั่วโมงส่วนเกินที่ขออนุมัติ</span>
                                                <span className="text-3xl font-black text-red-600">+{excessHours.toFixed(1)} <span className="text-sm">ชม.</span></span>
                                            </div>
                                            <button onClick={() => handleSubmitForecastRequest(activeDay.dateStr, 0, excessHours, activeDept, 'OVER_BUDGET')} disabled={excessHours <= 0 || !forecastReason.trim()} className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-black text-xs sm:text-sm transition disabled:opacity-50 shadow-lg mt-2 uppercase tracking-widest">ส่งคำขออนุมัติชั่วโมงส่วนเกิน</button>
                                        </div>
                                    );
                                }

                                const baseTc = Object.values(branchData.matrix?.[activeDay.type]?.hourlyTc || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                                const baseMh = getBaseManHours(activeDay.type, activeDept);
                                const ratio = baseTc > 0 ? (baseMh / baseTc) : 0;

                                const fTc = parseFloat(forecastTc) || 0;
                                const neededMh = fTc * ratio;
                                const diffMh = Math.max(0, neededMh - baseMh);

                                return (
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                                            <div className="text-slate-500 font-bold">ประเภทวัน: <span className="text-slate-800 uppercase">{activeDay.type}</span></div>
                                            <div className="text-slate-500 font-bold">TC ปกติ (Base): <span className="text-slate-800">{baseTc} บิล</span></div>
                                            <div className="text-slate-500 font-bold">ชั่วโมงคนปกติ: <span className="text-slate-800">{baseMh.toFixed(1)} ชม.</span></div>
                                            <div className="text-slate-500 font-bold">Ratio: <span className="text-indigo-600">{ratio.toFixed(2)} ชม./บิล</span></div>
                                        </div>

                                        {baseTc === 0 ? (
                                            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-xs font-bold text-center">กรุณาให้แอดมินตั้งค่า Base TC ของสาขาในเมนูตั้งค่าก่อนใช้งาน</div>
                                        ) : (
                                            <React.Fragment>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">คาดการณ์ยอดขาย (Forecast TC) บิล</label>
                                                    <input type="text" inputMode="numeric" value={forecastTc} onChange={(e) => setForecastTc(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={`เช่น ${baseTc + 50}`} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 bg-white shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">เหตุผลการขอ (เช่น มีคอนเสิร์ตใหญ่)</label>
                                                    <input type="text" value={forecastReason} onChange={(e) => setForecastReason(e.target.value)} placeholder="ระบุเหตุผล..." className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 bg-white shadow-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">หลักฐาน (เช่น ลิงก์ตารางงานห้าง)</label>
                                                    <input type="text" value={forecastEvidence} onChange={(e) => setForecastEvidence(e.target.value)} placeholder="ระบุหลักฐานอ้างอิง..." className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 bg-white shadow-sm" />
                                                </div>
                                                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-1 ${diffMh > 0 ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">ระบบแนะนำให้เพิ่มชั่วโมงพนักงาน</span>
                                                    <span className={`text-3xl font-black ${diffMh > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>+{diffMh.toFixed(1)} <span className="text-sm">ชม.</span></span>
                                                </div>
                                                <button onClick={() => handleSubmitForecastRequest(activeDay.dateStr, fTc, diffMh, activeDept, 'EVENT')} disabled={diffMh <= 0 || !forecastReason.trim() || !forecastEvidence.trim()} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs sm:text-sm hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg mt-2 uppercase tracking-widest">ส่งคำขออนุมัติโควตา</button>
                                            </React.Fragment>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}        {showPtLedgerDetails && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-3xl w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 max-h-[85vh]">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><BarChart3 className="w-6 h-6 text-indigo-500" /> รายละเอียดการใช้ชั่วโมง PT</h3>
                                <button onClick={() => setShowPtLedgerDetails(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-slate-100 mb-2 gap-2">
                                <button
                                    onClick={() => setPtLedgerActiveTab('overview')}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${ptLedgerActiveTab === 'overview' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    ภาพรวมสาขา
                                </button>
                                <button
                                    onClick={() => setPtLedgerActiveTab('service')}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${ptLedgerActiveTab === 'service' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    แผนกบริการ (FOH)
                                </button>
                                <button
                                    onClick={() => setPtLedgerActiveTab('kitchen')}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${ptLedgerActiveTab === 'kitchen' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    แผนกครัว (BOH)
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                                {ptLedgerActiveTab === 'overview' && (
                                    <div className="space-y-6">
                                        {/* Branch summary cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">งบชั่วโมง PT ทั้งหมด</span>
                                                <span className="text-xl font-black text-slate-800">{(ptLedger.totalAllowance || 0).toFixed(1)} ชม.</span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">ใช้งานสะสมจริง</span>
                                                <span className="text-xl font-black text-indigo-600">{(ptLedger.usedHours || 0).toFixed(1)} ชม.</span>
                                            </div>                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">อัตราการใช้งาน</span>
                                                <span className={`text-xl font-black ${(ptLedger.usagePercent || 0) > 100 ? 'text-red-500' : 'text-emerald-500'}`}>{(ptLedger.usagePercent || 0).toFixed(1)}%</span>
                                            </div>
                                        </div>

                                        {/* Quota Breakdown Table */}
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
                                            <h4 className="font-black text-slate-800 text-xs sm:text-sm uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                                                <BarChart3 className="w-4 h-4 text-indigo-500" /> รายละเอียดส่วนประกอบโควตาและชั่วโมงจัดกะ PT (PT Quota & Hours Breakdown)
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-bold text-left">
                                                <div className="space-y-2">
                                                    <h5 className="font-extrabold text-indigo-600 text-xs uppercase mb-1">แผนกบริการ (FOH)</h5>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">โควตาตั้งต้นปกติ (Base Quota):</span>
                                                        <span className="text-slate-700">{(ptLedger.service.baseAllowance || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">โควตาชดลาหยุด (Leave Comp):</span>
                                                        <span className="text-slate-700">+{(ptLedger.service.leaveRefunds || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">โควตาชดคนขาด (Vacancy Comp):</span>
                                                        <span className="text-slate-700">+{(ptLedger.service.vacancyCompensations || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-slate-500">โควตาอนุมัติพิเศษ (Special Quota):</span>
                                                        <span className="text-indigo-600 font-black">+{(ptLedger.service.eventExtras || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1">
                                                        <span className="text-slate-700 font-extrabold">โควตารวมบริการ (FOH Allowed):</span>
                                                        <span className="text-slate-900 font-extrabold">{(ptLedger.service.totalAllowance || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <h5 className="font-extrabold text-orange-600 text-xs uppercase mb-1">แผนกครัว (BOH)</h5>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">โควตาตั้งต้นปกติ (Base Quota):</span>
                                                        <span className="text-slate-700">{(ptLedger.kitchen.baseAllowance || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">โควตาชดลาหยุด (Leave Comp):</span>
                                                        <span className="text-slate-700">+{(ptLedger.kitchen.leaveRefunds || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">โควตาชดคนขาด (Vacancy Comp):</span>
                                                        <span className="text-slate-700">+{(ptLedger.kitchen.vacancyCompensations || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-slate-500">โควตาอนุมัติพิเศษ (Special Quota):</span>
                                                        <span className="text-orange-600 font-black">+{(ptLedger.kitchen.eventExtras || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1">
                                                        <span className="text-slate-700 font-extrabold">โควตารวมครัว (BOH Allowed):</span>
                                                        <span className="text-slate-900 font-extrabold">{(ptLedger.kitchen.totalAllowance || 0).toFixed(1)} ชม.</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Staff list */}
                                        <div>
                                            <h4 className="font-black text-slate-700 text-sm mb-3 uppercase tracking-widest border-b border-slate-100 pb-2">สรุปชั่วโมงตามรายบุคคล (PT Staff)</h4>
                                            {Object.keys(ptLedger.staffUsage || {}).length === 0 ? (
                                                <div className="text-center text-xs text-slate-400 font-bold py-4">ยังไม่มีการจ่ายงานให้ PT</div>
                                            ) : (
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-500">
                                                            <th className="p-2 border-b border-slate-200 font-black">ชื่อพนักงาน</th>
                                                            <th className="p-2 border-b border-slate-200 font-black text-center">แผนก</th>
                                                            <th className="p-2 border-b border-slate-200 font-black text-center">ตำแหน่ง</th>
                                                            <th className="p-2 border-b border-slate-200 font-black text-center">ชม. ปกติ</th>
                                                            <th className="p-2 border-b border-slate-200 font-black text-center">ชม. พิเศษ (Event)</th>
                                                            <th className="p-2 border-b border-slate-200 font-black text-center text-indigo-600">รวม</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.values(ptLedger.staffUsage).sort((a, b) => (b.base + b.event) - (a.base + a.event)).map((s, idx) => (
                                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                                <td className="p-2 font-bold text-slate-700">{s.name}</td>
                                                                <td className="p-2 text-center">
                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${s.dept === 'kitchen' ? 'bg-orange-50 text-orange-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                                                        {s.dept === 'kitchen' ? 'ครัว' : 'บริการ'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-black text-slate-600">{s.pos}</span></td>
                                                                <td className="p-2 text-center font-bold text-slate-600">{s.base > 0 ? s.base.toFixed(1) : '-'}</td>
                                                                <td className="p-2 text-center font-bold text-amber-600">{s.event > 0 ? s.event.toFixed(1) : '-'}</td>
                                                                <td className="p-2 text-center font-black text-indigo-600">{(s.base + s.event).toFixed(1)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {ptLedgerActiveTab === 'service' && (
                                    <div className="space-y-6">
                                        {/* Service summary cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">งบชั่วโมง PT บริการ</span>
                                                <span className="text-xl font-black text-slate-800">{(ptLedger.service.totalAllowance || 0).toFixed(1)} ชม.</span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">ใช้งานบริการจริง</span>
                                                <span className="text-xl font-black text-indigo-600">{(ptLedger.service.usedHours || 0).toFixed(1)} ชม.</span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">อัตราการใช้งาน</span>
                                                <span className={`text-xl font-black ${(ptLedger.service.usagePercent || 0) > 100 ? 'text-red-500' : 'text-emerald-500'}`}>{(ptLedger.service.usagePercent || 0).toFixed(1)}%</span>
                                            </div>
                                        </div>

                                        {/* Service Daily table */}
                                        <div>
                                            <h4 className="font-black text-slate-700 text-sm mb-3 uppercase tracking-widest border-b border-slate-100 pb-2">ตารางโควตาและการใช้บริการรายวัน (Service Daily Quota vs Usage)</h4>
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500">
                                                        <th className="p-2 border-b border-slate-200 font-black text-center w-12">วันที่</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center">โควตารวม (H)</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center">ใช้ไป (H)</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center">คงเหลือ (H)</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center w-20">สถานะ</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {CALENDAR_DAYS.map(day => {
                                                        const dateStr = day.dateStr;
                                                        const u = ptLedger.service.dailyUsage[dateStr] || { base: 0, event: 0 };
                                                        const a = ptLedger.service.dailyAllowance?.[dateStr] || { baseAvg: 0, leave: 0, vacancy: 0, event: 0, total: 0 };
                                                        const approvedReq = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && (r.dept || 'service') === 'service' && r.status === 'APPROVED');
                                                        const totalUsed = u.base + u.event;
                                                        const diff = a.total - totalUsed;
                                                        const isOver = diff < 0 && totalUsed > 0;

                                                        return (
                                                            <tr key={dateStr} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isOver ? 'bg-rose-50/30' : ''}`}>
                                                                <td className="p-2 font-bold text-slate-700 text-center">{day.dayNum}</td>
                                                                <td className="p-2 text-center">
                                                                    <div className="font-black text-slate-700">{a.total.toFixed(1)}</div>
                                                                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">เฉลี่ย {a.baseAvg.toFixed(1)} + ชดว่าง {a.vacancy.toFixed(1)} + ชดลา {a.leave.toFixed(1)} + พิเศษ {a.event.toFixed(1)}</div>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <div className="font-black text-indigo-600">{totalUsed.toFixed(1)}</div>
                                                                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">ปกติ {u.base.toFixed(1)} + พิเศษ {u.event.toFixed(1)}</div>
                                                                </td>
                                                                <td className={`p-2 text-center font-black ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    {isOver ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[9px] font-black shadow-sm">เกินโควตา</span> : <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-black">ปกติ</span>}
                                                                    {approvedReq && (
                                                                        <div className="text-[8px] text-emerald-600 font-bold mt-1" title={approvedReq.reason}>
                                                                            ✨ อนุมัติ ({approvedReq.reason})
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {ptLedgerActiveTab === 'kitchen' && (
                                    <div className="space-y-6">
                                        {/* Kitchen summary cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">งบชั่วโมง PT ครัว</span>
                                                <span className="text-xl font-black text-slate-800">{(ptLedger.kitchen.totalAllowance || 0).toFixed(1)} ชม.</span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">ใช้งานครัวจริง</span>
                                                <span className="text-xl font-black text-orange-600">{(ptLedger.kitchen.usedHours || 0).toFixed(1)} ชม.</span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">อัตราการใช้งาน</span>
                                                <span className={`text-xl font-black ${(ptLedger.kitchen.usagePercent || 0) > 100 ? 'text-red-500' : 'text-emerald-500'}`}>{(ptLedger.kitchen.usagePercent || 0).toFixed(1)}%</span>
                                            </div>
                                        </div>

                                        {/* Kitchen Daily table */}
                                        <div>
                                            <h4 className="font-black text-slate-700 text-sm mb-3 uppercase tracking-widest border-b border-slate-100 pb-2">ตารางโควตาและการใช้ครัวรายวัน (Kitchen Daily Quota vs Usage)</h4>
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500">
                                                        <th className="p-2 border-b border-slate-200 font-black text-center w-12">วันที่</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center">โควตารวม (H)</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center">ใช้ไป (H)</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center">คงเหลือ (H)</th>
                                                        <th className="p-2 border-b border-slate-200 font-black text-center w-20">สถานะ</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {CALENDAR_DAYS.map(day => {
                                                        const dateStr = day.dateStr;
                                                        const u = ptLedger.kitchen.dailyUsage[dateStr] || { base: 0, event: 0 };
                                                        const a = ptLedger.kitchen.dailyAllowance?.[dateStr] || { baseAvg: 0, leave: 0, vacancy: 0, event: 0, total: 0 };
                                                        const approvedReq = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && r.dept === 'kitchen' && r.status === 'APPROVED');
                                                        const totalUsed = u.base + u.event;
                                                        const diff = a.total - totalUsed;
                                                        const isOver = diff < 0 && totalUsed > 0;

                                                        return (
                                                            <tr key={dateStr} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isOver ? 'bg-rose-50/30' : ''}`}>
                                                                <td className="p-2 font-bold text-slate-700 text-center">{day.dayNum}</td>
                                                                <td className="p-2 text-center">
                                                                    <div className="font-black text-slate-700">{a.total.toFixed(1)}</div>
                                                                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">เฉลี่ย {a.baseAvg.toFixed(1)} + ชดว่าง {a.vacancy.toFixed(1)} + ชดลา {a.leave.toFixed(1)} + พิเศษ {a.event.toFixed(1)}</div>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <div className="font-black text-orange-600">{totalUsed.toFixed(1)}</div>
                                                                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">ปกติ {u.base.toFixed(1)} + พิเศษ {u.event.toFixed(1)}</div>
                                                                </td>
                                                                <td className={`p-2 text-center font-black ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    {isOver ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[9px] font-black shadow-sm">เกินโควตา</span> : <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-black">ปกติ</span>}
                                                                    {approvedReq && (
                                                                        <div className="text-[8px] text-emerald-600 font-bold mt-1" title={approvedReq.reason}>
                                                                            ✨ อนุมัติ ({approvedReq.reason})
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {showOtLedgerDetails && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 max-h-[85vh]">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><BarChart3 className="w-6 h-6 text-indigo-500" /> รายละเอียดการใช้ชั่วโมง OT (FT)</h3>
                                <button onClick={() => setShowOtLedgerDetails(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                                <div>
                                    <h4 className="font-black text-slate-700 text-sm mb-3 uppercase tracking-widest border-b border-slate-100 pb-2">สรุปชั่วโมงตามรายบุคคล (Full-Time OT)</h4>
                                    {Object.keys(otLedger.staffOtUsage || {}).length === 0 ? (
                                        <div className="text-center text-xs text-slate-400 font-bold py-4">ยังไม่มีการให้ OT ในเดือนนี้</div>
                                    ) : (
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500">
                                                    <th className="p-2 border-b border-slate-200 font-black">ชื่อพนักงาน</th>
                                                    <th className="p-2 border-b border-slate-200 font-black text-center">ตำแหน่ง</th>
                                                    <th className="p-2 border-b border-slate-200 font-black text-center text-indigo-600">รวม OT (ชม.)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.values(otLedger.staffOtUsage).sort((a, b) => b.ot - a.ot).map((s, idx) => (
                                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="p-2 font-bold text-slate-700">{s.name}</td>
                                                        <td className="p-2 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-black text-slate-600">{s.pos}</span></td>
                                                        <td className="p-2 text-center font-black text-indigo-600">{s.ot.toFixed(1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-700 text-sm mb-3 uppercase tracking-widest border-b border-slate-100 pb-2">สรุปโควตาและการใช้งานรายวัน (Daily Quota vs Usage)</h4>
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500">
                                                <th className="p-2 border-b border-slate-200 font-black text-center w-12">วันที่</th>
                                                <th className="p-2 border-b border-slate-200 font-black text-center">โควตารวม (H)</th>
                                                <th className="p-2 border-b border-slate-200 font-black text-center">ใช้ไป (H)</th>
                                                <th className="p-2 border-b border-slate-200 font-black text-center">คงเหลือ (H)</th>
                                                <th className="p-2 border-b border-slate-200 font-black text-center w-20">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {CALENDAR_DAYS.map(day => {
                                                const dateStr = day.dateStr;
                                                const u = otLedger.dailyOtUsed[dateStr] || 0;
                                                const b = otLedger.dailyOtBudget?.[dateStr] || 0;
                                                const diff = b - u;
                                                const isOver = diff < 0 && u > 0;

                                                return (
                                                    <tr key={dateStr} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isOver ? 'bg-rose-50/30' : ''}`}>
                                                        <td className="p-2 font-bold text-slate-700 text-center">{day.dayNum}</td>
                                                        <td className="p-2 text-center font-black text-slate-700">{b.toFixed(1)}</td>
                                                        <td className="p-2 text-center font-black text-indigo-600">{u.toFixed(1)}</td>
                                                        <td className={`p-2 text-center font-black ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {isOver ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[9px] font-black shadow-sm">เกินโควตา</span> : <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-black">ปกติ</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {showHistoryModal && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 max-w-2xl w-full shadow-2xl relative flex flex-col gap-4 sm:gap-6 animate-in zoom-in-95 font-sans max-h-[80vh] overflow-hidden">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 p-3 rounded-full"><FolderOpen className="w-6 h-6 text-indigo-500" /></div>
                                    <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">ประวัติการจัดกะ</h3><p className="text-[10px] sm:text-xs font-bold text-slate-400">ระบบจะบันทึก 10 เวอร์ชันล่าสุดโดยอัตโนมัติ</p></div>
                                </div>
                                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                {scheduleVersions.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-100">ไม่มีประวัติการจัดกะ 💾</div>
                                ) : (
                                    <div className="space-y-3">
                                        {scheduleVersions.map(version => {
                                            const typeLabels = {
                                                'AUTO_ASSIGN_DAILY': { label: 'จัดกะอัตโนมัติ (รายวัน)', icon: <Wand2 className="w-4 h-4 text-indigo-500" /> },
                                                'AUTO_ASSIGN_WEEKLY': { label: 'จัดกะอัตโนมัติ (รายสัปดาห์)', icon: <Wand2 className="w-4 h-4 text-indigo-500" /> },
                                                'AUTO_ASSIGN_MONTHLY': { label: 'จัดกะอัตโนมัติ (รายเดือน)', icon: <Wand2 className="w-4 h-4 text-indigo-500" /> },
                                                'PRINT_SNAPSHOT_DAILY': { label: 'บันทึกจากการพิมพ์ (รายวัน)', icon: <Printer className="w-4 h-4 text-slate-500" /> },
                                                'PRINT_SNAPSHOT_MONTHLY': { label: 'บันทึกจากการพิมพ์ (รายเดือน)', icon: <Printer className="w-4 h-4 text-slate-500" /> },
                                            };
                                            const typeInfo = typeLabels[version.type] || { label: version.type, icon: <Save className="w-4 h-4 text-slate-500" /> };
                                            return (
                                                <div key={version.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                                                    <div>
                                                        <h4 className="font-black text-slate-800 flex items-center gap-2">{typeInfo.icon} {typeInfo.label}</h4>
                                                        <p className="text-xs font-bold text-slate-500 mt-1">{new Date(version.timestamp).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                    </div>
                                                    <button onClick={() => handleRestoreVersion(version)} className="w-full sm:w-auto bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-500 hover:text-white transition shadow-sm border border-emerald-200">กู้คืนเวอร์ชันนี้</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {showChangePasswordModal && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-sm w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><KeyRound className="w-6 h-6 text-indigo-500" /> เปลี่ยนรหัสผ่าน</h3>
                                <button onClick={() => { setShowChangePasswordModal(false); setNewPasswordInput(''); }} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">รหัสผ่านใหม่</label>
                                    <input type="text" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} placeholder="กรอกรหัสผ่านใหม่..." className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 bg-white shadow-sm" />
                                </div>
                                <button onClick={async () => {
                                    if (!newPasswordInput.trim()) return;
                                    try {
                                        let nc = JSON.parse(JSON.stringify(globalConfig));
                                        if (authRole === 'branch') {
                                            const bIdx = nc.branches.findIndex(b => b.id === activeBranchId);
                                            if (bIdx > -1) nc.branches[bIdx].pass = newPasswordInput.trim();
                                        } else if (authRole === 'areamanager') {
                                            const aIdx = nc.areaManagers.findIndex(a => a.user === authUser);
                                            if (aIdx > -1) nc.areaManagers[aIdx].pass = newPasswordInput.trim();
                                        }
                                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc);
                                        setGlobalConfig(nc);
                                        setShowChangePasswordModal(false);
                                        setNewPasswordInput('');
                                        setConfirmModal({ message: 'เปลี่ยนรหัสผ่านสำเร็จ!' });
                                    } catch (e) {
                                        setConfirmModal({ message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
                                    }
                                }} disabled={!newPasswordInput.trim()} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-sm hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg mt-2 uppercase tracking-widest">
                                    ยืนยันการเปลี่ยนรหัสผ่าน
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showImportStaffModal && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><UserPlus className="w-6 h-6 text-emerald-500" /> นำเข้าพนักงาน (Bulk Import)</h3>
                                <button onClick={() => { setShowImportStaffModal(false); setImportStaffText(''); }} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-xs sm:text-sm text-emerald-800 font-bold space-y-2">
                                    <div className="flex justify-between items-center mb-2 border-b border-emerald-200/50 pb-2">
                                        <p>วิธีการนำเข้าข้อมูลพนักงาน:</p>
                                        <button onClick={handleDownloadTemplate} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-emerald-700 transition shadow-sm flex items-center gap-1">
                                            <Download className="w-3 h-3" /> โหลดไฟล์แม่แบบ (CSV)
                                        </button>
                                    </div>
                                    <p>1. <b>อัปโหลดไฟล์ CSV</b> หรือ คัดลอกข้อมูลจาก Excel มาวางในกล่องด้านล่าง</p>
                                    <p>2. เรียงลำดับคอลัมน์ ดังนี้:</p>
                                    <div className="flex flex-wrap gap-1 mt-1 font-black text-[10px] sm:text-xs">
                                        <span className="bg-white px-2 py-1 rounded shadow-sm">1. รหัสพนง. (เว้นว่างได้)</span>
                                        <span className="bg-white px-2 py-1 rounded shadow-sm text-red-500">2. ชื่อ-สกุล*</span>
                                        <span className="bg-white px-2 py-1 rounded shadow-sm text-indigo-500">3. แผนก (บริการ/ครัว)</span>
                                        <span className="bg-white px-2 py-1 rounded shadow-sm text-indigo-500">4. ตำแหน่ง (เช่น OC, PT)</span>
                                        <span className="bg-white px-2 py-1 rounded shadow-sm">5. ประเภทจ้าง (รายเดือน/รายชั่วโมง/PT)</span>
                                        <span className="bg-white px-2 py-1 rounded shadow-sm">6. ฐานเงินเดือน/ค่าแรง</span>
                                        <span className="bg-white px-2 py-1 rounded shadow-sm">7. วันหยุดประจำสัปดาห์ (0-6 หรือชื่อวัน)</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="w-full border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 rounded-xl p-4 text-center cursor-pointer transition flex items-center justify-center gap-2">
                                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                        <Upload className="w-5 h-5 text-emerald-600" />
                                        <span className="text-emerald-700 font-black text-sm">คลิกเพื่ออัปโหลดไฟล์ข้อมูล CSV</span>
                                    </label>
                                    <textarea
                                        value={importStaffText}
                                        onChange={(e) => setImportStaffText(e.target.value)}
                                        placeholder={"ตัวอย่างการวางข้อมูล:\n10001\tสมชาย ใจดี\tบริการ\tOC\tรายเดือน\t15000\t1\n10002\tสมหญิง รักงาน\tครัว\tPT ครัว\tPT\t50\t"}
                                        className="w-full border rounded-xl px-4 py-3 text-xs sm:text-sm font-medium outline-none focus:border-emerald-500 bg-white shadow-sm min-h-[150px] resize-y"
                                        wrap="off"
                                    />
                                </div>
                                <div className="flex gap-3 mt-2">
                                    <button onClick={() => { setShowImportStaffModal(false); setImportStaffText(''); }} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-black text-xs sm:text-sm hover:bg-slate-200 transition shadow-sm uppercase tracking-widest">ยกเลิก</button>
                                    <button onClick={handleImportStaff} disabled={!importStaffText.trim()} className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-xl font-black text-xs sm:text-sm hover:bg-emerald-700 transition disabled:opacity-50 shadow-lg uppercase tracking-widest">ตรวจสอบและนำเข้าข้อมูล</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {loadTemplateState && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-sans">
                        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-sm w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" /> โหลดแม่แบบ</h3>
                                <button onClick={() => setLoadTemplateState(null)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-xs font-bold text-slate-600">เลือกข้อมูลที่ต้องการโหลดจากแม่แบบ <span className="text-emerald-600 font-black">"{loadTemplateState.name}"</span></p>
                                <div className="flex flex-col gap-2">
                                    {[
                                        { id: 'duties', label: 'หน้าที่งาน (Duties)' },
                                        { id: 'shiftPresets', label: 'กะทำงาน (Shift Presets)' },
                                        { id: 'matrix', label: 'โครงสร้างกะงาน (Matrix)' },
                                        { id: 'holidays', label: 'วันหยุดสาขา (Holidays)' },
                                        { id: 'configs', label: 'การตั้งค่า (Configs)' },
                                        { id: 'rosterStyle', label: 'รูปแบบตาราง (Roster Style)' }
                                    ].map(opt => (
                                        <label key={opt.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                            <input type="checkbox" checked={loadTemplateOptions[opt.id]} onChange={e => setLoadTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.checked }))} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300" />
                                            <span className="text-xs font-bold text-slate-700">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <button onClick={confirmLoadTemplate} className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-black text-sm hover:bg-emerald-700 transition shadow-lg mt-2 uppercase tracking-widest">
                                    ยืนยันการโหลด
                                </button>
                            </div>
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
                        <img src="https://img1.pic.in.th/images/ChatGPT-Image-6-..-2569-19_46_07.png" alt="GON SUPER STORE" className="w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 rounded-full shadow-2xl object-cover border-4 sm:border-8 border-slate-800 bg-white mb-6 sm:mb-8 transition-transform hover:scale-105 duration-500" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/300?text=GON"; }} />
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
                            <div className="flex items-center ml-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-slate-500 select-none">จำชื่อผู้ใช้งาน</span>
                                </label>
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
                    <div className="flex flex-col items-start sm:items-end gap-2 mt-4 sm:mt-0">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Current App Version: <span className="font-black text-slate-700">{CURRENT_APP_VERSION}</span></div>
                        <button onClick={async () => {
                            const newVer = window.prompt("กรอกเลขเวอร์ชันใหม่ (เช่น 15.7.1) เพื่อบังคับให้ผู้ใช้ทุกคนรีเฟรชระบบ:\n*คุณต้องเปลี่ยนเลข CURRENT_APP_VERSION ในโค้ดและ Deploy ก่อนกดปุ่มนี้*", CURRENT_APP_VERSION);
                            if (newVer && newVer !== CURRENT_APP_VERSION) {
                                const newConfig = { ...globalConfig, latestVersion: newVer };
                                setGlobalConfig(newConfig);
                                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), newConfig);
                                setConfirmModal({ message: 'สั่งบังคับรีเฟรชผู้ใช้งานทุกคนเรียบร้อยแล้ว!' });
                            }
                        }} className="bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black shadow-sm transition-all border border-amber-200">
                            🔄 สั่งรีเฟรชผู้ใช้งานทุกคน (Force Reload)
                        </button>
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
                                if (n && u && p) {
                                    setGlobalConfig(prev => {
                                        const nc = { ...prev, branches: [...(prev.branches || []), { id: 'b' + Date.now(), name: n, user: u, pass: p }] };
                                        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc).catch(console.error);
                                        return nc;
                                    });
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
                                        {editingBranchId === b.id ? (
                                            <div className="mt-4 space-y-2">
                                                <input type="text" placeholder="Name" value={editBranchData.name || ''} onChange={e => setEditBranchData({ ...editBranchData, name: e.target.value })} className="w-full border rounded-lg px-2 py-1 text-xs" />
                                                <input type="text" placeholder="User" value={editBranchData.user || ''} onChange={e => setEditBranchData({ ...editBranchData, user: e.target.value })} className="w-full border rounded-lg px-2 py-1 text-xs" />
                                                <input type="text" placeholder="Pass" value={editBranchData.pass || ''} onChange={e => setEditBranchData({ ...editBranchData, pass: e.target.value })} className="w-full border rounded-lg px-2 py-1 text-xs" />
                                                <div className="flex gap-2">
                                                    <button onClick={saveEditBranch} className="bg-green-500 text-white px-3 py-1 rounded-lg text-[10px]"><Check className="w-3 h-3" /></button>
                                                    <button onClick={() => setEditingBranchId(null)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px]"><X className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => startEditBranch(b)} className="mt-2 text-indigo-500 text-[10px] font-bold flex items-center gap-1 hover:underline"><Edit2 className="w-3 h-3" /> แก้ไขข้อมูล</button>
                                        )}
                                    </div>
                                    <button onClick={() => setGlobalConfig(prev => {
                                        const nc = { ...prev, branches: prev.branches.filter(x => x.id !== b.id) };
                                        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc).catch(console.error);
                                        return nc;
                                    })} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm mt-6 sm:mt-10">
                    <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><UserCircle className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการผู้จัดการเขต (Area Managers)</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
                        <div className="lg:col-span-1 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-widest">เพิ่มผู้จัดการเขต</h3>
                            <div className="space-y-4">
                                <input type="text" placeholder="ชื่อ-นามสกุล" value={newAmName} onChange={e => setNewAmName(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500" />
                                <input type="text" placeholder="Username สำหรับ Login" value={newAmUser} onChange={e => setNewAmUser(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500" />
                                <input type="text" placeholder="Password" value={newAmPass} onChange={e => setNewAmPass(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500" />
                                <div className="bg-white border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar">
                                    <div className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">เลือกสาขาที่ดูแล:</div>
                                    {globalConfig.branches?.map(b => (
                                        <label key={b.id} className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
                                            <input type="checkbox" checked={newAmBranches.includes(b.id)} onChange={e => {
                                                if (e.target.checked) setNewAmBranches([...newAmBranches, b.id]);
                                                else setNewAmBranches(newAmBranches.filter(id => id !== b.id));
                                            }} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                                            <span className="text-xs font-bold text-slate-700 truncate">{b.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <button onClick={() => {
                                    if (newAmName && newAmUser && newAmPass) {
                                        setGlobalConfig(prev => {
                                            const nc = { ...prev, areaManagers: [...(prev.areaManagers || []), { id: 'AM' + Date.now(), name: newAmName, user: newAmUser, pass: newAmPass, branches: newAmBranches }] };
                                            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc).catch(console.error);
                                            return nc;
                                        });
                                        setNewAmName(''); setNewAmUser(''); setNewAmPass(''); setNewAmBranches([]);
                                    }
                                }} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors uppercase tracking-widest mt-2">บันทึกผู้จัดการเขต</button>
                            </div>
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
                            {(globalConfig.areaManagers || []).map(am => (
                                <div key={am.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors">
                                    {editingAmId === am.id ? (
                                        <div className="space-y-3">
                                            <input type="text" placeholder="Name" value={editAmData.name || ''} onChange={e => setEditAmData({ ...editAmData, name: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                            <input type="text" placeholder="User" value={editAmData.user || ''} onChange={e => setEditAmData({ ...editAmData, user: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                            <input type="text" placeholder="Pass" value={editAmData.pass || ''} onChange={e => setEditAmData({ ...editAmData, pass: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar">
                                                <div className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">เลือกสาขาที่ดูแล:</div>
                                                {globalConfig.branches?.map(b => (
                                                    <label key={b.id} className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
                                                        <input type="checkbox" checked={(editAmData.branches || []).includes(b.id)} onChange={e => {
                                                            const newBranches = e.target.checked
                                                                ? [...(editAmData.branches || []), b.id]
                                                                : (editAmData.branches || []).filter(id => id !== b.id);
                                                            setEditAmData({ ...editAmData, branches: newBranches });
                                                        }} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                                                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 truncate">{b.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={saveEditAm} className="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-black shadow-sm flex items-center justify-center gap-1"><Check className="w-4 h-4" /> บันทึก</button>
                                                <button onClick={() => setEditingAmId(null)} className="flex-1 bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-black shadow-sm flex items-center justify-center gap-1"><X className="w-4 h-4" /> ยกเลิก</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <React.Fragment>
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-black text-slate-800 text-lg flex items-center gap-2"><UserCircle className="w-5 h-5 text-indigo-500" /> {am.name}</h4>
                                                    <button onClick={() => startEditAm(am)} className="text-indigo-500 hover:text-indigo-700 p-1"><Edit2 className="w-4 h-4" /></button>
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-2 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">USER: {am.user} | PWD: {am.pass}</p>
                                                <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[10px] text-slate-600 font-bold max-h-24 overflow-y-auto custom-scrollbar leading-relaxed">
                                                    <span className="text-indigo-500 block mb-1">สาขาที่ดูแล ({am.branches?.length || 0}):</span>
                                                    {am.branches?.map(bId => globalConfig.branches?.find(x => x.id === bId)?.name).filter(Boolean).join(', ') || 'ไม่มีสาขา'}
                                                </div>
                                            </div>
                                            <button onClick={() => setGlobalConfig(prev => {
                                                const nc = { ...prev, areaManagers: prev.areaManagers.filter(x => x.id !== am.id) };
                                                setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'master'), nc).catch(console.error);
                                                return nc;
                                            })} className="mt-4 w-full bg-red-50 text-red-500 py-2.5 rounded-xl font-black text-xs hover:bg-red-500 hover:text-white transition-colors">ลบผู้จัดการเขต</button>
                                        </React.Fragment>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-rose-50 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-rose-200 shadow-sm mt-6 sm:mt-10">
                    <h2 className="text-lg sm:text-xl font-black text-rose-800 mb-4 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-rose-500" /> ศูนย์กู้คืนข้อมูล (Global Data Recovery)</h2>
                    <p className="text-sm font-bold text-rose-600 mb-6">ดึงข้อมูล Backup อัตโนมัติกลับมาใช้งาน (ระบบจะ Backup ให้ทุกครั้งที่มีการกดบันทึกในแต่ละวัน)</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <input type="date" id="global_admin_restore_date" className="border-2 border-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-rose-500 bg-white" defaultValue={new Date().toISOString().split('T')[0]} />
                        <button onClick={() => {
                            const d = document.getElementById('global_admin_restore_date').value;
                            if (d) handleMasterConfigRestore(d);
                        }} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-black text-sm transition shadow-sm">
                            ⚙️ กู้คืนเฉพาะข้อมูลส่วนกลาง (Master Config &amp; Templates)
                        </button>
                        <button onClick={() => {
                            const d = document.getElementById('global_admin_restore_date').value;
                            if (d) handleGlobalRestore(d);
                        }} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-black text-sm transition shadow-sm">
                            🚨 กู้คืนข้อมูลทุกสาขาทันที (All Branches)
                        </button>
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
                                <input type="text" value={p.name} onChange={(e) => handleUpdateShiftPreset(p.id, 'name', e.target.value)} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="flex-1 font-black text-sm text-indigo-700 bg-transparent outline-none focus:bg-white p-2 rounded-lg" />
                                <button onClick={() => handleDeleteShiftPreset(p.id)} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">กลุ่ม 9.5 ชั่วโมง (OC, SH...)</p>
                                    <div className="flex items-center gap-2">
                                        <input type="text" value={p.timings.long.startTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'startTime', e.target.value, 'long')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold" />
                                        <span>-</span>
                                        <input type="text" value={p.timings.long.endTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'endTime', e.target.value, 'long')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold" />
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">กลุ่ม 9 ชั่วโมง (EDC, PT...)</p>
                                    <div className="flex items-center gap-2">
                                        <input type="text" value={p.timings.short.startTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'startTime', e.target.value, 'short')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold" />
                                        <span>-</span>
                                        <input type="text" value={p.timings.short.endTime} onChange={(e) => handleUpdateShiftPreset(p.id, 'endTime', e.target.value, 'short')} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full text-center border rounded-lg p-1.5 text-xs font-bold" />
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

    function renderShiftThresholdSettings() {
        if (authRole !== 'superadmin') return null;

        const thresholds = branchData.shiftThresholds || { morningEnd: 11, lateMorningEnd: 12, afternoonEnd: 16, eveningEnd: 19 };

        const handleChange = async (field, value) => {
            const nd = JSON.parse(JSON.stringify(branchData));
            if (!nd.shiftThresholds) nd.shiftThresholds = { morningEnd: 11, lateMorningEnd: 12, afternoonEnd: 16, eveningEnd: 19 };
            nd.shiftThresholds[field] = parseInt(value) || 0;
            setBranchData(nd);
            if (activeBranchId) {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
            }
        };

        return (
            <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full mt-6 sm:mt-10 print:hidden">
                <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter">
                    <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" /> ตั้งค่าเกณฑ์เวลาการจัดกลุ่มคอลัมน์กะ (Shift Thresholds)
                </h2>
                <p className="text-xs font-bold text-slate-500 mb-4">กำหนดชั่วโมงเริ่มต้นของแต่ละช่วงเวลา เพื่อให้ระบบจัดเรียงกะเข้าคอลัมน์ต่างๆ ในหน้า Duty Roster ได้อย่างถูกต้อง</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">สิ้นสุดกะเช้า (เริ่มสาย)</label>
                        <div className="flex items-center gap-2"><input type="number" min="0" max="23" value={thresholds.morningEnd} onChange={(e) => handleChange('morningEnd', e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500" /><span className="text-xs font-bold text-slate-400">น.</span></div>
                        <p className="text-[9px] text-slate-400 mt-1 font-bold">ก่อน {thresholds.morningEnd}:00 = <span className="text-indigo-600">เช้า</span></p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">สิ้นสุดสาย (เริ่มบ่าย)</label>
                        <div className="flex items-center gap-2"><input type="number" min="0" max="23" value={thresholds.lateMorningEnd} onChange={(e) => handleChange('lateMorningEnd', e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500" /><span className="text-xs font-bold text-slate-400">น.</span></div>
                        <p className="text-[9px] text-slate-400 mt-1 font-bold">{thresholds.morningEnd}:00 - ก่อน {thresholds.lateMorningEnd}:00 = <span className="text-indigo-600">สาย</span></p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">สิ้นสุดบ่าย (เริ่มเย็น)</label>
                        <div className="flex items-center gap-2"><input type="number" min="0" max="23" value={thresholds.afternoonEnd} onChange={(e) => handleChange('afternoonEnd', e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500" /><span className="text-xs font-bold text-slate-400">น.</span></div>
                        <p className="text-[9px] text-slate-400 mt-1 font-bold">{thresholds.lateMorningEnd}:00 - ก่อน {thresholds.afternoonEnd}:00 = <span className="text-indigo-600">บ่าย</span></p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">สิ้นสุดเย็น (เริ่มดึก)</label>
                        <div className="flex items-center gap-2"><input type="number" min="0" max="23" value={thresholds.eveningEnd} onChange={(e) => handleChange('eveningEnd', e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500" /><span className="text-xs font-bold text-slate-400">น.</span></div>
                        <p className="text-[9px] text-slate-400 mt-1 font-bold">{thresholds.afternoonEnd}:00 - ก่อน {thresholds.eveningEnd}:00 = <span className="text-indigo-600">เย็น</span><br />ตั้งแต่ {thresholds.eveningEnd}:00 เป็นต้นไป = <span className="text-indigo-600">ดึก</span></p>
                    </div>
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
            if (s.isActive !== false) {
                const daysOff = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
                const dept = s.dept || 'service';
                if (!dayOffCounts[dept]) dayOffCounts[dept] = {};
                daysOff.forEach(dOff => {
                    dayOffCounts[dept][dOff] = (dayOffCounts[dept][dOff] || 0) + 1;
                });
            }
        });
        const activeDeptDayOffCounts = dayOffCounts[activeDept] || {};

        return (
            <div className="flex-1 space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24 w-full">
                <div className={`grid grid-cols-1 ${authRole === 'superadmin' ? 'lg:grid-cols-2' : ''} gap-6 sm:gap-10`}>
                    <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Users className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการพนักงาน ({globalConfig.branches?.find(b => b.id === activeBranchId)?.name})</h2>
                            <button onClick={() => setShowImportStaffModal(true)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center justify-center gap-2">
                                <Upload className="w-4 h-4" /> นำเข้า Excel/CSV
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6 sm:mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                                <span>สรุปพนักงาน ({branchData.staff?.filter(s => s.dept === activeDept && s.isActive !== false).length || 0} คน)</span>
                                <button onClick={() => setStaffFilterPos('ALL')} className={`px-3 py-1 rounded-lg transition-all shadow-sm ${staffFilterPos === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>ดูทั้งหมด</button>
                            </div>

                            <div className="text-[10px] sm:text-xs font-black text-indigo-700 uppercase mt-2 border-b border-slate-200 pb-2">พนักงานประจำ (Full-Time)</div>
                            {(() => {
                                const headCat = DUTY_CATEGORIES[activeDept].find(c => c.id.includes('HEAD'));
                                const staffCat = DUTY_CATEGORIES[activeDept].find(c => c.id.includes('STAFF'));
                                const supportCat = DUTY_CATEGORIES[activeDept].find(c => c.id.includes('SUPPORT'));

                                const renderCat = (cat, showLimitInput = true) => {
                                    if (!cat) return null;
                                    const layerPositions = POSITIONS[activeDept].filter(p => !p.includes('PT') && getStaffLayer(activeDept, p).id === cat.id);
                                    if (layerPositions.length === 0) return null;

                                    const catStaffCount = (branchData.staff || []).filter(s => s.isActive !== false && s.dept === activeDept && layerPositions.includes(s.pos)).length;
                                    const limitId = cat.id;
                                    const catLimit = branchData.staffLimits?.[limitId];
                                    const isFull = catLimit !== undefined && catLimit !== null && catStaffCount >= catLimit;

                                    return (
                                        <div key={cat.id} className={`flex flex-col gap-2 p-3 ${showLimitInput ? 'rounded-xl bg-white border border-slate-200 shadow-sm' : ''}`}>
                                            <div className="flex justify-between items-center">
                                                <div className={`text-[10px] font-black px-3 py-1.5 rounded uppercase w-fit ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>{cat.label}</div>
                                                {showLimitInput && (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold ${isFull ? 'text-red-500' : 'text-slate-500'}`}>จำนวน {catStaffCount}/{catLimit !== undefined && catLimit !== null ? catLimit : '∞'}</span>
                                                        <input
                                                            type="number" min="0" disabled={authRole !== 'superadmin'}
                                                            value={catLimit === undefined || catLimit === null ? '' : catLimit}
                                                            onChange={(e) => handleUpdateStaffLimit(limitId, e.target.value)}
                                                            className="w-12 text-center border rounded p-1 text-[10px] font-bold outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                                                            placeholder="∞" title="ตั้งค่าจำนวนสูงสุด"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {layerPositions.map(p => {
                                                    const count = (branchData.staff || []).filter(s => s.dept === activeDept && s.pos === p && s.isActive !== false).length;
                                                    const isSelected = staffFilterPos === p;
                                                    return (
                                                        <button key={p} onClick={() => setStaffFilterPos(isSelected ? 'ALL' : p)} className={`text-[10px] font-black border px-3 py-1.5 rounded-lg transition-all shadow-sm ${isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 scale-105' : 'hover:opacity-80'} ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]} ${count === 0 ? 'opacity-40' : ''}`}>
                                                            {p}: {count}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                };

                                const combinedLimitId = `${activeDept.toUpperCase()}_STAFF_SUPPORT_FT`;
                                let combinedCount = 0;
                                if (staffCat) {
                                    const layerPositions = POSITIONS[activeDept].filter(p => !p.includes('PT') && getStaffLayer(activeDept, p).id === staffCat.id);
                                    combinedCount += (branchData.staff || []).filter(s => s.isActive !== false && s.dept === activeDept && layerPositions.includes(s.pos)).length;
                                }
                                if (supportCat) {
                                    const layerPositions = POSITIONS[activeDept].filter(p => !p.includes('PT') && getStaffLayer(activeDept, p).id === supportCat.id);
                                    combinedCount += (branchData.staff || []).filter(s => s.isActive !== false && s.dept === activeDept && layerPositions.includes(s.pos)).length;
                                }

                                const combinedLimit = branchData.staffLimits?.[combinedLimitId];
                                const isCombinedFull = combinedLimit !== undefined && combinedLimit !== null && combinedCount >= combinedLimit;

                                return (
                                    <React.Fragment>
                                        {renderCat(headCat, true)}
                                        {(staffCat || supportCat) && (
                                            <div className="flex flex-col gap-0 p-1 rounded-xl bg-slate-50 border border-slate-200 shadow-sm relative mt-2">
                                                <div className="flex justify-between items-center px-3 pt-3 pb-1 border-b border-slate-200/50 mx-2">
                                                    <div className="text-[10px] font-black text-slate-600 uppercase">Staff & Support Team (โควตาร่วม)</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold ${isCombinedFull ? 'text-red-500' : 'text-slate-500'}`}>จำนวนรวม {combinedCount}/{combinedLimit !== undefined && combinedLimit !== null ? combinedLimit : '∞'}</span>
                                                        <input
                                                            type="number" min="0" disabled={authRole !== 'superadmin'}
                                                            value={combinedLimit === undefined || combinedLimit === null ? '' : combinedLimit}
                                                            onChange={(e) => handleUpdateStaffLimit(combinedLimitId, e.target.value)}
                                                            className="w-12 text-center border rounded p-1 text-[10px] font-bold outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 bg-white"
                                                            placeholder="∞" title="ตั้งค่าจำนวนสูงสุด"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="bg-transparent">
                                                    {renderCat(staffCat, false)}
                                                    {renderCat(supportCat, false)}
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })()}

                            <div className="text-[10px] sm:text-xs font-black text-orange-600 uppercase mt-4 border-b border-slate-200 pb-2">พนักงานพาร์ทไทม์ (Part-Time)</div>
                            {(() => {
                                const staffCat = DUTY_CATEGORIES[activeDept].find(c => c.id.includes('STAFF'));
                                const supportCat = DUTY_CATEGORIES[activeDept].find(c => c.id.includes('SUPPORT'));

                                const renderCatPT = (cat) => {
                                    if (!cat) return null;
                                    const layerPositions = POSITIONS[activeDept].filter(p => p.includes('PT') && getStaffLayer(activeDept, p).id === cat.id);
                                    if (layerPositions.length === 0) return null;

                                    return (
                                        <div key={cat.id + '_PT'} className="flex flex-col gap-2 p-3">
                                            <div className="flex justify-between items-center">
                                                <div className={`text-[10px] font-black px-3 py-1.5 rounded uppercase w-fit ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>Part-Time {cat.id.includes('STAFF') ? 'Staff Team' : 'Support Team'}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {layerPositions.map(p => {
                                                    const count = (branchData.staff || []).filter(s => s.dept === activeDept && s.pos === p && s.isActive !== false).length;
                                                    const isSelected = staffFilterPos === p;
                                                    return (
                                                        <button key={p} onClick={() => setStaffFilterPos(isSelected ? 'ALL' : p)} className={`text-[10px] font-black border px-3 py-1.5 rounded-lg transition-all shadow-sm ${isSelected ? 'ring-2 ring-offset-2 ring-orange-500 scale-105' : 'hover:opacity-80'} ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]} ${count === 0 ? 'opacity-40' : ''}`}>
                                                            {p}: {count}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                };

                                const combinedLimitId = `${activeDept.toUpperCase()}_STAFF_SUPPORT_PT`;
                                let combinedCount = 0;
                                if (staffCat) {
                                    const layerPositions = POSITIONS[activeDept].filter(p => p.includes('PT') && getStaffLayer(activeDept, p).id === staffCat.id);
                                    combinedCount += (branchData.staff || []).filter(s => s.isActive !== false && s.dept === activeDept && layerPositions.includes(s.pos)).length;
                                }
                                if (supportCat) {
                                    const layerPositions = POSITIONS[activeDept].filter(p => p.includes('PT') && getStaffLayer(activeDept, p).id === supportCat.id);
                                    combinedCount += (branchData.staff || []).filter(s => s.isActive !== false && s.dept === activeDept && layerPositions.includes(s.pos)).length;
                                }

                                const combinedLimit = branchData.staffLimits?.[combinedLimitId];
                                const isCombinedFull = combinedLimit !== undefined && combinedLimit !== null && combinedCount >= combinedLimit;

                                return (
                                    <div className="flex flex-col gap-0 p-1 rounded-xl bg-slate-50 border border-slate-200 shadow-sm relative mt-2">
                                        <div className="flex justify-between items-center px-3 pt-3 pb-1 border-b border-slate-200/50 mx-2">
                                            <div className="text-[10px] font-black text-slate-600 uppercase">Staff &amp; Support Team (โควตาร่วม)</div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold ${isCombinedFull ? 'text-red-500' : 'text-slate-500'}`}>จำนวนรวม {combinedCount}/{combinedLimit !== undefined && combinedLimit !== null ? combinedLimit : '∞'}</span>
                                                <input
                                                    type="number" min="0" disabled={authRole !== 'superadmin'}
                                                    value={combinedLimit === undefined || combinedLimit === null ? '' : combinedLimit}
                                                    onChange={(e) => handleUpdateStaffLimit(combinedLimitId, e.target.value)}
                                                    className="w-12 text-center border rounded p-1 text-[10px] font-bold outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 bg-white"
                                                    placeholder="∞" title="ตั้งค่าจำนวนสูงสุด"
                                                />
                                            </div>
                                        </div>
                                        <div className="bg-transparent">
                                            {renderCatPT(staffCat)}
                                            {renderCatPT(supportCat)}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 mt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-widest">โควตาวันหยุด: {activeDept === 'service' ? 'ฝั่งบริการ' : 'ฝั่งครัว'}</h3>
                                <button onClick={handleAutoAssignDayOffs} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-indigo-700 transition flex items-center gap-1"><Wand2 className="w-3 h-3" /> จัดวันหยุด Auto</button>
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
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 sm:gap-4 items-stretch w-full">
                                <input type="text" placeholder="รหัสพนง." className="xl:col-span-2 w-full border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none transition shadow-sm" value={newStaffEmpId} onChange={(e) => setNewStaffEmpId(e.target.value)} />
                                <input type="text" placeholder={`ชื่อพนักงานใหม่ (${newStaffDept === 'service' ? 'บริการ' : 'ครัว'})...`} className="xl:col-span-3 w-full border-2 border-slate-100 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none transition shadow-sm" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} />
                                <div className="xl:col-span-5 flex flex-col w-full gap-2">
                                    <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4 w-full">
                                        <select value={newStaffDept} onChange={(e) => {
                                            setNewStaffDept(e.target.value);
                                            const defPos = POSITIONS[e.target.value][0];
                                            setNewStaffPos(defPos);
                                            if (defPos.includes('PT')) setNewStaffWageType('PT');
                                            else if (['DVT', 'EDC'].some(p => defPos.includes(p))) setNewStaffWageType('HOURLY');
                                            else setNewStaffWageType('MONTHLY');
                                        }} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500">
                                            <option value="service">งานบริการ</option><option value="kitchen">งานครัว</option>
                                        </select>
                                        <select value={newStaffPos} onChange={(e) => {
                                            const pos = e.target.value;
                                            setNewStaffPos(pos);
                                            if (pos.includes('PT')) setNewStaffWageType('PT');
                                            else if (['DVT', 'EDC'].some(p => pos.includes(p))) setNewStaffWageType('HOURLY');
                                            else setNewStaffWageType('MONTHLY');
                                        }} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none focus:border-indigo-500">
                                            {POSITIONS[newStaffDept].map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <DayOffSelector
                                            value={newStaffDayOff}
                                            onChange={setNewStaffDayOff}
                                            dayOffCounts={dayOffCounts[newStaffDept] || {}}
                                            limits={branchData.dayOffLimits?.[newStaffDept] || {}}
                                            isPT={newStaffPos.includes('PT') || newStaffPos.includes('EDC') || newStaffPos.includes('DVT') || newStaffWageType === 'PT'}
                                            className="flex-1 min-w-[100px]"
                                            triggerClassName={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black uppercase outline-none flex justify-between items-center cursor-pointer transition-colors ${newStaffDayOff.length > 0 ? 'text-indigo-700 border-indigo-300 bg-indigo-50/30' : 'text-slate-500 hover:border-indigo-300'}`}
                                        />
                                        <input type="date" title="วันเริ่มงาน" className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-black outline-none focus:border-indigo-500 text-slate-500" value={newStaffStartDate} onChange={(e) => setNewStaffStartDate(e.target.value)} />
                                    </div>
                                    {['superadmin', 'areamanager'].includes(authRole) && (
                                        <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4 w-full mt-0">
                                            <select value={newStaffWageType} onChange={e => setNewStaffWageType(e.target.value)} className="flex-1 bg-emerald-50 border-2 border-emerald-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-black text-emerald-700 outline-none focus:border-emerald-500">
                                                <option value="MONTHLY">ประเภท: รายเดือน (FT)</option>
                                                <option value="HOURLY">ประเภท: รายชั่วโมง (FT)</option>
                                                <option value="PT">ประเภท: พาร์ทไทม์ (PT)</option>
                                            </select>
                                            <input type="number" placeholder="ฐานเงินเดือน / ค่าแรงต่อชม. (บาท)" className="flex-1 border-2 border-emerald-100 bg-emerald-50 rounded-xl sm:rounded-2xl px-3 py-2 text-xs sm:text-sm font-bold text-emerald-700 focus:border-emerald-500 outline-none transition shadow-sm" value={newStaffBaseWage} onChange={(e) => setNewStaffBaseWage(e.target.value)} />
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => {
                                    if (newStaffName.trim()) {
                                        const layer = getStaffLayer(newStaffDept, newStaffPos);
                                        const isPT = newStaffPos.includes('PT');

                                        let limitId = isPT ? layer.id + '_PT' : layer.id;
                                        let currentCount = 0;

                                        if (!isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) {
                                            limitId = `${newStaffDept.toUpperCase()}_STAFF_SUPPORT_FT`;
                                            currentCount = (branchData.staff || []).filter(s => s.isActive !== false && s.dept === newStaffDept && !s.pos.includes('PT') && (getStaffLayer(s.dept, s.pos).id.includes('STAFF') || getStaffLayer(s.dept, s.pos).id.includes('SUPPORT'))).length;
                                        } else if (isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) {
                                            limitId = `${newStaffDept.toUpperCase()}_STAFF_SUPPORT_PT`;
                                            currentCount = (branchData.staff || []).filter(s => s.isActive !== false && s.dept === newStaffDept && s.pos.includes('PT') && (getStaffLayer(s.dept, s.pos).id.includes('STAFF') || getStaffLayer(s.dept, s.pos).id.includes('SUPPORT'))).length;
                                        } else {
                                            currentCount = (branchData.staff || []).filter(s => s.isActive !== false && s.dept === newStaffDept && getStaffLayer(s.dept, s.pos).id === layer.id && (isPT ? s.pos.includes('PT') : !s.pos.includes('PT'))).length;
                                        }

                                        const limit = branchData.staffLimits?.[limitId];
                                        if (limit !== undefined && limit !== null && currentCount >= limit) {
                                            const groupLabel = (!isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) ? 'Staff & Support' : (isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) ? 'Part-Time (Staff & Support)' : (isPT ? 'Part-Time' : layer.label);
                                            setConfirmModal({ message: `เพิ่มพนักงานไม่ได้ เนื่องจากกลุ่ม ${groupLabel} เต็มแล้ว (รับได้สูงสุด ${limit} คน)` });
                                            return;
                                        }
                                        setBranchData(p => {
                                            const nd = { ...p, staff: [...(p.staff || []), { id: 's' + Date.now(), empId: newStaffEmpId.trim(), name: newStaffName.trim(), dept: newStaffDept, pos: newStaffPos, regularDayOff: newStaffDayOff.length > 0 ? newStaffDayOff : null, startDate: newStaffStartDate || null, wageType: newStaffWageType, baseWage: newStaffBaseWage ? parseFloat(newStaffBaseWage) : 0 }] };
                                            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
                                            return nd;
                                        });
                                        setNewStaffName(''); setNewStaffEmpId(''); setNewStaffDayOff([]); setNewStaffStartDate(''); setNewStaffBaseWage('');
                                    }
                                }} className="xl:col-span-2 w-full bg-slate-900 text-white px-4 py-3 rounded-xl sm:rounded-2xl font-black text-xs hover:bg-indigo-600 transition uppercase flex items-center justify-center h-full min-h-[48px]"><UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /><span>เพิ่มพนักงาน</span></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:gap-3 w-full">
                            {branchData.staff?.filter(s => s.dept === activeDept && (staffFilterPos === 'ALL' || s.pos === staffFilterPos)).length === 0 ? (
                                <div className="text-center py-8 sm:py-10 text-slate-400 font-bold text-[10px] sm:text-sm uppercase tracking-widest border-2 border-dashed rounded-[1.5rem] sm:rounded-[2rem]">ไม่มีพนักงานในแผนก/ตำแหน่งนี้</div>
                            ) : branchData.staff?.filter(s => s.dept === activeDept && (staffFilterPos === 'ALL' || s.pos === staffFilterPos)).map(s => {
                                const layer = getStaffLayer(s.dept, s.pos);
                                return (
                                    <div key={s.id} className="flex justify-between items-center p-4 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition group shadow-sm">
                                        {editingStaffId === s.id ? (
                                            <div className="flex-1 flex gap-2 items-center flex-wrap">
                                                <input type="text" placeholder="รหัส" value={editStaffData.empId || ''} onChange={e => setEditStaffData({ ...editStaffData, empId: e.target.value })} className="border rounded px-2 py-1 text-xs w-full sm:w-16" />
                                                <input type="text" value={editStaffData.name} onChange={e => setEditStaffData({ ...editStaffData, name: e.target.value })} className="border rounded px-2 py-1 text-xs w-full sm:w-auto flex-1 min-w-[100px]" />
                                                <select value={editStaffData.pos} onChange={e => setEditStaffData({ ...editStaffData, pos: e.target.value })} className="border rounded px-2 py-1 text-[10px]">
                                                    {POSITIONS[s.dept].map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                                <input type="date" value={editStaffData.startDate || ''} onChange={e => setEditStaffData({ ...editStaffData, startDate: e.target.value })} className="border rounded px-2 py-1 text-[10px] w-24 sm:w-auto" title="วันเริ่มงาน" />
                                                <div className="flex gap-1 items-center">
                                                    <select value={editStaffData.resignDate || editStaffData.isActive === false ? 'false' : 'true'} onChange={e => {
                                                        const isResigned = e.target.value === 'false';
                                                        setEditStaffData({ ...editStaffData, isActive: !isResigned, resignDate: isResigned ? (editStaffData.resignDate || new Date().toISOString().slice(0, 10)) : null });
                                                    }} className="border rounded px-2 py-1 text-[10px]">
                                                        <option value="true">ทำงานปกติ</option>
                                                        <option value="false">ลาออก / ปิดใช้งาน</option>
                                                    </select>
                                                    {(editStaffData.resignDate || editStaffData.isActive === false) && (
                                                        <input type="date" value={editStaffData.resignDate || ''} onChange={e => setEditStaffData({ ...editStaffData, resignDate: e.target.value })} className="border rounded px-2 py-1 text-[10px] w-24 sm:w-auto" />
                                                    )}
                                                </div>
                                                <DayOffSelector
                                                    value={editStaffData.regularDayOff}
                                                    onChange={val => setEditStaffData({ ...editStaffData, regularDayOff: val })}
                                                    dayOffCounts={dayOffCounts[s.dept] || {}}
                                                    limits={branchData.dayOffLimits?.[s.dept] || {}}
                                                    isPT={editStaffData.pos.includes('PT') || editStaffData.pos.includes('EDC') || editStaffData.pos.includes('DVT') || editStaffData.wageType === 'PT'}
                                                    className="w-24 sm:w-auto min-w-[100px]"
                                                    triggerClassName="border rounded px-2 py-1 text-[10px] w-full bg-white flex justify-between items-center cursor-pointer outline-none"
                                                />
                                                {['superadmin', 'areamanager'].includes(authRole) && (
                                                    <div className="flex gap-2 items-center mt-1 w-full sm:w-auto">
                                                        <select value={editStaffData.wageType || 'MONTHLY'} onChange={e => setEditStaffData({ ...editStaffData, wageType: e.target.value })} className="border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold rounded px-2 py-1 text-[10px]">
                                                            <option value="MONTHLY">รายเดือน</option><option value="HOURLY">รายชั่วโมง</option><option value="PT">PT</option>
                                                        </select>
                                                        <input type="number" placeholder="ค่าจ้าง" value={editStaffData.baseWage || ''} onChange={e => setEditStaffData({ ...editStaffData, baseWage: parseFloat(e.target.value) || 0 })} className="border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold rounded px-2 py-1 text-[10px] w-20 sm:w-24" />
                                                    </div>
                                                )}
                                                <button onClick={() => {
                                                    const s = branchData.staff.find(x => x.id === editingStaffId);
                                                    if (editStaffData.pos !== s.pos || editStaffData.dept !== s.dept) {
                                                        const layer = getStaffLayer(editStaffData.dept, editStaffData.pos);
                                                        const isPT = editStaffData.pos.includes('PT');
                                                        let limitId = isPT ? layer.id + '_PT' : layer.id;
                                                        let currentCount = 0;

                                                        if (!isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) {
                                                            limitId = `${editStaffData.dept.toUpperCase()}_STAFF_SUPPORT_FT`;
                                                            currentCount = (branchData.staff || []).filter(x => x.id !== editingStaffId && x.isActive !== false && !x.resignDate && x.dept === editStaffData.dept && !x.pos.includes('PT') && (getStaffLayer(x.dept, x.pos).id.includes('STAFF') || getStaffLayer(x.dept, x.pos).id.includes('SUPPORT'))).length;
                                                        } else if (isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) {
                                                            limitId = `${editStaffData.dept.toUpperCase()}_STAFF_SUPPORT_PT`;
                                                            currentCount = (branchData.staff || []).filter(x => x.id !== editingStaffId && x.isActive !== false && !x.resignDate && x.dept === editStaffData.dept && x.pos.includes('PT') && (getStaffLayer(x.dept, x.pos).id.includes('STAFF') || getStaffLayer(x.dept, x.pos).id.includes('SUPPORT'))).length;
                                                        } else {
                                                            currentCount = (branchData.staff || []).filter(x => x.id !== editingStaffId && x.isActive !== false && !x.resignDate && x.dept === editStaffData.dept && getStaffLayer(x.dept, x.pos).id === layer.id && (isPT ? x.pos.includes('PT') : !x.pos.includes('PT'))).length;
                                                        }

                                                        const limit = branchData.staffLimits?.[limitId];
                                                        if (limit !== undefined && limit !== null && currentCount >= limit) {
                                                            const groupLabel = (!isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) ? 'Staff & Support' : (isPT && (layer.id.includes('STAFF') || layer.id.includes('SUPPORT'))) ? 'Part-Time (Staff & Support)' : (isPT ? 'Part-Time' : layer.label);
                                                            setConfirmModal({ message: `เปลี่ยนตำแหน่งไม่ได้ เนื่องจากกลุ่ม ${groupLabel} เต็มแล้ว (รับได้สูงสุด ${limit} คน)` });
                                                            return;
                                                        }
                                                    }
                                                    saveEditStaff();
                                                }} className="bg-green-500 text-white p-1.5 rounded"><Check className="w-3 h-3" /></button>
                                                <button onClick={() => setEditingStaffId(null)} className="bg-red-500 text-white p-1.5 rounded"><X className="w-3 h-3" /></button>
                                            </div>
                                        ) : (
                                            <React.Fragment>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <span className="text-sm sm:text-base font-black text-slate-800 uppercase truncate block">
                                                        {s.empId && <span className="text-slate-400 mr-2 text-xs">[{s.empId}]</span>} {s.name}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1 items-center">
                                                        <span className={`text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border uppercase ${layer.color.split(' ')[0]} ${layer.color.split(' ')[1]}`}>{s.pos}</span>
                                                        {(() => {
                                                            const isResigned = s.resignDate || s.isActive === false;
                                                            return <span className={`text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border uppercase ${isResigned ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{isResigned ? (s.resignDate ? `ลาออก (${s.resignDate})` : 'ลาออก/ไม่รับงาน') : 'ทำงานปกติ'}</span>;
                                                        })()}
                                                        {['superadmin', 'areamanager'].includes(authRole) && (
                                                            <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-600 uppercase">
                                                                {s.wageType === 'MONTHLY' ? 'รายเดือน' : s.wageType === 'HOURLY' ? 'รายชั่วโมง' : 'PT'} : ฿{s.baseWage?.toLocaleString() || 0}
                                                            </span>
                                                        )}
                                                        {(() => {
                                                            const daysOff = Array.isArray(s.regularDayOff) ? s.regularDayOff : (s.regularDayOff !== null && s.regularDayOff !== undefined && s.regularDayOff !== '' ? [s.regularDayOff] : []);
                                                            const dayOffLabels = daysOff.length > 0 ? daysOff.map(dId => DAYS_OF_WEEK.find(d => d.id === dId)?.label).filter(Boolean).join(', ') : '-';
                                                            return <span className="text-[7px] sm:text-[8px] font-black px-1.5 sm:px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 uppercase truncate" title={`วันเริ่มงาน: ${s.startDate || 'ไม่ระบุ'} | หยุดประจำ: ${dayOffLabels}`}>หยุด: {dayOffLabels}</span>;
                                                        })()}
                                                        <button onClick={() => startEditStaff(s)} className="text-slate-300 hover:text-indigo-500"><Edit2 className="w-3 h-3" /></button>
                                                    </div>
                                                </div>
                                                <button onClick={() => setBranchData(p => {
                                                    const nd = { ...p, staff: p.staff.filter(x => x.id !== s.id) };
                                                    if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
                                                    return nd;
                                                })} className="text-slate-300 hover:text-red-500 transition p-2"><Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                                            </React.Fragment>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {authRole === 'superadmin' && (
                        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm flex flex-col">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><List className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการหน้าที่งาน (Duties)</h2>
                            <div className="space-y-4 mb-6 sm:mb-10 w-full">
                                <div className="flex flex-col gap-2 sm:gap-4">
                                    <div className="flex flex-col xl:flex-row gap-2 sm:gap-4">
                                        <div className="flex-[2] flex flex-col shadow-sm rounded-xl border border-slate-200">
                                            {renderRichTextToolbar('new-duty-job-a', newDutyJobA, setNewDutyJobA)}
                                            <div className="flex flex-col md:flex-row border-t border-slate-200 bg-white rounded-b-xl overflow-hidden">
                                                <textarea id="new-duty-job-a" placeholder="หน้าที่หลัก (เช่น ต้อนรับหน้าร้าน)" value={newDutyJobA} onChange={e => setNewDutyJobA(e.target.value)} className="w-full md:w-1/2 p-3 text-xs sm:text-sm font-bold outline-none resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[100px]"></textarea>
                                                <div className="w-full md:w-1/2 p-3 bg-slate-50 text-xs sm:text-sm text-slate-700 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: newDutyJobA || '<span class="text-slate-400 italic">ตัวอย่าง...</span>' }}></div>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col shadow-sm rounded-xl border border-slate-200">
                                            {renderRichTextToolbar('new-duty-job-b', newDutyJobB, setNewDutyJobB)}
                                            <div className="flex flex-col md:flex-row border-t border-slate-200 bg-white rounded-b-xl overflow-hidden">
                                                <textarea id="new-duty-job-b" placeholder="หน้าที่รอง (เช่น เคลียร์โต๊ะ)" value={newDutyJobB} onChange={e => setNewDutyJobB(e.target.value)} className="w-full md:w-1/2 p-3 text-xs sm:text-sm font-bold outline-none resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[100px]"></textarea>
                                                <div className="w-full md:w-1/2 p-3 bg-slate-50 text-xs sm:text-sm text-slate-700 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: newDutyJobB || '<span class="text-slate-400 italic">ตัวอย่าง...</span>' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col xl:flex-row gap-2 sm:gap-4 items-stretch">
                                        <input type="text" placeholder="XP-DNA SOP" className="flex-[2] border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none" value={newDutyXpDna} onChange={e => setNewDutyXpDna(e.target.value)} />
                                        <select value={newDutyCategory} onChange={e => setNewDutyCategory(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold focus:border-indigo-500 outline-none">
                                            {DUTY_CATEGORIES[activeDept]?.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                        </select>
                                        <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 cursor-pointer select-none whitespace-nowrap transition hover:border-indigo-200">
                                            <input type="checkbox" checked={newDutyIsBackup} onChange={e => setNewDutyIsBackup(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                            กะสำรอง
                                        </label>
                                        <PositionSelector disabled={false} value={newDutyReqPos} options={POSITIONS[activeDept]} onChange={setNewDutyReqPos} className="w-full xl:min-w-[80px]" />
                                        <button onClick={handleAddDuty} className="w-full xl:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-indigo-600 transition flex items-center justify-center h-full min-h-[48px] self-stretch"><Plus className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:gap-3 w-full">
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
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <div className="flex-1 flex flex-col shadow-sm rounded-xl border border-slate-200">
                                                            {renderRichTextToolbar(`edit-duty-job-a-${duty.id}`, editDutyData.jobA || '', (val) => setEditDutyData({ ...editDutyData, jobA: val }))}
                                                            <div className="flex flex-col md:flex-row border-t border-slate-200 bg-white rounded-b-xl overflow-hidden">
                                                                <textarea id={`edit-duty-job-a-${duty.id}`} value={editDutyData.jobA || ''} onChange={e => setEditDutyData({ ...editDutyData, jobA: e.target.value })} className="w-full md:w-1/2 p-3 text-[10px] sm:text-xs font-bold outline-none resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[100px]"></textarea>
                                                                <div className="w-full md:w-1/2 p-3 bg-slate-50 text-[10px] sm:text-xs text-slate-700 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: editDutyData.jobA || '<span class="text-slate-400 italic">ตัวอย่าง...</span>' }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 flex flex-col shadow-sm rounded-xl border border-slate-200">
                                                            {renderRichTextToolbar(`edit-duty-job-b-${duty.id}`, editDutyData.jobB || '', (val) => setEditDutyData({ ...editDutyData, jobB: val }))}
                                                            <div className="flex flex-col md:flex-row border-t border-slate-200 bg-white rounded-b-xl overflow-hidden">
                                                                <textarea id={`edit-duty-job-b-${duty.id}`} value={editDutyData.jobB || ''} onChange={e => setEditDutyData({ ...editDutyData, jobB: e.target.value })} className="w-full md:w-1/2 p-3 text-[10px] sm:text-xs font-bold outline-none resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[100px]"></textarea>
                                                                <div className="w-full md:w-1/2 p-3 bg-slate-50 text-[10px] sm:text-xs text-slate-700 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: editDutyData.jobB || '<span class="text-slate-400 italic">ตัวอย่าง...</span>' }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col shadow-sm rounded-xl border border-slate-200 w-full mt-1">
                                                        {renderRichTextToolbar(`edit-duty-xp-dna-${duty.id}`, editDutyData.xpDna || '', (val) => setEditDutyData({ ...editDutyData, xpDna: val }))}
                                                        <div className="flex flex-col md:flex-row border-t border-slate-200 bg-white rounded-b-xl overflow-hidden min-h-[100px]">
                                                            <textarea id={`edit-duty-xp-dna-${duty.id}`} placeholder="XP-DNA SOP... (รองรับ HTML)" value={editDutyData.xpDna || ''} onChange={e => setEditDutyData({ ...editDutyData, xpDna: e.target.value })} className="w-full md:w-1/2 p-3 text-[10px] sm:text-xs font-medium outline-none focus:border-indigo-500 resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[100px]"></textarea>
                                                            <div className="w-full md:w-1/2 p-3 bg-slate-50 text-[10px] sm:text-xs text-slate-600 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: editDutyData.xpDna || '<span class="text-slate-400 italic font-bold">แสดงผลตัวอย่าง (Preview)...</span>' }}></div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col bg-amber-50/50 p-3 rounded-xl border border-amber-100 gap-2 w-full mt-2">
                                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">🎯 สูตรเป้าหมายการเตรียมของ (Prep Goals)</span>
                                                        <div className="flex gap-2">
                                                            <input type="text" placeholder="ชื่อวัตถุดิบ/งาน" value={editPrepName} onChange={e => setEditPrepName(e.target.value)} className="flex-[2] border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500" />
                                                            <select value={editPrepMode} onChange={e => setEditPrepMode(e.target.value)} className="flex-[1] border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500 bg-white">
                                                                <option value="TC">อิง TC</option>
                                                                <option value="TABLE">อิงโต๊ะ</option>
                                                                <option value="STATIC">คงที่</option>
                                                            </select>
                                                            <input type="number" placeholder={editPrepMode === 'TC' ? "ปริมาณ/TC" : editPrepMode === 'TABLE' ? "ปริมาณ/โต๊ะ" : "ปริมาณ"} value={editPrepMultiplier} onChange={e => setEditPrepMultiplier(e.target.value)} className="flex-[1.5] border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500" />
                                                            <input type="text" placeholder="หน่วย" value={editPrepUnit} onChange={e => setEditPrepUnit(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500" />
                                                            <select value={editPrepTarget} onChange={e => setEditPrepTarget(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-500 bg-white">
                                                                <option value="ALL">ทุกกะ</option>
                                                                {(() => {
                                                                    const names = new Set();
                                                                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(dt => {
                                                                        const pg = branchData.matrix?.[dt]?.prepGoals;
                                                                        if (Array.isArray(pg)) pg.forEach(g => names.add(g.name));
                                                                        else { names.add('กะเช้า'); names.add('กะบ่าย'); }
                                                                    });
                                                                    return Array.from(names).map(name => <option key={name} value={name}>{name}</option>);
                                                                })()}
                                                            </select>
                                                            <button onClick={() => {
                                                                if (!editPrepName.trim() || !editPrepMultiplier) return;
                                                                const newPrepData = { name: editPrepName.trim(), multiplier: parseFloat(editPrepMultiplier) || 0, unit: editPrepUnit, target: editPrepTarget, mode: editPrepMode };
                                                                if (editingPrepItemId) {
                                                                    setEditDutyData(prev => ({ ...prev, prepItems: prev.prepItems.map(p => p.id === editingPrepItemId ? { ...p, ...newPrepData } : p) }));
                                                                } else {
                                                                    setEditDutyData(prev => ({ ...prev, prepItems: [...(prev.prepItems || []), { id: 'P' + Date.now(), ...newPrepData }] }));
                                                                }
                                                                setEditingPrepItemId(null); setEditPrepName(''); setEditPrepMultiplier(''); setEditPrepUnit('กก.'); setEditPrepTarget('ALL'); setEditPrepMode('TC');
                                                            }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm transition text-white ${editingPrepItemId ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                                                                {editingPrepItemId ? 'บันทึก' : 'เพิ่ม'}
                                                            </button>
                                                            {editingPrepItemId && (
                                                                <button onClick={() => { setEditingPrepItemId(null); setEditPrepName(''); setEditPrepMultiplier(''); setEditPrepUnit('กก.'); setEditPrepTarget('ALL'); setEditPrepMode('TC'); }} className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-2 rounded-lg text-[10px] font-black shadow-sm transition"><X className="w-3 h-3" /></button>
                                                            )}
                                                        </div>
                                                        {(editDutyData.prepItems || []).length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {(editDutyData.prepItems || []).map(p => {
                                                                    let targetName = 'ทุกกะ';
                                                                    if (p.target && p.target !== 'ALL') {
                                                                        targetName = p.target;
                                                                    }
                                                                    let modeText = p.mode === 'TABLE' ? '/โต๊ะ' : p.mode === 'STATIC' ? '' : '/TC';
                                                                    return (
                                                                        <div key={p.id} className={`bg-white text-amber-700 px-2 py-1 rounded border text-[9px] font-black flex items-center gap-1.5 shadow-sm transition-colors ${editingPrepItemId === p.id ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-amber-200'}`}>
                                                                            <span>{p.name} : {p.multiplier} {p.unit}{modeText} {p.target && p.target !== 'ALL' ? `(${targetName})` : ''}</span>
                                                                            <div className="flex items-center gap-0.5 ml-1">
                                                                                <button onClick={() => {
                                                                                    if (editingPrepItemId === p.id) {
                                                                                        setEditingPrepItemId(null); setEditPrepName(''); setEditPrepMultiplier(''); setEditPrepUnit('กก.'); setEditPrepTarget('ALL'); setEditPrepMode('TC');
                                                                                    } else {
                                                                                        setEditingPrepItemId(p.id);
                                                                                        setEditPrepName(p.name);
                                                                                        setEditPrepMultiplier(p.multiplier);
                                                                                        setEditPrepUnit(p.unit);
                                                                                        setEditPrepTarget(p.target || 'ALL');
                                                                                        setEditPrepMode(p.mode || 'TC');
                                                                                    }
                                                                                }} className="text-amber-500 hover:text-indigo-500">
                                                                                    {editingPrepItemId === p.id ? <X className="w-3 h-3 text-red-500" /> : <Edit2 className="w-3 h-3" />}
                                                                                </button>
                                                                                <button onClick={() => {
                                                                                    setConfirmModal({
                                                                                        message: `คุณต้องการลบรายการ "${p.name}" ใช่หรือไม่?`, action: () => {
                                                                                            setEditDutyData(prev => ({ ...prev, prepItems: prev.prepItems.filter(x => x.id !== p.id) }));
                                                                                        }
                                                                                    });
                                                                                }} className="text-amber-500 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 items-center flex-wrap mt-1">
                                                        <select value={editDutyData.category} onChange={e => setEditDutyData({ ...editDutyData, category: e.target.value })} className="border rounded px-2 py-2 text-[10px] sm:text-xs font-bold outline-none focus:border-indigo-500 flex-1 min-w-[120px]">
                                                            {DUTY_CATEGORIES[activeDept]?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                        </select>
                                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-white border rounded px-3 py-2 cursor-pointer select-none whitespace-nowrap justify-center flex-1 min-w-[100px]">
                                                            <input type="checkbox" checked={editDutyData.isBackup || false} onChange={e => setEditDutyData({ ...editDutyData, isBackup: e.target.checked })} className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                                            กะสำรอง
                                                        </label>
                                                        <PositionSelector disabled={false} value={editDutyData.reqPos || ['ALL']} options={POSITIONS[activeDept]} onChange={(val) => setEditDutyData({ ...editDutyData, reqPos: val })} className="w-full sm:w-auto min-w-[120px] flex-1" />
                                                        <button onClick={handleEditDutySave} className="bg-green-500 text-white p-2 rounded-lg ml-auto shadow-sm"><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingDutyId(null)} className="bg-red-500 text-white p-2 rounded-lg shadow-sm"><X className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <React.Fragment>
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-black text-xs sm:text-sm text-slate-800 truncate" dangerouslySetInnerHTML={{ __html: duty.jobA }}></div>
                                                            {duty.isBackup && <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">กะสำรอง</span>}
                                                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate max-w-[80px] sm:max-w-[120px]" title={(duty.reqPos || ['ALL']).join(', ')}>{(duty.reqPos || ['ALL']).join(', ')}</span>
                                                        </div>
                                                        <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate mt-0.5 flex items-center gap-2">
                                                            {catInfo && <div className={`w-2 h-2 rounded-full ${catInfo.color.split(' ')[0]}`} title={catInfo.label}></div>}
                                                            <div dangerouslySetInnerHTML={{ __html: duty.jobB }}></div>
                                                            {duty.xpDna && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">XP-DNA</span>}
                                                        </div>
                                                        {(duty.prepItems || []).length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {duty.prepItems.map(p => {
                                                                    let targetName = '';
                                                                    if (p.target && p.target !== 'ALL') {
                                                                        targetName = ` [เฉพาะ ${p.target === 'prep_1' ? 'กะเช้า' : p.target === 'prep_2' ? 'กะบ่าย' : p.target}]`;
                                                                    }
                                                                    let modeText = p.mode === 'TABLE' ? '/โต๊ะ' : p.mode === 'STATIC' ? '' : '/TC';
                                                                    return <span key={p.id} className="text-[7px] sm:text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 border border-amber-200 rounded font-black shadow-sm">{p.name} ({p.multiplier}{p.unit}{modeText}){targetName}</span>
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {authRole === 'superadmin' && (
                                                        <div className="flex gap-1 sm:gap-2">
                                                            <button onClick={() => { setEditingDutyId(duty.id); setEditDutyData(duty); }} className="text-slate-300 hover:text-indigo-500 p-2"><Edit2 className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDeleteDuty(duty.id)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            )}
                                        </div>
                                    )
                                })}
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
                                    const holidayInfo = (branchData.holidays || []).find(h => (typeof h === 'object' ? h.date : h) === d.dateStr);
                                    const isHoliday = !!holidayInfo;
                                    const isPublicHoliday = holidayInfo?.isPublic;
                                    return (
                                        <button
                                            key={d.dateStr} disabled={authRole === 'branch'} onClick={() => {
                                                if (authRole === 'superadmin') {
                                                    if (isHoliday) {
                                                        setBranchData(p => {
                                                            const nd = { ...p, holidays: (p.holidays || []).filter(h => (typeof h === 'object' ? h.date : h) !== d.dateStr) };
                                                            if (nd.holidayCycles) {
                                                                const newHc = { ...nd.holidayCycles };
                                                                delete newHc[d.dateStr];
                                                                nd.holidayCycles = newHc;
                                                            }
                                                            if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
                                                            return nd;
                                                        });
                                                    } else {
                                                        const choice = window.prompt("วันหยุดนี้ต้องการให้ใช้กะแบบไหน?\n[ 1 ] = วันเสาร์ (ปิดดึก)\n[ 2 ] = วันอาทิตย์ (ปิดปกติ)", "1");
                                                        if (choice === "1" || choice === "2") {
                                                            const holidayName = window.prompt(`กรอกชื่อวันหยุดสำหรับวันที่ ${d.dateStr}:`, 'วันหยุดนักขัตฤกษ์');
                                                            if (holidayName !== null) {
                                                                const isPublic = window.confirm('เป็นวันหยุดนักขัตฤกษ์ (จ่าย 2 แรง) หรือไม่?');
                                                                setBranchData(p => {
                                                                    const hc = { ...(p.holidayCycles || {}) };
                                                                    hc[d.dateStr] = choice === "1" ? 'saturday' : 'sunday';
                                                                    const newHoliday = { date: d.dateStr, name: holidayName || 'วันหยุด', isPublic };
                                                                    const nd = { ...p, holidays: [...(p.holidays || []), newHoliday], holidayCycles: hc };
                                                                    if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
                                                                    return nd;
                                                                });
                                                            }
                                                        }
                                                    }
                                                }
                                            }}
                                            className={`w-full aspect-square rounded-[0.8rem] sm:rounded-[1.5rem] text-[10px] sm:text-[12px] font-black transition-all border-2 flex flex-col items-center justify-center relative ${isHoliday ? 'bg-red-500 text-white border-red-600 shadow-lg sm:shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'} ${authRole === 'branch' ? 'cursor-not-allowed opacity-80' : ''}`}
                                            title={holidayInfo?.name || ''}
                                        >
                                            <span>{d.dayNum}</span>
                                            {isHoliday && <span className="text-[8px] opacity-80 leading-none mt-0.5">{branchData.holidayCycles?.[d.dateStr] === 'sunday' ? '(อา.)' : '(ส.)'}</span>}
                                            {isPublicHoliday && <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-300 rounded-full" title="วันหยุดนักขัตฤกษ์"></span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full mt-6 sm:mt-10 lg:mt-0">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><Megaphone className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500" /> จัดการหน้าประกาศ (Landing Pages)</h2>
                            <div className="flex flex-col lg:flex-row gap-6">
                                <div className="flex-[2] space-y-4 w-full">
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
                                                                🗓️ {a.startDate ? new Date(a.startDate).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) : 'เริ่มต้น'} - {a.endDate ? new Date(a.endDate).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) : 'ไม่มีกำหนด'}
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
                                                    <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-red-500 hover:text-red-700 text-[10px] font-black uppercase flex items-center gap-1"><Trash2 className="w-3 h-3" /> ลบ</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!(branchData.announcements?.length > 0) && <div className="text-center py-10 text-slate-400 font-bold text-xs border-2 border-dashed border-slate-200 rounded-2xl">ยังไม่มีประกาศ/หน้า Landing Page</div>}
                                </div>
                                <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-200 h-fit space-y-4">
                                    <h3 className="font-black text-slate-700 text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" /> เพิ่มหน้าประกาศใหม่</h3>
                                    <input type="text" placeholder="ชื่อ Content (สำหรับดูหลังบ้าน)" value={newAnnTitle} onChange={e => setNewAnnTitle(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                    <div className="flex flex-col shadow-sm rounded-xl">
                                        {renderRichTextToolbar('branch-ann-editor', newAnnContent, setNewAnnContent)}
                                        <div className="flex flex-col md:flex-row border border-slate-200 border-t-0 rounded-b-xl overflow-hidden min-h-[150px]">
                                            <textarea id="branch-ann-editor" placeholder="พิมพ์เนื้อหารายละเอียดที่นี่... (รองรับ HTML หรือกดปุ่มด้านบน)" value={newAnnContent} onChange={e => setNewAnnContent(e.target.value)} className="w-full md:w-1/2 p-3 text-xs font-medium outline-none focus:border-indigo-500 resize-y border-b md:border-b-0 md:border-r border-slate-200 min-h-[150px]"></textarea>
                                            <div className="w-full md:w-1/2 p-3 bg-slate-50 text-xs text-slate-600 overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: newAnnContent || '<span class="text-slate-400 italic font-bold">แสดงผลตัวอย่าง (Preview)...</span>' }}></div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <span className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-1 block">เริ่มแสดง (Start)</span>
                                            <input type="date" value={newAnnStartDate} onChange={e => setNewAnnStartDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[9px] font-black text-slate-500 uppercase ml-1 mb-1 block">สิ้นสุด (End)</span>
                                            <input type="date" value={newAnnEndDate} onChange={e => setNewAnnEndDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <input type="text" placeholder="URL รูปภาพ (ถ้ามี)" value={newAnnImage} onChange={e => setNewAnnImage(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                        <p className="text-[9px] text-slate-400 font-bold mt-1.5 ml-1">* แนะนำรูปภาพขนาด 1280 x 720 px (สัดส่วน 16:9)</p>
                                    </div>
                                    <button onClick={handleAddAnnouncement} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs hover:bg-indigo-700 transition shadow-sm">บันทึกประกาศ</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-200 shadow-sm w-full mt-6 sm:mt-10 print:hidden">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-2 sm:gap-4 uppercase tracking-tighter"><TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" /> ข้อมูลสาขาและงบประมาณ (Branch Configs)</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">จำนวนโต๊ะ (Total Tables)</label>
                                    <input type="number" inputMode="numeric" disabled={authRole !== 'superadmin'} value={branchData.totalTables || ''} onChange={(e) => setBranchData(prev => ({ ...prev, totalTables: parseInt(e.target.value) || 0 }))} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" placeholder="เช่น 30" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">งบ PT บริการ รายเดือน (บาท) (FOH)</label>
                                    <input type="text" inputMode="numeric" disabled={authRole !== 'superadmin'} value={branchData.ptConfig?.monthlyBudgetService === 0 ? '' : (branchData.ptConfig?.monthlyBudgetService ?? '')} onChange={(e) => handleUpdatePtConfig('monthlyBudgetService', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={(e) => handleSavePtConfig('monthlyBudgetService', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-indigo-700 disabled:opacity-70 disabled:bg-white" placeholder="เช่น 10000" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">งบ PT ครัว รายเดือน (บาท) (BOH)</label>
                                    <input type="text" inputMode="numeric" disabled={authRole !== 'superadmin'} value={branchData.ptConfig?.monthlyBudgetKitchen === 0 ? '' : (branchData.ptConfig?.monthlyBudgetKitchen ?? '')} onChange={(e) => handleUpdatePtConfig('monthlyBudgetKitchen', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={(e) => handleSavePtConfig('monthlyBudgetKitchen', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-indigo-700 disabled:opacity-70 disabled:bg-white" placeholder="เช่น 10000" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">อัตราค่าจ้าง PT ต่อชม. (บาท)</label>
                                    <input type="text" inputMode="numeric" disabled={authRole !== 'superadmin'} value={branchData.ptConfig?.hourlyRate === 0 ? '' : (branchData.ptConfig?.hourlyRate ?? '')} onChange={(e) => handleUpdatePtConfig('hourlyRate', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={(e) => handleSavePtConfig('hourlyRate', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-emerald-600 disabled:opacity-70 disabled:bg-white" placeholder="เช่น 50" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">อัตราทดแทน (บริการ) ชม./คน/วัน</label>
                                    <input type="text" inputMode="numeric" disabled={authRole !== 'superadmin'} value={branchData.ptConfig?.compHoursPerDayService === 0 ? '' : (branchData.ptConfig?.compHoursPerDayService ?? 8)} onChange={(e) => handleUpdatePtConfig('compHoursPerDayService', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={(e) => handleSavePtConfig('compHoursPerDayService', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-sky-600 disabled:opacity-70 disabled:bg-white" placeholder="ค่าเริ่มต้น 8" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">อัตราทดแทน (ครัว) ชม./คน/วัน</label>
                                    <input type="text" inputMode="numeric" disabled={authRole !== 'superadmin'} value={branchData.ptConfig?.compHoursPerDayKitchen === 0 ? '' : (branchData.ptConfig?.compHoursPerDayKitchen ?? 8)} onChange={(e) => handleUpdatePtConfig('compHoursPerDayKitchen', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={(e) => handleSavePtConfig('compHoursPerDayKitchen', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-orange-600 disabled:opacity-70 disabled:bg-white" placeholder="ค่าเริ่มต้น 8" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">โควตา OT รายเดือน (FT) (ชม.)</label>
                                    <input type="text" disabled value={otLedger.budgetHours.toFixed(1)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none bg-slate-100 text-rose-600" />
                                    <span className="absolute top-4 right-4 text-[8px] font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest">Auto from CYCLE</span>
                                </div>
                            </div>

                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-4 border-b border-slate-100 pb-2">ตั้งค่าสูตรคำนวณค่าจ้างและ OT (Payroll Rules) - สิทธิ์เฉพาะ Superadmin</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">ตัวหารเงินเดือน (วัน)</label>
                                    <input type="number" step="1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.monthlySalaryDivider ?? 30} onChange={(e) => handleUpdatePayrollConfig('monthlySalaryDivider', e.target.value)} onBlur={(e) => handleSavePayrollConfig('monthlySalaryDivider', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">OT FT พนักงานรายเดือน (เท่า)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.otRateMonthly ?? 1.5} onChange={(e) => handleUpdatePayrollConfig('otRateMonthly', e.target.value)} onBlur={(e) => handleSavePayrollConfig('otRateMonthly', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">OT FTรายเดือน (วันหยุดนักขัตฯ) (เท่า)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.otRateHolidayMonthly ?? 3.0} onChange={(e) => handleUpdatePayrollConfig('otRateHolidayMonthly', e.target.value)} onBlur={(e) => handleSavePayrollConfig('otRateHolidayMonthly', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">OT พนักงาน EDC/DVT (เท่า)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.otRateFtHourly ?? 1.5} onChange={(e) => handleUpdatePayrollConfig('otRateFtHourly', e.target.value)} onBlur={(e) => handleSavePayrollConfig('otRateFtHourly', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">OT พนักงาน Part-Time (เท่า)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.otRatePt ?? 1.5} onChange={(e) => handleUpdatePayrollConfig('otRatePt', e.target.value)} onBlur={(e) => handleSavePayrollConfig('otRatePt', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">วันหยุดนักขัต: FT รายเดือนได้เพิ่ม (แรง)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.holidayMultiplierMonthly ?? 1.0} onChange={(e) => handleUpdatePayrollConfig('holidayMultiplierMonthly', e.target.value)} onBlur={(e) => handleSavePayrollConfig('holidayMultiplierMonthly', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" title="1.0 หมายถึงได้เพิ่มอีก 1 แรง (รวมกับที่ได้ในเงินเดือนแล้ว)" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">วันหยุดนักขัต: EDC DVT ได้ (แรง)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.holidayMultiplierFtHourly ?? 2.0} onChange={(e) => handleUpdatePayrollConfig('holidayMultiplierFtHourly', e.target.value)} onBlur={(e) => handleSavePayrollConfig('holidayMultiplierFtHourly', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" title="2.0 หมายถึงได้ค่าแรง 2 เท่าจากปกติ" />
                                </div>
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">วันหยุดนักขัต: Part-Time ได้ (แรง)</label>
                                    <input type="number" step="0.1" disabled={authRole !== 'superadmin'} value={branchData.payrollConfig?.holidayMultiplierPt ?? 2.0} onChange={(e) => handleUpdatePayrollConfig('holidayMultiplierPt', e.target.value)} onBlur={(e) => handleSavePayrollConfig('holidayMultiplierPt', e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800 disabled:opacity-70 disabled:bg-white" title="2.0 หมายถึงได้ค่าแรง 2 เท่าจากปกติ" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-4">* ระบบจะนำยอดเงินมาหารเป็นชั่วโมงโควตาตั้งต้น สำหรับบริหารจัดการ Part-Time ในกระเป๋าชั่วโมง (PT Ledger)</p>

                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-4 border-b border-slate-100 pb-2">ตั้งค่าฐานยอดขาย (Base TC) สำหรับระบบ Forecast (อัตราส่วน Man-Hour)</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                    const dayLabels = {
                                        monday: 'วันจันทร์',
                                        tuesday: 'วันอังคาร',
                                        wednesday: 'วันพุธ',
                                        thursday: 'วันพฤหัสบดี',
                                        friday: 'วันศุกร์',
                                        saturday: 'วันเสาร์',
                                        sunday: 'วันอาทิตย์'
                                    };
                                    return (
                                        <div key={day} className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Base TC ({dayLabels[day]})</label>
                                            <input type="text" disabled value={Object.values(branchData.matrix?.[day]?.hourlyTc || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none bg-slate-100 text-slate-500" />
                                            <span className="absolute top-4 right-4 text-[8px] font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded uppercase tracking-widest">Auto</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {renderTemplatesCard()}
                    </div>
                )}

                {authRole === 'superadmin' && renderShiftPresetManager()}

                {authRole === 'superadmin' && renderShiftThresholdSettings()}

                {authRole === 'superadmin' && renderMatrixSettings()}

                {['superadmin', 'areamanager', 'branch'].includes(authRole) && renderRosterStyleSettings()}

            </div>
        );
    }

    function renderManagerDailyCards() {
        let activeDayEmptySlots = 0;
        if (activeDay && branchData.matrix) {
            CURRENT_DUTY_LIST.forEach(duty => {
                if (duty.isBackup) return; // ไม่นำกะสำรองมานับรวมในกะที่ยังว่าง
                const slots = branchData.matrix[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                slots.forEach((_, idx) => {
                    if (!assigned[idx] || !assigned[idx].staffId) {
                        activeDayEmptySlots++;
                    }
                });
            });
        }

        return (
            <div className="w-full animate-in slide-in-from-bottom-6 duration-500">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10 print:hidden w-full mb-6">
                    <div className="relative flex items-center gap-2 sm:gap-4 w-full xl:flex-1 min-w-0">
                        <button onClick={() => scrollDates('left')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronLeft className="w-5 h-5 sm:w-8 sm:h-8" /></button>
                        <div ref={dateBarRef} className="flex-1 flex gap-3 sm:gap-5 overflow-x-auto pb-4 sm:pb-6 pt-2 sm:pt-3 custom-scrollbar px-2 sm:px-3 select-none touch-pan-x snap-x">
                            {CALENDAR_DAYS.map(d => {
                                const isSelected = selectedDateStr === d.dateStr;
                                const isHoliday = isDateHoliday(d.dateStr, branchData.holidays);
                                return (
                                    <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 sm:w-24 sm:h-28 rounded-[1.5rem] sm:rounded-[2.2rem] flex flex-col items-center justify-center transition-all border-2 snap-center ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl sm:shadow-2xl scale-105 z-20 ring-4 sm:ring-8 ring-indigo-50' : isHoliday ? 'bg-red-500 text-white border-red-600 shadow-sm sm:shadow-md' : d.type === 'saturday' ? 'bg-purple-500 text-white border-purple-600 shadow-sm sm:shadow-md' : d.type === 'sunday' ? 'bg-orange-500 text-white border-orange-600 shadow-sm sm:shadow-md' : d.type === 'friday' ? 'bg-sky-500 text-white border-sky-600 shadow-sm sm:shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400 shadow-sm'}`}>
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
                        <button onClick={() => { setForecastTc(''); setForecastReason(''); setForecastEvidence(''); setPtRequestMode('EVENT'); setShowForecastModal(true); }} className="flex-1 xl:flex-none bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all text-[10px] sm:text-sm"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">ขอจัดกะพิเศษกรณีมีอีเว้นพิเศษ</span><span className="sm:hidden">กะพิเศษ</span></button>
                        <button onClick={() => setShowHistoryModal(true)} className="flex-1 xl:flex-none bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all text-[10px] sm:text-sm">
                            <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" /> ประวัติ
                        </button>
                        <button onClick={() => requestAutoAssign('daily')} disabled={aiLoading} className="flex-1 xl:flex-none bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 sm:gap-3 hover:bg-black shadow-xl active:scale-95 transition-all text-[10px] sm:text-sm">{aiLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-indigo-400" /> : <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />} จัดกะอัตโนมัติ</button>
                        {scheduleHistory && (
                            <button onClick={handleUndoSchedule} disabled={aiLoading} className="flex-1 xl:flex-none bg-indigo-100 text-indigo-600 hover:bg-indigo-200 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all text-[10px] sm:text-sm">
                                <Undo2 className="w-4 h-4 sm:w-5 sm:h-5" /> Undo
                            </button>
                        )}
                        <button onClick={() => setConfirmModal({ message: 'ยืนยันการล้างข้อมูลกะงานของ "วันนี้" ใช่หรือไม่?', action: () => handleClearSchedule('daily') })} className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center shadow-sm active:scale-95 transition-all"><Eraser className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10 relative overflow-hidden print:hidden w-full mb-6">
                    <div className="absolute top-0 left-0 w-2 sm:w-4 h-full bg-indigo-600"></div>
                    <div className="flex-1">
                        <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-tight sm:leading-none mb-3 sm:mb-5">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}</h2>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl shadow-lg"><Store className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" /> <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest sm:tracking-[0.1em] truncate max-w-[150px] sm:max-w-none">{globalConfig.branches?.find(b => b.id === activeBranchId)?.name}</span></div>
                            <span className={`text-[9px] sm:text-[11px] font-black px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border-2 uppercase tracking-widest shadow-sm ${['monday', 'tuesday', 'wednesday', 'thursday', 'weekday'].includes(activeDay.type) ? 'bg-slate-100 text-slate-700 border-slate-200' : activeDay.type === 'friday' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{branchData.matrix?.[activeDay.type]?.name || activeDay.type.toUpperCase()}</span>
                        </div>
                    </div>

                    {(() => {
                        const hourlyTcData = branchData.matrix?.[activeDay.type]?.hourlyTc || {};
                        let prepGoals = branchData.matrix?.[activeDay.type]?.prepGoals;
                        if (!prepGoals) {
                            prepGoals = [
                                { id: 'prep_1', name: 'กะเช้า', start: '09', end: '12' },
                                { id: 'prep_2', name: 'กะบ่าย', start: '13', end: '22' }
                            ];
                        } else if (!Array.isArray(prepGoals)) {
                            prepGoals = [
                                { id: 'prep_1', name: 'กะเช้า', start: prepGoals.morning?.start || '09', end: prepGoals.morning?.end || '12' },
                                { id: 'prep_2', name: 'กะบ่าย', start: prepGoals.afternoon?.start || '13', end: prepGoals.afternoon?.end || '22' }
                            ];
                        }
                        const getHoursInRange = (start, end) => {
                            const hours = [];
                            let s = parseInt(start); let e = parseInt(end);
                            if (e < s) e += 24;
                            for (let i = s; i <= e; i++) { hours.push(String(i % 24).padStart(2, '0')); }
                            return hours;
                        };

                        const goalsData = prepGoals.map(goal => {
                            let tc = 0;
                            getHoursInRange(goal.start, goal.end).forEach(h => tc += parseInt(hourlyTcData[h]) || 0);
                            return { ...goal, tc };
                        });

                        const colors = [
                            { bg: 'bg-amber-50', border: 'border-amber-200', text1: 'text-amber-500', text2: 'text-amber-700' },
                            { bg: 'bg-indigo-50', border: 'border-indigo-200', text1: 'text-indigo-500', text2: 'text-indigo-700' },
                            { bg: 'bg-emerald-50', border: 'border-emerald-200', text1: 'text-emerald-500', text2: 'text-emerald-700' },
                            { bg: 'bg-rose-50', border: 'border-rose-200', text1: 'text-rose-500', text2: 'text-rose-700' },
                            { bg: 'bg-sky-50', border: 'border-sky-200', text1: 'text-sky-500', text2: 'text-sky-700' },
                        ];

                        return (
                            <div className="flex flex-wrap gap-2 sm:gap-4 w-full xl:w-auto mt-4 xl:mt-0">
                                {goalsData.map((g, i) => {
                                    const c = colors[i % colors.length];
                                    return (
                                        <div key={g.id} className={`${c.bg} border ${c.border} p-3 sm:p-4 rounded-[1.5rem] flex-1 flex flex-col justify-center items-center xl:items-start text-center xl:text-left min-w-[120px]`}>
                                            <span className={`text-[9px] sm:text-[10px] font-black ${c.text1} uppercase tracking-widest`}>เตรียม{g.name} ({g.start}-{parseInt(g.end) + 1})</span>
                                            <span className={`text-xl sm:text-2xl font-black ${c.text2} mt-1`}>{g.tc} <span className={`text-[10px] sm:text-xs ${c.text1}`}>TC</span></span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>

                <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] border-2 border-dashed border-slate-200 p-6 sm:p-12 shadow-sm print:hidden w-full mb-6">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3 sm:gap-5 mb-6 sm:mb-10 uppercase tracking-tighter text-indigo-600"><PlaneTakeoff className="w-6 h-6 sm:w-8 sm:h-8" /> บันทึกการลาหยุดงานวันนี้ </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
                        {LEAVE_TYPES.map(lt => {
                            const selectedStaffIds = (schedule[selectedDateStr]?.leaves || []).filter(l => l.type === lt.id).map(l => l.staffId);
                            const staffOptions = branchData.staff?.filter(s => {
                                if (s.dept !== activeDept) return false;
                                if (!isStaffActiveOnDate(s, selectedDateStr)) return false;
                                if (s.pos.includes('PT') && !['OFF', 'SWAP_OFF', 'SL_UNPAID', 'PL_UNPAID'].includes(lt.id)) return false;
                                return !(usedStaffIds.includes(s.id) && !selectedStaffIds.includes(s.id));
                            }) || [];
                            const isHoliday = isDateHoliday(selectedDateStr, branchData.holidays);
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 print:hidden w-full mb-6">
                    <div className="bg-amber-50 rounded-[2rem] sm:rounded-[3.5rem] border border-amber-200 p-6 sm:p-8 shadow-sm flex flex-col">
                        <h3 className="text-lg sm:text-xl font-black text-amber-700 flex items-center gap-2 sm:gap-4 mb-4 uppercase tracking-tighter"><UserCircle className="w-5 h-5 sm:w-6 sm:h-6" /> พนักงานที่รอจัดกะ / ว่างงาน ({unassignedStaffDaily.length} คน)</h3>
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

                    <div className={`rounded-[2rem] sm:rounded-[3.5rem] border p-6 sm:p-8 shadow-sm flex flex-col ${activeDayEmptySlots > 0 ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-emerald-50 border-emerald-200'}`}>
                        <h3 className={`text-lg sm:text-xl font-black flex items-center gap-2 sm:gap-4 mb-4 uppercase tracking-tighter ${activeDayEmptySlots > 0 ? 'text-rose-700' : 'text-emerald-700'}`}><AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" /> กะงานที่ยังว่างวันนี้ ({activeDayEmptySlots} ตำแหน่ง)</h3>
                        {activeDayEmptySlots === 0 ? (
                            <span className="text-xs sm:text-sm font-bold text-emerald-600/80">จัดพนักงานลงกะครบทุกตำแหน่งแล้ว 🎉</span>
                        ) : (
                            <span className="text-xs sm:text-sm font-bold text-rose-500">ยังมีกะว่าง กรุณาจัดพนักงานลงกะให้ครบถ้วน</span>
                        )}
                    </div>
                </div>

                <div className="space-y-10 w-full print:hidden">
                    {DUTY_CATEGORIES[activeDept].map(cat => {
                        const catDuties = CURRENT_DUTY_LIST.filter(d => {
                            if (d.category !== cat.id) return false;
                            if (d.isBackup) {
                                const assigned = schedule[selectedDateStr]?.duties?.[d.id] || [];
                                const hasAssigned = assigned.some(a => a && a.staffId);

                                // 1. กะสำรองจะไม่ขึ้นจนกว่าจะจัดกะหลักครบ (ยกเว้นมีคนถูกจัดลงไปแล้ว)
                                if (activeDayEmptySlots > 0 && !hasAssigned) return false;

                                // ซ่อนกะสำรอง หากไม่มีคนถูกจัดลงในกะเลย และไม่มีพนักงานประจำ (FT) ว่างเหลือให้จัดแล้ว
                                const unassignedFT = unassignedStaffDaily.filter(s => !s.pos.includes('PT'));
                                if (!hasAssigned && unassignedFT.length === 0) return false;
                            }
                            return true;
                        });
                        if (catDuties.length === 0) return null;

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
                                        const allowsPT = reqArr.includes('ALL') || reqArr.some(r => r.includes('PT'));

                                        const totalSlotsCount = Math.max(slots.length, assigned.length);
                                        if (totalSlotsCount === 0) return null;
                                        const renderSlots = Array.from({ length: totalSlotsCount });
                                        const dailyEventQuota = activeDept === 'kitchen'
                                            ? (schedule[selectedDateStr]?.eventExtraHoursKitchen || 0)
                                            : (schedule[selectedDateStr]?.eventExtraHoursService !== undefined
                                                ? schedule[selectedDateStr].eventExtraHoursService
                                                : (schedule[selectedDateStr]?.eventExtraHoursKitchen !== undefined ? 0 : (schedule[selectedDateStr]?.eventExtraHours || 0)));
                                        let dailyEventUsed = 0;
                                        Object.values(schedule[selectedDateStr]?.duties || {}).forEach(dutySlots => {
                                            dutySlots.forEach(s => {
                                                if (s && s.isEventExtra && s.staffId) {
                                                    const staff = branchData.staff?.find(x => x.id === s.staffId);
                                                    if (staff && staff.pos.includes('PT') && (staff.dept || 'service') === activeDept) {
                                                        const shiftPreset = branchData.shiftPresets?.find(p => p.id === (s.shiftPresetId || branchData.shiftPresets[0].id));
                                                        const times = getShiftTimesForStaff(staff.pos, shiftPreset);
                                                        const shiftHrs = getNetWorkHours(times.startTime, times.endTime, staff.pos);
                                                        dailyEventUsed += shiftHrs + Number(s.otHours || 0);
                                                    }
                                                }
                                            });
                                        });

                                        return (
                                            <div key={duty.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition hover:shadow-xl w-full">
                                                <div className="p-5 sm:p-6 bg-white border-b border-slate-100 flex flex-col gap-2">
                                                    <div className="flex justify-between items-start w-full gap-2">
                                                        <h3 className={`font-black text-sm sm:text-base uppercase tracking-tighter leading-tight break-words whitespace-pre-wrap ${duty.isBackup ? 'text-red-600' : 'text-slate-900'}`} dangerouslySetInnerHTML={{ __html: duty.jobA }}></h3>
                                                        {['branch', 'superadmin', 'areamanager'].includes(authRole) && !duty.category.includes('HEAD') && (
                                                            <div className="flex flex-col gap-1 items-end">
                                                                {(!duty.isBackup || unassignedStaffDaily.filter(s => !s.pos.includes('PT')).length > 0) && (
                                                                    <button onClick={() => handleAddExtraSlot(selectedDateStr, duty.id, slots, false)} className="bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap">+ Extra (Base)</button>
                                                                )}
                                                                {dailyEventQuota > 0 && (
                                                                    <button onClick={() => handleAddExtraSlot(selectedDateStr, duty.id, slots, true)} className="bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap">+ Extra (Event) {dailyEventUsed.toFixed(1)}/{dailyEventQuota.toFixed(1)}H</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-90 w-full justify-between">
                                                        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic leading-tight whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: duty.jobB }}></span>
                                                        <div className="flex items-center gap-2">
                                                            {duty.xpDna && <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-600 uppercase bg-indigo-50">XP-DNA</span>}
                                                            <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 uppercase bg-slate-50">{displayPos}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 sm:p-6 space-y-4 bg-slate-50/30">
                                                    {renderSlots.map((_, idx) => {
                                                        const isExtra = idx >= slots.length;
                                                        const slot = slots[idx] || { shiftPresetId: assigned[idx]?.shiftPresetId || branchData.shiftPresets?.[0]?.id, maxOtHours: 0 };
                                                        const data = assigned[idx] || { staffId: "", otHours: 0 };
                                                        if (duty.isBackup && !data.staffId && !isExtra) return null; // ซ่อนกล่องว่าง หากเป็นกะสำรอง (แต่ให้แสดงกล่องที่กดเพิ่มเป็น Extra)
                                                        const currentShiftPreset = branchData.shiftPresets?.find(p => p.id === (data.shiftPresetId || slot?.shiftPresetId));
                                                        const currentShiftName = currentShiftPreset ? currentShiftPreset.name : 'N/A';

                                                        const pendingExtraOt = pendingRequests.find(r => r.reqType === 'EXTRA_OT' && r.dateStr === selectedDateStr && r.dutyId === duty.id && r.slotIdx === idx && r.status === 'PENDING_MANAGER');

                                                        const extraBadge = isExtra ? (data.isEventExtra ? 'EVENT EXTRA' : 'BASE EXTRA') : null;
                                                        const extraColor = isExtra ? (data.isEventExtra ? 'border-amber-300 bg-amber-50/50' : 'border-indigo-300 bg-indigo-50/50') : (!data.staffId ? (duty.isBackup ? 'border-dashed border-slate-300 bg-slate-50' : 'border-dashed border-rose-300 bg-rose-50 animate-pulse') : 'border-indigo-100 bg-white');
                                                        const extraIconColor = isExtra ? (data.isEventExtra ? 'text-amber-500' : 'text-indigo-500') : (!data.staffId ? (duty.isBackup ? 'text-slate-400' : 'text-rose-400') : 'text-slate-400');
                                                        const extraTextColor = isExtra ? (data.isEventExtra ? 'text-amber-700' : 'text-indigo-700') : (!data.staffId ? (duty.isBackup ? 'text-slate-500' : 'text-rose-500') : 'text-slate-500');

                                                        let dynMaxOt = slot.maxOtHours || 0;
                                                        if (slot.targetEndTime) {
                                                            let pPos = 'OC';
                                                            if (data.staffId) {
                                                                const sInfo = branchData.staff?.find(s => s.id === (data.staffId?.startsWith('COVER_BY_') ? data.staffId.replace('COVER_BY_', '') : data.staffId));
                                                                if (sInfo) pPos = sInfo.pos;
                                                            }
                                                            const pInfo = branchData.shiftPresets?.find(p => p.id === (data.shiftPresetId || slot.shiftPresetId));
                                                            const { endTime } = getShiftTimesForStaff(pPos, pInfo);
                                                            dynMaxOt = calculateOtHours(slot.targetEndTime, endTime);
                                                        }

                                                        return (
                                                            <div key={idx} className={`p-4 sm:p-5 rounded-[1.2rem] sm:rounded-[1.5rem] border-2 transition-all flex flex-col gap-3 shadow-sm ${extraColor}`}>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${extraTextColor}`}>
                                                                        <Clock className={`w-3 h-3 sm:w-4 sm:h-4 ${extraIconColor}`} />
                                                                        {isExtra ? extraBadge : currentShiftName}
                                                                    </span>
                                                                    <div className="flex gap-1.5 items-center">
                                                                        {isExtra && ['branch', 'superadmin', 'areamanager'].includes(authRole) ? (
                                                                            <select value={data.shiftPresetId || slot.shiftPresetId} onChange={(e) => handleScheduleUpdate(selectedDateStr, duty.id, idx, 'shiftPresetId', e.target.value)} className={`bg-white border rounded px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black outline-none shadow-sm mr-1 ${data.isEventExtra ? 'border-amber-200 text-amber-700' : 'border-indigo-200 text-indigo-700'}`}>
                                                                                {branchData.shiftPresets?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                            </select>
                                                                        ) : null}
                                                                        {isExtra && ['branch', 'superadmin', 'areamanager'].includes(authRole) ? (
                                                                            <button onClick={() => handleRemoveExtraSlot(selectedDateStr, duty.id, idx)} className="bg-red-100 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-[8px] sm:text-[9px] font-black transition shadow-sm"><X className="w-3 h-3" /></button>
                                                                        ) : (
                                                                            <span className={`text-[8px] sm:text-[9px] font-black px-2 py-1 rounded-full uppercase ${!data.staffId ? (duty.isBackup ? 'bg-slate-200/50 text-slate-600' : 'bg-rose-200/50 text-rose-600') : data.otHours >= dynMaxOt && dynMaxOt > 0 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>Q: {dynMaxOt}H</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col sm:flex-row gap-2">
                                                                    <select value={data.staffId} onChange={(e) => {
                                                                        let calculatedOt = slot.maxOtHours || 0;
                                                                        if (slot.targetEndTime) {
                                                                            const actualId = e.target.value.startsWith('COVER_BY_') ? e.target.value.replace('COVER_BY_', '') : e.target.value;
                                                                            const selectedStaff = branchData.staff?.find(s => s.id === actualId);
                                                                            const preset = branchData.shiftPresets?.find(p => p.id === (data.shiftPresetId || slot.shiftPresetId));
                                                                            const { endTime } = getShiftTimesForStaff(selectedStaff?.pos || 'OC', preset);
                                                                            calculatedOt = calculateOtHours(slot.targetEndTime, endTime);
                                                                        }
                                                                        handleScheduleUpdate(selectedDateStr, duty.id, idx, 'staffId', e.target.value, calculatedOt);
                                                                    }} className={`w-full sm:flex-[3] border rounded-xl px-3 py-2 text-xs font-black outline-none shadow-sm focus:border-indigo-500 transition-colors ${!data.staffId ? (duty.isBackup ? 'bg-slate-100/50 border-slate-200 text-slate-500' : 'bg-rose-100/50 border-rose-200 text-rose-600') : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                                                                        <option value="">-- เลือกพนักงาน --</option>
                                                                        {branchData.staff?.filter(s => s.dept === activeDept && isStaffActiveOnDate(s, selectedDateStr)).map(s => {
                                                                            const isUsed = usedStaffIds.includes(s.id) && data.staffId !== s.id;
                                                                            const wrongPos = !checkPositionEligibility(s.pos, reqArr, activeDept) && data.staffId !== s.id;
                                                                            if (isExtra && data.isEventExtra && !s.pos.includes('PT')) return null;
                                                                            const isSStaffPendingPt = isPtPendingApproval(s, selectedDateStr);
                                                                            return (isUsed || wrongPos) ? null : <option key={s.id} value={s.id}>{s.name} ({s.pos}){isSStaffPendingPt ? ' (รออนุมัติ)' : ''}</option>
                                                                        })}
                                                                    </select>
                                                                    <div className={`w-full sm:flex-1 flex flex-row sm:flex-col justify-between sm:justify-center items-center border rounded-xl bg-white transition-all px-3 py-1 ${((data.otHours === 0 && !data.otUpdated && dynMaxOt > 0) ? dynMaxOt : data.otHours) >= dynMaxOt && dynMaxOt > 0 ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200'}`}>
                                                                        <span className="text-[8px] font-black text-slate-300 uppercase sm:mb-0.5">OT</span>
                                                                        {pendingExtraOt ? (
                                                                            <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 leading-none text-center">รออนุมัติ<br />{pendingExtraOt.requestedOt}</span>
                                                                        ) : (
                                                                            <input type="number" step="0.5" value={(data.otHours === 0 && !data.otUpdated && dynMaxOt > 0) ? dynMaxOt : data.otHours} onChange={(e) => handleScheduleUpdate(selectedDateStr, duty.id, idx, 'otHours', e.target.value)} onBlur={(e) => handleOtBlur(selectedDateStr, duty.id, idx, e.target.value, dynMaxOt, data.staffId)} className="w-12 sm:w-full text-right sm:text-center font-black text-sm outline-none bg-transparent focus:text-indigo-600" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {(() => {
                                                                    const assignedStaffInfo = data.staffId ? branchData.staff?.find(s => s.id === (data.staffId.startsWith('COVER_BY_') ? data.staffId.replace('COVER_BY_', '') : data.staffId)) : null;
                                                                    const isAssignedPendingPt = isPtPendingApproval(assignedStaffInfo, selectedDateStr);
                                                                    return isAssignedPendingPt ? (
                                                                        <div className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 mt-1.5 animate-pulse flex items-center gap-1.5 justify-center print:text-black print:border-black print:bg-transparent">
                                                                            ⏳ โควตา PT พิเศษของวันนี้ รออนุมัติ
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                                <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-200/50">
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase w-12 text-right flex-shrink-0">รอบพัก :</span>
                                                                    <div className="flex-1 bg-white rounded-lg">
                                                                        <BreakTimeInput
                                                                            computedValue={dailyComputedBreaks?.[duty.id]?.[idx] || 'N/A'}
                                                                            manualValue={data.breakTime}
                                                                            onSave={(newVal) => {
                                                                                handleScheduleUpdate(selectedDateStr, duty.id, idx, 'breakTime', newVal);
                                                                            }}
                                                                            onReset={() => {
                                                                                handleScheduleUpdate(selectedDateStr, duty.id, idx, 'breakTime', undefined);
                                                                            }}
                                                                            rsFontSize={10}
                                                                            staffPos={branchData.staff?.find(s => s.id === (data.staffId?.startsWith('COVER_BY_') ? data.staffId.replace('COVER_BY_', '') : data.staffId))?.pos}
                                                                        />
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
        const hourlyTcData = branchData.matrix?.[activeDay.type]?.hourlyTc || {};

        const thresholds = branchData.shiftThresholds || { morningEnd: 11, lateMorningEnd: 12, afternoonEnd: 16, eveningEnd: 19 };
        const categories = DUTY_CATEGORIES[activeDept] || [];
        let totalAssignedAll = 0;
        const rs = branchData.rosterStyle || {
            fontSize: 10, headerBg: '#f1f5f9', shiftHeaderBg: '#e0f2fe',
            colDuty: 8, colXpDna: 10, colJobA: 15, colJobB: 10, colCount: 4, colName: 15, colShift: 7, colBreak: 8,
            headlineSize: 24, subHeadlineSize: 14, headerFontSize: 10,
            fontDuty: 10, fontXpDna: 8, fontJobA: 10, fontJobB: 8, fontCount: 12, fontName: 10, fontShift: 10, fontBreak: 10
        };

        let prepGoals = branchData.matrix?.[activeDay.type]?.prepGoals;
        if (!prepGoals) {
            prepGoals = [
                { id: 'prep_1', name: 'กะเช้า', start: '09', end: '12' },
                { id: 'prep_2', name: 'กะบ่าย', start: '13', end: '22' }
            ];
        } else if (!Array.isArray(prepGoals)) {
            prepGoals = [
                { id: 'prep_1', name: 'กะเช้า', start: prepGoals.morning?.start || '09', end: prepGoals.morning?.end || '12' },
                { id: 'prep_2', name: 'กะบ่าย', start: prepGoals.afternoon?.start || '13', end: prepGoals.afternoon?.end || '22' }
            ];
        }
        const getHoursInRange = (start, end) => {
            const hours = [];
            let s = parseInt(start); let e = parseInt(end);
            if (e < s) e += 24;
            for (let i = s; i <= e; i++) { hours.push(String(i % 24).padStart(2, '0')); }
            return hours;
        };
        const goalsData = prepGoals.map(goal => {
            let tc = 0;
            getHoursInRange(goal.start, goal.end).forEach(h => tc += parseInt(hourlyTcData[h]) || 0);
            return { ...goal, tc };
        });
        const colors = [
            { bg: 'bg-amber-50', border: 'border-amber-200', text1: 'text-amber-600', text2: 'text-amber-700', icon: 'text-amber-300' },
            { bg: 'bg-indigo-50', border: 'border-indigo-200', text1: 'text-indigo-600', text2: 'text-indigo-700', icon: 'text-indigo-300' },
            { bg: 'bg-emerald-50', border: 'border-emerald-200', text1: 'text-emerald-600', text2: 'text-emerald-700', icon: 'text-emerald-300' },
            { bg: 'bg-rose-50', border: 'border-rose-200', text1: 'text-rose-600', text2: 'text-rose-700', icon: 'text-rose-300' },
            { bg: 'bg-sky-50', border: 'border-sky-200', text1: 'text-sky-600', text2: 'text-sky-700', icon: 'text-sky-300' },
        ];

        const allTrs = [];
        const breakTracker = {};
        categories.forEach(cat => {
            const catDuties = CURRENT_DUTY_LIST.filter(d => d.category === cat.id);
            let catSlotCount = 0;
            const catRows = [];

            catDuties.forEach((duty) => {
                const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];

                const totalSlotsCount = Math.max(slots.length, assigned.length);
                const renderSlots = Array.from({ length: totalSlotsCount });

                const activeSlots = renderSlots.map((_, sIdx) => {
                    const slot = slots[sIdx] || { shiftPresetId: assigned[sIdx]?.shiftPresetId || branchData.shiftPresets?.[0]?.id, maxOtHours: 0 };
                    return {
                        slot,
                        assignedData: assigned[sIdx] || { staffId: "", otHours: 0 },
                        originalIdx: sIdx,
                        breakTime: dailyComputedBreaks?.[duty.id]?.[sIdx] || 'N/A'
                    };
                }).filter(item => item.assignedData.staffId !== "");

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

        const dayUsedStaffIds = new Set();
        (schedule[selectedDateStr]?.leaves || []).forEach(l => l.staffId && dayUsedStaffIds.add(l.staffId));
        Object.values(schedule[selectedDateStr]?.duties || {}).forEach(sls => sls.forEach(s => s && s.staffId && dayUsedStaffIds.add(s.staffId)));
        const unassignedStaff = branchData.staff?.filter(s => s.dept === activeDept && !dayUsedStaffIds.has(s.id) && isStaffActiveOnDate(s, selectedDateStr)) || [];
        const unassignedFTCount = unassignedStaff.filter(s => !s.pos.includes('PT')).length;
        const unassignedPTCount = unassignedStaff.filter(s => s.pos.includes('PT')).length;

        let emptySlotCount = 0;
        let backupUsedCount = 0;
        CURRENT_DUTY_LIST.forEach(duty => {
            const slots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
            const assigned = schedule[selectedDateStr]?.duties?.[duty.id] || [];

            if (duty.isBackup) {
                assigned.forEach(a => { if (a && a.staffId) backupUsedCount++; });
            } else {
                slots.forEach((_, idx) => { if (!assigned[idx] || !assigned[idx].staffId) emptySlotCount++; });
            }
        });

        const renderHeadcountChart = () => {
            const timeToMinutes = (tStr) => {
                if (!tStr || tStr === '??:??' || tStr === '??.??') return -1;
                const [h, m] = tStr.replace('.', ':').split(':').map(Number);
                return h * 60 + (m || 0);
            };
            const startH = activeDept === 'kitchen' ? 8 : 9;
            const endH = 22;
            const intervals = [];
            for (let h = startH; h <= endH; h++) {
                intervals.push({ label: `${String(h).padStart(2, '0')}:00`, min: h * 60 });
                if (h !== endH) intervals.push({ label: `${String(h).padStart(2, '0')}:30`, min: h * 60 + 30 });
            }

            const jobCounts = {};
            const activeDutyIds = [];

            allTrs.forEach(tr => {
                const { cat, duty, slotItem } = tr;

                if (!jobCounts[duty.id]) {
                    jobCounts[duty.id] = { label: duty.jobA, jobB: duty.jobB, color: cat.color, counts: intervals.map(() => 0) };
                    activeDutyIds.push(duty.id);
                }

                const { slot, assignedData, breakTime } = slotItem;

                const staff = branchData.staff?.find(s => s.id === assignedData.staffId);
                const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot.shiftPresetId);
                const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);

                const startMin = timeToMinutes(startTime);
                let endMin = timeToMinutes(endTime);

                // นำชั่วโมง OT มาบวกต่อจากเวลาเลิกงานปกติ เพื่อแสดงจำนวนคนช่วงดึก
                if (endMin !== -1 && assignedData.otHours > 0) {
                    endMin += assignedData.otHours * 60;
                }

                const actualBreakTime = assignedData.breakTime !== undefined ? assignedData.breakTime : breakTime;
                const [bStartStr, bEndStr] = (actualBreakTime || '').split('-');
                const bStartMin = timeToMinutes(bStartStr);
                const bEndMin = timeToMinutes(bEndStr);

                intervals.forEach((interval, i) => {
                    if (startMin !== -1 && endMin !== -1) {
                        if (interval.min >= startMin && interval.min < endMin) {
                            let onBreak = false;
                            if (bStartMin !== -1 && bEndMin !== -1) {
                                if (interval.min >= bStartMin && interval.min < bEndMin) onBreak = true;
                            }
                            if (!onBreak) jobCounts[duty.id].counts[i]++;
                        }
                    }
                });
            });

            // Calculate Data for Chart
            const hourlyTcData = branchData.matrix?.[activeDay.type]?.hourlyTc || {};

            let maxHeadcount = 0;
            const totalHeadcounts = intervals.map((inv, i) => {
                const total = activeDutyIds.reduce((sum, dutyId) => sum + jobCounts[dutyId].counts[i], 0);
                if (total > maxHeadcount) maxHeadcount = total;
                return total;
            });

            let maxTc = 0;
            const intervalTcs = intervals.map(inv => {
                const hourStr = inv.label.split(':')[0];
                const tc = (parseInt(hourlyTcData[hourStr]) || 0) / 2; // Divide hourly TC into half-hour
                if (tc > maxTc) maxTc = tc;
                return tc;
            });

            return (
                <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm w-full print:hidden">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                                    <TrendingUp className="w-6 h-6 text-indigo-500" />
                                    Headcount vs Traffic
                                </h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">เปรียบเทียบการจัดกำลังคน กับ พยากรณ์ลูกค้า (TC)</p>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-500 rounded-sm"></div><span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Headcount</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-400 opacity-50 border-t-2 border-amber-500 rounded-sm"></div><span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Traffic (TC)</span></div>
                            </div>
                        </div>

                        <div className="flex items-end gap-0.5 sm:gap-1 h-48 sm:h-64 w-full border-b border-slate-200 pb-0 relative">
                            {intervals.map((inv, i) => {
                                const hc = totalHeadcounts[i];
                                const tc = intervalTcs[i];
                                const hcPct = maxHeadcount > 0 ? (hc / maxHeadcount) * 100 : 0;
                                const tcPct = maxTc > 0 ? (tc / maxTc) * 100 : 0;

                                return (
                                    <div key={i} className="flex-1 flex flex-col justify-end items-center relative h-full group">
                                        <div className="absolute -top-12 bg-slate-900 text-white text-[10px] font-black px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl pointer-events-none text-center">
                                            {inv.label} <br />
                                            <span className="text-indigo-300">คน: {hc}</span> | <span className="text-amber-300">บิล: {tc.toFixed(0)}</span>
                                        </div>

                                        <div className="w-full flex justify-center items-end absolute bottom-0 z-0 h-full">
                                            <div className="w-full bg-amber-400/20 border-t-[3px] border-amber-400 transition-all duration-700 rounded-t-sm" style={{ height: `${tcPct}%` }}></div>
                                        </div>

                                        <div className="w-[60%] sm:w-1/2 bg-indigo-500 rounded-t-md z-10 transition-all duration-700 group-hover:bg-indigo-400 shadow-sm" style={{ height: `${hcPct}%` }}></div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-start gap-0.5 sm:gap-1 w-full mt-2">
                            {intervals.map((inv, i) => (
                                <div key={i} className="flex-1 flex justify-center">
                                    <div className="text-[7px] sm:text-[9px] font-bold text-slate-400 -rotate-90 sm:rotate-0 origin-top mt-3 sm:mt-1 whitespace-nowrap">
                                        {inv.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto border-2 border-slate-800 bg-white print:border-none print:overflow-visible w-full mt-2">
                        <div className="text-center mb-6 mt-6 print:block hidden">
                            <h1 className="font-black uppercase tracking-tighter" style={{ fontSize: `${rs.headlineSize || 24}px` }}>สรุปกำลังคนรายครึ่งชั่วโมง (Headcount Summary)</h1>
                            <p className="font-bold text-slate-600 mt-2" style={{ fontSize: `${rs.subHeadlineSize || 14}px` }}>วัน{activeDay.dayLabel} ที่ <span className="underline underline-offset-4">{activeDay.dayNum}</span> เดือน <span className="underline underline-offset-4">{THAI_MONTHS[selectedMonth]}</span> พ.ศ. <span className="underline underline-offset-4">{selectedYear + 543}</span></p>
                        </div>
                        <table className="w-full text-xs text-center border-collapse min-w-[1000px] print:min-w-0">
                            <thead>
                                <tr className="bg-slate-100 print:bg-slate-200">
                                    <th className="p-3 border border-slate-800 text-left sticky left-0 bg-slate-100 z-10 font-black uppercase text-slate-700 print:bg-transparent" style={{ fontSize: `${rs.headerFontSize || 10}px` }}>หน้าที่งาน (JOB A / B)</th>
                                    {intervals.map((inv, i) => (
                                        <th key={i} className="p-2 border border-slate-800 font-bold text-slate-800 min-w-[30px]" style={{ fontSize: `${rs.headerFontSize || 10}px` }}>
                                            {inv.label.split(':')[0]}<span className="text-[8px] opacity-70">:{inv.label.split(':')[1]}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeDutyIds.map(dutyId => {
                                    const data = jobCounts[dutyId];
                                    return (
                                        <tr key={dutyId} className="transition-colors border border-slate-800 h-10 sm:h-12">
                                            <td className={`p-3 text-left sticky left-0 z-10 border border-slate-800 print:bg-transparent ${data.color.split(' ')[0]} ${data.color.split(' ')[1]}`} style={{ fontSize: `${rs.fontDuty || rs.fontSize}px` }}>
                                                <div className="font-black truncate max-w-[150px] sm:max-w-[200px]" title={data.label.replace(/<[^>]*>?/gm, '')} dangerouslySetInnerHTML={{ __html: data.label }}></div>
                                                {data.jobB && data.jobB !== '-' && <div className="text-[8px] sm:text-[9px] font-bold opacity-80 truncate max-w-[150px] sm:max-w-[200px] italic mt-0.5" title={data.jobB.replace(/<[^>]*>?/gm, '')} dangerouslySetInnerHTML={{ __html: data.jobB }}></div>}
                                            </td>
                                            {data.counts.map((count, i) => (
                                                <td key={i} className={`p-2 font-black border border-slate-800 print:bg-transparent ${count === 0 ? 'text-slate-300' : count < 2 ? 'text-amber-500 bg-amber-50 print:text-black' : 'text-emerald-600 bg-emerald-50 print:text-black'}`} style={{ fontSize: `${rs.fontCount || rs.fontSize}px` }}>
                                                    {count > 0 ? count : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                                <tr className="bg-slate-100 print:bg-slate-100 border border-slate-800 h-10 sm:h-12">
                                    <td className="p-3 text-right sticky left-0 bg-slate-100 z-10 font-black text-slate-800 uppercase print:bg-transparent pr-6" style={{ fontSize: `${rs.headerFontSize || 10}px` }}>รวม (Total)</td>
                                    {intervals.map((inv, i) => {
                                        const total = activeDutyIds.reduce((sum, dutyId) => sum + jobCounts[dutyId].counts[i], 0);
                                        return (
                                            <td key={i} className={`p-2 font-black border border-slate-800 print:bg-transparent ${total === 0 ? 'text-slate-300' : 'text-indigo-700 bg-indigo-50/50 print:text-black'}`} style={{ fontSize: `${rs.fontCount || rs.fontSize}px` }}>
                                                {total > 0 ? total : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        };

        const tableBodyRows = allTrs.map((tr, idx) => {
            const { cat, duty, slotItem, isFirstOfCat, catSlotCount, isFirstOfDuty, dutySlotCount, originalIdx, isFirstOfXpDna } = tr;
            const { slot, assignedData } = slotItem;

            const actualStaffId = assignedData.staffId?.startsWith('COVER_BY_') ? assignedData.staffId.replace('COVER_BY_', '') : assignedData.staffId;
            const staff = branchData.staff?.find(s => s.id === actualStaffId);
            const staffName = staff ? staff.name : '-';
            const isPendingPtStaff = isPtPendingApproval(staff, selectedDateStr);
            const shiftPreset = branchData.shiftPresets?.find(p => p.id === slot.shiftPresetId);
            const { startTime, endTime } = getShiftTimesForStaff(staff?.pos, shiftPreset);

            const stHour = parseInt(startTime.split(':')[0]) || 0;

            const isMorning = stHour < thresholds.morningEnd;
            const isLateMorning = stHour >= thresholds.morningEnd && stHour < thresholds.lateMorningEnd;
            const isAfternoon = stHour >= thresholds.lateMorningEnd && stHour < thresholds.afternoonEnd;
            const isEvening = stHour >= thresholds.afternoonEnd && stHour < thresholds.eveningEnd;
            const isNight = stHour >= thresholds.eveningEnd;
            const timeText = (
                <div className="flex flex-col items-center justify-center leading-tight">
                    <span>{formatTimeAbbreviation(startTime)}-{formatTimeAbbreviation(endTime)}</span>
                    {assignedData.otHours > 0 && <span className="text-[8px] sm:text-[9px] text-rose-600 font-black mt-0.5 bg-rose-50 px-1 rounded shadow-sm border border-rose-100 print:text-black print:border-black print:bg-transparent">OT {assignedData.otHours} ชม.</span>}
                </div>
            );
            const pendingExtraOt = pendingRequests.find(r => r.reqType === 'EXTRA_OT' && r.dateStr === selectedDateStr && r.dutyId === duty.id && r.slotIdx === originalIdx && r.status === 'PENDING_MANAGER');
            const otBadge = pendingExtraOt ? <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ml-1 whitespace-nowrap shadow-sm print:text-black print:border-black print:bg-transparent">รออนุมัติ {pendingExtraOt.requestedOt} ชม.</span> : (assignedData.otHours > 0 ? ` (O${assignedData.otHours})` : '');

            return (
                <tr key={`${duty.id}-${originalIdx}`} className={`text-center h-10 sm:h-12 border border-slate-800 ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]} print:bg-white print:text-black`}>
                    {isFirstOfCat && (
                        <td rowSpan={catSlotCount} className="border border-slate-800 p-2 font-black uppercase leading-tight bg-black/10 print:bg-transparent" style={{ fontSize: `${rs.fontDuty || rs.fontSize}px` }}>{cat.label}</td>
                    )}
                    {isFirstOfXpDna && (
                        <td rowSpan={xpDnaRowSpans[idx]} className="border border-slate-800 p-2 text-left whitespace-pre-wrap leading-tight opacity-90 print:opacity-100" style={{ fontSize: `${rs.fontXpDna || (rs.fontSize * 0.8)}px` }} dangerouslySetInnerHTML={{ __html: duty.xpDna || '-' }}></td>
                    )}
                    {isFirstOfDuty && (
                        <React.Fragment>
                            <td rowSpan={dutySlotCount} className="border border-slate-800 p-2 text-left leading-tight bg-white/40 print:bg-transparent" style={{ fontSize: `${rs.fontJobA || rs.fontSize}px` }}>
                                <div className={`font-black whitespace-pre-wrap ${duty.isBackup ? 'text-red-600 print:text-black' : 'text-slate-900 print:text-black'}`} dangerouslySetInnerHTML={{ __html: duty.jobA }}></div>
                                {duty.prepItems && duty.prepItems.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-1.5">
                                        {duty.prepItems.map(p => {
                                            let targetName = p.target;
                                            if (targetName === 'prep_1') targetName = 'กะเช้า';
                                            if (targetName === 'prep_2') targetName = 'กะบ่าย';
                                            const filteredGoals = goalsData.filter(g => !targetName || targetName === 'ALL' || targetName === g.name || targetName === g.id);
                                            if (filteredGoals.length === 0) return null;
                                            return (
                                                <div key={p.id} className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[8px] sm:text-[9px] leading-tight shadow-sm">
                                                    <div className="font-black text-amber-800 mb-0.5 flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> {p.name}</div>
                                                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-slate-600 font-bold bg-white px-1.5 py-1 rounded border border-amber-100">
                                                        {filteredGoals.map((g, i) => {
                                                            const colorClass = colors[i % colors.length].text1;
                                                            let val = 0;
                                                            if (p.mode === 'TABLE') val = p.multiplier * (branchData.totalTables || 0);
                                                            else if (p.mode === 'STATIC') val = p.multiplier;
                                                            else val = p.multiplier * g.tc;
                                                            let displayVal = val % 1 === 0 ? val.toString() : val.toFixed(1);
                                                            return <span key={g.id}>{g.name}: <span className={`${colorClass} font-black`}>{displayVal} {p.unit}</span></span>
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </td>
                            <td rowSpan={dutySlotCount} className="border border-slate-800 p-2 text-left leading-tight opacity-80 print:opacity-100 whitespace-pre-wrap" style={{ fontSize: `${rs.fontJobB || (rs.fontSize * 0.8)}px` }} dangerouslySetInnerHTML={{ __html: duty.jobB || '-' }}></td>
                            <td rowSpan={dutySlotCount} className="border border-slate-800 p-2 font-black" style={{ fontSize: `${rs.fontCount || (rs.fontSize * 1.2)}px` }}><u className="underline-offset-2">{dutySlotCount}</u></td>
                        </React.Fragment>
                    )}
                    <td className="border border-slate-800 p-2 text-left font-bold" style={{ fontSize: `${rs.fontName || rs.fontSize}px` }}>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center">
                                {staffName}
                                {isPendingPtStaff && (
                                    <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ml-1 whitespace-nowrap shadow-sm print:text-black print:border-black print:bg-transparent animate-pulse" title="รออนุมัติโควตาพิเศษ">⏳ รออนุมัติ</span>
                                )}
                                <span className="opacity-80 print:opacity-100 ml-1 font-black">{otBadge}</span>
                            </span>
                            {staff && <span className={`px-1.5 py-0.5 rounded font-black uppercase bg-black/10 print:bg-transparent border border-current opacity-80 print:opacity-100`} style={{ fontSize: `${(rs.fontName || rs.fontSize) * 0.8}px` }}>{staff.pos}</span>}
                        </div>
                    </td>
                    {activeDayShiftVisibilities.hasMorning && <td className={`border border-slate-800 p-2 font-bold ${isMorning ? 'shadow-inner' : 'opacity-30 print:opacity-100'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isMorning ? timeText : ''}</td>}
                    {activeDayShiftVisibilities.hasLateMorning && <td className={`border border-slate-800 p-2 font-bold ${isLateMorning ? 'shadow-inner' : 'opacity-30 print:opacity-100'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isLateMorning ? timeText : ''}</td>}
                    {activeDayShiftVisibilities.hasAfternoon && <td className={`border border-slate-800 p-2 font-bold ${isAfternoon ? 'shadow-inner' : 'opacity-30 print:opacity-100'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isAfternoon ? timeText : ''}</td>}
                    {activeDayShiftVisibilities.hasEvening && <td className={`border border-slate-800 p-2 font-bold ${isEvening ? 'shadow-inner' : 'opacity-30 print:opacity-100'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isEvening ? timeText : ''}</td>}
                    {activeDayShiftVisibilities.hasNight && <td className={`border border-slate-800 p-2 font-bold ${isNight ? 'shadow-inner' : 'opacity-30 print:opacity-100'}`} style={{ fontSize: `${rs.fontShift || rs.fontSize}px` }}>{isNight ? timeText : ''}</td>}
                    <td className="border border-slate-800 p-1.5 bg-white font-black text-indigo-700 print:text-black tracking-tighter whitespace-nowrap print:p-2">
                        <BreakTimeInput
                            computedValue={slotItem.breakTime}
                            manualValue={slotItem.assignedData.breakTime}
                            onSave={(newVal) => {
                                handleScheduleUpdate(selectedDateStr, duty.id, originalIdx, 'breakTime', newVal);
                            }}
                            onReset={() => {
                                handleScheduleUpdate(selectedDateStr, duty.id, originalIdx, 'breakTime', undefined);
                            }}
                            rsFontSize={rs.fontBreak || rs.fontSize}
                            staffPos={staff?.pos}
                        />
                    </td>
                </tr>
            );
        });

        return (
            <div className="w-full animate-in fade-in duration-500">
                <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden w-full print:border-none print:shadow-none">
                    <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center print:hidden flex-wrap gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">{dailyViewMode === 'prep' ? 'Prep Checklist' : 'Duty Roster Chart'}: {new Date(selectedDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mr-2">{activeDept.toUpperCase()} DEPT</div>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${unassignedFTCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>ประจำว่าง {unassignedFTCount}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${unassignedPTCount > 0 ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>PTว่าง {unassignedPTCount}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${emptySlotCount > 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>กะว่าง {emptySlotCount}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${backupUsedCount > 0 ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>ใช้กะสำรอง {backupUsedCount}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            {(view === 'manager' || view === 'head_team') && (
                                <React.Fragment>
                                    <button onClick={() => requestAutoAssign('daily')} disabled={aiLoading} className="flex-1 sm:flex-none justify-center bg-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex items-center gap-2 hover:bg-indigo-700 shadow-sm active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
                                        {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} จัดกะอัตโนมัติ
                                    </button>
                                    {scheduleHistory && (
                                        <button onClick={handleUndoSchedule} disabled={aiLoading} className="flex-1 sm:flex-none justify-center bg-white text-indigo-600 border border-indigo-200 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex items-center gap-2 hover:bg-indigo-50 shadow-sm active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
                                            <Undo2 className="w-4 h-4" /> Undo
                                        </button>
                                    )}
                                </React.Fragment>
                            )}
                            <div className="bg-slate-200 p-1.5 rounded-xl flex gap-1 w-full sm:w-auto">
                                <button onClick={() => setDailyViewMode('roster')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${dailyViewMode === 'roster' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ตารางกะงาน</button>
                                <button onClick={() => setDailyViewMode('headcount')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${dailyViewMode === 'headcount' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>สรุปกำลังคน</button>
                                <button onClick={() => setDailyViewMode('prep')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black transition-all ${dailyViewMode === 'prep' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ใบเตรียมของ</button>
                            </div>                   <button onClick={() => {
                                window.print();
                            }} className="flex-1 sm:flex-none justify-center bg-slate-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex items-center gap-2 hover:bg-black shadow-lg active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest"><Printer className="w-4 h-4" /> พิมพ์ตารางนี้</button>
                        </div>
                    </div>
                    <div className="p-4 sm:p-8 overflow-x-auto w-full">
                        {dailyViewMode === 'roster' ? (
                            <React.Fragment>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 print:hidden">
                                    {goalsData.map((g, i) => {
                                        const c = colors[i % colors.length];
                                        return (
                                            <div key={g.id} className={`${c.bg} border ${c.border} p-4 rounded-2xl flex items-center justify-between shadow-sm`}>
                                                <div>
                                                    <div className={`text-[10px] sm:text-xs font-black ${c.text1} uppercase tracking-widest mb-1`}>เป้าหมายเตรียมของ {g.name} ({g.start}:00-{g.end}:59)</div>
                                                    <div className={`text-2xl sm:text-3xl font-black ${c.text2}`}>{g.tc} <span className="text-sm">บิล (TC)</span></div>
                                                </div>
                                                <UtensilsCrossed className={`w-8 h-8 ${c.icon} opacity-50`} />
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="text-center mb-6">
                                    <h1 className="font-black uppercase tracking-tighter" style={{ fontSize: `${rs.headlineSize || 24}px` }}>แผนงานประจำวัน{activeDept === 'service' ? 'แผนกบริการ (FOH)' : 'แผนกครัว (BOH)'}</h1>
                                    <p className="font-bold text-slate-600 mt-2" style={{ fontSize: `${rs.subHeadlineSize || 14}px` }}>วัน{activeDay.dayLabel} ที่ <span className="underline underline-offset-4">{activeDay.dayNum}</span> เดือน <span className="underline underline-offset-4">{THAI_MONTHS[selectedMonth]}</span> พ.ศ. <span className="underline underline-offset-4">{selectedYear + 543}</span></p>
                                    <div className="mt-4 flex flex-wrap justify-center items-center gap-2 sm:gap-4 font-black text-[10px] sm:text-xs border-y border-slate-200 py-2 w-max mx-auto print:flex bg-slate-50 px-6 rounded-lg">
                                        {goalsData.map((g, i) => {
                                            const c = colors[i % colors.length];
                                            return (
                                                <React.Fragment key={g.id}>
                                                    <span className={`${c.text1} uppercase tracking-widest`}>🎯 เป้าเตรียม{g.name} ({g.start}-{parseInt(g.end) + 1}น.): <span className="text-sm sm:text-base">{g.tc} TC</span></span>
                                                    {i < goalsData.length - 1 && <span className="text-slate-300 hidden sm:inline">|</span>}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                                <table className="w-full table-fixed border-collapse border-2 border-slate-800 min-w-[1100px] bg-white print:min-w-0" style={{ fontSize: `${rs.fontSize}px` }}>
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
                            </React.Fragment>
                        ) : dailyViewMode === 'headcount' ? (
                            renderHeadcountChart()
                        ) : (
                            renderPrepChecklistView()
                        )}
                    </div>
                </div>
            </div>
        );
    }

    function renderManagerMonthly() {
        const isWeekly = managerViewMode === 'weekly';
        const DISPLAY_DAYS = isWeekly ? WEEKLY_DAYS : CALENDAR_DAYS;

        return (
            <div className="w-full animate-in fade-in duration-500">
                <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden w-full">
                    <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                    {isWeekly ? `Weekly Schedule: ${(() => {
                                        if (!WEEKLY_DAYS || WEEKLY_DAYS.length === 0) return '';
                                        const start = WEEKLY_DAYS[0];
                                        const end = WEEKLY_DAYS[WEEKLY_DAYS.length - 1];
                                        const startDate = new Date(start.dateStr + "T00:00:00");
                                        const endDate = new Date(end.dateStr + "T00:00:00");
                                        const startMonth = THAI_MONTHS[startDate.getMonth()];
                                        const endMonth = THAI_MONTHS[endDate.getMonth()];
                                        if (startDate.getMonth() === endDate.getMonth()) {
                                            return `${startDate.getDate()} - ${endDate.getDate()} ${startMonth}`;
                                        } else {
                                            return `${startDate.getDate()} ${startMonth.substring(0, 3)} - ${endDate.getDate()} ${endMonth.substring(0, 3)}`;
                                        }
                                    })()}` : `Monthly Schedule: ${THAI_MONTHS[selectedMonth]}`}
                                </h2>
                                {isWeekly && (
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                        <button
                                            onClick={() => {
                                                const currentDate = new Date(selectedDateStr + 'T00:00:00');
                                                currentDate.setDate(currentDate.getDate() - 7);
                                                const y = currentDate.getFullYear();
                                                const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                                                const d = String(currentDate.getDate()).padStart(2, '0');
                                                setSelectedDateStr(`${y}-${m}-${d}`);
                                            }}
                                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 active:scale-95 transition-all"
                                            title="สัปดาห์ก่อนหน้า"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const currentDate = new Date(selectedDateStr + 'T00:00:00');
                                                currentDate.setDate(currentDate.getDate() + 7);
                                                const y = currentDate.getFullYear();
                                                const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                                                const d = String(currentDate.getDate()).padStart(2, '0');
                                                setSelectedDateStr(`${y}-${m}-${d}`);
                                            }}
                                            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 active:scale-95 transition-all"
                                            title="สัปดาห์ถัดไป"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">{activeDept.toUpperCase()} DEPT</div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={() => requestAutoAssign(isWeekly ? 'weekly' : 'monthly')} disabled={aiLoading} className="flex-1 sm:flex-none bg-slate-900 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-black shadow-lg active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
                                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-yellow-400" />} จัดกะอัตโนมัติ ({isWeekly ? 'ทั้งสัปดาห์นี้' : 'ทั้งเดือนนี้'})
                            </button>
                            <button onClick={() => setShowHistoryModal(true)} className="flex-1 sm:flex-none bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 px-4 py-2 sm:py-3 rounded-xl flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all text-[10px] sm:text-xs font-black uppercase tracking-widest">
                                <FolderOpen className="w-4 h-4" /> ประวัติ
                            </button>
                            {scheduleHistory && (
                                <button onClick={handleUndoSchedule} disabled={aiLoading} className="flex-1 sm:flex-none bg-indigo-100 text-indigo-600 hover:bg-indigo-200 px-4 py-2 sm:py-3 rounded-xl flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all text-[10px] sm:text-xs font-black uppercase tracking-widest">
                                    <Undo2 className="w-4 h-4" /> เลิกทำ (Undo)
                                </button>
                            )}
                            <button onClick={() => setConfirmModal({ message: `ยืนยันการล้างข้อมูลกะงานของ "${isWeekly ? 'ทั้งสัปดาห์นี้' : 'ทั้งเดือนนี้'}" ใช่หรือไม่?`, action: () => handleClearSchedule(isWeekly ? 'weekly' : 'monthly') })} className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 px-4 py-2 sm:py-3 rounded-xl flex justify-center items-center shadow-sm active:scale-95 transition-all">
                                <Eraser className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleMenuChange('print')} className="flex-1 sm:flex-none bg-white text-slate-900 border border-slate-200 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-slate-50 shadow-sm active:scale-95 transition-all text-[10px] sm:text-xs uppercase tracking-widest">
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
                                const staffOptions = branchData.staff?.filter(s => {
                                    if (s.dept !== activeDept) return false;
                                    if (!isStaffActiveOnDate(s, selectedDateStr)) return false;
                                    if (s.pos.includes('PT') && !['OFF', 'SWAP_OFF', 'SL_UNPAID', 'PL_UNPAID'].includes(lt.id)) return false;
                                    return !(usedStaffIds.includes(s.id) && !selectedStaffIds.includes(s.id));
                                }) || [];
                                const isHoliday = isDateHoliday(selectedDateStr, branchData.holidays);
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
                                    {DISPLAY_DAYS.map(day => {
                                        const isPendingPTInHeader = pendingRequests.some(r => r.reqType === 'EXTRA_PT' && r.dateStr === day.dateStr && (r.dept || 'service') === activeDept && r.status === 'PENDING_MANAGER');
                                        const isRejectedPTInHeader = pendingRequests.some(r => r.reqType === 'EXTRA_PT' && r.dateStr === day.dateStr && (r.dept || 'service') === activeDept && r.status === 'REJECTED');
                                        const approvedHrsInHeader = activeDept === 'kitchen'
                                            ? (schedule[day.dateStr]?.eventExtraHoursKitchen || 0)
                                            : (schedule[day.dateStr]?.eventExtraHoursService || schedule[day.dateStr]?.eventExtraHours || 0);
                                        const approvedReqInHeader = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === day.dateStr && (r.dept || 'service') === activeDept && r.status === 'APPROVED');
                                        const dayAllowanceTotal = activeDept === 'kitchen'
                                            ? (ptLedger.kitchen.dailyAllowance[day.dateStr]?.total || 0)
                                            : (ptLedger.service.dailyAllowance[day.dateStr]?.total || 0);
                                        const dayUsageTotal = activeDept === 'kitchen'
                                            ? ((ptLedger.kitchen.dailyUsage[day.dateStr]?.base || 0) + (ptLedger.kitchen.dailyUsage[day.dateStr]?.event || 0))
                                            : ((ptLedger.service.dailyUsage[day.dateStr]?.base || 0) + (ptLedger.service.dailyUsage[day.dateStr]?.event || 0));
                                        const isOverDailyQuota = dayUsageTotal > dayAllowanceTotal;
                                        const dayUsedStaffIds = new Set();
                                        (schedule[day.dateStr]?.leaves || []).forEach(l => l.staffId && dayUsedStaffIds.add(l.staffId));
                                        Object.values(schedule[day.dateStr]?.duties || {}).forEach(sls => sls.forEach(s => s && s.staffId && dayUsedStaffIds.add(s.staffId)));
                                        const unassignedStaff = branchData.staff?.filter(s => s.dept === activeDept && !dayUsedStaffIds.has(s.id) && isStaffActiveOnDate(s, day.dateStr)) || [];
                                        const unassignedFTCount = unassignedStaff.filter(s => !s.pos.includes('PT')).length;
                                        const unassignedPTCount = unassignedStaff.filter(s => s.pos.includes('PT')).length;

                                        let emptySlotCount = 0;
                                        CURRENT_DUTY_LIST.forEach(duty => {
                                            if (duty.isBackup) return; // ไม่นำกะสำรองมานับรวมในกะที่ยังว่าง
                                            const slots = branchData.matrix?.[day.type]?.duties?.[duty.id] || [];
                                            const assigned = schedule[day.dateStr]?.duties?.[duty.id] || [];
                                            slots.forEach((_, idx) => {
                                                if (!assigned[idx] || !assigned[idx].staffId) {
                                                    emptySlotCount++;
                                                }
                                            });
                                        });

                                        return (
                                            <th key={day.dateStr} className="p-3 border-b border-r border-slate-100 text-center min-w-[120px]">
                                                <div className="text-lg font-black text-slate-800">{day.dayNum}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">{day.dayLabel}</div>
                                                <div className="flex flex-col gap-1 items-center w-full">
                                                    {isPendingPTInHeader && (
                                                        <div className="text-[8px] font-black px-1.5 py-0.5 rounded-md w-full bg-amber-50 text-amber-600 border border-amber-200 animate-pulse shadow-sm" title="มีคำขอรออนุมัติชั่วโมง PT ส่วนเกิน">
                                                            ⏳ รออนุมัติ
                                                        </div>
                                                    )}
                                                    {isRejectedPTInHeader && !isPendingPTInHeader && approvedHrsInHeader === 0 && (
                                                        <div className="text-[8px] font-black px-1.5 py-0.5 rounded-md w-full bg-red-50 text-red-600 border border-red-200 shadow-sm text-center font-bold" title="คำขอโควตาพิเศษถูกปฏิเสธ">
                                                            ❌ ถูกปฏิเสธ
                                                        </div>
                                                    )}
                                                    {approvedHrsInHeader > 0 && (
                                                        <div className="text-[8px] font-black px-1.5 py-0.5 rounded-md w-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm" title={`ได้รับโควตาพิเศษ +${approvedHrsInHeader.toFixed(1)} ชม.${approvedReqInHeader?.reason ? ` (เหตุผล: ${approvedReqInHeader.reason})` : ''}`}>
                                                            ✨ พิเศษ +${approvedHrsInHeader.toFixed(1)}H
                                                        </div>
                                                    )}
                                                    {isOverDailyQuota && !isPendingPTInHeader && approvedHrsInHeader === 0 && (
                                                        <button onClick={() => { setForecastTc(''); setForecastReason(''); setForecastEvidence(''); setActiveDept(activeDept); setPtRequestMode('OVER_BUDGET'); setSelectedDateStr(day.dateStr); setShowForecastModal(true); }} className="text-[8px] font-black px-1.5 py-0.5 rounded-md w-full bg-red-500 text-white hover:bg-red-600 shadow-sm animate-pulse" title="จัดกะเกินโควตาประจำวัน คลิกเพื่อขออนุมัติ">
                                                            ⚠️ ขออนุมัติ
                                                        </button>
                                                    )}
                                                    <div className={`text-[9px] font-black px-2 py-0.5 rounded-md w-full border ${unassignedFTCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`} title={`มีพนักงานประจำ ${unassignedFTCount} คนที่ยังไม่ได้ถูกจัดกะในวันนี้`}>
                                                        {unassignedFTCount > 0 ? `ประจำว่าง ${unassignedFTCount}` : '✓ ประจำครบ'}
                                                    </div>
                                                    <div className={`text-[9px] font-black px-2 py-0.5 rounded-md w-full border ${unassignedPTCount > 0 ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`} title={`มีพนักงาน PT ${unassignedPTCount} คนที่ยังไม่ได้ถูกจัดกะในวันนี้`}>
                                                        {unassignedPTCount > 0 ? `PTว่าง ${unassignedPTCount}` : '✓ PTครบ'}
                                                    </div>
                                                    <div className={`text-[9px] font-black px-2 py-0.5 rounded-md w-full border ${emptySlotCount > 0 ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse shadow-sm' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`} title={`มีกะที่ยังว่าง ${emptySlotCount} ตำแหน่งในวันนี้`}>
                                                        {emptySlotCount > 0 ? `กะว่าง ${emptySlotCount}` : '✓ กะเต็ม'}
                                                    </div>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {DUTY_CATEGORIES[activeDept].map(cat => {
                                    const catDuties = CURRENT_DUTY_LIST.filter(d => {
                                        if (d.category !== cat.id) return false;
                                        if (d.isBackup) {
                                            const hasAssigned = DISPLAY_DAYS.some(day => {
                                                const assigned = schedule[day.dateStr]?.duties?.[d.id] || [];
                                                return assigned.some(a => a && a.staffId);
                                            });
                                            if (!hasAssigned) {
                                                const hasUnassignedAnyDay = DISPLAY_DAYS.some(day => {
                                                    // Check if there are empty primary slots on this day
                                                    let emptyPrimaryCount = 0;
                                                    CURRENT_DUTY_LIST.forEach(duty => {
                                                        if (duty.isBackup) return;
                                                        const slots = branchData.matrix?.[day.type]?.duties?.[duty.id] || [];
                                                        const assigned = schedule[day.dateStr]?.duties?.[duty.id] || [];
                                                        slots.forEach((_, idx) => {
                                                            if (!assigned[idx] || !assigned[idx].staffId) emptyPrimaryCount++;
                                                        });
                                                    });

                                                    const dayUsedStaffIds = new Set();
                                                    (schedule[day.dateStr]?.leaves || []).forEach(l => l.staffId && dayUsedStaffIds.add(l.staffId));
                                                    Object.values(schedule[day.dateStr]?.duties || {}).forEach(sls => sls.forEach(s => s && s.staffId && dayUsedStaffIds.add(s.staffId)));
                                                    const unassignedFTCount = branchData.staff?.filter(s => s.dept === activeDept && !s.pos.includes('PT') && !dayUsedStaffIds.has(s.id) && isStaffActiveOnDate(s, day.dateStr)).length || 0;

                                                    // Only allow backup if primary is full AND there are unassigned FT staff
                                                    return emptyPrimaryCount === 0 && unassignedFTCount > 0;
                                                });
                                                return hasUnassignedAnyDay;
                                            }
                                        }
                                        return true;
                                    });
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
                                                    <div className={`font-black text-sm leading-tight mb-1 whitespace-pre-wrap ${duty.isBackup ? 'text-red-600' : 'text-slate-800'}`} dangerouslySetInnerHTML={{ __html: duty.jobA }}></div>
                                                    <div className="font-bold text-[9px] text-slate-500 leading-tight whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: duty.jobB || '-' }}></div>
                                                    <div className="mt-2 text-[8px] font-black px-1.5 py-0.5 rounded border uppercase bg-slate-50 text-slate-500 inline-block">{(duty.reqPos || ['ALL']).join(', ')}</div>
                                                </td>
                                                {DISPLAY_DAYS.map(day => {
                                                    const slots = branchData.matrix?.[day.type]?.duties?.[duty.id] || [];
                                                    const assigned = schedule[day.dateStr]?.duties?.[duty.id] || [];
                                                    const dayUsedStaffIds = new Set();
                                                    (schedule[day.dateStr]?.leaves || []).forEach(l => l.staffId && dayUsedStaffIds.add(l.staffId));
                                                    Object.values(schedule[day.dateStr]?.duties || {}).forEach(sls => sls.forEach(s => s && s.staffId && dayUsedStaffIds.add(s.staffId)));

                                                    const unassignedStaff = branchData.staff?.filter(s => s.dept === activeDept && !dayUsedStaffIds.has(s.id) && isStaffActiveOnDate(s, day.dateStr)) || [];
                                                    const unassignedFT = unassignedStaff.filter(s => !s.pos.includes('PT'));

                                                    let emptyPrimaryCount = 0;
                                                    CURRENT_DUTY_LIST.forEach(dty => {
                                                        if (dty.isBackup) return;
                                                        const primSlots = branchData.matrix?.[day.type]?.duties?.[dty.id] || [];
                                                        const primAssigned = schedule[day.dateStr]?.duties?.[dty.id] || [];
                                                        primSlots.forEach((_, pIdx) => {
                                                            if (!primAssigned[pIdx] || !primAssigned[pIdx].staffId) emptyPrimaryCount++;
                                                        });
                                                    });

                                                    let totalSlotsCount = Math.max(slots.length, assigned.length);
                                                    if (duty.isBackup && unassignedFT.length > 0 && emptyPrimaryCount === 0) {
                                                        const emptyCount = assigned.filter(a => !a || !a.staffId).length;
                                                        if (emptyCount === 0) {
                                                            totalSlotsCount += 1;
                                                        }
                                                    }

                                                    const renderSlots = Array.from({ length: totalSlotsCount });

                                                    return (
                                                        <td key={day.dateStr} className="p-2 border-r border-slate-100 align-top bg-white">
                                                            <div className="space-y-2">
                                                                {renderSlots.map((_, idx) => {
                                                                    const isExtra = idx >= slots.length;
                                                                    const matrixSlot = slots[idx] || { shiftPresetId: assigned[idx]?.shiftPresetId || branchData.shiftPresets?.[0]?.id, maxOtHours: 0 };
                                                                    const data = assigned[idx] || { staffId: "", otHours: 0 };
                                                                    if (duty.isBackup && !data.staffId && (unassignedFT.length === 0 || emptyPrimaryCount > 0)) return null; // ซ่อนกล่องว่าง หากเป็นกะสำรองและไม่มีคน FT ว่างเหลือ หรือกะหลักยังไม่เต็ม
                                                                    const shiftPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId);
                                                                    const shiftName = shiftPreset ? shiftPreset.name : 'N/A';
                                                                    const pendingExtraOt = pendingRequests.find(r => r.reqType === 'EXTRA_OT' && r.dateStr === day.dateStr && r.dutyId === duty.id && r.slotIdx === idx && r.status === 'PENDING_MANAGER');

                                                                    let dynMaxOt = matrixSlot.maxOtHours || 0;
                                                                    if (matrixSlot.targetEndTime) {
                                                                        let pPos = 'OC';
                                                                        if (data.staffId) {
                                                                            const sInfo = branchData.staff?.find(s => s.id === (data.staffId?.startsWith('COVER_BY_') ? data.staffId.replace('COVER_BY_', '') : data.staffId));
                                                                            if (sInfo) pPos = sInfo.pos;
                                                                        }
                                                                        const pInfo = branchData.shiftPresets?.find(p => p.id === (data.shiftPresetId || matrixSlot.shiftPresetId));
                                                                        const { endTime } = getShiftTimesForStaff(pPos, pInfo);
                                                                        dynMaxOt = calculateOtHours(matrixSlot.targetEndTime, endTime);
                                                                    }

                                                                    const extraBadge = isExtra ? (data.isEventExtra ? 'EVENT EXTRA' : 'BASE EXTRA') : null;
                                                                    const extraColor = isExtra ? (data.isEventExtra ? 'border-amber-300 bg-amber-50/50' : 'border-indigo-300 bg-indigo-50/50') : (!data.staffId ? (duty.isBackup ? 'border-dashed border-slate-300 bg-slate-50' : 'border-dashed border-rose-300 bg-rose-50 animate-pulse shadow-sm') : data.staffId.startsWith('COVER_BY_') ? 'border-dashed border-amber-300 bg-amber-50 shadow-sm' : 'border-indigo-200 bg-indigo-50/30');
                                                                    const extraTextColor = isExtra ? (data.isEventExtra ? 'text-amber-700' : 'text-indigo-700') : (!data.staffId ? (duty.isBackup ? 'text-slate-400' : 'text-rose-400') : data.staffId.startsWith('COVER_BY_') ? 'text-amber-500' : 'text-slate-400');

                                                                    return (
                                                                        <div key={idx} className={`p-2 rounded-lg border ${extraColor}`}>
                                                                            <div className="flex justify-between items-center mb-1 gap-1">
                                                                                <span className={`text-[8px] font-bold truncate ${extraTextColor}`}>{isExtra ? extraBadge : shiftName}</span>
                                                                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                                    {isExtra && ['branch', 'superadmin', 'areamanager'].includes(authRole) && (
                                                                                        <select value={data.shiftPresetId || matrixSlot.shiftPresetId} onChange={(e) => handleScheduleUpdate(day.dateStr, duty.id, idx, 'shiftPresetId', e.target.value)} className={`bg-white border rounded px-1 py-0.5 text-[7px] font-black outline-none shadow-sm truncate max-w-[50px] mr-0.5 ${data.isEventExtra ? 'border-amber-200 text-amber-700' : 'border-indigo-200 text-indigo-700'}`}>
                                                                                            {branchData.shiftPresets?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                                        </select>
                                                                                    )}
                                                                                    {isExtra && ['branch', 'superadmin', 'areamanager'].includes(authRole) && (
                                                                                        <button onClick={() => handleRemoveExtraSlot(day.dateStr, duty.id, idx)} className="bg-red-100 text-red-500 hover:bg-red-500 hover:text-white px-1.5 py-0.5 rounded text-[7px] font-black transition shadow-sm mr-0.5"><X className="w-2.5 h-2.5" /></button>
                                                                                    )}
                                                                                    <span className="text-[7px] font-black text-slate-400">OT:</span>
                                                                                    {pendingExtraOt ? (
                                                                                        <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 leading-tight text-center">รออนุมัติ<br />{pendingExtraOt.requestedOt}</span>
                                                                                    ) : (
                                                                                        <input type="number" step="0.5" value={(data.otHours === 0 && !data.otUpdated && dynMaxOt > 0) ? dynMaxOt : data.otHours} onChange={(e) => handleScheduleUpdate(day.dateStr, duty.id, idx, 'otHours', e.target.value)} onBlur={(e) => handleOtBlur(day.dateStr, duty.id, idx, e.target.value, dynMaxOt, data.staffId)} disabled={!data.staffId} className={`w-10 h-4 text-[8px] font-black text-center rounded outline-none transition-colors border ${((data.otHours === 0 && !data.otUpdated && dynMaxOt > 0) ? dynMaxOt : data.otHours) > 0 ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 focus:border-indigo-400'} disabled:opacity-50`} />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <select value={data.staffId} onChange={(e) => {
                                                                                let calculatedOt = matrixSlot.maxOtHours || 0;
                                                                                if (matrixSlot.targetEndTime) {
                                                                                    const actualId = e.target.value.startsWith('COVER_BY_') ? e.target.value.replace('COVER_BY_', '') : e.target.value;
                                                                                    const selectedStaff = branchData.staff?.find(s => s.id === actualId);
                                                                                    const preset = branchData.shiftPresets?.find(p => p.id === (data.shiftPresetId || matrixSlot.shiftPresetId));
                                                                                    const { endTime } = getShiftTimesForStaff(selectedStaff?.pos || 'OC', preset);
                                                                                    calculatedOt = calculateOtHours(matrixSlot.targetEndTime, endTime);
                                                                                }
                                                                                handleScheduleUpdate(day.dateStr, duty.id, idx, 'staffId', e.target.value, calculatedOt);
                                                                            }} className={`w-full text-[10px] font-bold bg-transparent outline-none truncate ${!data.staffId ? (duty.isBackup ? 'text-slate-500' : 'text-rose-600') : data.staffId.startsWith('COVER_BY_') ? 'text-amber-700' : 'text-slate-800'} ${isExtra && !data.staffId ? 'text-indigo-500' : ''}`}>
                                                                                <option value="">-- ว่าง --</option>
                                                                                {data.staffId && data.staffId.startsWith('COVER_BY_') && <option value={data.staffId}>✅ Cover: {branchData.staff?.find(s => s.id === data.staffId.replace('COVER_BY_', ''))?.name}</option>}
                                                                                {branchData.staff?.filter(s => s.dept === activeDept && isStaffActiveOnDate(s, day.dateStr)).map(s => {
                                                                                    const isUsed = dayUsedStaffIds.has(s.id) && data.staffId !== s.id;
                                                                                    const wrongPos = !checkPositionEligibility(s.pos, reqArr, activeDept) && data.staffId !== s.id;
                                                                                    if (isExtra && data.isEventExtra && !s.pos.includes('PT')) return null;
                                                                                    const isSStaffPendingPt = isPtPendingApproval(s, day.dateStr);
                                                                                    return (isUsed || wrongPos) ? null : <option key={s.id} value={s.id}>{s.name}{isSStaffPendingPt ? ' (รออนุมัติ)' : ''}</option>
                                                                                })}
                                                                            </select>
                                                                            {(() => {
                                                                                const sInfo = data.staffId ? branchData.staff?.find(s => s.id === (data.staffId.startsWith('COVER_BY_') ? data.staffId.replace('COVER_BY_', '') : data.staffId)) : null;
                                                                                const isCellPendingPt = isPtPendingApproval(sInfo, day.dateStr);
                                                                                return isCellPendingPt ? (
                                                                                    <div className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 mt-1 text-center animate-pulse">
                                                                                        ⏳ รออนุมัติ
                                                                                    </div>
                                                                                ) : null;
                                                                            })()}
                                                                        </div>
                                                                    )
                                                                })}
                                                                {['branch', 'superadmin', 'areamanager'].includes(authRole) && !duty.category.includes('HEAD') && (
                                                                    <div className="flex flex-col gap-1 mt-1">
                                                                        {(!duty.isBackup || unassignedFT.length > 0) && (
                                                                            <button onClick={() => handleAddExtraSlot(day.dateStr, duty.id, slots, false)} className="w-full bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-dashed border-slate-200 hover:border-indigo-200 py-1.5 rounded-lg text-[8px] font-black transition-colors flex items-center justify-center gap-1 shadow-sm">+ Extra (Base)</button>
                                                                        )}
                                                                        {((activeDept === 'kitchen' ? (schedule[day.dateStr]?.eventExtraHoursKitchen > 0) : (schedule[day.dateStr]?.eventExtraHoursService > 0 || (schedule[day.dateStr]?.eventExtraHoursKitchen === undefined && schedule[day.dateStr]?.eventExtraHours > 0)))) && (
                                                                            <button onClick={() => handleAddExtraSlot(day.dateStr, duty.id, slots, true)} className="w-full bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 border border-dashed border-amber-200 hover:border-amber-300 py-1.5 rounded-lg text-[8px] font-black transition-colors flex items-center justify-center gap-1 shadow-sm">+ Extra (Event)</button>
                                                                        )}
                                                                    </div>
                                                                )}
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
        const ptStaffData = reportData.filter(s => s.pos.includes('PT'));
        const totalPtHours = ptStaffData.reduce((sum, s) => sum + s.workHours + s.actualOT, 0);
        const ptRate = branchData.ptConfig?.hourlyRate || 0;
        const estimatedPtExpense = totalPtHours * ptRate;

        const totalBasePay = reportData.reduce((sum, s) => sum + s.basePay, 0);
        const totalOtPay = reportData.reduce((sum, s) => sum + s.otPay, 0);
        const totalHolidayPay = reportData.reduce((sum, s) => sum + s.holidayPay, 0);
        const totalPay = reportData.reduce((sum, s) => sum + s.totalPay, 0);

        const totalAllowedExpense = ptLedger.totalAllowance * ptRate;
        const baseBudget = branchData.ptConfig?.monthlyBudget || 0;
        const isOverAllowed = estimatedPtExpense > totalAllowedExpense;

        const uniqueOtMultipliers = useMemo(() => {
            const multipliers = new Set();
            reportData.forEach(s => {
                Object.keys(s.otHoursByMultiplier || {}).forEach(m => multipliers.add(m));
            });
            return Array.from(multipliers).map(Number).sort((a, b) => a - b);
        }, [reportData]);

        return (
            <div className="flex-1 space-y-6 sm:space-y-12 animate-in fade-in duration-500 pb-24 w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="bg-yellow-400 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl sm:shadow-2xl shadow-yellow-100"><TrendingUp className="w-6 h-6 sm:w-10 sm:h-10 text-white" /></div>
                        <div>
                            <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter uppercase">Analytical Insight</h2>
                            <p className="text-slate-400 font-bold uppercase text-[10px] sm:text-sm tracking-widest mt-0.5 sm:mt-1">Performance &amp; OT Efficiency Report</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                        <div className="flex-1 sm:flex-none bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center shadow-md text-[10px] sm:text-xs uppercase tracking-widest gap-2">
                            <Filter className="w-4 h-4" /> Filtered
                        </div>
                        <button onClick={handleExportExcel} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center shadow-md text-[10px] sm:text-xs uppercase tracking-widest gap-2 transition-all active:scale-95">
                            <Download className="w-4 h-4" /> Export (CSV)
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
                                    {deltaOT > 0 ? <ArrowUpRight className="w-6 h-6 sm:w-10 sm:h-10" /> : <ArrowDownRight className="w-6 h-6 sm:w-10 sm:h-10" />}
                                </div>
                            </div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 sm:max-w-[150px] leading-relaxed text-center sm:text-left">ส่วนต่างการใช้งาน OT จริงเทียบกับโควตาจากส่วนกลาง</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">พยากรณ์ค่าใช้จ่าย Part-Time</h3>
                            <div className="text-3xl sm:text-5xl font-black text-emerald-600 tracking-tighter mt-2">
                                {estimatedPtExpense.toLocaleString()} <span className="text-sm sm:text-base text-slate-500">THB</span>
                            </div>
                            <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-2">คำนวณจาก {totalPtHours.toFixed(1)} ชม. x {ptRate} บ./ชม.</p>
                        </div>
                    </div>

                    {reportFilterMode === 'month' ? (
                        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">งบประมาณ PT ที่ใช้งานได้</h3>
                                <div className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tighter mt-2">
                                    {totalAllowedExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm sm:text-base text-slate-500">THB</span>
                                </div>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-2">จากงบตั้งต้น {baseBudget.toLocaleString()} บ. + คืนคนลา/ขาด + อีเวนต์</p>
                            </div>
                            <div className={`mt-4 text-[10px] sm:text-xs font-black px-3 py-2 rounded-xl inline-block w-max ${isOverAllowed ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'}`}>
                                {isOverAllowed ? `⚠️ ใช้เกินงบไป ${(estimatedPtExpense - totalAllowedExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB` : `✨ คงเหลือ ${(totalAllowedExpense - estimatedPtExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB`}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center opacity-50">
                            <span className="text-xs font-bold text-slate-400">งบประมาณจะแสดงผล<br />เฉพาะการกรองแบบ "รายเดือน"</span>
                        </div>
                    )}

                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">สัดส่วนกำลังคน (Manpower)</h3>
                            <div className="flex gap-6 mt-4">
                                <div>
                                    <div className="text-3xl sm:text-5xl font-black text-indigo-600">{reportData.filter(s => !s.pos.includes('PT')).length}</div>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1">Full-Time (FT)</p>
                                </div>
                                <div>
                                    <div className="text-3xl sm:text-5xl font-black text-orange-500">{ptStaffData.length}</div>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1">Part-Time (PT)</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 h-2 w-full bg-orange-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(reportData.filter(s => !s.pos.includes('PT')).length / (reportData.length || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                </div>          {/* Part-Time Quota & Hours Summary */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden w-full">
                    <div className="p-6 sm:p-8 border-b border-slate-100 font-black text-slate-900 bg-slate-50/30 uppercase tracking-tighter text-lg flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-indigo-500" /> สรุปโควตาและชั่วโมงจัดกะ Part-Time (Part-Time Quota & Hours Summary)
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Service Report Card */}
                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
                            <h4 className="font-black text-indigo-700 text-sm border-b border-slate-200 pb-1.5 flex items-center justify-between">
                                <span>แผนกบริการ (FOH - Service)</span>
                                <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">FOH</span>
                            </h4>
                            <div className="space-y-2 text-xs font-bold">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">1. โควตาตั้งต้นปกติ (Base Quota):</span>
                                    <span className="text-slate-800 font-extrabold">{(ptLedger.service.baseAllowance || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">2. โควตาชดเชยการลาหยุด (Leave Compensations):</span>
                                    <span className="text-emerald-600">+{(ptLedger.service.leaveRefunds || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">3. โควตาชดเชยอัตรากำลังคนขาด (Vacancy Compensations):</span>
                                    <span className="text-emerald-600">+{(ptLedger.service.vacancyCompensations || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                                    <span className="text-slate-500">4. โควตาพิเศษที่ได้รับการอนุมัติ (Approved Special Quota):</span>
                                    <span className="text-indigo-600 font-black">+{(ptLedger.service.eventExtras || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between text-sm pt-1">
                                    <span className="text-slate-700 font-black">โควตารวมที่ได้รับอนุมัติ (Total Allowed):</span>
                                    <span className="text-slate-900 font-black">{(ptLedger.service.totalAllowance || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between text-sm pt-0.5 border-t border-dashed border-slate-200">
                                    <span className="text-slate-700 font-black">จัดกะใช้งานจริง (Actual Scheduled):</span>
                                    <span className="text-indigo-600 font-black">{(ptLedger.service.usedHours || 0).toFixed(1)} ชม.</span>
                                </div>
                            </div>
                        </div>

                        {/* Kitchen Report Card */}
                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-4">
                            <h4 className="font-black text-orange-700 text-sm border-b border-slate-200 pb-1.5 flex items-center justify-between">
                                <span>แผนกครัว (BOH - Kitchen)</span>
                                <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">BOH</span>
                            </h4>
                            <div className="space-y-2 text-xs font-bold">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">1. โควตาตั้งต้นปกติ (Base Quota):</span>
                                    <span className="text-slate-800 font-extrabold">{(ptLedger.kitchen.baseAllowance || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">2. โควตาชดเชยการลาหยุด (Leave Compensations):</span>
                                    <span className="text-emerald-600">+{(ptLedger.kitchen.leaveRefunds || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">3. โควตาชดเชยอัตรากำลังคนขาด (Vacancy Compensations):</span>
                                    <span className="text-emerald-600">+{(ptLedger.kitchen.vacancyCompensations || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                                    <span className="text-slate-500">4. โควตาพิเศษที่ได้รับการอนุมัติ (Approved Special Quota):</span>
                                    <span className="text-indigo-600 font-black">+{(ptLedger.kitchen.eventExtras || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between text-sm pt-1">
                                    <span className="text-slate-700 font-black">โควตารวมที่ได้รับอนุมัติ (Total Allowed):</span>
                                    <span className="text-slate-900 font-black">{(ptLedger.kitchen.totalAllowance || 0).toFixed(1)} ชม.</span>
                                </div>
                                <div className="flex justify-between text-sm pt-0.5 border-t border-dashed border-slate-200">
                                    <span className="text-slate-700 font-black">จัดกะใช้งานจริง (Actual Scheduled):</span>
                                    <span className="text-orange-600 font-black">{(ptLedger.kitchen.usedHours || 0).toFixed(1)} ชม.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] sm:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden w-full">
                    <div className="p-6 sm:p-12 border-b border-slate-50 font-black text-slate-900 bg-slate-50/30 uppercase tracking-tighter text-lg sm:text-2xl"><div className="flex items-center gap-3 sm:gap-5"><BarChart3 className="w-6 h-6 sm:w-10 sm:h-10 text-indigo-500" /> Employee Workload Summary</div></div>
                    {['service', 'kitchen'].map(dept => {
                        const deptData = reportData.filter(s => s.dept === dept);
                        if (deptData.length === 0) return null;

                        const deptTotalActualOT = deptData.reduce((acc, curr) => acc + curr.actualOT, 0);
                        const deptTotalPlannedOT = deptData.reduce((acc, curr) => acc + curr.plannedOT, 0);
                        const deptDeltaOT = deptTotalActualOT - deptTotalPlannedOT;
                        const deptTotalBasePay = deptData.reduce((acc, curr) => acc + curr.basePay, 0);
                        const deptTotalOtPay = deptData.reduce((acc, curr) => acc + curr.otPay, 0);
                        const deptTotalHolidayPay = deptData.reduce((acc, curr) => acc + curr.holidayPay, 0);
                        const deptTotalPay = deptData.reduce((acc, curr) => acc + curr.totalPay, 0);
                        const deptTitle = dept === 'service' ? 'ฝั่งบริการ (FOH)' : 'ฝั่งครัว (BOH)';

                        return (
                            <div key={dept} className="mb-0 border-b-8 border-slate-100 last:border-b-0">
                                <div className="px-6 sm:px-12 py-6 bg-white flex items-center gap-3 border-b border-slate-100">
                                    <span className={`w-2 h-6 rounded-full ${dept === 'service' ? 'bg-indigo-500' : 'bg-orange-500'}`}></span>
                                    <h3 className="text-base sm:text-xl font-black text-slate-800 uppercase tracking-widest">{deptTitle}</h3>
                                </div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-xs sm:text-base min-w-[700px]">
                                        <thead className="bg-white text-[9px] sm:text-[12px] font-black uppercase text-slate-400 tracking-widest border-b">
                                            <tr>
                                                <th className="px-6 sm:px-12 py-4 sm:py-8 text-left sticky left-0 bg-white z-10">Staff Name</th>
                                                {['superadmin', 'areamanager'].includes(authRole) && <th className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/20">ฐานเงินเดือน/เรท</th>}
                                                <th className="px-4 sm:px-12 py-4 sm:py-8 text-center">Shifts</th>
                                                <th className="px-4 sm:px-12 py-4 sm:py-8 text-center">Hours</th>
                                                <th className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/30 text-indigo-600">Plan OT</th>
                                                {uniqueOtMultipliers.map(mult => (
                                                    <th key={mult} className="px-2 sm:px-8 py-4 sm:py-8 text-center bg-indigo-50/40 text-indigo-700">OT x{mult}</th>
                                                ))}
                                                <th className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/60 text-indigo-900">รวม OT</th>
                                                <th className="px-4 sm:px-12 py-4 sm:py-8 text-center">ส่วนต่างOT</th>
                                                {['superadmin', 'areamanager'].includes(authRole) && <th className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/40">ค่าจ้างปกติ</th>}
                                                {['superadmin', 'areamanager'].includes(authRole) && <th className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/60">ค่า OT</th>}
                                                {['superadmin', 'areamanager'].includes(authRole) && <th className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/80">ค่าแรงวันหยุด</th>}
                                                {['superadmin', 'areamanager'].includes(authRole) && <th className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-100 text-emerald-800">รวมค่าแรงรายเดือน+ค่าจ้างพนักงานชั่วคราว+OT สุทธิ</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                                            {deptData.map((s, idx) => {
                                                const delta = s.actualOT - s.plannedOT;
                                                const layer = getStaffLayer(s.dept, s.pos);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition duration-300">
                                                        <td className="px-6 sm:px-12 py-4 sm:py-8 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 border-r border-slate-50">
                                                            <p className="font-black text-slate-900 uppercase text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">{s.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`mt-1 inline-block text-[8px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded ${layer.color.split(' ')[0]} ${layer.color.split(' ')[1]}`}>{s.dept} - {s.pos}</span>
                                                                {['superadmin', 'areamanager'].includes(authRole) && <span className="mt-1 text-[8px] sm:text-[9px] font-bold text-slate-400">({s.wageType})</span>}
                                                            </div>
                                                        </td>
                                                        {['superadmin', 'areamanager'].includes(authRole) && <td className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/20 text-emerald-700 font-mono">฿{s.baseWage.toLocaleString()}</td>}
                                                        <td className="px-4 sm:px-12 py-4 sm:py-8 text-center text-sm sm:text-xl">{s.shifts}</td>
                                                        <td className="px-4 sm:px-12 py-4 sm:py-8 text-center text-sm sm:text-xl">{s.workHours.toFixed(1)}</td>
                                                        <td className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/10 text-slate-500">{s.plannedOT.toFixed(1)}</td>
                                                        {uniqueOtMultipliers.map(mult => (
                                                            <td key={mult} className="px-2 sm:px-8 py-4 sm:py-8 text-center bg-indigo-50/20 text-indigo-700 font-bold">
                                                                {s.otHoursByMultiplier?.[mult] ? s.otHoursByMultiplier[mult].toFixed(1) : '-'}
                                                            </td>
                                                        ))}
                                                        <td className="px-4 sm:px-12 py-4 sm:py-8 text-center bg-indigo-50/30 text-indigo-800 text-lg sm:text-2xl font-black">{s.actualOT.toFixed(1)}</td>
                                                        <td className={`px-4 sm:px-12 py-4 sm:py-8 text-center text-sm sm:text-lg font-black ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                            {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                                                        </td>
                                                        {['superadmin', 'areamanager'].includes(authRole) && <td className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/40 font-mono">{s.basePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                                                        {['superadmin', 'areamanager'].includes(authRole) && <td className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/60 font-mono">{s.otPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                                                        {['superadmin', 'areamanager'].includes(authRole) && <td className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-50/80 font-mono">{s.holidayPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                                                        {['superadmin', 'areamanager'].includes(authRole) && <td className="px-4 sm:px-8 py-4 sm:py-8 text-right bg-emerald-100 text-emerald-800 font-black text-base sm:text-lg font-mono">฿{s.totalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {['superadmin', 'areamanager'].includes(authRole) && (
                                            <tfoot className="bg-slate-100 text-slate-800 font-black text-base sm:text-lg uppercase">
                                                <tr>
                                                    <td colSpan={['superadmin', 'areamanager'].includes(authRole) ? 2 : 1} className="px-6 sm:px-12 py-6 text-right">Total ({deptTitle})</td>
                                                    <td className="px-4 sm:px-12 py-6 text-center">{deptData.reduce((acc, curr) => acc + curr.shifts, 0)}</td>
                                                    <td className="px-4 sm:px-12 py-6 text-center">{deptData.reduce((acc, curr) => acc + curr.workHours, 0).toFixed(1)}</td>
                                                    <td className="px-4 sm:px-12 py-6 text-center">{deptTotalPlannedOT.toFixed(1)}</td>
                                                    {uniqueOtMultipliers.map(mult => {
                                                        const totalForMult = deptData.reduce((sum, s) => sum + (s.otHoursByMultiplier?.[mult] || 0), 0);
                                                        return <td key={mult} className="px-2 sm:px-8 py-6 text-center text-indigo-700">{totalForMult > 0 ? totalForMult.toFixed(1) : '-'}</td>;
                                                    })}
                                                    <td className="px-4 sm:px-12 py-6 text-center text-indigo-900">{deptTotalActualOT.toFixed(1)}</td>
                                                    <td className={`px-4 sm:px-12 py-6 text-center ${deptDeltaOT > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{deptDeltaOT > 0 ? `+${deptDeltaOT.toFixed(1)}` : deptDeltaOT.toFixed(1)}</td>
                                                    <td className="px-4 sm:px-8 py-6 text-right font-mono">{deptTotalBasePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 sm:px-8 py-6 text-right font-mono">{deptTotalOtPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 sm:px-8 py-6 text-right font-mono">{deptTotalHolidayPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 sm:px-8 py-6 text-right font-mono text-emerald-800">฿{deptTotalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        );
                    })}
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
                        <div className="space-y-2 w-full">
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
                        <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest border-b border-slate-200 pb-2">1. สีและหัวข้อ (Colors &amp; Headers)</h3>
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

        const hours = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04'];

        return (
            <div className="space-y-6 sm:space-y-8 w-full mt-6 sm:mt-10 print:hidden">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 px-2 uppercase tracking-tighter flex items-center gap-3 sm:gap-4"><Clock className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" /> โครงสร้างกะงานฝั่ง: {activeDept === 'service' ? 'บริการ' : 'ครัว'}</h2>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].filter(k => branchData.matrix?.[k]).map(k => [k, branchData.matrix[k]]).map(([key, data]) => (
                    <div key={key} className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm mb-6 sm:mb-10 w-full">
                        <div className={`px-6 sm:px-10 py-4 sm:py-6 font-black text-base sm:text-lg text-white ${['monday', 'tuesday', 'wednesday', 'thursday', 'weekday'].includes(key) ? 'bg-slate-900' : key === 'friday' ? 'bg-sky-700' : key === 'saturday' ? 'bg-purple-600' : 'bg-orange-600'}`}>{key.toUpperCase()} CYCLE {authRole === 'branch' ? '(VIEW ONLY)' : ''}</div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs text-left min-w-[800px]">
                                <tbody className="divide-y divide-slate-100">
                                    {CURRENT_DUTY_LIST.map(duty => {
                                        const catInfo = DUTY_CATEGORIES[activeDept]?.find(c => c.id === duty.category);
                                        return (
                                            <tr key={duty.id}>
                                                <td className="px-6 sm:px-10 py-6 sm:py-8 w-[30%]">
                                                    <div className="font-black text-slate-900 text-sm sm:text-lg mb-1 leading-tight flex items-center gap-2 whitespace-pre-wrap">
                                                        {catInfo && <div className={`w-3 h-3 rounded-full ${catInfo.color.split(' ')[0]}`} title={catInfo.label}></div>}
                                                        <div dangerouslySetInnerHTML={{ __html: duty.jobA }}></div>
                                                        {duty.isBackup && <span className="text-[8px] sm:text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">กะสำรอง</span>}
                                                    </div>
                                                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase italic leading-tight mt-1 sm:ml-5 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: duty.jobB }}></div>
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
                                                                        {(branchData.shiftPresets || []).filter(p => p.isActive !== false || matrixSlot.shiftPresetId === p.id).map(p => <option key={p.id} value={p.id}>{p.name} {p.isActive === false ? '(ปิดใช้งาน)' : ''}</option>)}
                                                                    </select>

                                                                    <span className="text-[8px] sm:text-[9px] font-black text-indigo-500 uppercase">เป้าเวลาเลิก (OT)</span>
                                                                    <div className="flex flex-col gap-1 w-full">
                                                                        <div className="flex gap-1 w-full">
                                                                            <input type="text" placeholder="HH:MM" disabled={authRole === 'branch'} className="w-full border rounded-xl p-1.5 sm:p-2 text-center font-black bg-indigo-50/50 disabled:opacity-50 outline-none focus:border-indigo-500 text-[10px] sm:text-xs" value={matrixSlot.targetEndTime || ''}
                                                                                onChange={(e) => {
                                                                                    let val = e.target.value.replace('.', ':').replace(/[^0-9:]/g, '');
                                                                                    if (val.length > 5) val = val.substring(0, 5);
                                                                                    const nd = JSON.parse(JSON.stringify(branchData));
                                                                                    if (nd.matrix?.[key]?.duties?.[duty.id]?.[idx]) { nd.matrix[key].duties[duty.id][idx].targetEndTime = val; nd.matrix[key].duties[duty.id][idx].maxOtHours = 0; setBranchData(nd); }
                                                                                }}
                                                                                title="ระบุเวลาเลิกงานเป้าหมาย (เช่น 22:30) เพื่อคำนวณ OT อัตโนมัติ"
                                                                                onBlur={async (e) => {
                                                                                    let val = e.target.value;
                                                                                    if (val && !val.includes(':') && val.length >= 3 && val.length <= 4) {
                                                                                        val = val.padStart(4, '0');
                                                                                        val = val.substring(0, 2) + ':' + val.substring(2, 4);
                                                                                    }
                                                                                    setBranchData(prev => {
                                                                                        const nd = JSON.parse(JSON.stringify(prev));
                                                                                        if (nd.matrix?.[key]?.duties?.[duty.id]?.[idx]) {
                                                                                            nd.matrix[key].duties[duty.id][idx].targetEndTime = val;
                                                                                            nd.matrix[key].duties[duty.id][idx].maxOtHours = 0;
                                                                                        }
                                                                                        if (activeBranchId) setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd).catch(console.error);
                                                                                        return nd;
                                                                                    });
                                                                                }} />
                                                                            {(!matrixSlot.targetEndTime && matrixSlot.maxOtHours > 0) && (
                                                                                <button onClick={async () => {
                                                                                    const nd = JSON.parse(JSON.stringify(branchData));
                                                                                    nd.matrix[key].duties[duty.id][idx].maxOtHours = 0;
                                                                                    setBranchData(nd);
                                                                                    if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
                                                                                }} className="text-[9px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded px-1.5 py-1 flex flex-shrink-0 items-center justify-center cursor-pointer transition-colors shadow-sm" title="คลิกเพื่อลบ OT เก่าที่ค้างอยู่">
                                                                                    ลบ {matrixSlot.maxOtHours}H
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {(() => {
                                                                            if (!matrixSlot.targetEndTime || !matrixSlot.targetEndTime.includes(':')) return null;
                                                                            let previewOt = 0;
                                                                            const previewPreset = branchData.shiftPresets?.find(p => p.id === matrixSlot.shiftPresetId) || branchData.shiftPresets?.[0];
                                                                            if (previewPreset) {
                                                                                const { endTime: previewEndTime } = getShiftTimesForStaff('OC', previewPreset);
                                                                                previewOt = calculateOtHours(matrixSlot.targetEndTime, previewEndTime);
                                                                            }
                                                                            return (
                                                                                <div className={`text-[8px] sm:text-[9px] font-black bg-white px-2 py-1.5 rounded-lg shadow-sm border text-center mt-1 ${previewOt > 0 ? 'text-rose-500 border-rose-200' : 'text-slate-400 border-slate-200'}`} title={`ชั่วโมง OT สุทธิ: ${previewOt}H`}>
                                                                                    ชั่วโมง OT: {previewOt > 0 ? `+${previewOt}H` : '0H'}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                {authRole === 'superadmin' && <button onClick={async () => {
                                                                    const nd = JSON.parse(JSON.stringify(branchData));
                                                                    if (Array.isArray(nd.matrix?.[key]?.duties?.[duty.id])) {
                                                                        nd.matrix[key].duties[duty.id].splice(idx, 1);
                                                                        setBranchData(nd);
                                                                        if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);

                                                                        // เคลียร์พนักงานออกจากตารางกะงานอัตโนมัติเมื่อลบ Slot ออก
                                                                        setSchedule(prevSched => {
                                                                            let hasSchedChanges = false;
                                                                            const newSched = JSON.parse(JSON.stringify(prevSched));
                                                                            Object.keys(newSched).forEach(dateStr => {
                                                                                const dayType = getDayType(dateStr, nd.holidays, nd.holidayCycles);

                                                                                if (dayType === key && newSched[dateStr].duties?.[duty.id]) {
                                                                                    if (newSched[dateStr].duties[duty.id].length > idx) {
                                                                                        newSched[dateStr].duties[duty.id].splice(idx, 1);
                                                                                        hasSchedChanges = true;
                                                                                    }
                                                                                }
                                                                            }); if (hasSchedChanges && activeBranchId) autoSaveSchedule(newSched, true);
                                                                            return newSched;
                                                                        });
                                                                    }
                                                                }} className="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full p-1.5 transition"><X className="w-3 h-3" /></button>}
                                                            </div>
                                                        ))}
                                                        {authRole === 'superadmin' && <button onClick={async () => {
                                                            const nd = JSON.parse(JSON.stringify(branchData));
                                                            if (!nd.matrix[key].duties[duty.id]) nd.matrix[key].duties[duty.id] = [];
                                                            const defaultPresetId = branchData.shiftPresets?.[0]?.id || 'S1';
                                                            nd.matrix[key].duties[duty.id].push({ shiftPresetId: defaultPresetId, maxOtHours: 0 });
                                                            setBranchData(nd);
                                                            if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), nd);
                                                        }} className="bg-slate-50 border-2 border-dashed border-slate-200 px-4 sm:px-6 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2.2rem] text-[9px] sm:text-[11px] font-black text-slate-400 hover:border-indigo-500 transition self-stretch sm:self-center">+ SLOT</button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {authRole === 'superadmin' && (
                            <div className="p-6 sm:p-10 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex flex-col xl:flex-row gap-6">
                                    <div className="flex-[3]">
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">พยากรณ์ TC รายชั่วโมง</h3>
                                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                                            {hours.map(hour => (
                                                <div key={hour} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                                    <label className="text-[9px] font-bold text-slate-500 block text-center mb-1">{hour}:00</label>
                                                    <input
                                                        type="number"
                                                        value={data.hourlyTc?.[hour] || ''}
                                                        onChange={(e) => handleUpdateHourlyTc(key, hour, e.target.value)}
                                                        onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }}
                                                        className="w-full border-t border-slate-100 pt-1 text-center font-bold text-sm outline-none focus:bg-indigo-50"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">ตั้งค่าช่วงเวลาเป้าหมายเตรียมของ</h3>
                                        {(() => {
                                            let prepGoals = data.prepGoals;
                                            if (!prepGoals) {
                                                prepGoals = [
                                                    { id: 'prep_1', name: 'กะเช้า', start: '09', end: '12' },
                                                    { id: 'prep_2', name: 'กะบ่าย', start: '13', end: '22' }
                                                ];
                                            } else if (!Array.isArray(prepGoals)) {
                                                prepGoals = [
                                                    { id: 'prep_1', name: 'กะเช้า', start: prepGoals.morning?.start || '09', end: prepGoals.morning?.end || '12' },
                                                    { id: 'prep_2', name: 'กะบ่าย', start: prepGoals.afternoon?.start || '13', end: prepGoals.afternoon?.end || '22' }
                                                ];
                                            }

                                            return (
                                                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                                    {prepGoals.map((goal, idx) => (
                                                        <div key={goal.id} className="flex flex-col gap-2 border-b border-slate-100 pb-4 mb-2 last:border-0 last:pb-0 last:mb-0">
                                                            <div className="flex items-center justify-between">
                                                                <input
                                                                    type="text"
                                                                    value={goal.name}
                                                                    onChange={(e) => handleUpdatePrepGoal(key, 'update', { id: goal.id, field: 'name', value: e.target.value })}
                                                                    onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }}
                                                                    className="text-[10px] font-bold text-slate-700 uppercase outline-none bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 w-3/4 pb-0.5"
                                                                    placeholder="ชื่อกะเตรียมของ..."
                                                                />
                                                                <button onClick={() => handleUpdatePrepGoal(key, 'delete', { id: goal.id })} className="text-slate-300 hover:text-red-500 bg-white border border-slate-100 shadow-sm p-1 rounded-md transition"><Trash2 className="w-3 h-3" /></button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <select value={goal.start} onChange={(e) => handleUpdatePrepGoal(key, 'update', { id: goal.id, field: 'start', value: e.target.value })} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none flex-1 bg-white">
                                                                    {hours.map(h => <option key={h} value={h}>{h}:00</option>)}
                                                                </select>
                                                                <span className="text-xs font-bold text-slate-400">-</span>
                                                                <select value={goal.end} onChange={(e) => handleUpdatePrepGoal(key, 'update', { id: goal.id, field: 'end', value: e.target.value })} onBlur={async () => { if (activeBranchId) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'branches', activeBranchId), branchData); }} className="border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none flex-1 bg-white">
                                                                    {hours.map(h => <option key={h} value={h}>{h}:59</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button onClick={() => handleUpdatePrepGoal(key, 'add')} className="w-full bg-slate-50 hover:bg-indigo-50 text-indigo-600 border border-dashed border-indigo-200 py-3 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center gap-1 mt-2">
                                                        <Plus className="w-3 h-3" /> เพิ่มกะเป้าหมายใหม่
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
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
            if (authRole !== 'superadmin') return;
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
                                    <input type="text" value={headerData.title} onChange={e => setEditGuideHeader({ ...editGuideHeader, title: e.target.value })} className="w-full bg-slate-800 text-white font-black text-xl sm:text-2xl border border-slate-600 rounded-lg px-3 py-1 outline-none focus:border-emerald-500" placeholder="หัวข้อหลัก..." />
                                    <input type="text" value={headerData.subtitle} onChange={e => setEditGuideHeader({ ...editGuideHeader, subtitle: e.target.value })} className="w-full bg-slate-800 text-slate-300 font-bold text-xs sm:text-sm border border-slate-600 rounded-lg px-3 py-1 outline-none focus:border-emerald-500" placeholder="คำอธิบาย..." />
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
                                {isEditingGuide ? <><Save className="w-4 h-4" /> บันทึกภาพรวม</> : <><Edit2 className="w-4 h-4" /> แก้ไขภาพรวม</>}
                            </button>
                        )}
                    </div>

                    <div className="flex flex-nowrap overflow-x-auto custom-scrollbar gap-3 sm:gap-4 pb-4">
                        {siteMapData.map((col, cIdx) => (
                            <div key={col.id} className="flex-1 min-w-[200px] bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 flex flex-col">
                                {isEditingGuide ? (
                                    <div className="space-y-3 flex flex-col h-full">
                                        <div className="flex gap-2 flex-wrap 2xl:flex-nowrap">
                                            <input type="text" value={col.title} onChange={e => { const n = [...editSiteMap]; n[cIdx].title = e.target.value; setEditSiteMap(n); }} className="flex-1 w-full min-w-[100px] bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm font-black outline-none focus:border-emerald-500 text-white" placeholder="ชื่อหมวดหมู่..." />
                                            <div className="flex gap-2 w-full 2xl:w-auto">
                                                <select value={col.color || 'text-white'} onChange={e => { const n = [...editSiteMap]; n[cIdx].color = e.target.value; setEditSiteMap(n); }} className="flex-1 2xl:flex-none bg-slate-700 text-[10px] sm:text-xs outline-none rounded p-1 text-white border border-slate-600">
                                                    <option value="text-white">ขาว</option>
                                                    <option value="text-emerald-400">เขียว</option>
                                                    <option value="text-indigo-400">ม่วง</option>
                                                    <option value="text-sky-400">ฟ้า</option>
                                                    <option value="text-orange-400">ส้ม</option>
                                                    <option value="text-rose-400">แดง</option>
                                                    <option value="text-amber-400">เหลือง</option>
                                                </select>
                                                <button onClick={() => { const n = [...editSiteMap]; n.splice(cIdx, 1); setEditSiteMap(n); }} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 rounded-lg transition flex-shrink-0 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                        <textarea value={(col.items || []).join('\n')} onChange={e => { const n = [...editSiteMap]; n[cIdx].items = e.target.value.split('\n'); setEditSiteMap(n); }} className="w-full flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-[10px] sm:text-xs font-bold outline-none focus:border-emerald-500 text-white resize-y" rows={6} placeholder="รายละเอียด (ขึ้นบรรทัดใหม่ = 1 รายการ)"></textarea>
                                    </div>
                                ) : (
                                    <React.Fragment>
                                        <h3 className={`font-black text-sm sm:text-base ${col.color || 'text-white'} mb-3 flex items-center gap-2`}><LayoutDashboard className="w-4 h-4 flex-shrink-0" /> <span className="truncate" title={col.title}>{col.title}</span></h3>
                                        <ul className="text-[10px] sm:text-xs font-bold text-slate-300 space-y-2 list-disc list-inside whitespace-pre-wrap">
                                            {(col.items || []).map((item, i) => item.trim() ? <li key={i} className="break-words">{item}</li> : null)}
                                        </ul>
                                    </React.Fragment>
                                )}
                            </div>
                        ))}
                        {isEditingGuide && (
                            <button onClick={() => { setEditSiteMap([...editSiteMap, { id: 'SM' + Date.now(), title: 'หมวดหมู่ใหม่', color: 'text-emerald-400', items: ['รายการที่ 1'] }]); }} className="flex-1 min-w-[150px] sm:min-w-[200px] bg-white/5 border-2 border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/50 hover:bg-white/10 rounded-2xl flex flex-col items-center justify-center p-4 gap-2 transition min-h-[150px]">
                                <Plus className="w-6 h-6" />
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-center">เพิ่มหมวดหมู่<br />(Add Box)</span>
                            </button>
                        )}
                    </div>

                    <div className="mt-2 bg-white/5 p-5 rounded-2xl border border-white/10 overflow-x-auto custom-scrollbar pb-4 sm:pb-6">
                        {isEditingGuide ? (
                            <div className="flex items-center gap-2 mb-4">
                                <ArrowLeftRight className="w-4 h-4 text-sky-400" />
                                <input type="text" value={workflowData.title1 || 'Manager Workflow (รายเดือน)'} onChange={e => setEditWorkflow({ ...editWorkflow, title1: e.target.value })} className="bg-slate-800 text-white font-black border border-slate-600 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500 min-w-[250px]" placeholder="หัวข้อ Workflow (รายเดือน)..." />
                            </div>
                        ) : (
                            <h3 className="font-black text-sky-400 mb-4 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> {workflowData.title1 || 'Manager Workflow (รายเดือน)'}</h3>
                        )}
                        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-black text-slate-300 w-max mb-6">
                            {workflowData.monthly.map((step, sIdx) => {
                                const theme = getWorkflowTheme(step.theme);
                                return (
                                    <React.Fragment key={step.id}>
                                        {isEditingGuide ? (
                                            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-600">
                                                <textarea value={step.text} onChange={e => { const n = { ...editWorkflow }; n.monthly[sIdx].text = e.target.value; setEditWorkflow(n); }} className="bg-transparent outline-none w-32 text-[10px] resize-none text-white" rows={2} />
                                                <select value={step.theme} onChange={e => { const n = { ...editWorkflow }; n.monthly[sIdx].theme = e.target.value; setEditWorkflow(n); }} className="bg-slate-700 text-[10px] outline-none rounded p-1 text-white"><option value="emerald">เขียว</option><option value="indigo">ม่วง</option><option value="orange">ส้ม</option><option value="sky">ฟ้า</option></select>
                                                <button onClick={() => { const n = { ...editWorkflow }; n.monthly.splice(sIdx, 1); setEditWorkflow(n); }} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
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
                                <button onClick={() => { const n = { ...editWorkflow }; n.monthly.push({ id: 'WM' + Date.now(), text: 'NEW\nSTEP', theme: 'indigo' }); setEditWorkflow(n); }} className="bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 transition">+ เพิ่ม</button>
                            )}
                        </div>
                        <div className="h-px w-full bg-white/10 mb-6"></div>
                        {isEditingGuide ? (
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarDaysIcon className="w-4 h-4 text-amber-400" />
                                <input type="text" value={workflowData.title2 || 'Manager Workflow (รายวัน)'} onChange={e => setEditWorkflow({ ...editWorkflow, title2: e.target.value })} className="bg-slate-800 text-white font-black border border-slate-600 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500 min-w-[250px]" placeholder="หัวข้อ Workflow (รายวัน)..." />
                            </div>
                        ) : (
                            <h3 className="font-black text-amber-400 mb-4 flex items-center gap-2"><CalendarDaysIcon className="w-4 h-4" /> {workflowData.title2 || 'Manager Workflow (รายวัน)'}</h3>
                        )}
                        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-black text-slate-300 w-max">
                            {workflowData.daily.map((step, sIdx) => {
                                const theme = getWorkflowTheme(step.theme);
                                return (
                                    <React.Fragment key={step.id}>
                                        {isEditingGuide ? (
                                            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-600">
                                                <textarea value={step.text} onChange={e => { const n = { ...editWorkflow }; n.daily[sIdx].text = e.target.value; setEditWorkflow(n); }} className="bg-transparent outline-none w-32 text-[10px] resize-none text-white" rows={2} />
                                                <select value={step.theme} onChange={e => { const n = { ...editWorkflow }; n.daily[sIdx].theme = e.target.value; setEditWorkflow(n); }} className="bg-slate-700 text-[10px] outline-none rounded p-1 text-white"><option value="emerald">เขียว</option><option value="indigo">ม่วง</option><option value="orange">ส้ม</option><option value="sky">ฟ้า</option></select>
                                                <button onClick={() => { const n = { ...editWorkflow }; n.daily.splice(sIdx, 1); setEditWorkflow(n); }} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
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
                                <button onClick={() => { const n = { ...editWorkflow }; n.daily.push({ id: 'WD' + Date.now(), text: 'NEW\nSTEP', theme: 'sky' }); setEditWorkflow(n); }} className="bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 transition">+ เพิ่ม</button>
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
                                    <input type="text" value={headerData.journeyTitle} onChange={e => setEditGuideHeader({ ...editGuideHeader, journeyTitle: e.target.value })} className="w-full bg-slate-50 text-slate-800 font-black text-xl sm:text-2xl border border-slate-200 rounded-lg px-3 py-1 outline-none focus:border-indigo-500" placeholder="หัวข้อ Journey..." />
                                    <input type="text" value={headerData.journeySubtitle} onChange={e => setEditGuideHeader({ ...editGuideHeader, journeySubtitle: e.target.value })} className="w-full bg-slate-50 text-slate-500 font-bold text-xs sm:text-sm border border-slate-200 rounded-lg px-3 py-1 outline-none focus:border-indigo-500" placeholder="คำอธิบาย..." />
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
                                {isEditingGuide ? <><Save className="w-4 h-4" /> บันทึกคู่มือ</> : <><Edit2 className="w-4 h-4" /> แก้ไขคู่มือ</>}
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
                                            <button onClick={() => { setEditGuideSteps(editGuideSteps.filter(s => s.id !== step.id)); }} className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition shadow-sm"><Trash2 className="w-4 h-4" /></button>
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
                                    setEditGuideSteps([...editGuideSteps, { id: 'G' + Date.now(), title: 'หัวข้อใหม่', content: '', image: '', color: 'bg-indigo-600', stepNum: String(editGuideSteps.length + 1) }]);
                                }} className="w-full border-2 border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 py-4 rounded-2xl font-black transition flex items-center justify-center gap-2">
                                    <Plus className="w-5 h-5" /> เพิ่มหัวข้อใหม่ (Add Step)
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

    function renderHeadTeamView() {
        return (
            <div className="flex flex-col w-full gap-0 animate-in slide-in-from-bottom-6 duration-500">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-10 print:hidden w-full mb-6">
                    <div className="relative flex items-center gap-2 sm:gap-4 w-full xl:flex-1 min-w-0">
                        <button onClick={() => scrollDates('left')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronLeft className="w-5 h-5 sm:w-8 sm:h-8" /></button>
                        <div ref={dateBarRef} className="flex-1 flex gap-3 sm:gap-5 overflow-x-auto pb-4 sm:pb-6 pt-2 sm:pt-3 custom-scrollbar px-2 sm:px-3 select-none touch-pan-x snap-x">
                            {CALENDAR_DAYS.map(d => {
                                const isSelected = selectedDateStr === d.dateStr;
                                const isHoliday = isDateHoliday(d.dateStr, branchData.holidays);
                                return (
                                    <button key={d.dateStr} onClick={() => setSelectedDateStr(d.dateStr)} className={`flex-shrink-0 w-16 h-20 sm:w-24 sm:h-28 rounded-[1.5rem] sm:rounded-[2.2rem] flex flex-col items-center justify-center transition-all border-2 snap-center ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl sm:shadow-2xl scale-105 z-20 ring-4 sm:ring-8 ring-indigo-50' : isHoliday ? 'bg-red-500 text-white border-red-600 shadow-sm sm:shadow-md' : d.type === 'saturday' ? 'bg-purple-500 text-white border-purple-600 shadow-sm sm:shadow-md' : d.type === 'sunday' ? 'bg-orange-500 text-white border-orange-600 shadow-sm sm:shadow-md' : d.type === 'friday' ? 'bg-sky-500 text-white border-sky-600 shadow-sm sm:shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-400 shadow-sm'}`}>
                                        <span className={`text-[9px] sm:text-[11px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-100 opacity-80' : 'opacity-40'}`}>{d.dayLabel}</span>
                                        <span className="text-2xl sm:text-4xl font-black mt-1 sm:mt-2 leading-none">{d.dayNum}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => scrollDates('right')} className="hidden sm:flex flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 bg-white border-2 border-slate-100 rounded-full items-center justify-center shadow-lg text-indigo-600 active:scale-90 transition z-10"><ChevronRight className="w-5 h-5 sm:w-8 sm:h-8" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto mt-4 xl:mt-0 justify-end">
                        <button onClick={handleShareToLine} className="flex-1 xl:flex-none bg-[#00B900] hover:bg-[#009900] text-white px-4 sm:px-6 py-4 sm:py-5 rounded-xl sm:rounded-[2rem] font-black flex justify-center items-center gap-2 shadow-lg active:scale-95 transition-all text-[10px] sm:text-sm"><MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Copy to LINE</span><span className="sm:hidden">Share</span></button>
                    </div>
                </div>
                {renderManagerDailyTable()}
            </div>
        );
    }

    function renderPtLedgerWidget() {
        const config = branchData.ptConfig;
        if (!config?.monthlyBudget && !config?.monthlyBudgetService && !config?.monthlyBudgetKitchen) return null;

        // 1. DAILY VIEW WIDGET
        if (managerViewMode === 'daily') {
            const allowanceSvc = ptLedger.service.dailyAllowance[selectedDateStr] || { total: 0, baseAvg: 0, leave: 0, vacancy: 0, event: 0 };
            const usageSvc = ptLedger.service.dailyUsage[selectedDateStr] || { base: 0, event: 0 };
            const usedSvcTotal = usageSvc.base + usageSvc.event;
            const limitSvcPercent = allowanceSvc.total > 0 ? (usedSvcTotal / allowanceSvc.total) * 100 : 0;

            const allowanceKit = ptLedger.kitchen.dailyAllowance[selectedDateStr] || { total: 0, baseAvg: 0, leave: 0, vacancy: 0, event: 0 };
            const usageKit = ptLedger.kitchen.dailyUsage[selectedDateStr] || { base: 0, event: 0 };
            const usedKitTotal = usageKit.base + usageKit.event;
            const limitKitPercent = allowanceKit.total > 0 ? (usedKitTotal / allowanceKit.total) * 100 : 0;

            let colorSvc = 'bg-emerald-500';
            if (usedSvcTotal > allowanceSvc.total) colorSvc = 'bg-red-500';
            else if (limitSvcPercent >= 80) colorSvc = 'bg-amber-500';

            let colorKit = 'bg-orange-500';
            if (usedKitTotal > allowanceKit.total) colorKit = 'bg-red-500';
            else if (limitKitPercent >= 80) colorKit = 'bg-amber-500';

            const pendingExtraPtSvc = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && (r.dept || 'service') === 'service' && r.status === 'PENDING_MANAGER');
            const pendingExtraPtKit = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && r.dept === 'kitchen' && r.status === 'PENDING_MANAGER');
            const approvedExtraPtSvc = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && (r.dept || 'service') === 'service' && r.status === 'APPROVED');
            const approvedExtraPtKit = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && r.dept === 'kitchen' && r.status === 'APPROVED');
            const rejectedExtraPtSvc = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && (r.dept || 'service') === 'service' && r.status === 'REJECTED');
            const rejectedExtraPtKit = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && r.dept === 'kitchen' && r.status === 'REJECTED');

            return (
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm print:hidden w-full flex-1 flex flex-col justify-between gap-4 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" /> กระเป๋าชั่วโมง PT รายวัน
                        </h3>
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2">
                        {/* Service Section */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] sm:text-xs font-black text-slate-500 uppercase block">แผนกบริการ (FOH)</span>
                                    <span className="text-[8px] font-bold text-slate-400 block mt-0.5">งบเฉลี่ย {allowanceSvc.baseAvg.toFixed(1)}H + ลา {allowanceSvc.leave.toFixed(1)}H + ว่าง {allowanceSvc.vacancy.toFixed(1)}H + พิเศษ {allowanceSvc.event.toFixed(1)}H</span>
                                </div>
                                <span className="text-sm font-black text-slate-800">{usedSvcTotal.toFixed(1)} <span className="text-[10px] text-slate-400">/ {allowanceSvc.total.toFixed(1)} ชม.</span></span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                                <div className={`h-full ${colorSvc} transition-all duration-500 rounded-full`} style={{ width: `${Math.min(limitSvcPercent, 100)}%` }}></div>
                            </div>
                            {allowanceSvc.event > 0 && (
                                <div className="mt-2 bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-800 text-[10px] font-bold">
                                    <div className="flex items-center gap-1 font-black">
                                        <span>✨ ได้รับอนุมัติโควตาพิเศษ +${allowanceSvc.event.toFixed(1)} ชม.</span>
                                    </div>
                                    {approvedExtraPtSvc?.reason && (
                                        <div className="text-[9px] text-emerald-600 mt-0.5">
                                            <span className="font-semibold text-emerald-700">เหตุผล:</span> {approvedExtraPtSvc.reason}
                                        </div>
                                    )}
                                </div>
                            )}

                            {usedSvcTotal > allowanceSvc.total && (
                                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-red-100 pt-2 bg-red-50/50 p-2 rounded-lg">
                                    <span className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> ชั่วโมงเกินโควตา +{(usedSvcTotal - allowanceSvc.total).toFixed(1)} ชม.</span>
                                    {pendingExtraPtSvc ? (
                                        <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-center">⏳ รอ AM อนุมัติ ({pendingExtraPtSvc.requestedHours.toFixed(1)}H)</span>
                                    ) : (
                                        <button onClick={() => { setForecastTc(''); setForecastReason(''); setForecastEvidence(''); setActiveDept('service'); setPtRequestMode('OVER_BUDGET'); setShowForecastModal(true); }} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-md text-[8px] font-black transition-colors self-end">ขออนุมัติ</button>
                                    )}
                                </div>
                            )}
                            {rejectedExtraPtSvc && (
                                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border border-red-200 bg-red-50 p-2 rounded-lg">
                                    <span className="text-[9px] font-black text-red-600 uppercase flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> คำขอโควตาพิเศษถูกปฏิเสธ (+{rejectedExtraPtSvc.requestedHours.toFixed(1)} ชม.)</span>
                                    <span className="text-[8px] font-black text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded-md text-center font-bold">ถูกปฏิเสธ</span>
                                </div>
                            )}
                        </div>

                        {/* Kitchen Section */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] sm:text-xs font-black text-slate-500 uppercase block">แผนกครัว (BOH)</span>
                                    <span className="text-[8px] font-bold text-slate-400 block mt-0.5">งบเฉลี่ย {allowanceKit.baseAvg.toFixed(1)}H + ลา {allowanceKit.leave.toFixed(1)}H + ว่าง {allowanceKit.vacancy.toFixed(1)}H + พิเศษ {allowanceKit.event.toFixed(1)}H</span>
                                </div>
                                <span className="text-sm font-black text-slate-800">{usedKitTotal.toFixed(1)} <span className="text-[10px] text-slate-400 font-bold">/ {allowanceKit.total.toFixed(1)} ชม.</span></span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                                <div className={`h-full ${colorKit} transition-all duration-500 rounded-full`} style={{ width: `${Math.min(limitKitPercent, 100)}%` }}></div>
                            </div>
                            {allowanceKit.event > 0 && (
                                <div className="mt-2 bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-800 text-[10px] font-bold">
                                    <div className="flex items-center gap-1 font-black">
                                        <span>✨ ได้รับอนุมัติโควตาพิเศษ +${allowanceKit.event.toFixed(1)} ชม.</span>
                                    </div>
                                    {approvedExtraPtKit?.reason && (
                                        <div className="text-[9px] text-emerald-600 mt-0.5">
                                            <span className="font-semibold text-emerald-700">เหตุผล:</span> {approvedExtraPtKit.reason}
                                        </div>
                                    )}
                                </div>
                            )}

                            {usedKitTotal > allowanceKit.total && (
                                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-red-100 pt-2 bg-red-50/50 p-2 rounded-lg">
                                    <span className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> ชั่วโมงเกินโควตา +{(usedKitTotal - allowanceKit.total).toFixed(1)} ชม.</span>
                                    {pendingExtraPtKit ? (
                                        <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-center">⏳ รอ AM อนุมัติ ({pendingExtraPtKit.requestedHours.toFixed(1)}H)</span>
                                    ) : (
                                        <button onClick={() => { setForecastTc(''); setForecastReason(''); setForecastEvidence(''); setActiveDept('kitchen'); setPtRequestMode('OVER_BUDGET'); setShowForecastModal(true); }} className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-md text-[8px] font-black transition-colors self-end">ขออนุมัติ</button>
                                    )}
                                </div>
                            )}
                            {rejectedExtraPtKit && (
                                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border border-red-200 bg-red-50 p-2 rounded-lg">
                                    <span className="text-[9px] font-black text-red-600 uppercase flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> คำขอโควตาพิเศษถูกปฏิเสธ (+{rejectedExtraPtKit.requestedHours.toFixed(1)} ชม.)</span>
                                    <span className="text-[8px] font-black text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded-md text-center font-bold">ถูกปฏิเสธ</span>
                                </div>
                            )}
                        </div>
                    </div>



                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 w-full mt-2">
                        <button onClick={() => setShowPtLedgerDetails(true)} className="text-[10px] sm:text-xs font-bold text-indigo-500 hover:text-indigo-700 underline flex items-center gap-1"><BarChart3 className="w-3 h-3" /> ดูรายละเอียดการใช้ PT</button>
                        {(usedSvcTotal > allowanceSvc.total || usedKitTotal > allowanceKit.total) && <p className="text-[10px] sm:text-xs font-black text-red-500 uppercase animate-pulse">⚠️ เกินโควตาประจำวัน กรุณาส่งขออนุมัติ</p>}
                    </div>
                </div>
            );
        }

        // 2. WEEKLY VIEW WIDGET (Shows all 7 days)
        if (managerViewMode === 'weekly') {
            const daysOfWeek = WEEKLY_DAYS || [];
            return (
                <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm print:hidden w-full flex-1 flex flex-col gap-4 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-500" /> กระเป๋าชั่วโมง PT รายสัปดาห์ (7 วัน)
                        </h3>
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Weekly Overview</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 my-1">
                        {daysOfWeek.map(day => {
                            const dateStr = day.dateStr;
                            const pReqSvc = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && (r.dept || 'service') === 'service' && r.status === 'PENDING_MANAGER');
                            const pReqKit = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && r.dept === 'kitchen' && r.status === 'PENDING_MANAGER');
                            const approvedSvc = ptLedger.service.dailyAllowance[dateStr]?.event || 0;
                            const approvedKit = ptLedger.kitchen.dailyAllowance[dateStr]?.event || 0;
                            const approvedReqSvc = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && (r.dept || 'service') === 'service' && r.status === 'APPROVED');
                            const approvedReqKit = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && r.dept === 'kitchen' && r.status === 'APPROVED');
                            const rReqSvc = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && (r.dept || 'service') === 'service' && r.status === 'REJECTED');
                            const rReqKit = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === dateStr && r.dept === 'kitchen' && r.status === 'REJECTED');
                            const aSvc = ptLedger.service.dailyAllowance[dateStr]?.total || 0;
                            const uSvc = (ptLedger.service.dailyUsage[dateStr]?.base || 0) + (ptLedger.service.dailyUsage[dateStr]?.event || 0);
                            const aKit = ptLedger.kitchen.dailyAllowance[dateStr]?.total || 0;
                            const uKit = (ptLedger.kitchen.dailyUsage[dateStr]?.base || 0) + (ptLedger.kitchen.dailyUsage[dateStr]?.event || 0);

                            const isSvcOver = uSvc > aSvc;
                            const isKitOver = uKit > aKit;
                            const isToday = selectedDateStr === dateStr;

                            return (
                                <button key={dateStr} onClick={() => setSelectedDateStr(dateStr)} className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between min-h-[100px] ${isToday ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-100' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{day.dayLabel}</div>
                                        <div className="text-xs font-black text-slate-700">{day.dayNum} {THAI_MONTHS[selectedMonth]?.substring(0, 3)}</div>
                                    </div>
                                    <div className="mt-2 space-y-1 w-full text-[9px] font-bold">                                      <div className="flex justify-between items-center gap-1">
                                        <span className="text-slate-500 flex items-center gap-0.5 truncate">
                                            บริการ:
                                            {pReqSvc && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" title="รออนุมัติชั่วโมง"></span>}
                                            {!pReqSvc && approvedSvc > 0 && <span className="text-[8px] text-emerald-600 font-black flex-shrink-0" title={`โควตาพิเศษ +${approvedSvc}H${approvedReqSvc?.reason ? ` (เหตุผล: ${approvedReqSvc.reason})` : ''}`}>✨</span>}
                                            {!pReqSvc && approvedSvc === 0 && rReqSvc && <span className="text-[8px] text-red-500 font-black flex-shrink-0" title="ถูกปฏิเสธ">❌</span>}
                                        </span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className={isSvcOver ? 'text-red-600 font-black' : 'text-slate-700'}>{uSvc.toFixed(0)}/{aSvc.toFixed(0)}H</span>
                                            {isSvcOver && (
                                                pReqSvc ? (
                                                    <span className="text-[8px] text-amber-600 font-black" title="รอ AM อนุมัติ">⏳</span>
                                                ) : rReqSvc ? (
                                                    <span className="text-[8px] text-red-600 font-black" title="ถูกปฏิเสธ">❌</span>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); setForecastTc(''); setForecastReason(''); setForecastEvidence(''); setActiveDept('service'); setPtRequestMode('OVER_BUDGET'); setSelectedDateStr(dateStr); setShowForecastModal(true); }} className="bg-red-500 hover:bg-red-600 text-white px-1 py-0.5 rounded text-[8px] font-black transition-colors">ขอ</button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                        <div className="flex justify-between items-center gap-1">
                                            <span className="text-slate-500 flex items-center gap-0.5 truncate">
                                                ครัว:
                                                {pReqKit && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" title="รออนุมัติชั่วโมง"></span>}
                                                {!pReqKit && approvedKit > 0 && <span className="text-[8px] text-emerald-600 font-black flex-shrink-0" title={`โควตาพิเศษ +${approvedKit}H${approvedReqKit?.reason ? ` (เหตุผล: ${approvedReqKit.reason})` : ''}`}>✨</span>}
                                                {!pReqKit && approvedKit === 0 && rReqKit && <span className="text-[8px] text-red-500 font-black flex-shrink-0" title="ถูกปฏิเสธ">❌</span>}
                                            </span>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <span className={isKitOver ? 'text-red-600 font-black' : 'text-slate-700'}>{uKit.toFixed(0)}/{aKit.toFixed(0)}H</span>
                                                {isKitOver && (
                                                    pReqKit ? (
                                                        <span className="text-[8px] text-amber-600 font-black" title="รอ AM อนุมัติ">⏳</span>
                                                    ) : rReqKit ? (
                                                        <span className="text-[8px] text-red-600 font-black" title="ถูกปฏิเสธ">❌</span>
                                                    ) : (
                                                        <button onClick={(e) => { e.stopPropagation(); setForecastTc(''); setForecastReason(''); setForecastEvidence(''); setActiveDept('kitchen'); setPtRequestMode('OVER_BUDGET'); setSelectedDateStr(dateStr); setShowForecastModal(true); }} className="bg-red-500 hover:bg-red-600 text-white px-1 py-0.5 rounded text-[8px] font-black transition-colors">ขอ</button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {(() => {
                        const approvedSvcOnSelected = ptLedger.service.dailyAllowance[selectedDateStr]?.event || 0;
                        const approvedKitOnSelected = ptLedger.kitchen.dailyAllowance[selectedDateStr]?.event || 0;
                        const approvedReqSvcOnSelected = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && (r.dept || 'service') === 'service' && r.status === 'APPROVED');
                        const approvedReqKitOnSelected = pendingRequests.find(r => r.reqType === 'EXTRA_PT' && r.dateStr === selectedDateStr && r.dept === 'kitchen' && r.status === 'APPROVED');

                        if (approvedSvcOnSelected === 0 && approvedKitOnSelected === 0) return null;

                        return (
                            <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl text-[10px] font-bold flex flex-col gap-1.5 mt-1 w-full text-left">
                                <div className="text-slate-500 font-black flex items-center gap-1">
                                    <span>📅 โควตาพิเศษของวันที่ {new Date(selectedDateStr + "T00:00:00").toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}:</span>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full">
                                    {approvedSvcOnSelected > 0 && (
                                        <div className="flex-1 bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-800">
                                            <div className="font-black">บริการ (FOH): +{approvedSvcOnSelected.toFixed(1)} ชม.</div>
                                            {approvedReqSvcOnSelected?.reason && <div className="text-[9px] text-emerald-600 mt-0.5"><span className="font-semibold text-emerald-700">เหตุผล:</span> {approvedReqSvcOnSelected.reason}</div>}
                                        </div>
                                    )}
                                    {approvedKitOnSelected > 0 && (
                                        <div className="flex-1 bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-emerald-800">
                                            <div className="font-black">ครัว (BOH): +{approvedKitOnSelected.toFixed(1)} ชม.</div>
                                            {approvedReqKitOnSelected?.reason && <div className="text-[9px] text-emerald-600 mt-0.5"><span className="font-semibold text-emerald-700">เหตุผล:</span> {approvedReqKitOnSelected.reason}</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 w-full mt-2">
                        <button onClick={() => setShowPtLedgerDetails(true)} className="text-[10px] sm:text-xs font-bold text-indigo-500 hover:text-indigo-700 underline flex items-center gap-1"><BarChart3 className="w-3 h-3" /> ดูรายละเอียดการใช้ PT</button>
                        <p className="text-[10px] font-bold text-slate-400">รวมใช้งานสัปดาห์นี้: <span className="text-slate-700 font-black">{daysOfWeek.reduce((sum, d) => sum + (ptLedger.dailyUsage[d.dateStr]?.base || 0) + (ptLedger.dailyUsage[d.dateStr]?.event || 0), 0).toFixed(1)}H</span></p>
                    </div>
                </div>
            );
        }

        // 3. MONTHLY VIEW WIDGET (Default overall overview)
        const usedBaseAll = ptLedger.usedBaseHours;
        const baseTotalAllowance = ptLedger.baseTotalAllowance;
        const usedEvent = ptLedger.usedEventHours;
        const eventExtras = ptLedger.eventExtras;

        const baseUsagePercent = baseTotalAllowance > 0 ? (usedBaseAll / baseTotalAllowance) * 100 : 0;
        const eventUsagePercent = eventExtras > 0 ? (usedEvent / eventExtras) * 100 : (usedEvent > 0 ? 100 : 0);

        let baseColor = 'bg-indigo-500';
        if (baseUsagePercent >= 100) baseColor = 'bg-red-500';
        else if (baseUsagePercent >= 80) baseColor = 'bg-amber-500';

        let eventColor = 'bg-amber-500';
        if (eventUsagePercent >= 100) eventColor = 'bg-red-500';

        return (
            <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm print:hidden w-full flex-1 flex flex-col justify-between gap-4 animate-in fade-in duration-500 min-h-[220px]">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-100 pb-2">
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-500" /> กระเป๋าชั่วโมง PT รายเดือน
                        </h3>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1">ยอดรวมชั่วโมงที่ใช้ไป: <span className="text-slate-800 font-black">{ptLedger.usedHours.toFixed(1)} / {ptLedger.totalAllowance.toFixed(1)} ชม.</span></p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{THAI_MONTHS[selectedMonth]} {selectedYear + 543}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                    {/* Service Division */}
                    <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] sm:text-xs font-black text-indigo-700 uppercase">บริการ (FOH)</span>
                            <span className="text-xs font-black text-slate-800">{ptLedger.service.usedHours.toFixed(1)} <span className="text-[9px] text-slate-400">/ {ptLedger.service.totalAllowance.toFixed(1)} ชม.</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-500 rounded-full" style={{ width: `${Math.min(ptLedger.service.totalAllowance > 0 ? (ptLedger.service.usedHours / ptLedger.service.totalAllowance) * 100 : 0, 100)}%` }}></div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">งบตั้งต้น {(ptLedger.service.baseAllowance || 0).toFixed(0)}H | ชดลา {(ptLedger.service.leaveRefunds || 0).toFixed(0)}H | ชดว่าง {(ptLedger.service.vacancyCompensations || 0).toFixed(0)}H | พิเศษ {(ptLedger.service.eventExtras || 0).toFixed(0)}H</span>
                    </div>

                    {/* Kitchen Division */}
                    <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] sm:text-xs font-black text-orange-700 uppercase">ครัว (BOH)</span>
                            <span className="text-xs font-black text-slate-800">{ptLedger.kitchen.usedHours.toFixed(1)} <span className="text-[9px] text-slate-400">/ {ptLedger.kitchen.totalAllowance.toFixed(1)} ชม.</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 transition-all duration-500 rounded-full" style={{ width: `${Math.min(ptLedger.kitchen.totalAllowance > 0 ? (ptLedger.kitchen.usedHours / ptLedger.kitchen.totalAllowance) * 100 : 0, 100)}%` }}></div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">งบตั้งต้น {(ptLedger.kitchen.baseAllowance || 0).toFixed(0)}H | ชดลา {(ptLedger.kitchen.leaveRefunds || 0).toFixed(0)}H | ชดว่าง {(ptLedger.kitchen.vacancyCompensations || 0).toFixed(0)}H | พิเศษ {(ptLedger.kitchen.eventExtras || 0).toFixed(0)}H</span>
                    </div>
                </div>



                <div className="flex justify-between items-center mt-1 w-full border-t border-slate-100 pt-2">
                    <button onClick={() => setShowPtLedgerDetails(true)} className="text-[10px] sm:text-xs font-bold text-indigo-500 hover:text-indigo-700 underline flex items-center gap-1"><BarChart3 className="w-3 h-3" /> ดูรายละเอียดการใช้ PT</button>
                    {ptLedger.usedHours > ptLedger.totalAllowance && <p className="text-[10px] sm:text-xs font-black text-red-500 uppercase animate-pulse">⚠️ โควตาทะลุงบรายเดือน กรุณาตรวจสอบ</p>}
                </div>
            </div>
        );
    }

    function renderOtLedgerWidget() {
        if (otLedger.budgetHours === 0 && otLedger.totalOtHours === 0) return null;

        const usedOt = otLedger.totalOtHours;
        const budget = otLedger.budgetHours;
        const usagePercent = otLedger.usagePercent;

        let barColor = 'bg-indigo-500';
        if (usagePercent >= 100) barColor = 'bg-red-500';
        else if (usagePercent >= 80) barColor = 'bg-amber-500';

        return (
            <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm print:hidden w-full flex-1 flex flex-col justify-between gap-4 animate-in fade-in duration-500 min-h-[200px]">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-500" /> กระเป๋าชั่วโมง OT (FT)</h3>
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1">ยอดรวม OT ที่ใช้ไป: <span className="text-slate-800">{usedOt.toFixed(1)} / {budget.toFixed(1)} ชม.</span></p>
                    </div>
                </div>

                <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 flex flex-col gap-2 mt-auto">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] sm:text-xs font-black text-slate-500 uppercase">โควตา OT ทั้งเดือน</span>
                        <span className="text-sm font-black text-slate-800">{usedOt.toFixed(1)} <span className="text-[10px] text-slate-400">/ {budget.toFixed(1)} ชม.</span></span>
                    </div>
                    <div className="h-2.5 sm:h-3 w-full bg-slate-200 rounded-full overflow-hidden"><div className={`h-full ${barColor} transition-all duration-500 rounded-full`} style={{ width: `${Math.min(usagePercent, 100)}%` }}></div></div>
                </div>

                <div className="flex justify-between items-center mt-1">
                    <button onClick={() => setShowOtLedgerDetails(true)} className="text-[10px] sm:text-xs font-bold text-indigo-500 hover:text-indigo-700 underline flex items-center gap-1"><BarChart3 className="w-3 h-3" /> ดูรายละเอียดการใช้ OT</button>
                    {usedOt > budget && <p className="text-[10px] sm:text-xs font-black text-red-500 uppercase animate-pulse">⚠️ โควตา OT เกินกำหนด</p>}
                </div>
            </div>
        );
    }

    function renderAreaDashboard() {
        const am = globalConfig.areaManagers?.find(a => a.user === authUser);
        if (!am) return <div className="p-10 text-center text-slate-500 font-bold">ไม่พบข้อมูลผู้จัดการเขต</div>;

        return (
            <div className="flex-1 space-y-6 sm:space-y-10 animate-in fade-in duration-500 pb-24 w-full">
                <div className="bg-slate-900 rounded-[2rem] p-8 sm:p-10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-white">
                    <div className="flex items-center gap-6">
                        <div className="bg-indigo-500 p-4 rounded-2xl shadow-inner"><UserCircle className="w-10 h-10 text-white" /></div>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">Area Manager Dashboard</h2>
                            <p className="text-indigo-200 font-bold text-sm mt-1">ยินดีต้อนรับ, {am?.name || authUser} | ดูแลทั้งหมด {am?.branches?.length || 0} สาขา</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-800 px-5 py-3 rounded-2xl border border-slate-700">
                        <CalendarIcon className="w-5 h-5 text-emerald-400" />
                        <span className="font-black text-lg tracking-widest uppercase">{THAI_MONTHS[selectedMonth]} {selectedYear}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {am?.branches?.length === 0 ? (
                        <div className="text-center p-10 text-slate-400 font-bold bg-white rounded-[2rem] border border-dashed border-slate-200">ยังไม่มีสาขาที่อยู่ในการดูแล</div>
                    ) : am.branches.map(bId => {
                        const branchName = globalConfig.branches?.find(b => b.id === bId)?.name || bId;
                        const bData = amData[bId]?.branch;
                        const sData = amData[bId]?.schedule || {};

                        if (!amData[bId]) {
                            return <div key={bId} className="bg-white p-8 rounded-[2rem] border border-slate-200 text-center text-slate-400 font-bold shadow-sm"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> กำลังโหลดข้อมูล {branchName}...</div>;
                        }

                        const staffCount = bData?.staff?.length || 0;
                        const ptCount = bData?.staff?.filter(s => s.pos.includes('PT')).length || 0;

                        const bDays = getDaysInMonth(selectedYear, selectedMonth, bData?.holidays || []);
                        let targetFtService = 0, targetFtKitchen = 0;

                        const headServiceLimit = bData?.staffLimits?.['FOH_HEAD'];
                        if (headServiceLimit) targetFtService += parseInt(headServiceLimit, 10);
                        const staffSupportServiceLimit = bData?.staffLimits?.['SERVICE_STAFF_SUPPORT_FT'];
                        if (staffSupportServiceLimit) targetFtService += parseInt(staffSupportServiceLimit, 10);

                        const headKitchenLimit = bData?.staffLimits?.['BOH_HEAD'];
                        if (headKitchenLimit) targetFtKitchen += parseInt(headKitchenLimit, 10);
                        const staffSupportKitchenLimit = bData?.staffLimits?.['KITCHEN_STAFF_SUPPORT_FT'];
                        if (staffSupportKitchenLimit) targetFtKitchen += parseInt(staffSupportKitchenLimit, 10);

                        const compHrSvc = bData?.ptConfig?.compHoursPerDayService ?? 8;
                        const compHrKit = bData?.ptConfig?.compHoursPerDayKitchen ?? 8;

                        let vacancyComp = 0;
                        bDays.forEach(day => {
                            let actSvc = 0, actKit = 0;
                            (bData?.staff || []).forEach(s => {
                                if (s.pos.includes('PT') || (s.isActive === false && !s.resignDate)) return;
                                if ((!s.startDate || s.startDate <= day.dateStr) && (!s.resignDate || s.resignDate >= day.dateStr)) {
                                    if (s.dept === 'service') actSvc++;
                                    if (s.dept === 'kitchen') actKit++;
                                }
                            });

                            const gapSvc = Math.max(0, targetFtService - actSvc);
                            const gapKit = Math.max(0, targetFtKitchen - actKit);

                            vacancyComp += (gapSvc * compHrSvc) + (gapKit * compHrKit);
                        });

                        let totalOT = 0;
                        let totalLeaves = 0;
                        let leaveRefunds = 0;
                        let eventExtras = 0;
                        let totalPtHours = 0;

                        const staffMap = {};
                        const payrollConfig = {
                            monthlySalaryDivider: 30,
                            otRateMonthly: 1.5,
                            otRateHolidayMonthly: 3.0,
                            otRateFtHourly: 1.5,
                            otRatePt: 1.5,
                            holidayMultiplierFtHourly: 2.0,
                            holidayMultiplierPt: 2.0,
                            ...(bData?.payrollConfig || {})
                        };
                        const ptRate = bData?.ptConfig?.hourlyRate || 0;

                        const staffMapPayroll = {};
                        (bData?.staff || []).forEach(s => {
                            staffMap[s.id] = s;
                            staffMapPayroll[s.id] = {
                                basePay: 0, otPay: 0, holidayPay: 0, totalPay: 0,
                                unpaidLeaveDays: 0, workHours: 0,
                                wageType: s.wageType || 'MONTHLY',
                                baseWage: s.baseWage || 0,
                                pos: s.pos,
                                dept: s.dept || 'service'
                            };
                        });

                        Object.keys(sData).forEach(dateStr => {
                            const [y, m] = dateStr.split('-');
                            if (parseInt(m, 10) - 1 !== selectedMonth || parseInt(y, 10) !== selectedYear) return;

                            const dayData = sData[dateStr];
                            const eventHrsSvc = dayData.eventExtraHoursService !== undefined
                                ? dayData.eventExtraHoursService
                                : (dayData.eventExtraHoursKitchen !== undefined ? 0 : (dayData.eventExtraHours || 0));
                            const eventHrsKit = dayData.eventExtraHoursKitchen || 0;
                            eventExtras += eventHrsSvc + eventHrsKit;

                            if (dayData.leaves) {
                                totalLeaves += dayData.leaves.length;
                                dayData.leaves.forEach(l => {
                                    const staff = staffMap[l.staffId];
                                    if (staff && !staff.pos.includes('PT') && ['AL', 'SL', 'SL_UNPAID', 'PL', 'PL_UNPAID', 'MATERNITY', 'MARRIAGE', 'TRAINING', 'MY_DAY', 'FAMILY_DAY', 'CO'].includes(l.type)) {
                                        leaveRefunds += 8;
                                    }
                                    if (l.staffId && staffMapPayroll[l.staffId]) {
                                        if (['SL_UNPAID', 'PL_UNPAID'].includes(l.type)) {
                                            staffMapPayroll[l.staffId].unpaidLeaveDays += 1;
                                        }
                                    }
                                });
                            }

                            if (dayData.duties) {
                                const dayType = getDayType(dateStr, bData?.holidays, bData?.holidayCycles);
                                const isPublicHoliday = (bData?.holidays || []).some(h => typeof h === 'object' && h.date === dateStr && h.isPublic);

                                Object.keys(dayData.duties).forEach(dutyId => {
                                    const slots = dayData.duties[dutyId] || [];
                                    const matrixSlots = bData?.matrix?.[dayType]?.duties?.[dutyId] || [];
                                    slots.forEach((slot, idx) => {
                                        if (slot.otHours) totalOT += Number(slot.otHours);
                                        if (slot.staffId) {
                                            const actualStaffId = slot.staffId.startsWith('COVER_BY_') ? slot.staffId.replace('COVER_BY_', '') : slot.staffId;
                                            const staff = staffMap[actualStaffId];
                                            if (staff && staff.pos.includes('PT')) {
                                                const mSlot = matrixSlots[idx];
                                                const shiftPreset = bData?.shiftPresets?.find(p => p.id === (slot.shiftPresetId || mSlot?.shiftPresetId));
                                                const times = getShiftTimesForStaff(staff.pos, shiftPreset);
                                                const shiftHrs = getNetWorkHours(times.startTime, times.endTime, staff.pos);
                                                totalPtHours += shiftHrs + Number(slot.otHours || 0);
                                            }

                                            const pStaff = staffMapPayroll[actualStaffId];
                                            if (pStaff) {
                                                const mSlot = matrixSlots?.[idx];
                                                const shiftPreset = bData?.shiftPresets?.find(p => p.id === (slot.shiftPresetId || mSlot?.shiftPresetId));
                                                const { startTime, endTime } = getShiftTimesForStaff(pStaff.pos, shiftPreset);
                                                const workHours = getNetWorkHours(startTime, endTime, pStaff.pos);
                                                const otHours = Number(slot.otHours || 0);

                                                pStaff.workHours += workHours;

                                                if (pStaff.wageType === 'MONTHLY') {
                                                    const monthlyRate = pStaff.baseWage || 0;
                                                    const dailyRate = monthlyRate / (payrollConfig.monthlySalaryDivider || 30);
                                                    const hourlyRate = dailyRate / 8;
                                                    const effectiveOtMultiplier = isPublicHoliday ? (payrollConfig.otRateHolidayMonthly || 3.0) : (payrollConfig.otRateMonthly || 1.5);

                                                    pStaff.otPay += otHours * hourlyRate * effectiveOtMultiplier;
                                                } else {
                                                    const isPt = pStaff.wageType === 'PT';
                                                    const hourlyRate = isPt ? ptRate : (pStaff.baseWage || 0);

                                                    const holidayMultiplier = isPt ? (payrollConfig.holidayMultiplierPt || 2.0) : (payrollConfig.holidayMultiplierFtHourly || 2.0);
                                                    const baseOtMultiplier = isPt ? (payrollConfig.otRatePt || 1.5) : (payrollConfig.otRateFtHourly || 1.5);

                                                    const effectiveOtMultiplier = isPublicHoliday ? (baseOtMultiplier * holidayMultiplier) : baseOtMultiplier;

                                                    if (isPublicHoliday) {
                                                        pStaff.basePay += workHours * hourlyRate;
                                                        pStaff.holidayPay += workHours * hourlyRate * (holidayMultiplier - 1);
                                                    } else {
                                                        pStaff.basePay += workHours * hourlyRate;
                                                    }
                                                    pStaff.otPay += otHours * hourlyRate * effectiveOtMultiplier;
                                                }
                                            }
                                        }
                                    });
                                });
                            }
                        });

                        const payrollSummary = {
                            service: { basePay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, otPay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, holidayPay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, netPay: 0 },
                            kitchen: { basePay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, otPay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, holidayPay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, netPay: 0 },
                            total: { basePay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, otPay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, holidayPay: { total: 0, monthly: 0, hourly: 0, pt: 0 }, netPay: 0 }
                        };

                        Object.values(staffMapPayroll).forEach(staff => {
                            const dept = staff.dept === 'kitchen' ? 'kitchen' : 'service';
                            if (staff.wageType === 'MONTHLY') {
                                const monthlyRate = staff.baseWage || 0;
                                const dailyRate = monthlyRate / (payrollConfig.monthlySalaryDivider || 30);
                                staff.basePay = Math.max(0, monthlyRate - (staff.unpaidLeaveDays * dailyRate));

                                payrollSummary[dept].basePay.monthly += staff.basePay;
                                payrollSummary.total.basePay.monthly += staff.basePay;
                                payrollSummary[dept].otPay.monthly += staff.otPay;
                                payrollSummary.total.otPay.monthly += staff.otPay;
                            } else if (staff.wageType === 'HOURLY') {
                                payrollSummary[dept].basePay.hourly += staff.basePay;
                                payrollSummary.total.basePay.hourly += staff.basePay;
                                payrollSummary[dept].otPay.hourly += staff.otPay;
                                payrollSummary.total.otPay.hourly += staff.otPay;
                            } else if (staff.wageType === 'PT') {
                                payrollSummary[dept].basePay.pt += staff.basePay;
                                payrollSummary.total.basePay.pt += staff.basePay;
                                payrollSummary[dept].otPay.pt += staff.otPay;
                                payrollSummary.total.otPay.pt += staff.otPay;
                            }
                            staff.totalPay = staff.basePay + staff.otPay + staff.holidayPay;

                            payrollSummary[dept].basePay.total += staff.basePay;
                            payrollSummary.total.basePay.total += staff.basePay;
                            payrollSummary[dept].otPay.total += staff.otPay;
                            payrollSummary.total.otPay.total += staff.otPay;
                            payrollSummary[dept].holidayPay.total += staff.holidayPay;
                            payrollSummary.total.holidayPay.total += staff.holidayPay;
                            payrollSummary[dept].netPay += staff.totalPay;
                            payrollSummary.total.netPay += staff.totalPay;
                        });

                        const baseBudget = bData?.ptConfig?.monthlyBudget || 0;
                        const baseAllowance = ptRate > 0 ? baseBudget / ptRate : 0;

                        const totalAllowedExpense = (baseAllowance + leaveRefunds + vacancyComp + eventExtras) * ptRate;
                        const estimatedPtExpense = totalPtHours * ptRate;
                        const isOverAllowed = estimatedPtExpense > totalAllowedExpense;

                        let actSvcAll = 0;
                        let actKitAll = 0;
                        let actSvcPt = 0;
                        let actKitPt = 0;
                        const todayStr = new Date().toISOString().slice(0, 10);
                        (bData?.staff || []).forEach(s => {
                            const isPT = s.pos?.includes('PT') || s.wageType === 'PT';
                            const started = !s.startDate || s.startDate <= todayStr;
                            const notResigned = !s.resignDate || s.resignDate >= todayStr;
                            const isActive = s.isActive !== false;
                            if (started && notResigned && isActive) {
                                if (!isPT) {
                                    if (s.dept === 'service') actSvcAll++;
                                    if (s.dept === 'kitchen') actKitAll++;
                                } else {
                                    if (s.dept === 'service') actSvcPt++;
                                    if (s.dept === 'kitchen') actKitPt++;
                                }
                            }
                        });

                        let targetSvcAll = 0;
                        let targetKitAll = 0;
                        let hasLimitSvc = false;
                        let hasLimitKit = false;

                        let targetSvcPt = 0;
                        let targetKitPt = 0;
                        let hasLimitSvcPt = false;
                        let hasLimitKitPt = false;

                        if (bData?.staffLimits) {
                            const l = bData.staffLimits;
                            if (l['FOH_HEAD'] || l['SERVICE_STAFF_SUPPORT_FT']) {
                                hasLimitSvc = true;
                                targetSvcAll += parseInt(l['FOH_HEAD'] || 0) + parseInt(l['SERVICE_STAFF_SUPPORT_FT'] || 0);
                            }
                            if (l['BOH_HEAD'] || l['KITCHEN_STAFF_SUPPORT_FT']) {
                                hasLimitKit = true;
                                targetKitAll += parseInt(l['BOH_HEAD'] || 0) + parseInt(l['KITCHEN_STAFF_SUPPORT_FT'] || 0);
                            }
                            if (l['SERVICE_STAFF_SUPPORT_PT']) {
                                hasLimitSvcPt = true;
                                targetSvcPt += parseInt(l['SERVICE_STAFF_SUPPORT_PT'] || 0);
                            }
                            if (l['KITCHEN_STAFF_SUPPORT_PT']) {
                                hasLimitKitPt = true;
                                targetKitPt += parseInt(l['KITCHEN_STAFF_SUPPORT_PT'] || 0);
                            }
                        }

                        const svcPercent = hasLimitSvc && targetSvcAll > 0 ? (actSvcAll / targetSvcAll) * 100 : 100;
                        const kitPercent = hasLimitKit && targetKitAll > 0 ? (actKitAll / targetKitAll) * 100 : 100;

                        const svcPtPercent = hasLimitSvcPt && targetSvcPt > 0 ? (actSvcPt / targetSvcPt) * 100 : 100;
                        const kitPtPercent = hasLimitKitPt && targetKitPt > 0 ? (actKitPt / targetKitPt) * 100 : 100;

                        // Calculate daily quota and usage for each day in bDays to find if any day has unapproved over-quota PT hours
                        let hasUnapprovedOverQuota = false;
                        let overQuotaDaysCount = 0;

                        const monthlyBudgetSvc = bData?.ptConfig?.monthlyBudgetService !== undefined ? Number(bData.ptConfig.monthlyBudgetService) : null;
                        const monthlyBudgetKit = bData?.ptConfig?.monthlyBudgetKitchen !== undefined ? Number(bData.ptConfig.monthlyBudgetKitchen) : null;
                        const hourlyRateVal = Number(bData?.ptConfig?.hourlyRate || 0);

                        let baseAllSvc = 0;
                        let baseAllKit = 0;
                        if (hourlyRateVal > 0) {
                            if (monthlyBudgetSvc !== null && monthlyBudgetKit !== null) {
                                baseAllSvc = monthlyBudgetSvc / hourlyRateVal;
                                baseAllKit = monthlyBudgetKit / hourlyRateVal;
                            } else {
                                const legacyBudget = Number(bData?.ptConfig?.monthlyBudget || 0);
                                baseAllSvc = (legacyBudget / 2) / hourlyRateVal;
                                baseAllKit = (legacyBudget / 2) / hourlyRateVal;
                            }
                        }

                        const daysInMonthCount = bDays.length || 30;
                        const dailyBaseAvgSvc = baseAllSvc / daysInMonthCount;
                        const dailyBaseAvgKit = baseAllKit / daysInMonthCount;

                        bDays.forEach(day => {
                            const dateStr = day.dateStr;
                            const dayData = sData[dateStr] || {};

                            // 1. Vacancy
                            let activeFtCountSvc = 0;
                            let activeFtCountKit = 0;
                            (bData?.staff || []).forEach(s => {
                                if (s.pos.includes('PT') || (s.isActive === false && !s.resignDate)) return;
                                const started = !s.startDate || s.startDate <= dateStr;
                                const notResigned = !s.resignDate || s.resignDate >= dateStr;
                                if (started && notResigned) {
                                    if (s.dept === 'service') activeFtCountSvc++;
                                    if (s.dept === 'kitchen') activeFtCountKit++;
                                }
                            });
                            const gapSvc = Math.max(0, targetFtService - activeFtCountSvc);
                            const gapKit = Math.max(0, targetFtKitchen - activeFtCountKit);
                            const dayVacancySvc = gapSvc * compHrSvc;
                            const dayVacancyKit = gapKit * compHrKit;

                            // 2. Leaves
                            let leaveRefundsSvc = 0;
                            let leaveRefundsKit = 0;
                            if (dayData.leaves) {
                                dayData.leaves.forEach(l => {
                                    const staff = staffMap[l.staffId];
                                    if (staff && !staff.pos.includes('PT') && ['AL', 'SL', 'SL_UNPAID', 'PL', 'PL_UNPAID', 'MATERNITY', 'MARRIAGE', 'TRAINING', 'MY_DAY', 'FAMILY_DAY', 'CO'].includes(l.type)) {
                                        if (staff.dept === 'kitchen') leaveRefundsKit += 8;
                                        else leaveRefundsSvc += 8;
                                    }
                                });
                            }

                            // 3. Event Extra hours
                            const eventHrsSvc = dayData.eventExtraHoursService !== undefined
                                ? dayData.eventExtraHoursService
                                : (dayData.eventExtraHoursKitchen !== undefined ? 0 : (dayData.eventExtraHours || 0));
                            const eventHrsKit = dayData.eventExtraHoursKitchen || 0;

                            // Daily allowances
                            const allowanceSvc = dailyBaseAvgSvc + dayVacancySvc + leaveRefundsSvc + eventHrsSvc;
                            const allowanceKit = dailyBaseAvgKit + dayVacancyKit + leaveRefundsKit + eventHrsKit;

                            // 4. Used Hours
                            let usedHoursSvc = 0;
                            let usedHoursKit = 0;
                            if (dayData.duties) {
                                const dayType = getDayType(dateStr, bData?.holidays, bData?.holidayCycles);
                                Object.keys(dayData.duties).forEach(dutyId => {
                                    const slots = dayData.duties[dutyId] || [];
                                    const matrixSlots = bData?.matrix?.[dayType]?.duties?.[dutyId] || [];
                                    slots.forEach((slot, idx) => {
                                        if (slot && slot.staffId) {
                                            const actualStaffId = slot.staffId.startsWith('COVER_BY_') ? slot.staffId.replace('COVER_BY_', '') : slot.staffId;
                                            const staff = staffMap[actualStaffId];
                                            if (staff && staff.pos.includes('PT')) {
                                                const mSlot = matrixSlots[idx];
                                                const shiftPreset = bData?.shiftPresets?.find(p => p.id === (slot.shiftPresetId || mSlot?.shiftPresetId));
                                                const times = getShiftTimesForStaff(staff.pos, shiftPreset);
                                                const shiftHrs = getNetWorkHours(times.startTime, times.endTime, staff.pos);
                                                const totalSlotHrs = shiftHrs + Number(slot.otHours || 0);
                                                if (staff.dept === 'kitchen') {
                                                    usedHoursKit += totalSlotHrs;
                                                } else {
                                                    usedHoursSvc += totalSlotHrs;
                                                }
                                            }
                                        }
                                    });
                                });
                            }

                            // Check over-quota
                            const isSvcOver = usedHoursSvc > allowanceSvc;
                            const isKitOver = usedHoursKit > allowanceKit;
                            if (isSvcOver || isKitOver) {
                                hasUnapprovedOverQuota = true;
                                overQuotaDaysCount++;
                            }
                        });

                        return (
                            <div key={bId} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-6 transition hover:border-indigo-300">
                                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                                    <div className="flex-1 w-full">
                                        <div className="flex flex-wrap items-center gap-3 justify-between">
                                            <h3 className="text-xl font-black text-slate-800 uppercase flex items-center gap-3"><Store className="w-6 h-6 text-indigo-500" /> {branchName}</h3>
                                            {hasUnapprovedOverQuota && (
                                                <span className="bg-red-50 border border-red-200 text-red-600 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                                                    <AlertCircle className="w-4 h-4 text-red-500" /> มีวันใช้งานเกินโควตา ({overQuotaDaysCount} วัน)
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 w-full">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center"><div className="text-[10px] font-bold text-slate-400 uppercase">พนักงานรวม</div><div className="text-xl sm:text-2xl font-black text-slate-800 mt-1">{staffCount} <span className="text-[10px] font-bold text-slate-500">คน</span></div></div>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center"><div className="text-[10px] font-bold text-slate-400 uppercase">พนักงานพาร์ทไทม์ (PT)</div><div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{ptCount} <span className="text-[10px] font-bold text-emerald-600/50">คน</span></div></div>
                                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex flex-col justify-center"><div className="text-[10px] font-bold text-rose-500 uppercase">ใช้งาน OT (เดือนนี้)</div><div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{totalOT.toFixed(1)} <span className="text-[10px] font-bold text-rose-500/50">ชม.</span></div></div>
                                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col justify-center"><div className="text-[10px] font-bold text-amber-500 uppercase">วันลา/หยุด (เดือนนี้)</div><div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{totalLeaves} <span className="text-[10px] font-bold text-amber-500/50">รายการ</span></div></div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full">
                                            <div className="flex-1 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">อัตรากำลังคนประจำ (FT) บริการ (FOH)</div>
                                                    <div className="text-sm font-black text-indigo-900">{actSvcAll} <span className="text-[10px] text-indigo-400">/ {hasLimitSvc ? targetSvcAll : '∞'} คน</span></div>
                                                </div>
                                                <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${actSvcAll < targetSvcAll ? 'bg-amber-400' : 'bg-indigo-500'} transition-all`} style={{ width: `${Math.min(svcPercent, 100)}%` }}></div>
                                                </div>
                                                {hasLimitSvc && actSvcAll < targetSvcAll && <p className="text-[9px] text-amber-600 font-bold mt-1.5 text-right">⚠️ ขาดอีก {targetSvcAll - actSvcAll} คน</p>}
                                                {hasLimitSvc && actSvcAll > targetSvcAll && <p className="text-[9px] text-red-500 font-bold mt-1.5 text-right">🛑 เกินโควตา {actSvcAll - targetSvcAll} คน</p>}
                                            </div>
                                            <div className="flex-1 bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex flex-col justify-center">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">อัตรากำลังคนประจำ (FT) ครัว (BOH)</div>
                                                    <div className="text-sm font-black text-orange-900">{actKitAll} <span className="text-[10px] text-orange-400">/ {hasLimitKit ? targetKitAll : '∞'} คน</span></div>
                                                </div>
                                                <div className="h-2 w-full bg-orange-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${actKitAll < targetKitAll ? 'bg-amber-400' : 'bg-orange-500'} transition-all`} style={{ width: `${Math.min(kitPercent, 100)}%` }}></div>
                                                </div>
                                                {hasLimitKit && actKitAll < targetKitAll && <p className="text-[9px] text-amber-600 font-bold mt-1.5 text-right">⚠️ ขาดอีก {targetKitAll - actKitAll} คน</p>}
                                                {hasLimitKit && actKitAll > targetKitAll && <p className="text-[9px] text-red-500 font-bold mt-1.5 text-right">🛑 เกินโควตา {actKitAll - targetKitAll} คน</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full">
                                            <div className="flex-1 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">อัตรากำลังคนพาร์ทไทม์ (PT) บริการ (FOH)</div>
                                                    <div className="text-sm font-black text-indigo-900">{actSvcPt} <span className="text-[10px] text-indigo-400">/ {hasLimitSvcPt ? targetSvcPt : '∞'} คน</span></div>
                                                </div>
                                                <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${actSvcPt < targetSvcPt ? 'bg-amber-400' : 'bg-indigo-500'} transition-all`} style={{ width: `${Math.min(svcPtPercent, 100)}%` }}></div>
                                                </div>
                                                {hasLimitSvcPt && actSvcPt < targetSvcPt && <p className="text-[9px] text-amber-600 font-bold mt-1.5 text-right">⚠️ ขาดอีก {targetSvcPt - actSvcPt} คน</p>}
                                                {hasLimitSvcPt && actSvcPt > targetSvcPt && <p className="text-[9px] text-red-500 font-bold mt-1.5 text-right">🛑 เกินโควตา {actSvcPt - targetSvcPt} คน</p>}
                                            </div>
                                            <div className="flex-1 bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex flex-col justify-center">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">อัตรากำลังคนพาร์ทไทม์ (PT) ครัว (BOH)</div>
                                                    <div className="text-sm font-black text-orange-900">{actKitPt} <span className="text-[10px] text-orange-400">/ {hasLimitKitPt ? targetKitPt : '∞'} คน</span></div>
                                                </div>
                                                <div className="h-2 w-full bg-orange-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${actKitPt < targetKitPt ? 'bg-amber-400' : 'bg-orange-500'} transition-all`} style={{ width: `${Math.min(kitPtPercent, 100)}%` }}></div>
                                                </div>
                                                {hasLimitKitPt && actKitPt < targetKitPt && <p className="text-[9px] text-amber-600 font-bold mt-1.5 text-right">⚠️ ขาดอีก {targetKitPt - actKitPt} คน</p>}
                                                {hasLimitKitPt && actKitPt > targetKitPt && <p className="text-[9px] text-red-500 font-bold mt-1.5 text-right">🛑 เกินโควตา {actKitPt - targetKitPt} คน</p>}
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t border-slate-100 pt-6 w-full">
                                            <h4 className="text-[12px] font-black text-slate-700 uppercase tracking-widest mb-4">สรุปค่าใช้จ่ายบุคลากร COL#1</h4>
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                {[
                                                    { id: 'service', title: 'ฝั่งบริการ (FOH)', data: payrollSummary.service, theme: { wrap: 'bg-indigo-50/50 border-indigo-100', title: 'text-indigo-700', val: 'text-indigo-600', net: 'bg-indigo-600 text-white' } },
                                                    { id: 'kitchen', title: 'ฝั่งครัว (BOH)', data: payrollSummary.kitchen, theme: { wrap: 'bg-orange-50/50 border-orange-100', title: 'text-orange-700', val: 'text-orange-600', net: 'bg-orange-600 text-white' } },
                                                    { id: 'total', title: 'ยอดรวม COL#1 ทั้งหมด (ที่จัดจากตารางงาน)', data: payrollSummary.total, theme: { wrap: 'bg-slate-900 border-slate-800', title: 'text-emerald-400', val: 'text-white', net: 'bg-emerald-500 text-slate-900' } }
                                                ].map(sec => (
                                                    <div key={sec.id} className={`${sec.theme.wrap} border p-4 sm:p-5 rounded-2xl flex flex-col gap-3 shadow-sm`}>
                                                        <div className={`text-sm font-black uppercase tracking-widest ${sec.theme.title}`}>{sec.title}</div>

                                                        <div className={`p-3 rounded-xl shadow-sm border ${sec.id === 'total' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                                            <div className="flex justify-between items-end mb-1">
                                                                <span className={`text-[10px] font-bold uppercase ${sec.id === 'total' ? 'text-slate-400' : 'text-slate-500'}`}>ค่าจ้างปกติรวม</span>
                                                                <span className={`text-lg font-black ${sec.theme.val}`}>฿{sec.data.basePay.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                            </div>
                                                            <div className={`text-[9px] font-bold space-y-1 border-t pt-2 mt-1 ${sec.id === 'total' ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-100'}`}>
                                                                <div className="flex justify-between items-center"><span>- รายเดือน (FT):</span> <span>฿{sec.data.basePay.monthly.toLocaleString()}</span></div>
                                                                <div className="flex justify-between items-center"><span>- รายชั่วโมง (FT):</span> <span>฿{sec.data.basePay.hourly.toLocaleString()}</span></div>
                                                                <div className="flex justify-between items-center"><span>- พาร์ทไทม์ (PT):</span> <span>฿{sec.data.basePay.pt.toLocaleString()}</span></div>
                                                            </div>
                                                        </div>

                                                        <div className={`p-3 rounded-xl shadow-sm border ${sec.id === 'total' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                                            <div className="flex justify-between items-end mb-1">
                                                                <span className={`text-[10px] font-bold uppercase ${sec.id === 'total' ? 'text-slate-400' : 'text-slate-500'}`}>ค่า OT รวม</span>
                                                                <span className={`text-lg font-black ${sec.theme.val}`}>฿{sec.data.otPay.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                            </div>
                                                            <div className={`text-[9px] font-bold space-y-1 border-t pt-2 mt-1 ${sec.id === 'total' ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-100'}`}>
                                                                <div className="flex justify-between items-center"><span>- รายเดือน (FT):</span> <span>฿{sec.data.otPay.monthly.toLocaleString()}</span></div>
                                                                <div className="flex justify-between items-center"><span>- รายชั่วโมง (FT):</span> <span>฿{sec.data.otPay.hourly.toLocaleString()}</span></div>
                                                                <div className="flex justify-between items-center"><span>- พาร์ทไทม์ (PT):</span> <span>฿{sec.data.otPay.pt.toLocaleString()}</span></div>
                                                            </div>
                                                        </div>

                                                        <div className={`p-3 rounded-xl shadow-sm border flex justify-between items-center ${sec.id === 'total' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                                            <span className={`text-[10px] font-bold uppercase ${sec.id === 'total' ? 'text-slate-400' : 'text-slate-500'}`}>ค่าแรงวันหยุด</span>
                                                            <span className={`text-base font-black ${sec.theme.val}`}>฿{sec.data.holidayPay.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                        </div>

                                                        <div className={`mt-auto ${sec.theme.net} p-3 sm:p-4 rounded-xl shadow-md flex justify-between items-center`}>
                                                            <span className="text-[10px] font-bold uppercase opacity-90">สุทธิ (NET)</span>
                                                            <span className="text-xl sm:text-2xl font-black">฿{sec.data.netPay.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full xl:w-auto flex flex-col sm:flex-row xl:flex-col gap-3">
                                        <button onClick={() => handleMenuChange('report', bId)} className="flex-1 bg-indigo-50 text-indigo-600 px-8 py-4 rounded-xl font-black text-xs hover:bg-indigo-100 transition shadow-sm whitespace-nowrap text-center uppercase tracking-widest border border-indigo-100">ดูรายงานฉบับเต็ม</button>
                                        <button onClick={() => handleMenuChange('manager', bId)} className="flex-1 bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-xs hover:bg-black transition shadow-lg whitespace-nowrap text-center uppercase tracking-widest">จัดการตารางกะสาขานี้</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                                    <div className="bg-slate-50 p-5 rounded-2xl flex flex-col justify-between border border-slate-100">
                                        <div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">พยากรณ์ค่าใช้จ่าย PT</h4>
                                            <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tighter mt-1">{estimatedPtExpense.toLocaleString()} <span className="text-xs sm:text-sm text-slate-500">THB</span></div>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1">ใช้ไป {totalPtHours.toFixed(1)} ชม. x {ptRate} บ./ชม.</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-2xl flex flex-col justify-between border border-slate-100">
                                        <div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">งบประมาณ PT ที่ใช้งานได้</h4>
                                            <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter mt-1">{totalAllowedExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs sm:text-sm text-slate-500">THB</span></div>
                                            <div className={`mt-3 text-[10px] font-black px-2.5 py-1.5 rounded-lg inline-block ${isOverAllowed ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                                                {isOverAllowed ? `⚠️ ทะลุงบ ${(estimatedPtExpense - totalAllowedExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB` : `✨ คงเหลือ ${(totalAllowedExpense - estimatedPtExpense).toLocaleString(undefined, { maximumFractionDigits: 0 })} THB`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-2xl flex flex-col justify-between border border-slate-100">
                                        <div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สัดส่วนกำลังคน (FT : PT)</h4>
                                            <div className="flex gap-6 mt-3">
                                                <div><div className="text-2xl sm:text-3xl font-black text-indigo-600">{staffCount - ptCount}</div><p className="text-[9px] font-bold text-slate-400">Full-Time</p></div>
                                                <div><div className="text-2xl sm:text-3xl font-black text-orange-500">{ptCount}</div><p className="text-[9px] font-bold text-slate-400">Part-Time</p></div>
                                            </div>
                                            <div className="mt-3 h-1.5 w-full bg-orange-100 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-indigo-500" style={{ width: `${staffCount > 0 ? ((staffCount - ptCount) / staffCount) * 100 : 0}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    function renderPrepChecklistView() {
        const hourlyTcData = branchData.matrix?.[activeDay.type]?.hourlyTc || {};
        let prepGoals = branchData.matrix?.[activeDay.type]?.prepGoals;
        if (!prepGoals) {
            prepGoals = [
                { id: 'prep_1', name: 'กะเช้า', start: '09', end: '12' },
                { id: 'prep_2', name: 'กะบ่าย', start: '13', end: '22' }
            ];
        } else if (!Array.isArray(prepGoals)) {
            prepGoals = [
                { id: 'prep_1', name: 'กะเช้า', start: prepGoals.morning?.start || '09', end: prepGoals.morning?.end || '12' },
                { id: 'prep_2', name: 'กะบ่าย', start: prepGoals.afternoon?.start || '13', end: prepGoals.afternoon?.end || '22' }
            ];
        }

        const getHoursInRange = (start, end) => {
            const hours = [];
            let s = parseInt(start); let e = parseInt(end);
            if (e < s) e += 24;
            for (let i = s; i <= e; i++) { hours.push(String(i % 24).padStart(2, '0')); }
            return hours;
        };

        const goalsData = prepGoals.map(goal => {
            let tc = 0;
            getHoursInRange(goal.start, goal.end).forEach(h => tc += parseInt(hourlyTcData[h]) || 0);
            return { ...goal, tc };
        });

        const dutiesWithPrep = CURRENT_DUTY_LIST.filter(d => d.prepItems && d.prepItems.length > 0);

        return (
            <div className="w-full animate-in fade-in duration-500">
                <div className="text-center mb-8 print:block">
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">ใบสรุปเป้าหมายการเตรียมของ (PREP LIST)</h1>
                    <p className="font-bold text-slate-600 mt-2 text-sm">วัน{activeDay.dayLabel} ที่ <span className="underline underline-offset-4">{activeDay.dayNum}</span> เดือน <span className="underline underline-offset-4">{THAI_MONTHS[selectedMonth]}</span> พ.ศ. <span className="underline underline-offset-4">{selectedYear + 543}</span> | สาขา: {globalConfig.branches?.find(b => b.id === activeBranchId)?.name}</p>
                </div>

                {dutiesWithPrep.length === 0 ? (
                    <div className="text-center p-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">ไม่มีรายการที่ต้องเตรียมของในแผนกนี้</div>
                ) : (
                    <div className="space-y-8">
                        {goalsData.map(g => {
                            const dutiesForThisGoal = dutiesWithPrep.map(duty => {
                                const matchingPrepItems = duty.prepItems.filter(p => {
                                    let targetName = p.target;
                                    if (targetName === 'prep_1') targetName = 'กะเช้า';
                                    if (targetName === 'prep_2') targetName = 'กะบ่าย';
                                    return !targetName || targetName === 'ALL' || targetName === g.name || targetName === g.id;
                                });
                                return { ...duty, matchingPrepItems };
                            }).filter(d => d.matchingPrepItems.length > 0);

                            if (dutiesForThisGoal.length === 0) return null;

                            return (
                                <div key={g.id} className="mb-8 break-inside-avoid">
                                    <div className="flex items-center gap-3 mb-4 border-b-2 border-slate-200 pb-3">
                                        <h3 className="text-lg font-black uppercase tracking-widest text-slate-800 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                                            🕒 รอบเตรียม: {g.name} <span className="text-sm text-slate-500">({g.start}:00-{parseInt(g.end)}:59 น.)</span>
                                        </h3>
                                        <span className="text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-black shadow-sm text-sm">🎯 เป้าหมาย: {g.tc} TC</span>
                                    </div>
                                    <table className="w-full text-sm border-collapse border-2 border-slate-800 bg-white">
                                        <thead>
                                            <tr className="bg-slate-100 font-black text-slate-700 text-center">
                                                <th className="border border-slate-800 p-3 w-[25%]">หมวดหมู่ / หน้าที่</th>
                                                <th className="border border-slate-800 p-3 w-[25%]">รายการที่ต้องเตรียม</th>
                                                <th className="border border-slate-800 p-3 w-[15%]">เป้าหมาย</th>
                                                <th className="border border-slate-800 p-3 w-[15%]">ผู้เตรียม</th>
                                                <th className="border border-slate-800 p-3 w-[12%]">ผู้ตรวจ</th>
                                                <th className="border border-slate-800 p-3 w-[8%]">Check</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dutiesForThisGoal.map(duty => {
                                                const catInfo = DUTY_CATEGORIES[activeDept].find(c => c.id === duty.category);
                                                return duty.matchingPrepItems.map((p, pIdx) => {
                                                    let val = 0;
                                                    if (p.mode === 'TABLE') val = p.multiplier * (branchData.totalTables || 0);
                                                    else if (p.mode === 'STATIC') val = p.multiplier;
                                                    else val = p.multiplier * g.tc;
                                                    let displayVal = val % 1 === 0 ? val.toString() : val.toFixed(1);

                                                    let preparerNames = [];
                                                    const assignedSlots = schedule[selectedDateStr]?.duties?.[duty.id] || [];
                                                    const matrixSlots = branchData.matrix?.[activeDay.type]?.duties?.[duty.id] || [];
                                                    assignedSlots.forEach((asg, aIdx) => {
                                                        if (asg && asg.staffId) {
                                                            const mSlot = matrixSlots[aIdx];
                                                            const presetId = asg.shiftPresetId || mSlot?.shiftPresetId;
                                                            const shiftPreset = branchData.shiftPresets?.find(preset => preset.id === presetId);
                                                            const actualStaffId = asg.staffId.startsWith('COVER_BY_') ? asg.staffId.replace('COVER_BY_', '') : asg.staffId;
                                                            const staff = branchData.staff?.find(s => s.id === actualStaffId);
                                                            if (staff && shiftPreset) {
                                                                const timings = getShiftTimesForStaff(staff.pos, shiftPreset);
                                                                const stHour = parseInt(timings.startTime.split(':')[0], 10) || 0;
                                                                let matched = false;
                                                                if (g.name.includes('เช้า') && stHour < 12) {
                                                                    matched = true;
                                                                } else if ((g.name.includes('บ่าย') || g.name.includes('เย็น')) && stHour >= 12) {
                                                                    matched = true;
                                                                } else {
                                                                    const gStart = parseInt(g.start, 10) || 0;
                                                                    const gEnd = parseInt(g.end, 10) || 24;
                                                                    if (stHour >= gStart && stHour <= gEnd) {
                                                                        matched = true;
                                                                    }
                                                                }
                                                                if (matched) preparerNames.push(staff.name);
                                                            }
                                                        }
                                                    });
                                                    preparerNames = [...new Set(preparerNames)];

                                                    return (
                                                        <tr key={`${duty.id}-${p.id}-${g.id}`} className="hover:bg-slate-50 transition-colors">
                                                            {pIdx === 0 && (
                                                                <td rowSpan={duty.matchingPrepItems.length} className="border border-slate-800 p-3 font-black text-slate-800 align-top bg-slate-50/50">
                                                                    {catInfo && <div className={`text-[9px] px-2 py-0.5 rounded uppercase mb-1 w-max ${catInfo.color.split(' ')[0]} ${catInfo.color.split(' ')[1]}`}>{catInfo.label}</div>}
                                                                    <div dangerouslySetInnerHTML={{ __html: duty.jobA }}></div>
                                                                    <div className="text-[10px] text-slate-500 mt-1 uppercase">POS: {(duty.reqPos || ['ALL']).join(', ')}</div>
                                                                </td>
                                                            )}
                                                            <td className="border border-slate-800 p-3 font-bold text-slate-700">
                                                                {p.name}
                                                            </td>
                                                            <td className="border border-slate-800 p-3 text-center font-black text-emerald-600 text-lg bg-emerald-50/30">
                                                                {displayVal} <span className="text-xs font-bold text-slate-500">{p.unit}</span>
                                                            </td>
                                                            <td className="border border-slate-800 p-3 text-center align-middle">
                                                                {preparerNames.length > 0 ? (
                                                                    <div className="font-bold text-indigo-700 text-sm">{preparerNames.join(', ')}</div>
                                                                ) : (
                                                                    <div className="w-full h-8 border-b-2 border-dotted border-slate-300"></div>
                                                                )}
                                                            </td>
                                                            <td className="border border-slate-800 p-3">
                                                                <div className="w-full h-8 border-b-2 border-dotted border-slate-300"></div>
                                                            </td>
                                                            <td className="border border-slate-800 p-3 text-center align-middle">
                                                                <div className="w-6 h-6 border-2 border-slate-400 rounded mx-auto"></div>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    let mainContent = null;
    if (view === 'area_dashboard') {
        mainContent = renderAreaDashboard();
    } else if (view === 'branches' && authRole === 'superadmin') {
        mainContent = renderGlobalAdmin();
    } else if (view === 'admin') {
        mainContent = activeBranchId ? renderBranchAdmin() : renderEmptyBranchAdmin();
    } else if (view === 'head_team') {
        mainContent = activeBranchId ? renderHeadTeamView() : renderEmptyBranchAdmin();
    } else if (view === 'manager') {
        mainContent = (
            <div className="flex flex-col w-full gap-0">
                <div className="flex flex-col lg:flex-row gap-4 w-full mb-6 print:hidden">
                    {renderPtLedgerWidget()}
                    {renderOtLedgerWidget()}
                </div>
                {managerViewMode === 'daily' && renderManagerDailyCards()}
                {(managerViewMode === 'monthly' || managerViewMode === 'weekly') && renderManagerMonthly()}
            </div>
        );
    } else if (view === 'report') {
        mainContent = renderReportView();
    } else if (view === 'guide') {
        mainContent = renderGuideView();
    } else if (view === 'print') {
        const DISPLAY_DAYS = managerViewMode === 'weekly' ? WEEKLY_DAYS : CALENDAR_DAYS;
        mainContent = <PrintMonthlyView onPrint={handlePrintMonthly} CALENDAR_DAYS={DISPLAY_DAYS} branchData={branchData} globalConfig={globalConfig} activeBranchId={activeBranchId} THAI_MONTHS={THAI_MONTHS} selectedMonth={selectedMonth} getStaffDayInfo={getStaffDayInfo} setView={setView} activeDept={activeDept} CURRENT_DUTY_LIST={CURRENT_DUTY_LIST} schedule={schedule} handleToggleLeave={handleToggleLeave} LEAVE_TYPES={LEAVE_TYPES} pendingRequests={pendingRequests} />;
    }

    return (
        <React.Fragment>
            <style dangerouslySetInnerHTML={{
                __html: `
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
            @page { size: A4 ${(view === 'head_team' && dailyViewMode === 'prep') ? 'portrait' : 'landscape'}; margin: 8mm; }
            html, body { background: white !important; -webkit-print-color-adjust: exact; padding: 0 !important; margin: 0 !important; width: 100% !important; height: auto !important; min-height: 100% !important; display: block !important; }
          .print\\:hidden { display: none !important; }
          nav, button, footer { display: none !important; }
            #root { display: block !important; height: auto !important; min-height: 100% !important; }
            main { padding: 0 !important; margin: 0 !important; width: 100% !important; height: auto !important; min-height: 100% !important; display: block !important; }
              .print-roster-wrapper {
                    display: block !important;
              width: 100% !important;
              }
          .print-roster-wrapper > div { width: 100% !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 2px solid #000 !important; margin: 0 auto !important; }
          th, td { border: 1px solid #000 !important; padding: 4px !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
            thead { display: table-header-group !important; }
        }
      `}} />

            {newVersionAvailable && (
                <div className="fixed top-0 left-0 w-full bg-amber-500 text-white z-[9999] px-4 py-2 sm:py-3 flex justify-between items-center shadow-lg animate-in slide-in-from-top">
                    <span className="text-[10px] sm:text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> มีอัปเดตระบบเวอร์ชันใหม่ ({newVersionAvailable}) กรุณาบันทึกงานที่ทำอยู่ให้เรียบร้อย และกดปุ่มรีเฟรช (ระบบจะอัปเดตอัตโนมัติหากคุณเปลี่ยนเมนู)
                    </span>
                    <button onClick={() => {
                        sessionStorage.setItem('reloadedVersion', newVersionAvailable);
                        window.location.reload();
                    }} className="bg-white text-amber-600 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black hover:bg-amber-50 active:scale-95 transition shadow-sm whitespace-nowrap ml-2">
                        รีเฟรชเดี๋ยวนี้
                    </button>
                </div>
            )}

            {renderModals()}
            {renderLandingModal()}
            {authRole === 'guest' ? renderGuestLogin() : (
                <div className="flex-1 flex flex-col min-h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased">
                    <nav className="flex-none sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden shadow-sm px-4 sm:px-8 py-3 w-full">
                        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0 w-full">
                            <div className="flex items-center justify-between w-full lg:w-auto">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <img src="https://img1.pic.in.th/images/ChatGPT-Image-6-..-2569-19_46_07.png" alt="Logo" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-md object-cover border-2 border-slate-100 bg-white transition hover:scale-105 duration-500" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150?text=GON"; }} />
                                    <div className="flex flex-col">
                                        <span className="font-black text-lg sm:text-xl tracking-tighter uppercase leading-none">Super Store</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            <span className={`text-[8px] sm:text-[9px] font-black uppercase text-slate-400`}>{authRole === 'superadmin' ? 'BAR B Q PLAZA' : authRole === 'areamanager' ? 'AREA MANAGER' : 'BRANCH MANAGEMENT'}</span>
                                        </div>
                                    </div>
                                    {['superadmin', 'areamanager'].includes(authRole) && (
                                        <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-1 ml-2 sm:ml-4 border border-slate-200 shadow-inner">
                                            <ArrowLeftRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 mx-2 sm:mx-3" />
                                            <select value={activeBranchId || ''} onChange={handleBranchChange} className="bg-transparent text-[9px] sm:text-[11px] font-black outline-none py-1 sm:py-2 pr-2 sm:pr-4 text-indigo-600 cursor-pointer uppercase max-w-[120px] sm:max-w-none">
                                                <option value="">-- SELECT BRANCH --</option>
                                                {globalConfig.branches?.filter(b => authRole === 'superadmin' || (globalConfig.areaManagers?.find(a => a.user === authUser)?.branches || []).includes(b.id)).map(b => <option key={b.id} value={b.id}>{b.name.substring(0, 40).toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="hidden sm:flex items-center ml-2">
                                        <button onClick={() => setShowRequestsModal(true)} className="relative p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition shadow-sm">
                                            <Bell className="w-5 h-5 text-slate-600" />
                                            {pendingRequests.some(r => r.status === 'PENDING_MANAGER') && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                                        </button>
                                    </div>
                                </div>
                                <div className="lg:hidden flex items-center gap-2">
                                    <button onClick={() => setShowRequestsModal(true)} className="relative p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition shadow-sm">
                                        <Bell className="w-5 h-5 text-slate-600" />
                                        {pendingRequests.some(r => r.status === 'PENDING_MANAGER') && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                                    </button>
                                    {['branch', 'areamanager'].includes(authRole) && (
                                        <button onClick={() => setShowChangePasswordModal(true)} className="text-slate-400 p-2 bg-slate-100 rounded-lg hover:text-indigo-500 transition" title="เปลี่ยนรหัสผ่าน"><KeyRound className="w-4 h-4" /></button>
                                    )}
                                    <button onClick={() => { localStorage.removeItem('superstore_session'); window.location.reload(); }} className="text-slate-400 p-2 bg-slate-100 rounded-lg"><LogIn className="w-4 h-4 rotate-180" /></button>
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
                                    {authRole === 'areamanager' && <button onClick={() => handleMenuChange('area_dashboard')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'area_dashboard' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>ภาพรวมเขต (Dashboard)</button>}
                                    <button onClick={() => handleMenuChange('manager')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'manager' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>จัดตารางงาน</button>
                                    <button onClick={() => handleMenuChange('head_team')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'head_team' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>จัดบทบาทประจำวัน</button>
                                    <button onClick={() => handleMenuChange('report')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'report' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>รายงาน</button>
                                    <button onClick={() => handleMenuChange('admin')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'admin' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>ตั้งค่า</button>
                                    <button onClick={() => handleMenuChange('guide')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'guide' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-500'}`}>คู่มือ</button>
                                    {authRole === 'superadmin' && <button onClick={() => handleMenuChange('branches')} className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg transition-all ${view === 'branches' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-50' : 'text-slate-500'}`}>BRANCHES</button>}
                                </div>
                                <div className="hidden lg:flex flex-shrink-0 items-center gap-3 ml-2 pl-5 border-l border-slate-200">
                                    <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl font-black text-xs hover:bg-indigo-700 active:scale-95 transition flex items-center gap-2 w-32 justify-center">
                                        {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        <span className="ml-1">{saveStatus === 'saving' ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}</span>
                                    </button>
                                    {saveStatus === 'error' && <div className="text-red-500 text-xs font-bold ml-2">บันทึกไม่สำเร็จ กรุณาลองใหม่</div>}
                                    {['branch', 'areamanager'].includes(authRole) && (
                                        <button onClick={() => setShowChangePasswordModal(true)} className="text-slate-400 hover:text-indigo-500 transition p-1" title="เปลี่ยนรหัสผ่าน"><KeyRound className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                                    )}
                                    <button onClick={() => { localStorage.removeItem('superstore_session'); window.location.reload(); }} className="text-slate-400 hover:text-red-500 transition p-1"><LogIn className="w-6 h-6 rotate-180" /></button>
                                </div>
                            </div>
                        </div>
                    </nav>

                    <button onClick={handleGlobalSave} disabled={saveStatus === 'saving'} className="lg:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl active:scale-90 transition-transform">
                        {saveStatus === 'saving' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                    </button>
                    {saveStatus === 'error' && <div className="lg:hidden fixed bottom-20 right-6 z-50 bg-red-500 text-white px-4 py-2 rounded-xl shadow-2xl text-xs font-bold">บันทึกไม่สำเร็จ</div>}

                    <main className="flex-1 flex flex-col p-4 sm:p-8 max-w-[1600px] mx-auto w-full print:p-0 print:m-0 relative">
                        {(view === 'manager' || view === 'admin' || view === 'head_team') && (
                            <div className="flex-none flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-10 print:hidden w-full">
                                <div className="flex flex-wrap gap-2 sm:gap-4 bg-white p-2 sm:p-3 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 w-full md:w-fit shadow-sm">
                                    <button onClick={() => { setActiveDept('service'); setStaffFilterPos('ALL'); }} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-[1rem] sm:rounded-[2rem] font-black text-[10px] sm:text-xs transition-all ${activeDept === 'service' ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><ConciergeBell className="w-4 h-4 sm:w-5 sm:h-5" /> ฝั่งงานบริการ</button>
                                    <button onClick={() => { setActiveDept('kitchen'); setStaffFilterPos('ALL'); }} className={`flex-1 md:flex-none flex justify-center items-center gap-2 sm:gap-3 px-4 sm:px-10 py-3 sm:py-4 rounded-[1rem] sm:rounded-[2rem] font-black text-[10px] sm:text-xs transition-all ${activeDept === 'kitchen' ? 'bg-orange-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5" /> ฝั่งงานครัว</button>
                                </div>
                                {view === 'manager' && (
                                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                                        <button onClick={() => setManagerViewMode('daily')} className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${managerViewMode === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><CalendarDaysIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" /><span className="hidden sm:inline">จัดกะแบบรายวัน</span><span className="sm:hidden">รายวัน</span></button>
                                        <button onClick={() => setManagerViewMode('weekly')} className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${managerViewMode === 'weekly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><CalendarDaysIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" /><span className="hidden sm:inline">จัดกะแบบรายสัปดาห์</span><span className="sm:hidden">สัปดาห์</span></button>
                                        <button onClick={() => setManagerViewMode('monthly')} className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all ${managerViewMode === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" /><span className="hidden sm:inline">จัดกะแบบรายเดือน</span><span className="sm:hidden">รายเดือน</span></button>
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