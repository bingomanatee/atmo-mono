/**
 * Example Task Handlers for WorkerResponder
 * These demonstrate real-world usage patterns with injectable utilities
 */

import type { TaskHandler } from '../WorkerResponder';

// ─── HTTP/API Tasks ─────────────────────────────────────────────────────

export const fetchUserData: TaskHandler = async (parameters, utilities) => {
  const { userId } = parameters;
  
  utilities.logger.info(`Fetching user data for ID: ${userId}`);
  
  const response = await utilities.http.get(`https://api.example.com/users/${userId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }
  
  const userData = await response.json();
  
  utilities.logger.info(`Successfully fetched user: ${userData.name}`);
  return userData;
};

export const sendNotification: TaskHandler = async (parameters, utilities) => {
  const { userId, message, type = 'info' } = parameters;
  
  utilities.logger.info(`Sending ${type} notification to user ${userId}`);
  
  const response = await utilities.http.post('https://api.example.com/notifications', {
    userId,
    message,
    type,
    timestamp: new Date().toISOString(),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send notification: ${response.status}`);
  }
  
  return { sent: true, notificationId: (await response.json()).id };
};

// ─── File Processing Tasks ──────────────────────────────────────────────

export const processCSV: TaskHandler = async (parameters, utilities) => {
  const { inputPath, outputPath } = parameters;
  
  utilities.logger.info(`Processing CSV file: ${inputPath}`);
  
  // Read input file
  const csvContent = await utilities.fs.readFile(inputPath);
  
  // Simple CSV processing (in real world, use a proper CSV library)
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header.trim()] = values[index]?.trim() || '';
      return obj;
    }, {} as Record<string, string>);
  });
  
  // Process data (example: add processed timestamp)
  const processedRows = rows.map(row => ({
    ...row,
    processedAt: new Date().toISOString(),
  }));
  
  // Write output
  const outputContent = JSON.stringify(processedRows, null, 2);
  await utilities.fs.writeFile(outputPath, outputContent);
  
  utilities.logger.info(`Processed ${rows.length} rows, saved to: ${outputPath}`);
  
  return {
    rowsProcessed: rows.length,
    outputPath,
    headers,
  };
};

export const generateReport: TaskHandler = async (parameters, utilities) => {
  const { templatePath, dataPath, outputPath } = parameters;
  
  utilities.logger.info(`Generating report: ${outputPath}`);
  
  // Read template and data
  const template = await utilities.fs.readFile(templatePath);
  const dataContent = await utilities.fs.readFile(dataPath);
  const data = JSON.parse(dataContent);
  
  // Simple template replacement (in real world, use a proper template engine)
  let report = template;
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    report = report.replace(new RegExp(placeholder, 'g'), String(value));
  });
  
  // Add generation metadata
  report += `\n\n<!-- Generated at ${new Date().toISOString()} -->`;
  
  await utilities.fs.writeFile(outputPath, report);
  
  utilities.logger.info(`Report generated successfully: ${outputPath}`);
  
  return {
    generated: true,
    outputPath,
    templateVariables: Object.keys(data),
  };
};

// ─── Database Tasks ─────────────────────────────────────────────────────

export const syncUserData: TaskHandler = async (parameters, utilities) => {
  const { userId, userData } = parameters;
  
  utilities.logger.info(`Syncing user data for ID: ${userId}`);
  
  return await utilities.db.transaction(async (db) => {
    // Check if user exists
    const existingUsers = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    
    if (existingUsers.length > 0) {
      // Update existing user
      const result = await db.execute(
        'UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ?',
        [userData.name, userData.email, userId]
      );
      
      utilities.logger.info(`Updated user ${userId}`);
      return { action: 'updated', userId, affectedRows: result.affectedRows };
    } else {
      // Insert new user
      const result = await db.execute(
        'INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, NOW())',
        [userId, userData.name, userData.email]
      );
      
      utilities.logger.info(`Created user ${userId}`);
      return { action: 'created', userId, affectedRows: result.affectedRows };
    }
  });
};

export const generateAnalytics: TaskHandler = async (parameters, utilities) => {
  const { startDate, endDate, metrics } = parameters;
  
  utilities.logger.info(`Generating analytics from ${startDate} to ${endDate}`);
  
  const results: Record<string, any> = {};
  
  // Generate different metrics based on request
  for (const metric of metrics) {
    switch (metric) {
      case 'user_count':
        const userCount = await utilities.db.query(
          'SELECT COUNT(*) as count FROM users WHERE created_at BETWEEN ? AND ?',
          [startDate, endDate]
        );
        results.userCount = userCount[0].count;
        break;
        
      case 'activity_summary':
        const activities = await utilities.db.query(
          'SELECT activity_type, COUNT(*) as count FROM activities WHERE created_at BETWEEN ? AND ? GROUP BY activity_type',
          [startDate, endDate]
        );
        results.activitySummary = activities;
        break;
        
      default:
        utilities.logger.warn(`Unknown metric: ${metric}`);
    }
  }
  
  utilities.logger.info(`Analytics generated with ${Object.keys(results).length} metrics`);
  
  return {
    period: { startDate, endDate },
    metrics: results,
    generatedAt: new Date().toISOString(),
  };
};

// ─── Utility Tasks ──────────────────────────────────────────────────────

export const healthCheck: TaskHandler = async (parameters, utilities) => {
  utilities.logger.info('Performing health check');
  
  const checks = {
    timestamp: new Date().toISOString(),
    services: {} as Record<string, any>,
  };
  
  // Check HTTP connectivity
  try {
    const response = await utilities.http.get('https://httpbin.org/status/200');
    checks.services.http = { status: 'ok', responseTime: Date.now() };
  } catch (error) {
    checks.services.http = { status: 'error', error: String(error) };
  }
  
  // Check file system
  try {
    await utilities.fs.exists('/tmp');
    checks.services.filesystem = { status: 'ok' };
  } catch (error) {
    checks.services.filesystem = { status: 'error', error: String(error) };
  }
  
  // Check database
  try {
    await utilities.db.query('SELECT 1');
    checks.services.database = { status: 'ok' };
  } catch (error) {
    checks.services.database = { status: 'error', error: String(error) };
  }
  
  const allHealthy = Object.values(checks.services).every(
    (service: any) => service.status === 'ok'
  );
  
  utilities.logger.info(`Health check completed: ${allHealthy ? 'healthy' : 'issues detected'}`);
  
  return {
    ...checks,
    overall: allHealthy ? 'healthy' : 'degraded',
  };
};

// ─── Export All Handlers ───────────────────────────────────────────────

export const exampleTaskHandlers = {
  'fetch-user-data': fetchUserData,
  'send-notification': sendNotification,
  'process-csv': processCSV,
  'generate-report': generateReport,
  'sync-user-data': syncUserData,
  'generate-analytics': generateAnalytics,
  'health-check': healthCheck,
};
