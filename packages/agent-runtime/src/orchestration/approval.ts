import { randomUUID } from 'node:crypto';
import type { ApprovalConfig, ApprovalRequest, ApprovalStatus, WorkflowContext } from './types.js';

/** Callback type for when an approval request is created. */
export type ApprovalCallback = (request: ApprovalRequest) => void;

/** Interface for approval resolution. */
export interface ApprovalResolver {
  /** Wait for approval resolution. */
  waitForApproval(request: ApprovalRequest): Promise<ApprovalStatus>;
}

/**
 * In-memory approval manager that holds pending requests
 * and manages the human-in-the-loop approval lifecycle.
 */
export class ApprovalManager {
  private readonly pendingRequests = new Map<string, ApprovalRequest>();
  private readonly resolvers = new Map<string, (status: ApprovalStatus) => void>();

  /**
   * Creates a new ApprovalManager.
   * @param onRequest Optional callback invoked when a new approval request is created.
   */
  constructor(private readonly onRequest?: ApprovalCallback) {}

  /**
   * Requests approval for a workflow node.
   * Creates the request, notifies via callback, and waits for resolution.
   * @param workflowId The ID of the workflow requesting approval.
   * @param nodeId The ID of the node requesting approval.
   * @param config The approval configuration.
   * @param context The current workflow context.
   * @returns A promise resolving to the final ApprovalRequest with resolved status.
   */
  async requestApproval(
    workflowId: string,
    nodeId: string,
    config: ApprovalConfig,
    context: WorkflowContext
  ): Promise<ApprovalRequest> {
    const requestId = randomUUID();
    const request: ApprovalRequest = {
      id: requestId,
      workflowId,
      nodeId,
      status: 'pending',
      config,
      context,
      createdAt: new Date(),
    };

    this.pendingRequests.set(requestId, request);

    if (this.onRequest) {
      try {
        this.onRequest(request);
      } catch {
        // Suppress callback errors to ensure workflow continuation
      }
    }

    return new Promise<ApprovalRequest>((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      const finish = (status: ApprovalStatus, resolvedBy?: string) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        const resolved: ApprovalRequest = {
          ...request,
          status,
          resolvedAt: new Date(),
          resolvedBy,
        };
        this.pendingRequests.delete(requestId);
        this.resolvers.delete(requestId);
        resolve(resolved);
      };

      this.resolvers.set(requestId, (status: ApprovalStatus) => {
        finish(status);
      });

      if (config.timeoutMs) {
        timeoutId = setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            const status: ApprovalStatus = config.autoApproveOnTimeout ? 'approved' : 'timed_out';
            finish(status, 'system_timeout');
          }
        }, config.timeoutMs);
      }
    });
  }

  /**
   * Approves a pending request.
   * @param requestId The ID of the request to approve.
   * @param resolvedBy Optional identifier of who approved the request.
   */
  approve(requestId: string, _resolvedBy?: string): void {
    const resolver = this.resolvers.get(requestId);
    if (resolver) {
      resolver('approved');
    }
  }

  /**
   * Rejects a pending request.
   * @param requestId The ID of the request to reject.
   * @param resolvedBy Optional identifier of who rejected the request.
   */
  reject(requestId: string, _resolvedBy?: string): void {
    const resolver = this.resolvers.get(requestId);
    if (resolver) {
      resolver('rejected');
    }
  }

  /**
   * Gets all pending approval requests.
   * @returns A read-only array of pending approval requests.
   */
  getPending(): readonly ApprovalRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Gets a specific request by ID.
   * @param requestId The ID of the request to retrieve.
   * @returns The approval request if found, otherwise undefined.
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(requestId);
  }
}
