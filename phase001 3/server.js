const http = require('http');
const fs = require('fs');
const url = require('url');
const queryString = require('querystring');
const path = require('path');

let users = [];
let courses = [];

// Load users from the JSON file
fs.readFile('users.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading users.json:', err);
        return;
    }
    users = JSON.parse(data);
});

// Load courses from the JSON file
fs.readFile('courses.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading courses.json:', err);
        return;
    }
    courses = JSON.parse(data);
});

// In-memory session store
const sessions = {};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;

    if (parsedUrl.pathname === '/') {
        res.writeHead(302, { 'Location': '/public/login.html' });
        res.end();
        return;
    }

    // Serve static files
    if (parsedUrl.pathname.startsWith('/public')) {
        const filePath = path.join(__dirname, 'public', parsedUrl.pathname.substring(7));
        const extname = path.extname(filePath).toLowerCase();
        let contentType = 'text/plain';

        if (extname === '.css') contentType = 'text/css';
        else if (extname === '.js') contentType = 'application/javascript';
        else if (extname === '.html') contentType = 'text/html';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
        return;
    }

    // Login
    if (parsedUrl.pathname === '/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const { username, password } = queryString.parse(body);
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
    const sessionId = Date.now();
    sessions[sessionId] = user;

    if (user.type === 'student') {
        res.writeHead(302, { 'Location': `/main?sessionId=${sessionId}` });
    } else if (user.type === 'instructor') {
        res.writeHead(302, { 'Location': `/public/instructor.html?sessionId=${sessionId}` });
    } else if (user.type === 'admin') {
        res.writeHead(302, { 'Location': `/public/admin.html?sessionId=${sessionId}` });
    }

    res.end();
    return;
}

            
        });
        return;
    }

    // Register for a course
    if (parsedUrl.pathname === '/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const { sessionId, courseId, instructorName } = queryString.parse(body);
            const user = sessions[sessionId];
            if (!user || user.type !== 'student') {
                res.writeHead(403);
                res.end('Unauthorized');
                return;
            }

            const course = courses.find(c => c.course_id == courseId);
            if (!course || course.status !== 'open') {
                res.writeHead(400);
                res.end('Course not open or not found');
                return;
            }
             // Check if completed already with grade != F, D, D+
             const alreadyCompleted = user.completed_courses?.find(c =>
                c.course_id == courseId && !['F', 'D', 'D+'].includes(c.grade)
            );

            if (alreadyCompleted) {
                res.writeHead(400);
                res.end('You have already completed this course successfully.');
                return;
            }
            const hasCompletedPrerequisites = course.prerequisites.every(prereq =>
                user.completed_courses?.some(c => c.course_id == prereq)
            );

            if (!hasCompletedPrerequisites) {
                res.writeHead(400);
                res.end('Missing prerequisites');
                return;
            }

            const instructor = course.instructors.find(i => i.name === instructorName);
            if (!instructor || instructor.registered_students.length >= instructor.capacity) {
                res.writeHead(400);
                res.end('Instructor full or not found');
                return;
            }
            ////////////////////////////////
            //added  check for duplicate regsitration
            const alreadyRegistered = user.pending_courses.some(pc => 
                pc.course_id === parseInt(courseId) && pc.instructor === instructorName
            );
            if (alreadyRegistered) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Already registered for this section' }));
                return;
            }

            user.pending_courses = user.pending_courses || [];
            user.pending_courses.push({
                course_id: parseInt(courseId),
                instructor: instructorName
            });

            fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Failed to register');
                    return;
                }
                res.writeHead(200);
                res.end('Registered successfully, waiting for approval');
            });
        });
        return;
    }

    // Search & Send Courses
    if (parsedUrl.pathname === '/courses' && method === 'GET') {
        const search = parsedUrl.query.search?.toLowerCase() || "";
        const filteredCourses = courses.filter(course =>
            course.course_name.toLowerCase().includes(search) ||
            course.category.toLowerCase().includes(search)
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(filteredCourses));
        return;
    }

    /////////////////////
    if (parsedUrl.pathname === '/instructor-courses' && method === 'GET') {
        const sessionId = parsedUrl.query.sessionId;
        const user = sessions[sessionId];
    
        if (!user || user.type !== 'instructor') {
            res.writeHead(403);
            res.end('Unauthorized');
            return;
        }
    
        const instructorCourses = courses.filter(course =>
            course.instructors.some(i => i.name === user.username)
        ).map(course => {
            const instructor = course.instructors.find(i => i.name === user.username);
            return {
                course_id: course.course_id,
                course_name: course.course_name,
                registered_students: instructor.registered_students
            };
        });
    
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(instructorCourses));
        return;
    }
    
    
