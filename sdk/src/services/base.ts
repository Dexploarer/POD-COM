import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import anchor from "@coral-xyz/anchor";
const { Program } = anchor;
type AnchorProgram = anchor.Program<any>;

/**
 * Configuration object for BaseService constructor
 */
export interface BaseServiceConfig {
  connection: Connection;
  programId: PublicKey;
  commitment: Commitment;
  program?: AnchorProgram;
  serverUrl?: string;
}

/**
 * Base service class with common functionality for all services
 */
export abstract class BaseService {
  protected connection: Connection;
  protected programId: PublicKey;
  protected commitment: Commitment;
  protected program?: AnchorProgram;
  protected idl?: any;
  protected serverUrl?: string;

  constructor(config: BaseServiceConfig) {
    this.connection = config.connection;
    this.programId = config.programId;
    this.commitment = config.commitment;
    this.program = config.program;
    this.serverUrl = config.serverUrl;
  }

  protected ensureInitialized(): AnchorProgram {
    if (!this.program) {
      throw new Error(
        "Client not initialized with wallet. Call client.initialize(wallet) first.",
      );
    }
    return this.program;
  }

  protected getAccount(accountName: string) {
    const program = this.ensureInitialized();
    const accounts = program.account as any;
    if (!accounts || !accounts[accountName]) {
      throw new Error(
        `Account type '${accountName}' not found in program. Verify IDL is correct.`,
      );
    }
    return accounts[accountName];
  }

  protected getProgramMethods() {
    const program = this.ensureInitialized();
    if (!program.methods) {
      throw new Error(
        "Program methods not available. Verify IDL is correct and program is initialized.",
      );
    }
    return program.methods as any;
  }

  setProgram(program: AnchorProgram) {
    this.program = program;
  }

  /**
   * Set the IDL for read-only operations
   */
  setIDL(idl: any): void {
    if (!idl) {
      throw new Error("Cannot set null or undefined IDL");
    }
    this.idl = idl;
  }

  /**
   * Check if IDL is set for read-only operations
   */
  hasIDL(): boolean {
    return this.idl !== undefined;
  }

  protected ensureIDL(): any {
    if (!this.idl) {
      throw new Error(
        "IDL not set. Call client.initialize() first or ensure IDL is properly imported.",
      );
    }
    return this.idl;
  }
}
