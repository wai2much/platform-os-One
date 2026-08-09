import * as Zeller from '@zeller-public/payments-sdk-react';

/**
 * Real Zeller Terminal Payments SDK wiring (2026-08-09) — @zeller-public/
 * payments-sdk-react, pulled from Zeller's own developer registry (see
 * .npmrc + ZELLER_NPM_TOKEN in .env.example), not a guess.
 *
 * IMPORTANT — this is a fully CLIENT-SIDE SDK, and that's a real
 * architectural difference from supabase/functions/zellerPayments/index.ts
 * (built earlier the same night, against a *guessed* server-side "Online"
 * payment-links REST endpoint). The Terminal flow needs no backend call and
 * no ZELLER_API_KEY at all: the browser talks directly to a Zeller-hosted
 * iframe, which talks to the paired physical Zeller Terminal. Auth happens
 * once via `setup()`, which opens Zeller's own hosted login UI — real Zeller
 * username/password, entered into Zeller's UI, never typed into or stored
 * by this app. Device pairing then persists in the browser across reloads
 * (see Zeller's Concepts → Devices docs).
 *
 * zellerPayments/index.ts stays relevant for later — if/when Zeller ships
 * "Online" (no-hardware, card-not-present) or the server-side "Zeller API"
 * — but neither is published yet per Zeller's own docs (confirmed 2026-08-09
 * directly from developer.myzeller.com), so it's unrelated to this file.
 */

export function ZellerProvider({ children }) {
  return (
    <Zeller.Provider
      vendorName="Platform OS"
      vendorApplicationName="Platform OS — TyrePlus Thomastown"
      vendorApplicationVersion="0.1.0"
      vendorDeviceType="counter"
    >
      {children}
    </Zeller.Provider>
  );
}

export const useTerminal = Zeller.useTerminal;
