/** Release-candidate invariant, not an environment toggle. Historical private
 * diagnostics remain in Git for evidence, but stale preview environment values
 * must never reactivate SQL probes, query tagging or acceptance payload logging. */
export const MONITOR_PRIVATE_DIAGNOSTICS_ENABLED: boolean = false;
