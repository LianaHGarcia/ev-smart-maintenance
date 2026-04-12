import React, { useState } from 'react';

const Maintenance: React.FC = () => {
  const [date] = useState('2026-04-11 22:37:07');
  const [status, setStatus] = useState('scheduled');

  const handleUpdate = () => {
    // Handle status update
    console.log('Status updated to:', status);
  };

  return (
    <section className="maintenance">
      <h1>Maintenance Tracking Interface</h1>
      <div id="tracking">
        <div>
          <label htmlFor="date">Date:</label>
          <input type="text" id="date" name="date" value={date} readOnly />
        </div>
        <div>
          <label htmlFor="status">Status:</label>
          <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button type="button" onClick={handleUpdate}>Update Status</button>
      </div>
    </section>
  );
};

export default Maintenance;
