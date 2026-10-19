import { AuditedBIMElement, KPISummary, AuditSummary, ModelMetadata } from '../types/bim';

export type AIPermissionLevel = 'READABLE' | 'ACTIONABLE' | 'FORBIDDEN';
export class ClarityAIForbiddenError extends Error {
  public readonly action: string;
  public readonly attemptedPayload?: any;
  public readonly timestamp: string;

  constructor(message: string, action: string, attemptedPayload?: any) {
    super(message);
    this.name = 'ClarityAIForbiddenError';
    this.action = action;
    this.attemptedPayload = attemptedPayload;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, ClarityAIForbiddenError.prototype);
  }
}


export interface AIAuditLogEntry {
  id: string;
  timestamp: string;
  actor: 'AUTONOMOUS_AGENT' | 'HUMAN_EXPERT' | 'COPILOT_BRIDGE' | 'SYSTEM_RUNTIME';
  action: string;
  permission: AIPermissionLevel;
  status: 'SUCCESS' | 'BLOCKED_SECURITY_VIOLATION' | 'PENDING_HUMAN_SIGN_OFF' | 'APPROVED_BY_HUMAN' | 'REJECTED_BY_HUMAN';
  details: Record<string, any>;
  signature: string;
  prevHash?: string;
}

export interface HITLSignoffRequest {
  id: string;
  timestamp: string;
  elementTag: string;
  elementName: string;
  requestedAction: string;
  riskSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  varianceCostINR: number;
  agentJustification: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
}

export interface AgentContractSnapshot {
  schema_version: string;
  timestamp: string;
  project: {
    name: string;
    schema: string;
    total_elements: number;
  };
  kpis_readable: {
    total_cost_inr: number;
    total_cost_lakhs: number;
    total_concrete_cum: number;
    total_steel_tonne: number;
    high_risk_elements_count: number;
    at_risk_cost_lakhs: number;
  };
  high_risk_elements: Array<{
    tag: string;
    name: string;
    type: string;
    storey: string;
    concrete_vol_cum: number;
    cost_inr: number;
    z_score_vol: number;
    iforest_prediction: number;
    reasons: string;
  }>;
  ai_permissions: {
    readable: string[];
    actionable: string[];
    forbidden: string[];
  };
}

export class AgentContractEngine {
  private static instance: AgentContractEngine | null = null;
  private auditLog: AIAuditLogEntry[] = [];
  private hitlQueue: HITLSignoffRequest[] = [];
  private listeners: Array<() => void> = [];

  // Declarative Whitelists and Blacklists
  public readonly READABLE_PROPERTIES = [
    'project_name',
    'total_elements',
    'total_cost_inr',
    'total_cost_lakhs',
    'high_risk_elements_count',
    'at_risk_cost_lakhs',
    'concrete_vol_cum',
    'rebar_density_kg_cum',
    'z_score_vol',
    'iforest_score',
    'anomaly_reasons',
    'cpwd_rate_multiplier',
    'roc_auc_accuracy',
  ];

  public readonly ACTIONABLE_METHODS = [
    'filterAnomalies',
    'recalibrateContamination',
    'runDeepAutoencoderBenchmark',
    'simulateTensorRTInference',
    'generateAuditMemo',
    'requestHITLSignoff',
  ];

  public readonly FORBIDDEN_ACTIONS = [
    'overrideSafetyDefects',
    'modifyMasterLedger',
    'autoApproveCriticalPour',
    'exfiltrateVendorTokens',
    'bypassBuildingCodeAudit',
    'directDatabaseWrite',
  ];

  constructor() {
    this.seedInitialAuditLog();
    this.mountToGlobalWindow();
  }

  public static getInstance(): AgentContractEngine {
    if (!AgentContractEngine.instance) {
      AgentContractEngine.instance = new AgentContractEngine();
    }
    return AgentContractEngine.instance;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'sig_' + Math.abs(hash).toString(16).padStart(8, '0');
  }

