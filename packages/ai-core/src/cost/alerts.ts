import { randomUUID } from 'node:crypto';
import type { CostRecord } from '../types/cost.js';

/** Alert severity levels */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Alert trigger configuration */
export interface CostAlertRule {
  readonly id: string;
  readonly name: string;
  readonly tenantId?: string;  // If undefined, applies globally
  readonly threshold: number;
  readonly period: 'request' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  readonly severity: AlertSeverity;
}

/** A triggered alert */
export interface CostAlert {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: AlertSeverity;
  readonly currentValue: number;
  readonly threshold: number;
  readonly message: string;
  readonly triggeredAt: Date;
  readonly tenantId?: string;
}

/** Callback for when an alert is triggered */
export type AlertCallback = (alert: CostAlert) => void;

/**
 * Manages cost alert rules and triggers alerts when thresholds are exceeded.
 */
export class CostAlertManager {
  private readonly rules: CostAlertRule[] = [];
  private readonly alerts: CostAlert[] = [];
  private readonly callbacks: AlertCallback[] = [];

  /**
   * Register an alert rule.
   * @param rule The alert rule to add.
   */
  public addRule(rule: CostAlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove an alert rule by ID.
   * @param ruleId The ID of the rule to remove.
   */
  public removeRule(ruleId: string): void {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
    }
  }

  /**
   * Register a callback for when alerts fire.
   * @param callback The callback function.
   */
  public onAlert(callback: AlertCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Evaluate all rules against current cost records.
   * @param records All cost records to check against.
   * @returns Newly triggered alerts.
   */
  public evaluate(records: readonly CostRecord[]): readonly CostAlert[] {
    const newAlerts: CostAlert[] = [];

    for (const rule of this.rules) {
      let relevantRecords = records;

      if (rule.tenantId !== undefined) {
        // Assume tenantId might be stored in metadata since CostRecord does not have it natively?
        // Let's filter records. Actually, tenantId isn't on CostRecord directly!
        // We will assume it's stored in metadata.tenantId.
        relevantRecords = relevantRecords.filter((r) => r.metadata?.tenantId === rule.tenantId);
      }

      const startOfPeriod = this.getStartOfPeriod(rule.period);
      
      let currentValue = 0;
      if (rule.period === 'request') {
        const lastRecord = relevantRecords[relevantRecords.length - 1];
        if (lastRecord) {
          currentValue = lastRecord.totalCost;
        }
      } else {
        for (const r of relevantRecords) {
          if (r.timestamp >= startOfPeriod) {
            currentValue += r.totalCost;
          }
        }
      }

      if (currentValue > rule.threshold) {
        const alert: CostAlert = {
          id: randomUUID(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          currentValue,
          threshold: rule.threshold,
          message: `Alert '${rule.name}' triggered: Current cost ${currentValue} exceeds threshold ${rule.threshold}`,
          triggeredAt: new Date(),
          tenantId: rule.tenantId,
        };

        this.alerts.push(alert);
        newAlerts.push(alert);

        for (const cb of this.callbacks) {
          try {
            cb(alert);
          } catch {
            // Ignore callback errors
          }
        }
      }
    }

    return newAlerts;
  }

  /**
   * Get all triggered alerts.
   * @returns All triggered alerts.
   */
  public getAlerts(): readonly CostAlert[] {
    return this.alerts;
  }

  /**
   * Get alerts by severity.
   * @param severity The severity level to filter by.
   * @returns Alerts matching the given severity.
   */
  public getAlertsBySeverity(severity: AlertSeverity): readonly CostAlert[] {
    return this.alerts.filter((a) => a.severity === severity);
  }

  /**
   * Clear all alerts.
   */
  public clearAlerts(): void {
    this.alerts.length = 0;
  }

  /**
   * Private helper to filter records by time period.
   * @param period The alert period.
   * @returns The starting date for the specified period.
   */
  private getStartOfPeriod(period: CostAlertRule['period']): Date {
    const now = new Date();
    switch (period) {
      case 'request':
        return now; // Not really used for request period
      case 'hourly':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly': {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = startOfDay.getDay(); // 0 is Sunday, 1 is Monday
        const diff = startOfDay.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        return new Date(startOfDay.setDate(diff));
      }
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        // Fallback for unknown period type
        return new Date(0);
    }
  }
}
