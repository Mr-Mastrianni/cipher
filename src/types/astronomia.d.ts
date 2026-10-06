/**
 * Minimal type declarations for the parts of `astronomia` (MIT) the KP engine
 * uses. The package ships plain JavaScript.
 */

declare module "astronomia/planetposition" {
  export class Planet {
    constructor(data: unknown);
    /** Heliocentric ecliptic position (radians, AU) on the equinox and ecliptic of date. */
    position(jde: number): { lon: number; lat: number; range: number };
  }
}

declare module "astronomia/elp" {
  export class Moon {
    constructor(data: unknown);
    /** Geocentric rectangular coordinates, km, mean ecliptic and equinox of J2000. */
    positionXYZ(jde: number): { x: number; y: number; z: number };
  }
}

declare module "astronomia/precess" {
  const precess: {
    eclipticPosition(
      ecl: { lon: number; lat: number },
      epochFrom: number,
      epochTo: number,
    ): { lon: number; lat: number };
  };
  export default precess;
}

declare module "astronomia/coord" {
  const coord: {
    Ecliptic: new (lon: number, lat: number) => { lon: number; lat: number };
  };
  export default coord;
}

declare module "astronomia/deltat" {
  const deltat: { deltaT(decimalYear: number): number };
  export default deltat;
}

declare module "astronomia/data/*" {
  const data: unknown;
  export default data;
}