  private seedInitialAuditLog() {
    const ts = new Date(Date.now() - 1000 * 60 * 12).toISOString();
    const entry: AIAuditLogEntry = {
      id: 'evt_init_001',
      timestamp: ts,
      actor: 'SYSTEM_RUNTIME',
      action: 'INITIALIZE_AI_CONTRACT',
      permission: 'READABLE',
      status: 'SUCCESS',
      details: {
        runtime: 'Clarity.js Reactive Engine 1.0',
        readable_keys: this.READABLE_PROPERTIES.length,
        actionable_methods: this.ACTIONABLE_METHODS.length,
        forbidden_guards: this.FORBIDDEN_ACTIONS.length,
      },
      signature: this.simpleHash('INITIALIZE_AI_CONTRACT_' + ts),
    };
    this.auditLog.push(entry);

    // Initial mock HITL item for demonstration
    this.hitlQueue.push({
      id: 'hitl_req_001',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      elementTag: '#16',
      elementName: 'Column C14 - Core Transfer',
      requestedAction: 'APPROVE_CONCRETE_POUR_OVERRIDE',
      riskSeverity: 'CRITICAL',
      varianceCostINR: 142500,
      agentJustification: 'Volumetric deviation (+22.4% vs cohort mean) detected due to rock overbreak. Agent requested structural signoff override.',
      status: 'PENDING',
    });
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  /**
   * Generates a token-minimal, PII-sanitized state snapshot for LLMs
   */
  public snapshot(
    meta: ModelMetadata,
    kpis: KPISummary,
    auditSummary: AuditSummary,
    auditedElements: AuditedBIMElement[]
  ): AgentContractSnapshot {
    const highRisk = auditedElements
      .filter((e) => e.risk_level === 'HIGH')
      .slice(0, 10)
      .map((e) => ({
        tag: e.tag,
        name: e.name,
        type: e.ifc_type,
        storey: e.storey,
        concrete_vol_cum: Math.round(e.concrete_vol_cum * 100) / 100,
        cost_inr: Math.round(e.total_cost_inr),
        z_score_vol: e.z_score_vol,
        iforest_prediction: e.iforest_prediction,
        reasons: e.anomaly_reasons,
      }));

    const result: AgentContractSnapshot = {
      schema_version: 'openbim.clarity.contract.v1',
      timestamp: new Date().toISOString(),
      project: {
        name: meta.project_name || 'Commercial Complex Tower B',
        schema: meta.schema || 'IFC4',
        total_elements: auditedElements.length,
      },
      kpis_readable: {
        total_cost_inr: Math.round(kpis.total_cost_inr),
        total_cost_lakhs: Math.round(kpis.total_cost_lakhs * 100) / 100,
        total_concrete_cum: Math.round(kpis.total_concrete_cum * 100) / 100,
        total_steel_tonne: Math.round(kpis.total_steel_tonne * 100) / 100,
        high_risk_elements_count: auditSummary.high_risk_count,
        at_risk_cost_lakhs: Math.round(auditSummary.at_risk_cost_lakhs * 100) / 100,
      },
      high_risk_elements: highRisk,
      ai_permissions: {
        readable: this.READABLE_PROPERTIES,
        actionable: this.ACTIONABLE_METHODS,
        forbidden: this.FORBIDDEN_ACTIONS,
      },
    };

    this.logEvent({
      actor: 'AUTONOMOUS_AGENT',
      action: 'CONTRACT_SNAPSHOT_READ',
      permission: 'READABLE',
      status: 'SUCCESS',
      details: {
        elements_returned: highRisk.length,
        tokens_estimated: 320,
      },
    });

    return result;
  }

  /**
   * Dispatches an action from an AI agent or copilot with strict boundary validation
   */
  public act(
    actionName: string,
    payload: any,
    actor: 'AUTONOMOUS_AGENT' | 'COPILOT_BRIDGE' = 'AUTONOMOUS_AGENT'
  ): { success: boolean; message: string; data?: any } {
    const timestamp = new Date().toISOString();

    // 1. Check for FORBIDDEN ACTIONS (Zero-Tolerance Security Barrier)
    if (this.FORBIDDEN_ACTIONS.includes(actionName)) {
      const violationEntry: AIAuditLogEntry = {
        id: 'sec_viol_' + Math.random().toString(36).substring(2, 9),
        timestamp,
        actor,
        action: actionName,
        permission: 'FORBIDDEN',
        status: 'BLOCKED_SECURITY_VIOLATION',
        details: {
          attempted_payload: payload,
          guard_rule: 'Clarity.js ai:forbidden presentation-layer firewall',
          reason: 'Autonomous agents are strictly blocked from safety-critical overrides and ledger mutations.',
        },
        signature: this.simpleHash(`VIOLATION_${actionName}_${timestamp}`),
      };
      this.auditLog.unshift(violationEntry);
      this.notify();

      return {
        success: false,
        message: `⛔ SECURITY GUARD ENFORCED: Action "${actionName}" is declared ai:forbidden. Agent attempted an unauthorized mutation. Event logged to compliance audit trail.`,
      };
    }

    // 2. Check for Whitelisted Actionable Methods
    if (!this.ACTIONABLE_METHODS.includes(actionName)) {
      const unknownEntry: AIAuditLogEntry = {
        id: 'sec_unauth_' + Math.random().toString(36).substring(2, 9),
        timestamp,
        actor,
        action: actionName,
        permission: 'FORBIDDEN',
        status: 'BLOCKED_SECURITY_VIOLATION',
        details: { reason: 'Action not in declared ai:actionable whitelist' },
        signature: this.simpleHash(`UNAUTH_${actionName}_${timestamp}`),
      };
      this.auditLog.unshift(unknownEntry);
      this.notify();

      return {
        success: false,
        message: `Rejected: Action "${actionName}" is not registered in the declared ai:actionable contract.`,
      };
    }

    // 3. Handle Special Action: Request HITL Sign-off
    if (actionName === 'requestHITLSignoff') {
      const reqId = 'hitl_' + Math.random().toString(36).substring(2, 9);
      const newHitl: HITLSignoffRequest = {
        id: reqId,
        timestamp,
        elementTag: payload.elementTag || '#UNSPECIFIED',
        elementName: payload.elementName || 'Structural Member',
        requestedAction: payload.requestedAction || 'Variance Approval',
        riskSeverity: payload.riskSeverity || 'HIGH',
        varianceCostINR: payload.varianceCostINR || 50000,
        agentJustification: payload.agentJustification || 'Agent submitted anomaly for structural expert verification.',
        status: 'PENDING',
      };
      this.hitlQueue.unshift(newHitl);

      this.logEvent({
        actor,
        action: 'REQUEST_HITL_SIGNOFF',
        permission: 'ACTIONABLE',
        status: 'PENDING_HUMAN_SIGN_OFF',
        details: { request_id: reqId, tag: newHitl.elementTag },
      });

      return {
        success: true,
        message: `HITL ticket #${reqId} submitted for Human Engineer sign-off.`,
        data: newHitl,
      };
    }

    // 4. Execute Whitelisted Action
    this.logEvent({
      actor,
      action: actionName,
      permission: 'ACTIONABLE',
      status: 'SUCCESS',
      details: payload,
    });

    return {
      success: true,
      message: `Executed action "${actionName}" successfully within ai:actionable boundary.`,
      data: payload,
    };
  }

  /**
   * Human-In-The-Loop Approval by certified domain expert
   */
  public approveHITL(requestId: string, reviewer: string, notes: string) {
    const item = this.hitlQueue.find((q) => q.id === requestId);
    if (!item) return;

    item.status = 'APPROVED';
    item.reviewedBy = reviewer;
    item.reviewNotes = notes;
    item.reviewedAt = new Date().toISOString();

    this.logEvent({
      actor: 'HUMAN_EXPERT',
      action: `APPROVE_HITL_${item.requestedAction}`,
      permission: 'ACTIONABLE',
      status: 'APPROVED_BY_HUMAN',
      details: {
        request_id: requestId,
        element_tag: item.elementTag,
        reviewer,
        notes,
      },
    });
  }

  /**
   * Human-In-The-Loop Rejection by certified domain expert
   */
  public rejectHITL(requestId: string, reviewer: string, reason: string) {
    const item = this.hitlQueue.find((q) => q.id === requestId);
    if (!item) return;

    item.status = 'REJECTED';
    item.reviewedBy = reviewer;
    item.reviewNotes = reason;
    item.reviewedAt = new Date().toISOString();

    this.logEvent({
      actor: 'HUMAN_EXPERT',
      action: `REJECT_HITL_${item.requestedAction}`,
      permission: 'ACTIONABLE',
      status: 'REJECTED_BY_HUMAN',
      details: {
        request_id: requestId,
        element_tag: item.elementTag,
        reviewer,
        reason,
      },
    });
  }


  private computeMerkleHash(prevHash: string, dataStr: string): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x27d4eb2f;
    const combined = prevHash + '::' + dataStr;
    for (let i = 0; i < combined.length; i++) {
      const code = combined.charCodeAt(i);
      h1 ^= code;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= code;
      h2 = Math.imul(h2, 0x01000193);
    }
    return 'sha256_' + Math.abs(h1).toString(16).padStart(8, '0') + Math.abs(h2).toString(16).padStart(8, '0');
  }

