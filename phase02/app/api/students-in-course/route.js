import { getStudentsInCourse } from '@/lib/repository';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const courseId = parseInt(searchParams.get('courseId'));

  if (!courseId) {
    return Response.json({ error: 'Missing courseId' }, { status: 400 });
  }

  const students = await getStudentsInCourse(courseId);
  return Response.json(students);
}