//    
if (parsedUrl.pathname === '/submit-grade' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const { sessionId, courseId, studentId, grade } = queryString.parse(body);
        const user = sessions[sessionId];

        if (!user || user.type !== 'instructor') {
            res.writeHead(403);
            res.end('Unauthorized');
            return;
        }

        const course = courses.find(c => c.course_id == courseId);
        const instructor = course.instructors.find(i => i.name === user.username);

        if (!course || !instructor) {
            res.writeHead(400);
            res.end('Invalid course or instructor');
            return;
        }

        if (!instructor.registered_students.includes(studentId)) {
            res.writeHead(400);
            res.end('Student not registered with you');
            return;
        }

        const student = users.find(u => u.id === studentId);

        student.completed_courses.push({
            course_id: parseInt(courseId),
            grade: grade
        });

        instructor.registered_students = instructor.registered_students.filter(id => id !== studentId);

        fs.writeFile('users.json', JSON.stringify(users, null, 2), () => {
            fs.writeFile('courses.json', JSON.stringify(courses, null, 2), () => {
                res.writeHead(200);
                res.end('Grade submitted successfully');
            });
        });
    });
    return;
}


/////////////////////////////
    // Learning Path Route for Students
    if (parsedUrl.pathname === '/learning-path' && method === 'GET') {
        const sessionId = parsedUrl.query.sessionId;
        const user = sessions[sessionId];

        if (!user || user.type !== 'student') {
            res.writeHead(403);
            res.end('Unauthorized');
            return;
        }

        const completedCourses = user.completed_courses.map(c => ({
            ...courses.find(course => course.course_id === c.course_id),
            grade: c.grade
        }));

        const inProgressCourses = user.completed_courses.filter(c => c.grade === "In Progress")
            .map(c => courses.find(course => course.course_id === c.course_id));

        const pendingCourses = user.pending_courses?.map(c => 
            courses.find(course => course.course_id === c.course_id)
        ) || [];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            completedCourses,
            inProgressCourses,
            pendingCourses
        }));
        return;
    }

 // instructor dashboard
 if (parsedUrl.pathname === '/instructor' && method === 'GET') {
    const sessionId = parsedUrl.query.sessionId;
    const user = sessions[sessionId];
    if (!user || user.type !== 'instructor') {
        res.writeHead(302, { 'Location': '/public/login.html' });
        res.end('Unauthorized');
        return;
    }

    fs.readFile('public/instructor.html', (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('admin page not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
    return;
}

// Instructor courses
if (parsedUrl.pathname === '/instructor-courses' && method === 'GET') {
    const sessionId = parsedUrl.query.sessionId;
    const user = sessions[sessionId];
    
    if (!user || user.type !== 'instructor') {
        res.writeHead(403);
        res.end('Unauthorized');
        return;
    }

    const instructorCourses = courses
        .map(course => ({
            ...course,
            instructors: course.instructors.filter(i => i.name === user.username)
        }))
        .filter(course => course.instructors.length > 0)
        .map(course => ({
            course_id: course.course_id,
            course_name: course.course_name,
            registered_students: course.instructors[0].registered_students,
            capacity: course.instructors[0].capacity
        }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(instructorCourses));
    return;
}




//admin dashboard
    if (parsedUrl.pathname === '/admin' && method === 'GET') {
        const sessionId = parsedUrl.query.sessionId;
        const user = sessions[sessionId];
        if (!user || user.type !== 'admin') {
            res.writeHead(302, { 'Location': '/public/login.html' });
            res.end('Unauthorized');
            return;
        }

        fs.readFile('public/admin.html', (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('admin page not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }


// get pending registrations
if (parsedUrl.pathname === '/pending-registrations' && method === 'GET') {
    const pendingRegistrations = users.reduce((acc, user) => {
        if (user.type === 'student' && user.pending_courses) {
            user.pending_courses.forEach(course => {
                if (!course.approved) {
                    acc.push({
                        studentId: user.id,
                        courseId: course.course_id,
                        instructor: course.instructor
                    });
                }
            });
        }
        return acc;
    }, 
    []);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pendingRegistrations));
    return;
}

// Approve registration
if (parsedUrl.pathname === '/approve-registration' && method === 'POST') {
    let body = '';
    req.on('data', part => { body += part.toString(); });
    req.on('end', () => {
        const { studentId, courseId } = JSON.parse(body);
        
        // Find student/course
        const student = users.find(u => u.id === studentId);
        const course = courses.find(c => c.course_id == courseId);
        
        if (!student || !course) {
            res.writeHead(404);
            res.end('Student or course not found');
            return;
        }

        //Find pending course
        const pendingCourseIndex = student.pending_courses.findIndex(
            pc => pc.course_id == courseId && !pc.approved
        );
        
        if (pendingCourseIndex === -1) {
            res.writeHead(400);
            res.end('No pending registration found');
            return;
        }

        const pendingCourse = student.pending_courses[pendingCourseIndex];
        
        // Find instructr
        const instructor = course.instructors.find(
            i => i.name === pendingCourse.instructor
        );
        
        if (!instructor || instructor.registered_students.length >= instructor.capacity) {
            res.writeHead(400);
            res.end('Instructor full or not found');
            return;
        }

        // Approve registration
        student.pending_courses[pendingCourseIndex].approved = true;
        instructor.registered_students.push(student.id);

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
            if (err) {
                res.writeHead(500);
                res.end('Failed to approve registration');
                return;
            }
            fs.writeFile('courses.json', JSON.stringify(courses, null, 2), (err) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Failed to update courses');
                    return;
                }
                res.writeHead(200);
                res.end(JSON.stringify({message: 'Registration approved successfully'}));
            });
        });
    });
    return;
}




// Admin view courses with status
if (parsedUrl.pathname === '/admin-courses' && method === 'GET') {
    const coursesWithStatus = courses.map(course => ({
      ...course,
      classes: course.instructors.map(instructor => ({
        instructor: instructor.name,
        students: instructor.registered_students,
        status: instructor.status || "pending",
        capacity: instructor.capacity
      }))
    }));
    res.end(JSON.stringify(coursesWithStatus));
    return;
  }
  
  // admin validate/cancel class
if (parsedUrl.pathname === '/validate-course' && method === 'POST') {
    let body = '';
    req.on('data', part => { body += part.toString(); });
    req.on('end', () => {
        try {
            const { courseId, instructorName, action } = JSON.parse(body);
            
            if (!['validate', 'cancel'].includes(action)) {
                return res.end('Invalid action');
            }

            const course = courses.find(c => c.course_id == courseId);
            if (!course) return res.end('Course not found');

            const instructor = course.instructors.find(i => i.name === instructorName);
            if (!instructor) return res.end('Instructor not found');

            if(action=== 'validate'){
                const minStudentRequired = Math.ceil(instructor.capacity/2);
                if(instructor.registered_students < minStudentRequired){
                    return res.end(`cannot validate - need at least ${minStudentRequired} students`);
            }
        }
            instructor.status = action === 'validate' ? 'validated' : 'cancelled';
            if (action === 'cancel') instructor.registered_students = [];
            fs.writeFile('courses.json', JSON.stringify(courses, null, 2), (err) => {
                if (err) {
                    console.error('Save error:', err);
                    return res.end('Error saving changes');
                }
                res.end(`Class ${action}d successfully`);
            });

        } catch (error) {
            console.error('Validation error:', error);
            res.end('Error processing request');
        }
    });
    return;
}

  //create class
if (parsedUrl.pathname === '/create-course' && method === 'POST') {
    let body = '';
    req.on('data', part => { body += part.toString(); });
    req.on('end', async () => {
        try {
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.writeHead(401);
                return res.end(JSON.stringify({ error: 'invalid authorization header' }));
            }
            
            const sessionId = authHeader.split(' ')[1];
            const user = sessions[sessionId];
            
            if (!user || user.type !== 'admin') {
                res.writeHead(403);
                return res.end(JSON.stringify({ error: 'Admin access required' }));
            }

            let courseData;
            try {
                courseData = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'Invalid JSON format' }));
            }

            const { name, category, description, instructor, capacity, prerequisites = [] } = courseData;
            
            //validate all fields
            if (!name || !category || !description || !instructor || capacity === undefined) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'All fields are required' }));
            }

            //valid capacity
            if (isNaN(capacity) || capacity <= 0) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'capacity must be a positive number' }));
            }

            //valide instructor
            const instructorExists = users.some(u => 
                u.username === instructor && u.type === 'instructor');
            if (!instructorExists) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'Instructor not found' }));
            }

            //valid prerequisities
            if (!Array.isArray(prerequisites)) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'Prerequisites must be an array' }));
            }

            const invalidPrereqs = prerequisites.filter(prereqId => 
                !courses.some(c => c.course_id === prereqId));
            
            if (invalidPrereqs.length > 0) {
                res.writeHead(400);
                return res.end(JSON.stringify({ 
                    error: `Invalid prerequisites: ${invalidPrereqs.join(', ')}` 
                }));
            }

        
            const newCourse = {
                course_id: Math.max(...courses.map(c => c.course_id), 0) + 1,
                course_name: name,
                category: category,
                course_description: description,
                prerequisites: prerequisites,
                status: "open",
                instructors: [{
                    name: instructor,
                    capacity: parseInt(capacity),
                    registered_students: [],
                    status: "pending"
                }]
            };

            courses.push(newCourse);
            await fs.promises.writeFile('courses.json', JSON.stringify(courses, null, 2));
            
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true,
                message: 'Course created successfully',
                course: newCourse 
            }));
            
        } catch (error) {
            console.error('Create Course Error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            }));
        }
    });
    return;
}


