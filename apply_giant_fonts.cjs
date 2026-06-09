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

// 1. Replace print font variables block
const targetVars = `  const isWeeklyPrint = CALENDAR_DAYS.length === 7;
  const printTableFontSize = isWeeklyPrint ? '12px' : '9px';
  const printCellWorkTimeSize = isWeeklyPrint ? '12.5px' : '9.5px';
  const printEmployeeNameSize = isWeeklyPrint ? '12.5px' : '9.5px';
  const printEmployeePosSize = isWeeklyPrint ? '12px' : '9px';
  const printDutyLayerSize = isWeeklyPrint ? '11px' : '8px';
  const printTdPadding = isWeeklyPrint ? '8px 6px' : '4px 2px';
  const printThPadding = isWeeklyPrint ? '10px 6px' : '5px 3px';
  const printRowHeight = isWeeklyPrint ? '50px' : '35px';`;

const replacementVars = `  const isWeeklyPrint = CALENDAR_DAYS.length === 7;
  const printTableFontSize = isWeeklyPrint ? '12px' : '9px';
  const printCellWorkTimeSize = isWeeklyPrint ? '16px' : '12px';
  const printCellLeaveSize = isWeeklyPrint ? '14px' : '10.5px';
  const printEmployeeNameSize = isWeeklyPrint ? '13px' : '10px';
  const printEmployeePosSize = isWeeklyPrint ? '12px' : '9px';
  const printDutyLayerSize = isWeeklyPrint ? '11px' : '8px';
  const printTdPadding = isWeeklyPrint ? '8px 6px' : '4px 2px';
  const printThPadding = isWeeklyPrint ? '10px 6px' : '5px 3px';
  const printRowHeight = isWeeklyPrint ? '50px' : '35px';`;

replaceFlexible(targetVars, replacementVars, "Giant print font variables declaration");

// 2. Replace print-cell-leave in stylesheet
const targetLeaveCss = `          .print-cell-leave {
            font-size: \${printCellWorkTimeSize} !important;
            font-weight: 900 !important;
            border: 1px solid #000000 !important;
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            border-radius: 4px !important;
          }`;

const replacementLeaveCss = `          .print-cell-leave {
            font-size: \${printCellLeaveSize} !important;
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
          }`;

replaceFlexible(targetLeaveCss, replacementLeaveCss, "Giant print leave CSS declaration");

fs.writeFileSync(filePath, content, 'utf8');
console.log("GIANT FONTS SUCCESSFULLY INSTALLED!");
