import { randomUUID } from 'node:crypto';
import type { Checkpoint, WorkflowState } from './types.js';

/**
 * Interface for checkpoint storage operations.
 */
export interface CheckpointStore {
  /**
   * Saves a checkpoint to the store.
   * @param checkpoint The checkpoint to save.
   * @returns A promise that resolves when the save is complete.
   */
  save(checkpoint: Checkpoint): Promise<void>;

  /**
   * Loads a checkpoint by its ID.
   * @param checkpointId The ID of the checkpoint to load.
   * @returns A promise that resolves to the checkpoint, or undefined if not found.
   */
  load(checkpointId: string): Promise<Checkpoint | undefined>;

  /**
   * Loads the latest checkpoint for a given workflow ID.
   * @param workflowId The workflow ID.
   * @returns A promise that resolves to the latest checkpoint, or undefined if none exist.
   */
  loadLatest(workflowId: string): Promise<Checkpoint | undefined>;

  /**
   * Deletes a checkpoint by its ID.
   * @param checkpointId The ID of the checkpoint to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  delete(checkpointId: string): Promise<void>;

  /**
   * Lists all checkpoints for a given workflow ID.
   * @param workflowId The workflow ID.
   * @returns A promise that resolves to an array of checkpoints.
   */
  list(workflowId: string): Promise<readonly Checkpoint[]>;
}

/**
 * An in-memory implementation of the CheckpointStore.
 */
export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly checkpoints = new Map<string, Checkpoint>();

  /**
   * Saves a checkpoint to the in-memory store.
   * @param checkpoint The checkpoint to save.
   */
  public async save(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, checkpoint);
  }

  /**
   * Loads a checkpoint by its ID.
   * @param checkpointId The ID of the checkpoint.
   * @returns The checkpoint or undefined.
   */
  public async load(checkpointId: string): Promise<Checkpoint | undefined> {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * Loads the latest checkpoint by created date for a workflow.
   * @param workflowId The workflow ID.
   * @returns The latest checkpoint or undefined.
   */
  public async loadLatest(workflowId: string): Promise<Checkpoint | undefined> {
    let latest: Checkpoint | undefined;
    for (const cp of this.checkpoints.values()) {
      if (cp.workflowId === workflowId) {
        if (!latest || cp.createdAt.getTime() > latest.createdAt.getTime()) {
          latest = cp;
        }
      }
    }
    return latest;
  }

  /**
   * Deletes a checkpoint.
   * @param checkpointId The ID of the checkpoint to delete.
   */
  public async delete(checkpointId: string): Promise<void> {
    this.checkpoints.delete(checkpointId);
  }

  /**
   * Lists all checkpoints for a given workflow ID.
   * @param workflowId The workflow ID.
   * @returns An array of checkpoints.
   */
  public async list(workflowId: string): Promise<readonly Checkpoint[]> {
    const results: Checkpoint[] = [];
    for (const cp of this.checkpoints.values()) {
      if (cp.workflowId === workflowId) {
        results.push(cp);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

/**
 * Manager class that orchestrates checkpoint saving and restoring.
 */
export class CheckpointManager {
  /**
   * Creates a new CheckpointManager.
   * @param store The underlying checkpoint store.
   */
  constructor(private readonly store: CheckpointStore) {}

  /**
   * Creates a new checkpoint from a given workflow state.
   * @param state The current workflow state.
   * @returns A promise that resolves to the created Checkpoint.
   */
  public async createCheckpoint(state: WorkflowState): Promise<Checkpoint> {
    const id = randomUUID();
    const checkpoint: Checkpoint = {
      id,
      workflowId: state.workflowId,
      state: {
        ...state,
        checkpointId: id
      },
      createdAt: new Date(),
    };
    
    await this.store.save(checkpoint);
    return checkpoint;
  }

  /**
   * Restores the workflow state from a specific checkpoint ID.
   * @param checkpointId The checkpoint ID.
   * @returns A promise that resolves to the WorkflowState or undefined.
   */
  public async restoreFromCheckpoint(checkpointId: string): Promise<WorkflowState | undefined> {
    const cp = await this.store.load(checkpointId);
    return cp?.state;
  }

  /**
   * Restores the workflow state from the latest checkpoint for a workflow.
   * @param workflowId The workflow ID.
   * @returns A promise that resolves to the WorkflowState or undefined.
   */
  public async restoreLatest(workflowId: string): Promise<WorkflowState | undefined> {
    const cp = await this.store.loadLatest(workflowId);
    return cp?.state;
  }
}
