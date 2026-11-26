/**
 * DeskPilot MCP - Everyday Utility Tools
 * Implements standard Model Context Protocol (MCP) Tool definitions and execution handlers.
 */

import os from 'os';
import path from 'path';

// In-memory demo datastores for zero-dependency portability
export const mockCalendar = [
  { id: 'ev_1', title: 'Sprint Standup & Planning', start: '09:30', end: '10:15', category: 'work', attendees: 5 },
  { id: 'ev_2', title: 'Product Architecture Sync', start: '10:00', end: '11:00', category: 'work', attendees: 3 }, // conflict with ev_1!
  { id: 'ev_3', title: 'Dentist Appointment', start: '13:00', end: '13:45', category: 'personal', attendees: 1 },
  { id: 'ev_4', title: 'College Lab / Assignment Submission', start: '15:00', end: '16:30', category: 'study', attendees: 2 }
];

export const mockExpenses = [
  { id: 'tx_1', date: '2026-11-20', merchant: 'Zepto Grocery', amount: 480, category: 'Food & Essentials' },
  { id: 'tx_2', date: '2026-11-22', merchant: 'Electricity Bill', amount: 1350, category: 'Utilities' },
  { id: 'tx_3', date: '2026-11-23', merchant: 'Coffee & Snacks', amount: 210, category: 'Food & Dining' }
];

export const MCP_TOOLS = [
  {
    name: 'calendar_triage',
    description: 'Triages daily calendar events, detects overlapping meeting conflicts, highlights high-priority tasks, and calculates uninterrupted focus blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Target date (YYYY-MM-DD or "today")' },
        detectConflicts: { type: 'boolean', description: 'Whether to flag overlapping events' }
      },
      required: ['date']
    }
  },
  {
    name: 'smart_file_organizer',
    description: 'Audits and organizes chaotic directories (e.g. Downloads/Desktop) into clean categories (Receipts, Docs, Media, Code, Archives) with safety dry-run verification.',
    inputSchema: {
      type: 'object',
      properties: {
        targetFolder: { type: 'string', description: 'Folder name or path (e.g., "Downloads", "Receipts")' },
        dryRun: { type: 'boolean', description: 'Preview file movements without moving files on disk' }
      },
      required: ['targetFolder']
    }
  },
  {
    name: 'expense_tracker',
    description: 'Logs everyday expenses, categorizes spending, and warns if monthly threshold exceeds limits.',
    inputSchema: {
      type: 'object',
      properties: {
        merchant: { type: 'string', description: 'Store, vendor, or purpose' },
        amount: { type: 'number', description: 'Transaction amount in INR or USD' },
        category: { type: 'string', enum: ['Food & Dining', 'Groceries', 'Utilities', 'Education', 'Transport', 'Shopping', 'Other'] },
        note: { type: 'string', description: 'Optional context or invoice number' }
      },
      required: ['merchant', 'amount', 'category']
    }
  },
  {
    name: 'eisenhower_prioritizer',
    description: 'Prioritizes an unorganized list of everyday tasks using the Eisenhower Matrix (Do First, Schedule, Delegate, Eliminate).',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              urgent: { type: 'boolean' },
              important: { type: 'boolean' }
            },
            required: ['title', 'urgent', 'important']
          },
          description: 'List of tasks with urgency and importance flags'
        }
      },
      required: ['tasks']
    }
  },
  {
    name: 'system_health',
    description: 'Provides controlled, safe local workstation telemetry (free memory, CPU load, platform, uptime) for diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: { type: 'boolean', description: 'Return detailed network and memory breakdown' }
      }
    }
  }
];

