import { randomUUID } from 'node:crypto';

/** Fine-tuning job status */
export type FineTuneStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** Fine-tuning hyperparameters */
export interface FineTuneHyperparams {
  readonly epochs?: number;
  readonly batchSize?: number;
  readonly learningRate?: number;
  readonly warmupSteps?: number;
}

/** Fine-tuning job definition */
export interface FineTuneJob {
  readonly id: string;
  readonly name: string;
  readonly baseModel: string;
  readonly resultModel?: string;  // ID of the resulting fine-tuned model
  readonly provider: string;
  readonly status: FineTuneStatus;
  readonly hyperparams: FineTuneHyperparams;
  readonly trainingFile: string;  // Reference to training data
  readonly validationFile?: string;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly metrics?: FineTuneMetrics;
  readonly metadata: Record<string, unknown>;
}

/** Metrics from a fine-tuning run */
export interface FineTuneMetrics {
  readonly trainingLoss: number;
  readonly validationLoss?: number;
  readonly trainedTokens: number;
  readonly epochs: number;
}

/**
 * Manages fine-tuning job lifecycle.
 */
export class FineTuneManager {
  private readonly jobs = new Map<string, FineTuneJob>();

  constructor() {}

  /**
   * Creates a new fine-tuning job.
   * 
   * @param params - The parameters for the new fine-tuning job.
   * @returns The newly created fine-tuning job.
   */
  public createJob(params: {
    name: string;
    baseModel: string;
    provider: string;
    trainingFile: string;
    validationFile?: string;
    hyperparams?: FineTuneHyperparams;
    metadata?: Record<string, unknown>;
  }): FineTuneJob {
    const job: FineTuneJob = {
      id: randomUUID(),
      name: params.name,
      baseModel: params.baseModel,
      provider: params.provider,
      trainingFile: params.trainingFile,
      validationFile: params.validationFile,
      hyperparams: params.hyperparams || {},
      status: 'pending',
      createdAt: new Date(),
      metadata: params.metadata || {}
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Gets a job by its ID.
   * 
   * @param jobId - The ID of the fine-tuning job.
   * @returns The job if found, undefined otherwise.
   */
  public getJob(jobId: string): FineTuneJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Lists all fine-tuning jobs, optionally filtered by status.
   * 
   * @param status - The status to filter by.
   * @returns A readonly array of matching fine-tuning jobs.
   */
  public listJobs(status?: FineTuneStatus): readonly FineTuneJob[] {
    const allJobs = Array.from(this.jobs.values());
    if (status) {
      return allJobs.filter(job => job.status === status);
    }
    return allJobs;
  }

  /**
   * Starts a pending fine-tuning job.
   * 
   * @param jobId - The ID of the fine-tuning job to start.
   */
  public startJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'pending') {
      this.jobs.set(jobId, {
        ...job,
        status: 'running',
        startedAt: new Date()
      });
    }
  }

  /**
   * Completes a running fine-tuning job successfully.
   * 
   * @param jobId - The ID of the fine-tuning job to complete.
   * @param resultModel - The ID of the resulting model.
   * @param metrics - The metrics from the fine-tuning process.
   */
  public completeJob(jobId: string, resultModel: string, metrics: FineTuneMetrics): void {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'running') {
      this.jobs.set(jobId, {
        ...job,
        status: 'succeeded',
        resultModel,
        metrics,
        completedAt: new Date()
      });
    }
  }

  /**
   * Marks a fine-tuning job as failed.
   * 
   * @param jobId - The ID of the fine-tuning job to fail.
   * @param error - The error message or reason for failure.
   */
  public failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'running')) {
      this.jobs.set(jobId, {
        ...job,
        status: 'failed',
        metadata: { ...job.metadata, error }
      });
    }
  }

  /**
   * Cancels a pending or running fine-tuning job.
   * 
   * @param jobId - The ID of the fine-tuning job to cancel.
   */
  public cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'running')) {
      this.jobs.set(jobId, {
        ...job,
        status: 'cancelled'
      });
    }
  }

  /**
   * Gets all fine-tuning jobs for a specific base model.
   * 
   * @param baseModel - The base model ID.
   * @returns A readonly array of jobs using the specified base model.
   */
  public getJobsByBaseModel(baseModel: string): readonly FineTuneJob[] {
    return Array.from(this.jobs.values()).filter(job => job.baseModel === baseModel);
  }
}
