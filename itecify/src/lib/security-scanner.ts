export interface SecurityAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  line: number;
  message: string;
  recommendation: string;
}

export interface ScanResult {
  isSafe: boolean;
  alerts: SecurityAlert[];
  canRun: boolean;
  restrictions: string[];
}

const DANGEROUS_PATTERNS = [
  {
    pattern: /\b(eval|Function\(|setTimeout\s*\(\s*['"`]\s*\w+\s*['"`]|setInterval\s*\(\s*['"`]\s*\w+\s*['"`])\s*\(/g,
    severity: 'critical' as const,
    message: 'Dynamic code execution detected',
    recommendation: 'Avoid using eval() or similar dynamic execution methods'
  },
  {
    pattern: /\b(exec|spawn|execSync|spawnSync|system)\s*\(/g,
    severity: 'critical' as const,
    message: 'System command execution detected',
    recommendation: 'Avoid executing system commands from user code'
  },
  {
    pattern: /\b(import\s+os|from\s+os|import\s+sys|from\s+sys|import\s+subprocess|from\s+subprocess)\b/g,
    severity: 'high' as const,
    message: 'Dangerous module import detected',
    recommendation: 'Consider using safer alternatives'
  },
  {
    pattern: /\b(__import__|imp\.|pkg_resources|importlib)\s*\(/g,
    severity: 'high' as const,
    message: 'Dynamic module loading detected',
    recommendation: 'Use explicit imports instead'
  },
  {
    pattern: /\b(open\s*\([^)]*['"`][wr][^)]*['"`]\s*\))/g,
    severity: 'medium' as const,
    message: 'File system write operation detected',
    recommendation: 'Ensure proper file path validation'
  },
  {
    pattern: /\b(socket\s*\.|connect\s*\(|http\.request|https\.request)/g,
    severity: 'medium' as const,
    message: 'Network request detected',
    recommendation: 'Verify the destination is trusted'
  },
  {
    pattern: /\b(os\.chmod|os\.chown|os\.rename|os\.remove|shutil\.\w+)/g,
    severity: 'medium' as const,
    message: 'Potentially dangerous file operation',
    recommendation: 'Review file operation safety'
  },
  {
    pattern: /\b(while\s*\(\s*true\s*\)|while\s*\(\s*1\s*\)|for\s*\(\s*;\s*;\s*\))/g,
    severity: 'low' as const,
    message: 'Potential infinite loop pattern',
    recommendation: 'Ensure loop has proper exit conditions'
  },
  {
    pattern: /\b(requests\.|urllib\.|aiohttp\.|httpx\.)/g,
    severity: 'low' as const,
    message: 'HTTP library usage detected',
    recommendation: 'Ensure requests are to trusted endpoints'
  },
];

export function scanCode(code: string, language: string): ScanResult {
  const lines = code.split('\n');
  const alerts: SecurityAlert[] = [];
  
  lines.forEach((line, index) => {
    for (const patternDef of DANGEROUS_PATTERNS) {
      if (patternDef.pattern.test(line)) {
        alerts.push({
          severity: patternDef.severity,
          pattern: patternDef.pattern.source,
          line: index + 1,
          message: patternDef.message,
          recommendation: patternDef.recommendation,
        });
        patternDef.pattern.lastIndex = 0;
      }
    }
  });

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const highAlerts = alerts.filter(a => a.severity === 'high');
  
  const canRun = criticalAlerts.length === 0 && highAlerts.length === 0;
  
  const restrictions: string[] = [];
  if (alerts.some(a => a.severity === 'critical')) {
    restrictions.push('EXECUTION_BLOCKED');
  }
  if (alerts.some(a => a.severity === 'high' || a.severity === 'medium')) {
    restrictions.push('RESTRICTED_FS');
    restrictions.push('RESTRICTED_NET');
  }
  if (lines.some(l => l.includes('while') || l.includes('for'))) {
    restrictions.push('INSTRUCTION_LIMIT:100000');
  }

  return {
    isSafe: alerts.length === 0,
    alerts,
    canRun,
    restrictions,
  };
}

export function formatAlertsForTerminal(alerts: SecurityAlert[]): string[] {
  const output: string[] = [];
  
  if (alerts.length === 0) {
    output.push('\x1b[32m✓ Security scan passed - no issues found\x1b[0m');
    return output;
  }

  output.push('\x1b[33m⚠ Security scan completed with warnings\x1b[0m');
  output.push('');
  
  const bySeverity = {
    critical: alerts.filter(a => a.severity === 'critical'),
    high: alerts.filter(a => a.severity === 'high'),
    medium: alerts.filter(a => a.severity === 'medium'),
    low: alerts.filter(a => a.severity === 'low'),
  };
  
  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;
    
    const color = severity === 'critical' ? '31' : severity === 'high' ? '33' : severity === 'medium' ? '33' : '90';
    output.push(`\x1b[${color}m[${severity.toUpperCase()}] ${items.length} issue(s)\x1b[0m`);
    
    items.forEach(alert => {
      output.push(`  \x1b[90mLine ${alert.line}:\x1b[0m ${alert.message}`);
      output.push(`  \x1b[90m  →\x1b[0m ${alert.recommendation}`);
    });
    output.push('');
  }
  
  return output;
}
