import {getLogger} from "@ui5/logger";
import {fetchCdn} from "./cdnHelper.js";

const log = getLogger("utils:ui5Manifest");
const MAPPING_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json";
const LATEST_SCHEMA_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/schema.json";
const schemaCache = new Map<string, Promise<object>>();

async function getUI5toManifestVersionMap() {
	const mapping = await fetchCdn(MAPPING_URL);

	return mapping as Record<string, string>;
}

async function fetchSchema(manifestVersion: string) {
	if (schemaCache.has(manifestVersion)) {
		log.info(`Loading cached schema for manifest version: ${manifestVersion}`);

		try {
			const schema = await schemaCache.get(manifestVersion)!;
			return schema;
		} catch {
			schemaCache.delete(manifestVersion);
		}
	}

	log.info(`Fetching schema for manifest version: ${manifestVersion}`);
	schemaCache.set(manifestVersion, fetchCdn(LATEST_SCHEMA_URL));
	const schema = await schemaCache.get(manifestVersion)!;
	log.info(`Fetched UI5 manifest schema from ${LATEST_SCHEMA_URL}`);

	return schema;
}

export async function getLatestManifestVersion() {
	const versionMap = await getUI5toManifestVersionMap();

	if (!versionMap.latest) {
		throw new Error("Could not determine latest manifest version.");
	}

	return versionMap.latest;
}

export async function getManifestSchema(manifestVersion: string) {
	if (manifestVersion !== "latest") {
		throw new Error(`Only 'latest' manifest version is supported, but got '${manifestVersion}'.`);
	}

	return await fetchSchema(manifestVersion);
}