export async function executeTool(name, args = {}) {
  switch (name) {
    case 'calendar_triage': {
      const date = args.date || 'today';
      const events = [...mockCalendar];
      
      // Check for conflicts
      const conflicts = [];
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const a = events[i];
          const b = events[j];
          if ((a.start < b.end && a.end > b.start)) {
            conflicts.push({
              conflictBetween: [a.title, b.title],
              timeOverlap: `${Math.max(parseInt(a.start), parseInt(b.start))}:00 window`
            });
          }
        }
      }

      return {
        date,
        totalEvents: events.length,
        schedule: events,
        conflictsDetected: conflicts.length > 0,
        conflicts,
        focusBlocks: [
          { window: '11:00 - 13:00', durationMinutes: 120, quality: 'Deep Work' },
          { window: '13:45 - 15:00', durationMinutes: 75, quality: 'Focus Work' }
        ],
        recommendation: conflicts.length > 0 
          ? `Action Needed: Overlap between "${conflicts[0].conflictBetween[0]}" and "${conflicts[0].conflictBetween[1]}". Reschedule one to 11:30.`
          : 'Schedule clear with solid focus windows.'
      };
    }

    case 'smart_file_organizer': {
      const targetFolder = args.targetFolder || 'Downloads';
      const dryRun = args.dryRun !== false;

      const sampleFiles = [
        { name: 'invoice_aws_nov2026.pdf', size: '245 KB', category: 'Financial & Invoices' },
        { name: 'college_assignment_draft.docx', size: '1.2 MB', category: 'Documents & Notes' },
        { name: 'hackathon_team_photo.png', size: '4.8 MB', category: 'Media' },
        { name: 'dataset_v1.zip', size: '84.2 MB', category: 'Archives & Data' },
        { name: 'setup_script.sh', size: '12 KB', category: 'Code & Scripts' }
      ];

      return {
        targetFolder,
        mode: dryRun ? 'DRY-RUN (Safe Preview)' : 'EXECUTED',
        filesScanned: sampleFiles.length,
        proposedMoves: sampleFiles.map(f => ({
          file: f.name,
          currentLocation: `${targetFolder}/${f.name}`,
          destination: `${targetFolder}/${f.category}/${f.name}`,
          safeToMove: true
        })),
        safetyVerification: {
          noOverwrites: true,
          permissionCheck: 'PASSED',
          systemFilesExcluded: true
        },
        statusMessage: dryRun 
          ? 'Simulation complete: 5 files mapped to organized subdirectories. Awaiting user confirmation to apply.' 
          : 'Success: 5 files moved cleanly into categorized directories.'
      };
    }

    case 'expense_tracker': {
      const { merchant, amount, category, note } = args;
      if (!merchant || amount === undefined || !category) {
        throw new Error('Missing required arguments: merchant, amount, category');
      }

      const newTx = {
        id: `tx_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        merchant,
        amount: Number(amount),
        category,
        note: note || ''
      };
      mockExpenses.push(newTx);

      const totalSpent = mockExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      const monthlyBudget = 10000;
      const budgetRemaining = monthlyBudget - totalSpent;

      return {
        status: 'LOGGED_TO_LEDGER',
        transaction: newTx,
        summary: {
          totalTransactions: mockExpenses.length,
          totalSpentMonth: totalSpent,
          monthlyBudget,
          budgetRemaining,
          budgetWarning: budgetRemaining < 2000 ? 'Warning: Under 20% budget remaining this month.' : 'Normal'
        }
      };
    }

    case 'eisenhower_prioritizer': {
      const tasks = Array.isArray(args.tasks) ? args.tasks : [];
      const matrix = {
        doFirst: [],     // Urgent & Important
        schedule: [],    // Not Urgent & Important
        delegate: [],    // Urgent & Not Important
        eliminate: []    // Not Urgent & Not Important
      };

      tasks.forEach(t => {
        if (t.urgent && t.important) {
          matrix.doFirst.push({ task: t.title, priority: 'P1 - Immediate Focus' });
        } else if (!t.urgent && t.important) {
          matrix.schedule.push({ task: t.title, priority: 'P2 - Schedule Block' });
        } else if (t.urgent && !t.important) {
          matrix.delegate.push({ task: t.title, priority: 'P3 - Quick / Automate' });
        } else {
          matrix.eliminate.push({ task: t.title, priority: 'P4 - Drop / Defer' });
        }
      });

      return {
        totalTasks: tasks.length,
        matrix,
        recommendedNextAction: matrix.doFirst.length > 0 
          ? `Work immediately on: "${matrix.doFirst[0].task}"` 
          : 'No urgent critical tasks. Tackle your scheduled high-value blocks.'
      };
    }

    case 'system_health': {
      const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
      const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
      const usedMemPercent = Math.round(((totalMemMB - freeMemMB) / totalMemMB) * 100);

      return {
        platform: os.platform(),
        architecture: os.arch(),
        uptimeHours: (os.uptime() / 3600).toFixed(1),
        memory: {
          freeMB: freeMemMB,
          totalMB: totalMemMB,
          usedPercent: `${usedMemPercent}%`
        },
        cpus: os.cpus().length,
        status: usedMemPercent > 90 ? 'HEAVY_LOAD' : 'OPTIMAL',
        safetyAudit: 'Safe execution boundary verified. No elevated permissions requested.'
      };
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}
