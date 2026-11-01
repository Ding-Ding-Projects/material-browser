function createFlavours({
  json,
  resolveVanilla,
  discoverVanilla,
  fail,
  sourceUrl,
}) {
  const PAPER = "https://fill.papermc.io/v3/projects/paper";
  const FABRIC = "https://meta.fabricmc.net/v2/versions";
  function part(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._+-]{1,80}$/.test(value))
      fail("INVALID_VERSION", "Invalid provider version identity");
    return encodeURIComponent(value);
  }
  async function discover(flavour, signal) {
    const java = await discoverVanilla(signal);
    let values;
    let source;
    if (flavour === "paper") {
      const data = await json(PAPER, signal);
      if (!data.versions || typeof data.versions !== "object")
        fail("INVALID_CATALOGUE", "Paper version catalogue is malformed");
      values = Object.values(data.versions).flat();
      source = PAPER;
    } else if (flavour === "fabric") {
      const data = await json(`${FABRIC}/game`, signal);
      if (!Array.isArray(data))
        fail("INVALID_CATALOGUE", "Fabric version catalogue is malformed");
      values = data.map((item) => item.version);
      source = `${FABRIC}/game`;
    } else fail("FLAVOUR_UNAVAILABLE", "Unknown server flavour");
    if (!values.every((value) => typeof value === "string"))
      fail("INVALID_CATALOGUE", "Invalid provider version identifiers");
    const listed = new Set(values);
    return {
      ...java,
      versions: [
        ...java.versions
          .filter((v) => listed.has(v.id))
          .map((v) => ({ ...v, flavour, providerListed: true })),
        ...[...listed]
          .filter((id) => !java.versions.some((v) => v.id === id))
          .map((id) => ({
            id,
            type: "provider-only",
            flavour,
            providerListed: true,
            metadataAvailable: false,
            available: false,
            reason:
              "Provider lists this version but the current official Java catalogue supplies no matching metadata",
            serverDistribution: "unresolved",
          })),
      ],
      flavour,
      providerSource: source,
      providerRetrievedAt: new Date().toISOString(),
      providerVersionCount: listed.size,
      unresolvedProviderVersions: [...listed].filter(
        (id) => !java.versions.some((v) => v.id === id),
      ),
      complete: true,
    };
  }
  async function resolve(version, signal, options = {}) {
    const flavour = options.flavour || "vanilla";
    const base = await resolveVanilla(version, signal);
    if (flavour === "vanilla")
      return { ...base, flavour, integrityKnown: true };
    if (flavour === "paper") {
      const builds = await json(
        `${PAPER}/versions/${part(version)}/builds`,
        signal,
      );
      if (!Array.isArray(builds) || !builds.length)
        return {
          ...base,
          flavour,
          available: false,
          reason: "Paper has no build for this version",
        };
      const build =
        options.buildId !== undefined
          ? builds.find((item) => String(item.id) === String(options.buildId))
          : builds.find((item) => item.channel === "STABLE");
      if (!build)
        return {
          ...base,
          flavour,
          available: false,
          reason:
            "No selected or stable Paper build is available; experimental builds require explicit selection",
        };
      const download = build.downloads?.["server:default"];
      if (
        !download ||
        !/^[a-f0-9]{64}$/.test(download.checksums?.sha256 || "") ||
        !Number.isSafeInteger(download.size) ||
        download.size <= 0 ||
        download.size > 1024 ** 3
      )
        fail(
          "INVALID_DISTRIBUTION",
          "Paper build lacks bounded published SHA-256 metadata",
        );
      sourceUrl(download.url);
      return {
        ...base,
        available: true,
        flavour,
        buildId: build.id,
        buildChannel: build.channel,
        integrityKnown: true,
        download: {
          url: download.url,
          sha256: download.checksums.sha256,
          size: download.size,
        },
        licence: "GPL-3.0; review the selected distribution licence",
        licenceUrl: "https://github.com/PaperMC/Paper/blob/main/LICENSE.md",
      };
    }
    if (flavour === "fabric") {
      const [loaders, installers] = await Promise.all([
        json(`${FABRIC}/loader/${part(version)}`, signal),
        json(`${FABRIC}/installer`, signal),
      ]);
      if (!Array.isArray(loaders) || !Array.isArray(installers))
        fail(
          "INVALID_CATALOGUE",
          "Fabric compatibility catalogue is malformed",
        );
      const loader = options.loaderVersion
        ? loaders.find((item) => item.loader?.version === options.loaderVersion)
            ?.loader
        : loaders.find((item) => item.loader?.stable)?.loader;
      const installer = options.installerVersion
        ? installers.find((item) => item.version === options.installerVersion)
        : installers.find((item) => item.stable);
      if (!loader || !installer)
        return {
          ...base,
          flavour,
          available: false,
          reason:
            "No selected or stable compatible Fabric loader/installer is available",
        };
      const url = `${FABRIC}/loader/${part(version)}/${part(loader.version)}/${part(installer.version)}/server/jar`;
      return {
        ...base,
        available: true,
        flavour,
        loaderVersion: loader.version,
        installerVersion: installer.version,
        integrityKnown: false,
        integrityNote:
          "The official bootstrap endpoint supplies no catalogue checksum. Its locally observed SHA-256 is not publisher integrity proof. Bootstrap may download additional files on first launch.",
        download: { url, max: 32 * 1024 ** 2 },
        licence: "Apache-2.0 loader; component licences remain separate",
        licenceUrl:
          "https://github.com/FabricMC/fabric-loader/blob/master/LICENSE",
      };
    }
    fail("FLAVOUR_UNAVAILABLE", "Unknown server flavour");
  }
  return { discover, resolve };
}
module.exports = { createFlavours };
