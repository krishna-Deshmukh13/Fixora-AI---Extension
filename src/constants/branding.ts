/**
 * Central branding and product identity configuration for Revion.
 * All user-facing strings, labels, and product metadata reference these constants.
 *
 * CRITICAL IDENTITY CONSTRAINT:
 * Internal package name ("fixora-ai"), publisher ("FixoraFoundation"), and
 * configuration/command keys ("fixora.*") remain unchanged for 100% backwards
 * compatibility with existing installations and marketplace IDs.
 */

export const BRANDING = {
  /** User-facing brand and product identity */
  PRODUCT_NAME: 'Revion',
  DISPLAY_NAME: 'Revion — Intelligent Code Review & Debugging',
  TAGLINE: 'Intelligent Code Review & Debugging Assistant',
  SHORT_DESCRIPTION:
    'AI-powered Code Reviewer, Bug Detector and Debugging Assistant. Inline Error Lens, Complexity Metrics, Multi-Language Linter, Prettier Formatter, and Security Scans.',

  /** Publisher and packaging metadata (preserved for compatibility) */
  PACKAGE_NAME: 'fixora-ai',
  PUBLISHER_ID: 'FixoraFoundation',
  EXTENSION_ID: 'FixoraFoundation.fixora-ai',

  /** Command palette category and namespace */
  COMMAND_CATEGORY: 'Revion',
  COMMAND_PREFIX: 'fixora',
  CONFIG_SECTION: 'fixora',
  SECRET_KEY_GEMINI: 'fixora.geminiApiKey',
  VIEW_ID_SIDEBAR: 'fixora.sidebar',
  VIEW_CONTAINER_ID: 'fixora-sidebar-view',

  /** Status bar and lens labels */
  LENS_STATUS_NAME: 'Revion Lens',
  LENS_PREFIX: 'Revion',
  LINTER_COLLECTION_NAME: 'revion-linter',
  DIAGNOSTIC_COLLECTION_NAME: 'Revion',

  /** Valid AI Models */
  DEFAULT_GEMINI_MODEL: 'gemini-2.0-flash',
  SUPPORTED_GEMINI_MODELS: [
    {
      id: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      description: 'Recommended: Google next-gen ultra-fast multimodal model',
    },
    {
      id: 'gemini-1.5-flash',
      label: 'Gemini 1.5 Flash',
      description: 'Lightweight, stable, and fast code analysis',
    },
    {
      id: 'gemini-1.5-pro',
      label: 'Gemini 1.5 Pro',
      description: 'Deep context reasoning for large codebases and complex bugs',
    },
  ],

  DEFAULT_OLLAMA_MODEL: 'codellama',
  SUPPORTED_OLLAMA_MODELS: [
    {
      id: 'codellama',
      label: 'CodeLlama',
      description: 'Meta CodeLlama optimized for syntax and code generation',
    },
    {
      id: 'deepseek-coder',
      label: 'DeepSeek Coder',
      description: 'Advanced code reasoning and bug detection',
    },
    {
      id: 'qwen2.5-coder',
      label: 'Qwen 2.5 Coder',
      description: 'High performance local coding model',
    },
    {
      id: 'llama3',
      label: 'Llama 3',
      description: 'General purpose fast local reasoning',
    },
  ],

  /** URLs and Help links */
  MARKETPLACE_URL: 'https://marketplace.visualstudio.com/items?itemName=FixoraFoundation.fixora-ai',
  REPOSITORY_URL: 'https://github.com/krishna-Deshmukh13/Fixora-AI---Extension',
  ISSUES_URL: 'https://github.com/krishna-Deshmukh13/Fixora-AI---Extension/issues',
  AI_STUDIO_URL: 'https://aistudio.google.com/app/apikey',
  TERMS_URL: 'https://ai.google.dev/gemini-api/terms',
} as const;
