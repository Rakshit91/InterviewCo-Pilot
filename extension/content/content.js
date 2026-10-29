/**
 * Content Script - InterviewCo-Pilot
 * Injected into Google Meet tabs (https://meet.google.com/*)
 * Communicates with Background Service Worker & Offscreen Document for Tab Audio Capture,
 * Real-Time Gemini Live Streaming, and AI Question Suggestions.
 */

(() => {
  const existingRoot = document.getElementById('interview-copilot-root');
  if (existingRoot) {
    existingRoot.remove();
  }

  // Ensure Light Theme stylesheet is directly injected into document head
  let themeStyle = document.getElementById('interview-copilot-light-styles');
  if (!themeStyle) {
    themeStyle = document.createElement('style');
    themeStyle.id = 'interview-copilot-light-styles';
    (document.head || document.documentElement).appendChild(themeStyle);
  }
  themeStyle.textContent = `
    #interview-copilot-root {
      position: fixed !important;
      top: 14px !important;
      right: 14px !important;
      bottom: 14px !important;
      width: 430px !important;
      max-width: calc(100vw - 28px) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, Helvetica, Arial, sans-serif !important;
      color: #0f172a !important;
      pointer-events: none !important;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease !important;
      user-select: text !important;
      -webkit-font-smoothing: antialiased !important;
    }
    @media print { #interview-copilot-root { display: none !important; } }
    #interview-copilot-root.hidden { display: none !important; }
    #interview-copilot-root.collapsed .ic-sidebar-container { transform: translateX(calc(100% + 30px)) !important; opacity: 0 !important; pointer-events: none !important; }
    #interview-copilot-root.collapsed .ic-fab-toggle { display: inline-flex !important; }
    #interview-copilot-root.stealth .ic-sidebar-container { opacity: 0.05 !important; transform: scale(0.97) !important; pointer-events: none !important; filter: blur(14px) !important; }
    #interview-copilot-root.stealth:hover .ic-sidebar-container { opacity: 1 !important; transform: scale(1) !important; pointer-events: auto !important; filter: none !important; }

    .ic-fab-toggle { display: none; position: absolute !important; top: 12px !important; right: 0 !important; pointer-events: auto !important; align-items: center !important; gap: 8px !important; padding: 10px 18px !important; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%) !important; color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.4) !important; border-radius: 9999px !important; font-size: 12.5px !important; font-weight: 700 !important; cursor: pointer !important; box-shadow: 0 8px 25px rgba(79, 70, 229, 0.35) !important; }
    .ic-fab-toggle:hover { transform: scale(1.05) translateY(-2px) !important; box-shadow: 0 12px 30px rgba(79, 70, 229, 0.5) !important; }

    #interview-copilot-root .ic-sidebar-container { position: absolute !important; top: 0 !important; right: 0 !important; bottom: 0 !important; width: 100% !important; pointer-events: auto !important; background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 18px !important; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.14), 0 1px 3px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04) !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, filter 0.25s ease !important; }
    #interview-copilot-root .ic-header { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 12px 16px !important; background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; }
    #interview-copilot-root .ic-brand { display: flex !important; align-items: center !important; gap: 9px !important; }
    #interview-copilot-root .ic-brand-icon { width: 30px !important; height: 30px !important; border-radius: 8px !important; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important; display: flex !important; align-items: center !important; justify-content: center !important; color: white !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3) !important; flex-shrink: 0 !important; }
    #interview-copilot-root .ic-brand-title { font-size: 13.5px !important; font-weight: 700 !important; color: #0f172a !important; letter-spacing: -0.02em !important; }
    #interview-copilot-root .ic-privacy-pill { display: inline-flex !important; align-items: center !important; gap: 4px !important; font-size: 9.5px !important; font-weight: 700 !important; padding: 2px 7px !important; border-radius: 9999px !important; background: #ecfdf5 !important; color: #047857 !important; border: 1px solid #a7f3d0 !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; }
    #interview-copilot-root .ic-header-actions { display: flex !important; align-items: center !important; gap: 5px !important; }
    #interview-copilot-root .ic-icon-btn { background: #ffffff !important; border: 1px solid #cbd5e1 !important; color: #475569 !important; padding: 5px 8px !important; border-radius: 6px !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 4px !important; font-size: 11px !important; font-weight: 600 !important; transition: all 0.15s ease !important; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important; }
    #interview-copilot-root .ic-icon-btn:hover { background: #f1f5f9 !important; color: #0f172a !important; border-color: #94a3b8 !important; transform: translateY(-1px) !important; }
    #interview-copilot-root .ic-stealth-active { background: #fef2f2 !important; color: #dc2626 !important; border-color: #fca5a5 !important; }
    #interview-copilot-root .ic-content { flex: 1 !important; overflow-y: auto !important; padding: 12px 14px !important; display: flex !important; flex-direction: column !important; gap: 11px !important; background: #f8fafc !important; }
    #interview-copilot-root .ic-content::-webkit-scrollbar { width: 5px !important; }
    #interview-copilot-root .ic-content::-webkit-scrollbar-thumb { background: #cbd5e1 !important; border-radius: 9999px !important; }
    
    #interview-copilot-root .ic-hero-suggestion-card { background: #ffffff !important; border: 1.5px solid #c7d2fe !important; border-radius: 14px !important; padding: 13px 15px !important; display: flex !important; flex-direction: column !important; gap: 10px !important; box-shadow: 0 4px 16px rgba(79, 70, 229, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04) !important; position: relative !important; overflow: hidden !important; }
    #interview-copilot-root .ic-hero-suggestion-card::before { content: "" !important; position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; height: 3px !important; background: linear-gradient(90deg, #4f46e5, #7c3aed, #06b6d4) !important; }
    #interview-copilot-root .ic-hero-suggestion-card.streaming { border-color: #7c3aed !important; box-shadow: 0 0 20px rgba(124, 58, 237, 0.2) !important; }
    #interview-copilot-root .ic-hero-header { display: flex !important; align-items: center !important; justify-content: space-between !important; }
    #interview-copilot-root .ic-hero-title { display: flex !important; align-items: center !important; gap: 6px !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; color: #4338ca !important; }
    #interview-copilot-root .ic-btn-suggest-now { display: inline-flex !important; align-items: center !important; gap: 4px !important; font-size: 10.5px !important; font-weight: 700 !important; padding: 4px 10px !important; border-radius: 6px !important; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important; color: white !important; border: none !important; cursor: pointer !important; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3) !important; transition: all 0.2s ease !important; }
    #interview-copilot-root .ic-btn-suggest-now:hover { transform: translateY(-1px) !important; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45) !important; }
    #interview-copilot-root .ic-btn-suggest-now:active { transform: translateY(1px) !important; }
    #interview-copilot-root .ic-hero-body { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 12px 14px !important; min-height: 62px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; }
    #interview-copilot-root .ic-question-text { font-size: 14px !important; font-weight: 700 !important; color: #0f172a !important; line-height: 1.45 !important; letter-spacing: -0.01em !important; }
    #interview-copilot-root .ic-live-cursor { display: inline-block !important; width: 7px !important; height: 13px !important; background: #4f46e5 !important; border-radius: 2px !important; animation: blink 0.8s infinite !important; margin-right: 4px !important; }
    #interview-copilot-root .ic-hero-footer { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; }
    #interview-copilot-root .ic-btn-action-pill { display: inline-flex !important; align-items: center !important; gap: 5px !important; font-size: 10.5px !important; font-weight: 600 !important; padding: 5px 10px !important; border-radius: 6px !important; background: #ffffff !important; color: #334155 !important; border: 1px solid #cbd5e1 !important; cursor: pointer !important; transition: all 0.15s ease !important; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important; }
    #interview-copilot-root .ic-btn-action-pill:hover { background: #f1f5f9 !important; color: #0f172a !important; border-color: #94a3b8 !important; transform: translateY(-1px) !important; }

    #interview-copilot-root .ic-transcript-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 12px !important; display: flex !important; flex-direction: column !important; gap: 9px !important; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important; transition: border-color 0.25s ease, box-shadow 0.25s ease !important; }
    #interview-copilot-root .ic-transcript-card.listening { border-color: #10b981 !important; box-shadow: 0 4px 18px rgba(16, 185, 129, 0.15) !important; }
    #interview-copilot-root .ic-transcript-card.suggesting { border-color: #f59e0b !important; box-shadow: 0 4px 18px rgba(245, 158, 11, 0.15) !important; }
    #interview-copilot-root .ic-transcript-header { display: flex !important; align-items: center !important; justify-content: space-between !important; }
    #interview-copilot-root .ic-state-badge { display: inline-flex !important; align-items: center !important; gap: 6px !important; font-size: 10.5px !important; font-weight: 700 !important; padding: 3px 9px !important; border-radius: 9999px !important; }
    #interview-copilot-root .ic-state-dot { width: 6px !important; height: 6px !important; border-radius: 50% !important; }
    #interview-copilot-root .ic-state-badge.state-standby { background: #f1f5f9 !important; color: #475569 !important; border: 1px solid #e2e8f0 !important; }
    #interview-copilot-root .ic-state-badge.state-standby .ic-state-dot { background: #94a3b8 !important; }
    #interview-copilot-root .ic-state-badge.state-listening { background: #ecfdf5 !important; color: #047857 !important; border: 1px solid #a7f3d0 !important; }
    #interview-copilot-root .ic-state-badge.state-listening .ic-state-dot { background: #10b981 !important; box-shadow: 0 0 8px #10b981 !important; animation: pulseDot 1s infinite alternate !important; }
    #interview-copilot-root .ic-state-badge.state-suggesting { background: #fffbeb !important; color: #b45309 !important; border: 1px solid #fde68a !important; }
    #interview-copilot-root .ic-state-badge.state-suggesting .ic-state-dot { background: #f59e0b !important; box-shadow: 0 0 8px #f59e0b !important; animation: pulseDot 0.8s infinite alternate !important; }
    #interview-copilot-root .ic-lang-badge { font-size: 10px !important; font-weight: 600 !important; padding: 2px 7px !important; border-radius: 6px !important; background: #eef2ff !important; color: #4338ca !important; border: 1px solid #c7d2fe !important; }
    #interview-copilot-root .ic-vocab-badge { font-size: 10px !important; font-weight: 600 !important; padding: 2px 7px !important; border-radius: 6px !important; background: #ecfdf5 !important; color: #047857 !important; border: 1px solid #a7f3d0 !important; }
    #interview-copilot-root .ic-transcript-feed { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; padding: 9px !important; height: 100px !important; max-height: 115px !important; overflow-y: auto !important; display: flex !important; flex-direction: column !important; gap: 7px !important; }
    #interview-copilot-root .ic-transcript-feed::-webkit-scrollbar { width: 4px !important; }
    #interview-copilot-root .ic-transcript-feed::-webkit-scrollbar-thumb { background: #cbd5e1 !important; border-radius: 9999px !important; }
    #interview-copilot-root .ic-transcript-bubble { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-left: 3px solid #4f46e5 !important; padding: 6px 8px !important; border-radius: 0 6px 6px 0 !important; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important; }
    #interview-copilot-root .ic-trigger-badge { font-size: 8.5px !important; font-weight: 700 !important; padding: 1px 5px !important; border-radius: 4px !important; text-transform: uppercase !important; }
    #interview-copilot-root .ic-trigger-badge.gemini { background: #eef2ff !important; color: #4338ca !important; border: 1px solid #c7d2fe !important; }
    #interview-copilot-root .ic-trigger-badge.timer { background: #fffbeb !important; color: #b45309 !important; border: 1px solid #fde68a !important; }

    #interview-copilot-root .ic-btn-start { flex: 1 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; padding: 8px 12px !important; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important; color: white !important; border: none !important; border-radius: 8px !important; font-size: 11.5px !important; font-weight: 700 !important; cursor: pointer !important; box-shadow: 0 3px 10px rgba(79, 70, 229, 0.3) !important; transition: all 0.15s ease !important; }
    #interview-copilot-root .ic-btn-start:hover { transform: translateY(-1px) !important; box-shadow: 0 5px 16px rgba(79, 70, 229, 0.45) !important; }
    #interview-copilot-root .ic-btn-stop { flex: 1 !important; display: none; align-items: center !important; justify-content: center !important; gap: 6px !important; padding: 8px 12px !important; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%) !important; color: white !important; border: none !important; border-radius: 8px !important; font-size: 11.5px !important; font-weight: 700 !important; cursor: pointer !important; }
    #interview-copilot-root .ic-btn-end-interview { display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 5px !important; padding: 8px 14px !important; background: #fef2f2 !important; color: #dc2626 !important; border: 1px solid #fecaca !important; border-radius: 8px !important; font-size: 11.5px !important; font-weight: 700 !important; cursor: pointer !important; transition: all 0.15s ease !important; }
    #interview-copilot-root .ic-btn-end-interview:hover { background: #fee2e2 !important; color: #b91c1c !important; border-color: #fca5a5 !important; transform: translateY(-1px) !important; }
    #interview-copilot-root .ic-transcript-card.listening .ic-btn-start,
    #interview-copilot-root .ic-transcript-card.suggesting .ic-btn-start { display: none !important; }
    #interview-copilot-root .ic-transcript-card.listening .ic-btn-stop,
    #interview-copilot-root .ic-transcript-card.suggesting .ic-btn-stop { display: inline-flex !important; }

    #interview-copilot-root .ic-accordion-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; overflow: hidden !important; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important; }
    #interview-copilot-root .ic-accordion-header { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 10px 14px !important; background: #ffffff !important; cursor: pointer !important; user-select: none !important; }
    #interview-copilot-root .ic-accordion-header:hover { background: #f8fafc !important; }
    #interview-copilot-root .ic-accordion-title { display: flex !important; align-items: center !important; gap: 7px !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; color: #1e293b !important; }
    #interview-copilot-root .ic-card-badge { font-size: 10px !important; font-weight: 600 !important; background: #f1f5f9 !important; color: #475569 !important; padding: 2px 7px !important; border-radius: 9999px !important; border: 1px solid #e2e8f0 !important; }
    #interview-copilot-root .ic-accordion-chevron { color: #64748b !important; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important; }
    #interview-copilot-root .ic-accordion-card.open .ic-accordion-chevron { transform: rotate(180deg) !important; }
    #interview-copilot-root .ic-accordion-body { display: none; padding: 10px 12px !important; border-top: 1px solid #f1f5f9 !important; background: #ffffff !important; max-height: 200px !important; overflow-y: auto !important; }
    #interview-copilot-root .ic-accordion-card.open .ic-accordion-body { display: block !important; animation: fadeIn 0.2s ease !important; }
    #interview-copilot-root .ic-accordion-body::-webkit-scrollbar { width: 4px !important; }
    #interview-copilot-root .ic-accordion-body::-webkit-scrollbar-thumb { background: #cbd5e1 !important; border-radius: 9999px !important; }
    #interview-copilot-root .ic-qb-item { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; padding: 8px 10px !important; background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; margin-bottom: 6px !important; }
    #interview-copilot-root .ic-qb-item:hover { background: #f1f5f9 !important; border-color: #c7d2fe !important; }
    #interview-copilot-root .ic-btn-ask-item { background: #eef2ff !important; border: 1px solid #c7d2fe !important; color: #4338ca !important; font-size: 10.5px !important; font-weight: 700 !important; padding: 5px 9px !important; border-radius: 6px !important; cursor: pointer !important; flex-shrink: 0 !important; transition: all 0.15s ease !important; }
    #interview-copilot-root .ic-btn-ask-item:hover { background: #4f46e5 !important; color: #ffffff !important; transform: translateY(-1px) !important; }
    #interview-copilot-root .ic-history-turn { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-left: 3px solid #7c3aed !important; border-radius: 0 8px 8px 0 !important; padding: 8px 10px !important; margin-bottom: 8px !important; }
    #interview-copilot-root .ic-history-q { font-size: 11.5px !important; font-weight: 700 !important; color: #4338ca !important; margin-bottom: 4px !important; }
    #interview-copilot-root .ic-history-a { font-size: 11px !important; color: #334155 !important; line-height: 1.4 !important; }

    #interview-copilot-root .ic-modal-backdrop { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(15, 23, 42, 0.45) !important; backdrop-filter: blur(8px) !important; z-index: 1000000 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 18px !important; pointer-events: auto !important; }
    #interview-copilot-root .ic-modal-dialog { background: #ffffff !important; border: 1px solid #cbd5e1 !important; border-radius: 16px !important; padding: 18px !important; width: 100% !important; display: flex !important; flex-direction: column !important; gap: 14px !important; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18) !important; }
    #interview-copilot-root .ic-modal-header { display: flex !important; align-items: center !important; gap: 10px !important; }
    #interview-copilot-root .ic-modal-icon { width: 32px !important; height: 32px !important; border-radius: 8px !important; background: rgba(217, 119, 6, 0.12) !important; color: #d97706 !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; flex-shrink: 0 !important; }
    #interview-copilot-root .ic-modal-title { font-size: 14px !important; font-weight: 700 !important; color: #0f172a !important; }
    #interview-copilot-root .ic-modal-body { font-size: 12px !important; color: #334155 !important; line-height: 1.5 !important; }
    #interview-copilot-root .ic-consent-checkbox-row { display: flex !important; align-items: flex-start !important; gap: 10px !important; background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 12px !important; cursor: pointer !important; user-select: none !important; pointer-events: auto !important; transition: all 0.2s ease !important; }
    #interview-copilot-root .ic-consent-checkbox-row:hover { background: #f1f5f9 !important; border-color: #c7d2fe !important; }
    #interview-copilot-root .ic-consent-checkbox { margin-top: 2px !important; width: 18px !important; height: 18px !important; accent-color: #4f46e5 !important; cursor: pointer !important; flex-shrink: 0 !important; pointer-events: auto !important; }
    #interview-copilot-root .ic-consent-label { font-size: 12px !important; font-weight: 600 !important; color: #0f172a !important; line-height: 1.45 !important; cursor: pointer !important; flex: 1 !important; pointer-events: auto !important; }
    #interview-copilot-root .ic-modal-actions { display: flex !important; gap: 10px !important; pointer-events: auto !important; }
    #interview-copilot-root .ic-btn-confirm-consent { flex: 1 !important; padding: 10px 14px !important; background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important; color: white !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 700 !important; cursor: pointer !important; transition: all 0.2s ease !important; box-shadow: 0 3px 10px rgba(5, 150, 105, 0.35) !important; pointer-events: auto !important; }
    #interview-copilot-root .ic-btn-cancel-consent { padding: 10px 14px !important; background: #f1f5f9 !important; color: #475569 !important; border: 1px solid #cbd5e1 !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; pointer-events: auto !important; transition: all 0.15s ease !important; }

    #interview-copilot-root .ic-debrief-dialog { background: #ffffff !important; border: 1.5px solid #c7d2fe !important; border-radius: 16px !important; padding: 18px !important; width: 100% !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; gap: 14px !important; box-shadow: 0 25px 50px rgba(15, 23, 42, 0.18) !important; }
    #interview-copilot-root .ic-debrief-section-title { font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; color: #4338ca !important; letter-spacing: 0.05em !important; margin-bottom: 5px !important; }
    #interview-copilot-root .ic-debrief-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 12px !important; font-size: 11.5px !important; color: #1e293b !important; line-height: 1.5 !important; }
    #interview-copilot-root .ic-btn-export-md { flex: 1 !important; padding: 10px 14px !important; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important; color: white !important; border: none !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 700 !important; cursor: pointer !important; box-shadow: 0 3px 10px rgba(79, 70, 229, 0.35) !important; }
    #interview-copilot-root .ic-btn-export-txt { flex: 1 !important; padding: 10px 14px !important; background: #f1f5f9 !important; color: #1e293b !important; border: 1px solid #cbd5e1 !important; border-radius: 8px !important; font-size: 12px !important; font-weight: 600 !important; cursor: pointer !important; }

    #interview-copilot-root .ic-footer { padding: 9px 16px !important; background: #f8fafc !important; border-top: 1px solid #e2e8f0 !important; font-size: 10.5px !important; color: #64748b !important; display: flex !important; align-items: center !important; justify-content: space-between !important; }
  `;

  console.log('[InterviewCo-Pilot] Initializing Interviewer Workspace with Offscreen Document Audio Capture (Light Theme)...');

  // Configuration
  const BACKEND_URL = 'http://127.0.0.1:5000';
  const SILENCE_FALLBACK_DELAY_MS = 2500; // 2.5 seconds silence trigger for crisp turn completion

  // State
  let isCapturing = false;
  let silenceTimerId = null;
  let currentTurnElement = null;
  let currentLanguage = 'English';
  let currentVoiceState = 'standby';
  let activeInterviewData = null;
  let alreadyAskedQuestions = [];
  let qaHistoryList = [];
  let fullTranscriptsList = [];
  let currentSuggestedQuestion = '';
  let streamingSuggestionText = '';
  let latestCompletedAnswerText = '';
  let sessionConsentConfirmed = false;

  // Create UI Root Container
  const root = document.createElement('div');
  root.id = 'interview-copilot-root';

  root.innerHTML = `
    <!-- Floating Collapsed Toggle Button -->
    <button class="ic-fab-toggle" id="ic-open-btn" title="Open InterviewCo-Pilot">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
      <span>Co-Pilot</span>
    </button>

    <!-- Main Sidebar Drawer -->
    <div class="ic-sidebar-container">
      <!-- Header -->
      <div class="ic-header">
        <div class="ic-brand">
          <div class="ic-brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div>
            <div class="ic-brand-title">InterviewCo-Pilot</div>
          </div>
          <span class="ic-privacy-pill" title="This panel renders strictly in your local browser and is never visible to the candidate">
            🔒 Private
          </span>
        </div>

        <div class="ic-header-actions">
          <button class="ic-icon-btn" id="ic-stealth-toggle-btn" title="Stealth Mode: Blurs panel during screen sharing so candidate cannot read notes">
            👁️ Stealth
          </button>
          <button class="ic-icon-btn" id="ic-minimize-btn" title="Minimize Sidebar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="ic-content" id="ic-content-area">
        
        <!-- HERO SECTION: Prominent Current AI Suggested Question -->
        <div class="ic-hero-suggestion-card" id="ic-hero-card">
          <div class="ic-hero-header">
            <span class="ic-hero-title">
              <span>✨</span>
              <span>AI Follow-Up Suggestion</span>
            </span>
            <div class="ic-hero-actions-top">
              <button class="ic-btn-suggest-now" id="ic-btn-suggest-now" title="Generate an immediate question from current discussion without waiting for silence">
                ⚡ Suggest Now
              </button>
            </div>
          </div>

          <div class="ic-hero-body" id="ic-hero-body">
            <div id="ic-suggestion-box">
              <div style="color:#64748b; font-size:11.5px; line-height:1.4;" id="ic-suggestion-placeholder">
                Follow-up suggestions will stream here automatically when the candidate speaks, or click "⚡ Suggest Now" at any time.
              </div>
            </div>
          </div>

          <div class="ic-hero-footer" id="ic-hero-footer" style="display:none;">
            <div style="display:flex; gap:6px;">
              <button class="ic-btn-action-pill" id="ic-btn-copy-question">
                📋 Copy
              </button>
              <button class="ic-btn-action-pill" id="ic-btn-mark-asked" style="color:#047857; border-color:rgba(5,150,105,0.3); background:rgba(5,150,105,0.1);">
                ✅ Mark Asked
              </button>
            </div>
            <span style="font-size:10px; color:#64748b;" id="ic-asked-total-badge">Asked: 0</span>
          </div>
        </div>

        <!-- Audio & Live Transcription Stream Card -->
        <div class="ic-transcript-card" id="ic-transcript-card">
          <div class="ic-transcript-header">
            <span class="ic-state-badge state-standby" id="ic-state-badge">
              <span class="ic-state-dot"></span>
              <span id="ic-state-text">Standby</span>
            </span>
            <div style="display:flex; gap:6px;">
              <span class="ic-lang-badge" id="ic-detected-lang-badge">🌐 English (Auto)</span>
              <span class="ic-vocab-badge" id="ic-vocab-badge">⚡ Vocab Primed</span>
            </div>
          </div>

          <!-- Live Scrolling Transcript Feed -->
          <div class="ic-transcript-feed" id="ic-transcript-feed">
            <div style="color:#64748b; font-size:11px; text-align:center; padding:12px 0;" id="ic-empty-transcript-hint">
              🎙️ Click "Start Interview" to capture tab audio and stream to Gemini.
            </div>
          </div>

          <!-- Audio Controls -->
          <div style="display:flex; gap:8px;">
            <button id="ic-btn-start-interview" class="ic-btn-start">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Start Interview (Live Transcribe)
            </button>
            <button id="ic-btn-stop-interview" class="ic-btn-stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12"></rect>
              </svg>
              Pause
            </button>
            <button id="ic-btn-end-interview" class="ic-btn-end-interview" title="End interview session, view complete debrief, and export transcripts">
              🏁 End Interview
            </button>
          </div>
        </div>

        <!-- ACCORDION 1: Remaining Question Bank (Unused Questions) -->
        <div class="ic-accordion-card open" id="ic-acc-qb">
          <div class="ic-accordion-header" id="ic-acc-qb-head">
            <span class="ic-accordion-title">
              <span>📋</span>
              <span>Remaining Question Bank</span>
            </span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="ic-card-badge" id="ic-qb-remaining-count">0 Remaining</span>
              <svg class="ic-accordion-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="ic-accordion-body" id="ic-qb-remaining-list">
            <div style="color:#64748b; font-size:11px; text-align:center; padding:8px 0;">
              Upload resume in extension popup to load candidate question bank.
            </div>
          </div>
        </div>

        <!-- ACCORDION 2: Previous Q&A History -->
        <div class="ic-accordion-card" id="ic-acc-history">
          <div class="ic-accordion-header" id="ic-acc-history-head">
            <span class="ic-accordion-title">
              <span>📜</span>
              <span>Interview Q&A History</span>
            </span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="ic-card-badge" id="ic-history-turns-count">0 Turns</span>
              <svg class="ic-accordion-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="ic-accordion-body" id="ic-history-list">
            <div style="color:#64748b; font-size:11px; text-align:center; padding:8px 0;">
              Completed questions and candidate answers will appear here as the interview progresses.
            </div>
          </div>
        </div>

        <!-- ACCORDION 3: Candidate Profile & Probing Gaps -->
        <div class="ic-accordion-card" id="ic-acc-profile">
          <div class="ic-accordion-header" id="ic-acc-profile-head">
            <span class="ic-accordion-title">
              <span>👤</span>
              <span id="ic-candidate-name-badge">Candidate Profile</span>
            </span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="ic-card-badge" id="ic-seniority-pill">Standby</span>
              <svg class="ic-accordion-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="ic-accordion-body" id="ic-candidate-profile-body">
            <div style="color:#64748b; font-size:11px; text-align:center; padding:8px 0;">
              Candidate resume skills, experience, and probing areas will appear here.
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="ic-footer">
        <span style="display:inline-flex; align-items:center; gap:5px; color:#059669; font-weight:600;">
          <span style="width:6px; height:6px; border-radius:50%; background:#059669;"></span>
          Interviewer Workspace
        </span>
        <span style="color:#64748b;">Offscreen Audio Active</span>
      </div>
    </div>

    <!-- MANDATORY CANDIDATE CONSENT MODAL (BLOCKING GATE) -->
    <div id="ic-consent-modal" class="ic-modal-backdrop" style="display:none;">
      <div class="ic-modal-dialog">
        <div class="ic-modal-header">
          <div class="ic-modal-icon">⚠️</div>
          <div>
            <div class="ic-modal-title">Candidate Disclosure & Consent</div>
          </div>
        </div>
        <div class="ic-modal-body">
          Before audio transcription starts, you must confirm that the candidate has been informed that this call is being transcribed for interview-assistance purposes.
        </div>
        <div class="ic-consent-checkbox-row" id="ic-consent-row">
          <input type="checkbox" id="ic-consent-checkbox" class="ic-consent-checkbox">
          <label for="ic-consent-checkbox" class="ic-consent-label" id="ic-consent-label">
            I confirm the candidate has been informed that this interview is being transcribed for real-time AI assistance.
          </label>
        </div>
        <div class="ic-modal-actions">
          <button id="ic-btn-cancel-consent" class="ic-btn-cancel-consent">Cancel</button>
          <button id="ic-btn-confirm-consent" class="ic-btn-confirm-consent" disabled>
            Confirm & Start Interview
          </button>
        </div>
      </div>
    </div>

    <!-- END INTERVIEW SUMMARY & DEBRIEF MODAL -->
    <div id="ic-debrief-modal" class="ic-modal-backdrop" style="display:none;">
      <div class="ic-debrief-dialog">
        <div class="ic-modal-header" style="justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="ic-modal-icon" style="background:rgba(79,70,229,0.1); color:#4f46e5;">🏁</div>
            <div>
              <div class="ic-modal-title" id="ic-debrief-candidate-title">Interview Summary & Debrief</div>
              <div style="font-size:10.5px; color:#64748b;" id="ic-debrief-meta-line">Candidate • Seniority</div>
            </div>
          </div>
          <button class="ic-icon-btn" id="ic-btn-close-debrief">&times;</button>
        </div>

        <div class="ic-debrief-scroll" id="ic-debrief-scroll">
          <!-- Debrief Sections Loaded Dynamically -->
        </div>

        <div class="ic-debrief-export-row">
          <button class="ic-btn-export-md" id="ic-btn-download-md">
            📄 Download Markdown (.md)
          </button>
          <button class="ic-btn-export-txt" id="ic-btn-download-txt">
            📝 Download Text (.txt)
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // DOM Elements
  const minimizeBtn = document.getElementById('ic-minimize-btn');
  const openBtn = document.getElementById('ic-open-btn');
  const stealthToggleBtn = document.getElementById('ic-stealth-toggle-btn');
  const btnStart = document.getElementById('ic-btn-start-interview');
  const btnStop = document.getElementById('ic-btn-stop-interview');
  const btnEndInterview = document.getElementById('ic-btn-end-interview');
  const btnSuggestNow = document.getElementById('ic-btn-suggest-now');
  const btnCopyQuestion = document.getElementById('ic-btn-copy-question');
  const btnMarkAsked = document.getElementById('ic-btn-mark-asked');

  // Consent Modal Elements
  const consentModal = document.getElementById('ic-consent-modal');
  const consentCheckbox = document.getElementById('ic-consent-checkbox');
  const consentRow = document.getElementById('ic-consent-row');
  const btnConfirmConsent = document.getElementById('ic-btn-confirm-consent');
  const btnCancelConsent = document.getElementById('ic-btn-cancel-consent');

  // Debrief Modal Elements
  const debriefModal = document.getElementById('ic-debrief-modal');
  const debriefCandidateTitle = document.getElementById('ic-debrief-candidate-title');
  const debriefMetaLine = document.getElementById('ic-debrief-meta-line');
  const debriefScroll = document.getElementById('ic-debrief-scroll');
  const btnCloseDebrief = document.getElementById('ic-btn-close-debrief');
  const btnDownloadMd = document.getElementById('ic-btn-download-md');
  const btnDownloadTxt = document.getElementById('ic-btn-download-txt');

  const heroCard = document.getElementById('ic-hero-card');
  const suggestionBox = document.getElementById('ic-suggestion-box');
  const heroFooter = document.getElementById('ic-hero-footer');
  const askedTotalBadge = document.getElementById('ic-asked-total-badge');

  const transcriptCard = document.getElementById('ic-transcript-card');
  const stateBadge = document.getElementById('ic-state-badge');
  const stateText = document.getElementById('ic-state-text');
  const detectedLangBadge = document.getElementById('ic-detected-lang-badge');
  const vocabBadge = document.getElementById('ic-vocab-badge');
  const transcriptFeed = document.getElementById('ic-transcript-feed');
  const emptyTranscriptHint = document.getElementById('ic-empty-transcript-hint');

  const accQb = document.getElementById('ic-acc-qb');
  const accQbHead = document.getElementById('ic-acc-qb-head');
  const qbRemainingCount = document.getElementById('ic-qb-remaining-count');
  const qbRemainingList = document.getElementById('ic-qb-remaining-list');

  const accHistory = document.getElementById('ic-acc-history');
  const accHistoryHead = document.getElementById('ic-acc-history-head');
  const historyTurnsCount = document.getElementById('ic-history-turns-count');
  const historyList = document.getElementById('ic-history-list');

  const accProfile = document.getElementById('ic-acc-profile');
  const accProfileHead = document.getElementById('ic-acc-profile-head');
  const candidateNameBadge = document.getElementById('ic-candidate-name-badge');
  const seniorityPill = document.getElementById('ic-seniority-pill');
  const candidateProfileBody = document.getElementById('ic-candidate-profile-body');

  // -------------------------------------------------------------
  // Panel Controls: Collapse, Minimize & Stealth Mode
  // -------------------------------------------------------------

  minimizeBtn.addEventListener('click', () => root.classList.add('collapsed'));
  openBtn.addEventListener('click', () => root.classList.remove('collapsed'));

  let isStealthMode = false;
  stealthToggleBtn.addEventListener('click', () => {
    isStealthMode = !isStealthMode;
    if (isStealthMode) {
      root.classList.add('stealth');
      stealthToggleBtn.classList.add('ic-stealth-active');
      stealthToggleBtn.textContent = '🔒 Stealth Active';
    } else {
      root.classList.remove('stealth');
      stealthToggleBtn.classList.remove('ic-stealth-active');
      stealthToggleBtn.textContent = '👁️ Stealth';
    }
  });

  const setupAccordion = (headEl, cardEl) => {
    headEl.addEventListener('click', () => {
      cardEl.classList.toggle('open');
    });
  };
  setupAccordion(accQbHead, accQb);
  setupAccordion(accHistoryHead, accHistory);
  setupAccordion(accProfileHead, accProfile);

  btnCopyQuestion.addEventListener('click', () => {
    if (currentSuggestedQuestion) {
      navigator.clipboard.writeText(currentSuggestedQuestion).then(() => {
        btnCopyQuestion.textContent = '✅ Copied!';
        setTimeout(() => {
          btnCopyQuestion.textContent = '📋 Copy';
        }, 2000);
      });
    }
  });

  btnMarkAsked.addEventListener('click', () => {
    if (currentSuggestedQuestion) {
      recordQuestionAsked(currentSuggestedQuestion, 'Interviewer confirmed');
      btnMarkAsked.textContent = '✅ Marked';
      setTimeout(() => {
        btnMarkAsked.textContent = '✅ Mark Asked';
      }, 1500);
    }
  });

  btnSuggestNow.addEventListener('click', () => {
    console.log('[InterviewCo-Pilot] Manual "Suggest Now" triggered by interviewer.');
    handleSuggestionStart();
    setVoiceState('suggesting');
    let contextText = latestCompletedAnswerText;
    if (!contextText && currentTurnElement) {
      const liveSpan = currentTurnElement.querySelector('.ic-text-content');
      contextText = liveSpan ? liveSpan.textContent.trim() : '';
    }
    if (!contextText) {
      contextText = "Candidate is discussing their technical background and architecture experience.";
    }
    requestNextQuestionSuggestion(contextText);
  });

  // -------------------------------------------------------------
  // Mandatory Candidate Consent Modal Handlers
  // -------------------------------------------------------------

  function updateConsentState() {
    btnConfirmConsent.disabled = !consentCheckbox.checked;
  }

  consentCheckbox.addEventListener('change', updateConsentState);
  consentCheckbox.addEventListener('click', (e) => e.stopPropagation());

  if (consentRow) {
    consentRow.addEventListener('click', (e) => {
      if (e.target !== consentCheckbox) {
        consentCheckbox.checked = !consentCheckbox.checked;
        updateConsentState();
      }
    });
  }

  btnCancelConsent.addEventListener('click', () => {
    consentModal.style.display = 'none';
    consentCheckbox.checked = false;
    btnConfirmConsent.disabled = true;
  });

  btnConfirmConsent.addEventListener('click', () => {
    sessionConsentConfirmed = true;
    consentModal.style.display = 'none';
    logConsentConfirmation();
    startAudioCaptureSession();
  });

  function logConsentConfirmation() {
    const logEntry = {
      id: Date.now().toString(),
      interviewId: activeInterviewData?.interviewId || 'session',
      candidateName: activeInterviewData?.analysis?.candidateName || 'Candidate',
      seniority: activeInterviewData?.metadata?.seniority || 'Senior',
      timestamp: new Date().toISOString(),
      action: 'CANDIDATE_TRANSCRIPTION_CONSENT_CONFIRMED',
      candidateInformed: true
    };

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['consentAuditLogs'], (items) => {
        const logs = items.consentAuditLogs || [];
        logs.unshift(logEntry);
        chrome.storage.local.set({ consentAuditLogs: logs.slice(0, 100) });
      });
    }
  }

  // Intercept Start Interview with Consent Check
  btnStart.addEventListener('click', () => {
    if (!sessionConsentConfirmed) {
      consentModal.style.display = 'flex';
      consentCheckbox.checked = false;
      btnConfirmConsent.disabled = true;
      return;
    }
    startAudioCaptureSession();
  });

  btnStop.addEventListener('click', stopAudioCaptureSession);

  // -------------------------------------------------------------
  // High-Performance In-Tab Audio Pipeline (Meet Audio + Mic)
  // -------------------------------------------------------------
  let activeAudioContext = null;
  let activeWorkletNode = null;
  let activeScriptProcessor = null;
  let activeMicStream = null;
  let attachedAudioElements = new Set();
  let liveWs = null;
  let audioObserver = null;
  let speechRecognizer = null;

  function startLiveSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Content] SpeechRecognition not supported in this browser.');
      return;
    }

    try {
      if (speechRecognizer) {
        try { speechRecognizer.abort(); } catch (e) {}
      }

      speechRecognizer = new SpeechRecognition();
      speechRecognizer.continuous = true;
      speechRecognizer.interimResults = true;
      speechRecognizer.maxAlternatives = 1;
      speechRecognizer.lang = 'en-US';

      speechRecognizer.onstart = () => {
        console.log('[Content] 🎙️ Native speech recognition active.');
      };

      speechRecognizer.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += trans;
          } else {
            interimText += trans;
          }
        }

        if (finalText) {
          console.log('[Content] Final Speech Turn:', finalText);
          appendTranscriptChunk(finalText, true);
        } else if (interimText) {
          appendTranscriptChunk(interimText, false);
          resetSilenceSafetyNetTimer();
        }
      };

      speechRecognizer.onerror = (event) => {
        console.warn('[Content] Speech recognition notice:', event.error);
      };

      speechRecognizer.onend = () => {
        if (isCapturing) {
          setTimeout(() => {
            if (isCapturing && speechRecognizer) {
              try { speechRecognizer.start(); } catch (e) {}
            }
          }, 200);
        }
      };

      speechRecognizer.start();
    } catch (err) {
      console.warn('[Content] Speech recognition initialization notice:', err.message);
    }
  }

  function stopLiveSpeechRecognition() {
    if (speechRecognizer) {
      try {
        speechRecognizer.stop();
        speechRecognizer.abort();
      } catch (e) {}
      speechRecognizer = null;
    }
  }

  function downsampleToInt16PCM(buffer, inputSampleRate, outputSampleRate = 16000) {
    if (inputSampleRate === outputSampleRate) {
      const pcm = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return pcm;
    }

    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      const sample = count > 0 ? (accum / count) : 0;
      const s = Math.max(-1, Math.min(1, sample));
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }

  function int16ArrayToBase64(int16Array) {
    const bytes = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function connectLiveWebSocket(candidateData) {
    if (liveWs && (liveWs.readyState === WebSocket.OPEN || liveWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const WS_URL = 'ws://127.0.0.1:5000/api/live-transcript';
    console.log('[Content] Connecting WebSocket to Gemini Live Proxy:', WS_URL);
    liveWs = new WebSocket(WS_URL);

    liveWs.onopen = () => {
      console.log('[Content] ✅ WebSocket connected. Priming session with vocabulary...');
      liveWs.send(JSON.stringify({
        type: 'INIT_SESSION',
        candidateData: candidateData
      }));
      isCapturing = true;
      setVoiceState('listening');
    };

    liveWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerLiveMessage(msg);
      } catch (err) {
        console.warn('[Content] WebSocket message parse error:', err);
      }
    };

    liveWs.onerror = (err) => console.warn('[Content] WebSocket notice:', err);
    liveWs.onclose = () => {
      console.log('[Content] Live WebSocket closed.');
      if (isCapturing) {
        setVoiceState('standby');
      }
    };
  }

  function handleServerLiveMessage(msg) {
    switch (msg.type) {
      case 'STATUS':
        if (msg.vocabularyCount !== undefined) {
          vocabBadge.textContent = `⚡ Vocab: ${msg.vocabularyCount} terms`;
        }
        break;

      case 'LANGUAGE_DETECTED':
        if (msg.language && msg.language !== currentLanguage) {
          currentLanguage = msg.language;
          detectedLangBadge.textContent = `🌐 ${currentLanguage} (Auto)`;
        }
        break;

      case 'TRANSCRIPT_CHUNK':
        setVoiceState('listening');
        appendTranscriptChunk(msg.text, msg.isFinal, msg.language);
        resetSilenceSafetyNetTimer();
        break;

      case 'TURN_COMPLETE':
        console.log(`[Content] Turn complete received (Source: ${msg.source || 'GEMINI_VAD_SIGNAL'})`);
        if (silenceTimerId) {
          clearTimeout(silenceTimerId);
          silenceTimerId = null;
        }
        finalizeTurn(msg.source || 'GEMINI_VAD_SIGNAL');
        break;

      case 'SPEAKER_INTERRUPTED':
        setVoiceState('listening');
        resetSilenceSafetyNetTimer();
        break;

      case 'SUGGESTION_START':
        handleSuggestionStart();
        break;

      case 'SUGGESTION_CHUNK':
        handleSuggestionChunk(msg.text);
        break;

      case 'SUGGESTION_DONE':
        handleSuggestionDone(msg.fullText);
        break;

      case 'SUGGESTION_ERROR':
        handleSuggestionError(msg.message);
        break;
    }
  }

  function sendAudioChunkToBackend(base64Chunk) {
    if (!base64Chunk || !isCapturing) return;
    if (liveWs && liveWs.readyState === WebSocket.OPEN) {
      liveWs.send(JSON.stringify({
        type: 'AUDIO_CHUNK',
        data: base64Chunk
      }));
    }
  }

  function attachMeetAudioElement(audioEl) {
    if (!audioEl || attachedAudioElements.has(audioEl) || !activeAudioContext) return;
    try {
      let source = null;
      if (audioEl.srcObject) {
        source = activeAudioContext.createMediaStreamSource(audioEl.srcObject);
      } else if (audioEl.src) {
        source = activeAudioContext.createMediaElementSource(audioEl);
      }
      if (source) {
        if (activeWorkletNode) {
          source.connect(activeWorkletNode);
        } else if (activeScriptProcessor) {
          source.connect(activeScriptProcessor);
        }
        attachedAudioElements.add(audioEl);
        console.log('[Content] ✅ Attached Meet audio stream for live transcription.');
      }
    } catch (err) {
      console.log('[Content] Audio element connect notice:', err.message);
    }
  }

  async function startAudioCaptureSession() {
    if (isCapturing) return;

    setVoiceState('connecting');
    stateText.textContent = 'Connecting...';

    const candidateData = {
      candidateName: activeInterviewData?.analysis?.candidateName || '',
      seniority: activeInterviewData?.metadata?.seniority || 'Senior',
      skills: activeInterviewData?.analysis?.skills || [],
      projects: (activeInterviewData?.analysis?.notableProjects || []).map(p => p.title || p.description).filter(Boolean)
    };

    const termCount = (candidateData.skills?.length || 0) + (candidateData.projects?.length || 0);
    vocabBadge.textContent = `⚡ Vocab: ${termCount} terms`;

    try {
      // Step 1: Initialize AudioContext
      activeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (activeAudioContext.state === 'suspended') {
        await activeAudioContext.resume();
      }

      console.log('[Content] AudioContext initialized. Sample Rate:', activeAudioContext.sampleRate);

      // Silent gain node to pump Web Audio graph without playing duplicate audio to speakers
      const silentGain = activeAudioContext.createGain();
      silentGain.gain.value = 0.0;
      silentGain.connect(activeAudioContext.destination);

      // Step 2: Set up AudioWorklet or ScriptProcessor
      if (activeAudioContext.audioWorklet) {
        const workletCode = `
          class PCMProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input && input[0] && input[0].length > 0) {
                this.port.postMessage(input[0]);
              }
              return true;
            }
          }
          registerProcessor('pcm-processor', PCMProcessor);
        `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await activeAudioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        activeWorkletNode = new AudioWorkletNode(activeAudioContext, 'pcm-processor');
        activeWorkletNode.port.onmessage = (e) => {
          if (!isCapturing) return;
          const inputData = e.data;
          const pcm16 = downsampleToInt16PCM(inputData, activeAudioContext.sampleRate, 16000);
          const b64 = int16ArrayToBase64(pcm16);
          sendAudioChunkToBackend(b64);
        };
        activeWorkletNode.connect(silentGain);
      } else {
        const bufferSize = 4096;
        activeScriptProcessor = activeAudioContext.createScriptProcessor(bufferSize, 1, 1);
        activeScriptProcessor.onaudioprocess = (e) => {
          if (!isCapturing) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = downsampleToInt16PCM(inputData, activeAudioContext.sampleRate, 16000);
          const b64 = int16ArrayToBase64(pcm16);
          sendAudioChunkToBackend(b64);
        };
        activeScriptProcessor.connect(silentGain);
      }

      // Step 3: Attach existing Google Meet participant <audio> elements
      attachedAudioElements.clear();
      document.querySelectorAll('audio').forEach(attachMeetAudioElement);

      if (audioObserver) audioObserver.disconnect();
      audioObserver = new MutationObserver(() => {
        if (!isCapturing) return;
        document.querySelectorAll('audio').forEach(attachMeetAudioElement);
      });
      audioObserver.observe(document.body, { childList: true, subtree: true });

      // Step 4: Capture Interviewer's Microphone
      try {
        activeMicStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const micSource = activeAudioContext.createMediaStreamSource(activeMicStream);
        if (activeWorkletNode) {
          micSource.connect(activeWorkletNode);
        } else if (activeScriptProcessor) {
          micSource.connect(activeScriptProcessor);
        }
        console.log('[Content] ✅ Microphone stream active and mixed into audio pipeline.');
      } catch (micErr) {
        console.log('[Content] Microphone capture notice:', micErr.message);
      }

      // Step 5: Start Speech Recognition for Instant Live Transcription
      startLiveSpeechRecognition();

      // Step 6: Connect WebSocket directly to Gemini Live Proxy
      connectLiveWebSocket(candidateData);
      console.log('[Content] ✅ In-tab audio pipeline active and streaming.');
    } catch (err) {
      console.error('[Content] Audio capture initialization failed:', err);
      stateText.textContent = `Error: ${err.message}`;
      setVoiceState('standby');
      isCapturing = false;
    }
  }

  function stopAudioCaptureSession() {
    isCapturing = false;
    if (silenceTimerId) {
      clearTimeout(silenceTimerId);
      silenceTimerId = null;
    }

    stopLiveSpeechRecognition();
    finalizeTurn('SESSION_STOPPED');
    setVoiceState('standby');

    if (audioObserver) {
      audioObserver.disconnect();
      audioObserver = null;
    }

    if (activeWorkletNode) {
      try {
        activeWorkletNode.port.onmessage = null;
        activeWorkletNode.disconnect();
      } catch (e) {}
      activeWorkletNode = null;
    }

    if (activeScriptProcessor) {
      try { activeScriptProcessor.disconnect(); } catch (e) {}
      activeScriptProcessor = null;
    }

    if (activeMicStream) {
      activeMicStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      activeMicStream = null;
    }

    if (activeAudioContext && activeAudioContext.state !== 'closed') {
      activeAudioContext.close().catch(() => {});
      activeAudioContext = null;
    }

    attachedAudioElements.clear();

    if (liveWs) {
      try {
        if (liveWs.readyState === WebSocket.OPEN) {
          liveWs.send(JSON.stringify({ type: 'STOP' }));
        }
        liveWs.close();
      } catch (e) {}
      liveWs = null;
    }

    console.log('[Content] Audio capture session stopped.');
  }

  // -------------------------------------------------------------
  // End Interview & Debrief Export Handlers
  // -------------------------------------------------------------

  btnEndInterview.addEventListener('click', () => {
    stopAudioCaptureSession();
    openDebriefModal();
  });

  btnCloseDebrief.addEventListener('click', () => {
    debriefModal.style.display = 'none';
  });

  function openDebriefModal() {
    const candidateName = activeInterviewData?.analysis?.candidateName || 'Candidate';
    const seniority = activeInterviewData?.metadata?.seniority || 'Senior';
    const interviewId = activeInterviewData?.interviewId || 'session';

    debriefCandidateTitle.textContent = `Debrief: ${candidateName}`;
    debriefMetaLine.textContent = `${seniority} Level • Session ID: #${interviewId.slice(0, 8)}`;

    const questionsHtml = alreadyAskedQuestions.length > 0
      ? alreadyAskedQuestions.map((q, i) => `
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-left:3px solid #7c3aed; padding:6px 9px; border-radius:0 6px 6px 0; margin-bottom:5px; font-size:11px; color:#0f172a;">
            <strong style="color:#4f46e5;">Q${i + 1}:</strong> ${escapeHtml(q)}
          </div>
        `).join('')
      : '<div style="color:#64748b; font-style:italic;">No questions recorded as asked.</div>';

    const transcriptHtml = fullTranscriptsList.length > 0
      ? fullTranscriptsList.map(t => `
          <div style="margin-bottom:6px; font-size:10.5px; line-height:1.4;">
            <span style="color:#4f46e5; font-family:monospace; font-weight:600;">[${t.timestamp || ''}] ${escapeHtml(t.speaker)}:</span>
            <span style="color:#334155;">${escapeHtml(t.text)}</span>
          </div>
        `).join('')
      : '<div style="color:#64748b; font-style:italic;">No live transcript turns captured.</div>';

    debriefScroll.innerHTML = `
      <div>
        <div class="ic-debrief-section-title">📋 Questions Asked (${alreadyAskedQuestions.length})</div>
        <div class="ic-debrief-box">${questionsHtml}</div>
      </div>
      <div>
        <div class="ic-debrief-section-title">🗣️ Conversation Transcript (${fullTranscriptsList.length} Turns)</div>
        <div class="ic-debrief-box" style="max-height:160px; overflow-y:auto;">${transcriptHtml}</div>
      </div>
    `;

    debriefModal.style.display = 'flex';
  }

  // Download Markdown Export
  btnDownloadMd.addEventListener('click', () => {
    const candidateName = activeInterviewData?.analysis?.candidateName || 'Candidate';
    const seniority = activeInterviewData?.metadata?.seniority || 'Senior';

    let md = `# Interview Debrief: ${candidateName}\n\n`;
    md += `**Date:** ${new Date().toLocaleDateString()} | **Seniority Level:** ${seniority}\n\n`;
    md += `---\n\n`;
    md += `## 1. Questions Asked (${alreadyAskedQuestions.length})\n\n`;
    alreadyAskedQuestions.forEach((q, i) => {
      md += `${i + 1}. **"${q}"**\n\n`;
    });
    md += `## 2. Full Conversation Transcript (${fullTranscriptsList.length} Turns)\n\n`;
    fullTranscriptsList.forEach(t => {
      md += `**[${t.timestamp || ''}] ${t.speaker}:**\n${t.text}\n\n`;
    });
    md += `---\n*Generated by InterviewCo-Pilot AI*`;

    const rawName = activeInterviewData?.analysis?.candidateName || 'Candidate';
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || 'Candidate';
    downloadFile(md, `interview-${safeName}-debrief.md`, 'text/markdown');
  });

  // Download Plain Text Export
  btnDownloadTxt.addEventListener('click', () => {
    const candidateName = activeInterviewData?.analysis?.candidateName || 'Candidate';
    let txt = `INTERVIEW DEBRIEF: ${candidateName.toUpperCase()}\n`;
    txt += `Date: ${new Date().toLocaleString()}\n\n`;
    txt += `QUESTIONS ASKED (${alreadyAskedQuestions.length}):\n`;
    alreadyAskedQuestions.forEach((q, i) => {
      txt += `${i + 1}. ${q}\n`;
    });
    txt += `\nFULL TRANSCRIPT:\n`;
    fullTranscriptsList.forEach(t => {
      txt += `[${t.timestamp || ''}] ${t.speaker}: ${t.text}\n\n`;
    });

    const rawName = activeInterviewData?.analysis?.candidateName || 'Candidate';
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || 'Candidate';
    downloadFile(txt, `interview-${safeName}-transcript.txt`, 'text/plain');
  });

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -------------------------------------------------------------
  // Visual Indicator State Management
  // -------------------------------------------------------------

  function setVoiceState(state) {
    currentVoiceState = state;
    stateBadge.className = `ic-state-badge state-${state}`;
    transcriptCard.classList.remove('listening', 'suggesting');

    if (state === 'listening') {
      stateText.textContent = 'Listening';
      transcriptCard.classList.add('listening');
    } else if (state === 'suggesting') {
      stateText.textContent = 'Suggesting';
      transcriptCard.classList.add('suggesting');
    } else if (state === 'connecting') {
      stateText.textContent = 'Connecting...';
    } else {
      stateText.textContent = 'Standby';
    }
  }

  // -------------------------------------------------------------
  // Hybrid Turn Completion (Gemini VAD + 5s Silence Rule)
  // -------------------------------------------------------------

  function resetSilenceSafetyNetTimer() {
    if (silenceTimerId) {
      clearTimeout(silenceTimerId);
    }

    silenceTimerId = setTimeout(() => {
      if (isCapturing && currentTurnElement) {
        console.log('[InterviewCo-Pilot] Candidate finished answering (Trigger: 2.5S_SILENCE_TIMER)');
        finalizeTurn('2.5S_SILENCE_TIMER');
      }
    }, SILENCE_FALLBACK_DELAY_MS);
  }

  function appendTranscriptChunk(text, isFinal = false, language = 'English') {
    if (!text) return;

    let cleanText = text.replace(/\*\*[^*]+\*\*/gi, '');
    cleanText = cleanText.replace(/\[Lang:[^\]]+\]/gi, '');
    cleanText = cleanText.trim();
    if (!cleanText) return;

    if (emptyTranscriptHint) {
      emptyTranscriptHint.remove();
    }

    if (language && language !== currentLanguage) {
      currentLanguage = language;
      detectedLangBadge.textContent = `🌐 ${currentLanguage} (Auto)`;
    }

    if (!currentTurnElement) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      currentTurnElement = document.createElement('div');
      currentTurnElement.className = 'ic-transcript-bubble';
      currentTurnElement.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <span style="font-size:9.5px; color:#64748b; font-family:monospace;">${timeStr}</span>
          <span class="ic-trigger-badge" style="display:none;"></span>
        </div>
        <div style="font-size:12px; color:#0f172a; line-height:1.4; word-break:break-word;">
          <span class="ic-text-content"></span>
        </div>
      `;
      transcriptFeed.appendChild(currentTurnElement);
    }

    const textSpan = currentTurnElement.querySelector('.ic-text-content');
    if (textSpan) {
      textSpan.textContent = cleanText;
    }

    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

    if (isFinal) {
      finalizeTurn('GEMINI_VAD_SIGNAL');
    }
  }

  function finalizeTurn(triggerSource = 'GEMINI_VAD_SIGNAL') {
    let finalizedAnswer = '';

    if (currentTurnElement) {
      const textSpan = currentTurnElement.querySelector('.ic-text-content');
      finalizedAnswer = textSpan ? textSpan.textContent.trim() : '';

      const triggerBadge = currentTurnElement.querySelector('.ic-trigger-badge');
      if (triggerBadge) {
        triggerBadge.style.display = 'inline-block';
        if (triggerSource === 'GEMINI_VAD_SIGNAL') {
          triggerBadge.className = 'ic-trigger-badge gemini';
          triggerBadge.textContent = '⚡ VAD';
        } else {
          triggerBadge.className = 'ic-trigger-badge timer';
          triggerBadge.textContent = '⏱️ 2.5s Silence';
        }
      }

      currentTurnElement = null;
    }

    if (finalizedAnswer.length > 5) {
      latestCompletedAnswerText = finalizedAnswer;

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      fullTranscriptsList.push({
        speaker: 'Candidate',
        text: finalizedAnswer,
        timestamp: timeStr,
        source: triggerSource
      });

      const lastQ = currentSuggestedQuestion || 'Interview Question';
      qaHistoryList.unshift({
        question: lastQ,
        answer: finalizedAnswer,
        timestamp: timeStr,
        source: triggerSource
      });
      renderQAHistory();

      syncTranscriptTurnToDb(finalizedAnswer, triggerSource);
    }

    if (isCapturing) {
      setVoiceState('suggesting');

      if (finalizedAnswer.length > 5) {
        requestNextQuestionSuggestion(finalizedAnswer);
      }
    }
  }

  function syncTranscriptTurnToDb(text, source) {
    if (!activeInterviewData?.interviewId) return;

    fetch(`${BACKEND_URL}/api/interviews/${activeInterviewData.interviewId}/transcripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speaker: 'Candidate',
        text: text,
        language: currentLanguage,
        source: source,
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.warn('[InterviewCo-Pilot] SQLite transcript sync warning:', err.message));
  }

  function syncAskedQuestionToDb(question, reasoning, source) {
    if (!activeInterviewData?.interviewId) return;

    fetch(`${BACKEND_URL}/api/interviews/${activeInterviewData.interviewId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        reasoning: reasoning || '',
        source: source || 'AI_SUGGESTED',
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.warn('[InterviewCo-Pilot] SQLite question sync warning:', err.message));
  }

  // -------------------------------------------------------------
  // Real-Time Token Streaming Follow-Up Questions
  // -------------------------------------------------------------

  function requestNextQuestionSuggestion(lastAnswerTranscript) {
    console.log('[InterviewCo-Pilot] Requesting streaming question...');
    const payload = {
      lastAnswerTranscript: lastAnswerTranscript,
      resumeSummary: activeInterviewData?.analysis || {},
      questionBank: activeInterviewData?.questionBank || {},
      alreadyAskedQuestions: alreadyAskedQuestions
    };

    if (liveWs && liveWs.readyState === WebSocket.OPEN) {
      liveWs.send(JSON.stringify({
        type: 'REQUEST_NEXT_QUESTION',
        payload: payload
      }));
      return;
    }

    if (chrome && chrome.runtime && chrome.runtime.id) {
      try {
        chrome.runtime.sendMessage({
          type: 'REQUEST_NEXT_QUESTION_OFFSCREEN',
          payload: payload
        }, () => {});
      } catch (e) {}
    }
  }

  function handleSuggestionStart() {
    streamingSuggestionText = '';
    heroCard.classList.add('streaming');
    heroFooter.style.display = 'none';

    suggestionBox.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; color:#4f46e5; font-size:12px; font-weight:600;">
        <span class="ic-live-cursor"></span>
        <span>Crafting follow-up question...</span>
      </div>
    `;
  }

  function handleSuggestionChunk(chunkText) {
    if (!chunkText) return;
    streamingSuggestionText += chunkText;
    renderSuggestionProgress(streamingSuggestionText);
  }

  function extractCleanQuestion(text) {
    if (!text || !text.trim()) return '';
    let q = text;
    q = q.replace(/^(?:\*\*Next Question:\*\*|\*\*Question:\*\*|Next Question:|Question:)\s*/i, '');
    const splitIndex = q.search(/(?:\*\*Why this follows:\*\*|\*\*Reasoning:\*\*|Why this follows:|Reasoning:)/i);
    if (splitIndex !== -1) {
      q = q.substring(0, splitIndex);
    }
    q = q.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    return q;
  }

  function renderSuggestionProgress(text) {
    if (!text || !text.trim()) return;

    const question = extractCleanQuestion(text);
    if (!question) return;

    suggestionBox.innerHTML = `
      <div class="ic-question-text">
        🎯 ${escapeHtml(question)}
      </div>
    `;
  }

  function handleSuggestionDone(fullText) {
    heroCard.classList.remove('streaming');
    const textToRender = fullText || streamingSuggestionText;
    const cleanQ = extractCleanQuestion(textToRender);

    if (cleanQ) {
      currentSuggestedQuestion = cleanQ;
      suggestionBox.innerHTML = `
        <div class="ic-question-text">
          🎯 ${escapeHtml(cleanQ)}
        </div>
      `;
      heroFooter.style.display = 'flex';
      recordQuestionAsked(cleanQ, 'AI Suggested');
    }
  }

  function handleSuggestionError(errorMessage) {
    heroCard.classList.remove('streaming');
    suggestionBox.innerHTML = `
      <div style="color:#dc2626; font-size:11px; line-height:1.4; font-weight:600;">
        ⚠️ ${escapeHtml(errorMessage || 'Could not generate follow-up at this time.')}
        <div style="color:#64748b; font-size:10.5px; margin-top:4px; font-weight:normal;">💡 Select an unasked question from the Question Bank accordion below.</div>
      </div>
    `;
  }

  function recordQuestionAsked(questionText, source = '', reasoning = '') {
    if (!questionText) return;
    if (!alreadyAskedQuestions.includes(questionText)) {
      alreadyAskedQuestions.push(questionText);
    }

    askedTotalBadge.textContent = `Asked: ${alreadyAskedQuestions.length}`;

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ alreadyAskedQuestions: alreadyAskedQuestions });
    }

    renderRemainingQuestionBank();
    syncAskedQuestionToDb(questionText, reasoning, source);
  }

  // -------------------------------------------------------------
  // Remaining Question Bank & Q&A History Rendering
  // -------------------------------------------------------------

  function renderRemainingQuestionBank() {
    const questions = activeInterviewData?.questionBank?.questions || [];
    const askedSet = new Set(alreadyAskedQuestions);

    const unaskedQuestions = questions.filter(q => !askedSet.has(q.question) && !askedSet.has(q.id));
    qbRemainingCount.textContent = `${unaskedQuestions.length} Remaining`;

    if (questions.length === 0) {
      qbRemainingList.innerHTML = `
        <div style="color:#64748b; font-size:11px; text-align:center; padding:8px 0;">
          Upload resume in extension popup to generate question bank.
        </div>
      `;
      return;
    }

    if (unaskedQuestions.length === 0) {
      qbRemainingList.innerHTML = `
        <div style="color:#059669; font-size:11.5px; font-weight:600; text-align:center; padding:12px 0;">
          🎉 All prepared Question Bank questions have been covered!
        </div>
      `;
      return;
    }

    qbRemainingList.innerHTML = unaskedQuestions.map(q => `
      <div class="ic-qb-item">
        <div style="flex:1;">
          <div style="font-size:9.5px; font-weight:700; color:#4338ca; text-transform:uppercase; margin-bottom:2px;">${escapeHtml(q.category || 'Topic')}</div>
          <div style="font-size:11.5px; color:#0f172a; line-height:1.35;">${escapeHtml(q.question)}</div>
        </div>
        <button class="ic-btn-ask-item" data-qid="${escapeHtml(q.id)}" data-qtext="${escapeHtml(q.question)}">
          Ask This
        </button>
      </div>
    `).join('');

    qbRemainingList.querySelectorAll('.ic-btn-ask-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qText = e.target.dataset.qtext;
        currentSuggestedQuestion = qText;

        suggestionBox.innerHTML = `<div class="ic-question-text">🎯 "${escapeHtml(qText)}"</div>`;
        heroFooter.style.display = 'flex';

        recordQuestionAsked(qText, 'Question Bank');
      });
    });
  }

  function renderQAHistory() {
    historyTurnsCount.textContent = `${qaHistoryList.length} Turns`;

    if (qaHistoryList.length === 0) {
      historyList.innerHTML = `
        <div style="color:#64748b; font-size:11px; text-align:center; padding:8px 0;">
          Completed questions and candidate answers will appear here as the interview progresses.
        </div>
      `;
      return;
    }

    historyList.innerHTML = qaHistoryList.map((turn, i) => `
      <div class="ic-history-turn">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <span style="font-size:9.5px; font-weight:700; color:#4338ca;">Q${qaHistoryList.length - i} [${turn.timestamp}]</span>
          <span class="ic-trigger-badge ${turn.source === 'GEMINI_VAD_SIGNAL' ? 'gemini' : 'timer'}">${turn.source === 'GEMINI_VAD_SIGNAL' ? 'VAD' : '2.5s Silence'}</span>
        </div>
        <div class="ic-history-q">"${escapeHtml(turn.question)}"</div>
        <div class="ic-history-a">🗣️ ${escapeHtml(turn.answer)}</div>
      </div>
    `).join('');
  }

  function renderCandidateProfile() {
    if (!activeInterviewData || !activeInterviewData.analysis) return;
    const { analysis, metadata } = activeInterviewData;

    candidateNameBadge.textContent = analysis.candidateName || 'Candidate';
    seniorityPill.textContent = `${metadata?.seniority || 'Senior'} • ${analysis.yearsOfExperience || 'Exp'}`;

    const gaps = analysis.knowledgeGapsAndProbingAreas || [];

    candidateProfileBody.innerHTML = `
      <div style="margin-bottom:8px;">
        <div style="font-size:12px; font-weight:700; color:#0f172a; margin-bottom:2px;">${escapeHtml(analysis.candidateName || 'Candidate')}</div>
        <div style="font-size:10.5px; color:#475569; line-height:1.4;">${escapeHtml(analysis.summary || '')}</div>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">
        ${(analysis.skills || []).map(s => `<span style="font-size:9.5px; background:#f1f5f9; border:1px solid #e2e8f0; padding:2px 6px; border-radius:4px; color:#334155;">${escapeHtml(s)}</span>`).join('')}
      </div>
      ${gaps.length > 0 ? `
        <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#b45309; margin-bottom:4px;">🎯 Key Probing Areas:</div>
        ${gaps.map((g, i) => `
          <div style="background:rgba(217,119,6,0.08); border-left:2.5px solid #d97706; padding:4px 6px; margin-bottom:4px; font-size:10.5px;">
            <strong style="color:#92400e;">${i + 1}. ${escapeHtml(g.topic)}:</strong> <span style="color:#334155;">${escapeHtml(g.reasonToProbe)}</span>
          </div>
        `).join('')}
      ` : ''}
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // -------------------------------------------------------------
  // Storage Synchronization
  // -------------------------------------------------------------

  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sidebarEnabled', 'activeInterview', 'alreadyAskedQuestions'], (items) => {
      if (items.sidebarEnabled === false) {
        root.classList.add('hidden');
      }
      if (items.alreadyAskedQuestions) {
        alreadyAskedQuestions = items.alreadyAskedQuestions;
      }
      if (items.activeInterview) {
        activeInterviewData = items.activeInterview;
        renderCandidateProfile();
        renderRemainingQuestionBank();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        chrome.storage.local.get(['activeInterview', 'alreadyAskedQuestions'], (items) => {
          if (items.alreadyAskedQuestions) {
            alreadyAskedQuestions = items.alreadyAskedQuestions;
          }
          if (items.activeInterview) {
            activeInterviewData = items.activeInterview;
            renderCandidateProfile();
            renderRemainingQuestionBank();
          }
        });
      }
    });
  }

  // -------------------------------------------------------------
  // Runtime Messages (from Offscreen Document and Background)
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'content' && message.type !== 'TOGGLE_SIDEBAR') return;

    switch (message.type) {
      case 'TOGGLE_SIDEBAR':
        if (message.enabled) {
          root.classList.remove('hidden');
        } else {
          root.classList.add('hidden');
        }
        sendResponse({ status: 'OK' });
        break;

      case 'CAPTURE_STATUS':
        if (message.status === 'LISTENING') {
          isCapturing = true;
          setVoiceState('listening');
        } else if (message.status === 'ERROR') {
          isCapturing = false;
          setVoiceState('standby');
          stateText.textContent = `Error: ${message.error || 'Capture failed'}`;
        }
        break;

      case 'STATUS':
        if (message.vocabularyCount !== undefined) {
          vocabBadge.textContent = `⚡ Vocab: ${message.vocabularyCount} terms`;
        }
        break;

      case 'LANGUAGE_DETECTED':
        if (message.language && message.language !== currentLanguage) {
          currentLanguage = message.language;
          detectedLangBadge.textContent = `🌐 ${currentLanguage} (Auto)`;
        }
        break;

      case 'TRANSCRIPT_CHUNK':
        setVoiceState('listening');
        appendTranscriptChunk(message.text, message.isFinal, message.language);
        resetSilenceSafetyNetTimer();
        break;

      case 'TURN_COMPLETE':
        console.log(`[Content] Candidate finished answering (Trigger: ${message.source || 'GEMINI_VAD_SIGNAL'})`);
        if (silenceTimerId) {
          clearTimeout(silenceTimerId);
          silenceTimerId = null;
        }
        finalizeTurn(message.source || 'GEMINI_VAD_SIGNAL');
        break;

      case 'SPEAKER_INTERRUPTED':
        setVoiceState('listening');
        resetSilenceSafetyNetTimer();
        break;

      case 'SUGGESTION_START':
        handleSuggestionStart();
        break;

      case 'SUGGESTION_CHUNK':
        handleSuggestionChunk(message.text);
        break;

      case 'SUGGESTION_DONE':
        handleSuggestionDone(message.fullText);
        break;

      case 'SUGGESTION_ERROR':
        handleSuggestionError(message.message);
        break;
    }
  });

  console.log('[InterviewCo-Pilot] Interviewer workspace panel ready with Offscreen Document Capture.');
})();
