import {getLogger} from "@ui5/logger";
import {fetchCdn} from "./cdnHelper.js";
import {Mutex} from "async-mutex";

const log = getLogger("utils:ui5Manifest");

const LATEST_SCHEMA_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/schema.json";
const schemaCache = new Map<string, object>();
const fetchSchemaMutex = new Mutex();

let UI5ToManifestVersionMapping: Record<string, string> | null = null;
const MAPPING_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json";
const ui5ToManifestVersionMappingMutex = new Mutex();

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
		const schema = await fetchCdn(LATEST_SCHEMA_URL);
		log.info(`Fetched UI5 manifest schema from ${LATEST_SCHEMA_URL}`);

		schemaCache.set(manifestVersion, schema);

		return schema;
	} finally {
		release();
	}
}

export async function getLatestManifestVersion() {
	const versionMap = await getUI5toManifestVersionMapping();

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
