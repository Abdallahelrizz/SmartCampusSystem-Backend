const { query } = require('../config/db');
const Notification = require('../models/Notification');
const { users } = require('../utils/dbHelpers');

class EmploymentController {
    static async getJobs(req, res) {
        try {
            // Read from the new availableJobs catalog, joined to studentEmployment when linked.
            const jobs = await query(
                `SELECT 
                    aj.available_job_id,
                    aj.job_id,
                    COALESCE(aj.job_title, se.job_title) AS job_title,
                    COALESCE(aj.description, se.description) AS description,
                    COALESCE(aj.salary, se.salary) AS salary,
                    COALESCE(aj.hours_per_week, se.hours_per_week) AS hours_per_week,
                    aj.department_id,
                    d.name AS department_name,
                    aj.required_skills,
                    aj.location,
                    aj.semester,
                    aj.status,
                    aj.posted_at,
                    aj.application_deadline
                 FROM availableJobs aj
                 LEFT JOIN studentEmployment se ON aj.job_id = se.job_id
                 LEFT JOIN departments d ON aj.department_id = d.department_id`
            );
            res.json(jobs);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async applyForJob(req, res) {
        try {
            if (req.user.role !== 'student') {
                return res.status(403).json({ error: 'Only students can apply for jobs' });
            }

            const { jobId, semester } = req.body;
            const job = await query('SELECT * FROM studentEmployment WHERE job_id = ?', [jobId]);
            
            if (!job[0]) {
                return res.status(404).json({ error: 'Job not found' });
            }

            // Determine current semester if not provided
            const now = new Date();
            const month = now.getMonth() + 1;
            let currentSemester = semester;
            if (!currentSemester) {
                if (month >= 9 || month <= 1) {
                    currentSemester = 'fall';
                } else if (month >= 2 && month <= 5) {
                    currentSemester = 'spring';
                } else {
                    currentSemester = 'summer';
                }
            }

            // Check if already applied for this job
            const existingApplication = await query(
                'SELECT * FROM employmentapplications WHERE job_id = ? AND user_id = ?',
                [jobId, req.user.user_id]
            );
            
            if (existingApplication.length > 0) {
                return res.status(400).json({ error: 'You have already applied for this job' });
            }

            // Check if the job already has an approved candidate
            const approvedForJob = await query(
                'SELECT * FROM employmentapplications WHERE job_id = ? AND status = ? LIMIT 1',
                [jobId, 'approved']
            );

            if (approvedForJob.length > 0) {
                return res.status(400).json({ error: 'This job has already been filled' });
            }

            const result = await query(
                `INSERT INTO employmentapplications (job_id, user_id, semester, application_date, status)
                 VALUES (?, ?, ?, NOW(), 'pending')`,
                [jobId, req.user.user_id, currentSemester]
            );

            const applicationId = result.insertId;
            const application = await query(
                'SELECT * FROM employmentapplications WHERE application_id = ?',
                [applicationId]
            );

            await Notification.create({
                user_id: req.user.user_id,
                type: 'employment',
                message: `Application submitted for ${job[0].job_title}`,
                notification_method: 'in-app'
            });

            res.status(201).json({ message: 'Application submitted', application: application[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyApplications(req, res) {
        try {
            const userApplications = await query(
                `SELECT ea.*, se.job_id, se.job_title, se.department_id, se.description, se.salary, se.hours_per_week, se.status as job_status, se.posted_at, se.application_deadline, se.supervisor_id
                 FROM employmentapplications ea
                 JOIN studentEmployment se ON ea.job_id = se.job_id
                 WHERE ea.user_id = ?
                 ORDER BY ea.application_date DESC`,
                [req.user.user_id]
            );
            
            // Format the result properly
            // Schema has department_id, not department - need to join with departments table or use department_id
            const formatted = await Promise.all(userApplications.map(async (row) => {
                const application = {
                    application_id: row.application_id,
                    job_id: row.job_id,
                    user_id: row.user_id,
                    semester: row.semester,
                    application_date: row.application_date,
                    status: row.status
                };
                
                // Get department name if department_id exists
                let departmentName = null;
                if (row.department_id) {
                    const dept = await query('SELECT name FROM departments WHERE department_id = ?', [row.department_id]);
                    departmentName = dept[0]?.name || null;
                }
                
                const job = {
                    job_id: row.job_id,
                    job_title: row.job_title,
                    department_id: row.department_id,
                    department: departmentName,
                    description: row.description
                };
                return { ...application, job };
            }));
            
            res.json(formatted);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getPendingApplications(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can view pending applications' });
            }

            const pendingApplications = await query(
                `SELECT ea.*, se.job_id, se.job_title, se.department_id, se.description, se.salary, se.hours_per_week, se.status as job_status, se.posted_at, se.application_deadline, se.supervisor_id,
                 u.user_id, u.email, u.first_name, u.last_name
                 FROM employmentapplications ea
                 JOIN studentEmployment se ON ea.job_id = se.job_id
                 JOIN users u ON ea.user_id = u.user_id
                 WHERE ea.status = 'pending'
                 ORDER BY ea.application_date ASC`
            );

            // Format the result properly - need to get department name
            const formatted = await Promise.all(pendingApplications.map(async (row) => {
                const application = {
                    application_id: row.application_id,
                    job_id: row.job_id,
                    user_id: row.user_id,
                    semester: row.semester,
                    application_date: row.application_date,
                    status: row.status
                };
                
                // Get department name if department_id exists
                let departmentName = null;
                if (row.department_id) {
                    const dept = await query('SELECT name FROM departments WHERE department_id = ?', [row.department_id]);
                    departmentName = dept[0]?.name || null;
                }
                
                const job = {
                    job_id: row.job_id,
                    job_title: row.job_title,
                    department_id: row.department_id,
                    department: departmentName,
                    description: row.description
                };
                const user = {
                    user_id: row.user_id,
                    email: row.email,
                    first_name: row.first_name,
                    last_name: row.last_name
                };
                return { ...application, job, user };
            }));

            res.json(formatted);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async approveApplication(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can approve applications' });
            }

            const { applicationId } = req.params;
            const application = await query(
                'SELECT * FROM employmentapplications WHERE application_id = ?',
                [applicationId]
            );
            
            if (!application[0]) {
                return res.status(404).json({ error: 'Application not found' });
            }

            if (application[0].status !== 'pending') {
                return res.status(400).json({ error: 'Application is not pending' });
            }

            const job = await query(
                'SELECT * FROM studentEmployment WHERE job_id = ?',
                [application[0].job_id]
            );

            // Check if user already has an approved application
            const existingApproved = await query(
                `SELECT * FROM employmentapplications 
                 WHERE user_id = ? AND status = 'approved' AND application_id != ?`,
                [application[0].user_id, applicationId]
            );

            // If user already has an approved job, reject it first
            if (existingApproved.length > 0) {
                const existingJob = await query(
                    'SELECT * FROM studentEmployment WHERE job_id = ?',
                    [existingApproved[0].job_id]
                );

                await query(
                    `UPDATE employmentapplications 
                     SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
                     WHERE application_id = ?`,
                    [req.user.user_id, existingApproved[0].application_id]
                );

                await Notification.create({
                    user_id: application[0].user_id,
                    type: 'employment',
                    message: `Your previously approved application for ${existingJob[0]?.job_title || 'a position'} has been replaced by a new approval.`,
                    notification_method: 'in-app'
                });
            }

            // Update application status
            await query(
                `UPDATE employmentapplications 
                 SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
                 WHERE application_id = ?`,
                [req.user.user_id, applicationId]
            );

            // Mark the related job as filled/unavailable in the catalog if it exists
            await query(
                `UPDATE availableJobs 
                 SET status = 'filled' 
                 WHERE job_id = ?`,
                [application[0].job_id]
            );

            await Notification.create({
                user_id: application[0].user_id,
                type: 'employment',
                message: `Your application for ${job[0]?.job_title || 'the position'} has been approved!`,
                notification_method: 'in-app'
            });

            // Reject other pending applications for the same job and semester
            const otherApplications = await query(
                `SELECT * FROM employmentapplications 
                 WHERE application_id != ? AND job_id = ? AND semester = ? AND status = 'pending'`,
                [applicationId, application[0].job_id, application[0].semester]
            );

            for (const otherApp of otherApplications) {
                await query(
                    `UPDATE employmentapplications 
                     SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
                     WHERE application_id = ?`,
                    [req.user.user_id, otherApp.application_id]
                );

                await Notification.create({
                    user_id: otherApp.user_id,
                    type: 'employment',
                    message: `Your application for ${job[0]?.job_title || 'the position'} has been rejected. Another candidate was selected.`,
                    notification_method: 'in-app'
                });
            }

            // Also reject any other pending applications by the same user
            const userOtherApps = await query(
                `SELECT * FROM employmentapplications 
                 WHERE application_id != ? AND user_id = ? AND status = 'pending'`,
                [applicationId, application[0].user_id]
            );

            for (const otherApp of userOtherApps) {
                const otherJob = await query(
                    'SELECT * FROM studentEmployment WHERE job_id = ?',
                    [otherApp.job_id]
                );

                await query(
                    `UPDATE employmentapplications 
                     SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
                     WHERE application_id = ?`,
                    [req.user.user_id, otherApp.application_id]
                );

                await Notification.create({
                    user_id: application[0].user_id,
                    type: 'employment',
                    message: `Your application for ${otherJob[0]?.job_title || 'a position'} has been rejected. You can only have one approved job at a time.`,
                    notification_method: 'in-app'
                });
            }

            res.json({ message: 'Application approved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async rejectApplication(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can reject applications' });
            }

            const { applicationId } = req.params;
            const { reason } = req.body;
            const application = await query(
                'SELECT * FROM employmentapplications WHERE application_id = ?',
                [applicationId]
            );
            
            if (!application[0]) {
                return res.status(404).json({ error: 'Application not found' });
            }

            if (application[0].status !== 'pending') {
                return res.status(400).json({ error: 'Application is not pending' });
            }

            await query(
                `UPDATE employmentapplications 
                 SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
                 WHERE application_id = ?`,
                [req.user.user_id, applicationId]
            );

            const job = await query(
                'SELECT * FROM studentEmployment WHERE job_id = ?',
                [application[0].job_id]
            );

            await Notification.create({
                user_id: application[0].user_id,
                type: 'employment',
                message: `Your application for ${job[0]?.job_title || 'the position'} has been rejected.`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Application rejected successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = EmploymentController;
