export function shouldRestoreLegacyPublishedResults({ isExplicitLegacy, snapshotMatchCount, hasConfirmedLegacyResults }) {
  return Boolean(isExplicitLegacy && snapshotMatchCount === 0 && hasConfirmedLegacyResults);
}
