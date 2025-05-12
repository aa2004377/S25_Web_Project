'use server';

import { registerStudent } from '@/lib/repository';

export async function register({ studentId, instructorId, courseId }) {
  try {
    await registerStudent(studentId, instructorId, courseId);
    return { success: true };
  } catch (error) {
    console.error('Registration failed:', error);
    return { success: false, error: error.message };
  }
}
