import React, { useState } from 'react';

/**
 * ShiftDropdown - Dropdown UI for assigning Primary or Backup shift to a staff member on a given day.
 * Props:
 *   staffId: string - ID of the staff row (used for assignment)
 *   dayStr: string - Date string (YYYY-MM-DD)
 *   onAssign: (staffId, dayStr, shiftType) => void
 *   existingInfo: object | null - current duty info for the cell (optional)
 */
const ShiftDropdown = ({ staffId, dayStr, onAssign, existingInfo }) => {
  const [selected, setSelected] = useState('');

  const handleChange = (e) => {
    const shiftType = e.target.value;
    setSelected(shiftType);
    if (shiftType) {
      onAssign(staffId, dayStr, shiftType);
    }
  };

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="w-full text-center bg-indigo-50 border border-indigo-200 rounded py-0.5 text-xs"
      title="Assign Primary or Backup shift"
    >
      <option value="" disabled>
        -- Assign --
      </option>
      <optgroup label="Primary">
        <option value="primary">Primary</option>
      </optgroup>
      <optgroup label="Backup">
        <option value="backup">Backup</option>
      </optgroup>
    </select>
  );
};

export default ShiftDropdown;
