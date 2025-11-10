import {getLogger} from "@ui5/logger";
import {fetchCdn} from "./cdnHelper.js";
import {Mutex} from "async-mutex";
import semver from "semver";

const log = getLogger("utils:ui5Manifest");

const schemaCache = new Map<string, object>();
const fetchSchemaMutex = new Mutex();

let UI5ToManifestVersionMapping: Record<string, string> | null = null;
const MAPPING_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json";
const ui5ToManifestVersionMappingMutex = new Mutex();

function getSchemaURL(manifestVersion: string) {
	return `https://raw.githubusercontent.com/SAP/ui5-manifest/v${manifestVersion}/schema.json`;
}

async function getUI5toManifestVersionMapping() {
	const release = await ui5ToManifestVersionMappingMutex.acquire();

	try {
		if (UI5ToManifestVersionMapping) {
			log.info("Loading cached UI5 to manifest version mapping");
			return UI5ToManifestVersionMapping;
		}

		log.info("Fetching UI5 to manifest version mapping");
		const mapping = await fetchCdn(MAPPING_URL);
		log.info(`Fetched UI5 to manifest version mapping from ${MAPPING_URL}`);

		UI5ToManifestVersionMapping = mapping as Record<string, string>;

		return UI5ToManifestVersionMapping;
	} finally {
		release();
	}
}

async function fetchSchema(manifestVersion: string) {
	const release = await fetchSchemaMutex.acquire();

	try {
		if (schemaCache.has(manifestVersion)) {
			log.info(`Loading cached schema for manifest version: ${manifestVersion}`);
			return schemaCache.get(manifestVersion)!;
		}

		log.info(`Fetching schema for manifest version: ${manifestVersion}`);
		const schemaURL = getSchemaURL(manifestVersion);
		const schema = await fetchCdn(schemaURL);
		log.info(`Fetched UI5 manifest schema from ${schemaURL}`);

		schemaCache.set(manifestVersion, schema);

		return schema;
	} finally {
		release();
	}
}

/**
 * Get the manifest schema for a specific manifest version.
 * @param manifestVersion The manifest version
 * @returns The manifest schema
 * @throws Error if the manifest version is unsupported
 */
export async function getManifestSchema(manifestVersion: string) {
	if (semver.lt(manifestVersion, "1.48.0")) {
		throw new Error(
			`Manifest version '${manifestVersion}' is not supported. Please upgrade to a newer one.`
		);
	}

	try {
		return await fetchSchema(manifestVersion);
	} catch (error) {
		let supportedVersions;

		try {
			const versionMap = await getUI5toManifestVersionMapping();
			supportedVersions = Object.values(versionMap);
		} catch (error) {
			log.warn(`Failed to fetch UI5 to manifest version mapping: ` +
				`${error instanceof Error ? error.message : String(error)}`);
		};

		// try to hint which versions are supported
		if (supportedVersions && !supportedVersions.includes(manifestVersion)) {
			throw new Error(
				`Failed to fetch schema for manifest version '${manifestVersion}': ` +
				`This version is not supported. ` +
				`Supported versions are: ${supportedVersions.join(", ")}. ` +
				`${error instanceof Error ? error.message : String(error)}`
			);
		}

		throw new Error(
			`Failed to fetch schema for manifest version '${manifestVersion}': ` +
			`${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Get the manifest version from the manifest object.
 * @param manifest The manifest object
 * @returns The manifest version
 * @throws Error if the manifest version is missing or invalid
 */
export function getManifestVersion(manifest: object) {
	if (!("_version" in manifest)) {
		throw new Error("Manifest does not contain a '_version' property.");
	}

	if (typeof manifest._version !== "string") {
		throw new Error("Manifest '_version' property is not a string.");
	}

	if (!semver.valid(manifest._version)) {
		throw new Error("Manifest '_version' property is not a valid semantic version.");
	}

	return manifest._version;
}

/**
 * @returns The latest manifest version
 */
export async function getLatestManifestVersion() {
	const versionMap = await getUI5toManifestVersionMapping();

	if (!versionMap.latest) {
		throw new Error("Could not determine latest manifest version.");
	}

	return versionMap.latest;
}
