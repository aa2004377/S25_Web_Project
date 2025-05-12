'use client';

import { useState } from 'react';
import { register } from '@/app/actions/register';

export default function TestRegistration() {
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    setMessage('Registering...');
    const result = await register({
      studentId,
      instructorId,
      courseId: parseInt(courseId)
    });

    if (result.success) {
      setMessage('✅ Registration successful!');
    } else {
      setMessage(`❌ Error: ${result.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h2>📘 Test Course Registration</h2>

      <div style={{ margin: '1rem 0' }}>
        <label>Student ID: </label>
        <input value={studentId} onChange={e => setStudentId(e.target.value)} />
      </div>

      <div style={{ margin: '1rem 0' }}>
        <label>Course ID: </label>
        <input value={courseId} onChange={e => setCourseId(e.target.value)} />
      </div>

      <div style={{ margin: '1rem 0' }}>
        <label>Instructor ID: </label>
        <input value={instructorId} onChange={e => setInstructorId(e.target.value)} />
      </div>

      <button onClick={handleRegister} style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' }}>
        Register
      </button>

      <div style={{ marginTop: '1rem' }}>{message}</div>
    </div>
  );
}