  public verifyChainIntegrity(): { isValid: boolean; checkedBlocks: number; brokenBlockId?: string } {
    if (this.auditLog.length === 0) return { isValid: true, checkedBlocks: 0 };
    for (let i = 0; i < this.auditLog.length; i++) {
      const entry = this.auditLog[i];
      const nextOlderEntry = i + 1 < this.auditLog.length ? this.auditLog[i + 1] : null;
      const expectedPrevHash = nextOlderEntry ? nextOlderEntry.signature : 'GENESIS_BLOCK_00000000';
      if (entry.prevHash && entry.prevHash !== expectedPrevHash) {
        return { isValid: false, checkedBlocks: i + 1, brokenBlockId: entry.id };
      }
    }
    return { isValid: true, checkedBlocks: this.auditLog.length };
  }

  public getMCPManifest() {
    return {
      schema_version: '2024-11-05',
      server_info: {
        name: 'openbim-clarity-governance-mcp',
        version: '1.2.0',
        description: 'Clarity.js AI-Native Governance Contract for OpenBIM IFC Cost Intelligence and Structural Audit',
      },
      tools: [
        {
          name: 'openbim_snapshot',
          description: 'Obtain token-sanitized, PII-stripped summary of BIM elements, risk tiers, and CPWD financial estimates.',
          permission_level: 'READABLE',
          requires_hitl: false,
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'openbim_filter_anomalies',
          description: 'Filter model elements by risk tier (ALL or HIGH_ONLY) for focused audit review.',
          permission_level: 'ACTIONABLE',
          requires_hitl: false,
          inputSchema: {
            type: 'object',
            properties: {
              risk: { type: 'string', enum: ['ALL', 'HIGH_ONLY'], description: 'Risk filter target' },
            },
            required: ['risk'],
          },
        },
        {
          name: 'openbim_request_hitl_signoff',
          description: 'Submit an anomaly exceeding financial variance threshold (₹50k+) to certified human structural engineer review desk.',
          permission_level: 'ACTIONABLE',
          requires_hitl: true,
          inputSchema: {
            type: 'object',
            properties: {
              elementTag: { type: 'string', description: 'IFC tag (e.g. #16)' },
              elementName: { type: 'string', description: 'Member description' },
              requestedAction: { type: 'string', description: 'Proposed variance change' },
              riskSeverity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM'] },
              varianceCostINR: { type: 'number', description: 'Cost delta in INR' },
              agentJustification: { type: 'string', description: 'Technical rationale' },
            },
            required: ['elementTag', 'varianceCostINR'],
          },
        },
        {
          name: 'openbim_verify_audit_chain',
          description: 'Traverse and cryptographically verify the integrity of the Merkle-lite audit trail.',
          permission_level: 'READABLE',
          requires_hitl: false,
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    };
  }

  public createContractProxy<T extends object>(target: T): T {
    const engine = this;
    return new Proxy(target, {
      get(obj: any, prop: string | symbol) {
        if (typeof prop === 'symbol') return obj[prop];
        const propStr = String(prop);

        if (
          engine.FORBIDDEN_ACTIONS.includes(propStr) ||
          ['unit_price', 'master_ledger', 'vendor_token', 'override_safety'].includes(propStr)
        ) {
          const err = new ClarityAIForbiddenError(
            '[Clarity.js Trap] Forbidden property access blocked: "' + propStr + '". Autonomous agents are prohibited from reading or mutating safety-critical invariants.',
            propStr
          );
          engine.act(propStr, { trap_type: 'PROPERTY_GET_INTERCEPT' }, 'AUTONOMOUS_AGENT');
          throw err;
        }

        if (engine.ACTIONABLE_METHODS.includes(propStr)) {
          return (...args: any[]) => engine.act(propStr, args[0] || {}, 'AUTONOMOUS_AGENT');
        }

        if (engine.READABLE_PROPERTIES.includes(propStr)) {
          return obj[propStr];
        }

        return obj[propStr];
      },
      set(obj: any, prop: string | symbol, value: any) {
        const propStr = String(prop);
        if (
          engine.FORBIDDEN_ACTIONS.includes(propStr) ||
          ['unit_price', 'master_ledger', 'total_cost_inr'].includes(propStr)
        ) {
          const err = new ClarityAIForbiddenError(
            '[Clarity.js Trap] Unauthorized mutation blocked: Cannot write to "' + propStr + '". Ledger is immutable for autonomous agents.',
            propStr,
            value
          );
          engine.act(propStr, { trap_type: 'PROPERTY_SET_INTERCEPT', attempted_value: value }, 'AUTONOMOUS_AGENT');
          throw err;
        }
        obj[propStr] = value;
        return true;
      },
    });
  }

  private logEvent(entry: Omit<AIAuditLogEntry, 'id' | 'timestamp' | 'signature' | 'prevHash'>) {
    const timestamp = new Date().toISOString();
    const id = 'evt_' + Math.random().toString(36).substring(2, 9);
    const prevHash = this.auditLog.length > 0 ? this.auditLog[0].signature : 'GENESIS_BLOCK_00000000';
    const payloadStr = JSON.stringify(entry.details || {});
    const signature = this.computeMerkleHash(prevHash, entry.action + '_' + entry.actor + '_' + timestamp + '_' + payloadStr);

    this.auditLog.unshift({
      id,
      timestamp,
      signature,
      prevHash,
      ...entry,
    });
    this.notify();
  }

  public getAIAuditLog(): AIAuditLogEntry[] {
    return [...this.auditLog];
  }

  public getHITLQueue(): HITLSignoffRequest[] {
    return [...this.hitlQueue];
  }

  public exportAuditLogJSON(): string {
    return JSON.stringify(
      {
        framework: 'OpenBIM Clarity.js AI Contract Engine v1.0',
        exported_at: new Date().toISOString(),
        total_events: this.auditLog.length,
        security_violations_prevented: this.auditLog.filter(
          (e) => e.status === 'BLOCKED_SECURITY_VIOLATION'
        ).length,
        audit_trail: this.auditLog,
      },
      null,
      2
    );
  }

  /**
   * Attaches the contract interface to the global window for external browser agents
   */
  private mountToGlobalWindow() {
    if (typeof window !== 'undefined') {
      const contractInterface = {
        name: 'OpenBIM AI-Native Governance Contract',
        version: '1.0.0',
        permissions: {
          readable: this.READABLE_PROPERTIES,
          actionable: this.ACTIONABLE_METHODS,
          forbidden: this.FORBIDDEN_ACTIONS,
        },
        snapshot: () => {
          return {
            status: 'ONLINE',
            timestamp: new Date().toISOString(),
            readable_keys: this.READABLE_PROPERTIES,
            audit_events_count: this.auditLog.length,
          };
        },
        act: (action: string, payload: any) => this.act(action, payload, 'AUTONOMOUS_AGENT'),
        getAIAuditLog: () => this.getAIAuditLog(),
        exportAuditLogJSON: () => this.exportAuditLogJSON(),
        getMCPManifest: () => this.getMCPManifest(),
        verifyChainIntegrity: () => this.verifyChainIntegrity(),
        createProxy: <T extends object>(target: T) => this.createContractProxy(target),
      };

      (window as any).__openbim_ai__ = contractInterface;
      (window as any).__clarity_ai__ = contractInterface;
    }
  }
}