// Add class to existing course
if (parsedUrl.pathname === '/add-class' && method === 'POST') {
    let body = '';
    req.on('data', part => { body += part.toString(); });
    req.on('end', async () => {
        try {
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.writeHead(401);
                return res.end(JSON.stringify({ error: 'Invalid authorization header' }));
            }
            
            const sessionId = authHeader.split(' ')[1];
            const user = sessions[sessionId];
            
            if (!user || user.type !== 'admin') {
                res.writeHead(403);
                return res.end(JSON.stringify({ error: 'Admin access required' }));
            }

            let classData;
            try {
                classData = JSON.parse(body);
            } catch (e) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'Invalid JSON format' }));
            }

            const { courseId, instructor, capacity } = classData;
            
            //validate all fields
            if (!courseId || !instructor || capacity === undefined) {
                res.writeHead(400);
                return res.end('All fields are required' );
            }

            //valid capacity
            if (isNaN(capacity) || capacity <= 0) {
                res.writeHead(400);
                return res.end('Capacity must be a positive number' );
            }

            //find course
            const course = courses.find(c => c.course_id == courseId);
            if (!course) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: 'Course not found' }));
            }

            //valid instructor
            const instructorExists = users.some(u => 
                u.username === instructor && u.type === 'instructor');
            if (!instructorExists) {
                res.writeHead(400);
                return res.end(JSON.stringify({ error: 'Instructor not found' }));
            }

            //add class
            course.instructors.push({
                name: instructor,
                capacity: parseInt(capacity),
                registered_students: [],
                status: "pending"
            });

            await fs.promises.writeFile('courses.json', JSON.stringify(courses, null, 2));
            
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true,
                message: 'Class added successfully',
                course: course
            }));
            
        } catch (error) {
            console.error('Add Class Error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            }));
        }
    });
    return;
}




//////////////////////////////////////////////////////////
    // Main page
    if (parsedUrl.pathname === '/main' && method === 'GET') {
        const sessionId = parsedUrl.query.sessionId;
        const user = sessions[sessionId];
        if (!user) {
            res.writeHead(302, { 'Location': '/public/login.html' });
            res.end();
            return;
        }

        fs.readFile('public/main.html', (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Main page not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // Logout
    if (parsedUrl.pathname === '/logout' && method === 'GET') {
        const sessionId = parsedUrl.query.sessionId;
        delete sessions[sessionId];
        res.writeHead(302, { 'Location': '/public/login.html' });
        res.end();
        return;
    }

    // Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
