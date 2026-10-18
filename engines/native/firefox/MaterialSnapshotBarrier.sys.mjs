/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Privileged engine-side coordination only. This module exposes no web, extension,
// automation, command-line, or debugging endpoint. A future native transport must
// authenticate its inherited peer and construct the binding itself.
export const REQUIRED_BARRIERS = Object.freeze([
  "network", "renderers", "serviceWorkers", "cookies", "places", "logins",
  "preferences", "sessionStore", "localStorage", "indexedDB", "cacheStorage",
  "extensions", "otherProfileWriters",
]);

const REQUEST_KEYS = Object.freeze({
  begin: ["command", "protocol", "requestId", "profileId"],
  commit: ["command", "protocol", "requestId", "generation"],
  abort: ["command", "protocol", "requestId"],
});

function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function validate(request) {
  const keys = request && REQUEST_KEYS[request.command];
  if (!keys || Object.keys(request).length !== keys.length ||
      keys.some(key => !Object.hasOwn(request, key)) ||
      request.protocol !== 1 || !validId(request.requestId) ||
      (request.command === "begin" && !validId(request.profileId)) ||
      (request.command === "commit" &&
        (!Number.isSafeInteger(request.generation) || request.generation < 1))) {
    throw new Error("Invalid snapshot command");
  }
}

/**
 * Each trusted provider's acquire() must stop admission, drain outstanding work,
 * flush durable state and return a release function while admission stays closed.
 * It must undo its own partial acquisition before rejecting. A flush alone is
 * insufficient. No current Firefox store is registered by this implementation.
 */
export class MaterialSnapshotBarrier {
  #binding;
  #providers;
  #active = null;
  #busy = false;
  #generation = 0;
  #poisoned = false;

  constructor(binding, providers = {}) {
    if (!binding || !validId(binding.profileId) ||
        !/^[a-f0-9]{64}$/.test(binding.engineSha256)) {
      throw new Error("Invalid trusted snapshot binding");
    }
    this.#binding = Object.freeze({ ...binding });
    this.#providers = new Map();
    for (const [name, provider] of Object.entries(providers)) {
      if (!REQUIRED_BARRIERS.includes(name) || typeof provider?.acquire !== "function") {
        throw new Error("Invalid snapshot barrier provider");
      }
      // Capture the function now so caller mutation cannot replace a live provider.
      this.#providers.set(name, provider.acquire.bind(provider));
    }
  }

  get status() {
    return Object.freeze({
      available: !this.#poisoned && REQUIRED_BARRIERS.every(name => this.#providers.has(name)),
      missingStores: Object.freeze(REQUIRED_BARRIERS.filter(name => !this.#providers.has(name))),
      active: this.#active !== null,
      poisoned: this.#poisoned,
    });
  }

  async #release(active) {
    let failed = false;
    for (const release of active.releases.reverse()) {
      try {
        await release();
      } catch {
        failed = true;
      }
    }
    if (failed) {
      this.#poisoned = true;
      throw new Error("Snapshot barrier release failed; engine recovery required");
    }
  }

  async dispatch(request) {
    validate(request);
    request = Object.freeze({ ...request });
    // Never queue competing commands behind an in-progress acquisition/release.
    if (this.#busy || this.#poisoned) {
      throw new Error("Snapshot control unavailable");
    }
    if (request.command === "begin") {
      if (this.#active || request.profileId !== this.#binding.profileId) {
        throw new Error("Snapshot profile or state mismatch");
      }
      if (!this.status.available) {
        return Object.freeze({ protocol: 1, requestId: request.requestId,
          status: "unavailable", missingStores: this.status.missingStores });
      }
      if (this.#generation === Number.MAX_SAFE_INTEGER) {
        throw new Error("Snapshot generation exhausted");
      }
      this.#busy = true;
      const active = { requestId: request.requestId, releases: [] };
      try {
        for (const name of REQUIRED_BARRIERS) {
          const release = await this.#providers.get(name)();
          if (typeof release !== "function") {
            // The provider contract was violated, so do not advertise future readiness.
            this.#poisoned = true;
            throw new Error("Snapshot provider did not return its release function");
          }
          active.releases.push(release);
        }
        active.generation = ++this.#generation;
        this.#active = active;
        return Object.freeze({ protocol: 1, requestId: request.requestId,
          profileId: this.#binding.profileId, engineSha256: this.#binding.engineSha256,
          generation: active.generation, networkPaused: true, renderersPaused: true,
          serviceWorkersPaused: true, databasesFlushed: true, storageWritersFrozen: true });
      } catch (error) {
        await this.#release(active);
        throw error;
      } finally {
        this.#busy = false;
      }
    }
    const active = this.#active;
    if (!active || active.requestId !== request.requestId ||
        (request.command === "commit" && active.generation !== request.generation)) {
      throw new Error("Snapshot transaction mismatch");
    }
    this.#busy = true;
    this.#active = null;
    try {
      await this.#release(active);
      return Object.freeze({ protocol: 1, requestId: request.requestId,
        status: request.command === "commit" ? "released" : "aborted" });
    } finally {
      this.#busy = false;
    }
  }
}
