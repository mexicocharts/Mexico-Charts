declare const __MONITORING_SOURCE_FINGERPRINT__: string;

export function monitoringBuildIdentity() {
  return {
    sourceFingerprint: typeof __MONITORING_SOURCE_FINGERPRINT__ === "string" ? __MONITORING_SOURCE_FINGERPRINT__ : null,
    runtimeMode: typeof __MONITORING_SOURCE_FINGERPRINT__ === "string" ? "packaged" : "unbundled",
    historyAuthorization: "artist_grant_only",
  };
}
