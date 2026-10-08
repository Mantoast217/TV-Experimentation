const linkClassName =
  "underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-blue)]";

/** Required by the GeoNames data licence (CC BY 4.0): credit, a licence link, and a note that it's been changed. */
export function DataCredit() {
  return (
    <p className="m-0">
      City and country data adapted from{" "}
      <a href="https://www.geonames.org/" className={linkClassName}>
        GeoNames
      </a>
      , licensed under{" "}
      <a href="https://creativecommons.org/licenses/by/4.0/" className={linkClassName}>
        CC BY 4.0
      </a>
      .
    </p>
  );
}
