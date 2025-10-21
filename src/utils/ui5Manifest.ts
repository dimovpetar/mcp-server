import {getLogger} from "@ui5/logger";
import {fetchCdn} from "./cdnHelper.js";

const log = getLogger("utils:dataStorageHelper");
const MAPPING_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json";
const LATEST_SCHEMA_URL = "https://raw.githubusercontent.com/SAP/ui5-manifest/main/schema.json";

async function getUI5toManifestVersionMap() {
	const mapping = await fetchCdn(MAPPING_URL);

	return mapping as Record<string, string>;
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

	// Fetch the UI5 manifest schema
	const schema = await fetchCdn(LATEST_SCHEMA_URL);
	log.info(`Fetched UI5 manifest schema from ${LATEST_SCHEMA_URL}`);

	return schema;
}
