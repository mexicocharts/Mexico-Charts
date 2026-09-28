// Presentation correction only: retain the upstream market and all audience values.
export function monitorMarketRegion(market) {
  if (market.countryCode?.toUpperCase() === "MX" &&
      market.name?.trim().toLowerCase() === "puebla" &&
      market.region?.trim().toUpperCase() === "CMX") return "Puebla";
  return market.region ?? market.countryCode;
}
