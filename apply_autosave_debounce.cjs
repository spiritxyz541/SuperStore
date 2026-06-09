const fs = require('fs');
const filePath = 'c:\\Users\\BBQ\\super\\src\\App.jsx';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// Helper to make exact replacements ignoring whitespace differences
function replaceFlexible(targetStr, replacementStr, name) {
    const escaped = targetStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                             .replace(/\s+/g, '\\s+'); // match any amount of whitespace
    const regex = new RegExp(escaped);
    const match = content.match(regex);
    if (!match) {
        console.error(`ERROR: Could not find block for ${name}`);
        process.exit(1);
    }
    content = content.replace(regex, replacementStr);
    console.log(`Successfully replaced ${name}`);
}

// 1. Ref declaration (around line 931)
const targetRef = `  const autoAssignedDates = useRef(new Set()); 
  const scheduleRef = useRef();
  scheduleRef.current = schedule;`;

const replacementRef = `  const autoAssignedDates = useRef(new Set()); 
  const scheduleRef = useRef();
  scheduleRef.current = schedule;
  const autoSaveTimerRef = useRef(null);`;

replaceFlexible(targetRef, replacementRef, "autoSaveTimerRef declaration");

// 2. autoSaveSchedule definition
const targetDef = `  const autoSaveSchedule = useCallback(async (scheduleData) => {
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
  }, [activeBranchId]);`;

const replacementDef = `  const autoSaveSchedule = useCallback((scheduleData, immediate = false) => {
    const dataToSave = scheduleData || scheduleRef.current;
    if (!activeBranchId) return Promise.resolve();
    
    setSaveStatus('saving');
    
    if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
    }
    
    return new Promise((resolve, reject) => {
        const performSave = async () => {
            try {
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'schedules', activeBranchId), { records: dataToSave });
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
            autoSaveTimerRef.current = setTimeout(performSave, 1000);
            resolve();
        }
    });
  }, [activeBranchId]);`;

replaceFlexible(targetDef, replacementDef, "autoSaveSchedule debounced callback definition");

// 3. Restore schedule version immediate save (line 2337)
const targetRestore = `await autoSaveSchedule(versionToRestore.schedule);`;
const replacementRestore = `await autoSaveSchedule(versionToRestore.schedule, true);`;
replaceFlexible(targetRestore, replacementRestore, "Immediate save on version restore");

// 4. handleClearSchedule timeout immediate save (line 3685)
const targetClear = `      setTimeout(() => {
          if (activeBranchId && newSchedToSave) autoSaveSchedule(newSchedToSave);
      }, 0);`;
const replacementClear = `      setTimeout(() => {
          if (activeBranchId && newSchedToSave) autoSaveSchedule(newSchedToSave, true);
      }, 0);`;
replaceFlexible(targetClear, replacementClear, "Immediate save on clear schedule");

// 5. handleManagerApproveRequest immediate save (line 3293)
const targetApprove = `      setTimeout(() => {
          if (activeBranchId && newSchedToSave) {
              autoSaveSchedule(newSchedToSave);
          }
      }, 0);`;
const replacementApprove = `      setTimeout(() => {
          if (activeBranchId && newSchedToSave) {
              autoSaveSchedule(newSchedToSave, true);
          }
      }, 0);`;
replaceFlexible(targetApprove, replacementApprove, "Immediate save on manager request approval");

// 6. requestAutoAssign immediate save (line 3645)
const targetAutoAssign = `            setAiLoading(false);
            if (activeBranchId) autoSaveSchedule(newSched);
            return newSched;`;
const replacementAutoAssign = `            setAiLoading(false);
            if (activeBranchId) autoSaveSchedule(newSched, true);
            return newSched;`;
replaceFlexible(targetAutoAssign, replacementAutoAssign, "Immediate save on AI auto assign");

// 7. handleUndoSchedule immediate save (line 3657)
const targetUndo = `                  setSchedule(scheduleHistory);
                  if (activeBranchId) autoSaveSchedule(scheduleHistory);
                  setScheduleHistory(null);`;
const replacementUndo = `                  setSchedule(scheduleHistory);
                  if (activeBranchId) autoSaveSchedule(scheduleHistory, true);
                  setScheduleHistory(null);`;
replaceFlexible(targetUndo, replacementUndo, "Immediate save on Undo schedule");

// 8. Cancel approved job in forecast modal immediate save (line 4545)
const targetCancelJob = `                                                    if (newSched[activeDay.dateStr]) { if (activeDept === "kitchen") { newSched[activeDay.dateStr].eventExtraHoursKitchen = 0; } else { newSched[activeDay.dateStr].eventExtraHoursService = 0; newSched[activeDay.dateStr].eventExtraHours = 0; } }
                                                    if (activeBranchId) autoSaveSchedule(newSched);
                                                    return newSched;`;
const replacementCancelJob = `                                                    if (newSched[activeDay.dateStr]) { if (activeDept === "kitchen") { newSched[activeDay.dateStr].eventExtraHoursKitchen = 0; } else { newSched[activeDay.dateStr].eventExtraHoursService = 0; newSched[activeDay.dateStr].eventExtraHours = 0; } }
                                                    if (activeBranchId) autoSaveSchedule(newSched, true);
                                                    return newSched;`;
replaceFlexible(targetCancelJob, replacementCancelJob, "Immediate save on forecast modal job cancellation");

// 9. settings grid slot delete immediate save (line 8237)
const targetSlotDelete = `                                                    if (hasSchedChanges && activeBranchId) autoSaveSchedule(newSched);
                                                    return newSched;`;
const replacementSlotDelete = `                                                    if (hasSchedChanges && activeBranchId) autoSaveSchedule(newSched, true);
                                                    return newSched;`;
replaceFlexible(targetSlotDelete, replacementSlotDelete, "Immediate save on branch configuration matrix slot delete");

fs.writeFileSync(filePath, content, 'utf8');
console.log("DEBOUNCED AUTO-SAVE SYSTEM INSTALLED SUCCESSFULLY!");
