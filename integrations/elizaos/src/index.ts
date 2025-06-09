export * from './adapter';
export * from './utils';

// Re-export commonly used types
export { ElizaPodComAdapter, ElizaPodComConfig } from './adapter';
export { 
  setupElizaOnPodCom,
  ElizaPodComPluginRegistry,
  ElizaPodComAgentBuilder,
  DefaultPodComActions,
  defaultPluginRegistry
} from './utils';
